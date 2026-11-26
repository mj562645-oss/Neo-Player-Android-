import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Track } from '../types/music';

export interface MediaStorePermissionResult {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | string;
}

export interface MediaStoreTrackItem {
  id: string;
  contentUri: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  duration: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  format: string;
  addedAt: number;
  filePath?: string;
  artworkBase64?: string;
  artworkMimeType?: string;
}

export interface ScanAudioTracksOptions {
  minDurationMs?: number;
  includeArtwork?: boolean;
}

export interface ScanAudioTracksResult {
  tracks: MediaStoreTrackItem[];
  totalCount: number;
}

export interface ResolvePlayableFileOptions {
  id: string;
  contentUri: string;
  fileName: string;
}

export interface ResolvePlayableFileResult {
  filePath: string;
  cached: boolean;
}

export interface ClearMediaCacheResult {
  clearedBytes: number;
}

export interface MediaStorePlugin {
  checkAudioPermission(): Promise<MediaStorePermissionResult>;
  requestAudioPermission(): Promise<MediaStorePermissionResult>;
  scanAudioTracks(options?: ScanAudioTracksOptions): Promise<ScanAudioTracksResult>;
  pickAudioFiles(): Promise<ScanAudioTracksResult>;
  writeTrackTags(options: {
    contentUri: string;
    source: 'mediastore' | 'document';
    tags: {
      title: string;
      artist: string;
      album: string;
      albumArtist: string;
      genre: string;
      year?: number;
      trackNumber?: number;
      mood?: string;
    };
    artworkBase64?: string;
    artworkMimeType?: string;
    removeArtwork?: boolean;
  }): Promise<void>;
  resolvePlayableFile(options: ResolvePlayableFileOptions): Promise<ResolvePlayableFileResult>;
  clearMediaCache(): Promise<ClearMediaCacheResult>;
}

export const MediaStore = registerPlugin<MediaStorePlugin>('MediaStore', {
  web: () => import('./mediaStoreWeb').then((m) => new m.MediaStoreWeb()),
});

export type EditableTrackTags = {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  mood?: string;
};

export interface EmbeddedArtworkChange {
  file?: File;
  remove?: boolean;
}

const MAX_EMBEDDED_ARTWORK_BYTES = 10 * 1024 * 1024;

async function encodeArtwork(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_EMBEDDED_ARTWORK_BYTES) {
    throw new Error('Choose an album cover smaller than 10 MB.');
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('The selected album cover is not a supported image.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Unable to read the album cover.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to encode the album cover.'));
        return;
      }
      const base64 = reader.result.split(',', 2)[1];
      if (!base64) {
        reject(new Error('Unable to encode the album cover.'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export function isNativeMediaStoreAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function writeTrackTags(
  track: Track,
  tags: EditableTrackTags,
  artwork?: EmbeddedArtworkChange
): Promise<void> {
  if (!isNativeMediaStoreAvailable()) {
    throw new Error('Writing embedded audio tags requires the Android app.');
  }
  if (
    (track.source !== 'mediastore' && track.source !== 'document') ||
    !track.contentUri
  ) {
    throw new Error('Re-import this track with the Android file picker to edit its embedded tags.');
  }
  if (artwork?.file && artwork.remove) {
    throw new Error('An album cover cannot be added and removed in the same edit.');
  }
  const artworkBase64 = artwork?.file ? await encodeArtwork(artwork.file) : undefined;
  await MediaStore.writeTrackTags({
    contentUri: track.contentUri,
    source: track.source,
    tags,
    artworkBase64,
    artworkMimeType: artwork?.file?.type || 'image/jpeg',
    removeArtwork: artwork?.remove,
  });
}

export async function resolveMediaStorePlayableUrl(track: Track): Promise<string | null> {
  if (!isNativeMediaStoreAvailable() || !track.contentUri) {
    return null;
  }
  const result = await MediaStore.resolvePlayableFile({
    id: track.mediaStoreId || track.id,
    contentUri: track.contentUri,
    fileName: track.fileName,
  });
  if (!result?.filePath) return null;
  return Capacitor.convertFileSrc(result.filePath);
}
