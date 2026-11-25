import React from 'react';
import {
  Check,
  CloudDownload,
  Edit3,
  Heart,
  ListEnd,
  ListMusic,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  Quote,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { formatTime } from '../lib/format';
import { cn } from '../lib/utils';
import type { Playlist, Track } from '../types/music';
import { AlbumArtwork } from './AlbumArtwork';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface TrackRowProps {
  track: Track;
  index?: number;
  isCurrent?: boolean;
  isPlaying?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  playlists?: Playlist[];
  onPlay: () => void;
  onToggleSelect?: () => void;
  onToggleFavourite?: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist?: (playlistId: string) => void;
  onEditMetadata?: () => void;
  onAutoEnrich?: () => void;
  onDownloadLyrics?: () => void;
  onOpenLyrics?: () => void;
  onDelete?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isCurrent = false,
  isPlaying = false,
  selectionMode = false,
  selected = false,
  playlists = [],
  onPlay,
  onToggleSelect,
  onToggleFavourite,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onEditMetadata,
  onAutoEnrich,
  onDownloadLyrics,
  onOpenLyrics,
  onDelete,
}) => {
  const handleRowClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect();
    } else {
      onPlay();
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-2xl transition-colors min-h-[60px]',
        isCurrent
          ? 'bg-[#FF2D55]/10 dark:bg-[#FF375F]/15'
          : selected
            ? 'bg-black/6 dark:bg-white/10'
            : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
      )}
    >
      {selectionMode ? (
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={selected ? `Deselect ${track.title}` : `Select ${track.title}`}
          className={cn(
            'w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer',
            selected
              ? 'bg-[#FF2D55] border-[#FF2D55] text-white'
              : 'border-black/25 dark:border-white/30'
          )}
        >
          {selected && <Check className="w-3.5 h-3.5" />}
        </button>
      ) : (
        index !== undefined && (
          <span className="hidden sm:inline-block w-6 text-center text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D] shrink-0">
            {isCurrent && isPlaying ? (
              <Pause className="w-3.5 h-3.5 mx-auto text-[#FF2D55]" fill="currentColor" />
            ) : (
              index + 1
            )}
          </span>
        )
      )}

      <button
        type="button"
        onClick={handleRowClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
      >
        <div className="relative shrink-0">
          <AlbumArtwork
            artworkId={track.artworkId}
            artworkUrl={track.artworkUrl}
            alt={`${track.title} album art`}
            fallbackSeed={`${track.album}-${track.artist}`}
            size="sm"
            rounded="lg"
          />
          {!selectionMode && (
            <div
              className={cn(
                'absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center text-white transition-opacity',
                isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4" fill="currentColor" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-medium truncate',
              isCurrent
                ? 'text-[#FF2D55] dark:text-[#FF375F]'
                : 'text-[#111216] dark:text-[#F5F5F7]'
            )}
          >
            {track.title}
          </p>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
            <span>{track.artist}</span>
            <span aria-hidden="true"> · </span>
            <span>{track.album}</span>
            <span className="hidden md:inline" aria-hidden="true"> · </span>
            <span className="hidden md:inline">{track.format}</span>
          </p>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {onToggleFavourite && (
          <button
            type="button"
            onClick={onToggleFavourite}
            aria-label={track.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            className={cn(
              'min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer',
              track.isFavourite
                ? 'text-[#FF2D55] dark:text-[#FF375F]'
                : 'text-[#8E8E93] opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[#FF2D55]'
            )}
          >
            <Heart className="w-4 h-4" fill={track.isFavourite ? 'currentColor' : 'none'} />
          </button>
        )}

        <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D] w-11 text-right hidden xs:inline-block sm:inline-block">
          {formatTime(track.duration)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${track.title}`}
              className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:bg-black/6 dark:hover:bg-white/10 hover:text-[#111216] dark:hover:text-white transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onPlayNext}>
              <ListPlus className="w-4 h-4" />
              <span>Play Next</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddToQueue}>
              <ListEnd className="w-4 h-4" />
              <span>Add to Queue</span>
            </DropdownMenuItem>
            {onOpenLyrics && (
              <DropdownMenuItem onSelect={onOpenLyrics}>
                <Quote className="w-4 h-4" />
                <span>View / Edit Lyrics</span>
              </DropdownMenuItem>
            )}
            {onDownloadLyrics && (
              <DropdownMenuItem onSelect={onDownloadLyrics}>
                <CloudDownload className="w-4 h-4" />
                <span>Download Lyrics</span>
              </DropdownMenuItem>
            )}
            {onAutoEnrich && (
              <DropdownMenuItem onSelect={onAutoEnrich}>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Fix Tags, Cover & Lyrics</span>
              </DropdownMenuItem>
            )}
            {onEditMetadata && (
              <DropdownMenuItem onSelect={onEditMetadata}>
                <Edit3 className="w-4 h-4" />
                <span>Edit Track Info</span>
              </DropdownMenuItem>
            )}
            {onAddToPlaylist && playlists.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {playlists.slice(0, 6).map((pl) => (
                  <DropdownMenuItem key={pl.id} onSelect={() => onAddToPlaylist(pl.id)}>
                    <ListMusic className="w-4 h-4" />
                    <span className="truncate">Add to {pl.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="text-red-600 dark:text-red-400 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove from Library</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
