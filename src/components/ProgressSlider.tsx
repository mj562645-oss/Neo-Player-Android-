import React, { useState } from 'react';
import { formatRemainingTime, formatTime } from '../lib/format';
import { cn } from '../lib/utils';
import { Slider } from './ui/slider';

interface ProgressSliderProps {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  showRemaining?: boolean;
  onToggleRemaining?: () => void;
  compact?: boolean;
  className?: string;
  minimal?: boolean;
  centerLabel?: React.ReactNode;
}

export const ProgressSlider: React.FC<ProgressSliderProps> = ({
  currentTime,
  duration,
  onSeek,
  showRemaining = true,
  onToggleRemaining,
  compact = false,
  className,
  minimal = false,
  centerLabel,
}) => {
  const [draggingValue, setDraggingValue] = useState<number | null>(null);
  const safeDuration = duration > 0 ? duration : 1;
  const displayedTime = draggingValue !== null ? draggingValue : currentTime;

  return (
    <div className={cn('w-full', className)}>
      <Slider
        aria-label="Playback position"
        min={0}
        max={safeDuration}
        step={0.25}
        value={[Math.min(safeDuration, Math.max(0, displayedTime))]}
        onValueChange={(vals) => {
          setDraggingValue(vals[0] ?? 0);
        }}
        onValueCommit={(vals) => {
          const target = vals[0] ?? 0;
          setDraggingValue(null);
          onSeek(target);
        }}
        trackClassName={
          minimal
            ? 'h-1 bg-black/14 dark:bg-white/22 group-hover:h-1.5'
            : undefined
        }
        rangeClassName={
          minimal
            ? 'bg-[#14151A] dark:bg-white'
            : 'bg-[var(--neo-accent)] dark:bg-white'
        }
        thumbClassName={
          minimal
            ? 'h-2.5 w-2.5 bg-[#14151A] dark:bg-white ring-0 shadow-sm opacity-90 group-hover:opacity-100 group-hover:scale-125'
            : undefined
        }
      />
      {!compact && (
        <div
          className={cn(
            'flex items-center justify-between text-xs font-mono-tabular -mt-1',
            minimal
              ? 'text-[#48484E] dark:text-white/65'
              : 'text-[#6E6E73] dark:text-[#98989D]'
          )}
        >
          <span>{formatTime(displayedTime)}</span>
          {centerLabel && (
            <div className="flex items-center justify-center px-2 truncate">
              {centerLabel}
            </div>
          )}
          <button
            type="button"
            onClick={onToggleRemaining}
            className="hover:text-[#111216] dark:hover:text-white transition-colors cursor-pointer"
            title="Toggle remaining / total duration"
          >
            {showRemaining ? formatRemainingTime(displayedTime, duration) : formatTime(duration)}
          </button>
        </div>
      )}
    </div>
  );
};
