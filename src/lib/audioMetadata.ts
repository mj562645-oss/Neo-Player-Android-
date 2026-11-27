import {
  cleanArtistName,
  cleanMediaTagNoise,
  hasFilenameNoise,
  isPlaceholderAlbum,
  isPlaceholderArtist,
  parseAudioFilename,
} from './filenameParser';
import { getAudioFormatLabel, sanitizeText } from './format';

export interface ExtractedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  duration: number;
  format: string;
  artworkBlob?: Blob;
  embeddedLyrics?: string;
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/, '');
    }
    if (encoding === 1) {
      // UTF-16 with BOM
      if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder('utf-16le').decode(bytes.slice(2)).replace(/\0+$/, '');
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder('utf-16be').decode(bytes.slice(2)).replace(/\0+$/, '');
      }
      return new TextDecoder('utf-16le').decode(bytes).replace(/\0+$/, '');
    }
    if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0+$/, '');
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '');
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0+$/, '');
  }
}

function findNullTerminator(bytes: Uint8Array, start: number, encoding: number): number {
  const isTwoByte = encoding === 1 || encoding === 2;
  if (isTwoByte) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
    }
    return bytes.length;
  }
  for (let i = start; i < bytes.length; i++) {
    if (bytes[i] === 0) return i;
  }
  return bytes.length;
}

function removeUnsynchronisation(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]);
    if (bytes[i] === 0xff && i + 1 < bytes.length && bytes[i + 1] === 0x00) {
      i++;
    }
  }
  return new Uint8Array(out);
}

function parseSynchsafe(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function parseUint32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]) >>>
    0
  );
}

function parseId3v2(buf: Uint8Array, result: Partial<ExtractedAudioMetadata>): void {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return;
  const version = buf[3];
  const flags = buf[5];
  const tagSize = parseSynchsafe(buf[6], buf[7], buf[8], buf[9]);
  const end = Math.min(buf.length, 10 + tagSize);

  let pos = 10;
  // Extended header
  if (flags & 0x40 && pos + 4 <= end) {
    const extSize =
      version === 4
        ? parseSynchsafe(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3])
        : parseUint32BE(buf, pos);
    pos += version === 4 ? extSize : extSize + 4;
  }

  const globalUnsync = (flags & 0x80) !== 0;

  while (pos < end) {
    if (version === 2) {
      if (pos + 6 > end) break;
      const frameId = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2]);
      if (frameId === '\0\0\0') break;
      const frameSize = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
      pos += 6;
      if (frameSize <= 0 || pos + frameSize > end) break;
      const frameData = buf.slice(pos, pos + frameSize);
      pos += frameSize;
      applyId3Frame(frameId, frameData, result);
    } else {
      if (pos + 10 > end) break;
      const frameId = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
      if (frameId === '\0\0\0\0') break;
      const frameSize =
        version === 4
          ? parseSynchsafe(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7])
          : parseUint32BE(buf, pos + 4);
      const frameFlags = buf[pos + 9];
      pos += 10;
      if (frameSize <= 0 || pos + frameSize > end) break;
      let frameData = buf.slice(pos, pos + frameSize);
      pos += frameSize;

      if (globalUnsync || (version === 4 && (frameFlags & 0x02) !== 0)) {
        frameData = removeUnsynchronisation(frameData);
      }
      applyId3Frame(frameId, frameData, result);
    }
  }
}

function cleanGenreString(raw: string): string {
  const match = raw.match(/^\(\d+\)\s*(.*)$/);
  if (match && match[1]) return match[1].trim();
  return raw.trim();
}

