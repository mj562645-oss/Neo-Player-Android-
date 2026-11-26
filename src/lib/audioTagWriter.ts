import type { EditableTrackTags, EmbeddedArtworkChange } from '../plugins/mediaStore';

export const WEB_WRITABLE_TAG_FORMATS = new Set(['MP3', 'FLAC', 'M4A', 'MP4', 'WAV']);

export function isWebWritableTagFormat(formatOrFileName: string): boolean {
  const upper = formatOrFileName.trim().toUpperCase();
  if (WEB_WRITABLE_TAG_FORMATS.has(upper)) return true;
  const ext = formatOrFileName.split('.').pop()?.trim().toUpperCase() || '';
  return WEB_WRITABLE_TAG_FORMATS.has(ext);
}

function encodeSynchsafe(value: number): [number, number, number, number] {
  return [
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ];
}

function parseSynchsafe(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function concatUint8(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function encodeUtf16LeWithBom(text: string): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return out;
}

function encodeAscii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0x7f;
  }
  return out;
}

function buildId3v23TextFrame(frameId: string, value: string): Uint8Array {
  const textBytes = encodeUtf16LeWithBom(value);
  const payload = new Uint8Array(1 + textBytes.length);
  payload[0] = 0x01; // UTF-16 with BOM
  payload.set(textBytes, 1);

  const header = new Uint8Array(10);
  for (let i = 0; i < 4; i++) header[i] = frameId.charCodeAt(i);
  const view = new DataView(header.buffer);
  view.setUint32(4, payload.length, false);
  return concatUint8([header, payload]);
}

function buildId3v23ApicFrame(imageBytes: Uint8Array, mimeType: string): Uint8Array {
  const safeMime = (mimeType && mimeType.includes('/') ? mimeType : 'image/jpeg').toLowerCase();
  const mimeBytes = encodeAscii(safeMime);
  const payload = concatUint8([
    new Uint8Array([0x00]), // ISO-8859-1 description
    mimeBytes,
    new Uint8Array([0x00]), // null after MIME
    new Uint8Array([0x03]), // Cover (front)
    new Uint8Array([0x00]), // empty description null terminator
    imageBytes,
  ]);
  const header = new Uint8Array(10);
  header[0] = 0x41; // A
  header[1] = 0x50; // P
  header[2] = 0x49; // I
  header[3] = 0x43; // C
  const view = new DataView(header.buffer);
  view.setUint32(4, payload.length, false);
  return concatUint8([header, payload]);
}

function removeUnsync(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]);
    if (bytes[i] === 0xff && i + 1 < bytes.length && bytes[i + 1] === 0x00) {
      i++;
    }
  }
  return new Uint8Array(out);
}

interface ExistingId3Info {
  audioOffset: number;
  preservedFrames: Uint8Array[];
  existingApic?: Uint8Array;
}

const REPLACED_ID3_FRAME_IDS = new Set([
  'TIT2',
  'TT2',
  'TPE1',
  'TP1',
  'TALB',
  'TAL',
  'TPE2',
  'TP2',
  'TCON',
  'TCO',
  'TYER',
  'TDRC',
  'TYE',
  'TRCK',
  'TRK',
  'TMOO',
]);

