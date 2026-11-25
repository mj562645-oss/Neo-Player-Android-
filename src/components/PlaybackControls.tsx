import React from 'react';
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { RepeatMode } from '../types/music';

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
}) => {
  const isLg = size === 'lg';

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
            ? 'text-[#FF2D55] dark:text-[#FF375F] bg-[#FF2D55]/12'
            : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/8'
        )}
      >
        <Shuffle className="w-[18px] h-[18px]" />
      </button>

      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label="Previous track"
        className="min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center text-[#111216] dark:text-white hover:bg-black/6 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
      >
        <SkipBack className={cn(isLg ? 'w-7 h-7' : 'w-5 h-5')} fill="currentColor" />
      </button>

      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'rounded-full flex items-center justify-center bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-40',
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
        className="min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center text-[#111216] dark:text-white hover:bg-black/6 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
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
            ? 'text-[#FF2D55] dark:text-[#FF375F] bg-[#FF2D55]/12'
            : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/8'
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