function applyId3Frame(
  frameId: string,
  data: Uint8Array,
  result: Partial<ExtractedAudioMetadata>
): void {
  if (data.length === 0) return;
  const encoding = data[0];

  if (frameId === 'TIT2' || frameId === 'TT2') {
    result.title = sanitizeText(decodeText(data.slice(1), encoding)) || result.title;
  } else if (frameId === 'TPE1' || frameId === 'TP1') {
    result.artist = sanitizeText(decodeText(data.slice(1), encoding)) || result.artist;
  } else if (frameId === 'TALB' || frameId === 'TAL') {
    result.album = sanitizeText(decodeText(data.slice(1), encoding)) || result.album;
  } else if (frameId === 'TPE2' || frameId === 'TP2') {
    result.albumArtist = sanitizeText(decodeText(data.slice(1), encoding)) || result.albumArtist;
  } else if (frameId === 'TCON' || frameId === 'TCO') {
    const genre = cleanGenreString(sanitizeText(decodeText(data.slice(1), encoding)));
    if (genre) result.genre = genre;
  } else if (frameId === 'TYER' || frameId === 'TDRC' || frameId === 'TYE') {
    const yearStr = sanitizeText(decodeText(data.slice(1), encoding));
    const yr = parseInt(yearStr.slice(0, 4), 10);
    if (yr >= 1900 && yr <= 2100) result.year = yr;
  } else if (frameId === 'TRCK' || frameId === 'TRK') {
    const trkStr = sanitizeText(decodeText(data.slice(1), encoding));
    const trk = parseInt(trkStr.split('/')[0], 10);
    if (Number.isFinite(trk) && trk > 0) result.trackNumber = trk;
  } else if (frameId === 'USLT' || frameId === 'ULT') {
    // 1 byte encoding + 3 bytes language + null-terminated content descriptor + lyrics
    if (data.length > 4) {
      const descEnd = findNullTerminator(data, 4, encoding);
      const step = encoding === 1 || encoding === 2 ? 2 : 1;
      const lyricsBytes = data.slice(Math.min(data.length, descEnd + step));
      const text = sanitizeText(decodeText(lyricsBytes, encoding));
      if (text) result.embeddedLyrics = text;
    }
  } else if (frameId === 'APIC' && !result.artworkBlob) {
    const mimeEnd = findNullTerminator(data, 1, 0);
    const mimeRaw = new TextDecoder('iso-8859-1').decode(data.slice(1, mimeEnd)).trim() || 'image/jpeg';
    const mime = mimeRaw.includes('/') ? mimeRaw : `image/${mimeRaw.toLowerCase()}`;
    const descStart = mimeEnd + 2; // skip null + picture type byte
    if (descStart < data.length) {
      const descEnd = findNullTerminator(data, descStart, encoding);
      const step = encoding === 1 || encoding === 2 ? 2 : 1;
      const imgStart = descEnd + step;
      if (imgStart < data.length) {
        const imgBytes = data.slice(imgStart);
        if (imgBytes.length > 32) {
          result.artworkBlob = new Blob([imgBytes], { type: mime });
        }
      }
    }
  } else if (frameId === 'PIC' && !result.artworkBlob && data.length > 6) {
    const fmt = String.fromCharCode(data[1], data[2], data[3]).toUpperCase();
    const mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
    const descEnd = findNullTerminator(data, 5, encoding);
    const step = encoding === 1 || encoding === 2 ? 2 : 1;
    const imgStart = descEnd + step;
    if (imgStart < data.length) {
      result.artworkBlob = new Blob([data.slice(imgStart)], { type: mime });
    }
  }
}

function parseVorbisComments(
  buf: Uint8Array,
  offset: number,
  result: Partial<ExtractedAudioMetadata>
): void {
  if (offset + 4 > buf.length) return;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const vendorLen = view.getUint32(offset, true);
  let pos = offset + 4 + vendorLen;
  if (pos + 4 > buf.length) return;
  const count = view.getUint32(pos, true);
  pos += 4;
  const utf8 = new TextDecoder('utf-8', { fatal: false });

  for (let i = 0; i < count && pos + 4 <= buf.length; i++) {
    const len = view.getUint32(pos, true);
    pos += 4;
    if (pos + len > buf.length) break;
    const entry = utf8.decode(buf.slice(pos, pos + len));
    pos += len;
    const eq = entry.indexOf('=');
    if (eq === -1) continue;
    const key = entry.slice(0, eq).toUpperCase();
    const val = sanitizeText(entry.slice(eq + 1));
    if (!val) continue;

    if (key === 'TITLE') result.title = val;
    else if (key === 'ARTIST') result.artist = val;
    else if (key === 'ALBUM') result.album = val;
    else if (key === 'ALBUMARTIST' || key === 'ALBUM ARTIST') result.albumArtist = val;
    else if (key === 'GENRE') result.genre = val;
    else if (key === 'DATE' || key === 'YEAR') {
      const yr = parseInt(val.slice(0, 4), 10);
      if (yr >= 1900 && yr <= 2100) result.year = yr;
    } else if (key === 'TRACKNUMBER') {
      const trk = parseInt(val.split('/')[0], 10);
      if (Number.isFinite(trk) && trk > 0) result.trackNumber = trk;
    } else if (key === 'LYRICS' || key === 'UNSYNCEDLYRICS') {
      result.embeddedLyrics = val;
    }
  }
}

