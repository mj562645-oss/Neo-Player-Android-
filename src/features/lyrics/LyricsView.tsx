import React, { useEffect, useState } from 'react';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GlassCard } from '../../components/glass/GlassCard';
import { LyricsViewer } from '../../components/LyricsViewer';

interface LyricsViewProps {
  focusedTrackId?: string | null;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ focusedTrackId }) => {
  const { tracks, lyricsMap } = useLibrary();
  const { currentTrack } = usePlayer();
  const [selectedId, setSelectedId] = useState<string | null>(
    focusedTrackId || currentTrack?.id || tracks[0]?.id || null
  );

  useEffect(() => {
    if (focusedTrackId) {
      setSelectedId(focusedTrackId);
    } else if (currentTrack?.id) {
      setSelectedId(currentTrack.id);
    }
  }, [focusedTrackId, currentTrack?.id]);

  const availableTracks = React.useMemo(() => {
    if (currentTrack && !tracks.some((t) => t.id === currentTrack.id)) {
      return [currentTrack, ...tracks];
    }
    return tracks;
  }, [tracks, currentTrack]);

  const activeTrack =
    availableTracks.find((t) => t.id === selectedId) || currentTrack || availableTracks[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">Lyrics</h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Synchronized LRC & plain lyrics stored locally
          </p>
        </div>

        {availableTracks.length > 0 && (
          <select
            aria-label="Select track for lyrics"
            value={activeTrack?.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-h-[42px] max-w-xs px-3.5 rounded-2xl liquid-glass-subtle text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FF2D55] cursor-pointer"
          >
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.artist} {lyricsMap[t.id] ? '★' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {activeTrack && (
        <GlassCard className="p-4 flex items-center gap-4">
          <AlbumArtwork
            artworkId={activeTrack.artworkId}
            artworkUrl={activeTrack.artworkUrl}
            alt={activeTrack.title}
            fallbackSeed={`${activeTrack.album}-${activeTrack.artist}`}
            size="md"
            rounded="xl"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold truncate font-display">{activeTrack.title}</h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
              {activeTrack.artist} · {activeTrack.album}
            </p>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5 sm:p-6 min-h-[420px] flex flex-col">
        <LyricsViewer track={activeTrack} autoFetchOnEmpty />
      </GlassCard>
    </div>
  );
};
