import React, { useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCw, Sparkles, Trash2, Youtube } from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useYouTube } from '../../app/YouTubeContext';
import { createId, cn } from '../../lib/utils';
import { buildSmartPlaylistDrafts } from '../../services/smartPlaylistService';
import type { MoodCategory, Track } from '../../types/music';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassModal } from '../../components/glass/GlassModal';
import { PlaylistCard } from '../../components/PlaylistCard';
import { YouTubeView } from '../youtube/YouTubeView';
import { PlaylistDetailView } from './PlaylistDetailView';

interface PlaylistsViewProps {
  selectedPlaylistId: string | null;
  onSelectPlaylist: (id: string | null) => void;
  onCreatePlaylist: (moodCategoryId?: string) => void;
  onOpenLyricsForTrack?: (trackId: string) => void;
}

const ACCENT_PALETTE = ['#5E5CE6', '#FF2D55', '#0A84FF', '#30D158', '#FF9F0A', '#64D2FF', '#BF5AF2'];

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  onOpenLyricsForTrack,
}) => {
  const { tracks, playlists, upsertSmartPlaylist, generateSmartMixes } = useLibrary();
  const { playTrack } = usePlayer();
  const { settings, upsertMoodCategory, deleteMoodCategory } = useTheme();
  const { playlists: ytPlaylists, isConnected: ytConnected } = useYouTube();

  const [sourceTab, setSourceTab] = useState<'local' | 'youtube'>('local');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [editingMood, setEditingMood] = useState<MoodCategory | null>(null);
  const [moodName, setMoodName] = useState('');
  const [moodDesc, setMoodDesc] = useState('');
  const [moodColor, setMoodColor] = useState(ACCENT_PALETTE[0]);

  const smartDrafts = useMemo(
    () =>
      buildSmartPlaylistDrafts(
        tracks,
        settings.followedArtists || [],
        settings.moodCategories || []
      ),
    [tracks, settings.followedArtists, settings.moodCategories]
  );

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const moodById = useMemo(
    () => new Map(settings.moodCategories.map((m) => [m.id, m])),
    [settings.moodCategories]
  );

  const visiblePlaylists = useMemo(() => {
    if (moodFilter === 'all') return playlists;
    return playlists.filter((p) => p.moodCategoryId === moodFilter);
  }, [playlists, moodFilter]);

  if (selectedPlaylistId) {
    return (
      <PlaylistDetailView
        playlistId={selectedPlaylistId}
        onBack={() => onSelectPlaylist(null)}
      />
    );
  }

  const openMoodEditor = (mood?: MoodCategory) => {
    if (mood) {
      setEditingMood(mood);
      setMoodName(mood.name);
      setMoodDesc(mood.description);
      setMoodColor(mood.accentColor);
    } else {
      setEditingMood(null);
      setMoodName('');
      setMoodDesc('');
      setMoodColor(ACCENT_PALETTE[0]);
    }
    setMoodModalOpen(true);
  };

  const handleSaveMood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moodName.trim()) return;
    await upsertMoodCategory({
      id: editingMood ? editingMood.id : createId('mood'),
      name: moodName.trim(),
      description: moodDesc.trim() || 'Custom mood collection',
      accentColor: moodColor,
      isDefault: editingMood?.isDefault,
    });
    setMoodModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Playlists</h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Personal mixes, mood collections, and YouTube Music playlists
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-subtle">
            <button
              type="button"
              onClick={() => setSourceTab('local')}
              className={cn(
                'min-h-[36px] px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                sourceTab === 'local'
                  ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#98989D]'
              )}
            >
              Local ({playlists.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('youtube')}
              className={cn(
                'min-h-[36px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                sourceTab === 'youtube'
                  ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#98989D]'
              )}
            >
              <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />
              <span>YouTube{ytConnected ? ` (${ytPlaylists.length})` : ''}</span>
            </button>
          </div>

          {sourceTab === 'local' && smartDrafts.length > 0 && (
            <GlassButton size="sm" onClick={() => void generateSmartMixes(smartDrafts)}>
              <Sparkles className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
              <span>Create Mixes For Me</span>
            </GlassButton>
          )}
          {sourceTab === 'local' && (
            <>
              <GlassButton size="sm" onClick={() => openMoodEditor()}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>New Mood</span>
              </GlassButton>
              <GlassButton
                size="sm"
                variant="accent"
                onClick={() => onCreatePlaylist(moodFilter !== 'all' ? moodFilter : undefined)}
              >
                <Plus className="w-4 h-4" />
                <span>New Playlist</span>
              </GlassButton>
            </>
          )}
        </div>
      </div>

      {sourceTab === 'youtube' ? (
        <YouTubeView
          initialTab="playlists"
          embedded
          onOpenLyricsForTrack={onOpenLyricsForTrack}
        />
      ) : (
        <>

      {/* Mood Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => setMoodFilter('all')}
          className={cn(
            'min-h-[38px] px-4 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer',
            moodFilter === 'all'
              ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F]'
              : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2]'
          )}
        >
          All Playlists
        </button>
        {settings.moodCategories.map((mood) => {
          const active = moodFilter === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => setMoodFilter(mood.id)}
              className={cn(
                'min-h-[38px] px-3.5 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-2 transition-all cursor-pointer',
                active
                  ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F]'
                  : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2]'
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: mood.accentColor }}
              />
              <span>{mood.name}</span>
            </button>
          );
        })}
      </div>

      {/* Playlists Grid */}
      {visiblePlaylists.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="text-base font-semibold">
            {moodFilter === 'all'
              ? 'No playlists created yet'
              : `No playlists in "${moodById.get(moodFilter)?.name || 'this mood'}" yet`}
          </p>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
            Create a playlist and assign a mood category to keep your listening organised.
          </p>
          <GlassButton
            size="sm"
            variant="accent"
            className="mt-4"
            onClick={() => onCreatePlaylist(moodFilter !== 'all' ? moodFilter : undefined)}
          >
            <Plus className="w-4 h-4" />
            <span>Create Playlist</span>
          </GlassButton>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {visiblePlaylists.map((pl) => {
            const plTracks = pl.trackIds
              .map((id) => trackById.get(id))
              .filter((t): t is Track => Boolean(t));
            return (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                tracks={tracks}
                mood={pl.moodCategoryId ? moodById.get(pl.moodCategoryId) : undefined}
                onOpen={() => onSelectPlaylist(pl.id)}
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

      {/* Tailored Auto-Playlists */}
      {smartDrafts.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold tracking-tight font-display">
                Made For Your Library
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                One-tap auto-generated mixes based on plays, favourites, genres, and followed artists
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {smartDrafts.map((draft) => {
              const existing = playlists.find((p) => p.smartKey === draft.smartKey);
              return (
                <GlassCard
                  key={draft.smartKey}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{draft.name}</p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                      {draft.reason}
                    </p>
                  </div>
                  <GlassButton
                    size="sm"
                    variant={existing ? 'glass' : 'accent'}
                    onClick={() =>
                      void upsertSmartPlaylist(draft).then((pl) => onSelectPlaylist(pl.id))
                    }
                  >
                    {existing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create</span>
                      </>
                    )}
                  </GlassButton>
                </GlassCard>
              );
            })}
          </div>
        </section>
      )}

      {/* Editable Mood Categories */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight font-display">Mood Categories</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {settings.moodCategories.map((mood) => (
            <GlassCard key={mood.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: mood.accentColor }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{mood.name}</p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                    {mood.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openMoodEditor(mood)}
                  aria-label={`Edit ${mood.name}`}
                  className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {settings.moodCategories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (moodFilter === mood.id) setMoodFilter('all');
                      void deleteMoodCategory(mood.id);
                    }}
                    aria-label={`Delete ${mood.name}`}
                    className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#FF2D55] dark:text-[#98989D] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
      </>
      )}

      <GlassModal
        open={moodModalOpen}
        onOpenChange={setMoodModalOpen}
        title={editingMood ? 'Edit Mood Category' : 'New Mood Category'}
      >
        <form onSubmit={handleSaveMood} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
              Category Name
            </span>
            <input
              type="text"
              required
              value={moodName}
              onChange={(e) => setMoodName(e.target.value)}
              placeholder="Rainy Afternoon"
              className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
              Description
            </span>
            <input
              type="text"
              value={moodDesc}
              onChange={(e) => setMoodDesc(e.target.value)}
              placeholder="Warm acoustic and ambient tracks"
              className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
            />
          </label>
          <div>
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-2">
              Accent Tint
            </span>
            <div className="flex items-center gap-2.5">
              {ACCENT_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setMoodColor(hex)}
                  aria-label={`Select color ${hex}`}
                  className={cn(
                    'w-8 h-8 rounded-full cursor-pointer transition-transform',
                    moodColor === hex && 'ring-2 ring-offset-2 ring-[#111216] dark:ring-white scale-110'
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="ghost" onClick={() => setMoodModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="accent">
              Save Category
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
};
