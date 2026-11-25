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
}

export const ProgressSlider: React.FC<ProgressSliderProps> = ({
  currentTime,
  duration,
  onSeek,
  showRemaining = true,
  onToggleRemaining,
  compact = false,
  className,
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
        rangeClassName="bg-[var(--neo-accent)] dark:bg-white"
      />
      {!compact && (
        <div className="flex items-center justify-between text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D] -mt-1">
          <span>{formatTime(displayedTime)}</span>
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