function inspectExistingId3(buf: Uint8Array): ExistingId3Info {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) {
    return { audioOffset: 0, preservedFrames: [] };
  }
  const version = buf[3];
  const flags = buf[5];
  const tagSize = parseSynchsafe(buf[6], buf[7], buf[8], buf[9]);
  const hasFooter = version === 4 && (flags & 0x10) !== 0;
  const end = Math.min(buf.length, 10 + tagSize);
  const audioOffset = Math.min(buf.length, end + (hasFooter ? 10 : 0));

  const preservedFrames: Uint8Array[] = [];
  let existingApic: Uint8Array | undefined;

  let pos = 10;
  if (flags & 0x40 && pos + 4 <= end) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const extSize =
      version === 4
        ? parseSynchsafe(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3])
        : view.getUint32(pos, false) + 4;
    pos += Math.max(0, extSize);
  }

  const globalUnsync = (flags & 0x80) !== 0;

  if (version === 3 || version === 4) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    while (pos + 10 <= end) {
      const frameId = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
      if (frameId === '\0\0\0\0') break;
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

      const rawSize =
        version === 4
          ? parseSynchsafe(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7])
          : view.getUint32(pos + 4, false);
      const frameFlags = buf[pos + 9];
      pos += 10;
      if (rawSize <= 0 || pos + rawSize > end) break;
      let framePayload: Uint8Array = buf.slice(pos, pos + rawSize);
      pos += rawSize;

      if (globalUnsync || (version === 4 && (frameFlags & 0x02) !== 0)) {
        framePayload = removeUnsync(framePayload);
      }

      if (frameId === 'APIC') {
        if (!existingApic) {
          const header = new Uint8Array(10);
          header[0] = 0x41;
          header[1] = 0x50;
          header[2] = 0x49;
          header[3] = 0x43;
          new DataView(header.buffer).setUint32(4, framePayload.length, false);
          existingApic = concatUint8([header, framePayload]);
        }
        continue;
      }

      if (REPLACED_ID3_FRAME_IDS.has(frameId)) continue;

      // Preserve USLT, TXXX, COMM, PRIV, POPM, etc. normalized into v2.3 frame header
      const header = new Uint8Array(10);
      for (let i = 0; i < 4; i++) header[i] = frameId.charCodeAt(i);
      new DataView(header.buffer).setUint32(4, framePayload.length, false);
      preservedFrames.push(concatUint8([header, framePayload]));
    }
  }

  return { audioOffset, preservedFrames, existingApic };
}

function buildId3v23TagBytes(
  tags: EditableTrackTags,
  artworkData: { bytes: Uint8Array; mimeType: string } | null | 'keep',
  existingInfo: ExistingId3Info
): Uint8Array<ArrayBuffer> {
  const frames: Uint8Array[] = [];
  if (tags.title?.trim()) frames.push(buildId3v23TextFrame('TIT2', tags.title.trim()));
  if (tags.artist?.trim()) frames.push(buildId3v23TextFrame('TPE1', tags.artist.trim()));
  if (tags.album?.trim()) frames.push(buildId3v23TextFrame('TALB', tags.album.trim()));
  if (tags.albumArtist?.trim()) frames.push(buildId3v23TextFrame('TPE2', tags.albumArtist.trim()));
  if (tags.genre?.trim() && tags.genre.trim().toLowerCase() !== 'unclassified') {
    frames.push(buildId3v23TextFrame('TCON', tags.genre.trim()));
  }
  if (tags.year && tags.year >= 1900 && tags.year <= 2100) {
    frames.push(buildId3v23TextFrame('TYER', String(tags.year)));
  }
  if (tags.trackNumber && tags.trackNumber > 0) {
    frames.push(buildId3v23TextFrame('TRCK', String(tags.trackNumber)));
  }
  if (tags.mood?.trim()) {
    frames.push(buildId3v23TextFrame('TMOO', tags.mood.trim()));
  }

  for (const frame of existingInfo.preservedFrames) {
    frames.push(frame);
  }

  if (artworkData && artworkData !== 'keep') {
    frames.push(buildId3v23ApicFrame(artworkData.bytes, artworkData.mimeType));
  } else if (artworkData === 'keep' && existingInfo.existingApic) {
    frames.push(existingInfo.existingApic);
  }

  // Add 256 bytes padding for future small edits
  frames.push(new Uint8Array(256));

  const body = concatUint8(frames);
  const header = new Uint8Array(10);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = 0x03; // v2.3
  header[4] = 0x00;
  header[5] = 0x00;
  const [s0, s1, s2, s3] = encodeSynchsafe(body.length);
  header[6] = s0;
  header[7] = s1;
  header[8] = s2;
  header[9] = s3;

  return concatUint8([header, body]);
}

