import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { ArtistRadarResult, DiscoveryTrackItem, Track } from '../types/music';

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findLocalLibraryMatch(
  item: Pick<DiscoveryTrackItem, 'title' | 'artist'>,
  localTracks: Track[]
): Track | undefined {
  const targetTitle = normalizeKey(item.title);
  const targetArtist = normalizeKey(item.artist);
  if (!targetTitle) return undefined;

  return localTracks.find((t) => {
    const lt = normalizeKey(t.title);
    const la = normalizeKey(t.artist);
    const titleMatches = lt === targetTitle || (targetTitle.length >= 4 && lt.includes(targetTitle));
    const artistMatches =
      !targetArtist ||
      !la ||
      la === 'unknown artist' ||
      la.includes(targetArtist) ||
      targetArtist.includes(la);
    return titleMatches && artistMatches;
  });
}

function upgradeArtworkUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url
    .replace(/100x100bb/g, '600x600bb')
    .replace(/170x170bb/g, '600x600bb')
    .replace(/200x200bb/g, '600x600bb')
    .replace(/^http:\/\//i, 'https://');
}

async function nativeGetJson<T>(url: string): Promise<T> {
  const res = await CapacitorHttp.get({
    url,
    headers: { Accept: 'application/json' },
    connectTimeout: 8000,
    readTimeout: 8000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
}

async function nativeFetchAppleRss(country: string, limit: number): Promise<DiscoveryTrackItem[]> {
  const rssData = await nativeGetJson<{
    feed?: {
      results?: Array<{
        id?: string;
        name?: string;
        artistName?: string;
        artworkUrl100?: string;
        releaseDate?: string;
        url?: string;
        genres?: Array<{ name?: string }>;
      }>;
    };
  }>(`https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${limit}/songs.json`);

  return (rssData.feed?.results || [])
    .filter((r) => r.name && r.artistName)
    .map((r, idx) => ({
      id: r.id || `rss_${idx}`,
      rank: idx + 1,
      title: r.name || 'Unknown Track',
      artist: r.artistName || 'Unknown Artist',
      album: 'Charting Single',
      artworkUrl: upgradeArtworkUrl(r.artworkUrl100),
      releaseDate: r.releaseDate,
      genre: r.genres?.[0]?.name || 'Pop',
      externalUrl: r.url,
    }));
}

async function nativeFetchItunesRss(country: string, limit: number): Promise<DiscoveryTrackItem[]> {
  const itunesRss = await nativeGetJson<{
    feed?: {
      entry?: Array<{
        id?: { attributes?: { 'im:id'?: string } };
        'im:name'?: { label?: string };
        'im:artist'?: { label?: string };
        'im:collection'?: { 'im:name'?: { label?: string } };
        'im:image'?: Array<{ label?: string }>;
        'im:releaseDate'?: { label?: string };
        category?: { attributes?: { label?: string } };
      }>;
    };
  }>(`https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`);

  return (itunesRss.feed?.entry || []).map((entry, idx) => {
    const images = entry['im:image'] || [];
    return {
      id: entry.id?.attributes?.['im:id'] || `itunes_${idx}`,
      rank: idx + 1,
      title: entry['im:name']?.label || 'Unknown Track',
      artist: entry['im:artist']?.label || 'Unknown Artist',
      album: entry['im:collection']?.['im:name']?.label || 'Top Charts',
      artworkUrl: upgradeArtworkUrl(images[images.length - 1]?.label),
      releaseDate: entry['im:releaseDate']?.label,
      genre: entry.category?.attributes?.label || 'Music',
    };
  });
}

export async function fetchTrendingCharts(
  country = 'us',
  limit = 25
): Promise<{ tracks: DiscoveryTrackItem[]; source: string; updatedAt: number }> {
  const cleanCountry = country.trim().toLowerCase() || 'us';
  if (!Capacitor.isNativePlatform()) {
    const params = new URLSearchParams({ country: cleanCountry, limit: String(limit) });
    const res = await fetch(`/api/discovery/trending?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Could not load trending charts (HTTP ${res.status})`);
    }
    return (await res.json()) as {
      tracks: DiscoveryTrackItem[];
      source: string;
      updatedAt: number;
    };
  }

  // Native Android standalone path using CapacitorHttp
  let tracks: DiscoveryTrackItem[] = [];
  let source = 'Apple Music Charts';

  try {
    tracks = await nativeFetchAppleRss(cleanCountry, limit);
  } catch {
    tracks = [];
  }

  if (tracks.length === 0) {
    try {
      const itunesTracks = await nativeFetchItunesRss(cleanCountry, limit);
      if (itunesTracks.length > 0) {
        tracks = itunesTracks;
        source = 'iTunes Top Songs';
      }
    } catch {
      // Fall through to US global fallback
    }
  }

  if (tracks.length === 0 && cleanCountry !== 'us') {
    source = `Apple Music Global Charts (${cleanCountry.toUpperCase()} unavailable)`;
    try {
      tracks = await nativeFetchAppleRss('us', limit);
    } catch {
      tracks = [];
    }
    if (tracks.length === 0) {
      tracks = await nativeFetchItunesRss('us', limit);
      source = `iTunes Global Top Songs (${cleanCountry.toUpperCase()} unavailable)`;
    }
  }

  return { tracks, source, updatedAt: Date.now() };
}

export async function resolveDiscoveryTrackPreview(
  item: Pick<DiscoveryTrackItem, 'artist' | 'title' | 'previewUrl' | 'artworkUrl' | 'album'>,
  country = 'us'
): Promise<{ previewUrl?: string; album?: string; artworkUrl?: string }> {
  if (item.previewUrl) {
    return {
      previewUrl: item.previewUrl,
      album: item.album,
      artworkUrl: item.artworkUrl,
    };
  }

  const cleanCountry = country.trim().toLowerCase() || 'us';

  if (!Capacitor.isNativePlatform()) {
    const params = new URLSearchParams({
      artist: item.artist,
      title: item.title,
      country: cleanCountry,
    });
    const res = await fetch(`/api/discovery/preview?${params.toString()}`);
    if (!res.ok) return {};
    return (await res.json()) as {
      previewUrl?: string;
      album?: string;
      artworkUrl?: string;
    };
  }

  const term = `${item.artist} ${item.title}`.trim();
  const queryStore = async (storeCountry: string) => {
    const params = new URLSearchParams({
      term,
      country: storeCountry,
      media: 'music',
      entity: 'song',
      limit: '5',
    });
    const data = await nativeGetJson<{
      results?: Array<{ previewUrl?: string; collectionName?: string; artworkUrl100?: string }>;
    }>(`https://itunes.apple.com/search?${params.toString()}`);
    const match = (data.results || []).find((r) => Boolean(r.previewUrl));
    if (!match) return null;
    return {
      previewUrl: match.previewUrl,
      album: match.collectionName,
      artworkUrl: upgradeArtworkUrl(match.artworkUrl100),
    };
  };

  try {
    const primary = await queryStore(cleanCountry);
    if (primary) return primary;
  } catch {
    // Fall through to US storefront fallback
  }

  if (cleanCountry !== 'us') {
    try {
      const fallback = await queryStore('us');
      if (fallback) return fallback;
    } catch {
      // Ignore fallback errors
    }
  }

  return {};
}

export async function fetchArtistUpdates(
  artists: string[],
  country = 'us'
): Promise<{ artists: ArtistRadarResult[]; updatedAt: number }> {
  const cleanCountry = country.trim().toLowerCase() || 'us';
  const cleanArtists = Array.from(
    new Set(
      artists
        .map((a) => a.trim())
        .filter((a) => a.length > 0 && a.toLowerCase() !== 'unknown artist')
    )
  ).slice(0, 8);

  if (cleanArtists.length === 0) {
    return { artists: [], updatedAt: Date.now() };
  }

  if (!Capacitor.isNativePlatform()) {
    const res = await fetch('/api/discovery/artist-updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artists: cleanArtists, country: cleanCountry }),
    });
    if (!res.ok) {
      throw new Error(`Could not load artist updates (HTTP ${res.status})`);
    }
    return (await res.json()) as { artists: ArtistRadarResult[]; updatedAt: number };
  }

  const resolved = await Promise.all(
    cleanArtists.map(async (artist): Promise<ArtistRadarResult | null> => {
      const queryStore = async (storeCountry: string) => {
        const params = new URLSearchParams({
          term: artist,
          country: storeCountry,
          media: 'music',
          entity: 'song',
          attribute: 'artistTerm',
          limit: '8',
        });
        const data = await nativeGetJson<{
          results?: Array<{
            trackId?: number;
            trackName?: string;
            artistName?: string;
            collectionName?: string;
            artworkUrl100?: string;
            previewUrl?: string;
            releaseDate?: string;
            primaryGenreName?: string;
            trackViewUrl?: string;
            trackTimeMillis?: number;
          }>;
        }>(`https://itunes.apple.com/search?${params.toString()}`);
        return (data.results || []).filter((s) => Boolean(s.trackName));
      };

      try {
        let list = await queryStore(cleanCountry);
        if (list.length === 0 && cleanCountry !== 'us') {
          list = await queryStore('us');
        }
        const topTracks: DiscoveryTrackItem[] = list.slice(0, 6).map((s, idx) => ({
          id: String(s.trackId || `${artist}_${idx}`),
          title: s.trackName || 'Unknown Track',
          artist: s.artistName || artist,
          album: s.collectionName || 'Single',
          artworkUrl: upgradeArtworkUrl(s.artworkUrl100),
          previewUrl: s.previewUrl,
          releaseDate: s.releaseDate,
          genre: s.primaryGenreName,
          externalUrl: s.trackViewUrl,
          durationSec: s.trackTimeMillis ? Math.round(s.trackTimeMillis / 1000) : undefined,
        }));
        const newest = topTracks
          .slice()
          .sort((a, b) => Date.parse(b.releaseDate || '') - Date.parse(a.releaseDate || ''))[0];
        return {
          artistName: list[0]?.artistName || artist,
          artworkUrl: topTracks[0]?.artworkUrl,
          latestRelease: newest
            ? {
                id: `trk_${newest.id}`,
                title: newest.title,
                releaseDate: newest.releaseDate || '',
                artworkUrl: newest.artworkUrl,
                genre: newest.genre,
                externalUrl: newest.externalUrl,
              }
            : undefined,
          topTracks,
        };
      } catch {
        return null;
      }
    })
  );

  return {
    artists: resolved.filter((a): a is ArtistRadarResult => Boolean(a)),
    updatedAt: Date.now(),
  };
}
