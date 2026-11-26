export type ThemePreference = 'light' | 'dark' | 'system';

export type RepeatMode = 'off' | 'all' | 'one';

export type AppSection =
  | 'home'
  | 'library'
  | 'playlists'
  | 'youtube'
  | 'discover'
  | 'search'
  | 'lyrics'
  | 'settings';

export type LibrarySubTab =
  | 'songs'
  | 'albums'
  | 'artists'
  | 'playlists'
  | 'favourites'
  | 'recent';

export type LibrarySortField =
  | 'title'
  | 'artist'
  | 'album'
  | 'addedAt'
  | 'duration'
  | 'playCount';

export type SortDirection = 'asc' | 'desc';

export type ViewLayout = 'list' | 'grid';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  duration: number; // seconds
  fileName: string;
  mimeType: string;
  fileSize: number; // bytes
  format: string; // e.g., MP3, FLAC, M4A, WAV, OGG, AAC, YouTube
  artworkId?: string;
  artworkUrl?: string;
  isFavourite: boolean;
  addedAt: number; // epoch ms
  lastPlayedAt?: number;
  playCount: number;
  lastPosition?: number;
  moodTags?: string[];
  source?: 'indexeddb' | 'mediastore' | 'document' | 'youtube';
  mediaStoreId?: string;
  contentUri?: string;
  /** App-private file URI used by Android Media3 for persistent local playback. */
  nativeAudioUri?: string;
  youtubeVideoId?: string;
}

export interface Album {
  id: string; // normalized key `${album}::${albumArtist}`
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  artworkId?: string;
  trackIds: string[];
  totalDuration: number;
}

export interface Artist {
  id: string; // normalized name
  name: string;
  artworkId?: string;
  albumCount: number;
  trackIds: string[];
  totalDuration: number;
}

export interface MoodCategory {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  isDefault?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  moodCategoryId?: string;
  smartKey?: string;
  artworkId?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface QueueItem {
  queueId: string;
  trackId: string;
  addedAt: number;
  source?: string;
}

export interface SyncedLyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsDocument {
  trackId: string;
  type: 'plain' | 'synced';
  plainText: string;
  syncedLines: SyncedLyricLine[];
  rawLrc?: string;
  source?: 'embedded' | 'manual' | 'imported';
  updatedAt: number;
}

export type UiThemeId = 'neo' | 'ios' | 'material' | 'windows';

export interface AppPalette {
  id: string;
  name: string;
  accent: string;
  secondary: string;
  themeId?: UiThemeId;
  isBuiltIn?: boolean;
}

export type BackgroundStyleMode = 'ambient' | 'artwork' | 'gradient' | 'image';
export type GlassStylePreset = 'frosted' | 'clear' | 'tinted' | 'solid';
export type FontStylePreset = 'geometric' | 'editorial' | 'technical';
export type CornerRadiusPreset = 'sharp' | 'balanced' | 'pillowy';
export type ArtworkDisplayStyle = 'cover' | 'vinyl';

export interface PersonalizationSettings {
  uiTheme: UiThemeId;
  activePaletteId: string;
  customPalettes: AppPalette[];
  backgroundMode: BackgroundStyleMode;
  backgroundGradientId: string;
  customGradientFrom: string;
  customGradientTo: string;
  customGradientAngle: number;
  backgroundImageId?: string;
  backgroundBlur: number; // 0..40 px
  backgroundDim: number; // 10..85 %
  glassStyle: GlassStylePreset;
  glassBlur: number; // 12..42 px
  cornerStyle: CornerRadiusPreset;
  fontStyle: FontStylePreset;
  artworkStyle: ArtworkDisplayStyle;
}

export interface EqualizerSettings {
  enabled: boolean;
  presetId: string;
  bass: number;
  mid: number;
  treble: number;
}

export interface UserSettings {
  id: 'user_settings';
  theme: ThemePreference;
  volume: number; // 0..1
  muted: boolean;
  playbackRate: number; // 0.75..1.5
  volumeNormalization: boolean;
  equalizer: EqualizerSettings;
  resumeOnLaunch: boolean;
  seekStepSeconds: 10 | 15 | 30;
  reducedMotion: boolean;
  gaplessPlayback: boolean;
  crossfadeSeconds: number;
  showRemainingTime: boolean;
  defaultLibraryLayout: ViewLayout;
  librarySortField: LibrarySortField;
  librarySortDirection: SortDirection;
  moodCategories: MoodCategory[];
  hasSeenIntro: boolean;
  hapticFeedback: boolean;
  keepScreenAwake: boolean;
  autoEnrichOnImport: boolean;
  autoEnrichPreferenceSaved?: boolean;
  followedArtists: string[];
  discoveryCountry: string;
  discoveryNotificationsEnabled: boolean;
  notifyTrending: boolean;
  notifyFavoriteArtists: boolean;
  osNotificationsEnabled: boolean;
  personalization: PersonalizationSettings;
}

export interface PlaybackState {
  id: 'playback_state';
  currentTrackId: string | null;
  queue: QueueItem[];
  originalQueueOrder: QueueItem[];
  currentIndex: number;
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
  updatedAt: number;
}

export interface StorageBreakdown {
  audioBytes: number;
  artworkBytes: number;
  metadataBytes: number;
  totalUsedBytes: number;
  browserUsageBytes?: number;
  browserQuotaBytes?: number;
  trackCount: number;
  playlistCount: number;
}

export type SmartPlaylistKind =
  | 'heavy-rotation'
  | 'favourites-mix'
  | 'hidden-gems'
  | 'fresh-additions'
  | 'artist-spotlight'
  | 'genre-mix';

export interface SmartPlaylistDraft {
  smartKey: string;
  kind: SmartPlaylistKind;
  name: string;
  description: string;
  reason: string;
  moodCategoryId?: string;
  trackIds: string[];
  accentColor: string;
}

export interface DiscoveryTrackItem {
  id: string;
  rank?: number;
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  previewUrl?: string;
  releaseDate?: string;
  genre?: string;
  externalUrl?: string;
  durationSec?: number;
}

export interface ArtistLatestRelease {
  id: string;
  title: string;
  releaseDate: string;
  artworkUrl?: string;
  genre?: string;
  externalUrl?: string;
}

export interface ArtistRadarResult {
  artistName: string;
  artworkUrl?: string;
  latestRelease?: ArtistLatestRelease;
  topTracks: DiscoveryTrackItem[];
}

export interface DiscoveryNotification {
  id: string;
  type: 'trending' | 'artist-release';
  title: string;
  message: string;
  artist?: string;
  artworkUrl?: string;
  previewTrack?: DiscoveryTrackItem;
  createdAt: number;
  read: boolean;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  subscriberCount?: string;
  customUrl?: string;
}

export interface YouTubePlaylistSummary {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  itemCount: number;
  channelTitle?: string;
  privacyStatus?: string;
  publishedAt?: string;
  isSpecial?: boolean;
}

export interface YouTubeSubscriptionItem {
  id: string;
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
}