function writeMp3Tags(
  raw: Uint8Array,
  tags: EditableTrackTags,
  artworkData: { bytes: Uint8Array; mimeType: string } | null | 'keep'
): Uint8Array<ArrayBuffer> {
  const existing = inspectExistingId3(raw);
  const id3Block = buildId3v23TagBytes(tags, artworkData, existing);

  // Strip trailing ID3v1 tag if present so legacy 30-char truncated fields don't override ID3v2
  let audioEnd = raw.length;
  if (
    raw.length - existing.audioOffset >= 128 &&
    raw[raw.length - 128] === 0x54 && // T
    raw[raw.length - 127] === 0x41 && // A
    raw[raw.length - 126] === 0x47 // G
  ) {
    audioEnd = raw.length - 128;
  }

  const audioFrames = raw.slice(existing.audioOffset, audioEnd);
  return concatUint8([id3Block, audioFrames]);
}

function parseImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  try {
    if (
      mimeType === 'image/png' &&
      bytes.length >= 24 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let pos = 2;
      while (pos + 9 < bytes.length) {
        if (bytes[pos] !== 0xff) break;
        const marker = bytes[pos + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = (bytes[pos + 5] << 8) | bytes[pos + 6];
          const width = (bytes[pos + 7] << 8) | bytes[pos + 8];
          return { width, height };
        }
        const len = (bytes[pos + 2] << 8) | bytes[pos + 3];
        if (len < 2) break;
        pos += 2 + len;
      }
    }
  } catch {
    // fallback
  }
  return { width: 512, height: 512 };
}

const REPLACED_VORBIS_KEYS = new Set([
  'TITLE',
  'ARTIST',
  'ALBUM',
  'ALBUMARTIST',
  'ALBUM ARTIST',
  'GENRE',
  'DATE',
  'YEAR',
  'TRACKNUMBER',
  'MOOD',
]);

function buildVorbisCommentPayload(
  tags: EditableTrackTags,
  existingBlock?: Uint8Array
): Uint8Array {
  const utf8Enc = new TextEncoder();
  const utf8Dec = new TextDecoder('utf-8', { fatal: false });
  let vendor = 'Neo Player';
  const preservedComments: string[] = [];

  if (existingBlock && existingBlock.length >= 8) {
    const view = new DataView(existingBlock.buffer, existingBlock.byteOffset, existingBlock.byteLength);
    const vendorLen = view.getUint32(0, true);
    if (4 + vendorLen + 4 <= existingBlock.length) {
      vendor = utf8Dec.decode(existingBlock.slice(4, 4 + vendorLen)) || vendor;
      let pos = 4 + vendorLen;
      const count = view.getUint32(pos, true);
      pos += 4;
      for (let i = 0; i < count && pos + 4 <= existingBlock.length; i++) {
        const len = view.getUint32(pos, true);
        pos += 4;
        if (pos + len > existingBlock.length) break;
        const entry = utf8Dec.decode(existingBlock.slice(pos, pos + len));
        pos += len;
        const eq = entry.indexOf('=');
        if (eq > 0 && !REPLACED_VORBIS_KEYS.has(entry.slice(0, eq).toUpperCase())) {
          preservedComments.push(entry);
        }
      }
    }
  }

  const entries: string[] = [];
  if (tags.title?.trim()) entries.push(`TITLE=${tags.title.trim()}`);
  if (tags.artist?.trim()) entries.push(`ARTIST=${tags.artist.trim()}`);
  if (tags.album?.trim()) entries.push(`ALBUM=${tags.album.trim()}`);
  if (tags.albumArtist?.trim()) entries.push(`ALBUMARTIST=${tags.albumArtist.trim()}`);
  if (tags.genre?.trim() && tags.genre.trim().toLowerCase() !== 'unclassified') {
    entries.push(`GENRE=${tags.genre.trim()}`);
  }
  if (tags.year && tags.year >= 1900 && tags.year <= 2100) {
    entries.push(`DATE=${tags.year}`);
  }
  if (tags.trackNumber && tags.trackNumber > 0) {
    entries.push(`TRACKNUMBER=${tags.trackNumber}`);
  }
  if (tags.mood?.trim()) {
    entries.push(`MOOD=${tags.mood.trim()}`);
  }
  entries.push(...preservedComments);

  const vendorBytes = utf8Enc.encode(vendor);
  const entryChunks = entries.map((e) => utf8Enc.encode(e));
  let total = 4 + vendorBytes.length + 4;
  for (const ec of entryChunks) total += 4 + ec.length;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let pos = 0;
  view.setUint32(pos, vendorBytes.length, true);
  pos += 4;
  out.set(vendorBytes, pos);
  pos += vendorBytes.length;
  view.setUint32(pos, entryChunks.length, true);
  pos += 4;
  for (const ec of entryChunks) {
    view.setUint32(pos, ec.length, true);
    pos += 4;
    out.set(ec, pos);
    pos += ec.length;
  }
  return out;
}

