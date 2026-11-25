import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  Play,
  Search,
  Tag,
  User,
  X,
  Youtube,
} from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useYouTube } from '../../app/YouTubeContext';
import { cn } from '../../lib/utils';
import type { Track } from '../../types/music';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { PlaylistCard } from '../../components/PlaylistCard';
import { TrackRow } from '../../components/TrackRow';
import { YouTubeErrorBanner } from '../../components/YouTubeErrorBanner';

type SearchScope = 'all' | 'youtube' | 'local';

interface SearchViewProps {
  onOpenPlaylist: (playlistId: string) => void;
  onOpenLyricsForTrack: (trackId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onOpenPlaylist,
  onOpenLyricsForTrack,
}) => {
  const { tracks, albums, artists, playlists, toggleFavourite, addTracksToPlaylist, deleteTracks } =
    useLibrary();
  const { currentTrack, isPlaying, playTrack, playNextInQueue, addToQueue, toggleTrackLike } =
    usePlayer();
  const { settings } = useTheme();
  const {
    user,
    isConnected: ytConnected,
    isLoggingIn: ytLoggingIn,
    isSearching: ytSearching,
    error: ytError,
    likedTracks: ytLikedTracks,
    playlists: ytPlaylists,
    searchQuery: ytStoredQuery,
    searchedQuery: ytSearchedQuery,
    searchResults: ytResults,
    signIn: ytSignIn,
    loadPlaylistTracks,
    searchMusic: searchYouTube,
    clearSearch: clearYouTubeSearch,
    isYouTubeTrackLiked,
  } = useYouTube();

  const [query, setQuery] = useState(() => ytStoredQuery || '');
  const [scope, setScope] = useState<SearchScope>('all');
  const pendingQueryAfterAuthRef = useRef<string | null>(null);

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const includeYouTube = scope !== 'local';
  const includeLocal = scope !== 'youtube';

  // Auto-search YouTube Music after a brief pause while typing
  useEffect(() => {
    if (!includeYouTube || !ytConnected) return;
    if (trimmed.length === 0) {
      if (ytStoredQuery || ytResults.length > 0) {
        clearYouTubeSearch();
      }
      return;
    }
    if (trimmed.length < 2 || trimmed === ytSearchedQuery) return;

    const timer = window.setTimeout(() => {
      void searchYouTube(trimmed);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    trimmed,
    includeYouTube,
    ytConnected,
    ytStoredQuery,
    ytSearchedQuery,
    ytResults.length,
    searchYouTube,
    clearYouTubeSearch,
  ]);

  // Run pending search immediately after connecting Google / YouTube
  useEffect(() => {
    if (!ytConnected || !pendingQueryAfterAuthRef.current) return;
    const pending = pendingQueryAfterAuthRef.current;
    pendingQueryAfterAuthRef.current = null;
    void searchYouTube(pending, true);
  }, [ytConnected, searchYouTube]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (includeYouTube) {
      if (ytConnected) {
        await searchYouTube(trimmed, true);
      } else {
        pendingQueryAfterAuthRef.current = trimmed;
        await ytSignIn(false);
      }
    }
  };

  // Match synced YouTube Liked Songs locally-in-memory for instant hits
  const matchingYouTubeLiked = useMemo(() => {
    if (!ytConnected || !includeYouTube || !q) return [];
    const resultIds = new Set(ytResults.map((t) => t.id));
    return ytLikedTracks.filter(
      (t) =>
        !resultIds.has(t.id) &&
        (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    );
  }, [ytConnected, includeYouTube, q, ytLikedTracks, ytResults]);

  const matchingYouTubePlaylists = useMemo(() => {
    if (!ytConnected || !includeYouTube || !q) return [];
    return ytPlaylists.filter(
      (pl) =>
        pl.title.toLowerCase().includes(q) ||
        (pl.description || '').toLowerCase().includes(q)
    );
  }, [ytConnected, includeYouTube, q, ytPlaylists]);

  const matchingSongs = useMemo(() => {
    if (!includeLocal || !q) return [];
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [includeLocal, tracks, q]);

  const matchingArtists = useMemo(() => {
    if (!includeLocal || !q) return [];
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [includeLocal, artists, q]);

  const matchingAlbums = useMemo(() => {
    if (!includeLocal || !q) return [];
    return albums.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [includeLocal, albums, q]);

  const matchingPlaylists = useMemo(() => {
    if (!includeLocal || !q) return [];
    return playlists.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [includeLocal, playlists, q]);

  const allGenres = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      const g = t.genre && t.genre !== 'Unclassified' ? t.genre : 'Other';
      const arr = map.get(g) || [];
      arr.push(t);
      map.set(g, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [tracks]);

  const matchingGenres = useMemo(() => {
    if (!includeLocal) return [];
    if (!q) return allGenres;
    return allGenres.filter(([genre]) => genre.toLowerCase().includes(q));
  }, [includeLocal, allGenres, q]);

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const moodById = useMemo(
    () => new Map(settings.moodCategories.map((m) => [m.id, m])),
    [settings.moodCategories]
  );

  const visibleYtCatalog =
    ytConnected && includeYouTube && q ? ytResults : [];

  const hasAnyResults =
    visibleYtCatalog.length > 0 ||
    matchingYouTubeLiked.length > 0 ||
    matchingYouTubePlaylists.length > 0 ||
    matchingSongs.length > 0 ||
    matchingArtists.length > 0 ||
    matchingAlbums.length > 0 ||
    matchingPlaylists.length > 0 ||
    (Boolean(q) && matchingGenres.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Search</h1>
        <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
          Search YouTube Music online alongside your offline library
        </p>
      </div>

      {/* Main Search Bar */}
      <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-[#8E8E93] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (!next.trim()) {
                clearYouTubeSearch();
              }
            }}
            placeholder="Search YouTube Music, songs, artists, albums..."
            className="w-full min-h-[50px] pl-12 pr-11 rounded-2xl liquid-glass text-base text-[#111216] dark:text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                clearYouTubeSearch();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-[#8E8E93] hover:text-[#111216] dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <GlassButton
          type="submit"
          variant="accent"
          disabled={!trimmed || ytSearching}
          className="min-h-[50px] px-4 sm:px-5 rounded-2xl shrink-0"
        >
          {ytSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : includeYouTube ? (
            <Youtube className="w-4 h-4" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {ytSearching ? 'Searching...' : 'Search'}
          </span>
        </GlassButton>
      </form>

      {/* Search Scope Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-subtle">
          {(
            [
              { id: 'all', label: 'All Sources' },
              { id: 'youtube', label: 'YouTube Music' },
              { id: 'local', label: `Local (${tracks.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={cn(
                'min-h-[36px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                scope === item.id
                  ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white'
              )}
            >
              {item.id === 'youtube' && <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {ytConnected && includeYouTube && trimmed && (
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
            {ytSearching
              ? `Searching YouTube Music for "${trimmed}"...`
              : `${visibleYtCatalog.length} YouTube Music ${visibleYtCatalog.length === 1 ? 'result' : 'results'}`}
          </p>
        )}
      </div>

      {/* Connect Prompt when YouTube Music is selected/enabled but not yet signed in */}
      {includeYouTube && !ytConnected && (
        <GlassCard className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FF0000]/12 text-[#FF0000] dark:text-[#FF4E45] flex items-center justify-center shrink-0">
              <Youtube className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {user
                  ? 'Reconnect Google to search YouTube Music'
                  : 'Connect Google to search YouTube Music'}
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                {trimmed
                  ? `Sign in to instantly search YouTube Music for "${trimmed}" and stream full tracks.`
                  : 'Search and stream songs, artists, and music videos directly from YouTube Music.'}
              </p>
              {ytError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{ytError}</p>
              )}
            </div>
          </div>
          <GoogleSignInButton
            onClick={() => {
              if (trimmed) pendingQueryAfterAuthRef.current = trimmed;
              void ytSignIn(false);
            }}
            loading={ytLoggingIn}
            label="Sign in with Google"
          />
        </GlassCard>
      )}

      {includeYouTube && ytConnected && <YouTubeErrorBanner />}

      {/* Active Query Results */}
      {q ? (
        <div className="space-y-7">
          {/* Live YouTube Music Search Loading / Results */}
          {ytConnected && includeYouTube && ytSearching && visibleYtCatalog.length === 0 && (
            <GlassCard className="p-8 flex items-center justify-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--neo-accent)]" />
              <span>Searching YouTube Music for &ldquo;{trimmed}&rdquo;...</span>
            </GlassCard>
          )}

          {visibleYtCatalog.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold font-display flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-[#FF0000]" />
                  <span>YouTube Music Results</span>
                </h2>
                <div className="flex items-center gap-2">
                  <GlassButton
                    size="sm"
                    variant="accent"
                    onClick={() =>
                      void playTrack(visibleYtCatalog[0], visibleYtCatalog, `YouTube: ${trimmed}`)
                    }
                  >
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    <span>Play All</span>
                  </GlassButton>
                  <GlassButton
                    size="sm"
                    onClick={() => addToQueue(visibleYtCatalog, `YouTube: ${trimmed}`)}
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    <span>Queue</span>
                  </GlassButton>
                </div>
              </div>
              <GlassCard className="p-2">
                {visibleYtCatalog.slice(0, 16).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={{
                      ...track,
                      isFavourite: isYouTubeTrackLiked(track.id, track.isFavourite),
                    }}
                    index={idx}
                    isCurrent={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    onPlay={() => void playTrack(track, visibleYtCatalog, `YouTube: ${trimmed}`)}
                    onToggleFavourite={() => void toggleTrackLike(track)}
                    onPlayNext={() => playNextInQueue(track)}
                    onAddToQueue={() => addToQueue(track)}
                    onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
                  />
                ))}
              </GlassCard>
            </section>
          )}

          {matchingYouTubeLiked.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#FF2D55]" fill="currentColor" />
                <span>In Your YouTube Liked Music</span>
              </h2>
              <GlassCard className="p-2">
                {matchingYouTubeLiked.slice(0, 8).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={{ ...track, isFavourite: isYouTubeTrackLiked(track.id, true) }}
                    index={idx}
                    isCurrent={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    onPlay={() => void playTrack(track, matchingYouTubeLiked, 'Liked Music')}
                    onToggleFavourite={() => void toggleTrackLike(track)}
                    onPlayNext={() => playNextInQueue(track)}
                    onAddToQueue={() => addToQueue(track)}
                    onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
                  />
                ))}
              </GlassCard>
            </section>
          )}

          {matchingYouTubePlaylists.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-[#FF0000]" />
                <span>Matching YouTube Playlists</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {matchingYouTubePlaylists.slice(0, 8).map((pl) => (
                  <GlassCard
                    key={pl.id}
                    interactive
                    onClick={() =>
                      void loadPlaylistTracks(pl.id, pl.title).then((items) => {
                        if (items.length > 0) {
                          void playTrack(items[0], items, pl.title);
                        }
                      })
                    }
                    className="p-3 flex items-center gap-3"
                  >
                    <AlbumArtwork
                      artworkUrl={pl.thumbnailUrl}
                      alt={pl.title}
                      fallbackSeed={pl.title}
                      size="sm"
                      rounded="lg"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{pl.title}</p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
                        {pl.itemCount} {pl.itemCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}

          {matchingSongs.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display">Local Songs</h2>
              <GlassCard className="p-2">
                {matchingSongs.slice(0, 12).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    isCurrent={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    playlists={playlists}
                    onPlay={() => void playTrack(track, matchingSongs, 'Search Results')}
                    onToggleFavourite={() => void toggleFavourite(track.id)}
                    onPlayNext={() => playNextInQueue(track)}
                    onAddToQueue={() => addToQueue(track)}
                    onAddToPlaylist={(plId) => void addTracksToPlaylist(plId, [track.id])}
                    onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
                    onDelete={() => void deleteTracks([track.id])}
                  />
                ))}
              </GlassCard>
            </section>
          )}

          {matchingArtists.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display">Local Artists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {matchingArtists.map((artist) => {
                  const artistTracks = artist.trackIds
                    .map((id) => trackById.get(id))
                    .filter((t): t is Track => Boolean(t));
                  return (
                    <GlassCard
                      key={artist.id}
                      interactive
                      onClick={() =>
                        artistTracks.length > 0 &&
                        void playTrack(artistTracks[0], artistTracks, artist.name)
                      }
                      className="p-3 flex items-center gap-3"
                    >
                      <AlbumArtwork
                        artworkId={artist.artworkId}
                        alt={artist.name}
                        fallbackSeed={artist.name}
                        size="sm"
                        rounded="2xl"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{artist.name}</p>
                        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{artistTracks.length} songs</span>
                        </p>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          )}

          {matchingAlbums.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display">Local Albums</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {matchingAlbums.map((album) => {
                  const albumTracks = album.trackIds
                    .map((id) => trackById.get(id))
                    .filter((t): t is Track => Boolean(t));
                  return (
                    <GlassCard
                      key={album.id}
                      interactive
                      onClick={() =>
                        albumTracks.length > 0 &&
                        void playTrack(albumTracks[0], albumTracks, album.title)
                      }
                      className="p-3 flex items-center gap-3"
                    >
                      <AlbumArtwork
                        artworkId={album.artworkId}
                        alt={album.title}
                        fallbackSeed={album.title}
                        size="sm"
                        rounded="lg"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{album.title}</p>
                        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate flex items-center gap-1">
                          <Disc3 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{album.artist}</span>
                        </p>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          )}

          {matchingPlaylists.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display">Local Playlists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {matchingPlaylists.map((pl) => (
                  <PlaylistCard
                    key={pl.id}
                    playlist={pl}
                    tracks={tracks}
                    mood={pl.moodCategoryId ? moodById.get(pl.moodCategoryId) : undefined}
                    onOpen={() => onOpenPlaylist(pl.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {matchingGenres.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-base font-bold font-display">Local Genres</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {matchingGenres.map(([genre, genreTracks]) => (
                  <GlassCard
                    key={genre}
                    interactive
                    onClick={() => void playTrack(genreTracks[0], genreTracks, genre)}
                    className="p-4 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-semibold truncate">{genre}</span>
                    <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
                      {genreTracks.length}
                    </span>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}

          {!hasAnyResults && !ytSearching && (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">No matches for &ldquo;{trimmed}&rdquo;</p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                {includeYouTube && !ytConnected
                  ? 'Connect your Google account above to search YouTube Music, or try a different local keyword.'
                  : 'Try a different song title, artist name, or press Search to query YouTube Music again.'}
              </p>
            </GlassCard>
          )}
        </div>
      ) : (
        /* Empty Query Discovery & Browse State */
        <div className="space-y-6">
          {ytConnected && includeYouTube && ytLikedTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold tracking-tight font-display flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-[#FF0000]" />
                  <span>Quick Play from YouTube Liked Music</span>
                </h2>
                <GlassButton
                  size="sm"
                  onClick={() => void playTrack(ytLikedTracks[0], ytLikedTracks, 'Liked Music')}
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                  <span>Play All</span>
                </GlassButton>
              </div>
              <GlassCard className="p-2">
                {ytLikedTracks.slice(0, 6).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    isCurrent={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    onPlay={() => void playTrack(track, ytLikedTracks, 'Liked Music')}
                    onPlayNext={() => playNextInQueue(track)}
                    onAddToQueue={() => addToQueue(track)}
                    onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
                  />
                ))}
              </GlassCard>
            </section>
          )}

          {includeLocal && tracks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold tracking-tight font-display">Browse Local Genres</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {allGenres.map(([genre, genreTracks]) => (
                  <GlassCard
                    key={genre}
                    interactive
                    onClick={() => void playTrack(genreTracks[0], genreTracks, genre)}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{genre}</p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular mt-0.5">
                        {genreTracks.length} {genreTracks.length === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                    <Tag className="w-4 h-4 text-[var(--neo-accent)] shrink-0" />
                  </GlassCard>
                ))}
              </div>
            </section>
          )}

          {tracks.length === 0 && (!ytConnected || scope === 'local') && (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">
                {scope === 'local'
                  ? 'Your local library is empty'
                  : 'Ready to search YouTube Music'}
              </p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                {scope === 'local'
                  ? 'Import local audio files in Home or Library, or switch to YouTube Music to search online.'
                  : 'Type any song, artist, or album above to search and stream from YouTube Music.'}
              </p>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
};
