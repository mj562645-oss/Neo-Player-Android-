import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Edit3,
  ImagePlus,
  ListPlus,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { formatTime } from '../../lib/format';
import type { Track } from '../../types/music';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassModal } from '../../components/glass/GlassModal';

interface PlaylistDetailViewProps {
  playlistId: string;
  onBack: () => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlistId,
  onBack,
}) => {
  const {
    tracks,
    playlists,
    updatePlaylist,
    setPlaylistArtwork,
    deletePlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
  } = useLibrary();
  const { currentTrack, playTrack, addToQueue } = usePlayer();
  const { settings } = useTheme();

  const playlist = playlists.find((p) => p.id === playlistId);
  const artInputRef = useRef<HTMLInputElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [addTracksOpen, setAddTracksOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMood, setEditMood] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  if (!playlist) {
    return (
      <div className="space-y-4">
        <GlassButton size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Playlists</span>
        </GlassButton>
        <GlassCard className="p-8 text-center">
          <p className="text-base font-semibold">Playlist not found</p>
        </GlassCard>
      </div>
    );
  }

  const playlistTracks = playlist.trackIds
    .map((id, idx) => ({ track: trackById.get(id), idx }))
    .filter((item): item is { track: Track; idx: number } => Boolean(item.track));

  const pureTracks = playlistTracks.map((item) => item.track);
  const totalDuration = pureTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const coverArtworkId = playlist.artworkId || pureTracks.find((t) => t.artworkId)?.artworkId;
  const mood = settings.moodCategories.find((m) => m.id === playlist.moodCategoryId);

  const openEdit = () => {
    setEditName(playlist.name);
    setEditDesc(playlist.description);
    setEditMood(playlist.moodCategoryId || '');
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await updatePlaylist(playlist.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      moodCategoryId: editMood || undefined,
    });
    setEditOpen(false);
  };

  const candidateTracks = tracks.filter((t) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <input
        ref={artInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void setPlaylistArtwork(playlist.id, f);
          e.target.value = '';
        }}
        className="hidden"
      />

      <GlassButton size="sm" variant="ghost" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        <span>All Playlists</span>
      </GlassButton>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
        <div className="relative group">
          <AlbumArtwork
            artworkId={coverArtworkId}
            alt={playlist.name}
            fallbackSeed={playlist.name}
            accentColor={mood?.accentColor}
            size="lg"
            rounded="2xl"
            className="w-40 h-40 sm:w-48 sm:h-48 shadow-xl"
          />
          <button
            type="button"
            onClick={() => artInputRef.current?.click()}
            aria-label="Change playlist cover"
            className="absolute bottom-2.5 right-2.5 min-h-[40px] min-w-[40px] rounded-full liquid-glass-elevated flex items-center justify-center text-[#111216] dark:text-white cursor-pointer hover:scale-105 transition-transform"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 min-w-0 flex-1">
          {mood && (
            <p className="text-xs font-semibold" style={{ color: mood.accentColor }}>
              {mood.name}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-balance">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D]">{playlist.description}</p>
          )}
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] font-mono-tabular">
            {pureTracks.length} {pureTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
            {formatTime(totalDuration)}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <GlassButton
              variant="accent"
              disabled={pureTracks.length === 0}
              onClick={() => void playTrack(pureTracks[0], pureTracks, playlist.name)}
            >
              <Play className="w-4 h-4" fill="currentColor" />
              <span>Play</span>
            </GlassButton>
            <GlassButton
              disabled={pureTracks.length === 0}
              onClick={() => addToQueue(pureTracks, playlist.name)}
            >
              <ListPlus className="w-4 h-4" />
              <span>Add to Queue</span>
            </GlassButton>
            <GlassButton onClick={() => setAddTracksOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Add Songs</span>
            </GlassButton>
            <GlassButton onClick={openEdit}>
              <Edit3 className="w-4 h-4" />
              <span>Rename</span>
            </GlassButton>
            <GlassButton
              onClick={() => setConfirmDeleteOpen(true)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </GlassButton>
          </div>
        </div>
      </div>

      {playlistTracks.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="text-base font-semibold">This playlist is empty</p>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
            Add tracks from your offline library to build this collection.
          </p>
          <GlassButton
            variant="accent"
            size="sm"
            className="mt-4"
            onClick={() => setAddTracksOpen(true)}
          >
            <Plus className="w-4 h-4" />
            <span>Add Songs</span>
          </GlassButton>
        </GlassCard>
      ) : (
        <GlassCard className="p-2 sm:p-3 space-y-1">
          {playlistTracks.map(({ track, idx }) => {
            const isCur = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}-${idx}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => void playTrack(track, pureTracks, playlist.name)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <span className="w-6 text-center text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
                    {idx + 1}
                  </span>
                  <AlbumArtwork
                    artworkId={track.artworkId}
                    alt={track.title}
                    fallbackSeed={`${track.album}-${track.artist}`}
                    size="xs"
                    rounded="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCur ? 'text-[#FF2D55] dark:text-[#FF375F]' : ''
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                      {track.artist} · {track.album}
                    </p>
                  </div>
                </button>

                <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D] hidden sm:inline">
                  {formatTime(track.duration)}
                </span>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void reorderPlaylistTracks(playlist.id, idx, idx - 1)}
                    aria-label="Move track up"
                    className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white disabled:opacity-25 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === playlistTracks.length - 1}
                    onClick={() => void reorderPlaylistTracks(playlist.id, idx, idx + 1)}
                    aria-label="Move track down"
                    className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white disabled:opacity-25 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeTrackFromPlaylist(playlist.id, idx)}
                    aria-label={`Remove ${track.title} from playlist`}
                    className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#FF2D55] dark:text-[#98989D] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}

      {/* Rename / Edit Modal */}
      <GlassModal open={editOpen} onOpenChange={setEditOpen} title="Edit Playlist">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
              Name
            </span>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
              Description
            </span>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
              Mood Category
            </span>
            <select
              value={editMood}
              onChange={(e) => setEditMood(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            >
              <option value="">None</option>
              {settings.moodCategories.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <GlassButton variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="accent">
              Save
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Add Tracks Modal */}
      <GlassModal
        open={addTracksOpen}
        onOpenChange={setAddTracksOpen}
        title="Add Songs to Playlist"
        description="Tap any track to add it to this playlist."
      >
        <div className="space-y-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search library..."
            className="w-full min-h-[40px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
          />
          <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
            {candidateTracks.length === 0 ? (
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] py-6 text-center">
                No matching tracks in your library.
              </p>
            ) : (
              candidateTracks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void addTracksToPlaylist(playlist.id, [t.id])}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-left cursor-pointer"
                >
                  <AlbumArtwork
                    artworkId={t.artworkId}
                    alt={t.title}
                    fallbackSeed={t.album}
                    size="xs"
                    rounded="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                      {t.artist} · {t.album}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-[#FF2D55] shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      </GlassModal>

      {/* Confirm Delete Modal */}
      <GlassModal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Playlist?"
        description="Your audio files will remain safely in your library."
      >
        <div className="flex justify-end gap-2">
          <GlassButton variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
            Cancel
          </GlassButton>
          <GlassButton
            variant="accent"
            onClick={async () => {
              await deletePlaylist(playlist.id);
              setConfirmDeleteOpen(false);
              onBack();
            }}
          >
            Delete Playlist
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
};