function parseFlac(buf: Uint8Array, result: Partial<ExtractedAudioMetadata>): void {
  if (buf.length < 8 || String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'fLaC') return;
  let pos = 4;
  while (pos + 4 <= buf.length) {
    const header = buf[pos];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLen = (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3];
    pos += 4;
    if (pos + blockLen > buf.length) break;

    if (blockType === 4) {
      parseVorbisComments(buf, pos, result);
    } else if (blockType === 6 && !result.artworkBlob) {
      const view = new DataView(buf.buffer, buf.byteOffset + pos, blockLen);
      let p = 4; // skip picture type
      const mimeLen = view.getUint32(p, false);
      p += 4;
      const mime = new TextDecoder('ascii').decode(buf.slice(pos + p, pos + p + mimeLen)) || 'image/jpeg';
      p += mimeLen;
      const descLen = view.getUint32(p, false);
      p += 4 + descLen + 16; // skip width, height, depth, colors
      if (p + 4 <= blockLen) {
        const dataLen = view.getUint32(p, false);
        p += 4;
        if (p + dataLen <= blockLen) {
          result.artworkBlob = new Blob([buf.slice(pos + p, pos + p + dataLen)], { type: mime });
        }
      }
    }

    pos += blockLen;
    if (isLast) break;
  }
}

function parseMp4Atoms(
  buf: Uint8Array,
  start: number,
  end: number,
  result: Partial<ExtractedAudioMetadata>
): void {
  let pos = start;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const utf8 = new TextDecoder('utf-8', { fatal: false });

  while (pos + 8 <= end) {
    let size = view.getUint32(pos, false);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    if (size === 0) size = end - pos;
    if (size < 8 || pos + size > end) break;

    const payloadStart = pos + 8;
    const payloadEnd = pos + size;

    if (['moov', 'udta', 'ilst'].includes(type)) {
      parseMp4Atoms(buf, payloadStart, payloadEnd, result);
    } else if (type === 'meta' && payloadStart + 4 <= payloadEnd) {
      parseMp4Atoms(buf, payloadStart + 4, payloadEnd, result);
    } else {
      // Check for inner 'data' atom inside ilst item
      let subPos = payloadStart;
      while (subPos + 16 <= payloadEnd) {
        const subSize = view.getUint32(subPos, false);
        const subType = String.fromCharCode(
          buf[subPos + 4],
          buf[subPos + 5],
          buf[subPos + 6],
          buf[subPos + 7]
        );
        if (subSize < 16 || subPos + subSize > payloadEnd) break;
        if (subType === 'data') {
          const dataFlags = view.getUint32(subPos + 8, false) & 0xffffff;
          const valBytes = buf.slice(subPos + 16, subPos + subSize);
          if (type === '\xa9nam') result.title = sanitizeText(utf8.decode(valBytes)) || result.title;
          else if (type === '\xa9ART') result.artist = sanitizeText(utf8.decode(valBytes)) || result.artist;
          else if (type === '\xa9alb') result.album = sanitizeText(utf8.decode(valBytes)) || result.album;
          else if (type === 'aART') result.albumArtist = sanitizeText(utf8.decode(valBytes)) || result.albumArtist;
          else if (type === '\xa9gen') result.genre = sanitizeText(utf8.decode(valBytes)) || result.genre;
          else if (type === '\xa9day') {
            const yr = parseInt(utf8.decode(valBytes).slice(0, 4), 10);
            if (yr >= 1900 && yr <= 2100) result.year = yr;
          } else if (type === 'trkn' && valBytes.length >= 4) {
            const trk = (valBytes[2] << 8) | valBytes[3];
            if (trk > 0) result.trackNumber = trk;
          } else if (type === '\xa9lyr') {
            const lyr = sanitizeText(utf8.decode(valBytes));
            if (lyr) result.embeddedLyrics = lyr;
          } else if (type === 'covr' && !result.artworkBlob) {
            const mime = dataFlags === 14 ? 'image/png' : 'image/jpeg';
            if (valBytes.length > 32) {
              result.artworkBlob = new Blob([valBytes], { type: mime });
            }
          }
        }
        subPos += subSize;
      }
    }
    pos += size;
  }
}

function parseFilenameFallback(fileName: string): { title: string; artist: string } {
  const parsed = parseAudioFilename(fileName);
  return {
    artist: sanitizeText(parsed.artist, 'Unknown Artist'),
    title: sanitizeText(parsed.title, 'Untitled Track'),
  };
}

async function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const cleanup = (dur: number) => {
      if (settled) return;
      settled = true;
      audio.src = '';
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };
    const timer = window.setTimeout(() => cleanup(0), 3500);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      cleanup(audio.duration);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup(0);
    };
    audio.src = url;
  });
}

