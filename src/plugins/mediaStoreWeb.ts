import { WebPlugin } from '@capacitor/core';
import type {
  ClearMediaCacheResult,
  MediaStorePermissionResult,
  MediaStorePlugin,
  ResolvePlayableFileResult,
  ScanAudioTracksResult,
} from './mediaStore';

export class MediaStoreWeb extends WebPlugin implements MediaStorePlugin {
  async checkAudioPermission(): Promise<MediaStorePermissionResult> {
    return { granted: false, state: 'denied' };
  }

  async requestAudioPermission(): Promise<MediaStorePermissionResult> {
    return { granted: false, state: 'denied' };
  }

  async scanAudioTracks(): Promise<ScanAudioTracksResult> {
    throw this.unavailable('Android MediaStore is only available inside the native Android app.');
  }

  async pickAudioFiles(): Promise<ScanAudioTracksResult> {
    throw this.unavailable('Writable audio file access is only available inside the native Android app.');
  }

  async writeTrackTags(): Promise<void> {
    throw this.unavailable('Writing embedded audio tags is only available inside the native Android app.');
  }

  async resolvePlayableFile(): Promise<ResolvePlayableFileResult> {
    throw this.unavailable('Android MediaStore is only available inside the native Android app.');
  }

  async clearMediaCache(): Promise<ClearMediaCacheResult> {
    return { clearedBytes: 0 };
  }
}
