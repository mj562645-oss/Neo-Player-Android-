import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  Heart,
  LayoutGrid,
  Link2,
  List,
  ListPlus,
  Loader2,
  Play,
  Plus,
  Radio,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  X,
  Youtube,
} from 'lucide-react';
import { useDiscovery } from '../../app/DiscoveryContext';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useToast } from '../../app/ToastContext';
import { useYouTube } from '../../app/YouTubeContext';
import { formatTime } from '../../lib/format';
import { isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
import { isWebFileSystemAccessSupported } from '../../services/libraryService';
import {
  SORT_OPTIONS,
  getDefaultDirectionForSortField,
  sortAlbums,
  sortArtists,
  sortTracks,
} from '../../lib/trackSort';
import { cn } from '../../lib/utils';
import type {
  Album,
  Artist,
  LibrarySortField,
  LibrarySubTab,
  SortDirection,
  Track,
  ViewLayout,
} from '../../types/music';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { PlaylistCard } from '../../components/PlaylistCard';
import { TrackRow } from '../../components/TrackRow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { ImportDropzone } from './ImportDropzone';
import { TrackMetadataModal } from './TrackMetadataModal';
import { YouTubeView } from '../youtube/YouTubeView';

interface LibraryViewProps {
  initialTab?: LibrarySubTab;
  onOpenPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (initialTrackIds?: string[]) => void;
  onOpenLyricsForTrack: (trackId: string) => void;
}

const TABS: { id: LibrarySubTab; label: string }[] = [
  { id: 'songs', label: 'Songs' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'recent', label: 'Recently Added' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  initialTab = 'songs',
  onOpenPlaylist,
  onCreatePlaylist,
  onOpenLyricsForTrack,
}) => {
  const {
    tracks,
    albums,
    artists,
    playlists,
    importFiles,
    pickAndImportAudioFiles,
    pickAndLinkOriginalFiles,
    scanDeviceMediaStore,
    isScanningMediaStore,
    enrichProgress,
    downloadLyricsForTrack,
    enrichTrack,
    enrichTracksBatch,
    cancelBatchEnrich,
    toggleFavourite,
    batchFavourite,
    deleteTracks,
    addTracksToPlaylist,
  } = useLibrary();
  const hasNativeMediaStore = isNativeMediaStoreAvailable();
  const canLinkOriginalWeb = !hasNativeMediaStore && isWebFileSystemAccessSupported();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    playNextInQueue,
    addToQueue,
  } = usePlayer();
  const { settings, updateSettings, isArtistFollowed, toggleFollowArtist } = useTheme();
  const { tuneInToArtist } = useDiscovery();
  const { showToast } = useToast();
  const { isConnected: ytConnected, likedTracks: ytLiked } = useYouTube();

  const [sourceMode, setSourceMode] = useState<'local' | 'youtube'>('local');
  const [activeTab, setActiveTab] = useState<LibrarySubTab>(initialTab);
  const [filterQuery, setFilterQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [layout, setLayout] = useState<ViewLayout>(settings.defaultLibraryLayout);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [iframeNotice, setIframeNotice] = useState(false);

  const sortField: LibrarySortField = settings.librarySortField ?? 'addedAt';
  const sortDir: SortDirection = settings.librarySortDirection ?? 'desc';

  const quickUploadRef = useRef<HTMLInputElement | null>(null);
  const handleImportClick = async () => {
    setIframeNotice(false);
    if (hasNativeMediaStore) {
      void pickAndImportAudioFiles();
    } else if (canLinkOriginalWeb) {
      const res = await pickAndLinkOriginalFiles();
      if (res.iframeBlocked) {
        setIframeNotice(true);
      }
    } else {
      quickUploadRef.current?.click();
    }
  };

  const handleSelectSortField = (field: LibrarySortField) => {
    if (field === sortField) {
      const nextDir: SortDirection = sortDir === 'asc' ? 'desc' : 'asc';
      void updateSettings({ librarySortDirection: nextDir });
      return;
    }
    void updateSettings({
      librarySortField: field,
      librarySortDirection: getDefaultDirectionForSortField(field),
    });
  };

  const handleToggleSortDir = () => {
    const nextDir: SortDirection = sortDir === 'asc' ? 'desc' : 'asc';
    void updateSettings({ librarySortDirection: nextDir });
  };

  const getDirectionLabel = (field: LibrarySortField, dir: SortDirection): string => {
    if (field === 'addedAt') return dir === 'desc' ? 'Newest' : 'Oldest';
    if (field === 'duration') return dir === 'desc' ? 'Longest' : 'Shortest';
    if (field === 'playCount') return dir === 'desc' ? 'Most' : 'Least';
    return dir === 'asc' ? 'A–Z' : 'Z–A';
  };

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const t of tracks) {
      if (t.genre && t.genre !== 'Unclassified') set.add(t.genre);
    }
    return Array.from(set).sort();
  }, [tracks]);

  const filteredAndSortedTracks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const list = tracks.filter((t) => {
      if (activeTab === 'favourites' && !t.isFavourite) return false;
      if (genreFilter !== 'all' && t.genre !== genreFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
      );
    });

    if (activeTab === 'recent') {
      return sortTracks(list, 'addedAt', 'desc');
    }

    return sortTracks(list, sortField, sortDir);
  }, [tracks, activeTab, filterQuery, genreFilter, sortField, sortDir]);

  const albumSortField: LibrarySortField =
    sortField === 'artist' || sortField === 'duration' ? sortField : 'title';

  const filteredAlbums = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const list = albums.filter(
      (a) => !q || a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
    return sortAlbums(list, albumSortField, sortDir);
  }, [albums, filterQuery, albumSortField, sortDir]);

  const filteredArtists = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const list = artists.filter((a) => !q || a.name.toLowerCase().includes(q));
    return sortArtists(list, sortDir);
  }, [artists, filterQuery, sortDir]);

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const moodById = useMemo(
    () => new Map(settings.moodCategories.map((m) => [m.id, m])),
    [settings.moodCategories]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLayoutChange = (nextLayout: ViewLayout) => {
    setLayout(nextLayout);
    void updateSettings({ defaultLibraryLayout: nextLayout });
  };

  const selectedTrackObjects = useMemo(
    () => tracks.filter((t) => selectedIds.has(t.id)),
    [tracks, selectedIds]
  );

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  if (sourceMode === 'youtube') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Library</h1>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              YouTube Music liked songs, playlists & subscribed channels
            </p>
          </div>
          <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-subtle">
            <button
              type="button"
              onClick={() => setSourceMode('local')}
              className="min-h-[36px] px-3.5 rounded-xl text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] cursor-pointer"
            >
              Local ({tracks.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('youtube')}
              className="min-h-[36px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm cursor-pointer"
            >
              <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />
              <span>YouTube{ytConnected ? ` (${ytLiked.length})` : ''}</span>
            </button>
          </div>
        </div>
        <YouTubeView
          initialTab="liked"
          embedded
          onOpenLyricsForTrack={onOpenLyricsForTrack}
        />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Library</h1>
          <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-subtle">
            <button
              type="button"
              onClick={() => setSourceMode('local')}
              className="min-h-[36px] px-3.5 rounded-xl text-xs font-semibold bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm cursor-pointer"
            >
              Local (0)
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('youtube')}
              className="min-h-[36px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-[#6E6E73] dark:text-[#98989D] cursor-pointer"
            >
              <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />
              <span>YouTube Music</span>
            </button>
          </div>
        </div>
        <ImportDropzone />
      </div>
    );
  }

  // Album detail sub-view
  if (selectedAlbum) {
    const albumTracks = selectedAlbum.trackIds
      .map((id) => trackById.get(id))
      .filter((t): t is Track => Boolean(t))
      .sort((a, b) => (a.trackNumber || 999) - (b.trackNumber || 999));

    return (
      <div className="space-y-6">
        <GlassButton size="sm" variant="ghost" onClick={() => setSelectedAlbum(null)}>
          <ArrowLeft className="w-4 h-4" />
          <span>All Albums</span>
        </GlassButton>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <AlbumArtwork
            artworkId={selectedAlbum.artworkId}
            alt={selectedAlbum.title}
            fallbackSeed={`${selectedAlbum.title}-${selectedAlbum.artist}`}
            size="lg"
            rounded="2xl"
            className="w-40 h-40 sm:w-48 sm:h-48 shadow-xl"
          />
          <div className="space-y-2 min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-balance">
              {selectedAlbum.title}
            </h1>
            <p className="text-base font-medium text-[#48484A] dark:text-[#AEAEB2]">
              {selectedAlbum.artist}
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
              {selectedAlbum.year ? `${selectedAlbum.year} · ` : ''}
              {albumTracks.length} {albumTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
              {formatTime(selectedAlbum.totalDuration)}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {albumTracks.length > 0 && (
                <GlassButton
                  variant="accent"
                  onClick={() => void playTrack(albumTracks[0], albumTracks, selectedAlbum.title)}
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  <span>Play Album</span>
                </GlassButton>
              )}
              {albumTracks.length > 0 && (
                <GlassButton onClick={() => addToQueue(albumTracks, selectedAlbum.title)}>
                  <ListPlus className="w-4 h-4" />
                  <span>Queue Album</span>
                </GlassButton>
              )}
            </div>
          </div>
        </div>

        <GlassCard className="p-2 sm:p-3 divide-y divide-black/[0.04] dark:divide-white/[0.05]">
          {albumTracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              isCurrent={currentTrack?.id === track.id}
              isPlaying={isPlaying}
              playlists={playlists}
              onPlay={() => void playTrack(track, albumTracks, selectedAlbum.title)}
              onToggleFavourite={() => void toggleFavourite(track.id)}
              onPlayNext={() => playNextInQueue(track)}
              onAddToQueue={() => addToQueue(track)}
              onAddToPlaylist={(plId) => void addTracksToPlaylist(plId, [track.id])}
              onEditMetadata={() => setEditingTrack(track)}
              onAutoEnrich={() => void enrichTrack(track.id)}
              onDownloadLyrics={() => void downloadLyricsForTrack(track.id)}
              onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
              onDelete={() => void deleteTracks([track.id])}
            />
          ))}
        </GlassCard>

        <TrackMetadataModal
          track={editingTrack}
          open={Boolean(editingTrack)}
          onOpenChange={(o) => !o && setEditingTrack(null)}
        />
      </div>
    );
  }

  // Artist detail sub-view
  if (selectedArtist) {
    const rawArtistTracks = selectedArtist.trackIds
      .map((id) => trackById.get(id))
      .filter((t): t is Track => Boolean(t));
    const artistTracks = sortTracks(rawArtistTracks, sortField, sortDir);
    const activeTrackSortLabel =
      SORT_OPTIONS.find((opt) => opt.id === sortField)?.label ?? 'Date Added';

    return (
      <div className="space-y-6">
        <GlassButton size="sm" variant="ghost" onClick={() => setSelectedArtist(null)}>
          <ArrowLeft className="w-4 h-4" />
          <span>All Artists</span>
        </GlassButton>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <AlbumArtwork
            artworkId={selectedArtist.artworkId}
            alt={selectedArtist.name}
            fallbackSeed={selectedArtist.name}
            size="lg"
            rounded="3xl"
            className="w-36 h-36 sm:w-44 sm:h-44 shadow-xl"
          />
          <div className="space-y-2 min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
              {selectedArtist.name}
            </h1>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
              {selectedArtist.albumCount} {selectedArtist.albumCount === 1 ? 'album' : 'albums'} ·{' '}
              {artistTracks.length} {artistTracks.length === 1 ? 'track' : 'tracks'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {artistTracks.length > 0 && (
                <GlassButton
                  variant="accent"
                  onClick={() => void playTrack(artistTracks[0], artistTracks, selectedArtist.name)}
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  <span>Play All</span>
                </GlassButton>
              )}

              <GlassButton
                onClick={() => {
                  void toggleFollowArtist(selectedArtist.name).then((followed) => {
                    showToast(
                      followed
                        ? `Following ${selectedArtist.name} for release alerts`
                        : `Unfollowed ${selectedArtist.name}`,
                      'info'
                    );
                  });
                }}
              >
                {isArtistFollowed(selectedArtist.name) ? (
                  <>
                    <UserCheck className="w-4 h-4 text-[var(--neo-accent)]" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Follow Artist</span>
                  </>
                )}
              </GlassButton>

              <GlassButton onClick={() => void tuneInToArtist(selectedArtist.name)}>
                <Radio className="w-4 h-4 text-[var(--neo-accent)]" />
                <span>Tune In Radio</span>
              </GlassButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Sort artist tracks"
                    className="min-h-[42px] px-3.5 rounded-2xl liquid-glass-subtle inline-flex items-center gap-2 text-xs font-medium text-[#111216] dark:text-[#F5F5F7] hover:brightness-105 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-[var(--neo-accent)] shrink-0" />
                    <span>Sort: {activeTrackSortLabel}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
                    Sort Tracks By
                  </div>
                  <DropdownMenuSeparator />
                  {SORT_OPTIONS.map((opt) => {
                    const isActive = sortField === opt.id;
                    return (
                      <DropdownMenuItem
                        key={opt.id}
                        onSelect={() => handleSelectSortField(opt.id)}
                      >
                        <span className="w-4 flex items-center justify-center shrink-0">
                          {isActive && <Check className="w-3.5 h-3.5 text-[var(--neo-accent)]" />}
                        </span>
                        <span className={cn('flex-1', isActive && 'font-semibold')}>
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
                          {getDirectionLabel(opt.id, isActive ? sortDir : opt.defaultDir)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <GlassButton
                size="sm"
                onClick={handleToggleSortDir}
                aria-label={`Sort direction: ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
                className="min-h-[42px]"
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="text-xs font-mono-tabular">
                  {getDirectionLabel(sortField, sortDir)}
                </span>
              </GlassButton>
            </div>
          </div>
        </div>

        <GlassCard className="p-2 sm:p-3">
          {artistTracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              isCurrent={currentTrack?.id === track.id}
              isPlaying={isPlaying}
              playlists={playlists}
              onPlay={() => void playTrack(track, artistTracks, selectedArtist.name)}
              onToggleFavourite={() => void toggleFavourite(track.id)}
              onPlayNext={() => playNextInQueue(track)}
              onAddToQueue={() => addToQueue(track)}
              onAddToPlaylist={(plId) => void addTracksToPlaylist(plId, [track.id])}
              onEditMetadata={() => setEditingTrack(track)}
              onAutoEnrich={() => void enrichTrack(track.id)}
              onDownloadLyrics={() => void downloadLyricsForTrack(track.id)}
              onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
              onDelete={() => void deleteTracks([track.id])}
            />
          ))}
        </GlassCard>

        <TrackMetadataModal
          track={editingTrack}
          open={Boolean(editingTrack)}
          onOpenChange={(o) => !o && setEditingTrack(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={quickUploadRef}
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Library</h1>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5 font-mono-tabular">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'} · {albums.length}{' '}
            {albums.length === 1 ? 'album' : 'albums'} · {artists.length}{' '}
            {artists.length === 1 ? 'artist' : 'artists'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-subtle">
            <button
              type="button"
              onClick={() => setSourceMode('local')}
              className="min-h-[34px] px-3 rounded-xl text-xs font-semibold bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm cursor-pointer"
            >
              Local ({tracks.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('youtube')}
              className="min-h-[34px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-[#6E6E73] dark:text-[#98989D] cursor-pointer"
            >
              <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />
              <span>YouTube{ytConnected ? ` (${ytLiked.length})` : ''}</span>
            </button>
          </div>
          {hasNativeMediaStore && (
            <GlassButton
              size="sm"
              variant="accent"
              disabled={isScanningMediaStore}
              onClick={() => void scanDeviceMediaStore()}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isScanningMediaStore ? 'Scanning...' : 'Scan Device'}</span>
            </GlassButton>
          )}
          <GlassButton
            size="sm"
            variant={hasNativeMediaStore ? 'glass' : 'accent'}
            onClick={() => void handleImportClick()}
          >
            {canLinkOriginalWeb ? <Link2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            <span>
              {hasNativeMediaStore
                ? 'Pick Editable Music'
                : canLinkOriginalWeb
                  ? 'Link Music'
                  : 'Import Music'}
            </span>
          </GlassButton>
          {(activeTab === 'songs' || activeTab === 'favourites' || activeTab === 'recent') && (
            <GlassButton
              size="sm"
              variant={selectionMode ? 'accent' : 'glass'}
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectionMode ? 'Done' : 'Select'}</span>
            </GlassButton>
          )}
        </div>
      </div>

      {iframeNotice && (
        <GlassCard className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-[#48484A] dark:text-[#AEAEB2] flex-1 min-w-[200px]">
            Direct disk linking requires a standalone tab. Open in a new tab to link & edit original files without copying, or copy files into browser storage.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={typeof window !== 'undefined' ? window.location.href : '/'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-xl bg-[var(--neo-accent)] text-white font-semibold hover:brightness-110 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>
            <GlassButton
              size="sm"
              onClick={() => {
                setIframeNotice(false);
                quickUploadRef.current?.click();
              }}
            >
              Copy Files
            </GlassButton>
            <GlassButton
              size="sm"
              variant="ghost"
              aria-label="Dismiss notice"
              onClick={() => setIframeNotice(false)}
            >
              <X className="w-3.5 h-3.5" />
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedAlbum(null);
                setSelectedArtist(null);
                exitSelection();
              }}
              className={cn(
                'min-h-[40px] px-4 rounded-2xl text-sm font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer',
                active
                  ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                  : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter, Sort & Layout Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="w-full min-h-[42px] pl-10 pr-4 rounded-2xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
          />
        </div>

        {(activeTab === 'songs' || activeTab === 'favourites') && genres.length > 0 && (
          <select
            aria-label="Filter by genre"
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="min-h-[42px] px-3.5 rounded-2xl liquid-glass-subtle text-xs font-medium text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)] cursor-pointer"
          >
            <option value="all">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}

        {(activeTab === 'songs' || activeTab === 'favourites' || activeTab === 'albums') && (() => {
          const availableOptions =
            activeTab === 'albums'
              ? SORT_OPTIONS.filter((o) => o.id === 'title' || o.id === 'artist' || o.id === 'duration')
              : SORT_OPTIONS;
          const activeField = activeTab === 'albums' ? albumSortField : sortField;
          const activeLabel = availableOptions.find((o) => o.id === activeField)?.label ?? 'Title';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={activeTab === 'albums' ? 'Sort albums by' : 'Sort tracks by'}
                    className="min-h-[42px] px-3.5 rounded-2xl liquid-glass-subtle inline-flex items-center gap-2 text-xs font-medium text-[#111216] dark:text-[#F5F5F7] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)] transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-[var(--neo-accent)] shrink-0" />
                    <span>Sort: {activeLabel}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
                    Sort By
                  </div>
                  <DropdownMenuSeparator />
                  {availableOptions.map((opt) => {
                    const isActive = activeField === opt.id;
                    return (
                      <DropdownMenuItem
                        key={opt.id}
                        onSelect={() => handleSelectSortField(opt.id)}
                      >
                        <span className="w-4 flex items-center justify-center shrink-0">
                          {isActive && <Check className="w-3.5 h-3.5 text-[var(--neo-accent)]" />}
                        </span>
                        <span className={cn('flex-1', isActive && 'font-semibold')}>
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
                          {getDirectionLabel(opt.id, isActive ? sortDir : opt.defaultDir)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <GlassButton
                size="sm"
                onClick={handleToggleSortDir}
                aria-label={`Sort direction: ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
                title={`Toggle sort direction (${sortDir === 'asc' ? 'Ascending' : 'Descending'})`}
                className="min-h-[42px]"
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="text-xs font-mono-tabular">
                  {getDirectionLabel(activeField, sortDir)}
                </span>
              </GlassButton>
            </div>
          );
        })()}

        {activeTab === 'artists' && (
          <GlassButton
            size="sm"
            onClick={handleToggleSortDir}
            aria-label={`Sort artists ${sortDir === 'asc' ? 'A to Z' : 'Z to A'}`}
            className="min-h-[42px]"
          >
            {sortDir === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="text-xs font-mono-tabular">
              Name: {sortDir === 'asc' ? 'A–Z' : 'Z–A'}
            </span>
          </GlassButton>
        )}

        {(activeTab === 'songs' || activeTab === 'favourites' || activeTab === 'recent') && (
          <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-subtle">
            <button
              type="button"
              onClick={() => handleLayoutChange('list')}
              aria-label="List layout"
              className={cn(
                'min-h-[34px] min-w-[34px] rounded-xl flex items-center justify-center cursor-pointer transition-colors',
                layout === 'list'
                  ? 'bg-white dark:bg-[#2C2D36] text-[#111216] dark:text-white shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#98989D]'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange('grid')}
              aria-label="Grid layout"
              className={cn(
                'min-h-[34px] min-w-[34px] rounded-xl flex items-center justify-center cursor-pointer transition-colors',
                layout === 'grid'
                  ? 'bg-white dark:bg-[#2C2D36] text-[#111216] dark:text-white shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#98989D]'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Enrichment Progress Banner */}
      {enrichProgress.active && (
        <GlassCard elevated className="p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Loader2 className="w-4 h-4 text-[var(--neo-accent)] animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">
                Auto-enriching {enrichProgress.done + 1} of {enrichProgress.total} ·{' '}
                {enrichProgress.currentTitle}
              </p>
              <div className="h-1.5 w-full rounded-full bg-black/8 dark:bg-white/10 overflow-hidden mt-1.5">
                <div
                  className="h-full bg-[var(--neo-accent)] transition-all duration-200"
                  style={{
                    width: `${Math.round(((enrichProgress.done + 0.5) / Math.max(1, enrichProgress.total)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <GlassButton size="sm" onClick={cancelBatchEnrich}>
            <span>Stop</span>
          </GlassButton>
        </GlassCard>
      )}

      {/* Multi-Selection Action Bar */}
      {selectionMode && (
        <GlassCard elevated className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold font-mono-tabular">
              {selectedIds.size} selected
            </span>
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() =>
                setSelectedIds(
                  selectedIds.size === filteredAndSortedTracks.length
                    ? new Set()
                    : new Set(filteredAndSortedTracks.map((t) => t.id))
                )
              }
            >
              {selectedIds.size === filteredAndSortedTracks.length ? 'Clear All' : 'Select All'}
            </GlassButton>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              size="sm"
              variant="accent"
              disabled={selectedTrackObjects.length === 0 || enrichProgress.active}
              onClick={() => {
                void enrichTracksBatch(Array.from(selectedIds), {
                  mode: 'missing-only',
                  fetchMetadata: true,
                  fetchCover: true,
                  fetchLyrics: true,
                });
                exitSelection();
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Enrich</span>
            </GlassButton>
            <GlassButton
              size="sm"
              disabled={selectedTrackObjects.length === 0}
              onClick={() => {
                addToQueue(selectedTrackObjects);
                exitSelection();
              }}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Add to Queue</span>
            </GlassButton>
            <GlassButton
              size="sm"
              disabled={selectedTrackObjects.length === 0}
              onClick={() => {
                void batchFavourite(Array.from(selectedIds), true);
                exitSelection();
              }}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Favourite</span>
            </GlassButton>
            <GlassButton
              size="sm"
              disabled={selectedTrackObjects.length === 0}
              onClick={() => {
                onCreatePlaylist(Array.from(selectedIds));
                exitSelection();
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Playlist</span>
            </GlassButton>
            <GlassButton
              size="sm"
              disabled={selectedTrackObjects.length === 0}
              onClick={() => {
                void deleteTracks(Array.from(selectedIds));
                exitSelection();
              }}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </GlassButton>
            <GlassButton size="sm" variant="ghost" onClick={exitSelection} aria-label="Cancel selection">
              <X className="w-4 h-4" />
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Tab Content */}
      {(activeTab === 'songs' || activeTab === 'favourites' || activeTab === 'recent') && (
        <>
          {filteredAndSortedTracks.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">
                {activeTab === 'favourites' ? 'No favourite tracks yet' : 'No matching tracks'}
              </p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                {activeTab === 'favourites'
                  ? 'Tap the heart icon on any song to keep it close.'
                  : 'Try clearing your search or genre filter.'}
              </p>
            </GlassCard>
          ) : layout === 'list' ? (
            <GlassCard className="p-2 sm:p-3">
              {filteredAndSortedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(track.id)}
                  playlists={playlists}
                  onPlay={() => void playTrack(track, filteredAndSortedTracks, activeTab)}
                  onToggleSelect={() => toggleSelect(track.id)}
                  onToggleFavourite={() => void toggleFavourite(track.id)}
                  onPlayNext={() => playNextInQueue(track)}
                  onAddToQueue={() => addToQueue(track)}
                  onAddToPlaylist={(plId) => void addTracksToPlaylist(plId, [track.id])}
                  onEditMetadata={() => setEditingTrack(track)}
                  onAutoEnrich={() => void enrichTrack(track.id)}
                  onDownloadLyrics={() => void downloadLyricsForTrack(track.id)}
                  onOpenLyrics={() => onOpenLyricsForTrack(track.id)}
                  onDelete={() => void deleteTracks([track.id])}
                />
              ))}
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAndSortedTracks.map((track) => {
                const isSelected = selectedIds.has(track.id);
                const isCur = currentTrack?.id === track.id;
                return (
                  <GlassCard
                    key={track.id}
                    interactive
                    onClick={() =>
                      selectionMode
                        ? toggleSelect(track.id)
                        : void playTrack(track, filteredAndSortedTracks, activeTab)
                    }
                    className={cn(
                      'p-3 flex flex-col gap-2.5',
                      isCur && 'ring-2 ring-[var(--neo-accent)]',
                      isSelected && 'ring-2 ring-[#0A84FF]'
                    )}
                  >
                    <div className="relative aspect-square w-full">
                      <AlbumArtwork
                        artworkId={track.artworkId}
                        alt={track.title}
                        fallbackSeed={`${track.album}-${track.artist}`}
                        size="fill"
                        rounded="xl"
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          isCur && 'text-[var(--neo-accent)]'
                        )}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                        {track.artist} · {formatTime(track.duration)}
                      </p>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'albums' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAlbums.map((album) => (
            <GlassCard
              key={album.id}
              interactive
              onClick={() => setSelectedAlbum(album)}
              className="p-3 flex flex-col gap-2.5"
            >
              <div className="aspect-square w-full">
                <AlbumArtwork
                  artworkId={album.artworkId}
                  alt={album.title}
                  fallbackSeed={`${album.title}-${album.artist}`}
                  size="fill"
                  rounded="xl"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{album.title}</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                  {album.artist} · {album.trackIds.length}{' '}
                  {album.trackIds.length === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {activeTab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredArtists.map((artist) => (
            <GlassCard
              key={artist.id}
              interactive
              onClick={() => setSelectedArtist(artist)}
              className="p-3 flex flex-col gap-2.5 text-center"
            >
              <div className="aspect-square w-full">
                <AlbumArtwork
                  artworkId={artist.artworkId}
                  alt={artist.name}
                  fallbackSeed={artist.name}
                  size="fill"
                  rounded="3xl"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{artist.name}</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                  {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'} ·{' '}
                  {artist.trackIds.length} {artist.trackIds.length === 1 ? 'song' : 'songs'}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {activeTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <GlassButton size="sm" variant="accent" onClick={() => onCreatePlaylist()}>
              <Plus className="w-4 h-4" />
              <span>Create Playlist</span>
            </GlassButton>
          </div>
          {playlists.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="text-base font-semibold">No playlists yet</p>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
                Organise tracks into custom collections or mood mixes.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {playlists.map((pl) => {
                const plTracks = pl.trackIds
                  .map((id) => trackById.get(id))
                  .filter((t): t is Track => Boolean(t));
                return (
                  <PlaylistCard
                    key={pl.id}
                    playlist={pl}
                    tracks={tracks}
                    mood={pl.moodCategoryId ? moodById.get(pl.moodCategoryId) : undefined}
                    onOpen={() => onOpenPlaylist(pl.id)}
                    onPlay={
                      plTracks.length > 0
                        ? () => void playTrack(plTracks[0], plTracks, pl.name)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <TrackMetadataModal
        track={editingTrack}
        open={Boolean(editingTrack)}
        onOpenChange={(o) => !o && setEditingTrack(null)}
      />
    </div>
  );
};
