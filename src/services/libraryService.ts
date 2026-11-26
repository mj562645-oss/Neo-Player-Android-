import { extractAudioMetadata } from '../lib/audioMetadata';
import { sanitizeText } from '../lib/format';
import { parseLrc } from '../lib/lrcParser';
import { createId } from '../lib/utils';
import type { MediaStoreTrackItem } from '../plugins/mediaStore';
import type {
  Album,
  Artist,
  LyricsDocument,
  Playlist,
  StorageBreakdown,
  Track,
} from '../types/music';
import { db, StorageQuotaError, type StoredArtworkRecord } from './db';
import NativeAudio, { isNativeAudioAvailable } from '../plugins/nativeAudio';

const SUPPORTED_EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac', 'opus', 'webm']);

interface WebFilePickerWindow {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

type IterableDirectoryHandle = Omit<FileSystemDirectoryHandle, 'values'> & {
  values(): AsyncIterable<FileSystemHandle>;
};

export interface PickHandlesResult {
  handles: FileSystemFileHandle[];
  cancelled?: boolean;
  iframeBlocked?: boolean;
}

export function isWebFileSystemAccessSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as WebFilePickerWindow;
  return typeof w.showOpenFilePicker === 'function';
}

export function isInCrossOriginIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isSupportedAudioName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS.has(ext);
}

export interface ImportResult {
  importedTracks: Track[];
  skippedFiles: { name: string; reason: string }[];
  quotaError?: string;
}

/**
 * Architectural seam for future online metadata / artwork enrichment or Capacitor native filesystem bridges.
 * Never returns fabricated data when unconfigured.
 */
export interface MetadataLookupAdapter {
  readonly isConfigured: boolean;
  lookupTrackMetadata(query: { title: string; artist: string; album?: string }): Promise<null>;
}

export const localOnlyMetadataAdapter: MetadataLookupAdapter = {
  isConfigured: false,
  async lookupTrackMetadata() {
    return null;
  },
};

export function isSupportedAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return isSupportedAudioName(file.name);
}

export async function pickOriginalAudioFilesWeb(multiple = true): Promise<PickHandlesResult> {
  if (!isWebFileSystemAccessSupported()) {
    return { handles: [] };
  }
  const w = window as unknown as WebFilePickerWindow;
  try {
    const handles = await w.showOpenFilePicker!({
      multiple,
      types: [
        {
          description: 'Audio Files',
          accept: {
            'audio/*': ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus', '.webm'],
          },
        },
      ],
    });
    return { handles };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'AbortError') return { handles: [], cancelled: true };
      if (err.name === 'SecurityError') return { handles: [], iframeBlocked: true };
    }
    throw err;
  }
}

export async function pickOriginalDirectoryFilesWeb(): Promise<PickHandlesResult> {
  if (typeof window === 'undefined') return { handles: [] };
  const w = window as unknown as WebFilePickerWindow;
  if (typeof w.showDirectoryPicker !== 'function') return { handles: [] };

  let dir: FileSystemDirectoryHandle;
  try {
    try {
      dir = await w.showDirectoryPicker({ mode: 'readwrite' });
    } catch (innerErr) {
      if (innerErr instanceof DOMException && innerErr.name === 'AbortError') {
        return { handles: [], cancelled: true };
      }
      if (innerErr instanceof DOMException && innerErr.name === 'SecurityError') {
        return { handles: [], iframeBlocked: true };
      }
      dir = await w.showDirectoryPicker();
    }
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'AbortError') return { handles: [], cancelled: true };
      if (err.name === 'SecurityError') return { handles: [], iframeBlocked: true };
    }
    throw err;
  }

  const collected: FileSystemFileHandle[] = [];
  const walk = async (directory: FileSystemDirectoryHandle) => {
    const iterable = directory as unknown as IterableDirectoryHandle;
    for await (const entry of iterable.values()) {
      if (entry.kind === 'file') {
        if (isSupportedAudioName(entry.name)) {
          collected.push(entry as FileSystemFileHandle);
        }
      } else if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle);
      }
    }
  };
  await walk(dir);
  return { handles: collected };
}

