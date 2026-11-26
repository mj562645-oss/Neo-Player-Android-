import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudDownload,
  Download,
  Edit3,
  FileText,
  Loader2,
  LocateFixed,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLibrary } from '../app/LibraryContext';
import { usePlayer } from '../app/PlayerContext';
import { useTheme } from '../app/ThemeContext';
import { formatTime } from '../lib/format';
import { findActiveLyricIndex, serializeLrc } from '../lib/lrcParser';
import { cn } from '../lib/utils';
import {
  extractSearchHints,
  fetchLyricsCandidates,
  type LyricsCandidate,
} from '../services/enrichmentService';
import type { Track } from '../types/music';
import { GlassButton } from './glass/GlassButton';
import { GlassCard } from './glass/GlassCard';

interface LyricsViewerProps {
  track: Track | null;
  compact?: boolean;
  overlay?: boolean;
  autoFetchOnEmpty?: boolean;
}

export const LyricsViewer: React.FC<LyricsViewerProps> = ({
  track,
  compact = false,
  overlay = false,
  autoFetchOnEmpty = false,
}) => {
  const { lyricsMap, saveLyrics, deleteLyrics, downloadLyricsForTrack } = useLibrary();
  const { currentTrack, currentTime, duration, isPlaying, seek } = usePlayer();
  const { settings } = useTheme();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [userScrolling, setUserScrolling] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<LyricsCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const rafAnimRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const autoFetchedIdsRef = useRef<Set<string>>(new Set());
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const doc = track ? lyricsMap[track.id] : undefined;
  const isTrackCurrentlyPlaying = Boolean(track && currentTrack && track.id === currentTrack.id);

  // Reset UI drawer/edit states only when switching to a different track
  useEffect(() => {
    setEditing(false);
    editingRef.current = false;
    setSearchOpen(false);
    setCandidates(null);
    setUserScrolling(false);
    if (track) {
      setSearchQuery(extractSearchHints(track).combinedQuery);
    }
  }, [track?.id]);

  // Sync editor draft with saved lyrics unless the user is actively typing
  useEffect(() => {
    if (editingRef.current) return;
    if (doc) {
      setDraft(
        doc.type === 'synced'
          ? doc.rawLrc || serializeLrc(doc.syncedLines)
          : doc.plainText
      );
    } else {
      setDraft('');
    }
  }, [track?.id, doc]);

  // Automatically fetch lyrics when viewing a track with no saved lyrics
  useEffect(() => {
    if (!autoFetchOnEmpty || !track || doc || editing) return;
    if (autoFetchedIdsRef.current.has(track.id)) return;
    autoFetchedIdsRef.current.add(track.id);

    let cancelled = false;
    setFetching(true);
    void downloadLyricsForTrack(track.id, undefined, { silent: true, track }).finally(() => {
      if (!cancelled) {
        setFetching(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [autoFetchOnEmpty, track, doc, editing, downloadLyricsForTrack]);

  // Cleanup animation & timers on unmount
  useEffect(() => {
    return () => {
      if (rafAnimRef.current !== null) cancelAnimationFrame(rafAnimRef.current);
      if (scrollTimeoutRef.current !== null) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const smoothScrollTo = useCallback(
    (targetTop: number, durationMs = 420) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const clampedTarget = Math.max(0, Math.min(maxScroll, targetTop));

      if (rafAnimRef.current !== null) {
        cancelAnimationFrame(rafAnimRef.current);
        rafAnimRef.current = null;
      }

      if (settings.reducedMotion || durationMs <= 0) {
        programmaticScrollRef.current = true;
        container.scrollTop = clampedTarget;
        window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 60);
        return;
      }

      const startTop = container.scrollTop;
      const delta = clampedTarget - startTop;
      if (Math.abs(delta) < 1) return;

      const startTime = performance.now();
      programmaticScrollRef.current = true;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - t, 3);
        container.scrollTop = startTop + delta * eased;

        if (t < 1) {
          rafAnimRef.current = requestAnimationFrame(step);
        } else {
          rafAnimRef.current = null;
          window.setTimeout(() => {
            programmaticScrollRef.current = false;
          }, 60);
        }
      };

      rafAnimRef.current = requestAnimationFrame(step);
    },
    [settings.reducedMotion]
  );

  const activeIndex = useMemo(() => {
    if (!doc || doc.type !== 'synced' || !isTrackCurrentlyPlaying) return -1;
    return findActiveLyricIndex(doc.syncedLines, currentTime);
  }, [doc, isTrackCurrentlyPlaying, currentTime]);

  const scrollToActiveLine = useCallback(
    (index: number, instant = false) => {
      const container = scrollContainerRef.current;
      const targetEl = lineRefs.current[index];
      if (!container || !targetEl) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const focalOffset = container.clientHeight * 0.36;
      const nextTop =
        container.scrollTop +
        (targetRect.top - containerRect.top) -
        focalOffset +
        targetRect.height / 2;

      smoothScrollTo(nextTop, instant ? 0 : 440);
    },
    [smoothScrollTo]
  );

  // Synced LRC automatic smooth scrolling
  useEffect(() => {
    if (userScrolling || activeIndex < 0 || editing) return;
    scrollToActiveLine(activeIndex);
  }, [activeIndex, userScrolling, editing, scrollToActiveLine]);

  // Proportional smooth scroll for plain lyrics during active playback
  useEffect(() => {
    if (
      userScrolling ||
      editing ||
      !doc ||
      doc.type !== 'plain' ||
      !isTrackCurrentlyPlaying ||
      !isPlaying
    ) {
      return;
    }
    const container = scrollContainerRef.current;
    const totalDur = duration || track?.duration || 0;
    if (!container || totalDur <= 0) return;

    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScroll <= 0) return;

    const progress = Math.min(1, Math.max(0, currentTime / totalDur));
    const targetTop = progress * maxScroll;
    if (Math.abs(container.scrollTop - targetTop) > 12) {
      smoothScrollTo(targetTop, 320);
    }
  }, [
    doc,
    userScrolling,
    editing,
    isTrackCurrentlyPlaying,
    isPlaying,
    currentTime,
    duration,
    track?.duration,
    smoothScrollTo,
  ]);

  const handleManualScroll = () => {
    if (programmaticScrollRef.current) return;
    if (rafAnimRef.current !== null) {
      cancelAnimationFrame(rafAnimRef.current);
      rafAnimRef.current = null;
    }
    setUserScrolling(true);
    if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      setUserScrolling(false);
    }, 4000);
  };

  const handleResyncNow = () => {
    if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    setUserScrolling(false);
    if (doc?.type === 'synced' && activeIndex >= 0) {
      scrollToActiveLine(activeIndex);
    } else if (doc?.type === 'plain' && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const totalDur = duration || track?.duration || 0;
      if (totalDur > 0) {
        const progress = Math.min(1, Math.max(0, currentTime / totalDur));
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        smoothScrollTo(progress * maxScroll, 380);
      }
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !track) return;
    const text = await file.text();
    await saveLyrics(track.id, text, 'imported');
    setEditing(false);
    e.target.value = '';
  };

  const handleSaveDraft = async () => {
    if (!track) return;
    if (!draft.trim()) {
      await deleteLyrics(track.id);
    } else {
      await saveLyrics(track.id, draft, 'manual');
    }
    setEditing(false);
  };

  const handleAutoDownload = async () => {
    if (!track || fetching) return;
    setFetching(true);
    try {
      await downloadLyricsForTrack(track.id, undefined, { track });
      setSearchOpen(false);
    } finally {
      setFetching(false);
    }
  };

  const handleSearchMatches = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!track || searching) return;
    setSearching(true);
    try {
      const list = await fetchLyricsCandidates(track, searchQuery.trim() || undefined);
      setCandidates(list);
    } catch {
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  };

  const handleApplyCandidate = async (candidate: LyricsCandidate, preferPlain = false) => {
    if (!track) return;
    const chosen = preferPlain
      ? candidate.plainLyrics || candidate.syncedLyrics
      : candidate.syncedLyrics || candidate.plainLyrics;
    if (!chosen) return;
    await saveLyrics(track.id, chosen, 'imported');
    setSearchOpen(false);
    setEditing(false);
  };

  const handleExportLrc = () => {
    if (!doc || !track) return;
    const content =
      doc.type === 'synced' ? doc.rawLrc || serializeLrc(doc.syncedLines) : doc.plainText;
    const ext = doc.type === 'synced' ? 'lrc' : 'txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.artist} - ${track.title}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!track) {
    return (
      <GlassCard className="p-8 text-center">
        <FileText className="w-9 h-9 mx-auto text-[#8E8E93] mb-3" strokeWidth={1.5} />
        <h3 className="text-base font-semibold">No track selected</h3>
        <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-1">
          Start playing a song or pick a track from your library to view or download lyrics.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className={cn('flex flex-col h-full min-h-0 relative', compact ? 'gap-2.5' : 'gap-4')}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".lrc,.txt,text/plain"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-[#6E6E73] dark:text-[#AEAEB2] truncate">
            {fetching
              ? 'Fetching lyrics online...'
              : doc
                ? doc.type === 'synced'
                  ? 'Synchronized LRC · Tap any line to seek'
                  : isTrackCurrentlyPlaying && isPlaying
                    ? 'Plain lyrics · Smooth auto-scroll active'
                    : 'Plain lyrics'
                : 'No lyrics saved for this track'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <GlassButton
            size="sm"
            variant={!doc ? 'accent' : 'glass'}
            disabled={fetching}
            onClick={() => void handleAutoDownload()}
          >
            {fetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudDownload className="w-3.5 h-3.5" />
            )}
            <span>{fetching ? 'Fetching...' : doc ? 'Refresh' : 'Fetch Lyrics'}</span>
          </GlassButton>

          <GlassButton
            size="sm"
            onClick={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (next && candidates === null) {
                void handleSearchMatches();
              }
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Matches</span>
          </GlassButton>

          <GlassButton size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </GlassButton>

          {doc && !editing && !overlay && (
            <GlassButton size="sm" onClick={handleExportLrc}>
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </GlassButton>
          )}

          <GlassButton
            size="sm"
            variant={editing ? 'accent' : 'glass'}
            onClick={() => (editing ? void handleSaveDraft() : setEditing(true))}
          >
            {editing ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>{doc ? 'Edit' : 'Add'}</span>
              </>
            )}
          </GlassButton>
        </div>
      </div>

      {/* LRCLIB Candidate Search Drawer */}
      {searchOpen && (
        <div className="rounded-2xl liquid-glass-subtle p-3.5 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Search LRCLIB (Synced & Plain Lyrics)</p>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close lyrics search"
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <form onSubmit={handleSearchMatches} className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Artist and track title..."
              className="flex-1 min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
            />
            <GlassButton type="submit" size="sm" variant="accent" disabled={searching}>
              {searching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Search</span>
            </GlassButton>
          </form>

          {searching ? (
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] py-2">
              Searching LRCLIB catalog...
            </p>
          ) : candidates && candidates.length === 0 ? (
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] py-2">
              No matching lyrics found for that query. Try editing artist/title keywords.
            </p>
          ) : (
            candidates && (
              <div className="max-h-48 overflow-y-auto scrollbar-thin divide-y divide-black/6 dark:divide-white/8">
                {candidates.slice(0, 8).map((cand) => (
                  <div
                    key={cand.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{cand.title}</p>
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate font-mono-tabular">
                        {cand.artist}
                        {cand.album ? ` · ${cand.album}` : ''}
                        {cand.duration > 0 ? ` · ${formatTime(cand.duration)}` : ''}
                        {` · ${cand.hasSynced ? 'Synced LRC' : 'Plain'}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cand.hasSynced && (
                        <GlassButton
                          size="sm"
                          variant="accent"
                          onClick={() => void handleApplyCandidate(cand, false)}
                        >
                          <span>Use Synced</span>
                        </GlassButton>
                      )}
                      {cand.hasPlain && (
                        <GlassButton
                          size="sm"
                          variant={cand.hasSynced ? 'glass' : 'accent'}
                          onClick={() => void handleApplyCandidate(cand, true)}
                        >
                          <span>{cand.hasSynced ? 'Use Plain' : 'Apply Plain'}</span>
                        </GlassButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Main Content Area */}
      {editing ? (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste plain lyrics or synchronized LRC timestamps like [00:18.40]First line..."
            rows={compact ? 10 : 14}
            className="w-full flex-1 rounded-2xl p-4 text-sm leading-relaxed liquid-glass-subtle text-[#111216] dark:text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)] font-mono-tabular resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            {doc && (
              <GlassButton
                size="sm"
                onClick={() => {
                  void deleteLyrics(track.id);
                  setEditing(false);
                }}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Lyrics</span>
              </GlassButton>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <GlassButton size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </GlassButton>
              <GlassButton size="sm" variant="accent" onClick={() => void handleSaveDraft()}>
                Save Lyrics
              </GlassButton>
            </div>
          </div>
        </div>
      ) : fetching && !doc ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center rounded-3xl liquid-glass-subtle">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--neo-accent)] mb-3" />
          <h4 className="text-base font-semibold">Finding lyrics for &ldquo;{track.title}&rdquo;</h4>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-1">
            Checking synchronized LRC and plain lyrics databases...
          </p>
        </div>
      ) : !doc ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center rounded-3xl liquid-glass-subtle">
          <QuotePlaceholder />
          <h4 className="text-base font-semibold mt-3">No lyrics attached yet</h4>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] max-w-sm mt-1">
            Fetch synchronized or plain lyrics from LRCLIB, search alternate matches, import a local .lrc file, or type your own.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <GlassButton
              size="sm"
              variant="accent"
              disabled={fetching}
              onClick={() => void handleAutoDownload()}
            >
              <CloudDownload className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </GlassButton>
            <GlassButton
              size="sm"
              onClick={() => {
                setSearchOpen(true);
                if (candidates === null) void handleSearchMatches();
              }}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Matches</span>
            </GlassButton>
            <GlassButton size="sm" onClick={() => setEditing(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>Write Lyrics</span>
            </GlassButton>
          </div>
        </div>
      ) : doc.type === 'synced' ? (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={scrollContainerRef}
            onWheel={handleManualScroll}
            onTouchMove={handleManualScroll}
            onScroll={handleManualScroll}
            style={
              overlay
                ? {
                    maskImage:
                      'linear-gradient(to bottom, transparent 0%, black 11%, black 85%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0%, black 11%, black 85%, transparent 100%)',
                  }
                : undefined
            }
            className={cn(
              'flex-1 overflow-y-auto scrollbar-thin pr-2',
              overlay ? 'py-16 space-y-4' : 'py-8 space-y-3'
            )}
          >
            {doc.syncedLines.map((line, i) => {
              const isActive = i === activeIndex;
              const isPast = activeIndex >= 0 && i < activeIndex;
              return (
                <button
                  key={`${line.timeMs}-${i}`}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => {
                    if (isTrackCurrentlyPlaying) {
                      seek(line.timeMs / 1000);
                      setUserScrolling(false);
                    }
                  }}
                  className={cn(
                    'group flex items-baseline justify-between gap-3 w-full text-left rounded-2xl px-3 py-1.5 transition-all duration-300 cursor-pointer font-display',
                    isActive
                      ? overlay
                        ? 'text-2xl sm:text-3xl font-bold text-[#111216] dark:text-white scale-[1.02] origin-left'
                        : 'text-xl sm:text-2xl font-bold text-[#111216] dark:text-white scale-[1.01] origin-left'
                      : isPast
                        ? overlay
                          ? 'text-lg sm:text-xl font-semibold text-[#111216]/35 dark:text-white/30 hover:text-[#111216]/75 dark:hover:text-white/75'
                          : 'text-base sm:text-lg font-semibold text-[#111216]/40 dark:text-white/35 hover:text-[#111216]/75 dark:hover:text-white/75'
                        : overlay
                          ? 'text-lg sm:text-xl font-semibold text-[#111216]/55 dark:text-white/50 hover:text-[#111216] dark:hover:text-white'
                          : 'text-base sm:text-lg font-semibold text-[#111216]/60 dark:text-white/55 hover:text-[#111216] dark:hover:text-white'
                  )}
                >
                  <span
                    className={cn(
                      'leading-snug',
                      isActive && 'drop-shadow-[0_1px_12px_rgba(255,45,85,0.22)]'
                    )}
                  >
                    {line.text || '···'}
                  </span>
                  {isTrackCurrentlyPlaying && (
                    <span
                      className={cn(
                        'text-[11px] font-mono-tabular shrink-0 transition-opacity',
                        isActive
                          ? 'text-[var(--neo-accent)] opacity-90'
                          : 'text-[#6E6E73] dark:text-[#98989D] opacity-0 group-hover:opacity-80'
                      )}
                    >
                      {formatTime(line.timeMs / 1000)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {userScrolling && activeIndex >= 0 && (
            <div className="absolute bottom-3 right-3 z-20">
              <GlassButton size="sm" variant="accent" onClick={handleResyncNow}>
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Sync Line</span>
              </GlassButton>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={scrollContainerRef}
            onWheel={handleManualScroll}
            onTouchMove={handleManualScroll}
            onScroll={handleManualScroll}
            style={
              overlay
                ? {
                    maskImage:
                      'linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)',
                  }
                : undefined
            }
            className={cn(
              'flex-1 overflow-y-auto scrollbar-thin pr-2',
              overlay ? 'py-10' : 'py-4'
            )}
          >
            <div
              className={cn(
                'space-y-4 leading-relaxed font-medium text-[#111216]/85 dark:text-white/90 whitespace-pre-wrap',
                overlay ? 'text-lg sm:text-xl text-center sm:text-left' : 'text-base sm:text-lg'
              )}
            >
              {doc.plainText}
            </div>
          </div>

          {userScrolling && isTrackCurrentlyPlaying && isPlaying && (
            <div className="absolute bottom-3 right-3 z-20">
              <GlassButton size="sm" variant="accent" onClick={handleResyncNow}>
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Resume Scroll</span>
              </GlassButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const QuotePlaceholder: React.FC = () => (
  <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/8 flex items-center justify-center text-[#8E8E93]">
    <FileText className="w-6 h-6" strokeWidth={1.6} />
  </div>
);