function buildFlacPicturePayload(bytes: Uint8Array, mimeType: string): Uint8Array {
  const safeMime = mimeType && mimeType.includes('/') ? mimeType : 'image/jpeg';
  const mimeBytes = encodeAscii(safeMime);
  const { width, height } = parseImageDimensions(bytes, safeMime);

  const out = new Uint8Array(32 + mimeBytes.length + bytes.length);
  const view = new DataView(out.buffer);
  let pos = 0;
  view.setUint32(pos, 3, false); // Picture type: front cover
  pos += 4;
  view.setUint32(pos, mimeBytes.length, false);
  pos += 4;
  out.set(mimeBytes, pos);
  pos += mimeBytes.length;
  view.setUint32(pos, 0, false); // Description length = 0
  pos += 4;
  view.setUint32(pos, width, false);
  pos += 4;
  view.setUint32(pos, height, false);
  pos += 4;
  view.setUint32(pos, 24, false); // Color depth
  pos += 4;
  view.setUint32(pos, 0, false); // Indexed colors
  pos += 4;
  view.setUint32(pos, bytes.length, false);
  pos += 4;
  out.set(bytes, pos);
  return out;
}

function buildFlacMetadataBlock(type: number, payload: Uint8Array, isLast: boolean): Uint8Array {
  const header = new Uint8Array(4);
  header[0] = (isLast ? 0x80 : 0x00) | (type & 0x7f);
  header[1] = (payload.length >>> 16) & 0xff;
  header[2] = (payload.length >>> 8) & 0xff;
  header[3] = payload.length & 0xff;
  return concatUint8([header, payload]);
}

function writeFlacTags(
  raw: Uint8Array,
  tags: EditableTrackTags,
  artworkData: { bytes: Uint8Array; mimeType: string } | null | 'keep'
): Uint8Array<ArrayBuffer> {
  if (raw.length < 8 || String.fromCharCode(raw[0], raw[1], raw[2], raw[3]) !== 'fLaC') {
    throw new Error('Invalid FLAC file header.');
  }

  let pos = 4;
  let streamInfoPayload: Uint8Array | null = null;
  let existingVorbisPayload: Uint8Array | undefined;
  let existingPicturePayload: Uint8Array | undefined;
  const otherBlocks: { type: number; payload: Uint8Array }[] = [];

  while (pos + 4 <= raw.length) {
    const header = raw[pos];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLen = (raw[pos + 1] << 16) | (raw[pos + 2] << 8) | raw[pos + 3];
    pos += 4;
    if (pos + blockLen > raw.length) break;
    const payload = raw.slice(pos, pos + blockLen);
    pos += blockLen;

    if (blockType === 0 && !streamInfoPayload) {
      streamInfoPayload = payload;
    } else if (blockType === 4 && !existingVorbisPayload) {
      existingVorbisPayload = payload;
    } else if (blockType === 6 && !existingPicturePayload) {
      existingPicturePayload = payload;
    } else if (blockType !== 1 && blockType !== 4 && blockType !== 6) {
      otherBlocks.push({ type: blockType, payload });
    }

    if (isLast) break;
  }

  if (!streamInfoPayload) {
    throw new Error('Missing FLAC STREAMINFO metadata block.');
  }

  const audioFrames = raw.slice(pos);
  const blocks: { type: number; payload: Uint8Array }[] = [
    { type: 0, payload: streamInfoPayload },
    ...otherBlocks,
    { type: 4, payload: buildVorbisCommentPayload(tags, existingVorbisPayload) },
  ];

  if (artworkData && artworkData !== 'keep') {
    blocks.push({
      type: 6,
      payload: buildFlacPicturePayload(artworkData.bytes, artworkData.mimeType),
    });
  } else if (artworkData === 'keep' && existingPicturePayload) {
    blocks.push({ type: 6, payload: existingPicturePayload });
  }

  // Add 1024 bytes padding block at end
  blocks.push({ type: 1, payload: new Uint8Array(1024) });

  const serializedBlocks = blocks.map((blk, i) =>
    buildFlacMetadataBlock(blk.type, blk.payload, i === blocks.length - 1)
  );

  return concatUint8([encodeAscii('fLaC'), ...serializedBlocks, audioFrames]);
}