export async function importFileHandles(
  handles: FileSystemFileHandle[],
  existingTracks: Track[],
  onProgress?: (done: number, total: number, currentFileName: string) => void
): Promise<ImportResult> {
  const importedTracks: Track[] = [];
  const skippedFiles: { name: string; reason: string }[] = [];
  const existingSignatures = new Set(
    existingTracks.map((t) => `${t.fileName.toLowerCase()}::${t.fileSize}`)
  );

  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i];
    onProgress?.(i, handles.length, handle.name);

    try {
      const file = await handle.getFile();
      if (!isSupportedAudioFile(file)) {
        skippedFiles.push({ name: file.name, reason: 'Unsupported file format' });
        continue;
      }

      const sig = `${file.name.toLowerCase()}::${file.size}`;
      if (existingSignatures.has(sig)) {
        skippedFiles.push({ name: file.name, reason: 'Already in library' });
        continue;
      }

      const meta = await extractAudioMetadata(file);
      const trackId = createId('trk');
      let artworkId: string | undefined;
      let artworkRecord: StoredArtworkRecord | undefined;

      if (meta.artworkBlob && meta.artworkBlob.size > 0) {
        artworkId = createId('art');
        artworkRecord = {
          id: artworkId,
          blob: meta.artworkBlob,
          size: meta.artworkBlob.size,
          mimeType: meta.artworkBlob.type || 'image/jpeg',
        };
      }

      let lyricsDoc: LyricsDocument | undefined;
      if (meta.embeddedLyrics) {
        const parsed = parseLrc(meta.embeddedLyrics);
        lyricsDoc = {
          trackId,
          type: parsed.isSynced ? 'synced' : 'plain',
          plainText: parsed.plainText,
          syncedLines: parsed.syncedLines,
          rawLrc: parsed.isSynced ? meta.embeddedLyrics : undefined,
          source: 'embedded',
          updatedAt: Date.now(),
        };
      }

      const track: Track = {
        id: trackId,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        albumArtist: meta.albumArtist,
        genre: meta.genre,
        year: meta.year,
        trackNumber: meta.trackNumber,
        duration: meta.duration,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        fileSize: file.size,
        format: meta.format,
        artworkId,
        isFavourite: false,
        addedAt: Date.now() + i,
        playCount: 0,
        source: 'filehandle',
      };

      await db.putTrackWithHandle(track, handle, artworkRecord, lyricsDoc);
      existingSignatures.add(sig);
      importedTracks.push(track);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        return {
          importedTracks,
          skippedFiles,
          quotaError: err.message,
        };
      }
      skippedFiles.push({
        name: handle.name,
        reason: err instanceof Error ? err.message : 'Failed to link audio file',
      });
    }
  }

  onProgress?.(handles.length, handles.length, '');
  return { importedTracks, skippedFiles };
}

export async function importAudioFiles(
  files: File[],
  existingTracks: Track[],
  onProgress?: (done: number, total: number, currentFileName: string) => void
): Promise<ImportResult> {
  const importedTracks: Track[] = [];
  const skippedFiles: { name: string; reason: string }[] = [];
  const existingSignatures = new Set(
    existingTracks.map((t) => `${t.fileName.toLowerCase()}::${t.fileSize}`)
  );

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);

    if (!isSupportedAudioFile(file)) {
      skippedFiles.push({ name: file.name, reason: 'Unsupported file format' });
      continue;
    }

    const sig = `${file.name.toLowerCase()}::${file.size}`;
    if (existingSignatures.has(sig)) {
      skippedFiles.push({ name: file.name, reason: 'Already in library' });
      continue;
    }

    try {
      const meta = await extractAudioMetadata(file);
      const trackId = createId('trk');
      let artworkId: string | undefined;
      let artworkRecord: StoredArtworkRecord | undefined;

      if (meta.artworkBlob && meta.artworkBlob.size > 0) {
        artworkId = createId('art');
        artworkRecord = {
          id: artworkId,
          blob: meta.artworkBlob,
          size: meta.artworkBlob.size,
          mimeType: meta.artworkBlob.type || 'image/jpeg',
        };
      }

      let lyricsDoc: LyricsDocument | undefined;
      if (meta.embeddedLyrics) {
        const parsed = parseLrc(meta.embeddedLyrics);
        lyricsDoc = {
          trackId,
          type: parsed.isSynced ? 'synced' : 'plain',
          plainText: parsed.plainText,
          syncedLines: parsed.syncedLines,
          rawLrc: parsed.isSynced ? meta.embeddedLyrics : undefined,
          source: 'embedded',
          updatedAt: Date.now(),
        };
      }

      const track: Track = {
        id: trackId,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        albumArtist: meta.albumArtist,
        genre: meta.genre,
        year: meta.year,
        trackNumber: meta.trackNumber,
        duration: meta.duration,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        fileSize: file.size,
        format: meta.format,
        artworkId,
        isFavourite: false,
        addedAt: Date.now() + i,
        playCount: 0,
      };

      // Keep IndexedDB as the canonical store; create an app-private native copy for Media3.
      // The current base64 bridge is intentionally capped to avoid large WebView memory spikes.
      if (isNativeAudioAvailable() && file.size <= 24 * 1024 * 1024) {
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Unable to read selected audio file'));
            reader.onload = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(file);
          });
          const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
          if (base64) {
            const nativeFile = await NativeAudio.saveAudio({ trackId, fileName: file.name, base64 });
            track.nativeAudioUri = nativeFile.uri;
          }
        } catch (error) {
          console.warn('[Neo Player] Native audio copy failed; Web Audio remains available.', error);
        }
      }
      await db.putTrackWithMedia(track, file, artworkRecord, lyricsDoc);
      existingSignatures.add(sig);
      importedTracks.push(track);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        return {
          importedTracks,
          skippedFiles,
          quotaError: err.message,
        };
      }
      skippedFiles.push({
        name: file.name,
        reason: err instanceof Error ? err.message : 'Failed to import file',
      });
    }
  }

  onProgress?.(files.length, files.length, '');
  return { importedTracks, skippedFiles };
}

