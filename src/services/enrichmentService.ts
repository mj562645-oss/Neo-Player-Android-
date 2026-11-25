import { Capacitor } from '@capacitor/core';
import type { Track } from '../types/music';

const LRCLIB_BASE = 'https://lrclib.net/api';
const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE = 'https://coverartarchive.org';

let lastMusicBrainzCallAt = 0;

export interface LyricsCandidate {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  instrumental: boolean;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  hasSynced: boolean;
  hasPlain: boolean;
  score: number;
}

export interface MetadataCandidate {
  recordingId: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  releaseId?: string;
  releaseGroupId?: string;
  coverUrl?: string;
  score: number;
}

export interface TrackEnrichmentOptions {
  mode: 'missing-only' | 'overwrite';
  fetchMetadata: boolean;
  fetchCover: boolean;
  fetchLyrics: boolean;
}

export interface TrackEnrichmentResult {
  trackPatch: Partial<
    Pick<Track, 'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'year' | 'trackNumber'>
  >;
  coverBlob: Blob | null;
  lyricsContent: string | null;
  lyricsType: 'synced' | 'plain' | null;
  metadataMatched: boolean;
  coverMatched: boolean;
  lyricsMatched: boolean;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const setA = new Set(na.split(' '));
  const setB = new Set(nb.split(' '));
  let hits = 0;
  for (const tok of setA) {
    if (setB.has(tok)) hits++;
  }
  return hits / Math.max(setA.size, setB.size);
}

/**
 * Derives clean title & artist hints even when a file lacks ID3 tags
 * (e.g. "03 - Daft Punk - Instant Crush (Official Audio).mp3").
 */
