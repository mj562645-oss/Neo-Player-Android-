import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Disc3,
  Flame,
  Home,
  Library,
  ListMusic,
  Play,
  Quote,
  Radio,
  Search,
  Settings,
  WifiOff,
  Youtube,
} from 'lucide-react';
import { useDiscovery } from './DiscoveryContext';
import { useLibrary } from './LibraryContext';
import { usePlayer } from './PlayerContext';
import { useTheme } from './ThemeContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useArtworkUrl, useDominantColor } from '../hooks/useDominantColor';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatRelativeDate } from '../lib/format';
import { STUDIO_GRADIENTS } from '../lib/palettes';
import { cn } from '../lib/utils';
import { registerAndroidBackHandler } from '../services/androidPlatform';
import type { AppSection, LibrarySubTab } from '../types/music';
import { GlassButton } from '../components/glass/GlassButton';
import { GlassModal } from '../components/glass/GlassModal';
import { GlassNavigation, type NavDestination } from '../components/glass/GlassNavigation';
import { MiniPlayer } from '../components/MiniPlayer';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { QueueDrawer } from '../components/QueueDrawer';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { TuneInBar } from '../components/TuneInBar';
import { DiscoverView } from '../features/discover/DiscoverView';
import { HomeView } from '../features/home/HomeView';
import { IntroExperience } from '../features/intro/IntroExperience';
import { LibraryView } from '../features/library/LibraryView';
import { LyricsView } from '../features/lyrics/LyricsView';
import { NowPlayingScreen } from '../features/player/NowPlayingScreen';
import { CreatePlaylistModal } from '../features/playlists/CreatePlaylistModal';
import { PlaylistsView } from '../features/playlists/PlaylistsView';
import { SearchView } from '../features/search/SearchView';
import { SettingsView } from '../features/settings/SettingsView';
import { YouTubeView } from '../features/youtube/YouTubeView';

