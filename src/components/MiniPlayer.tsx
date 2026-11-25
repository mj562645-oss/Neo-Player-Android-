import React from 'react';
import { Heart, ListMusic, Pause, Play, SkipForward } from 'lucide-react';
import { usePlayer } from '../app/PlayerContext';
import { useDominantColor } from '../hooks/useDominantColor';
import { cn } from '../lib/utils';
import { AlbumArtwork } from './AlbumArtwork';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    toggleTrackLike,
    setNowPlayingOpen,
    setQueueOpen,
  } = usePlayer();

  const { palette } = useDominantColor(currentTrack?.artworkId, currentTrack?.artworkUrl);

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      className={cn(
        'fixed left-3 right-3 z-30 bottom-[68px] lg:bottom-4 lg:left-[272px] lg:right-6 pointer-events-none'
      )}
    >
      <div
        className="pointer-events-auto relative overflow-hidden liquid-glass-elevated neo-card-radius max-w-4xl mx-auto"
        style={{
          backgroundImage: `linear-gradient(120deg, ${palette.primary}, transparent 65%)`,
        }}
      >
        <div className="flex items-center gap-3 px-3 py-2 min-h-[56px]">
          <button
            type="button"
            onClick={() => setNowPlayingOpen(true)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
          >
            <AlbumArtwork
              artworkId={currentTrack.artworkId}
              artworkUrl={currentTrack.artworkUrl}
              alt={currentTrack.title}
              fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
              size="xs"
              rounded="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#111216] dark:text-[#F5F5F7] truncate">
                {currentTrack.title}
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                {currentTrack.artist}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => void toggleTrackLike(currentTrack)}
              aria-label={currentTrack.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:scale-90 transition-all cursor-pointer',
                currentTrack.isFavourite
                  ? 'text-[#FF2D55] dark:text-[#FF375F]'
                  : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white'
              )}
            >
              <Heart className="w-4 h-4" fill={currentTrack.isFavourite ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[#111216] dark:text-white hover:bg-black/6 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void nextTrack()}
              aria-label="Next track"
              className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[#111216] dark:text-white hover:bg-black/6 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              <SkipForward className="w-5 h-5" fill="currentColor" />
            </button>

            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              aria-label="Open queue"
              className="hidden sm:flex min-h-[44px] min-w-[44px] rounded-full items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hairline progress indicator */}
        <div className="h-[2px] w-full bg-black/8 dark:bg-white/10">
          <div
            className="h-full bg-[var(--neo-accent)] dark:bg-white transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
