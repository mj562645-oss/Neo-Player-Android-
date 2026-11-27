import React from 'react';
import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipForward,
} from 'lucide-react';
import { usePlayer } from '../app/PlayerContext';
import { useTheme } from '../app/ThemeContext';
import { useArtworkUrl, useDominantColor } from '../hooks/useDominantColor';
import { cn } from '../lib/utils';
import { AlbumArtwork } from './AlbumArtwork';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeat,
    togglePlay,
    nextTrack,
    cycleRepeat,
    toggleTrackLike,
    setNowPlayingOpen,
    setQueueOpen,
  } = usePlayer();
  const { settings, resolvedTheme } = useTheme();

  const resolvedArtworkUrl = useArtworkUrl(currentTrack?.artworkId);
  const artworkSrc = resolvedArtworkUrl || currentTrack?.artworkUrl || null;
  const { palette } = useDominantColor(currentTrack?.artworkId, currentTrack?.artworkUrl);

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const isLivePill = settings.personalization.liveMediaPill ?? true;
  const uiTheme = settings.personalization.uiTheme || 'neo';
  const showAlbumBackdrop = isLivePill && Boolean(artworkSrc);

  const repeatLabel =
    repeat === 'one'
      ? 'Repeat one active (tap to turn off)'
      : repeat === 'all'
        ? 'Repeat all active (tap for repeat one)'
        : 'Repeat off (tap for repeat all)';

  return (
    <div
      className={cn(
        'fixed left-3 right-3 z-30 bottom-[68px] lg:bottom-4 lg:left-[272px] lg:right-6 pointer-events-none'
      )}
    >
      <div
        className={cn(
          'pointer-events-auto relative overflow-hidden max-w-4xl mx-auto transition-all duration-300',
          isLivePill
            ? uiTheme === 'windows'
              ? 'rounded-[14px] border border-black/12 dark:border-white/18 shadow-xl'
              : 'rounded-full border border-black/10 dark:border-white/18 shadow-[0_14px_38px_-10px_rgba(0,0,0,0.42)]'
            : 'liquid-glass-elevated neo-card-radius'
        )}
        style={
          !isLivePill
            ? {
                backgroundImage: `linear-gradient(120deg, ${palette.primary}, transparent 65%)`,
              }
            : {
                backgroundColor:
                  resolvedTheme === 'dark' ? 'rgba(18, 20, 28, 0.88)' : 'rgba(248, 249, 252, 0.90)',
              }
        }
      >
        {/* Blurred Album Art Live Pill Background */}
        {isLivePill && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {showAlbumBackdrop && artworkSrc ? (
              <img
                src={artworkSrc}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-125 blur-2xl saturate-150 transition-opacity duration-500"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${palette.primary}, ${palette.secondary})`,
                }}
              />
            )}
            <div
              className={cn(
                'absolute inset-0 transition-colors duration-300',
                resolvedTheme === 'dark'
                  ? 'bg-gradient-to-r from-[#0B0C12]/80 via-[#10121B]/68 to-[#0B0C12]/82'
                  : 'bg-gradient-to-r from-white/82 via-white/70 to-white/82'
              )}
            />
          </div>
        )}

        <div
          className={cn(
            'relative z-10 flex items-center gap-2 sm:gap-3 min-h-[56px]',
            isLivePill ? 'pl-2.5 pr-2 py-1.5 sm:pl-3 sm:pr-3' : 'px-3 py-2'
          )}
        >
          <button
            type="button"
            onClick={() => setNowPlayingOpen(true)}
            className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 text-left cursor-pointer"
          >
            <div className="relative shrink-0">
              <AlbumArtwork
                artworkId={currentTrack.artworkId}
                artworkUrl={currentTrack.artworkUrl}
                alt={currentTrack.title}
                fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                size="xs"
                rounded={isLivePill ? 'full' : 'md'}
                className={cn(
                  isLivePill &&
                    isPlaying &&
                    !settings.reducedMotion &&
                    'ring-2 ring-[var(--neo-accent)]/70'
                )}
              />
              {isLivePill && isPlaying && !settings.reducedMotion && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--neo-accent)] ring-2 ring-white dark:ring-[#10121B] animate-pulse"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#111216] dark:text-[#F5F5F7] truncate">
                {currentTrack.title}
              </p>
              <p className="text-xs text-[#48484A] dark:text-[#C7C7CC] truncate">
                {currentTrack.artist}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={repeatLabel}
              title={repeatLabel}
              className={cn(
                'flex min-h-[44px] min-w-[38px] sm:min-w-[42px] items-center justify-center rounded-full active:scale-90 transition-all cursor-pointer',
                repeat === 'off'
                  ? 'text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
                  : 'text-[var(--neo-accent)]'
              )}
            >
              {repeat === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void toggleTrackLike(currentTrack)}
              aria-label={currentTrack.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:scale-90 transition-all cursor-pointer',
                currentTrack.isFavourite
                  ? 'text-[#FF2D55] dark:text-[#FF375F]'
                  : 'text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
              )}
            >
              <Heart className="w-4 h-4" fill={currentTrack.isFavourite ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={cn(
                'min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer',
                isLivePill
                  ? 'bg-black/8 dark:bg-white/16 text-[#111216] dark:text-white hover:bg-black/14 dark:hover:bg-white/24'
                  : 'text-[#111216] dark:text-white hover:bg-black/6 dark:hover:bg-white/10'
              )}
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
              className="hidden sm:flex min-h-[44px] min-w-[44px] rounded-full items-center justify-center text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hairline progress indicator */}
        <div
          className={cn(
            'relative z-10 h-[2px] w-full bg-black/8 dark:bg-white/12',
            isLivePill && uiTheme !== 'windows' && 'mx-4 w-[calc(100%-2rem)]'
          )}
        >
          <div
            className="h-full bg-[var(--neo-accent)] dark:bg-white transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
