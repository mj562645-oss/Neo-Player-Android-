import React from 'react';
import {
  FastForward,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Rewind,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { RepeatMode, UiThemeId } from '../types/music';

interface PlaybackControlsProps {
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  size?: 'md' | 'lg';
  disabled?: boolean;
  uiTheme?: UiThemeId;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  shuffle,
  repeat,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleShuffle,
  onCycleRepeat,
  size = 'lg',
  disabled = false,
  uiTheme = 'neo',
}) => {
  const isLg = size === 'lg';

  // Material 3: ultra-clean centered transport trio (Rewind · High-Contrast Circle Play/Pause · FastForward)
  if (uiTheme === 'material') {
    return (
      <div className="flex items-center justify-center gap-7 sm:gap-9 w-full max-w-xs mx-auto">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled}
          aria-label="Previous track"
          className="min-h-[52px] min-w-[52px] rounded-full flex items-center justify-center text-[#14151A] dark:text-white hover:bg-black/6 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
        >
          <Rewind className={cn(isLg ? 'w-8 h-8' : 'w-6 h-6')} fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={cn(
            'rounded-full flex items-center justify-center bg-[#14151A] text-white dark:bg-white dark:text-[#121214] shadow-xl active:scale-95 transition-transform duration-200 cursor-pointer disabled:opacity-40',
            isLg ? 'w-[74px] h-[74px]' : 'w-14 h-14'
          )}
        >
          {isPlaying ? (
            <Pause className={cn(isLg ? 'w-8 h-8' : 'w-6 h-6')} fill="currentColor" />
          ) : (
            <Play className={cn(isLg ? 'w-8 h-8 ml-0.5' : 'w-6 h-6 ml-0.5')} fill="currentColor" />
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          aria-label="Next track"
          className="min-h-[52px] min-w-[52px] rounded-full flex items-center justify-center text-[#14151A] dark:text-white hover:bg-black/6 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
        >
          <FastForward className={cn(isLg ? 'w-8 h-8' : 'w-6 h-6')} fill="currentColor" />
        </button>
      </div>
    );
  }

  const playSurfaceClass =
    uiTheme === 'editorial'
      ? 'bg-[#161514] text-[#FAF8F4] dark:bg-[#F4EFE6] dark:text-[#111113] ring-1 ring-black/10 dark:ring-white/20 shadow-lg'
      : cn(
          'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-lg',
          isPlaying && 'ring-4 ring-[var(--neo-accent-soft)]'
        );

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 w-full max-w-sm mx-auto">
      <button
        type="button"
        onClick={onToggleShuffle}
        disabled={disabled}
        aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
        aria-pressed={shuffle}
        className={cn(
          'min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40',
          shuffle
            ? 'text-[var(--neo-accent)] bg-[var(--neo-accent-soft)]'
            : 'text-[#525258] dark:text-[#B8B8BE] hover:text-[#111216] dark:hover:text-white hover:bg-black/8 dark:hover:bg-white/10'
        )}
      >
        <Shuffle className="w-[18px] h-[18px]" />
      </button>

      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label="Previous track"
        className="min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center text-[#111216] dark:text-white hover:bg-black/8 dark:hover:bg-white/12 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
      >
        <SkipBack className={cn(isLg ? 'w-7 h-7' : 'w-5 h-5')} fill="currentColor" />
      </button>

      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-40',
          playSurfaceClass,
          isLg ? 'w-16 h-16' : 'w-12 h-12'
        )}
      >
        {isPlaying ? (
          <Pause className={cn(isLg ? 'w-7 h-7' : 'w-5 h-5')} fill="currentColor" />
        ) : (
          <Play className={cn(isLg ? 'w-7 h-7 ml-0.5' : 'w-5 h-5 ml-0.5')} fill="currentColor" />
        )}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label="Next track"
        className="min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center text-[#111216] dark:text-white hover:bg-black/8 dark:hover:bg-white/12 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
      >
        <SkipForward className={cn(isLg ? 'w-7 h-7' : 'w-5 h-5')} fill="currentColor" />
      </button>

      <button
        type="button"
        onClick={onCycleRepeat}
        disabled={disabled}
        aria-label={`Repeat mode: ${repeat}`}
        className={cn(
          'min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40',
          repeat !== 'off'
            ? 'text-[var(--neo-accent)] bg-[var(--neo-accent-soft)]'
            : 'text-[#525258] dark:text-[#B8B8BE] hover:text-[#111216] dark:hover:text-white hover:bg-black/8 dark:hover:bg-white/10'
        )}
      >
        {repeat === 'one' ? (
          <Repeat1 className="w-[18px] h-[18px]" />
        ) : (
          <Repeat className="w-[18px] h-[18px]" />
        )}
      </button>
    </div>
  );
};
