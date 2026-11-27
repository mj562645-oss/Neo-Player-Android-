import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Clock3, Headphones, History, X } from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer } from '../../app/PlayerContext';
import { useToast } from '../../app/ToastContext';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GlassButton } from '../../components/glass/GlassButton';
import { cn } from '../../lib/utils';
import {
  clearListeningHistory,
  listListeningHistory,
  recordListeningHistory,
  type ListeningHistoryEntry,
} from '../../services/listeningHistory';

function localDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function historyGroup(timestamp: number, now: number): string {
  const today = localDayStart(now);
  const day = localDayStart(timestamp);
  if (day === today) return 'Today';
  if (day === today - 86_400_000) return 'Yesterday';
  if (day >= today - 6 * 86_400_000) return 'Earlier this week';
  return 'Earlier';
}

function formatPlayedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);
}

export const ListeningInsights: React.FC = () => {
  const { currentTrack, isPlaying } = usePlayer();
  const { tracks } = useLibrary();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ListeningHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const lastRecordedTrack = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setHistory(await listListeningHistory());
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load listening history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Record only after playback remains active briefly. This avoids counting short
  // service state blips as listening sessions and doesn't depend on app orientation.
  useEffect(() => {
    if (!currentTrack || !isPlaying || lastRecordedTrack.current === currentTrack.id) return;
    const trackId = currentTrack.id;
    const timer = window.setTimeout(() => {
      if (lastRecordedTrack.current === trackId) return;
      lastRecordedTrack.current = trackId;
      void recordListeningHistory(trackId)
        .then(() => listListeningHistory())
        .then(setHistory)
        .catch((error) => {
          lastRecordedTrack.current = null;
          console.warn('[Neo Player] Could not record listening history', error);
        });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [currentTrack?.id, isPlaying]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const groupedHistory = useMemo(() => {
    const now = Date.now();
    const groups = new Map<string, ListeningHistoryEntry[]>();
    for (const entry of history) {
      const label = historyGroup(entry.playedAt, now);
      const group = groups.get(label) || [];
      group.push(entry);
      groups.set(label, group);
    }
    return [...groups.entries()];
  }, [history]);

  const topArtists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of history) {
      const artist = trackById.get(entry.trackId)?.artist?.trim();
      if (artist && artist.toLowerCase() !== 'unknown artist') {
        counts.set(artist, (counts.get(artist) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [history, trackById]);

  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of history) {
      const genre = trackById.get(entry.trackId)?.genre?.trim();
      if (genre && genre.toLowerCase() !== 'unclassified') {
        counts.set(genre, (counts.get(genre) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [history, trackById]);

  const handleClear = async () => {
    try {
      await clearListeningHistory();
      setHistory([]);
      lastRecordedTrack.current = currentTrack?.id ?? null;
      showToast('Listening history cleared', 'info');
    } catch {
      showToast('Could not clear listening history.', 'error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open listening insights and history"
        title="Listening insights"
        className="fixed right-4 bottom-[138px] lg:bottom-24 z-30 min-h-11 min-w-11 rounded-full liquid-glass-elevated flex items-center justify-center text-[var(--neo-accent)] shadow-lg"
      >
        <BarChart3 className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="listening-insights-title"
            className="liquid-glass-elevated neo-card-radius w-full max-w-2xl max-h-[86dvh] overflow-hidden rounded-b-none p-5 text-[#111216] dark:text-[#F5F5F7] sm:rounded-b-[var(--neo-radius-card)]"
          >
            <header className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--neo-accent)]">
                  <Headphones className="h-3.5 w-3.5" /> Your listening
                </p>
                <h2 id="listening-insights-title" className="text-xl font-bold font-display">Listening insights</h2>
              </div>
              <div className="flex gap-2">
                {history.length > 0 && <GlassButton size="sm" variant="ghost" onClick={() => void handleClear()}>Clear</GlassButton>}
                <button type="button" aria-label="Close insights" onClick={() => setOpen(false)} className="min-h-10 min-w-10 rounded-full liquid-glass-subtle flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
            </header>

            <div className="mb-5 grid grid-cols-3 gap-2">
              <div className="liquid-glass-subtle rounded-2xl p-3"><p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">Recorded plays</p><p className="mt-1 text-xl font-bold font-mono-tabular">{history.length}</p></div>
              <div className="liquid-glass-subtle rounded-2xl p-3"><p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">Artists</p><p className="mt-1 text-xl font-bold font-mono-tabular">{topArtists.length ? new Set(history.map((entry) => trackById.get(entry.trackId)?.artist).filter(Boolean)).size : 0}</p></div>
              <div className="liquid-glass-subtle rounded-2xl p-3"><p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">Genres</p><p className="mt-1 text-xl font-bold font-mono-tabular">{new Set(history.map((entry) => trackById.get(entry.trackId)?.genre).filter(Boolean)).size}</p></div>
            </div>

            {(topArtists.length > 0 || topGenres.length > 0) && (
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InsightList title="Top artists" values={topArtists} />
                <InsightList title="Top genres" values={topGenres} />
              </div>
            )}

            <div className="max-h-[44dvh] space-y-5 overflow-y-auto pr-1">
              {loading ? <p className="py-8 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">Loading listening history…</p> : history.length === 0 ? (
                <div className="py-10 text-center">
                  <History className="mx-auto mb-3 h-8 w-8 text-[var(--neo-accent)]" />
                  <p className="font-semibold">Your history starts with your next listen</p>
                  <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">History is stored locally on this device.</p>
                </div>
              ) : groupedHistory.map(([label, entries]) => (
                <section key={label}>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[#6E6E73] dark:text-[#98989D]"><Clock3 className="h-3.5 w-3.5" />{label}</h3>
                  <div className="space-y-1">
                    {entries.map((entry) => {
                      const track = trackById.get(entry.trackId);
                      if (!track) return null;
                      return <div key={entry.id} className={cn('flex items-center gap-3 rounded-xl px-2 py-2', currentTrack?.id === track.id && 'bg-[var(--neo-accent-soft)]')}>
                        <AlbumArtwork artworkId={track.artworkId} artworkUrl={track.artworkUrl} alt={track.title} fallbackSeed={`${track.album}-${track.artist}`} size="xs" rounded="md" />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-[#6E6E73] dark:text-[#98989D]">{track.artist} · {track.album}</p></div>
                        <time className="shrink-0 text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">{formatPlayedAt(entry.playedAt)}</time>
                      </div>;
                    })}
                  </div>
                </section>
              ))}
            </div>
            <p className="mt-4 border-t border-black/8 pt-3 text-[11px] text-[#6E6E73] dark:border-white/10 dark:text-[#98989D]">History is local to this installation and retains up to 5,000 playback starts.</p>
          </section>
        </div>
      )}
    </>
  );
};

const InsightList: React.FC<{ title: string; values: Array<[string, number]> }> = ({ title, values }) => (
  <div className="liquid-glass-subtle rounded-2xl p-3">
    <h3 className="mb-2 text-xs font-semibold text-[#6E6E73] dark:text-[#98989D]">{title}</h3>
    {values.map(([label, count], index) => <div key={label} className="flex items-center justify-between gap-2 py-1 text-xs"><span className="truncate"><span className="mr-2 font-mono-tabular text-[var(--neo-accent)]">0{index + 1}</span>{label}</span><span className="font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">{count}</span></div>)}
  </div>
);
