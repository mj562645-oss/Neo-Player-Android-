import React, { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Disc3,
  ExternalLink,
  Flame,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { useDiscovery } from '../../app/DiscoveryContext';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useToast } from '../../app/ToastContext';
import { CHART_COUNTRIES } from '../../lib/countries';
import { formatRelativeDate, formatTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import { findLocalLibraryMatch } from '../../services/discoveryService';
import { buildSmartPlaylistDrafts } from '../../services/smartPlaylistService';
import type { ArtistRadarResult, DiscoveryTrackItem, SmartPlaylistDraft } from '../../types/music';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';

interface DiscoverViewProps {
  onOpenPlaylist: (playlistId: string) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onOpenPlaylist }) => {
  const { tracks, playlists, upsertSmartPlaylist, generateSmartMixes } = useLibrary();
  const { currentTrack, isPlaying } = usePlayer();
  const { settings, isArtistFollowed, toggleFollowArtist, updateSettings } = useTheme();
  const { showToast } = useToast();
  const {
    trendingTracks,
    trendingSource,
    artistUpdates,
    trackedArtists,
    notifications,
    unreadCount,
    isSyncing,
    lastSyncedAt,
    syncError,
    previewState,
    refreshRadar,
    tuneInToArtist,
    tuneInToTrending,
    playDiscoveryTrack,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    requestOsNotificationPermission,
  } = useDiscovery();

  const [followInput, setFollowInput] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'mixes' | 'artists' | 'trending'>('all');

  const smartDrafts = useMemo(
    () =>
      buildSmartPlaylistDrafts(
        tracks,
        settings.followedArtists || [],
        settings.moodCategories || []
      ),
    [tracks, settings.followedArtists, settings.moodCategories]
  );

  const playlistBySmartKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const pl of playlists) {
      if (pl.smartKey) map.set(pl.smartKey, pl.id);
    }
    return map;
  }, [playlists]);

  const handleFollowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = followInput.trim();
    if (!clean) return;
    if (!isArtistFollowed(clean)) {
      await toggleFollowArtist(clean);
      showToast(`Following ${clean} — refreshing artist radar`, 'success');
    } else {
      showToast(`Already following ${clean}`, 'info');
    }
    setFollowInput('');
    void refreshRadar({ silent: true });
  };

  const handleCreateOrOpenMix = async (draft: SmartPlaylistDraft) => {
    const saved = await upsertSmartPlaylist(draft);
    onOpenPlaylist(saved.id);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
            Radar & Auto-Mixes
          </h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Tailored library playlists, trending charts, and releases from artists you love
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Chart region"
            value={settings.discoveryCountry || 'us'}
            onChange={(e) => {
              void updateSettings({ discoveryCountry: e.target.value }).then(() =>
                refreshRadar({ silent: true })
              );
            }}
            className="min-h-[40px] max-w-[230px] px-3 rounded-2xl liquid-glass-subtle text-xs font-medium text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)] cursor-pointer"
          >
            {CHART_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                Region: {c.name} ({c.code.toUpperCase()})
              </option>
            ))}
          </select>

          <GlassButton
            size="sm"
            onClick={() => void refreshRadar()}
            disabled={isSyncing}
            className="min-h-[40px]"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{isSyncing ? 'Syncing...' : 'Refresh Radar'}</span>
          </GlassButton>

          <GlassButton
            size="sm"
            variant="accent"
            onClick={() => void tuneInToTrending()}
            className="min-h-[40px]"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Tune In Charts</span>
          </GlassButton>
        </div>
      </div>

      {/* Section Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {(
          [
            { id: 'all', label: 'Everything' },
            { id: 'mixes', label: 'Made For You' },
            { id: 'artists', label: 'Favourite Artists' },
            { id: 'trending', label: 'Trending Songs' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'min-h-[40px] px-4 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer',
              activeTab === tab.id
                ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Radar Notifications Inbox */}
      {(activeTab === 'all' || notifications.length > 0) && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--neo-accent)]" />
              <h2 className="text-lg font-bold tracking-tight font-display">
                Radar Alerts
              </h2>
              {unreadCount > 0 && (
                <span className="text-xs font-mono-tabular text-[var(--neo-accent)] font-semibold">
                  · {unreadCount} unread
                </span>
              )}
              {lastSyncedAt && (
                <span className="text-xs text-[#6E6E73] dark:text-[#98989D] hidden sm:inline">
                  · Updated {formatRelativeDate(lastSyncedAt)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!settings.osNotificationsEnabled && (
                <GlassButton
                  size="sm"
                  onClick={() => {
                    void requestOsNotificationPermission().then((granted) => {
                      if (granted) void updateSettings({ osNotificationsEnabled: true });
                    });
                  }}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable Device Alerts</span>
                </GlassButton>
              )}
              {unreadCount > 0 && (
                <GlassButton size="sm" onClick={markAllNotificationsRead}>
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark Read</span>
                </GlassButton>
              )}
              {notifications.length > 0 && (
                <GlassButton size="sm" variant="ghost" onClick={clearNotifications}>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </GlassButton>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <GlassCard className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">No alerts yet</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                  Follow your favourite artists or refresh the radar to receive alerts when songs trend or new releases arrive.
                </p>
              </div>
              <GlassButton size="sm" onClick={() => void refreshRadar()}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Now</span>
              </GlassButton>
            </GlassCard>
          ) : (
            <GlassCard className="divide-y divide-black/6 dark:divide-white/8">
              {notifications.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'p-3.5 sm:px-5 flex items-center justify-between gap-3 transition-colors',
                    !alert.read && 'bg-[var(--neo-accent-soft)]/35'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-black/8 dark:bg-white/10 shrink-0 flex items-center justify-center">
                      {alert.artworkUrl ? (
                        <img
                          src={alert.artworkUrl}
                          alt={alert.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : alert.type === 'trending' ? (
                        <Flame className="w-5 h-5 text-[var(--neo-accent)]" />
                      ) : (
                        <Radio className="w-5 h-5 text-[var(--neo-accent)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{alert.title}</p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                        {alert.message} · {formatRelativeDate(alert.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
                    {!alert.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(alert.id)}
                        aria-label="Mark alert as read"
                        className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </section>
      )}

      {/* Made For You — Smart Playlists */}
      {(activeTab === 'all' || activeTab === 'mixes') && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display">
                Playlists Made For You
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                Generated automatically from your plays, favourites, genres, and followed artists
              </p>
            </div>
            {smartDrafts.length > 0 && (
              <GlassButton
                size="sm"
                variant="accent"
                onClick={() => void generateSmartMixes(smartDrafts)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create All {smartDrafts.length} Mixes</span>
              </GlassButton>
            )}
          </div>

          {smartDrafts.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="text-sm font-semibold">Import music to unlock personalized mixes</p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-1">
                Once songs are in your library, Neo Player automatically compiles Heavy Rotation, Hidden Gems, Favourites Mix, and Artist Spotlight playlists.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {smartDrafts.map((draft) => {
                const existingId = playlistBySmartKey.get(draft.smartKey);
                return (
                  <GlassCard
                    key={draft.smartKey}
                    className="p-5 flex flex-col justify-between gap-4 relative overflow-hidden"
                    style={{
                      backgroundImage: `radial-gradient(circle at 92% 10%, ${draft.accentColor}24, transparent 62%)`,
                    }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
                          {draft.trackIds.length} {draft.trackIds.length === 1 ? 'track' : 'tracks'}
                        </span>
                        <ListMusic className="w-4 h-4 text-[#8E8E93]" />
                      </div>
                      <h3 className="text-base font-bold font-display">{draft.name}</h3>
                      <p className="text-xs text-[#48484A] dark:text-[#AEAEB2] leading-relaxed">
                        {draft.description}
                      </p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] pt-1">
                        {draft.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <GlassButton
                        size="sm"
                        variant="accent"
                        onClick={() => void handleCreateOrOpenMix(draft)}
                        className="flex-1"
                      >
                        {existingId ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Refresh & Open</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create Playlist</span>
                          </>
                        )}
                      </GlassButton>
                      {existingId && (
                        <GlassButton size="sm" onClick={() => onOpenPlaylist(existingId)}>
                          <span>Open</span>
                        </GlassButton>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Favourite Artists Radar & Tune-In */}
      {(activeTab === 'all' || activeTab === 'artists') && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display">
                Favourite Artists & Tune In
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                Follow artists to get release alerts and launch instant radio preview stations
              </p>
            </div>
          </div>

          {/* Add / Follow Artist Bar */}
          <form onSubmit={handleFollowSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={followInput}
              onChange={(e) => setFollowInput(e.target.value)}
              placeholder="Follow an artist (e.g. Daft Punk, The Weeknd, Billie Eilish)..."
              className="flex-1 min-w-[220px] min-h-[42px] px-4 rounded-2xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
            />
            <GlassButton type="submit" variant="accent" className="min-h-[42px]">
              <UserPlus className="w-4 h-4" />
              <span>Follow Artist</span>
            </GlassButton>
          </form>

          {/* Followed + Library Detected Artists Strip */}
          {trackedArtists.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {trackedArtists.map((artist) => {
                const explicitlyFollowed = isArtistFollowed(artist);
                return (
                  <div
                    key={artist}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-2xl liquid-glass-subtle text-xs font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => void tuneInToArtist(artist)}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--neo-accent)] transition-colors cursor-pointer min-h-[32px]"
                      title={`Tune into ${artist} radio`}
                    >
                      <Radio className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                      <span>{artist}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void toggleFollowArtist(artist).then((followed) => {
                          showToast(
                            followed ? `Following ${artist}` : `Unfollowed ${artist}`,
                            'info'
                          );
                        });
                      }}
                      aria-label={explicitlyFollowed ? `Unfollow ${artist}` : `Follow ${artist}`}
                      title={explicitlyFollowed ? 'Following (tap to unfollow)' : 'Library artist (tap to pin follow)'}
                      className="min-h-[30px] min-w-[30px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white cursor-pointer"
                    >
                      {explicitlyFollowed ? (
                        <UserCheck className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {artistUpdates.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="text-sm font-semibold">
                {isSyncing ? 'Checking your favourite artists...' : 'Follow an artist above to tune in'}
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-1">
                Neo Player automatically surfaces latest singles, albums, and 30-second playable radio previews.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {artistUpdates.map((ar) => (
                <ArtistRadarCard
                  key={ar.artistName}
                  radar={ar}
                  isFollowed={isArtistFollowed(ar.artistName)}
                  activePreviewId={previewState.currentTrack?.id}
                  previewPlaying={previewState.isPlaying}
                  onToggleFollow={() => {
                    void toggleFollowArtist(ar.artistName).then((followed) => {
                      showToast(
                        followed ? `Following ${ar.artistName}` : `Unfollowed ${ar.artistName}`,
                        'info'
                      );
                    });
                  }}
                  onTuneIn={() => void tuneInToArtist(ar.artistName)}
                  onPlayItem={(item) =>
                    void playDiscoveryTrack(item, ar.topTracks, `${ar.artistName} Radio`)
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Trending Charts Now */}
      {(activeTab === 'all' || activeTab === 'trending') && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display">
                Trending Songs Now
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                {trendingSource} · Tap any song to play full local copy if owned, or listen to a 30s preview
              </p>
            </div>
            {trendingTracks.length > 0 && (
              <GlassButton size="sm" onClick={() => void tuneInToTrending()}>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Play Charts Radio</span>
              </GlassButton>
            )}
          </div>

          {syncError && trendingTracks.length === 0 ? (
            <GlassCard className="p-6 text-center space-y-3">
              <p className="text-sm font-semibold">Unable to load live charts</p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">{syncError}</p>
              <GlassButton size="sm" onClick={() => void refreshRadar()}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </GlassButton>
            </GlassCard>
          ) : trendingTracks.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--neo-accent)] mb-2" />
              <p className="text-sm font-medium">Fetching trending charts...</p>
            </GlassCard>
          ) : (
            <GlassCard className="divide-y divide-black/6 dark:divide-white/8">
              {trendingTracks.map((item, idx) => {
                const localMatch = findLocalLibraryMatch(item, tracks);
                const isPreviewActive =
                  previewState.currentTrack?.id === item.id && previewState.isPlaying;
                const isLocalActive =
                  Boolean(localMatch && currentTrack?.id === localMatch.id && isPlaying);
                const activeNow = isPreviewActive || isLocalActive;

                return (
                  <div
                    key={item.id}
                    className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-7 text-center text-xs font-mono-tabular font-semibold text-[#6E6E73] dark:text-[#98989D] shrink-0">
                        {String(item.rank ?? idx + 1).padStart(2, '0')}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          void playDiscoveryTrack(item, trendingTracks, 'Trending Charts')
                        }
                        aria-label={`Play ${item.title} by ${item.artist}`}
                        className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/8 dark:bg-white/10 shrink-0 group cursor-pointer"
                      >
                        {item.artworkUrl ? (
                          <img
                            src={item.artworkUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Disc3 className="w-5 h-5 text-[#8E8E93]" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'absolute inset-0 bg-black/45 flex items-center justify-center text-white transition-opacity',
                            activeNow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                        >
                          {activeNow ? (
                            <Pause className="w-4 h-4" fill="currentColor" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                          )}
                        </div>
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-semibold truncate',
                            activeNow && 'text-[var(--neo-accent)]'
                          )}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                          <span>{item.artist}</span>
                          {item.genre && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{item.genre}</span>
                            </>
                          )}
                          <span aria-hidden="true"> · </span>
                          <span>{localMatch ? 'In Your Library (Full)' : '30s Preview'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          void toggleFollowArtist(item.artist).then((followed) => {
                            showToast(
                              followed ? `Following ${item.artist}` : `Unfollowed ${item.artist}`,
                              'info'
                            );
                          });
                        }}
                        aria-label={
                          isArtistFollowed(item.artist)
                            ? `Unfollow ${item.artist}`
                            : `Follow ${item.artist}`
                        }
                        title={
                          isArtistFollowed(item.artist) ? 'Following artist' : 'Follow artist'
                        }
                        className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-[var(--neo-accent)] cursor-pointer"
                      >
                        {isArtistFollowed(item.artist) ? (
                          <UserCheck className="w-4 h-4 text-[var(--neo-accent)]" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                      </button>

                      <GlassButton
                        size="sm"
                        variant={activeNow ? 'accent' : 'glass'}
                        onClick={() =>
                          void playDiscoveryTrack(item, trendingTracks, 'Trending Charts')
                        }
                      >
                        {activeNow ? (
                          <Pause className="w-3.5 h-3.5" fill="currentColor" />
                        ) : (
                          <Play className="w-3.5 h-3.5" fill="currentColor" />
                        )}
                        <span className="hidden sm:inline">
                          {localMatch ? 'Play' : 'Preview'}
                        </span>
                      </GlassButton>

                      {item.externalUrl && (
                        <a
                          href={item.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${item.title} externally`}
                          className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </GlassCard>
          )}
        </section>
      )}
    </div>
  );
};

const ArtistRadarCard: React.FC<{
  radar: ArtistRadarResult;
  isFollowed: boolean;
  activePreviewId?: string;
  previewPlaying: boolean;
  onToggleFollow: () => void;
  onTuneIn: () => void;
  onPlayItem: (item: DiscoveryTrackItem) => void;
}> = ({
  radar,
  isFollowed,
  activePreviewId,
  previewPlaying,
  onToggleFollow,
  onTuneIn,
  onPlayItem,
}) => {
  const releaseLabel = radar.latestRelease?.releaseDate
    ? new Date(radar.latestRelease.releaseDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/8 dark:bg-white/10 shrink-0 flex items-center justify-center shadow-sm">
            {radar.artworkUrl ? (
              <img
                src={radar.artworkUrl}
                alt={radar.artistName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Radio className="w-6 h-6 text-[var(--neo-accent)]" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold font-display truncate">{radar.artistName}</h3>
            {radar.latestRelease ? (
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                Latest: {radar.latestRelease.title}
                {releaseLabel ? ` · ${releaseLabel}` : ''}
              </p>
            ) : (
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                Artist Radio Station
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleFollow}
            aria-label={isFollowed ? `Unfollow ${radar.artistName}` : `Follow ${radar.artistName}`}
            className="min-h-[38px] min-w-[38px] rounded-xl liquid-glass-subtle flex items-center justify-center text-[#48484A] dark:text-[#AEAEB2] hover:text-[var(--neo-accent)] cursor-pointer"
          >
            {isFollowed ? (
              <UserCheck className="w-4 h-4 text-[var(--neo-accent)]" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
          </button>
          <GlassButton size="sm" variant="accent" onClick={onTuneIn}>
            <Radio className="w-3.5 h-3.5" />
            <span>Tune In</span>
          </GlassButton>
        </div>
      </div>

      {radar.topTracks.length > 0 && (
        <div className="divide-y divide-black/6 dark:divide-white/8 border-t border-black/8 dark:border-white/10 pt-2">
          {radar.topTracks.slice(0, 3).map((t) => {
            const active = activePreviewId === t.id && previewPlaying;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPlayItem(t)}
                className="w-full py-2.5 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      active && 'text-[var(--neo-accent)] font-semibold'
                    )}
                  >
                    {t.title}
                  </p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                    {t.album}
                    {t.durationSec ? ` · ${formatTime(t.durationSec)}` : ''}
                  </p>
                </div>
                <span className="min-h-[32px] min-w-[32px] rounded-full liquid-glass-subtle flex items-center justify-center text-[#111216] dark:text-[#F5F5F7] shrink-0">
                  {active ? (
                    <Pause className="w-3.5 h-3.5" fill="currentColor" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};