function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function importMediaStoreTracks(
  scannedTracks: MediaStoreTrackItem[],
  existingTracks: Track[],
  onProgress?: (done: number, total: number, currentFileName: string) => void
): Promise<ImportResult> {
  const importedTracks: Track[] = [];
  const skippedFiles: { name: string; reason: string }[] = [];

  const existingMediaIds = new Set(
    existingTracks.map((t) => t.mediaStoreId).filter((id): id is string => Boolean(id))
  );
  const existingSignatures = new Set(
    existingTracks.map((t) => `${t.fileName.toLowerCase()}::${t.fileSize}`)
  );

  // Deduplicate artwork records across tracks sharing the same album in this scan
  const albumArtIdMap = new Map<string, string>();

  for (let i = 0; i < scannedTracks.length; i++) {
    const item = scannedTracks[i];
    onProgress?.(i, scannedTracks.length, item.title || item.fileName);

    const sig = `${item.fileName.toLowerCase()}::${item.fileSize}`;
    if (existingMediaIds.has(item.id) || existingSignatures.has(sig)) {
      skippedFiles.push({ name: item.fileName, reason: 'Already in library' });
      continue;
    }

    try {
      const trackId = createId('trk');
      let artworkId: string | undefined;

      if (item.artworkBase64) {
        const albumKey = `${(item.album || 'Single').toLowerCase()}::${(item.albumArtist || item.artist || 'Unknown Artist').toLowerCase()}`;
        const reusedId = albumArtIdMap.get(albumKey);
        if (reusedId) {
          artworkId = reusedId;
        } else {
          const blob = base64ToBlob(item.artworkBase64, item.artworkMimeType || 'image/jpeg');
          if (blob.size > 0) {
            artworkId = createId('art');
            await db.putArtwork({
              id: artworkId,
              blob,
              size: blob.size,
              mimeType: item.artworkMimeType || 'image/jpeg',
            });
            albumArtIdMap.set(albumKey, artworkId);
          }
        }
      }

      const track: Track = {
        id: trackId,
        title: sanitizeText(item.title, item.fileName),
        artist: sanitizeText(item.artist, 'Unknown Artist'),
        album: sanitizeText(item.album, 'Single'),
        albumArtist: sanitizeText(item.albumArtist || item.artist, 'Unknown Artist'),
        genre: sanitizeText(item.genre, 'Unclassified'),
        year: item.year,
        trackNumber: item.trackNumber,
        duration: Number.isFinite(item.duration) ? item.duration : 0,
        fileName: item.fileName,
        mimeType: item.mimeType || 'audio/mpeg',
        fileSize: item.fileSize || 0,
        format: item.format || 'MP3',
        artworkId,
        isFavourite: false,
        addedAt: item.addedAt || Date.now() + i,
        playCount: 0,
        source: 'mediastore',
        mediaStoreId: item.id,
        contentUri: item.contentUri,
      };

      await db.putTrack(track);
      existingMediaIds.add(item.id);
      existingSignatures.add(sig);
      importedTracks.push(track);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        return {
          importedTracks,
          skippedFiles,
          quotaError: err.message,
        };
      }
      skippedFiles.push({
        name: item.fileName,
        reason: err instanceof Error ? err.message : 'Failed to index device track',
      });
    }
  }

  onProgress?.(scannedTracks.length, scannedTracks.length, '');
  return { importedTracks, skippedFiles };
}

