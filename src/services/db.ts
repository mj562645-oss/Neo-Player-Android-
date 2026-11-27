import { DEFAULT_EQUALIZER_SETTINGS } from '../lib/equalizer';
import { DEFAULT_PERSONALIZATION, normalizeUiThemeId } from '../lib/palettes';
import type {
  LyricsDocument,
  MoodCategory,
  PlaybackState,
  Playlist,
  Track,
  UserSettings,
} from '../types/music';

const DB_NAME = 'neo-player-db';
const DB_VERSION = 2;

export const DEFAULT_MOOD_CATEGORIES: MoodCategory[] = [
  { id: 'mood_late_night', name: 'Late Night', description: 'After-hours acoustics and low-lit grooves', accentColor: '#5E5CE6', isDefault: true },
  { id: 'mood_romance', name: 'Romance', description: 'Warm vocals and intimate melodies', accentColor: '#FF2D55', isDefault: true },
  { id: 'mood_focus', name: 'Focus', description: 'Steady rhythms for deep concentration', accentColor: '#0A84FF', isDefault: true },
  { id: 'mood_chill', name: 'Chill', description: 'Unwind with unhurried tempos', accentColor: '#30D158', isDefault: true },
  { id: 'mood_energy', name: 'Energy', description: 'High-tempo tracks to move to', accentColor: '#FF9F0A', isDefault: true },
  { id: 'mood_melancholy', name: 'Melancholy', description: 'Reflective tones and quiet depth', accentColor: '#64D2FF', isDefault: true },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'user_settings',
  theme: 'system',
  volume: 0.85,
  muted: false,
  playbackRate: 1,
  volumeNormalization: false,
  equalizer: DEFAULT_EQUALIZER_SETTINGS,
  resumeOnLaunch: true,
  seekStepSeconds: 15,
  reducedMotion: false,
  gaplessPlayback: true,
  crossfadeSeconds: 0,
  showRemainingTime: true,
  defaultLibraryLayout: 'list',
  librarySortField: 'addedAt',
  librarySortDirection: 'desc',
  moodCategories: DEFAULT_MOOD_CATEGORIES,
  hasSeenIntro: false,
  hapticFeedback: true,
  keepScreenAwake: false,
  autoEnrichOnImport: true,
  followedArtists: [],
  discoveryCountry: 'us',
  discoveryNotificationsEnabled: true,
  notifyTrending: true,
  notifyFavoriteArtists: true,
  osNotificationsEnabled: false,
  androidLivePillNotification: true,
  audioOutputDeviceId: '',
  pauseOnBluetoothDisconnect: true,
  bluetoothMetadataSync: true,
  personalization: DEFAULT_PERSONALIZATION,
};

export const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  id: 'playback_state',
  currentTrackId: null,
  queue: [],
  originalQueueOrder: [],
  currentIndex: -1,
  position: 0,
  shuffle: false,
  repeat: 'off',
  updatedAt: Date.now(),
};

export interface StoredAudioRecord {
  id: string;
  blob: Blob;
  size: number;
  mimeType: string;
}

export interface StoredArtworkRecord {
  id: string;
  blob: Blob;
  size: number;
  mimeType: string;
}

export interface StoredFileHandleRecord {
  id: string;
  handle: FileSystemFileHandle;
}

export class StorageQuotaError extends Error {
  constructor(message = 'Device storage quota exceeded. Free up space or remove unused tracks.') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

function wrapRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      const err = req.error;
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        reject(new StorageQuotaError());
      } else {
        reject(err || new Error('IndexedDB request failed'));
      }
    };
  });
}

function wrapTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      const err = tx.error;
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        reject(new StorageQuotaError());
      } else {
        reject(err || new Error('IndexedDB transaction failed'));
      }
    };
    tx.onabort = () => {
      const err = tx.error;
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        reject(new StorageQuotaError());
      } else {
        reject(err || new Error('IndexedDB transaction aborted'));
      }
    };
  });
}

class NeoDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private artworkUrlCache = new Map<string, string>();

  async open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tracks')) {
          const store = db.createObjectStore('tracks', { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt', { unique: false });
          store.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
          store.createIndex('album', 'album', { unique: false });
          store.createIndex('artist', 'artist', { unique: false });
        }
        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('artworks')) {
          db.createObjectStore('artworks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('lyrics')) {
          db.createObjectStore('lyrics', { keyPath: 'trackId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playback')) {
          db.createObjectStore('playback', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fileHandles')) {
          db.createObjectStore('fileHandles', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
    return this.dbPromise;
  }

  async getAllTracks(): Promise<Track[]> {
    const db = await this.open();
    const tx = db.transaction('tracks', 'readonly');
    return wrapRequest(tx.objectStore('tracks').getAll());
  }

  async getTrack(id: string): Promise<Track | undefined> {
    const db = await this.open();
    const tx = db.transaction('tracks', 'readonly');
    return wrapRequest(tx.objectStore('tracks').get(id));
  }

  async putTrack(track: Track): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').put(track);
    await wrapTx(tx);
  }

  async putTrackWithMedia(
    track: Track,
    audioBlob: Blob,
    artworkRecord?: StoredArtworkRecord,
    lyricsDoc?: LyricsDocument
  ): Promise<void> {
    const db = await this.open();
    const stores = ['tracks', 'audioFiles', 'artworks', 'lyrics'];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('tracks').put(track);
    tx.objectStore('audioFiles').put({
      id: track.id,
      blob: audioBlob,
      size: audioBlob.size,
      mimeType: audioBlob.type || track.mimeType,
    } satisfies StoredAudioRecord);
    if (artworkRecord) {
      tx.objectStore('artworks').put(artworkRecord);
    }
    if (lyricsDoc) {
      tx.objectStore('lyrics').put(lyricsDoc);
    }
    await wrapTx(tx);
  }

  async putTrackWithHandle(
    track: Track,
    handle: FileSystemFileHandle,
    artworkRecord?: StoredArtworkRecord,
    lyricsDoc?: LyricsDocument
  ): Promise<void> {
    const db = await this.open();
    const stores = ['tracks', 'fileHandles', 'audioFiles', 'artworks', 'lyrics'];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('tracks').put(track);
    tx.objectStore('fileHandles').put({
      id: track.id,
      handle,
    } satisfies StoredFileHandleRecord);
    tx.objectStore('audioFiles').delete(track.id);
    if (artworkRecord) {
      tx.objectStore('artworks').put(artworkRecord);
    }
    if (lyricsDoc) {
      tx.objectStore('lyrics').put(lyricsDoc);
    }
    await wrapTx(tx);
  }

  async putFileHandle(trackId: string, handle: FileSystemFileHandle): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['fileHandles', 'audioFiles'], 'readwrite');
    tx.objectStore('fileHandles').put({
      id: trackId,
      handle,
    } satisfies StoredFileHandleRecord);
    // Remove legacy audio copy so app doesn't hold duplicate file bytes
    tx.objectStore('audioFiles').delete(trackId);
    await wrapTx(tx);
  }

  async getFileHandle(trackId: string): Promise<FileSystemFileHandle | null> {
    const db = await this.open();
    const tx = db.transaction('fileHandles', 'readonly');
    const rec = await wrapRequest<StoredFileHandleRecord | undefined>(
      tx.objectStore('fileHandles').get(trackId)
    );
    return rec ? rec.handle : null;
  }

  async deleteTracks(trackIds: string[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['tracks', 'audioFiles', 'fileHandles', 'lyrics'], 'readwrite');
    for (const id of trackIds) {
      tx.objectStore('tracks').delete(id);
      tx.objectStore('audioFiles').delete(id);
      tx.objectStore('fileHandles').delete(id);
      tx.objectStore('lyrics').delete(id);
    }
    await wrapTx(tx);
  }

  async getAudioBlob(trackId: string): Promise<Blob | null> {
    const db = await this.open();
    const tx = db.transaction('audioFiles', 'readonly');
    const rec = await wrapRequest<StoredAudioRecord | undefined>(
      tx.objectStore('audioFiles').get(trackId)
    );
    return rec ? rec.blob : null;
  }

  async getAllAudioRecordsMeta(): Promise<{ id: string; size: number }[]> {
    const db = await this.open();
    const tx = db.transaction('audioFiles', 'readonly');
    const all = await wrapRequest<StoredAudioRecord[]>(tx.objectStore('audioFiles').getAll());
    return all.map((r) => ({ id: r.id, size: r.size || r.blob.size }));
  }

  async putArtwork(record: StoredArtworkRecord): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('artworks', 'readwrite');
    tx.objectStore('artworks').put(record);
    await wrapTx(tx);
  }

  async getArtworkBlob(artworkId: string): Promise<Blob | null> {
    const db = await this.open();
    const tx = db.transaction('artworks', 'readonly');
    const rec = await wrapRequest<StoredArtworkRecord | undefined>(
      tx.objectStore('artworks').get(artworkId)
    );
    return rec ? rec.blob : null;
  }

  async getArtworkUrl(artworkId?: string): Promise<string | null> {
    if (!artworkId) return null;
    const cached = this.artworkUrlCache.get(artworkId);
    if (cached) return cached;
    const blob = await this.getArtworkBlob(artworkId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.artworkUrlCache.set(artworkId, url);
    return url;
  }

  revokeArtworkUrl(artworkId: string): void {
    const existing = this.artworkUrlCache.get(artworkId);
    if (existing) {
      URL.revokeObjectURL(existing);
      this.artworkUrlCache.delete(artworkId);
    }
  }

  async deleteArtworks(artworkIds: string[]): Promise<void> {
    if (artworkIds.length === 0) return;
    const db = await this.open();
    const tx = db.transaction('artworks', 'readwrite');
    for (const id of artworkIds) {
      this.revokeArtworkUrl(id);
      tx.objectStore('artworks').delete(id);
    }
    await wrapTx(tx);
  }

  async getAllArtworksMeta(): Promise<{ id: string; size: number }[]> {
    const db = await this.open();
    const tx = db.transaction('artworks', 'readonly');
    const all = await wrapRequest<StoredArtworkRecord[]>(tx.objectStore('artworks').getAll());
    return all.map((r) => ({ id: r.id, size: r.size || r.blob.size }));
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.open();
    const tx = db.transaction('playlists', 'readonly');
    return wrapRequest(tx.objectStore('playlists').getAll());
  }

  async putPlaylist(playlist: Playlist): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('playlists', 'readwrite');
    tx.objectStore('playlists').put(playlist);
    await wrapTx(tx);
  }

  async deletePlaylist(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('playlists', 'readwrite');
    tx.objectStore('playlists').delete(id);
    await wrapTx(tx);
  }

  async getLyrics(trackId: string): Promise<LyricsDocument | undefined> {
    const db = await this.open();
    const tx = db.transaction('lyrics', 'readonly');
    return wrapRequest(tx.objectStore('lyrics').get(trackId));
  }

  async getAllLyrics(): Promise<LyricsDocument[]> {
    const db = await this.open();
    const tx = db.transaction('lyrics', 'readonly');
    return wrapRequest(tx.objectStore('lyrics').getAll());
  }

  async putLyrics(doc: LyricsDocument): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('lyrics', 'readwrite');
    tx.objectStore('lyrics').put(doc);
    await wrapTx(tx);
  }

  async deleteLyrics(trackId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('lyrics', 'readwrite');
    tx.objectStore('lyrics').delete(trackId);
    await wrapTx(tx);
  }

  async getSettings(): Promise<UserSettings> {
    const db = await this.open();
    const tx = db.transaction('settings', 'readonly');
    const stored = await wrapRequest<UserSettings | undefined>(
      tx.objectStore('settings').get('user_settings')
    );
    if (!stored) return DEFAULT_USER_SETTINGS;
    const rawUiTheme = stored.personalization?.uiTheme as string | undefined;
    const normalizedUiTheme = normalizeUiThemeId(rawUiTheme);
    const storedPaletteId = stored.personalization?.activePaletteId;
    const migratedPaletteId =
      rawUiTheme === 'ios' || (storedPaletteId && storedPaletteId.startsWith('ios_'))
        ? DEFAULT_PERSONALIZATION.activePaletteId
        : storedPaletteId === 'win_fluent_blue'
          ? 'editorial_lapis'
          : storedPaletteId === 'win_seafoam'
            ? 'editorial_champagne'
            : storedPaletteId === 'win_coral'
              ? 'editorial_vermilion'
              : storedPaletteId === 'win_orchid'
                ? 'editorial_rose'
                : storedPaletteId === 'win_forest'
                  ? 'editorial_pine'
                  : storedPaletteId === 'win_graphite'
                    ? 'editorial_monolith'
                    : storedPaletteId || DEFAULT_PERSONALIZATION.activePaletteId;

    return {
      ...DEFAULT_USER_SETTINGS,
      ...stored,
      autoEnrichOnImport: stored.autoEnrichPreferenceSaved
        ? stored.autoEnrichOnImport
        : true,
      moodCategories:
        stored.moodCategories && stored.moodCategories.length > 0
          ? stored.moodCategories
          : DEFAULT_MOOD_CATEGORIES,
      personalization: {
        ...DEFAULT_PERSONALIZATION,
        ...(stored.personalization || {}),
        uiTheme: normalizedUiTheme,
        activePaletteId: migratedPaletteId,
      },
      equalizer: {
        ...DEFAULT_EQUALIZER_SETTINGS,
        ...(stored.equalizer || {}),
      },
    };
  }

  async putSettings(settings: UserSettings): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(settings);
    await wrapTx(tx);
  }

  async getPlaybackState(): Promise<PlaybackState> {
    const db = await this.open();
    const tx = db.transaction('playback', 'readonly');
    const stored = await wrapRequest<PlaybackState | undefined>(
      tx.objectStore('playback').get('playback_state')
    );
    return stored ? { ...DEFAULT_PLAYBACK_STATE, ...stored } : DEFAULT_PLAYBACK_STATE;
  }

  async putPlaybackState(state: PlaybackState): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('playback', 'readwrite');
    tx.objectStore('playback').put(state);
    await wrapTx(tx);
  }

  async clearLibraryData(): Promise<void> {
    for (const url of this.artworkUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.artworkUrlCache.clear();
    const db = await this.open();
    const tx = db.transaction(
      ['tracks', 'audioFiles', 'fileHandles', 'artworks', 'playlists', 'lyrics', 'playback'],
      'readwrite'
    );
    tx.objectStore('tracks').clear();
    tx.objectStore('audioFiles').clear();
    tx.objectStore('fileHandles').clear();
    tx.objectStore('artworks').clear();
    tx.objectStore('playlists').clear();
    tx.objectStore('lyrics').clear();
    tx.objectStore('playback').put({ ...DEFAULT_PLAYBACK_STATE, updatedAt: Date.now() });
    await wrapTx(tx);
  }
}

export const db = new NeoDatabase();
