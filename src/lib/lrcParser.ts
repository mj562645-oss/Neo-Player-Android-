import type { SyncedLyricLine } from '../types/music';
import { sanitizeText } from './format';

const TIMESTAMP_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(raw: string): {
  isSynced: boolean;
  syncedLines: SyncedLyricLine[];
  plainText: string;
} {
  const cleaned = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = cleaned.split('\n');
  const syncedLines: SyncedLyricLine[] = [];
  const plainRows: string[] = [];

  for (const row of rows) {
    const matches = [...row.matchAll(TIMESTAMP_REGEX)];
    if (matches.length > 0) {
      const textPart = sanitizeText(row.replace(TIMESTAMP_REGEX, ''));
      for (const match of matches) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const fracRaw = match[3] || '0';
        const ms =
          fracRaw.length === 1
            ? parseInt(fracRaw, 10) * 100
            : fracRaw.length === 2
              ? parseInt(fracRaw, 10) * 10
              : parseInt(fracRaw.slice(0, 3), 10);
        const timeMs = mins * 60000 + secs * 1000 + ms;
        syncedLines.push({ timeMs, text: textPart });
      }
      if (textPart) {
        plainRows.push(textPart);
      }
    } else {
      // Ignore LRC metadata tags like [ar:...], [ti:...] in plain output
      if (/^\[(ar|ti|al|by|offset|re|ve):.*\]$/i.test(row.trim())) {
        continue;
      }
      const line = sanitizeText(row);
      plainRows.push(line);
    }
  }

  syncedLines.sort((a, b) => a.timeMs - b.timeMs);

  return {
    isSynced: syncedLines.length > 0,
    syncedLines,
    plainText: plainRows.join('\n').trim(),
  };
}

export function serializeLrc(lines: SyncedLyricLine[]): string {
  return lines
    .slice()
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((line) => {
      const totalMs = Math.max(0, Math.round(line.timeMs));
      const mins = Math.floor(totalMs / 60000);
      const secs = Math.floor((totalMs % 60000) / 1000);
      const centis = Math.floor((totalMs % 1000) / 10);
      const ts = `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}]`;
      return `${ts}${line.text}`;
    })
    .join('\n');
}

export function findActiveLyricIndex(lines: SyncedLyricLine[], currentTimeSec: number): number {
  if (lines.length === 0) return -1;
  const currentMs = currentTimeSec * 1000;
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= currentMs + 120) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}