// --- M4A / MP4 atom writer ---

interface Mp4Box {
  type: string;
  start: number;
  end: number;
  headerSize: number;
}

function readMp4Box(buf: Uint8Array, pos: number, limit: number): Mp4Box | null {
  if (pos + 8 > limit) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let size = view.getUint32(pos, false);
  const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
  let headerSize = 8;
  if (size === 1) {
    if (pos + 16 > limit) return null;
    const hi = view.getUint32(pos + 8, false);
    const lo = view.getUint32(pos + 12, false);
    size = hi * 0x100000000 + lo;
    headerSize = 16;
  } else if (size === 0) {
    size = limit - pos;
  }
  if (size < headerSize || pos + size > limit) return null;
  return { type, start: pos, end: pos + size, headerSize };
}

function wrapMp4Box(type: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(8 + payload.length));
  const view = new DataView(out.buffer);
  view.setUint32(0, out.length, false);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i) & 0xff;
  out.set(payload, 8);
  return out;
}

function buildIlstTextAtom(atomType: string, text: string): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  const dataPayload = new Uint8Array(8 + utf8.length);
  const view = new DataView(dataPayload.buffer);
  view.setUint32(0, 1, false); // UTF-8 text flag
  dataPayload.set(utf8, 8);
  return wrapMp4Box(atomType, wrapMp4Box('data', dataPayload));
}

function buildIlstTrknAtom(trackNumber: number): Uint8Array {
  const dataPayload = new Uint8Array(16);
  const view = new DataView(dataPayload.buffer);
  view.setUint32(0, 0, false); // implicit integer
  view.setUint16(10, trackNumber, false);
  return wrapMp4Box('trkn', wrapMp4Box('data', dataPayload));
}

function buildIlstCovrAtom(bytes: Uint8Array, mimeType: string): Uint8Array {
  const isPng = mimeType.toLowerCase().includes('png');
  const dataPayload = new Uint8Array(8 + bytes.length);
  const view = new DataView(dataPayload.buffer);
  view.setUint32(0, isPng ? 14 : 13, false); // 14 = PNG, 13 = JPEG
  dataPayload.set(bytes, 8);
  return wrapMp4Box('covr', wrapMp4Box('data', dataPayload));
}

const REPLACED_ILST_ATOMS = new Set([
  '\xa9nam',
  '\xa9ART',
  '\xa9alb',
  'aART',
  '\xa9gen',
  'gnre',
  '\xa9day',
  'trkn',
  'covr',
]);

function extractChildrenBoxes(buf: Uint8Array, start: number, end: number): { type: string; raw: Uint8Array }[] {
  const children: { type: string; raw: Uint8Array }[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    const box = readMp4Box(buf, pos, end);
    if (!box) break;
    children.push({ type: box.type, raw: buf.slice(box.start, box.end) });
    pos = box.end;
  }
  return children;
}

