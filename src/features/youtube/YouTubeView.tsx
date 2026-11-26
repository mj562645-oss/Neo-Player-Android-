import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  LogOut,
  Music2,
  Play,
  RefreshCw,
  Search,
  Users,
  X,
  Youtube,
} from 'lucide-react';
import { usePlayer } from '../../app/PlayerContext';
import { useYouTube } from '../../app/YouTubeContext';
import { formatTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { Track, YouTubePlaylistSummary, YouTubeSubscriptionItem } from '../../types/music';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { TrackRow } from '../../components/TrackRow';
import { YouTubeErrorBanner } from '../../components/YouTubeErrorBanner';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';

export type YouTubeSubTab = 'playlists' | 'liked' | 'channels' | 'search';

interface YouTubeViewProps {
  initialTab?: YouTubeSubTab;
  embedded?: boolean;
  onOpenLyricsForTrack?: (trackId: string) => void;
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  initialTab = 'playlists',
  embedded = false,
  onOpenLyricsForTrack,
}) => {
  const {
    user,
    isConnected,
    hasLiveToken,
    isRestoringSession,
    needsAuth,
    isLoggingIn,
    isLoadingLibrary,
    isLoadingTracks,
    isSearching,
    error,
    channel,
    playlists,
    likedTracks,
    subscriptions,
    playlistTracksMap,
    channelTracksMap,
    searchQuery,
    searchedQuery,
    searchResults,
    signIn,
    signOut,
    refreshAll,
    loadPlaylistTracks,
    loadChannelTracks,
    searchMusic,
    clearSearch,
    isYouTubeTrackLiked,
  } = useYouTube();

  const { currentTrack, isPlaying, playTrack, playNextInQueue, addToQueue, toggleTrackLike } =
    usePlayer();

  const [activeTab, setActiveTab] = useState<YouTubeSubTab>(initialTab);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylistSummary | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<YouTubeSubscriptionItem | null>(null);
  const [likedFilter, setLikedFilter] = useState('');
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    if (!isConnected || activeTab !== 'search') return;
    const trimmed = localSearch.trim();
    if (!trimmed) return;
    if (trimmed.length < 2 || trimmed === searchedQuery) return;

    const timer = window.setTimeout(() => {
      void searchMusic(trimmed);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isConnected, activeTab, localSearch, searchedQuery, searchMusic]);

  const filteredLikedTracks = useMemo(() => {
    const q = likedFilter.trim().toLowerCase();
    if (!q) return likedTracks;
    return likedTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
    );
  }, [likedTracks, likedFilter]);

  const handleOpenPlaylist = async (pl: YouTubePlaylistSummary) => {
    setSelectedPlaylist(pl);
    await loadPlaylistTracks(pl.id, pl.title);
  };

  const handleOpenChannel = async (sub: YouTubeSubscriptionItem) => {
    setSelectedChannel(sub);
    await loadChannelTracks(sub.channelId, sub.title);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void searchMusic(localSearch, true);
  };

  if (isRestoringSession && !isConnected) {
    return (
      <GlassCard className="p-10 flex items-center justify-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--neo-accent)]" />
        <span>Restoring your Google & YouTube Music session...</span>
      </GlassCard>
    );
  }

  // Unauthenticated sign-in screen (only shown when signed out / never connected)
  if (!isConnected || needsAuth) {
    return (
      <div className="space-y-6">
        {!embedded && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
              YouTube Music
            </h1>
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              Connect your Google account to stream playlists, liked songs, and subscribed channels
            </p>
          </div>
        )}

        <GlassCard elevated className="p-6 sm:p-10 max-w-2xl">
          <div className="flex flex-col items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#FF0000]/12 text-[#FF0000] dark:text-[#FF4E45] flex items-center justify-center">
              <Youtube className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-display">
                Connect YouTube & YouTube Music
              </h2>
              <p className="text-sm text-[#48484A] dark:text-[#AEAEB2] leading-relaxed">
                Sign in with Google once to keep your personal YouTube Music playlists, Liked Songs, and channel subscriptions synced inside Neo Player — complete with Mini Player controls, Queue, and synchronized Lyrics Overlay.
              </p>
            </div>

            {error && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <GoogleSignInButton
                onClick={() => void signIn(false)}
                loading={isLoggingIn}
                label="Sign in with Google"
              />
              {error && typeof window !== 'undefined' && window.self !== window.top && (
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-3 border-t border-black/8 dark:border-white/10">
              <div className="p-3 rounded-2xl liquid-glass-subtle">
                <ListMusic className="w-4 h-4 text-[var(--neo-accent)] mb-1.5" />
                <p className="text-xs font-semibold">Your Playlists</p>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                  Every playlist from YouTube & YT Music
                </p>
              </div>
              <div className="p-3 rounded-2xl liquid-glass-subtle">
                <Heart className="w-4 h-4 text-[var(--neo-accent)] mb-1.5" />
                <p className="text-xs font-semibold">Liked Music</p>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                  One-tap access to your thumbs-up tracks
                </p>
              </div>
              <div className="p-3 rounded-2xl liquid-glass-subtle">
                <Music2 className="w-4 h-4 text-[var(--neo-accent)] mb-1.5" />
                <p className="text-xs font-semibold">Synced Lyrics</p>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                  Works with Neo Player&apos;s LRC overlay
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Playlist detail sub-view
  if (selectedPlaylist) {
    const plTracks: Track[] = playlistTracksMap[selectedPlaylist.id] || [];
    const totalDur = plTracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <GlassButton size="sm" variant="ghost" onClick={() => setSelectedPlaylist(null)}>
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Playlists</span>
          </GlassButton>
          <GlassButton
            size="sm"
            onClick={() => void loadPlaylistTracks(selectedPlaylist.id, selectedPlaylist.title, true)}
            disabled={isLoadingTracks}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoadingTracks && 'animate-spin')} />
            <span>Refresh</span>
          </GlassButton>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <AlbumArtwork
            artworkUrl={selectedPlaylist.thumbnailUrl || plTracks[0]?.artworkUrl}
            alt={selectedPlaylist.title}
            fallbackSeed={selectedPlaylist.title}
            size="lg"
            rounded="2xl"
            className="w-40 h-40 sm:w-48 sm:h-48 shadow-xl"
          />
          <div className="space-y-2 min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#FF0000] dark:text-[#FF4E45]">
              YouTube Playlist
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-balance">
              {selectedPlaylist.title}
            </h2>
            {selectedPlaylist.description && (
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] line-clamp-2">
                {selectedPlaylist.description}
              </p>
            )}
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
              {plTracks.length} {plTracks.length === 1 ? 'track' : 'tracks'}
              {totalDur > 0 ? ` · ${formatTime(totalDur)}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <GlassButton
                variant="accent"
                disabled={plTracks.length === 0}
                onClick={() => void playTrack(plTracks[0], plTracks, selectedPlaylist.title)}
              >
                <Play className="w-4 h-4" fill="currentColor" />
                <span>Play All</span>
              </GlassButton>
              <GlassButton
                disabled={plTracks.length === 0}
                onClick={() => addToQueue(plTracks, selectedPlaylist.title)}
              >
                <ListPlus className="w-4 h-4" />
                <span>Add to Queue</span>
              </GlassButton>
            </div>
          </div>
        </div>

        {isLoadingTracks && plTracks.length === 0 ? (
          <GlassCard className="p-10 flex items-center justify-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--neo-accent)]" />
            <span>Loading YouTube playlist tracks...</span>
          </GlassCard>
        ) : plTracks.length === 0 ? (
          <GlassCard className="p-10 text-center space-y-3">
            <p className="text-base font-semibold">
              {!hasLiveToken
                ? 'Sync required to view this private playlist'
                : 'No playable tracks found in this playlist'}
            </p>
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D]">
              {!hasLiveToken
                ? 'Tap below to refresh your Google YouTube Music sync for private playlists.'
                : 'Private or deleted videos are skipped automatically.'}
            </p>
            {!hasLiveToken && (
              <div className="pt-1">
                <GlassButton
                  size="sm"
                  variant="accent"
                  disabled={isLoggingIn}
                  onClick={() =>
                    void signIn(false).then((ok) => {
                      if (ok) {
                        void loadPlaylistTracks(selectedPlaylist.id, selectedPlaylist.title, true);
                      }
                    })
                  }
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', isLoggingIn && 'animate-spin')} />
                  <span>Load Playlist</span>
                </GlassButton>
              </div>
            )}
          </GlassCard>
        ) : (
          <GlassCard className="p-2 sm:p-3">
            {plTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={{ ...track, isFavourite: isYouTubeTrackLiked(track.id, track.isFavourite) }}
                index={idx}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => void playTrack(track, plTracks, selectedPlaylist.title)}
                onToggleFavourite={() => void toggleTrackLike(track)}
                onPlayNext={() => playNextInQueue(track)}
                onAddToQueue={() => addToQueue(track)}
                onOpenLyrics={
                  onOpenLyricsForTrack ? () => onOpenLyricsForTrack(track.id) : undefined
                }
              />
            ))}
          </GlassCard>
        )}
      </div>
    );
  }

  // Subscribed Channel detail sub-view
  if (selectedChannel) {
    const chTracks: Track[] = channelTracksMap[selectedChannel.channelId] || [];
    return (
      <div className="space-y-6">
        <GlassButton size="sm" variant="ghost" onClick={() => setSelectedChannel(null)}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Channels</span>
        </GlassButton>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <AlbumArtwork
            artworkUrl={selectedChannel.thumbnailUrl}
            alt={selectedChannel.title}
            fallbackSeed={selectedChannel.title}
            size="lg"
            rounded="3xl"
            className="w-36 h-36 sm:w-44 sm:h-44 shadow-xl"
          />
          <div className="space-y-2 min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#FF0000] dark:text-[#FF4E45]">
              Subscribed Channel
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
              {selectedChannel.title}
            </h2>
            {selectedChannel.description && (
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] line-clamp-2 max-w-xl">
                {selectedChannel.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <GlassButton
                variant="accent"
                disabled={chTracks.length === 0}
                onClick={() => void playTrack(chTracks[0], chTracks, selectedChannel.title)}
              >
                <Play className="w-4 h-4" fill="currentColor" />
                <span>Play Uploads</span>
              </GlassButton>
              <GlassButton
                disabled={chTracks.length === 0}
                onClick={() => addToQueue(chTracks, selectedChannel.title)}
              >
                <ListPlus className="w-4 h-4" />
                <span>Add to Queue</span>
              </GlassButton>
            </div>
          </div>
        </div>

        {isLoadingTracks && chTracks.length === 0 ? (
          <GlassCard className="p-10 flex items-center justify-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--neo-accent)]" />
            <span>Loading uploads from {selectedChannel.title}...</span>
          </GlassCard>
        ) : chTracks.length === 0 ? (
          <GlassCard className="p-10 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
            No public uploads found for this channel.
          </GlassCard>
        ) : (
          <GlassCard className="p-2 sm:p-3">
            {chTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={{ ...track, isFavourite: isYouTubeTrackLiked(track.id, track.isFavourite) }}
                index={idx}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => void playTrack(track, chTracks, selectedChannel.title)}
                onToggleFavourite={() => void toggleTrackLike(track)}
                onPlayNext={() => playNextInQueue(track)}
                onAddToQueue={() => addToQueue(track)}
                onOpenLyrics={
                  onOpenLyricsForTrack ? () => onOpenLyricsForTrack(track.id) : undefined
                }
              />
            ))}
          </GlassCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Connected Account Card */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
              YouTube Music
            </h1>
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              Stream your YouTube playlists, liked music, and channels inside Neo Player
            </p>
          </div>
        </div>
      )}

      <GlassCard className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black/8 dark:bg-white/10 shrink-0 flex items-center justify-center">
            {channel?.thumbnailUrl || user?.photoURL ? (
              <img
                src={channel?.thumbnailUrl || user?.photoURL || ''}
                alt={channel?.title || user?.displayName || 'YouTube'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Youtube className="w-5 h-5 text-[#FF0000]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {channel?.title || user?.displayName || 'Connected YouTube Account'}
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate font-mono-tabular">
              {user?.email || 'Connected'} · {playlists.length} playlists · {likedTracks.length} liked
              {isRestoringSession && !hasLiveToken ? ' · Syncing...' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <GlassButton
            size="sm"
            disabled={isLoadingLibrary || isLoggingIn}
            onClick={() => void refreshAll()}
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', (isLoadingLibrary || isLoggingIn) && 'animate-spin')}
            />
            <span>{hasLiveToken ? 'Sync' : 'Sync Live'}</span>
          </GlassButton>
          <GlassButton
            size="sm"
            disabled={isLoggingIn}
            onClick={() => void signIn(true)}
          >
            <span>Switch Account</span>
          </GlassButton>
          <GlassButton size="sm" variant="ghost" onClick={() => void signOut()}>
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </GlassButton>
        </div>
      </GlassCard>

      <YouTubeErrorBanner />

      {/* Navigation Sub-tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {(
          [
            { id: 'playlists', label: `Playlists (${playlists.length})`, icon: ListMusic },
            { id: 'liked', label: `Liked Music (${likedTracks.length})`, icon: Heart },
            { id: 'channels', label: `Channels (${subscriptions.length})`, icon: Users },
            { id: 'search', label: 'Search YouTube', icon: Search },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'min-h-[40px] px-4 rounded-2xl text-sm font-medium whitespace-nowrap shrink-0 flex items-center gap-2 transition-all cursor-pointer',
                active
                  ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                  : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isLoadingLibrary && playlists.length === 0 && likedTracks.length === 0 ? (
        <GlassCard className="p-10 flex items-center justify-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--neo-accent)]" />
          <span>Syncing your YouTube Music library...</span>
        </GlassCard>
      ) : null}

      {/* Playlists Tab */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          {playlists.length === 0 && likedTracks.length === 0 && !isLoadingLibrary ? (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">No YouTube playlists found</p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                Create playlists on YouTube or YouTube Music, or try searching tracks in the Search tab.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {likedTracks.length > 0 && (
                <GlassCard
                  interactive
                  onClick={() => setActiveTab('liked')}
                  className="group p-3 flex flex-col gap-3"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF2D55]/30 via-[#5E5CE6]/25 to-[#FF9F0A]/25 flex items-center justify-center">
                    {likedTracks[0]?.artworkUrl ? (
                      <img
                        src={likedTracks[0].artworkUrl}
                        alt="Liked Music"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Heart className="w-10 h-10 text-[var(--neo-accent)]" fill="currentColor" />
                    )}
                    <button
                      type="button"
                      aria-label="Play Liked Music"
                      onClick={(e) => {
                        e.stopPropagation();
                        void playTrack(likedTracks[0], likedTracks, 'Liked Music');
                      }}
                      className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-white/90 dark:bg-[#1C1D24]/90 backdrop-blur-md text-[#111216] dark:text-white shadow-lg flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                    </button>
                  </div>
                  <div className="min-w-0 px-0.5">
                    <h3 className="text-sm font-semibold truncate">Liked Music</h3>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5 font-mono-tabular">
                      {likedTracks.length} {likedTracks.length === 1 ? 'track' : 'tracks'}
                    </p>
                  </div>
                </GlassCard>
              )}

              {playlists.map((pl) => (
                <GlassCard
                  key={pl.id}
                  interactive
                  onClick={() => void handleOpenPlaylist(pl)}
                  className="group p-3 flex flex-col gap-3"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
                    <AlbumArtwork
                      artworkUrl={pl.thumbnailUrl}
                      alt={pl.title}
                      fallbackSeed={pl.title}
                      size="fill"
                      rounded="xl"
                    />
                  </div>
                  <div className="min-w-0 px-0.5">
                    <h3 className="text-sm font-semibold truncate">{pl.title}</h3>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5 font-mono-tabular">
                      {pl.itemCount} {pl.itemCount === 1 ? 'track' : 'tracks'}
                      {pl.privacyStatus ? ` · ${pl.privacyStatus}` : ''}
                    </p>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Liked Music Tab */}
      {activeTab === 'liked' && (
        <div className="space-y-4">
          {likedTracks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={likedFilter}
                  onChange={(e) => setLikedFilter(e.target.value)}
                  placeholder="Filter liked songs..."
                  className="w-full min-h-[42px] pl-10 pr-4 rounded-2xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <GlassButton
                  size="sm"
                  variant="accent"
                  onClick={() =>
                    filteredLikedTracks.length > 0 &&
                    void playTrack(filteredLikedTracks[0], filteredLikedTracks, 'Liked Music')
                  }
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                  <span>Play All</span>
                </GlassButton>
                <GlassButton
                  size="sm"
                  onClick={() => addToQueue(filteredLikedTracks, 'Liked Music')}
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Queue All</span>
                </GlassButton>
              </div>
            </div>
          )}

          {filteredLikedTracks.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">
                {likedTracks.length === 0
                  ? 'No liked music found yet'
                  : 'No liked songs match your filter'}
              </p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                Songs you like on YouTube Music or YouTube will appear here.
              </p>
            </GlassCard>
          ) : (
            <GlassCard className="p-2 sm:p-3">
              {filteredLikedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={{ ...track, isFavourite: isYouTubeTrackLiked(track.id, true) }}
                  index={idx}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={() => void playTrack(track, filteredLikedTracks, 'Liked Music')}
                  onToggleFavourite={() => void toggleTrackLike(track)}
                  onPlayNext={() => playNextInQueue(track)}
                  onAddToQueue={() => addToQueue(track)}
                  onOpenLyrics={
                    onOpenLyricsForTrack ? () => onOpenLyricsForTrack(track.id) : undefined
                  }
                />
              ))}
            </GlassCard>
          )}
        </div>
      )}

      {/* Subscribed Channels / Library Tab */}
      {activeTab === 'channels' && (
        <div>
          {subscriptions.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">No channel subscriptions found</p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                Artists and channels you subscribe to on YouTube appear here for quick playback.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {subscriptions.map((sub) => (
                <GlassCard
                  key={sub.id}
                  interactive
                  onClick={() => void handleOpenChannel(sub)}
                  className="p-3 flex flex-col gap-2.5 text-center"
                >
                  <div className="aspect-square w-full">
                    <AlbumArtwork
                      artworkUrl={sub.thumbnailUrl}
                      alt={sub.title}
                      fallbackSeed={sub.title}
                      size="fill"
                      rounded="3xl"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{sub.title}</p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                      YouTube Channel
                    </p>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search YouTube Music Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={localSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalSearch(val);
                  if (!val.trim()) clearSearch();
                }}
                placeholder="Search songs, artists, or albums on YouTube Music..."
                className="w-full min-h-[44px] pl-10 pr-10 rounded-2xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch('');
                    clearSearch();
                  }}
                  aria-label="Clear YouTube search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] rounded-full flex items-center justify-center text-[#8E8E93] hover:text-[#111216] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <GlassButton type="submit" variant="accent" disabled={isSearching || !localSearch.trim()}>
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Search</span>
            </GlassButton>
          </form>

          {isSearching ? (
            <GlassCard className="p-10 flex items-center justify-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--neo-accent)]" />
              <span>Searching YouTube Music...</span>
            </GlassCard>
          ) : searchResults.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">Search YouTube Music</p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                Enter any song title or artist to stream directly inside Neo Player.
              </p>
            </GlassCard>
          ) : (
            <GlassCard className="p-2 sm:p-3">
              {searchResults.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={{ ...track, isFavourite: isYouTubeTrackLiked(track.id, track.isFavourite) }}
                  index={idx}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={() => void playTrack(track, searchResults, 'YouTube Search')}
                  onToggleFavourite={() => void toggleTrackLike(track)}
                  onPlayNext={() => playNextInQueue(track)}
                  onAddToQueue={() => addToQueue(track)}
                  onOpenLyrics={
                    onOpenLyricsForTrack ? () => onOpenLyricsForTrack(track.id) : undefined
                  }
                />
              ))}
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
};
