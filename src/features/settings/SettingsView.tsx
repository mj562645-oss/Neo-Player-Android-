import React, { useEffect, useState } from 'react';
import {
  Bell,
  Download,
  HardDrive,
  Info,
  Loader2,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { useDiscovery } from '../../app/DiscoveryContext';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useYouTube } from '../../app/YouTubeContext';
import { formatBytes } from '../../lib/format';
import { CHART_COUNTRIES } from '../../lib/countries';
import { cn } from '../../lib/utils';
import { MediaStore, isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
import { getPlatformInfo } from '../../services/androidPlatform';
import type { StorageBreakdown } from '../../types/music';
import { EqualizerPanel } from '../../components/EqualizerPanel';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassModal } from '../../components/glass/GlassModal';
import { PWAInstallButton } from '../../components/PWAInstallButton';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { YouTubeErrorBanner } from '../../components/YouTubeErrorBanner';
import { Slider } from '../../components/ui/slider';
import { Switch } from '../../components/ui/switch';
import { ImportDropzone } from '../library/ImportDropzone';
import { PersonalizationStudio } from './PersonalizationStudio';

export const SettingsView: React.FC<{ onReplayIntro?: () => void }> = ({ onReplayIntro }) => {
  const platform = getPlatformInfo();
  const hasNativeMediaStore = isNativeMediaStoreAvailable();
  const {
    tracks,
    playlists,
    isScanningMediaStore,
    scanDeviceMediaStore,
    enrichProgress,
    enrichTracksBatch,
    cancelBatchEnrich,
    getStorageBreakdown,
    exportLibraryMetadata,
    clearPlayHistory,
    clearAllLibrary,
  } = useLibrary();
  const { clearQueue } = usePlayer();
  const { settings, updateSettings, toggleFollowArtist } = useTheme();
  const { requestOsNotificationPermission, refreshRadar } = useDiscovery();
  const {
    user: ytUser,
    channel: ytChannel,
    isConnected: ytConnected,
    isLoggingIn: ytLoggingIn,
    playlists: ytPlaylists,
    likedTracks: ytLikedTracks,
    signIn: ytSignIn,
    signOut: ytSignOut,
    refreshAll: ytRefreshAll,
  } = useYouTube();

  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const refreshStorage = () => {
    void getStorageBreakdown().then(setStorage);
  };

  useEffect(() => {
    refreshStorage();
  }, [tracks.length, playlists.length]);

  const handleExportMetadata = () => {
    const json = exportLibraryMetadata();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neo-player-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLibrary = async () => {
    clearQueue();
    await clearAllLibrary();
    setConfirmClearOpen(false);
    refreshStorage();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Settings</h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Appearance, playback engine, local storage, and privacy
          </p>
        </div>
        <PWAInstallButton variant="full" />
      </div>

      {/* Theme & Accessibility */}
      <GlassCard className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold font-display">Appearance</h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              Choose Light, Dark, or follow your device setting
            </p>
          </div>
          <ThemeSwitcher />
        </div>

        <div className="border-t border-black/8 dark:border-white/10 pt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reduced Motion</p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Minimize player transitions and artwork animations
            </p>
          </div>
          <Switch
            checked={settings.reducedMotion}
            onCheckedChange={(checked) => void updateSettings({ reducedMotion: checked })}
            aria-label="Reduced motion"
          />
        </div>
      </GlassCard>

      {/* Connected Accounts (YouTube & YouTube Music) */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 text-[#FF0000]" />
            <h2 className="text-base font-semibold font-display">YouTube & YouTube Music Account</h2>
          </div>
          {ytConnected && (
            <div className="flex items-center gap-2">
              <GlassButton size="sm" onClick={() => void ytRefreshAll()}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync</span>
              </GlassButton>
              <GlassButton size="sm" variant="ghost" onClick={() => void ytSignOut()}>
                <span>Disconnect</span>
              </GlassButton>
            </div>
          )}
        </div>

        {ytConnected ? (
          <div className="flex items-center gap-3.5">
            {(ytChannel?.thumbnailUrl || ytUser?.photoURL) && (
              <img
                src={ytChannel?.thumbnailUrl || ytUser?.photoURL || ''}
                alt={ytChannel?.title || ytUser?.displayName || 'YouTube'}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-2xl object-cover shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {ytChannel?.title || ytUser?.displayName || 'Connected Google Account'}
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate font-mono-tabular">
                {ytUser?.email || 'Connected'} · {ytPlaylists.length} playlists · {ytLikedTracks.length} liked songs
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] max-w-md">
              Connect your Google account to browse and play your YouTube Music playlists, liked songs, and subscribed channels inside Neo Player.
            </p>
            <GoogleSignInButton
              onClick={() => void ytSignIn(false)}
              loading={ytLoggingIn}
              label="Sign in with Google"
            />
          </div>
        )}

        {ytConnected && <YouTubeErrorBanner />}
      </GlassCard>

      {/* Personalization Studio */}
      <PersonalizationStudio />

      {/* Playback & Audio Settings */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-4 h-4 text-[#FF2D55]" />
          <h2 className="text-base font-semibold font-display">Playback & Audio</h2>
        </div>

        <SettingRow
          title="Resume Playback on Launch"
          description="Restore your last track, queue, and timestamp automatically"
          control={
            <Switch
              checked={settings.resumeOnLaunch}
              onCheckedChange={(checked) => void updateSettings({ resumeOnLaunch: checked })}
              aria-label="Resume playback on launch"
            />
          }
        />

        <SettingRow
          title="Volume Normalization"
          description="Apply gentle dynamic compression to balance track loudness"
          control={
            <Switch
              checked={settings.volumeNormalization}
              onCheckedChange={(checked) => void updateSettings({ volumeNormalization: checked })}
              aria-label="Volume normalization"
            />
          }
        />

        <SettingRow
          title="Show Remaining Time"
          description="Display countdown (-mm:ss) instead of total track duration"
          control={
            <Switch
              checked={settings.showRemainingTime}
              onCheckedChange={(checked) => void updateSettings({ showRemainingTime: checked })}
              aria-label="Show remaining time"
            />
          }
        />

        <SettingRow
          title="Playback Speed"
          description="Adjust listening tempo for music or spoken audio"
          control={
            <select
              aria-label="Playback speed"
              value={settings.playbackRate}
              onChange={(e) => void updateSettings({ playbackRate: parseFloat(e.target.value) })}
              className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.15}>1.15x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          }
        />

        <SettingRow
          title="Seek Step Interval"
          description="Skip forward/back step used by keyboard and media notifications"
          control={
            <select
              aria-label="Seek step interval"
              value={settings.seekStepSeconds}
              onChange={(e) =>
                void updateSettings({
                  seekStepSeconds: parseInt(e.target.value, 10) as 10 | 15 | 30,
                })
              }
              className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            >
              <option value={10}>10 sec</option>
              <option value={15}>15 sec</option>
              <option value={30}>30 sec</option>
            </select>
          }
        />

        <div className="py-3 border-t border-black/6 dark:border-white/8 space-y-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Crossfade Tracks</p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                Smoothly fade out the ending track as the next track fades in
              </p>
            </div>
            <span
              className={cn(
                'text-xs font-mono-tabular font-semibold px-2.5 py-1 rounded-xl shrink-0',
                (settings.crossfadeSeconds || 0) > 0
                  ? 'bg-[var(--neo-accent-soft)] text-[var(--neo-accent)]'
                  : 'liquid-glass-subtle text-[#6E6E73] dark:text-[#98989D]'
              )}
            >
              {(settings.crossfadeSeconds || 0) > 0 ? `${settings.crossfadeSeconds}s` : 'Off'}
            </span>
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <span className="text-[11px] font-mono-tabular text-[#8E8E93] w-6 shrink-0">Off</span>
            <Slider
              aria-label="Crossfade duration in seconds"
              min={0}
              max={12}
              step={1}
              value={[settings.crossfadeSeconds ?? 0]}
              onValueChange={(vals) =>
                void updateSettings({ crossfadeSeconds: vals[0] ?? 0 })
              }
              rangeClassName={
                (settings.crossfadeSeconds || 0) > 0 ? 'bg-[var(--neo-accent)]' : undefined
              }
            />
            <span className="text-[11px] font-mono-tabular text-[#8E8E93] w-7 text-right shrink-0">
              12s
            </span>
          </div>
        </div>

        <div className="border-t border-black/8 dark:border-white/10 pt-5 mt-2">
          <EqualizerPanel />
        </div>
      </GlassCard>

      {/* Music Radar & Notifications */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--neo-accent)]" />
            <h2 className="text-base font-semibold font-display">Music Radar & Notifications</h2>
          </div>
          <GlassButton size="sm" onClick={() => void refreshRadar()}>
            <Radio className="w-3.5 h-3.5" />
            <span>Sync Radar</span>
          </GlassButton>
        </div>

        <SettingRow
          title="Trending Song Alerts"
          description="Notify inside Neo Player when top songs break into the regional charts"
          control={
            <Switch
              checked={settings.notifyTrending}
              onCheckedChange={(checked) => void updateSettings({ notifyTrending: checked })}
              aria-label="Trending song alerts"
            />
          }
        />

        <SettingRow
          title="Favourite Artist Release Alerts"
          description="Monitor followed and most-played artists for new singles and albums"
          control={
            <Switch
              checked={settings.notifyFavoriteArtists}
              onCheckedChange={(checked) => void updateSettings({ notifyFavoriteArtists: checked })}
              aria-label="Favourite artist release alerts"
            />
          }
        />

        <SettingRow
          title="Device / Browser Notifications"
          description="Also pop system notifications when new artist drops or trending hits arrive"
          control={
            <Switch
              checked={settings.osNotificationsEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  void requestOsNotificationPermission().then((granted) => {
                    void updateSettings({ osNotificationsEnabled: granted });
                  });
                } else {
                  void updateSettings({ osNotificationsEnabled: false });
                }
              }}
              aria-label="Device browser notifications"
            />
          }
        />

        <SettingRow
          title="Trending Chart Region"
          description="Choose which country's charts to track"
          control={
            <select
              aria-label="Trending chart region"
              value={settings.discoveryCountry || 'us'}
              onChange={(e) => void updateSettings({ discoveryCountry: e.target.value })}
              className="min-h-[38px] max-w-[220px] px-3 rounded-xl liquid-glass-subtle text-xs focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
            >
              {CHART_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code.toUpperCase()})
                </option>
              ))}
            </select>
          }
        />

        {settings.followedArtists && settings.followedArtists.length > 0 && (
          <div className="border-t border-black/8 dark:border-white/10 pt-3 space-y-2">
            <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
              Followed Artists ({settings.followedArtists.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {settings.followedArtists.map((artist) => (
                <span
                  key={artist}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-xl liquid-glass-subtle text-xs font-medium"
                >
                  <span>{artist}</span>
                  <button
                    type="button"
                    onClick={() => void toggleFollowArtist(artist)}
                    aria-label={`Unfollow ${artist}`}
                    className="min-h-[26px] min-w-[26px] rounded-lg flex items-center justify-center text-[#6E6E73] hover:text-[#FF2D55] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Storage & Library Management */}
      <GlassCard className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#0A84FF]" />
            <h2 className="text-base font-semibold font-display">Offline Storage & Library</h2>
          </div>
          {storage && (
            <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
              {formatBytes(storage.totalUsedBytes)} used
            </span>
          )}
        </div>

        {storage && (
          <div className="space-y-3">
            <div className="h-2.5 w-full rounded-full bg-black/8 dark:bg-white/10 overflow-hidden flex">
              {storage.totalUsedBytes > 0 && (
                <>
                  <div
                    className="h-full bg-[#FF2D55]"
                    style={{
                      width: `${(storage.audioBytes / storage.totalUsedBytes) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#0A84FF]"
                    style={{
                      width: `${(storage.artworkBytes / storage.totalUsedBytes) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
              <span>Audio: {formatBytes(storage.audioBytes)}</span>
              <span>Artwork: {formatBytes(storage.artworkBytes)}</span>
              <span>Metadata: {formatBytes(storage.metadataBytes)}</span>
              {storage.browserQuotaBytes && (
                <span>Device Quota: {formatBytes(storage.browserQuotaBytes)}</span>
              )}
            </div>
          </div>
        )}

        <ImportDropzone compact onImported={refreshStorage} />

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <GlassButton size="sm" onClick={handleExportMetadata} disabled={tracks.length === 0}>
            <Download className="w-3.5 h-3.5" />
            <span>Export Metadata JSON</span>
          </GlassButton>
          <GlassButton size="sm" onClick={() => void clearPlayHistory()} disabled={tracks.length === 0}>
            <span>Reset Play History</span>
          </GlassButton>
          <GlassButton
            size="sm"
            onClick={() => setConfirmClearOpen(true)}
            disabled={tracks.length === 0 && playlists.length === 0}
            className="text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Library Data</span>
          </GlassButton>
        </div>

        <div className="border-t border-black/8 dark:border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--neo-accent)]" />
            <h3 className="text-sm font-semibold">Online Tags, Album Covers & Lyrics</h3>
          </div>

          <SettingRow
            title="Auto-Fetch Missing Info on Import"
            description="Automatically fill missing tags, Cover Art Archive artwork, and LRCLIB lyrics when importing new songs"
            control={
              <Switch
                checked={settings.autoEnrichOnImport}
                onCheckedChange={(checked) =>
                  void updateSettings({
                    autoEnrichOnImport: checked,
                    autoEnrichPreferenceSaved: true,
                  })
                }
                aria-label="Auto-fetch missing metadata and lyrics on import"
              />
            }
          />

          <SettingRow
            title="Auto-Enrich Existing Library"
            description="Scan tracks with missing covers, lyrics, or Unknown Artist tags via MusicBrainz & LRCLIB"
            control={
              enrichProgress.active ? (
                <GlassButton size="sm" onClick={cancelBatchEnrich}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Stop ({enrichProgress.done + 1}/{enrichProgress.total})
                  </span>
                </GlassButton>
              ) : (
                <GlassButton
                  size="sm"
                  variant="accent"
                  disabled={tracks.length === 0}
                  onClick={() => void enrichTracksBatch()}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Enrich Missing</span>
                </GlassButton>
              )
            }
          />

          {enrichProgress.active && (
            <div className="space-y-1.5">
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                Matching: {enrichProgress.currentTitle}
              </p>
              <div className="h-1.5 w-full rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[var(--neo-accent)] transition-all duration-200"
                  style={{
                    width: `${Math.round(((enrichProgress.done + 0.5) / Math.max(1, enrichProgress.total)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Android & Capacitor Integration */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#30D158]" />
            <h2 className="text-base font-semibold font-display">Android & App Experience</h2>
          </div>
          <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
            {platform.isNativeAndroid
              ? 'Android Native (Capacitor)'
              : platform.isAndroidBrowser
                ? 'Android Web / PWA'
                : 'Desktop Web · Android Ready'}
          </span>
        </div>

        <SettingRow
          title="Touch Haptic Feedback"
          description="Subtle tactile feedback on Android playback controls and navigation"
          control={
            <Switch
              checked={settings.hapticFeedback}
              onCheckedChange={(checked) => void updateSettings({ hapticFeedback: checked })}
              aria-label="Touch haptic feedback"
            />
          }
        />

        <SettingRow
          title="Keep Screen Awake During Playback"
          description="Prevent display sleep while viewing Now Playing or synchronized lyrics"
          control={
            <Switch
              checked={settings.keepScreenAwake}
              onCheckedChange={(checked) => void updateSettings({ keepScreenAwake: checked })}
              aria-label="Keep screen awake"
            />
          }
        />

        {onReplayIntro && (
          <SettingRow
            title="Welcome Intro"
            description="Replay the Neo Player onboarding experience"
            control={
              <GlassButton size="sm" onClick={onReplayIntro}>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Intro</span>
              </GlassButton>
            }
          />
        )}

        <SettingRow
          title="Android MediaStore Plugin"
          description={
            hasNativeMediaStore
              ? 'Scan Android music folders directly via READ_MEDIA_AUDIO without duplicating audio files'
              : 'Native plugin compiled in Android Capacitor project (com.neoplayer.music); browser builds use Select Files / Import Folder'
          }
          control={
            <div className="flex items-center gap-2">
              {hasNativeMediaStore && (
                <GlassButton
                  size="sm"
                  onClick={() => {
                    void MediaStore.clearMediaCache().then((res) => {
                      setCacheNotice(
                        res.clearedBytes > 0
                          ? `Cleared ${formatBytes(res.clearedBytes)} stream cache`
                          : 'Media cache is empty'
                      );
                    });
                  }}
                >
                  <span>Clear Cache</span>
                </GlassButton>
              )}
              <GlassButton
                size="sm"
                variant={hasNativeMediaStore ? 'accent' : 'glass'}
                disabled={!hasNativeMediaStore || isScanningMediaStore}
                onClick={() => void scanDeviceMediaStore()}
              >
                <RefreshCw className={isScanningMediaStore ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
                <span>
                  {isScanningMediaStore
                    ? 'Scanning...'
                    : hasNativeMediaStore
                      ? 'Scan MediaStore'
                      : 'Android APK Only'}
                </span>
              </GlassButton>
            </div>
          }
        />

        {cacheNotice && (
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
            {cacheNotice}
          </p>
        )}

        <div className="pt-2 border-t border-black/8 dark:border-white/10 text-xs text-[#6E6E73] dark:text-[#98989D] space-y-1">
          <p>
            Capacitor Android project configured (<span className="font-mono-tabular">com.neoplayer.music</span>) with custom <span className="font-mono-tabular">MediaStorePlugin</span>. Run <span className="font-mono-tabular">npm run android:sync</span> to build and sync into Android Studio.
          </p>
        </div>
      </GlassCard>

      {/* Privacy & Architecture */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h2 className="text-base font-semibold font-display">Privacy & Offline Architecture</h2>
        </div>
        <p className="text-sm text-[#48484A] dark:text-[#AEAEB2] leading-relaxed">
          Neo Player operates strictly on-device. Audio files, embedded artwork, playlists, lyrics, and listening history are stored locally in IndexedDB and never transmitted to any remote server.
        </p>
        <div className="flex items-start gap-2.5 pt-2 border-t border-black/8 dark:border-white/10 text-xs text-[#6E6E73] dark:text-[#98989D]">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Built as an installable Android PWA and Capacitor Android project with Media Session lockscreen controls, hardware back-button support, and safe-area edge-to-edge layout.
          </p>
        </div>
      </GlassCard>

      <GlassModal
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear Entire Library?"
        description="This permanently removes all imported songs, album artwork, playlists, and lyrics from this browser's local storage."
      >
        <div className="flex justify-end gap-2">
          <GlassButton variant="ghost" onClick={() => setConfirmClearOpen(false)}>
            Cancel
          </GlassButton>
          <GlassButton variant="accent" onClick={() => void handleClearLibrary()}>
            Clear Library
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
};

const SettingRow: React.FC<{
  title: string;
  description: string;
  control: React.ReactNode;
}> = ({ title, description, control }) => (
  <div className="flex items-center justify-between gap-4 py-2 border-t border-black/6 dark:border-white/8 first:border-t-0 first:pt-0">
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">{description}</p>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);