export function extractSearchHints(track: Pick<Track, 'title' | 'artist' | 'album' | 'fileName' | 'duration'>): {
  title: string;
  artist: string;
  album: string;
  combinedQuery: string;
} {
  const baseName = track.fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/^\d{1,3}[\s._-]+/, '')
    .replace(/\((official|audio|video|lyrics?|hd|hq|remaster(ed)?|visualizer)[^)]*\)/gi, '')
    .replace(/\[(official|audio|video|lyrics?|hd|hq|kbps|320|flac)[^\]]*\]/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawTitle = track.title.trim();
  const rawArtist = track.artist.trim();
  const hasRealArtist = Boolean(rawArtist && rawArtist.toLowerCase() !== 'unknown artist');
  const hasRealAlbum = Boolean(track.album && track.album.trim().toLowerCase() !== 'single');

  let title = rawTitle;
  let artist = hasRealArtist ? rawArtist : '';

  if ((!artist || title === track.fileName.replace(/\.[^/.]+$/, '')) && baseName.includes(' - ')) {
    const parts = baseName.split(' - ').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      if (!artist) artist = parts[0];
      title = parts.slice(1).join(' - ');
    }
  }

  title = title
    .replace(/\((official|audio|video|lyrics?|hd|hq|visualizer)[^)]*\)/gi, '')
    .replace(/\[(official|audio|video|lyrics?|hd|hq|kbps|320|flac)[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) title = baseName || track.fileName;

  const combinedQuery = artist ? `${artist} ${title}` : title;
  return {
    title,
    artist,
    album: hasRealAlbum ? track.album.trim() : '',
    combinedQuery,
  };
}

async function waitForMusicBrainzSlot(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastMusicBrainzCallAt;
  if (elapsed < 1050) {
    await new Promise((resolve) => setTimeout(resolve, 1050 - elapsed));
  }
  lastMusicBrainzCallAt = Date.now();
}

interface LrcLibRawItem {
  id: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function mapLrcLibItem(
  item: LrcLibRawItem,
  hintTitle: string,
  hintArtist: string,
  trackDuration: number
): LyricsCandidate {
  const title = item.trackName || hintTitle;
  const artist = item.artistName || hintArtist || 'Unknown Artist';
  const album = item.albumName || '';
  const syncedLyrics = item.syncedLyrics?.trim() ? item.syncedLyrics.trim() : null;
  const plainLyrics = item.plainLyrics?.trim() ? item.plainLyrics.trim() : null;

  const titleScore = tokenOverlapScore(title, hintTitle);
  const artistScore = hintArtist ? tokenOverlapScore(artist, hintArtist) : 0.4;
  const durationDiff =
    trackDuration > 0 && typeof item.duration === 'number' && item.duration > 0
      ? Math.abs(trackDuration - item.duration)
      : 0;
  const durationPenalty = durationDiff > 8 ? Math.min(0.4, (durationDiff - 8) / 60) : 0;
  const syncedBonus = syncedLyrics ? 0.2 : 0;

  const score = Math.max(
    0,
    titleScore * 0.55 + artistScore * 0.35 + syncedBonus - durationPenalty
  );

  return {
    id: item.id,
    title,
    artist,
    album,
    duration: item.duration || 0,
    instrumental: Boolean(item.instrumental),
    syncedLyrics,
    plainLyrics,
    hasSynced: Boolean(syncedLyrics),
    hasPlain: Boolean(plainLyrics),
    score,
  };
}

export async function fetchLyricsCandidates(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'fileName' | 'duration'>,
  customQuery?: string
): Promise<LyricsCandidate[]> {
  const hints = extractSearchHints(track);
  const collected = new Map<number, LyricsCandidate>();
  const isNative = Capacitor.isNativePlatform();

  // 1. Try exact match endpoint when we have artist + title + no custom query
  if (!customQuery && hints.artist && hints.title) {
    try {
      const params = new URLSearchParams({
        track_name: hints.title,
        artist_name: hints.artist,
      });
      if (hints.album) params.set('album_name', hints.album);
      if (track.duration > 0) params.set('duration', String(Math.round(track.duration)));

      let res: Response | null = null;
      if (!isNative) {
        try {
          res = await fetch(`/api/enrichment/lrclib?mode=get&${params.toString()}`);
        } catch {
          res = null;
        }
      }
      if (!res || (!res.ok && res.status !== 404)) {
        res = await fetch(`${LRCLIB_BASE}/get?${params.toString()}`);
      }
      if (res.ok) {
        const item = (await res.json()) as LrcLibRawItem;
        if (item && item.id && (item.syncedLyrics || item.plainLyrics)) {
          collected.set(item.id, mapLrcLibItem(item, hints.title, hints.artist, track.duration));
        }
      }
    } catch {
      // Fall through to search endpoint
    }
  }

  // 2. Search endpoint for broader / partial matches and alternate versions
  const query = (customQuery ?? hints.combinedQuery).trim();
  if (query) {
    try {
      const params = new URLSearchParams({ q: query });
      let res: Response | null = null;
      if (!isNative) {
        try {
          res = await fetch(`/api/enrichment/lrclib?mode=search&${params.toString()}`);
        } catch {
          res = null;
        }
      }
      if (!res || !res.ok) {
        res = await fetch(`${LRCLIB_BASE}/search?${params.toString()}`);
      }
      if (res.ok) {
        const list = (await res.json()) as LrcLibRawItem[];
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item || !item.id || (!item.syncedLyrics && !item.plainLyrics)) continue;
            if (!collected.has(item.id)) {
              collected.set(
                item.id,
                mapLrcLibItem(item, hints.title, hints.artist, track.duration)
              );
            }
          }
        }
      }
    } catch {
      // Ignore network errors if direct match already succeeded
    }
  }

  return Array.from(collected.values()).sort((a, b) => b.score - a.score);
}

export async function fetchBestLyrics(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'fileName' | 'duration'>
): Promise<LyricsCandidate | null> {
  const candidates = await fetchLyricsCandidates(track);
  return candidates[0] ?? null;
}

interface MbArtistCredit {
  name?: string;
  joinphrase?: string;
  artist?: { name?: string };
}

interface MbRelease {
  id?: string;
  title?: string;
  date?: string;
  status?: string;
  'release-group'?: {
    id?: string;
    'primary-type'?: string;
    'secondary-types'?: string[];
  };
  media?: Array<{
    track?: Array<{ number?: string }>;
  }>;
}

interface MbRecording {
  id: string;
  score?: number;
  title?: string;
  length?: number;
  'first-release-date'?: string;
  'artist-credit'?: MbArtistCredit[];
  releases?: MbRelease[];
  tags?: Array<{ name?: string; count?: number }>;
}

function formatArtistCredit(credits?: MbArtistCredit[]): string {
  if (!credits || credits.length === 0) return '';
  return credits
    .map((c) => `${c.name || c.artist?.name || ''}${c.joinphrase || ''}`)
    .join('')
    .trim();
}

