import React from 'react';
import { Play } from 'lucide-react';
import type { MoodCategory, Playlist, Track } from '../types/music';
import { AlbumArtwork } from './AlbumArtwork';
import { GlassCard } from './glass/GlassCard';

interface PlaylistCardProps {
  playlist: Playlist;
  tracks: Track[];
  mood?: MoodCategory;
  onOpen: () => void;
  onPlay?: () => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  tracks,
  mood,
  onOpen,
  onPlay,
}) => {
  const trackMap = React.useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const playlistTracks = playlist.trackIds
    .map((id) => trackMap.get(id))
    .filter((t): t is Track => Boolean(t));

  const coverArtId =
    playlist.artworkId || playlistTracks.find((t) => t.artworkId)?.artworkId;

  return (
    <GlassCard
      interactive
      onClick={onOpen}
      className="group p-3 flex flex-col gap-3"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
        <AlbumArtwork
          artworkId={coverArtId}
          alt={playlist.name}
          fallbackSeed={playlist.name}
          accentColor={mood?.accentColor}
          size="fill"
          rounded="xl"
        />
        {playlistTracks.length > 0 && onPlay && (
          <button
            type="button"
            aria-label={`Play ${playlist.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-white/90 dark:bg-[#1C1D24]/90 backdrop-blur-md text-[#111216] dark:text-white shadow-lg flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer hover:scale-105"
          >
            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
          </button>
        )}
      </div>

      <div className="min-w-0 px-0.5">
        <h3 className="text-sm font-semibold text-[#111216] dark:text-[#F5F5F7] truncate">
          {playlist.name}
        </h3>
        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
          <span>
            {playlistTracks.length} {playlistTracks.length === 1 ? 'track' : 'tracks'}
          </span>
          {mood && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{mood.name}</span>
            </>
          )}
        </p>
      </div>
    </GlassCard>
  );
};