export async function importDocumentTracks(
  pickedTracks: MediaStoreTrackItem[],
  existingTracks: Track[],
  onProgress?: (done: number, total: number, currentFileName: string) => void
): Promise<ImportResult> {
  const importedTracks: Track[] = [];
  const skippedFiles: { name: string; reason: string }[] = [];
  const existingUris = new Set(
    existingTracks.map((track) => track.contentUri).filter((uri): uri is string => Boolean(uri))
  );
  const albumArtIdMap = new Map<string, string>();

  for (let i = 0; i < pickedTracks.length; i++) {
    const item = pickedTracks[i];
    onProgress?.(i, pickedTracks.length, item.fileName);
    if (existingUris.has(item.contentUri)) {
      skippedFiles.push({ name: item.fileName, reason: 'Already in library' });
      continue;
    }

    try {
      let artworkId: string | undefined;
      if (item.artworkBase64) {
        const albumKey = `${(item.album || 'Single').toLowerCase()}::${(item.albumArtist || item.artist || 'Unknown Artist').toLowerCase()}`;
        const reusedId = albumArtIdMap.get(albumKey);
        if (reusedId) {
          artworkId = reusedId;
        } else {
          const blob = base64ToBlob(item.artworkBase64, item.artworkMimeType || 'image/jpeg');
          if (blob.size > 0) {
            artworkId = createId('art');
            await db.putArtwork({
              id: artworkId,
              blob,
              size: blob.size,
              mimeType: item.artworkMimeType || 'image/jpeg',
            });
            albumArtIdMap.set(albumKey, artworkId);
          }
        }
      }

      const track: Track = {
        id: createId('trk'),
        title: sanitizeText(item.title, item.fileName),
        artist: sanitizeText(item.artist, 'Unknown Artist'),
        album: sanitizeText(item.album, 'Single'),
        albumArtist: sanitizeText(item.albumArtist || item.artist, 'Unknown Artist'),
        genre: sanitizeText(item.genre, 'Unclassified'),
        year: item.year,
        trackNumber: item.trackNumber,
        duration: Number.isFinite(item.duration) ? item.duration : 0,
        fileName: item.fileName,
        mimeType: item.mimeType || 'audio/mpeg',
        fileSize: item.fileSize || 0,
        format: item.format || 'AUDIO',
        artworkId,
        isFavourite: false,
        addedAt: Date.now() + i,
        playCount: 0,
        source: 'document',
        contentUri: item.contentUri,
      };

      await db.putTrack(track);
      existingUris.add(item.contentUri);
      importedTracks.push(track);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        return { importedTracks, skippedFiles, quotaError: err.message };
      }
      skippedFiles.push({
        name: item.fileName,
        reason: err instanceof Error ? err.message : 'Failed to import selected audio file',
      });
    }
  }

  onProgress?.(pickedTracks.length, pickedTracks.length, '');
  return { importedTracks, skippedFiles };
}

