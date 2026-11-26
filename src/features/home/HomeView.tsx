import React, { useMemo, useRef } from 'react';
import {
  ChevronRight,
  Heart,
  Library,
  Play,
  Plus,
  Radio,
  Sparkles,
  Upload,
  Youtube,
} from 'lucide-react';
import { useDiscovery } from '../../app/DiscoveryContext';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useYouTube } from '../../app/YouTubeContext';
import { formatRelativeDate, formatTime } from '../../lib/format';
import { buildSmartPlaylistDrafts } from '../../services/smartPlaylistService';
import { isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
import type { AppSection, LibrarySubTab, MoodCategory, Track } from '../../types/music';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { PlaylistCard } from '../../components/PlaylistCard';
import { TrackRow } from '../../components/TrackRow';
import { ImportDropzone } from '../library/ImportDropzone';

interface HomeViewProps {
  onNavigate: (section: AppSection, libraryTab?: LibrarySubTab) => void;
  onOpenPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (moodCategoryId?: string) => void;
  onOpenLyricsForTrack: (trackId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onOpenPlaylist,
  onCreatePlaylist,
  onOpenLyricsForTrack,
}) => {
  const {
    tracks,
    playlists,
    importFiles,
    pickAndImportAudioFiles,
    toggleFavourite,
    createPlaylist,
    generateSmartMixes,
  } = useLibrary();
  const { trendingTracks, artistUpdates, unreadCount, playDiscoveryTrack, tuneInToTrending } =
    useDiscovery();
  const { currentTrack, isPlaying, playTrack, playNextInQueue, addToQueue, setNowPlayingOpen } =
    usePlayer();
  const { settings } = useTheme();
  const {
    isConnected: ytConnected,
    isLoggingIn: ytLoggingIn,
    playlists: ytPlaylists,
    likedTracks: ytLikedTracks,
    signIn: ytSignIn,
    loadPlaylistTracks,
  } = useYouTube();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasNativeMediaStore = isNativeMediaStoreAvailable();
  const handleImportClick = () => {
    if (hasNativeMediaStore) {
      void pickAndImportAudioFiles();
    } else {
      fileInputRef.current?.click();
    }
  };

  const smartDrafts = useMemo(
    () =>
      buildSmartPlaylistDrafts(
        tracks,
        settings.followedArtists || [],
        settings.moodCategories || []
      ),
    [tracks, settings.followedArtists, settings.moodCategories]
  );

  const recentlyPlayed = useMemo(
    () =>
      tracks
        .filter((t) => t.lastPlayedAt)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
        .slice(0, 6),
    [tracks]
  );

  const continueTrack = useMemo(() => {
    if (currentTrack) return currentTrack;
    return recentlyPlayed[0] || null;
  }, [currentTrack, recentlyPlayed]);

  const favourites = useMemo(
    () => tracks.filter((t) => t.isFavourite).slice(0, 6),
    [tracks]
  );

  const recentlyAdded = useMemo(
    () => tracks.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 8),
    [tracks]
  );

  const moodById = useMemo(
    () => new Map(settings.moodCategories.map((m) => [m.id, m])),
    [settings.moodCategories]
  );

  const handleMoodClick = async (mood: MoodCategory) => {
    const existingPl = playlists.find((p) => p.moodCategoryId === mood.id);
    if (existingPl) {
      onOpenPlaylist(existingPl.id);
      return;
    }
    const taggedTracks = tracks.filter((t) => t.moodTags?.includes(mood.id));
    if (taggedTracks.length > 0) {
      const created = await createPlaylist({
        name: mood.name,
        description: mood.description,
        moodCategoryId: mood.id,
        initialTrackIds: taggedTracks.map((t) => t.id),
      });
      onOpenPlaylist(created.id);
      return;
    }
    onCreatePlaylist(mood.id);
  };

  return (
    <div className="space-y-8">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus"
        onChange={(e) => {
          if (hasNativeMediaStore) void pickAndImportAudioFiles();
          else if (e.target.files) void importFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Listen Now</h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Offline private collection on your device
          </p>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton size="sm" variant="accent" onClick={handleImportClick}>
            <Upload className="w-3.5 h-3.5" />
            <span>{hasNativeMediaStore ? 'Pick Editable Music' : 'Import Music'}</span>
          </GlassButton>
          {tracks.length > 0 && (
            <GlassButton size="sm" onClick={() => onNavigate('library', 'songs')}>
              <Library className="w-3.5 h-3.5" />
              <span>All Songs</span>
            </GlassButton>
          )}
        </div>
      </div>

      {/* Empty Library Onboarding OR Continue Listening Hero */}
      {tracks.length === 0 ? (
        <ImportDropzone />
      ) : (
        continueTrack && (
          <GlassCard
            elevated
            className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
          >
            <AlbumArtwork
              artworkId={continueTrack.artworkId}
              alt={continueTrack.title}
              fallbackSeed={`${continueTrack.album}-${continueTrack.artist}`}
              size="lg"
              rounded="2xl"
              className="w-24 h-24 sm:w-28 sm:h-28 shadow-lg"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-semibold text-[#FF2D55] dark:text-[#FF375F]">
                {currentTrack?.id === continueTrack.id && isPlaying
                  ? 'Currently Playing'
                  : 'Continue Listening'}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-display truncate">
                {continueTrack.title}
              </h2>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] truncate">
                {continueTrack.artist} · {continueTrack.album} ·{' '}
                <span className="font-mono-tabular">{formatTime(continueTrack.duration)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <GlassButton
                variant="accent"
                className="flex-1 sm:flex-initial"
                onClick={() => {
                  if (currentTrack?.id === continueTrack.id) {
                    setNowPlayingOpen(true);
                  } else {
                    void playTrack(continueTrack, tracks, 'Continue Listening');
                  }
                }}
              >
                <Play className="w-4 h-4" fill="currentColor" />
                <span>{currentTrack?.id === continueTrack.id ? 'Open Player' : 'Resume'}</span>
              </GlassButton>
            </div>
          </GlassCard>
        )
      )}

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Recently Played"
            actionLabel="Library"
            onAction={() => onNavigate('library', 'songs')}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentlyPlayed.map((track) => (
              <TrackSquareCard
                key={track.id}
                track={track}
                subtitle={
                  track.lastPlayedAt ? formatRelativeDate(track.lastPlayedAt) : track.artist
                }
                onPlay={() => void playTrack(track, recentlyPlayed, 'Recently Played')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Recently Added"
            actionLabel="See All"
            onAction={() => onNavigate('library', 'recent')}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {recentlyAdded.slice(0, 4).map((track) => (
              <TrackSquareCard
                key={track.id}
                track={track}
                subtitle={`${track.artist} · ${track.format}`}
                onPlay={() => void playTrack(track, recentlyAdded, 'Recently Added')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Favourite Tracks */}
      {favourites.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Favourite Tracks"
            actionLabel="All Favourites"
            onAction={() => onNavigate('library', 'favourites')}
          />
          <GlassCard className="p-2 sm:p-3">
            {favourites.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                playlists={playlists}
                onPlay={() => void playTrack(track, favourites, 'Favourites')}
                onToggleFavourite={() => void toggleFavourite(track.id)}
                onPlayNext={() => playNextInQueue(track)}
                onAddToQueue={() => addToQueue(track)}
                onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
              />
            ))}
          </GlassCard>
        </section>
      )}

      {/* Personal Playlists */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display">
            Personal Playlists
          </h2>
          <div className="flex items-center gap-2">
            {smartDrafts.length > 0 && (
              <GlassButton
                size="sm"
                onClick={() => void generateSmartMixes(smartDrafts)}
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                <span>Create Mixes For Me</span>
              </GlassButton>
            )}
            <button
              type="button"
              onClick={() =>
                playlists.length > 0 ? onNavigate('playlists') : onCreatePlaylist()
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF2D55] dark:text-[#FF375F] hover:opacity-80 cursor-pointer min-h-[36px] px-2"
            >
              <span>{playlists.length > 0 ? 'All Playlists' : 'New Playlist'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {playlists.length === 0 ? (
          <GlassCard className="p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FF2D55]/12 text-[#FF2D55] flex items-center justify-center">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Create or auto-generate playlists</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                  Build mixes manually or let Neo Player curate playlists from your library.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {smartDrafts.length > 0 && (
                <GlassButton size="sm" onClick={() => void generateSmartMixes(smartDrafts)}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Create Mixes</span>
                </GlassButton>
              )}
              <GlassButton size="sm" variant="accent" onClick={() => onCreatePlaylist()}>
                <Plus className="w-3.5 h-3.5" />
                <span>Create Playlist</span>
              </GlassButton>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.slice(0, 5).map((pl) => (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                tracks={tracks}
                mood={pl.moodCategoryId ? moodById.get(pl.moodCategoryId) : undefined}
                onOpen={() => onOpenPlaylist(pl.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* YouTube Music Library & Playlists */}
      <section className="space-y-3">
        <SectionHeader
          title="YouTube Music"
          actionLabel={ytConnected ? 'Open YouTube' : 'View Hub'}
          onAction={() => onNavigate('youtube')}
        />
        {!ytConnected ? (
          <GlassCard className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-2xl bg-[#FF0000]/12 text-[#FF0000] dark:text-[#FF4E45] flex items-center justify-center shrink-0">
                <Youtube className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Connect your YouTube Music account</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                  Browse and stream your playlists, liked music, and subscribed channels
                </p>
              </div>
            </div>
            <GoogleSignInButton onClick={() => void ytSignIn()} loading={ytLoggingIn} />
          </GlassCard>
        ) : (
          <GlassCard className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
                {ytLikedTracks.length} liked tracks · {ytPlaylists.length} playlists synced
              </p>
              {ytLikedTracks.length > 0 && (
                <GlassButton
                  size="sm"
                  variant="accent"
                  onClick={() => void playTrack(ytLikedTracks[0], ytLikedTracks, 'Liked Music')}
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                  <span>Play Liked Music</span>
                </GlassButton>
              )}
            </div>
            {ytPlaylists.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ytPlaylists.slice(0, 4).map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      void loadPlaylistTracks(pl.id, pl.title).then((plTracks) => {
                        if (plTracks.length > 0) {
                          void playTrack(plTracks[0], plTracks, pl.title);
                        } else {
                          onNavigate('youtube');
                        }
                      });
                    }}
                    className="p-2.5 rounded-2xl liquid-glass-subtle flex items-center gap-3 text-left hover:brightness-105 transition-all cursor-pointer"
                  >
                    <AlbumArtwork
                      artworkUrl={pl.thumbnailUrl}
                      alt={pl.title}
                      fallbackSeed={pl.title}
                      size="sm"
                      rounded="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{pl.title}</p>
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] font-mono-tabular truncate">
                        {pl.itemCount} tracks
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </section>

      {/* Music Radar & Artist Tune-In Highlight */}
      {(trendingTracks.length > 0 || artistUpdates.length > 0) && (
        <section className="space-y-3">
          <SectionHeader
            title={unreadCount > 0 ? `Music Radar · ${unreadCount} New` : 'Trending & Artist Radar'}
            actionLabel="Open Radar"
            onAction={() => onNavigate('discover')}
          />
          <GlassCard className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                Top trending songs and latest releases from artists in your rotation
              </p>
              <GlassButton size="sm" variant="accent" onClick={() => void tuneInToTrending()}>
                <Radio className="w-3.5 h-3.5" />
                <span>Tune In Charts</span>
              </GlassButton>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {trendingTracks.slice(0, 3).map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void playDiscoveryTrack(item, trendingTracks, 'Trending Charts')}
                  className="p-3 rounded-2xl liquid-glass-subtle flex items-center gap-3 text-left hover:brightness-105 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/8 dark:bg-white/10 shrink-0">
                    {item.artworkUrl && (
                      <img
                        src={item.artworkUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono-tabular text-[var(--neo-accent)] font-semibold">
                      #{item.rank ?? idx + 1} Trending
                    </p>
                    <p className="text-sm font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                      {item.artist}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* Recommended Mood Collections */}
      <section className="space-y-3">
        <SectionHeader
          title="Mood Collections"
          actionLabel="Manage Moods"
          onAction={() => onNavigate('playlists')}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {settings.moodCategories.map((mood) => {
            const matchingPlaylists = playlists.filter((p) => p.moodCategoryId === mood.id);
            const matchingTracks = tracks.filter((t) => t.moodTags?.includes(mood.id));
            return (
              <GlassCard
                key={mood.id}
                interactive
                onClick={() => void handleMoodClick(mood)}
                className="p-4 flex flex-col justify-between min-h-[124px] relative overflow-hidden"
                style={{
                  backgroundImage: `radial-gradient(circle at 90% 10%, ${mood.accentColor}26, transparent 65%)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: mood.accentColor }}
                  />
                  <Sparkles className="w-3.5 h-3.5 text-[#8E8E93]" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-bold font-display">{mood.name}</p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                    {matchingPlaylists.length > 0
                      ? `${matchingPlaylists.length} ${matchingPlaylists.length === 1 ? 'playlist' : 'playlists'}`
                      : matchingTracks.length > 0
                        ? `${matchingTracks.length} tagged`
                        : 'Create mix'}
                  </p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const SectionHeader: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, actionLabel, onAction }) => (
  <div className="flex items-center justify-between gap-4">
    <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display">{title}</h2>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF2D55] dark:text-[#FF375F] hover:opacity-80 cursor-pointer min-h-[36px] px-2"
      >
        <span>{actionLabel}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

const TrackSquareCard: React.FC<{
  track: Track;
  subtitle: string;
  onPlay: () => void;
}> = ({ track, subtitle, onPlay }) => (
  <GlassCard interactive onClick={onPlay} className="group p-3 flex flex-col gap-2.5">
    <div className="relative aspect-square w-full">
      <AlbumArtwork
        artworkId={track.artworkId}
        alt={track.title}
        fallbackSeed={`${track.album}-${track.artist}`}
        size="fill"
        rounded="xl"
      />
      <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white/90 dark:bg-[#1C1D24]/90 backdrop-blur-md text-[#111216] dark:text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
      </div>
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold truncate">{track.title}</p>
      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">{subtitle}</p>
    </div>
  </GlassCard>
);