function buildDefaultHdlrBox(): Uint8Array {
  const payload = new Uint8Array(25);
  // version/flags (4) + pre_defined (4) + handler_type 'mdir' (4) + 'appl' (4) + reserved (8) + name (1)
  payload[8] = 0x6d; // m
  payload[9] = 0x64; // d
  payload[10] = 0x69; // i
  payload[11] = 0x72; // r
  payload[12] = 0x61; // a
  payload[13] = 0x70; // p
  payload[14] = 0x70; // p
  payload[15] = 0x6c; // l
  return wrapMp4Box('hdlr', payload);
}

function shiftMoovChunkOffsetsInPlace(moovBytes: Uint8Array, start: number, end: number, delta: number): void {
  if (delta === 0) return;
  let pos = start;
  const view = new DataView(moovBytes.buffer, moovBytes.byteOffset, moovBytes.byteLength);
  while (pos + 8 <= end) {
    const box = readMp4Box(moovBytes, pos, end);
    if (!box) break;
    const payloadStart = box.start + box.headerSize;
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(box.type)) {
      shiftMoovChunkOffsetsInPlace(moovBytes, payloadStart, box.end, delta);
    } else if (box.type === 'stco' && payloadStart + 8 <= box.end) {
      const count = view.getUint32(payloadStart + 4, false);
      for (let i = 0; i < count && payloadStart + 8 + i * 4 + 4 <= box.end; i++) {
        const off = payloadStart + 8 + i * 4;
        const cur = view.getUint32(off, false);
        view.setUint32(off, Math.max(0, cur + delta), false);
      }
    } else if (box.type === 'co64' && payloadStart + 8 <= box.end) {
      const count = view.getUint32(payloadStart + 4, false);
      for (let i = 0; i < count && payloadStart + 8 + i * 8 + 8 <= box.end; i++) {
        const off = payloadStart + 8 + i * 8;
        const hi = view.getUint32(off, false);
        const lo = view.getUint32(off + 4, false);
        const nextVal = Math.max(0, hi * 0x100000000 + lo + delta);
        view.setUint32(off, Math.floor(nextVal / 0x100000000), false);
        view.setUint32(off + 4, nextVal >>> 0, false);
      }
    }
    pos = box.end;
  }
}

