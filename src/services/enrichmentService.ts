import { Capacitor } from '@capacitor/core';
import {
  cleanArtistName,
  cleanMediaTagNoise,
  extractFeaturedArtists,
  hasFilenameNoise,
  isPlaceholderAlbum,
  isPlaceholderArtist,
  parseAudioFilename,
  stripAudioExtension,
  stripLeadingTrackNumber,
} from '../lib/filenameParser';
import type { Track } from '../types/music';

const LRCLIB_BASE = 'https://lrclib.net/api';
const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const ITUNES_SEARCH_BASE = 'https://itunes.apple.com/search';
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
  durationSec?: number;
  releaseId?: string;
  releaseGroupId?: string;
  coverUrl?: string;
  fallbackCoverUrl?: string;
  source?: 'musicbrainz' | 'itunes';
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
    .replace(/['’`]/g, '')
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
  // Also match spaced/merged stylings if both have multiple chars (e.g. "blvcksvm" vs "blvck svm")
  const compactA = na.replace(/\s+/g, '');
  const compactB = nb.replace(/\s+/g, '');
  if (compactA.length >= 4 && compactA === compactB) return 0.96;
  if (na.includes(nb) || nb.includes(na)) return 0.86;
  const setA = new Set(na.split(' ').filter(Boolean));
  const setB = new Set(nb.split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let hits = 0;
  for (const tok of setA) {
    if (setB.has(tok)) hits++;
  }
  return hits / Math.max(setA.size, setB.size);
}

/**
 * Derives clean title & artist hints even when an audio file lacks ID3 tags
 * or has downloader-corrupted filenames like:
 * - "Blvck_Svm_-_hyogo_[official_lyric_video.mp3" -> artist: "Blvck Svm", title: "hyogo"
 * - "Lil_Keed_-_It_s_Up_Freestyle_[Official_Video.m4a" -> artist: "Lil Keed", title: "It's Up Freestyle"
 */
export function extractSearchHints(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'fileName' | 'duration'>
): {
  title: string;
  searchTitle: string;
  artist: string;
  album: string;
  combinedQuery: string;
} {
  const parsedFile = parseAudioFilename(track.fileName || '');
  const rawTitle = (track.title || '').trim();
  const rawArtist = (track.artist || '').trim();
  const rawTitleNoExt = stripAudioExtension(track.fileName || '').trim();

  const artistIsPlaceholder = isPlaceholderArtist(rawArtist);
  let artist = artistIsPlaceholder ? '' : cleanArtistName(rawArtist);

  const rawTitleLooksLikeFile =
    !rawTitle ||
    rawTitle === rawTitleNoExt ||
    rawTitle === track.fileName ||
    hasFilenameNoise(rawTitle) ||
    (!artist && /\s+[-–—]\s+/.test(cleanMediaTagNoise(rawTitle)));

  let title = rawTitle;

  if (rawTitleLooksLikeFile) {
    if (parsedFile.hasExplicitArtist && (artistIsPlaceholder || hasFilenameNoise(rawTitle))) {
      title = parsedFile.title;
      if (!artist) artist = parsedFile.artist;
    } else if (rawTitle) {
      const reparsed = parseAudioFilename(rawTitle);
      title = reparsed.title;
      if (!artist && reparsed.hasExplicitArtist) {
        artist = reparsed.artist;
      }
    }
  } else {
    title = cleanMediaTagNoise(rawTitle) || rawTitle;
    if (artist) {
      // Strip redundant "Artist - Title" prefix if present inside the title tag
      const cleanedArtistPrefix = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefixRe = new RegExp(`^${cleanedArtistPrefix}\\s*[-–—]+\\s*`, 'i');
      if (prefixRe.test(title)) {
        title = title.replace(prefixRe, '').trim();
      }
    }
  }

  if (!artist && parsedFile.hasExplicitArtist) {
    artist = parsedFile.artist;
  }

  title = stripLeadingTrackNumber(cleanMediaTagNoise(title)) || parsedFile.title || track.fileName;
  const searchTitleSplit = extractFeaturedArtists(title);
  const searchTitle = searchTitleSplit.mainText || title;
  const album = isPlaceholderAlbum(track.album) ? '' : track.album.trim();

  const combinedQuery = artist ? `${artist} ${searchTitle}` : searchTitle;
  return {
    title,
    searchTitle,
    artist,
    album,
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
  const lookupTitle = hints.searchTitle || hints.title;

  // 1. Try exact match endpoint when we have artist + title + no custom query
  if (!customQuery && hints.artist && lookupTitle) {
    try {
      const params = new URLSearchParams({
        track_name: lookupTitle,
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
          collected.set(item.id, mapLrcLibItem(item, lookupTitle, hints.artist, track.duration));
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
                mapLrcLibItem(item, lookupTitle, hints.artist, track.duration)
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

interface ItunesSongRaw {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  collectionArtistName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackNumber?: number;
  trackTimeMillis?: number;
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

function scoreCandidateRelevance(params: {
  candTitle: string;
  candArtist: string;
  candAlbum: string;
  candDurationSec?: number;
  hintTitle: string;
  hintSearchTitle: string;
  hintArtist: string;
  hintAlbum: string;
  trackDuration: number;
  hasCover: boolean;
  baseQualityBonus?: number;
}): number {
  const titleScore = Math.max(
    tokenOverlapScore(params.candTitle, params.hintTitle),
    tokenOverlapScore(params.candTitle, params.hintSearchTitle)
  );
  if (titleScore < 0.35) return 0;

  let artistScore = 0.65;
  if (params.hintArtist) {
    artistScore = tokenOverlapScore(params.candArtist, params.hintArtist);
    // Also check "feat." co-credit inside candTitle (e.g. "Song (feat. Artist)")
    if (artistScore < 0.4 && tokenOverlapScore(params.candTitle, params.hintArtist) >= 0.7) {
      artistScore = 0.75;
    }
    if (artistScore < 0.3) return 0;
  }

  let score = titleScore * 0.54 + artistScore * 0.42 + (params.baseQualityBonus || 0);

  if (params.hintAlbum && params.candAlbum) {
    score += tokenOverlapScore(params.candAlbum, params.hintAlbum) * 0.08;
  }

  if (params.trackDuration > 0 && params.candDurationSec && params.candDurationSec > 0) {
    const diffSec = Math.abs(params.trackDuration - params.candDurationSec);
    if (diffSec <= 4) score += 0.14;
    else if (diffSec <= 10) score += 0.05;
    else if (diffSec > 25) score -= 0.22;
  }

  // Penalize tribute/karaoke/cover/instrumental/slowed versions unless requested in hints
  const hintLower = `${params.hintTitle} ${params.hintArtist}`.toLowerCase();
  const candLower = `${params.candTitle} ${params.candArtist} ${params.candAlbum}`.toLowerCase();
  for (const tag of ['karaoke', 'tribute', 'instrumental', 'cover version', 'lullaby', '8-bit', 'sped up', 'slowed']) {
    if (candLower.includes(tag) && !hintLower.includes(tag)) {
      score -= 0.35;
    }
  }

  if (params.hasCover) score += 0.04;
  return Math.max(0, score);
}

async function queryMusicBrainzRecordings(luceneQuery: string): Promise<MbRecording[]> {
  if (!luceneQuery.trim()) return [];
  const isNative = Capacitor.isNativePlatform();

  for (let attempt = 0; attempt < 2; attempt++) {
    await waitForMusicBrainzSlot();
    let res: Response | null = null;
    if (!isNative) {
      try {
        res = await fetch(`/api/enrichment/musicbrainz?q=${encodeURIComponent(luceneQuery)}`);
      } catch {
        res = null;
      }
    }
    if (!res || (!res.ok && res.status !== 503)) {
      const params = new URLSearchParams({
        query: luceneQuery,
        fmt: 'json',
        limit: '6',
      });
      res = await fetch(`${MUSICBRAINZ_BASE}/recording?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
    }
    if (res.status === 503 && attempt === 0) {
      lastMusicBrainzCallAt = Date.now() + 250;
      continue;
    }
    if (!res.ok) return [];
    const data = (await res.json()) as { recordings?: MbRecording[] };
    return data.recordings || [];
  }
  return [];
}

async function fetchMusicBrainzCandidates(
  hints: ReturnType<typeof extractSearchHints>,
  trackDuration: number,
  customQuery?: string
): Promise<MetadataCandidate[]> {
  let recordings: MbRecording[] = [];

  if (customQuery?.trim()) {
    recordings = await queryMusicBrainzRecordings(customQuery.trim());
  } else {
    const cleanTitle = (hints.searchTitle || hints.title).replace(/["()[\]]/g, '').trim();
    const cleanArtist = hints.artist.replace(/["()[\]]/g, '').trim();

    if (cleanArtist && cleanTitle) {
      recordings = await queryMusicBrainzRecordings(
        `recording:"${cleanTitle}" AND artist:"${cleanArtist}"`
      );
      if (recordings.length === 0) {
        const titleWords = normalizeForMatch(cleanTitle).split(' ').filter(Boolean).join(' AND ');
        const artistWords = normalizeForMatch(cleanArtist).split(' ').filter(Boolean).join(' AND ');
        if (titleWords && artistWords) {
          recordings = await queryMusicBrainzRecordings(
            `recording:(${titleWords}) AND artist:(${artistWords})`
          );
        }
      }
    } else if (cleanTitle) {
      recordings = await queryMusicBrainzRecordings(cleanTitle);
    }
  }

  const out: MetadataCandidate[] = [];
  for (const rec of recordings) {
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
    const durationSec = rec.length && rec.length > 0 ? Math.round(rec.length / 1000) : undefined;
    const coverUrl = releaseId ? `${COVER_ART_BASE}/release/${releaseId}/front-500` : undefined;

    const relevance = scoreCandidateRelevance({
      candTitle: recTitle,
      candArtist: recArtist,
      candAlbum: albumTitle,
      candDurationSec: durationSec,
      hintTitle: hints.title,
      hintSearchTitle: hints.searchTitle,
      hintArtist: hints.artist,
      hintAlbum: hints.album,
      trackDuration,
      hasCover: Boolean(coverUrl),
      baseQualityBonus: bestRelease?.status === 'Official' ? 0.04 : 0,
    });

    if (relevance <= 0 && !customQuery?.trim()) continue;

    out.push({
      recordingId: rec.id,
      title: recTitle,
      artist: recArtist,
      album: albumTitle,
      albumArtist: recArtist,
      genre: formatGenreTag(rec.tags),
      year: year && year >= 1900 && year <= 2100 ? year : undefined,
      trackNumber: trackNumber && trackNumber > 0 ? trackNumber : undefined,
      durationSec,
      releaseId,
      releaseGroupId,
      coverUrl,
      source: 'musicbrainz',
      score: relevance > 0 ? relevance : (rec.score || 40) / 100,
    });
  }

  return out;
}

function upgradeItunesArtworkUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url
    .replace(/100x100bb/g, '600x600bb')
    .replace(/60x60bb/g, '600x600bb')
    .replace(/^http:\/\//i, 'https://');
}

async function fetchItunesCandidates(
  hints: ReturnType<typeof extractSearchHints>,
  trackDuration: number,
  customQuery?: string
): Promise<MetadataCandidate[]> {
  const query = (customQuery?.trim() || hints.combinedQuery).trim();
  if (!query) return [];

  const isNative = Capacitor.isNativePlatform();
  let res: Response | null = null;
  if (!isNative) {
    try {
      res = await fetch(`/api/enrichment/itunes?q=${encodeURIComponent(query)}`);
    } catch {
      res = null;
    }
  }
  if (!res || !res.ok) {
    const params = new URLSearchParams({
      term: query,
      country: 'us',
      media: 'music',
      entity: 'song',
      limit: '8',
    });
    res = await fetch(`${ITUNES_SEARCH_BASE}?${params.toString()}`);
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: ItunesSongRaw[] };
  const rows = data.results || [];
  const out: MetadataCandidate[] = [];

  for (const item of rows) {
    if (!item.trackName || !item.artistName) continue;
    const coverUrl = upgradeItunesArtworkUrl(
      item.artworkUrl600 || item.artworkUrl100 || item.artworkUrl60
    );
    const yearMatch = (item.releaseDate || '').match(/^(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    const durationSec =
      item.trackTimeMillis && item.trackTimeMillis > 0
        ? Math.round(item.trackTimeMillis / 1000)
        : undefined;
    const albumTitle = item.collectionName?.replace(/\s*-\s*Single$/i, '').trim() || 'Single';

    const relevance = scoreCandidateRelevance({
      candTitle: item.trackName,
      candArtist: item.artistName,
      candAlbum: albumTitle,
      candDurationSec: durationSec,
      hintTitle: hints.title,
      hintSearchTitle: hints.searchTitle,
      hintArtist: hints.artist,
      hintAlbum: hints.album,
      trackDuration,
      hasCover: Boolean(coverUrl),
      baseQualityBonus: 0.05,
    });

    if (relevance <= 0 && !customQuery?.trim()) continue;

    out.push({
      recordingId: `itunes-${item.trackId || `${item.artistName}-${item.trackName}`}`,
      title: item.trackName,
      artist: item.artistName,
      album: albumTitle,
      albumArtist: item.collectionArtistName || item.artistName,
      genre: item.primaryGenreName,
      year: year && year >= 1900 && year <= 2100 ? year : undefined,
      trackNumber:
        item.trackNumber && item.trackNumber > 0 ? item.trackNumber : undefined,
      durationSec,
      coverUrl,
      source: 'itunes',
      score: relevance > 0 ? relevance : 0.45,
    });
  }

  return out;
}

export async function fetchMetadataCandidates(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'fileName' | 'duration'>,
  customQuery?: string
): Promise<MetadataCandidate[]> {
  const hints = extractSearchHints(track);
  if (!customQuery?.trim() && !hints.title && !hints.artist) return [];

  const [mbRes, itunesRes] = await Promise.allSettled([
    fetchMusicBrainzCandidates(hints, track.duration, customQuery),
    fetchItunesCandidates(hints, track.duration, customQuery),
  ]);

  const mbList = mbRes.status === 'fulfilled' ? mbRes.value : [];
  const itunesList = itunesRes.status === 'fulfilled' ? itunesRes.value : [];

  // Attach verified iTunes cover art as fallback onto matching MusicBrainz releases
  for (const mb of mbList) {
    const matchingItunes = itunesList.find(
      (it) =>
        tokenOverlapScore(it.title, mb.title) >= 0.7 &&
        tokenOverlapScore(it.artist, mb.artist) >= 0.7
    );
    if (matchingItunes) {
      if (matchingItunes.coverUrl && !mb.fallbackCoverUrl) {
        mb.fallbackCoverUrl = matchingItunes.coverUrl;
      }
      if (!mb.genre && matchingItunes.genre) {
        mb.genre = matchingItunes.genre;
      }
    }
  }

  const combined = [...itunesList, ...mbList].sort((a, b) => b.score - a.score);
  const deduped: MetadataCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const cand of combined) {
    const key = `${normalizeForMatch(cand.title)}::${normalizeForMatch(cand.artist)}::${normalizeForMatch(cand.album)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(cand);
  }

  return deduped;
}

export async function downloadCoverBlob(candidate: {
  releaseId?: string;
  releaseGroupId?: string;
  coverUrl?: string;
  fallbackCoverUrl?: string;
}): Promise<Blob | null> {
  const urls: string[] = [];
  if (candidate.coverUrl) urls.push(candidate.coverUrl);
  if (candidate.releaseId) {
    const releaseUrl = `${COVER_ART_BASE}/release/${candidate.releaseId}/front-500`;
    if (!urls.includes(releaseUrl)) urls.push(releaseUrl);
  }
  if (candidate.releaseGroupId) {
    const rgUrl = `${COVER_ART_BASE}/release-group/${candidate.releaseGroupId}/front-500`;
    if (!urls.includes(rgUrl)) urls.push(rgUrl);
  }
  if (candidate.fallbackCoverUrl && !urls.includes(candidate.fallbackCoverUrl)) {
    urls.push(candidate.fallbackCoverUrl);
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
      // Try next fallback cover URL if available
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

  const parsedFile = parseAudioFilename(track.fileName || '');
  const rawBaseFileName = stripAudioExtension(track.fileName || '');
  const hasUnknownArtist = isPlaceholderArtist(track.artist);
  const hasGenericAlbum = isPlaceholderAlbum(track.album);
  const hasUnknownGenre = !track.genre || track.genre.trim().toLowerCase() === 'unclassified';

  const titleLooksFilenameDerived =
    !track.title ||
    track.title.trim() === rawBaseFileName ||
    hasFilenameNoise(track.title) ||
    normalizeForMatch(track.title) === normalizeForMatch(parsedFile.title) ||
    normalizeForMatch(track.title) === normalizeForMatch(parsedFile.cleanedBaseName);

  const artistLooksFilenameDerived =
    hasUnknownArtist ||
    hasFilenameNoise(track.artist) ||
    (parsedFile.hasExplicitArtist &&
      normalizeForMatch(track.artist) === normalizeForMatch(parsedFile.artist));

  let enrichedMeta: MetadataCandidate | undefined;

  if (options.fetchMetadata || (options.fetchCover && !track.artworkId)) {
    try {
      const metaList = await fetchMetadataCandidates(track);
      const top = metaList[0];
      if (top && top.score >= 0.48) {
        enrichedMeta = top;
      }
    } catch {
      // Continue cleanly to lyrics lookup if metadata request fails
    }
  }

  if (enrichedMeta) {
    metadataMatched = true;
    const overwrite = options.mode === 'overwrite';

    if (options.fetchMetadata) {
      if (
        overwrite ||
        titleLooksFilenameDerived ||
        !track.title
      ) {
        if (enrichedMeta.title && enrichedMeta.title !== track.title) {
          trackPatch.title = enrichedMeta.title;
        }
      }
      if (overwrite || artistLooksFilenameDerived) {
        if (enrichedMeta.artist && enrichedMeta.artist !== track.artist) {
          trackPatch.artist = enrichedMeta.artist;
        }
      }
      if (overwrite || hasGenericAlbum) {
        if (enrichedMeta.album && enrichedMeta.album !== track.album) {
          trackPatch.album = enrichedMeta.album;
        }
        if (enrichedMeta.albumArtist && enrichedMeta.albumArtist !== track.albumArtist) {
          trackPatch.albumArtist = enrichedMeta.albumArtist;
        }
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
  } else if (options.mode === 'missing-only' && (titleLooksFilenameDerived || artistLooksFilenameDerived)) {
    // Even if online services returned nothing or were unreachable, clean dirty filename tags offline!
    if (hasFilenameNoise(track.title) && parsedFile.title && parsedFile.title !== track.title) {
      trackPatch.title = parsedFile.title;
    }
    if (
      (hasUnknownArtist || hasFilenameNoise(track.artist)) &&
      parsedFile.hasExplicitArtist &&
      parsedFile.artist !== track.artist
    ) {
      trackPatch.artist = parsedFile.artist;
      if (isPlaceholderArtist(track.albumArtist)) {
        trackPatch.albumArtist = parsedFile.artist;
      }
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
