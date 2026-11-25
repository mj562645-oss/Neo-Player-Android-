import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ListMusic,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '../app/PlayerContext';
import { formatTime } from '../lib/format';
import { cn } from '../lib/utils';
import { AlbumArtwork } from './AlbumArtwork';
import { GlassButton } from './glass/GlassButton';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    currentIndex,
    queueOpen,
    setQueueOpen,
    resolveTrack,
    playQueueIndex,
    removeQueueItem,
    reorderQueue,
    shuffleUpcomingQueue,
    clearQueue,
  } = usePlayer();

  const currentItem = currentIndex >= 0 ? queue[currentIndex] : undefined;
  const currentTrack = currentItem ? resolveTrack(currentItem.trackId) : undefined;
  const upcoming = queue
    .map((item, idx) => ({ item, idx, track: resolveTrack(item.trackId) }))
    .filter((entry) => entry.idx > currentIndex && entry.track);

  return (
    <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 pt-6 pb-4 border-b border-black/8 dark:border-white/10 flex items-center justify-between gap-4 pr-14">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-[#FF2D55]" />
              <span>Playing Queue</span>
            </DialogTitle>
            <DialogDescription className="mt-0.5">
              {upcoming.length} upcoming {upcoming.length === 1 ? 'track' : 'tracks'}
            </DialogDescription>
          </div>
          {upcoming.length > 0 && (
            <div className="flex items-center gap-2">
              <GlassButton size="sm" onClick={shuffleUpcomingQueue} title="Shuffle upcoming">
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Shuffle</span>
              </GlassButton>
              <GlassButton size="sm" onClick={clearQueue} title="Clear upcoming queue">
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </GlassButton>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto scrollbar-thin space-y-5 flex-1">
          {currentTrack && (
            <div>
              <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] mb-2">
                Now Playing
              </p>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FF2D55]/10 dark:bg-[#FF375F]/15">
                <AlbumArtwork
                  artworkId={currentTrack.artworkId}
                  artworkUrl={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                  size="sm"
                  rounded="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#FF2D55] dark:text-[#FF375F] truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                    {currentTrack.artist} · {currentTrack.album}
                  </p>
                </div>
                <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
                  {formatTime(currentTrack.duration)}
                </span>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] mb-2">
              Up Next
            </p>
            {upcoming.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
                No upcoming tracks in queue. Add tracks from your library using Play Next or Add to Queue.
              </div>
            ) : (
              <div className="space-y-1">
                {upcoming.map(({ item, idx, track }) => {
                  if (!track) return null;
                  return (
                    <div
                      key={item.queueId}
                      className={cn(
                        'flex items-center gap-2.5 p-2 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void playQueueIndex(idx)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <AlbumArtwork
                          artworkId={track.artworkId}
                          artworkUrl={track.artworkUrl}
                          alt={track.title}
                          fallbackSeed={`${track.album}-${track.artist}`}
                          size="xs"
                          rounded="md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#111216] dark:text-[#F5F5F7] truncate">
                            {track.title}
                          </p>
                          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                            {track.artist}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => reorderQueue(idx, idx - 1)}
                          disabled={idx <= currentIndex + 1}
                          aria-label={`Move ${track.title} up`}
                          className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white disabled:opacity-25 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => reorderQueue(idx, idx + 1)}
                          disabled={idx >= queue.length - 1}
                          aria-label={`Move ${track.title} down`}
                          className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#111216] dark:text-[#98989D] dark:hover:text-white disabled:opacity-25 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQueueItem(item.queueId)}
                          aria-label={`Remove ${track.title} from queue`}
                          className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#6E6E73] hover:text-[#FF2D55] dark:text-[#98989D] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