function writeMp4Tags(
  raw: Uint8Array,
  tags: EditableTrackTags,
  artworkData: { bytes: Uint8Array; mimeType: string } | null | 'keep'
): Uint8Array<ArrayBuffer> {
  const topBoxes = extractChildrenBoxes(raw, 0, raw.length);
  const moovIdx = topBoxes.findIndex((b) => b.type === 'moov');
  const mdatIdx = topBoxes.findIndex((b) => b.type === 'mdat');
  if (moovIdx === -1) {
    throw new Error('Invalid M4A/MP4 container (missing moov atom).');
  }

  const moovRaw = topBoxes[moovIdx].raw;
  const moovBox = readMp4Box(moovRaw, 0, moovRaw.length)!;
  const moovChildren = extractChildrenBoxes(moovRaw, moovBox.headerSize, moovRaw.length);

  const udtaIdx = moovChildren.findIndex((b) => b.type === 'udta');
  const udtaChildren =
    udtaIdx >= 0
      ? extractChildrenBoxes(udtaChildrenRaw(moovChildren[udtaIdx].raw), 8, moovChildren[udtaIdx].raw.length)
      : [];

  function udtaChildrenRaw(b: Uint8Array): Uint8Array {
    return b;
  }

  const metaIdx = udtaChildren.findIndex((b) => b.type === 'meta');
  const metaChildren =
    metaIdx >= 0 && udtaChildren[metaIdx].raw.length >= 12
      ? extractChildrenBoxes(udtaChildren[metaIdx].raw, 12, udtaChildren[metaIdx].raw.length)
      : [ { type: 'hdlr', raw: buildDefaultHdlrBox() } ];

  const ilstIdx = metaChildren.findIndex((b) => b.type === 'ilst');
  const existingIlstItems =
    ilstIdx >= 0
      ? extractChildrenBoxes(metaChildren[ilstIdx].raw, 8, metaChildren[ilstIdx].raw.length)
      : [];

  const nextIlstItems: Uint8Array[] = [];
  if (tags.title?.trim()) nextIlstItems.push(buildIlstTextAtom('\xa9nam', tags.title.trim()));
  if (tags.artist?.trim()) nextIlstItems.push(buildIlstTextAtom('\xa9ART', tags.artist.trim()));
  if (tags.album?.trim()) nextIlstItems.push(buildIlstTextAtom('\xa9alb', tags.album.trim()));
  if (tags.albumArtist?.trim()) nextIlstItems.push(buildIlstTextAtom('aART', tags.albumArtist.trim()));
  if (tags.genre?.trim() && tags.genre.trim().toLowerCase() !== 'unclassified') {
    nextIlstItems.push(buildIlstTextAtom('\xa9gen', tags.genre.trim()));
  }
  if (tags.year && tags.year >= 1900 && tags.year <= 2100) {
    nextIlstItems.push(buildIlstTextAtom('\xa9day', String(tags.year)));
  }
  if (tags.trackNumber && tags.trackNumber > 0) {
    nextIlstItems.push(buildIlstTrknAtom(tags.trackNumber));
  }

  if (artworkData && artworkData !== 'keep') {
    nextIlstItems.push(buildIlstCovrAtom(artworkData.bytes, artworkData.mimeType));
  } else if (artworkData === 'keep') {
    const existingCovr = existingIlstItems.find((b) => b.type === 'covr');
    if (existingCovr) nextIlstItems.push(existingCovr.raw);
  }

  for (const item of existingIlstItems) {
    if (!REPLACED_ILST_ATOMS.has(item.type)) {
      nextIlstItems.push(item.raw);
    }
  }

  const newIlstBox = wrapMp4Box('ilst', concatUint8(nextIlstItems));
  const nextMetaChildren = metaChildren
    .filter((b) => b.type !== 'ilst')
    .map((b) => b.raw);
  if (!metaChildren.some((b) => b.type === 'hdlr')) {
    nextMetaChildren.unshift(buildDefaultHdlrBox());
  }
  nextMetaChildren.push(newIlstBox);
  const newMetaBox = wrapMp4Box('meta', concatUint8([new Uint8Array(4), ...nextMetaChildren]));

  const nextUdtaChildren = udtaChildren.filter((b) => b.type !== 'meta').map((b) => b.raw);
  nextUdtaChildren.push(newMetaBox);
  const newUdtaBox = wrapMp4Box('udta', concatUint8(nextUdtaChildren));

  const nextMoovChildren = moovChildren.filter((b) => b.type !== 'udta').map((b) => b.raw);
  nextMoovChildren.push(newUdtaBox);
  const newMoovBox = wrapMp4Box('moov', concatUint8(nextMoovChildren));

  // If moov appears before mdat, shift chunk offsets (stco/co64) by size delta!
  if (mdatIdx !== -1 && moovIdx < mdatIdx) {
    const delta = newMoovBox.length - moovRaw.length;
    if (delta !== 0) {
      shiftMoovChunkOffsetsInPlace(newMoovBox, 8, newMoovBox.length, delta);
    }
  }

  const finalBoxes = topBoxes.map((b, i) => (i === moovIdx ? newMoovBox : b.raw));
  return concatUint8(finalBoxes);
}

// --- WAV (RIFF/WAVE + trailing id3 chunk) writer ---

