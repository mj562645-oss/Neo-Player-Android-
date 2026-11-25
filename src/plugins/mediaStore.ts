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
  resolvePlayableFile(options: ResolvePlayableFileOptions): Promise<ResolvePlayableFileResult>;
  clearMediaCache(): Promise<ClearMediaCacheResult>;
}

export const MediaStore = registerPlugin<MediaStorePlugin>('MediaStore', {
  web: () => import('./mediaStoreWeb').then((m) => new m.MediaStoreWeb()),
});

export function isNativeMediaStoreAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
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