const BASE_DESKTOP_NAV: NavDestination<AppSection>[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'discover', label: 'Radar', icon: Radio },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'lyrics', label: 'Lyrics', icon: Quote },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const BASE_MOBILE_NAV: NavDestination<AppSection>[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const AppShell: React.FC = () => {
  const { isLoading } = useLibrary();
  const {
    notifications,
    unreadCount,
    playDiscoveryTrack,
    markNotificationRead,
    markAllNotificationsRead,
  } = useDiscovery();
  const {
    currentTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seekBy,
    nowPlayingOpen,
    setNowPlayingOpen,
    queueOpen,
    setQueueOpen,
  } = usePlayer();
  const { settings, settingsLoaded, updateSettings } = useTheme();
  const isOnline = useOnlineStatus();

  const [section, setSection] = useState<AppSection>('home');
  const [libraryInitialTab, setLibraryInitialTab] = useState<LibrarySubTab>('songs');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [focusedLyricsTrackId, setFocusedLyricsTrackId] = useState<string | null>(null);
  const [replayingIntro, setReplayingIntro] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const [createPlOpen, setCreatePlOpen] = useState(false);
  const [createPlMood, setCreatePlMood] = useState<string | undefined>(undefined);
  const [createPlTracks, setCreatePlTracks] = useState<string[] | undefined>(undefined);

  const showIntro = replayingIntro || (settingsLoaded && !settings.hasSeenIntro);

  useEffect(() => {
    return registerAndroidBackHandler(() => {
      if (showIntro) {
        setReplayingIntro(false);
        void updateSettings({ hasSeenIntro: true });
        return true;
      }
      if (queueOpen) {
        setQueueOpen(false);
        return true;
      }
      if (nowPlayingOpen) {
        setNowPlayingOpen(false);
        return true;
      }
      if (createPlOpen) {
        setCreatePlOpen(false);
        return true;
      }
      if (selectedPlaylistId) {
        setSelectedPlaylistId(null);
        return true;
      }
      if (section !== 'home') {
        setSection('home');
        return true;
      }
      return false;
    });
  }, [
    showIntro,
    queueOpen,
    nowPlayingOpen,
    createPlOpen,
    selectedPlaylistId,
    section,
    setQueueOpen,
    setNowPlayingOpen,
    updateSettings,
  ]);

  const handleNavigate = useCallback((nextSection: AppSection, libTab?: LibrarySubTab) => {
    setSection(nextSection);
    if (libTab) setLibraryInitialTab(libTab);
    if (nextSection !== 'playlists') setSelectedPlaylistId(null);
  }, []);

  const handleOpenPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setSection('playlists');
  }, []);

  const handleOpenCreatePlaylist = useCallback(
    (opts?: { moodId?: string; trackIds?: string[] }) => {
      setCreatePlMood(opts?.moodId);
      setCreatePlTracks(opts?.trackIds);
      setCreatePlOpen(true);
    },
    []
  );

  const handleOpenLyricsForTrack = useCallback((trackId: string) => {
    setFocusedLyricsTrackId(trackId);
    setSection('lyrics');
  }, []);

  useKeyboardShortcuts({
    onTogglePlay: () => void togglePlay(),
    onNext: () => void nextTrack(),
    onPrev: () => void prevTrack(),
    onSeekForward: () => seekBy(settings.seekStepSeconds),
    onSeekBackward: () => seekBy(-settings.seekStepSeconds),
    onToggleMute: () => void updateSettings({ muted: !settings.muted }),
    onFocusSearch: () => setSection('search'),
    onCloseOverlay: () => {
      if (queueOpen) setQueueOpen(false);
      else if (nowPlayingOpen) setNowPlayingOpen(false);
    },
  });

  const p = settings.personalization;
  const customBgUrl = useArtworkUrl(p.backgroundImageId);
  const { palette: trackPalette } = useDominantColor(currentTrack?.artworkId);

  const activeGradient =
    p.backgroundGradientId === 'custom'
      ? {
          from: p.customGradientFrom,
          to: p.customGradientTo,
          angle: p.customGradientAngle,
        }
      : STUDIO_GRADIENTS.find((g) => g.id === p.backgroundGradientId) || STUDIO_GRADIENTS[0];

  const desktopNav = useMemo(
    () =>
      BASE_DESKTOP_NAV.map((item) =>
        item.id === 'discover' ? { ...item, badge: unreadCount } : item
      ),
    [unreadCount]
  );

  const mobileNav = useMemo(
    () =>
      BASE_MOBILE_NAV.map((item) =>
        item.id === 'discover' ? { ...item, badge: unreadCount } : item
      ),
    [unreadCount]
  );

  const navItems =
    typeof window !== 'undefined' && window.innerWidth < 1024 ? mobileNav : desktopNav;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-x-hidden">
      {/* Personalized Dynamic Background Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-all duration-500"
      >
        {p.backgroundMode === 'image' && customBgUrl ? (
          <>
            <img
              src={customBgUrl}
              alt=""
              className="w-full h-full object-cover scale-105"
              style={{ filter: p.uiTheme === 'neo' ? `blur(${p.backgroundBlur}px)` : undefined }}
            />
            <div
              className="absolute inset-0 bg-[var(--neo-app-bg)]"
              style={{ opacity: p.backgroundDim / 100 }}
            />
          </>
        ) : p.backgroundMode === 'gradient' ? (
          <>
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(${activeGradient.angle}deg, ${activeGradient.from}, ${activeGradient.to})`,
              }}
            />
            <div
              className="absolute inset-0 bg-[var(--neo-app-bg)]/80 dark:bg-[var(--neo-app-bg)]/45"
            />
          </>
        ) : p.backgroundMode === 'artwork' && currentTrack ? (
          <div
            className="w-full h-full transition-all duration-700"
            style={{
              background: `
                radial-gradient(circle at 18% 18%, ${trackPalette.primary}, transparent 58%),
                radial-gradient(circle at 82% 82%, ${trackPalette.secondary}, transparent 60%)
              `,
            }}
          />
        ) : (
          <>
            <div
              className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[125px]"
              style={{ backgroundColor: 'var(--neo-accent-soft)' }}
            />
            <div
              className="absolute bottom-0 right-0 w-[460px] h-[460px] rounded-full blur-[125px]"
              style={{ backgroundColor: 'var(--neo-secondary-soft)' }}
            />
          </>
        )}
      </div>

      <GlassNavigation
        items={navItems}
        activeId={section}
        onSelect={(id) => handleNavigate(id)}
        headerSlot={
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#111216] dark:bg-white text-white dark:text-[#0A0B0F] flex items-center justify-center shadow-sm">
                <Disc3 className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight font-display whitespace-nowrap">
                Neo Player
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              aria-label="Open Radar notifications"
              className="relative min-h-[38px] min-w-[38px] rounded-xl liquid-glass-subtle flex items-center justify-center text-[#48484A] dark:text-[#AEAEB2] hover:text-[var(--neo-accent)] cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--neo-accent)] text-white text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        }
        footerSlot={
          <div className="space-y-3">
            <ThemeSwitcher compact />
            <PWAInstallButton variant="compact" />
          </div>
        }
      />

      {/* Main Content Workspace */}
      <main
        className={cn(
          'flex-1 min-w-0 px-4 sm:px-8 pt-5 sm:pt-7 max-w-7xl mx-auto w-full',
          currentTrack ? 'pb-40 lg:pb-28' : 'pb-24 lg:pb-12'
        )}
      >
        {/* Mobile Compact Brand & Quick Actions Bar */}
        <header className="lg:hidden flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#111216] dark:bg-white text-white dark:text-[#0A0B0F] flex items-center justify-center">
              <Disc3 className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight font-display whitespace-nowrap">
              Neo Player
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span
                className="inline-flex items-center gap-1 text-xs text-[#6E6E73] dark:text-[#98989D]"
                title="Offline Mode"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => handleNavigate('search')}
              aria-label="Search YouTube Music and library"
              className="min-h-[38px] min-w-[38px] rounded-xl liquid-glass-subtle flex items-center justify-center text-[#111216] dark:text-[#F5F5F7] cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              aria-label="Open Radar notifications"
              className="relative min-h-[38px] min-w-[38px] rounded-xl liquid-glass-subtle flex items-center justify-center text-[#111216] dark:text-[#F5F5F7] cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--neo-accent)] text-white text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <PWAInstallButton variant="compact" />
          </div>
        </header>

        {isLoading ? (
          <div className="py-24 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
            Loading local music library...
          </div>
        ) : (
          <>
            {section === 'home' && (
              <HomeView
                onNavigate={handleNavigate}
                onOpenPlaylist={handleOpenPlaylist}
                onCreatePlaylist={(moodId) => handleOpenCreatePlaylist({ moodId })}
                onOpenLyricsForTrack={handleOpenLyricsForTrack}
              />
            )}

            {section === 'library' && (
              <LibraryView
                key={libraryInitialTab}
                initialTab={libraryInitialTab}
                onOpenPlaylist={handleOpenPlaylist}
                onCreatePlaylist={(trackIds) => handleOpenCreatePlaylist({ trackIds })}
                onOpenLyricsForTrack={handleOpenLyricsForTrack}
              />
            )}

            {section === 'playlists' && (
              <PlaylistsView
                selectedPlaylistId={selectedPlaylistId}
                onSelectPlaylist={setSelectedPlaylistId}
                onCreatePlaylist={(moodId) => handleOpenCreatePlaylist({ moodId })}
                onOpenLyricsForTrack={handleOpenLyricsForTrack}
              />
            )}

            {section === 'youtube' && (
              <YouTubeView onOpenLyricsForTrack={handleOpenLyricsForTrack} />
            )}

            {section === 'discover' && (
              <DiscoverView onOpenPlaylist={handleOpenPlaylist} />
            )}

            {section === 'search' && (
              <SearchView
                onOpenPlaylist={handleOpenPlaylist}
                onOpenLyricsForTrack={handleOpenLyricsForTrack}
              />
            )}

            {section === 'lyrics' && <LyricsView focusedTrackId={focusedLyricsTrackId} />}

            {section === 'settings' && (
              <SettingsView onReplayIntro={() => setReplayingIntro(true)} />
            )}
          </>
        )}
      </main>

      <TuneInBar />
      <MiniPlayer />
      <NowPlayingScreen />
      <QueueDrawer />

      <IntroExperience
        open={showIntro}
        onComplete={() => {
          setReplayingIntro(false);
          if (!settings.hasSeenIntro) {
            void updateSettings({ hasSeenIntro: true });
          }
        }}
      />

      <CreatePlaylistModal
        open={createPlOpen}
        onOpenChange={setCreatePlOpen}
        defaultMoodId={createPlMood}
        initialTrackIds={createPlTracks}
        onCreated={(plId) => handleOpenPlaylist(plId)}
      />

      <GlassModal
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        title="Radar Notifications"
        description="Trending songs and latest releases from your followed and top artists"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D] py-4 text-center">
              No notifications yet. Open Radar to follow artists or sync trending charts.
            </p>
          ) : (
            notifications.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'p-3 rounded-2xl flex items-center justify-between gap-3 liquid-glass-subtle',
                  !alert.read && 'ring-1 ring-[var(--neo-accent)]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/8 dark:bg-white/10 shrink-0 flex items-center justify-center">
                    {alert.artworkUrl ? (
                      <img
                        src={alert.artworkUrl}
                        alt={alert.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : alert.type === 'trending' ? (
                      <Flame className="w-4 h-4 text-[var(--neo-accent)]" />
                    ) : (
                      <Radio className="w-4 h-4 text-[var(--neo-accent)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{alert.title}</p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                      {alert.message} · {formatRelativeDate(alert.createdAt)}
                    </p>
                  </div>
                </div>
                {alert.previewTrack && (
                  <GlassButton
                    size="sm"
                    variant="accent"
                    onClick={() => {
                      markNotificationRead(alert.id);
                      void playDiscoveryTrack(
                        alert.previewTrack!,
                        undefined,
                        alert.type === 'trending' ? 'Trending Alert' : `${alert.artist || 'Artist'} Alert`
                      );
                    }}
                  >
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    <span>Tune In</span>
                  </GlassButton>
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-4">
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <GlassButton size="sm" variant="ghost" onClick={markAllNotificationsRead}>
                Mark All Read
              </GlassButton>
            )}
          </div>
          <div className="flex gap-2">
            <GlassButton
              size="sm"
              variant="accent"
              onClick={() => {
                setAlertsOpen(false);
                handleNavigate('discover');
              }}
            >
              Open Radar
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