function pickBestRelease(releases: MbRelease[] | undefined, hintAlbum: string): MbRelease | undefined {
  if (!releases || releases.length === 0) return undefined;
  return releases
    .slice()
    .sort((a, b) => {
      const scoreRelease = (r: MbRelease): number => {
        let s = 0;
        if (r.status === 'Official') s += 30;
        const pType = r['release-group']?.['primary-type'];
        if (pType === 'Album') s += 25;
        else if (pType === 'Single' || pType === 'EP') s += 15;
        const sec = r['release-group']?.['secondary-types'] || [];
        if (sec.includes('Compilation')) s -= 20;
        if (sec.includes('Live') || sec.includes('Remix')) s -= 10;
        if (hintAlbum && r.title) {
          s += tokenOverlapScore(r.title, hintAlbum) * 35;
        }
        return s;
      };
      return scoreRelease(b) - scoreRelease(a);
    })[0];
}

function formatGenreTag(tags?: Array<{ name?: string; count?: number }>): string | undefined {
  if (!tags || tags.length === 0) return undefined;
  const sorted = tags
    .filter((t) => t.name && t.name.length > 1 && t.name.length < 28)
    .slice()
    .sort((a, b) => (b.count || 0) - (a.count || 0));
  const top = sorted[0]?.name;
  if (!top) return undefined;
  return top
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function fetchMetadataCandidates(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'fileName' | 'duration'>,
  customQuery?: string
): Promise<MetadataCandidate[]> {
  const hints = extractSearchHints(track);
  let luceneQuery = '';

  if (customQuery?.trim()) {
    luceneQuery = customQuery.trim();
  } else if (hints.artist && hints.title) {
    const safeTitle = hints.title.replace(/"/g, '');
    const safeArtist = hints.artist.replace(/"/g, '');
    luceneQuery = `recording:"${safeTitle}" AND artist:"${safeArtist}"`;
  } else {
    luceneQuery = hints.title.replace(/"/g, '');
  }

  if (!luceneQuery) return [];

  await waitForMusicBrainzSlot();

  const params = new URLSearchParams({
    query: luceneQuery,
    fmt: 'json',
    limit: '6',
  });

  const isNative = Capacitor.isNativePlatform();
  let res: Response | null = null;
  if (!isNative) {
    try {
      res = await fetch(`/api/enrichment/musicbrainz?q=${encodeURIComponent(luceneQuery)}`);
    } catch {
      res = null;
    }
  }
  if (!res || !res.ok) {
    res = await fetch(`${MUSICBRAINZ_BASE}/recording?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });
  }

  if (!res.ok) {
    throw new Error(`MusicBrainz lookup failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { recordings?: MbRecording[] };
  const recordings = data.recordings || [];

  const candidates: MetadataCandidate[] = recordings.map((rec) => {
    const recTitle = rec.title || hints.title;
    const recArtist = formatArtistCredit(rec['artist-credit']) || hints.artist || 'Unknown Artist';
    const bestRelease = pickBestRelease(rec.releases, hints.album);
    const albumTitle = bestRelease?.title || hints.album || 'Single';
    const releaseDate = bestRelease?.date || rec['first-release-date'] || '';
    const yearMatch = releaseDate.match(/^(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    const rawTrackNum = bestRelease?.media?.[0]?.track?.[0]?.number;
    const trackNumber = rawTrackNum ? parseInt(rawTrackNum, 10) : undefined;
    const releaseId = bestRelease?.id;
    const releaseGroupId = bestRelease?.['release-group']?.id;

    let score = (rec.score || 50) / 100;
    if (track.duration > 0 && rec.length && rec.length > 0) {
      const diffSec = Math.abs(track.duration - rec.length / 1000);
      if (diffSec < 4) score += 0.25;
      else if (diffSec > 15) score -= 0.2;
    }

    return {
      recordingId: rec.id,
      title: recTitle,
      artist: recArtist,
      album: albumTitle,
      albumArtist: recArtist,
      genre: formatGenreTag(rec.tags),
      year: year && year >= 1900 && year <= 2100 ? year : undefined,
      trackNumber: trackNumber && trackNumber > 0 ? trackNumber : undefined,
      releaseId,
      releaseGroupId,
      coverUrl: releaseId ? `${COVER_ART_BASE}/release/${releaseId}/front-500` : undefined,
      score,
    };
  });

  return candidates.sort((a, b) => b.score - a.score);
}

export async function downloadCoverBlob(candidate: {
  releaseId?: string;
  releaseGroupId?: string;
  coverUrl?: string;
}): Promise<Blob | null> {
  const urls: string[] = [];
  if (candidate.coverUrl) urls.push(candidate.coverUrl);
  if (candidate.releaseId) {
    const releaseUrl = `${COVER_ART_BASE}/release/${candidate.releaseId}/front-500`;
    if (!urls.includes(releaseUrl)) urls.push(releaseUrl);
  }
  if (candidate.releaseGroupId) {
    urls.push(`${COVER_ART_BASE}/release-group/${candidate.releaseGroupId}/front-500`);
  }

  const isNative = Capacitor.isNativePlatform();
  for (const url of urls) {
    try {
      const fetchTarget = !isNative
        ? `/api/enrichment/cover?url=${encodeURIComponent(url)}`
        : url;
      const res = await fetch(fetchTarget);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0 && (!blob.type || blob.type.startsWith('image/'))) {
        return blob;
      }
    } catch {
      // Try fallback release-group URL if available
    }
  }
  return null;
}

export async function enrichTrackOnline(
  track: Track,
  options: TrackEnrichmentOptions
): Promise<TrackEnrichmentResult> {
  const trackPatch: TrackEnrichmentResult['trackPatch'] = {};
  let coverBlob: Blob | null = null;
  let lyricsContent: string | null = null;
  let lyricsType: 'synced' | 'plain' | null = null;
  let metadataMatched = false;
  let coverMatched = false;
  let lyricsMatched = false;

  const hasUnknownArtist = !track.artist || track.artist.trim().toLowerCase() === 'unknown artist';
  const hasGenericAlbum = !track.album || track.album.trim().toLowerCase() === 'single';
  const hasUnknownGenre = !track.genre || track.genre.trim().toLowerCase() === 'unclassified';

  let enrichedMeta: MetadataCandidate | undefined;

  if (options.fetchMetadata || (options.fetchCover && !track.artworkId)) {
    try {
      const metaList = await fetchMetadataCandidates(track);
      enrichedMeta = metaList[0];
    } catch {
      // Continue cleanly to lyrics lookup if metadata request fails
    }
  }

  if (enrichedMeta) {
    metadataMatched = true;
    const overwrite = options.mode === 'overwrite';

    if (options.fetchMetadata) {
      if (overwrite || !track.title || track.title === track.fileName.replace(/\.[^/.]+$/, '')) {
        trackPatch.title = enrichedMeta.title;
      }
      if (overwrite || hasUnknownArtist) {
        trackPatch.artist = enrichedMeta.artist;
      }
      if (overwrite || hasGenericAlbum) {
        trackPatch.album = enrichedMeta.album;
        trackPatch.albumArtist = enrichedMeta.albumArtist;
      }
      if ((overwrite || hasUnknownGenre) && enrichedMeta.genre) {
        trackPatch.genre = enrichedMeta.genre;
      }
      if ((overwrite || !track.year) && enrichedMeta.year) {
        trackPatch.year = enrichedMeta.year;
      }
      if ((overwrite || !track.trackNumber) && enrichedMeta.trackNumber) {
        trackPatch.trackNumber = enrichedMeta.trackNumber;
      }
    }

    if (options.fetchCover && (overwrite || !track.artworkId)) {
      coverBlob = await downloadCoverBlob(enrichedMeta);
      coverMatched = Boolean(coverBlob);
    }
  }

  if (options.fetchLyrics) {
    const queryTrack: Track = {
      ...track,
      ...trackPatch,
    };
    const bestLyrics = await fetchBestLyrics(queryTrack);
    if (bestLyrics) {
      if (bestLyrics.syncedLyrics) {
        lyricsContent = bestLyrics.syncedLyrics;
        lyricsType = 'synced';
        lyricsMatched = true;
      } else if (bestLyrics.plainLyrics) {
        lyricsContent = bestLyrics.plainLyrics;
        lyricsType = 'plain';
        lyricsMatched = true;
      }
    }
  }

  return {
    trackPatch,
    coverBlob,
    lyricsContent,
    lyricsType,
    metadataMatched,
    coverMatched,
    lyricsMatched,
  };
}
