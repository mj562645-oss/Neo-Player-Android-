import React from 'react';
import { Pause, Play, Radio, SkipBack, SkipForward, X } from 'lucide-react';
import { useDiscovery } from '../app/DiscoveryContext';
import { usePlayer } from '../app/PlayerContext';
import { formatTime } from '../lib/format';
import { cn } from '../lib/utils';

export const TuneInBar: React.FC = () => {
  const {
    previewState,
    togglePreviewPlay,
    nextPreviewTrack,
    prevPreviewTrack,
    stopPreview,
  } = useDiscovery();
  const { currentTrack } = usePlayer();

  if (!previewState.currentTrack) return null;

  const track = previewState.currentTrack;
  const pct =
    previewState.duration > 0
      ? Math.min(100, Math.round((previewState.currentTime / previewState.duration) * 100))
      : 0;

  return (
    <div
      role="region"
      aria-label="Tune In preview player"
      className={cn(
        'fixed left-3 right-3 lg:left-[272px] lg:right-6 z-40 transition-all',
        currentTrack ? 'bottom-[142px] lg:bottom-24' : 'bottom-[74px] lg:bottom-6'
      )}
    >
      <div className="liquid-glass-elevated rounded-2xl px-3.5 py-2.5 flex items-center gap-3 max-w-4xl mx-auto shadow-xl">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center">
          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <Radio className="w-5 h-5 text-[var(--neo-accent)]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate text-[#111216] dark:text-[#F5F5F7]">
              {track.title}
            </p>
          </div>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
            {track.artist} · {previewState.stationLabel} ·{' '}
            <span className="font-mono-tabular">
              {formatTime(previewState.currentTime)} / {formatTime(previewState.duration)}
            </span>
          </p>
          <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-1.5">
            <div
              className="h-full bg-[var(--neo-accent)] transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {previewState.queue.length > 1 && (
            <button
              type="button"
              onClick={() => void prevPreviewTrack()}
              aria-label="Previous station track"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#111216] dark:text-[#F5F5F7] hover:bg-black/6 dark:hover:bg-white/10 cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void togglePreviewPlay()}
            aria-label={previewState.isPlaying ? 'Pause preview' : 'Play preview'}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-[var(--neo-accent)] text-white flex items-center justify-center hover:brightness-110 cursor-pointer"
          >
            {previewState.isPlaying ? (
              <Pause className="w-4 h-4" fill="currentColor" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
            )}
          </button>
          {previewState.queue.length > 1 && (
            <button
              type="button"
              onClick={() => void nextPreviewTrack()}
              aria-label="Next station track"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#111216] dark:text-[#F5F5F7] hover:bg-black/6 dark:hover:bg-white/10 cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={stopPreview}
            aria-label="Stop Tune In preview"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