export async function extractAudioMetadata(file: File): Promise<ExtractedAudioMetadata> {
  const parsed: Partial<ExtractedAudioMetadata> = {};
  const fallback = parseFilenameFallback(file.name);
  const format = getAudioFormatLabel(file.name, file.type);

  try {
    // Read up to first 4 MB for tags & embedded artwork
    const slice = file.slice(0, Math.min(file.size, 4 * 1024 * 1024));
    const buffer = new Uint8Array(await slice.arrayBuffer());

    if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      parseId3v2(buffer, parsed);
    } else if (
      buffer.length >= 8 &&
      String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]) === 'fLaC'
    ) {
      parseFlac(buffer, parsed);
    } else if (
      buffer.length >= 12 &&
      String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7]) === 'ftyp'
    ) {
      parseMp4Atoms(buffer, 0, buffer.length, parsed);
      // If moov is near the end of MP4 (faststart disabled), scan tail if title missing
      if (!parsed.title && file.size > 4 * 1024 * 1024) {
        const tailStart = Math.max(0, file.size - 4 * 1024 * 1024);
        const tailBuf = new Uint8Array(await file.slice(tailStart, file.size).arrayBuffer());
        parseMp4Atoms(tailBuf, 0, tailBuf.length, parsed);
      }
    } else if (
      buffer.length >= 12 &&
      String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]) === 'RIFF' &&
      String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]) === 'WAVE'
    ) {
      // Check tail or head for an 'id3 ' chunk inside WAV
      const wavTailStart = Math.max(0, file.size - 2 * 1024 * 1024);
      const wavTail =
        wavTailStart === 0
          ? buffer
          : new Uint8Array(await file.slice(wavTailStart, file.size).arrayBuffer());
      for (let idx = 0; idx + 18 <= wavTail.length; idx++) {
        if (
          (wavTail[idx] === 0x69 || wavTail[idx] === 0x49) &&
          (wavTail[idx + 1] === 0x64 || wavTail[idx + 1] === 0x44) &&
          wavTail[idx + 2] === 0x33 &&
          wavTail[idx + 3] === 0x20 &&
          wavTail[idx + 8] === 0x49 &&
          wavTail[idx + 9] === 0x44 &&
          wavTail[idx + 10] === 0x33
        ) {
          parseId3v2(wavTail.slice(idx + 8), parsed);
          break;
        }
      }
    }
  } catch {
    // Graceful fallback if binary header is malformed
  }

  const duration = await probeAudioDuration(file);
  const rawParsedTitle = parsed.title?.trim();
  const rawParsedArtist = parsed.artist?.trim();
  const rawArtistMissing = isPlaceholderArtist(rawParsedArtist);
  const embeddedTitleNoisy = hasFilenameNoise(rawParsedTitle);

  let title = rawParsedTitle && !embeddedTitleNoisy ? rawParsedTitle : '';
  let artist = rawArtistMissing ? '' : cleanArtistName(rawParsedArtist || '');

  if (embeddedTitleNoisy && rawParsedTitle) {
    const reparsed = parseAudioFilename(rawParsedTitle);
    title = reparsed.title;
    if (!artist && reparsed.hasExplicitArtist) {
      artist = reparsed.artist;
    }
  } else if (!artist && rawParsedTitle && /\s+[-–—]\s+/.test(rawParsedTitle)) {
    const reparsed = parseAudioFilename(rawParsedTitle);
    if (reparsed.hasExplicitArtist) {
      title = reparsed.title;
      artist = reparsed.artist;
    }
  }

  if (!title) {
    title = fallback.title;
  } else {
    title = sanitizeText(cleanMediaTagNoise(title) || title, fallback.title);
  }
  if (!artist) {
    artist = fallback.artist;
  } else {
    artist = sanitizeText(artist, fallback.artist);
  }

  const album = isPlaceholderAlbum(parsed.album) ? 'Single' : sanitizeText(parsed.album, 'Single');
  const albumArtist = isPlaceholderArtist(parsed.albumArtist)
    ? artist
    : sanitizeText(parsed.albumArtist, artist);

  return {
    title,
    artist,
    album,
    albumArtist,
    genre: parsed.genre || 'Unclassified',
    year: parsed.year,
    trackNumber: parsed.trackNumber,
    duration,
    format,
    artworkBlob: parsed.artworkBlob,
    embeddedLyrics: parsed.embeddedLyrics,
  };
}
