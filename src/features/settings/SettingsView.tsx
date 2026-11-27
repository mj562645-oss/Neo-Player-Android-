import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Bluetooth,
  ChevronRight,
  Download,
  ExternalLink,
  FolderSearch,
  HardDrive,
  Loader2,
  Palette,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  UserRoundCheck,
  X,
  Youtube,
} from 'lucide-react';
import { useDiscovery } from '../../app/DiscoveryContext';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useToast } from '../../app/ToastContext';
import { useYouTube } from '../../app/YouTubeContext';
import { formatBytes } from '../../lib/format';
import { CHART_COUNTRIES } from '../../lib/countries';
import { invalidateArtworkDataUrlCache } from '../../lib/mediaSession';
import {
  getFontPresetMeta,
  getUiThemeMeta,
  resolveActivePalette,
} from '../../lib/palettes';
import { cn } from '../../lib/utils';
import { MediaStore, isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
import { getPlatformInfo } from '../../services/androidPlatform';
import { audioEngine, type AudioOutputDevice } from '../../services/audioEngine';
import {
  clearPhoneNotificationCenterPill,
  requestPhoneNotificationPermission,
  showPhoneNotificationCenterPill,
} from '../../services/phoneNotifications';
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
    pickAndLinkOriginalFolder,
    enrichProgress,
    enrichTracksBatch,
    cancelBatchEnrich,
    getStorageBreakdown,
    exportLibraryMetadata,
    clearPlayHistory,
    clearAllLibrary,
  } = useLibrary();
  const { currentTrack, isPlaying, repeat, clearQueue } = usePlayer();
  const { settings, updateSettings, toggleFollowArtist } = useTheme();
  const { showToast } = useToast();
  const { requestOsNotificationPermission, refreshRadar } = useDiscovery();
  const {
    user: ytUser,
    channel: ytChannel,
    isConnected: ytConnected,
    isLoggingIn: ytLoggingIn,
    error: ytError,
    playlists: ytPlaylists,
    likedTracks: ytLikedTracks,
    signIn: ytSignIn,
    signOut: ytSignOut,
    refreshAll: ytRefreshAll,
  } = useYouTube();

  const [activeSubView, setActiveSubView] = useState<'overview' | 'personalization'>('overview');
  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [scanningWebFolder, setScanningWebFolder] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputDevice[]>([]);
  const [refreshingOutputs, setRefreshingOutputs] = useState(false);
  const sinkIdSupported = audioEngine.isSinkIdSupported();

  const refreshStorage = useCallback(() => {
    void getStorageBreakdown().then(setStorage);
  }, [getStorageBreakdown]);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage, tracks.length, playlists.length]);

  const refreshAudioOutputs = useCallback(async () => {
    setRefreshingOutputs(true);
    try {
      const devices = await audioEngine.listAudioOutputDevices();
      setAudioOutputs(devices);
    } finally {
      setRefreshingOutputs(false);
    }
  }, []);

  useEffect(() => {
    void refreshAudioOutputs();
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== 'function'
    ) {
      return;
    }
    const handleDeviceChange = () => {
      void refreshAudioOutputs();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshAudioOutputs]);

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

  const handleScanLibrary = async () => {
    if (hasNativeMediaStore) {
      await scanDeviceMediaStore({ requestPermission: true });
      refreshStorage();
      return;
    }
    setScanningWebFolder(true);
    try {
      await pickAndLinkOriginalFolder();
      refreshStorage();
    } finally {
      setScanningWebFolder(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      let clearedBytes = 0;
      let cacheEntriesCleared = 0;

      if (hasNativeMediaStore) {
        const res = await MediaStore.clearMediaCache();
        clearedBytes += res.clearedBytes || 0;
      }

      invalidateArtworkDataUrlCache();

      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        for (const key of keys) {
          const deleted = await window.caches.delete(key);
          if (deleted) cacheEntriesCleared++;
        }
      }

      if (clearedBytes > 0 && cacheEntriesCleared > 0) {
        setCacheNotice(
          `Cleared ${formatBytes(clearedBytes)} media cache and ${cacheEntriesCleared} cached resource store(s).`
        );
      } else if (clearedBytes > 0) {
        setCacheNotice(`Cleared ${formatBytes(clearedBytes)} stream cache.`);
      } else if (cacheEntriesCleared > 0) {
        setCacheNotice(`Cleared ${cacheEntriesCleared} temporary browser cache store(s) and artwork cache.`);
      } else {
        setCacheNotice('Temporary media and artwork caches cleared.');
      }
      refreshStorage();
    } finally {
      setClearingCache(false);
    }
  };

  const p = settings.personalization;
  const activeThemeMeta = getUiThemeMeta(p.uiTheme);
  const activePalette = resolveActivePalette(p);
  const activeFontMeta = getFontPresetMeta(p.fontStyle);

  if (activeSubView === 'personalization') {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
            Appearance &amp; Design
          </h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Theme system, color palettes, modern fonts, and custom backgrounds
          </p>
        </div>
        <PersonalizationStudio onBack={() => setActiveSubView('overview')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Settings</h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Account, appearance, Bluetooth audio, library tools, and preferences
          </p>
        </div>
        <PWAInstallButton variant="full" />
      </div>

      {/* 1. User Account (Top) */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF0000]/12 text-[#FF0000] flex items-center justify-center shrink-0">
              <Youtube className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold font-display">Google &amp; YouTube Account</h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                Multi-user read-only YouTube Music sync &amp; account switcher
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() => setVerificationModalOpen(true)}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Privacy &amp; Verification</span>
            </GlassButton>
            {ytConnected && (
              <>
                <GlassButton size="sm" onClick={() => void ytRefreshAll()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync</span>
                </GlassButton>
                <GlassButton
                  size="sm"
                  disabled={ytLoggingIn}
                  onClick={() => void ytSignIn(true)}
                >
                  <UserRoundCheck className="w-3.5 h-3.5" />
                  <span>Switch Account</span>
                </GlassButton>
                <GlassButton size="sm" variant="ghost" onClick={() => void ytSignOut()}>
                  <span>Disconnect</span>
                </GlassButton>
              </>
            )}
          </div>
        </div>

        {ytConnected ? (
          <div className="flex items-center gap-3.5 p-3.5 neo-btn-radius liquid-glass-subtle">
            {ytChannel?.thumbnailUrl || ytUser?.photoURL ? (
              <img
                src={ytChannel?.thumbnailUrl || ytUser?.photoURL || ''}
                alt={ytChannel?.title || ytUser?.displayName || 'YouTube'}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-2xl object-cover shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-[var(--neo-accent-soft)] text-[var(--neo-accent)] flex items-center justify-center font-bold text-sm shrink-0">
                {(ytChannel?.title || ytUser?.displayName || ytUser?.email || 'G')[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {ytChannel?.title || ytUser?.displayName || 'Connected Google Account'}
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate font-mono-tabular">
                {ytUser?.email || 'Signed in'} · {ytPlaylists.length} playlists · {ytLikedTracks.length} liked songs
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] max-w-lg leading-relaxed">
                Any user can sign in with their Google account to browse playlists, liked music, and subscriptions with read-only access inside Neo Player.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <GoogleSignInButton
                  onClick={() => void ytSignIn(false)}
                  loading={ytLoggingIn}
                  label="Sign in with Google"
                />
                {ytError && typeof window !== 'undefined' && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl text-xs font-semibold liquid-glass-subtle hover:brightness-105 transition-all"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            {ytError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{ytError}</p>
            )}
          </div>
        )}

        {ytConnected && <YouTubeErrorBanner />}
      </GlassCard>

      {/* 2. Clickable Appearance & Personalization Container */}
      <GlassCard
        interactive
        role="button"
        tabIndex={0}
        onClick={() => setActiveSubView('personalization')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveSubView('personalization');
          }
        }}
        className="p-5 sm:p-6 space-y-4 focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--neo-accent-soft)] text-[var(--neo-accent)] flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold font-display">
                Appearance &amp; Personalization
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
                <span className="font-medium text-[#111216] dark:text-[#F5F5F7]">
                  {activeThemeMeta.name}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center -space-x-1">
                    <span
                      className="w-3 h-3 rounded-full ring-1 ring-white dark:ring-[#181920]"
                      style={{ backgroundColor: activePalette.accent }}
                    />
                    <span
                      className="w-3 h-3 rounded-full ring-1 ring-white dark:ring-[#181920]"
                      style={{ backgroundColor: activePalette.secondary }}
                    />
                  </span>
                  <span>{activePalette.name}</span>
                </span>
                <span>·</span>
                <span style={{ fontFamily: activeFontMeta.displayFont }}>
                  {activeFontMeta.name}
                </span>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--neo-accent)] shrink-0">
            <span>Customize Theme, Colors &amp; Fonts</span>
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>

        <div
          className="border-t border-black/8 dark:border-white/10 pt-4 flex flex-wrap items-center justify-between gap-4"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div>
            <p className="text-sm font-medium">Color Mode</p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Choose Light, Dark, or follow your device setting
            </p>
          </div>
          <ThemeSwitcher />
        </div>

        <div
          className="border-t border-black/8 dark:border-white/10 pt-4 flex items-center justify-between gap-4"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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

      {/* 3. Playback, Bluetooth & Audio */}
      <GlassCard className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--neo-accent)]" />
          <h2 className="text-base font-semibold font-display">Playback, Bluetooth &amp; Audio</h2>
        </div>

        {/* Bluetooth & Output Routing */}
        <div className="p-4 neo-btn-radius liquid-glass-subtle space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-[var(--neo-accent)]" />
              <h3 className="text-sm font-semibold">Bluetooth &amp; Output Device</h3>
            </div>
            {sinkIdSupported && (
              <GlassButton
                size="sm"
                variant="ghost"
                disabled={refreshingOutputs}
                onClick={() => void refreshAudioOutputs()}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshingOutputs && 'animate-spin')} />
                <span>Refresh Devices</span>
              </GlassButton>
            )}
          </div>

          <SettingRow
            title="Active Audio Output Route"
            description={
              sinkIdSupported
                ? 'Choose Bluetooth headphones, speakers, or system default output'
                : 'Audio routes automatically to your connected Bluetooth or Android media device'
            }
            control={
              sinkIdSupported ? (
                <select
                  aria-label="Audio output device"
                  value={settings.audioOutputDeviceId || ''}
                  onChange={(e) => void updateSettings({ audioOutputDeviceId: e.target.value })}
                  className="min-h-[38px] max-w-[230px] px-3 rounded-xl liquid-glass-subtle text-xs focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                >
                  <option value="">System / Bluetooth Default</option>
                  {audioOutputs
                    .filter((d) => d.deviceId && d.deviceId !== 'default')
                    .map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="text-xs font-medium px-3 py-1.5 rounded-xl liquid-glass-subtle text-[#6E6E73] dark:text-[#98989D]">
                  Managed by OS
                </span>
              )
            }
          />

          <SettingRow
            title="Auto-Pause on Bluetooth Disconnect"
            description="Automatically pause music when Bluetooth headphones or speakers disconnect"
            control={
              <Switch
                checked={settings.pauseOnBluetoothDisconnect}
                onCheckedChange={(checked) =>
                  void updateSettings({ pauseOnBluetoothDisconnect: checked })
                }
                aria-label="Auto-pause on Bluetooth disconnect"
              />
            }
          />

          <SettingRow
            title="Broadcast Track Info &amp; Art to Bluetooth"
            description="Send song title, artist, album, and cover art to car stereos and Bluetooth displays"
            control={
              <Switch
                checked={settings.bluetoothMetadataSync}
                onCheckedChange={(checked) =>
                  void updateSettings({ bluetoothMetadataSync: checked })
                }
                aria-label="Broadcast track info and artwork to Bluetooth"
              />
            }
          />
        </div>

        {/* Phone Notification Center Live Pill, Lockscreen & Home Widget */}
        <div className="p-4 neo-btn-radius liquid-glass-subtle space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--neo-accent)]" />
              <h3 className="text-sm font-semibold">
                Phone Notification Center, Lockscreen &amp; 4×1 Widget
              </h3>
            </div>
            <GlassButton
              size="sm"
              onClick={() => {
                const payload = currentTrack
                  ? {
                      title: currentTrack.title,
                      artist: currentTrack.artist,
                      album: currentTrack.album,
                      isPlaying,
                      isFavourite: Boolean(currentTrack.isFavourite),
                      repeatMode: repeat,
                      artworkId: currentTrack.artworkId,
                      artworkUrl: currentTrack.artworkUrl,
                      requestPermissionIfNeeded: true,
                    }
                  : {
                      title: 'Neo Player Live Pill',
                      artist: 'Swipe down your phone Notification Center',
                      isPlaying: true,
                      requestPermissionIfNeeded: true,
                    };
                void updateSettings({ androidLivePillNotification: true });
                void showPhoneNotificationCenterPill(payload).then((res) => {
                  showToast(
                    res.message ||
                      (res.ok
                        ? 'Live Pill posted to your phone Notification Center.'
                        : 'Allow OS notifications to display the pill in your phone Notification Center.'),
                    res.ok ? 'success' : 'info'
                  );
                });
              }}
            >
              <span>Send to Notification Center</span>
            </GlassButton>
          </div>

          <SettingRow
            title="Live Pill in Phone Notification Center"
            description="Show an album-art Live Notification Pill in your phone's notification shade alongside Android 10+ lockscreen Like/Repeat, Samsung Now Bar, and the 4×1 frosted widget"
            control={
              <Switch
                checked={settings.androidLivePillNotification ?? true}
                onCheckedChange={(checked) => {
                  if (checked) {
                    void requestPhoneNotificationPermission().then((granted) => {
                      void updateSettings({ androidLivePillNotification: granted });
                      if (granted && currentTrack) {
                        void showPhoneNotificationCenterPill({
                          title: currentTrack.title,
                          artist: currentTrack.artist,
                          album: currentTrack.album,
                          isPlaying,
                          isFavourite: Boolean(currentTrack.isFavourite),
                          repeatMode: repeat,
                          artworkId: currentTrack.artworkId,
                          artworkUrl: currentTrack.artworkUrl,
                        });
                        showToast('Phone Notification Center Live Pill enabled', 'success');
                      } else if (!granted) {
                        showToast(
                          'Notification permission was not granted in your device settings.',
                          'info'
                        );
                      } else {
                        showToast('Phone Notification Center Live Pill enabled', 'success');
                      }
                    });
                  } else {
                    void updateSettings({ androidLivePillNotification: false });
                    void clearPhoneNotificationCenterPill();
                  }
                }}
                aria-label="Live pill in phone notification center"
              />
            }
          />

          <SettingRow
            title="In-App Bottom Album-Art Media Pill"
            description="Render the floating bottom mini player as a compact pill with blurred album art, Like, and Repeat controls"
            control={
              <Switch
                checked={settings.personalization.liveMediaPill ?? true}
                onCheckedChange={(checked) =>
                  void updateSettings({
                    personalization: { ...settings.personalization, liveMediaPill: checked },
                  })
                }
                aria-label="In-app bottom album-art media pill"
              />
            }
          />
        </div>

        <div className="space-y-1">
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
                onCheckedChange={(checked) =>
                  void updateSettings({ volumeNormalization: checked })
                }
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
                className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
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
                className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
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
        </div>

        <div className="border-t border-black/8 dark:border-white/10 pt-5 mt-2">
          <EqualizerPanel />
        </div>
      </GlassCard>

      {/* 4. Library, Scan, Cache & Storage */}
      <GlassCard className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#0A84FF]" />
            <h2 className="text-base font-semibold font-display">Library, Cache &amp; Storage</h2>
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
                    className="h-full bg-[var(--neo-accent)]"
                    style={{
                      width: `${(storage.audioBytes / storage.totalUsedBytes) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-[var(--neo-secondary)]"
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
          <GlassButton
            size="sm"
            variant="accent"
            disabled={isScanningMediaStore || scanningWebFolder}
            onClick={() => void handleScanLibrary()}
          >
            {isScanningMediaStore || scanningWebFolder ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderSearch className="w-3.5 h-3.5" />
            )}
            <span>
              {isScanningMediaStore || scanningWebFolder
                ? 'Scanning...'
                : hasNativeMediaStore
                  ? 'Scan Device Music'
                  : 'Scan Music Folder'}
            </span>
          </GlassButton>

          <GlassButton
            size="sm"
            disabled={clearingCache}
            onClick={() => void handleClearCache()}
          >
            {clearingCache ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Clear Cache</span>
          </GlassButton>

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

        {cacheNotice && (
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
            {cacheNotice}
          </p>
        )}

        <div className="border-t border-black/8 dark:border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--neo-accent)]" />
            <h3 className="text-sm font-semibold">Online Tags, Album Covers &amp; Lyrics</h3>
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

      {/* 5. Music Radar & Notifications + App Preferences */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--neo-accent)]" />
            <h2 className="text-base font-semibold font-display">Music Radar &amp; Notifications</h2>
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
                    className="min-h-[26px] min-w-[26px] rounded-lg flex items-center justify-center text-[#6E6E73] hover:text-[var(--neo-accent)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* App Preferences */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#30D158]" />
            <h2 className="text-base font-semibold font-display">App Preferences</h2>
          </div>
          <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
            {platform.isNativeAndroid
              ? 'Android App'
              : platform.isAndroidBrowser
                ? 'Android Web'
                : 'Desktop Web'}
          </span>
        </div>

        <SettingRow
          title="Touch Haptic Feedback"
          description="Subtle tactile feedback on playback controls and navigation"
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
      </GlassCard>

      {/* Clear Library Confirmation Modal */}
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

      {/* Google Verification & Privacy Transparency Modal */}
      <GlassModal
        open={verificationModalOpen}
        onOpenChange={setVerificationModalOpen}
        title="Google OAuth &amp; Privacy Disclosure"
        description="Transparency details for Neo Player's optional multi-user Google &amp; YouTube Music connection."
      >
        <div className="space-y-4 text-xs sm:text-sm text-[#48484A] dark:text-[#AEAEB2] leading-relaxed">
          <div className="p-3.5 neo-btn-radius liquid-glass-subtle space-y-1.5">
            <p className="font-semibold text-[#111216] dark:text-white">
              Open to All Google Users
            </p>
            <p>
              Any user may sign in, switch accounts anytime, or disconnect cleanly. No single email address is required or restricted.
            </p>
          </div>
          <div className="p-3.5 neo-btn-radius liquid-glass-subtle space-y-1.5">
            <p className="font-semibold text-[#111216] dark:text-white">
              Read-Only YouTube Scope (youtube.readonly)
            </p>
            <p>
              Neo Player only requests read-only access to list your YouTube playlists, liked music, and subscriptions for in-app streaming. It complies with the Google API Services User Data Policy (Limited Use).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--neo-accent)] hover:underline"
            >
              <span>Privacy Policy</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--neo-accent)] hover:underline"
            >
              <span>Terms of Service</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
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