export function deriveAlbums(tracks: Track[]): Album[] {
  const map = new Map<string, Album>();
  for (const track of tracks) {
    const albumName = track.album || 'Single';
    const artistName = track.albumArtist || track.artist || 'Unknown Artist';
    const key = `${albumName.toLowerCase()}::${artistName.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.trackIds.push(track.id);
      existing.totalDuration += track.duration || 0;
      if (!existing.artworkId && track.artworkId) existing.artworkId = track.artworkId;
      if (!existing.year && track.year) existing.year = track.year;
      if (!existing.genre && track.genre && track.genre !== 'Unclassified') {
        existing.genre = track.genre;
      }
    } else {
      map.set(key, {
        id: key,
        title: albumName,
        artist: artistName,
        year: track.year,
        genre: track.genre !== 'Unclassified' ? track.genre : undefined,
        artworkId: track.artworkId,
        trackIds: [track.id],
        totalDuration: track.duration || 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export function deriveArtists(tracks: Track[]): Artist[] {
  const map = new Map<string, { artist: Artist; albums: Set<string> }>();
  for (const track of tracks) {
    const name = track.artist || 'Unknown Artist';
    const key = name.toLowerCase();
    const entry = map.get(key);
    if (entry) {
      entry.artist.trackIds.push(track.id);
      entry.artist.totalDuration += track.duration || 0;
      entry.albums.add((track.album || 'Single').toLowerCase());
      entry.artist.albumCount = entry.albums.size;
      if (!entry.artist.artworkId && track.artworkId) {
        entry.artist.artworkId = track.artworkId;
      }
    } else {
      const albums = new Set<string>([(track.album || 'Single').toLowerCase()]);
      map.set(key, {
        albums,
        artist: {
          id: key,
          name,
          artworkId: track.artworkId,
          albumCount: albums.size,
          trackIds: [track.id],
          totalDuration: track.duration || 0,
        },
      });
    }
  }
  return Array.from(map.values())
    .map((e) => e.artist)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateTrackInfo(
  track: Track,
  patch: Partial<
    Pick<
      Track,
      'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'year' | 'trackNumber' | 'moodTags'
    >
  >
): Promise<Track> {
  const updated: Track = {
    ...track,
    title: patch.title !== undefined ? sanitizeText(patch.title, track.title) : track.title,
    artist: patch.artist !== undefined ? sanitizeText(patch.artist, 'Unknown Artist') : track.artist,
    album: patch.album !== undefined ? sanitizeText(patch.album, 'Single') : track.album,
    albumArtist:
      patch.albumArtist !== undefined
        ? sanitizeText(patch.albumArtist, patch.artist || track.artist)
        : track.albumArtist,
    genre: patch.genre !== undefined ? sanitizeText(patch.genre, 'Unclassified') : track.genre,
    year: Object.prototype.hasOwnProperty.call(patch, 'year') ? patch.year : track.year,
    trackNumber: Object.prototype.hasOwnProperty.call(patch, 'trackNumber')
      ? patch.trackNumber
      : track.trackNumber,
    moodTags: patch.moodTags ?? track.moodTags,
  };
  await db.putTrack(updated);
  return updated;
}

export async function replaceTrackArtwork(
  track: Track,
  imageFile: File,
  allTracks: Track[],
  playlists: Playlist[]
): Promise<Track> {
  const newArtworkId = createId('art');
  await db.putArtwork({
    id: newArtworkId,
    blob: imageFile,
    size: imageFile.size,
    mimeType: imageFile.type || 'image/jpeg',
  });

  const oldArtworkId = track.artworkId;
  const updated: Track = { ...track, artworkId: newArtworkId };
  await db.putTrack(updated);

  if (oldArtworkId) {
    const stillUsedByTrack = allTracks.some(
      (t) => t.id !== track.id && t.artworkId === oldArtworkId
    );
    const stillUsedByPlaylist = playlists.some((p) => p.artworkId === oldArtworkId);
    if (!stillUsedByTrack && !stillUsedByPlaylist) {
      await db.deleteArtworks([oldArtworkId]);
    }
  }
  return updated;
}

export async function removeTrackArtwork(
  track: Track,
  allTracks: Track[],
  playlists: Playlist[]
): Promise<Track> {
  const oldArtworkId = track.artworkId;
  const updated: Track = { ...track, artworkId: undefined };
  await db.putTrack(updated);

  if (oldArtworkId) {
    const stillUsedByTrack = allTracks.some(
      (t) => t.id !== track.id && t.artworkId === oldArtworkId
    );
    const stillUsedByPlaylist = playlists.some((p) => p.artworkId === oldArtworkId);
    if (!stillUsedByTrack && !stillUsedByPlaylist) {
      await db.deleteArtworks([oldArtworkId]);
    }
  }
  return updated;
}

export async function calculateStorageBreakdown(
  tracks: Track[],
  playlists: Playlist[]
): Promise<StorageBreakdown> {
  const [audioMeta, artMeta] = await Promise.all([
    db.getAllAudioRecordsMeta(),
    db.getAllArtworksMeta(),
  ]);
  const audioBytes = audioMeta.reduce((sum, item) => sum + item.size, 0);
  const artworkBytes = artMeta.reduce((sum, item) => sum + item.size, 0);
  const metadataBytes = new Blob([JSON.stringify({ tracks, playlists })]).size;

  let browserUsageBytes: number | undefined;
  let browserQuotaBytes: number | undefined;
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      browserUsageBytes = est.usage;
      browserQuotaBytes = est.quota;
    } catch {
      // Ignore unsupported storage estimate
    }
  }

  return {
    audioBytes,
    artworkBytes,
    metadataBytes,
    totalUsedBytes: audioBytes + artworkBytes + metadataBytes,
    browserUsageBytes,
    browserQuotaBytes,
    trackCount: tracks.length,
    playlistCount: playlists.length,
  };
}