function writeWavTags(
  raw: Uint8Array,
  tags: EditableTrackTags,
  artworkData: { bytes: Uint8Array; mimeType: string } | null | 'keep'
): Uint8Array<ArrayBuffer> {
  if (
    raw.length < 12 ||
    String.fromCharCode(raw[0], raw[1], raw[2], raw[3]) !== 'RIFF' ||
    String.fromCharCode(raw[8], raw[9], raw[10], raw[11]) !== 'WAVE'
  ) {
    throw new Error('Invalid WAV/RIFF header.');
  }

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let pos = 12;
  const keptChunks: Uint8Array[] = [];
  let existingId3Bytes: Uint8Array | null = null;

  while (pos + 8 <= raw.length) {
    const chunkId = String.fromCharCode(raw[pos], raw[pos + 1], raw[pos + 2], raw[pos + 3]);
    const chunkSize = view.getUint32(pos + 4, true);
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = Math.min(raw.length, pos + 8 + paddedSize);
    if (chunkId.toLowerCase() === 'id3 ') {
      existingId3Bytes = raw.slice(pos + 8, Math.min(raw.length, pos + 8 + chunkSize));
    } else {
      keptChunks.push(raw.slice(pos, chunkEnd));
    }
    pos = chunkEnd;
  }

  const existingInfo = existingId3Bytes
    ? inspectExistingId3(existingId3Bytes)
    : { audioOffset: 0, preservedFrames: [] };
  const id3Payload = buildId3v23TagBytes(tags, artworkData, existingInfo);

  const id3ChunkHeader = new Uint8Array(8);
  id3ChunkHeader[0] = 0x69; // i
  id3ChunkHeader[1] = 0x64; // d
  id3ChunkHeader[2] = 0x33; // 3
  id3ChunkHeader[3] = 0x20; // ' '
  new DataView(id3ChunkHeader.buffer).setUint32(4, id3Payload.length, true);
  const padByte = id3Payload.length % 2 === 1 ? new Uint8Array(1) : new Uint8Array(0);

  const body = concatUint8([...keptChunks, id3ChunkHeader, id3Payload, padByte]);
  const riffHeader = new Uint8Array(12);
  riffHeader.set(encodeAscii('RIFF'), 0);
  new DataView(riffHeader.buffer).setUint32(4, 4 + body.length, true);
  riffHeader.set(encodeAscii('WAVE'), 8);
  return concatUint8([riffHeader, body]);
}

export async function writeAudioTagsToBlob(
  file: Blob,
  fileName: string,
  format: string,
  tags: EditableTrackTags,
  artworkChange?: EmbeddedArtworkChange
): Promise<Blob> {
  if (artworkChange?.file && artworkChange.remove) {
    throw new Error('An album cover cannot be added and removed in the same edit.');
  }

  const normalizedFmt = (format || fileName.split('.').pop() || '').toUpperCase();
  if (!WEB_WRITABLE_TAG_FORMATS.has(normalizedFmt)) {
    throw new Error(
      `Direct browser tag editing supports MP3, FLAC, M4A/MP4, and WAV (got ${normalizedFmt || 'unknown'}).`
    );
  }

  let artworkData: { bytes: Uint8Array; mimeType: string } | null | 'keep' = 'keep';
  if (artworkChange?.remove) {
    artworkData = null;
  } else if (artworkChange?.file) {
    if (artworkChange.file.size === 0 || artworkChange.file.size > 10 * 1024 * 1024) {
      throw new Error('Choose an album cover smaller than 10 MB.');
    }
    const bytes = new Uint8Array(await artworkChange.file.arrayBuffer());
    artworkData = {
      bytes,
      mimeType: artworkChange.file.type || 'image/jpeg',
    };
  }

  const raw = new Uint8Array(await file.arrayBuffer());
  let outBytes: Uint8Array<ArrayBuffer>;

  if (normalizedFmt === 'MP3') {
    outBytes = writeMp3Tags(raw, tags, artworkData);
  } else if (normalizedFmt === 'FLAC') {
    outBytes = writeFlacTags(raw, tags, artworkData);
  } else if (normalizedFmt === 'M4A' || normalizedFmt === 'MP4') {
    outBytes = writeMp4Tags(raw, tags, artworkData);
  } else {
    outBytes = writeWavTags(raw, tags, artworkData);
  }

  return new Blob([outBytes], { type: file.type || 'application/octet-stream' });
}
