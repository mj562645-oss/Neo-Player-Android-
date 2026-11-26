import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const USER_AGENT = 'NeoPlayer/1.0 (https://neoplayer.local)';

const ALLOWED_COVER_HOSTS = new Set([
  'coverartarchive.org',
  'archive.org',
]);

function isAllowedCoverHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_COVER_HOSTS.has(lower)) return true;
  if (lower.endsWith('.archive.org') || lower.endsWith('.mzstatic.com')) return true;
  return false;
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '169.254.169.254' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (/^10\./.test(lower) || /^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function sanitizeCountry(raw: unknown): string {
  if (typeof raw !== 'string') return 'us';
  const cleaned = raw.trim().toLowerCase();
  return /^[a-z]{2}$/.test(cleaned) ? cleaned : 'us';
}

function clampLimit(raw: unknown, fallback = 25): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(50, Math.round(n)));
}

function upgradeArtworkUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  return url
    .replace(/100x100bb/g, '600x600bb')
    .replace(/170x170bb/g, '600x600bb')
    .replace(/200x200bb/g, '600x600bb')
    .replace(/^http:\/\//i, 'https://');
}

interface NormalizedDiscoveryTrack {
  id: string;
  rank?: number;
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  previewUrl?: string;
  releaseDate?: string;
  genre?: string;
  externalUrl?: string;
  durationSec?: number;
}

interface ItunesSearchResult {
  trackId?: number;
  collectionId?: number;
  wrapperType?: string;
  kind?: string;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  previewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  trackTimeMillis?: number;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupItunesPreview(
  artist: string,
  title: string,
  country: string
): Promise<{ previewUrl?: string; album?: string; artworkUrl?: string; durationSec?: number }> {
  const term = `${artist} ${title}`.trim().slice(0, 120);
  if (!term) return {};

  const queryStorefront = async (storeCountry: string) => {
    const params = new URLSearchParams({
      term,
      country: storeCountry,
      media: 'music',
      entity: 'song',
      limit: '5',
    });
    const data = await fetchJsonWithTimeout<{ results?: ItunesSearchResult[] }>(
      `https://itunes.apple.com/search?${params.toString()}`,
      5500
    );
    const list = data.results || [];
    const normTitle = title.toLowerCase().trim();
    const normArtist = artist.toLowerCase().trim();
    const match =
      list.find(
        (r) =>
          Boolean(r.previewUrl) &&
          (r.trackName || '').toLowerCase().includes(normTitle.slice(0, 12)) &&
          (r.artistName || '').toLowerCase().includes(normArtist.slice(0, 10))
      ) || list.find((r) => Boolean(r.previewUrl));

    if (!match) return null;
    return {
      previewUrl: match.previewUrl,
      album: match.collectionName,
      artworkUrl: upgradeArtworkUrl(match.artworkUrl100),
      durationSec: match.trackTimeMillis ? Math.round(match.trackTimeMillis / 1000) : undefined,
    };
  };

  try {
    const primary = await queryStorefront(country);
    if (primary) return primary;
  } catch {
    // Fall through to US storefront fallback
  }

  if (country !== 'us') {
    try {
      const fallback = await queryStorefront('us');
      if (fallback) return fallback;
    } catch {
      // Ignore fallback errors
    }
  }

  return {};
}

async function fetchAppleRssTracks(country: string, limit: number): Promise<NormalizedDiscoveryTrack[]> {
  const rssData = await fetchJsonWithTimeout<{
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

  const results = rssData.feed?.results || [];
  return results
    .filter((r) => r.name && r.artistName)
    .map((r, idx) => ({
      id: r.id || `rss_${idx}_${r.name}`,
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

async function fetchItunesRssTracks(country: string, limit: number): Promise<NormalizedDiscoveryTrack[]> {
  const itunesRss = await fetchJsonWithTimeout<{
    feed?: {
      entry?: Array<{
        id?: { attributes?: { 'im:id'?: string } };
        'im:name'?: { label?: string };
        'im:artist'?: { label?: string };
        'im:collection'?: { 'im:name'?: { label?: string } };
        'im:image'?: Array<{ label?: string }>;
        'im:releaseDate'?: { label?: string };
        category?: { attributes?: { label?: string } };
        link?:
          | Array<{ attributes?: { href?: string; type?: string } }>
          | { attributes?: { href?: string; type?: string } };
      }>;
    };
  }>(`https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`);

  const entries = itunesRss.feed?.entry || [];
  return entries.map((entry, idx) => {
    const links = Array.isArray(entry.link) ? entry.link : entry.link ? [entry.link] : [];
    const previewLink = links.find((l) => l.attributes?.type?.includes('audio'))?.attributes?.href;
    const htmlLink = links.find((l) => !l.attributes?.type?.includes('audio'))?.attributes?.href;
    const images = entry['im:image'] || [];
    const largestImage = images[images.length - 1]?.label;

    return {
      id: entry.id?.attributes?.['im:id'] || `itunes_${idx}`,
      rank: idx + 1,
      title: entry['im:name']?.label || 'Unknown Track',
      artist: entry['im:artist']?.label || 'Unknown Artist',
      album: entry['im:collection']?.['im:name']?.label || 'Top Charts',
      artworkUrl: upgradeArtworkUrl(largestImage),
      previewUrl: previewLink,
      releaseDate: entry['im:releaseDate']?.label,
      genre: entry.category?.attributes?.label || 'Music',
      externalUrl: htmlLink,
    };
  });
}

async function fetchTrendingTracks(
  country: string,
  limit: number
): Promise<{ tracks: NormalizedDiscoveryTrack[]; source: string; updatedAt: number }> {
  let tracks: NormalizedDiscoveryTrack[] = [];
  let source = 'Apple Music Charts';
  let effectiveCountry = country;

  try {
    tracks = await fetchAppleRssTracks(country, limit);
  } catch {
    tracks = [];
  }

  if (tracks.length === 0) {
    try {
      const itunesTracks = await fetchItunesRssTracks(country, limit);
      if (itunesTracks.length > 0) {
        tracks = itunesTracks;
        source = 'iTunes Top Songs';
      }
    } catch {
      // Fall through to global US charts fallback
    }
  }

  if (tracks.length === 0 && country !== 'us') {
    effectiveCountry = 'us';
    source = `Apple Music Global Charts (${country.toUpperCase()} unavailable)`;
    try {
      tracks = await fetchAppleRssTracks('us', limit);
    } catch {
      tracks = [];
    }
    if (tracks.length === 0) {
      tracks = await fetchItunesRssTracks('us', limit);
      source = `iTunes Global Top Songs (${country.toUpperCase()} unavailable)`;
    }
  }

  // Pre-resolve playable 30s previews for top 8 tracks that don't yet have one
  const topNeedingPreview = tracks.slice(0, 8);
  await Promise.all(
    topNeedingPreview.map(async (item) => {
      if (item.previewUrl) return;
      const extra = await lookupItunesPreview(item.artist, item.title, effectiveCountry);
      if (extra.previewUrl) item.previewUrl = extra.previewUrl;
      if (extra.album) item.album = extra.album;
      if (extra.artworkUrl && !item.artworkUrl) item.artworkUrl = extra.artworkUrl;
      if (extra.durationSec) item.durationSec = extra.durationSec;
    })
  );

  return {
    tracks,
    source,
    updatedAt: Date.now(),
  };
}

interface ArtistRadarPayload {
  artistName: string;
  artworkUrl?: string;
  latestRelease?: {
    id: string;
    title: string;
    releaseDate: string;
    artworkUrl?: string;
    genre?: string;
    externalUrl?: string;
  };
  topTracks: NormalizedDiscoveryTrack[];
}

async function fetchSingleArtistRadar(artistName: string, country: string): Promise<ArtistRadarPayload | null> {
  const cleanName = artistName.trim().slice(0, 80);
  if (!cleanName) return null;

  const queryArtistStorefront = async (storeCountry: string) => {
    const songParams = new URLSearchParams({
      term: cleanName,
      country: storeCountry,
      media: 'music',
      entity: 'song',
      attribute: 'artistTerm',
      limit: '10',
    });
    const albumParams = new URLSearchParams({
      term: cleanName,
      country: storeCountry,
      media: 'music',
      entity: 'album',
      attribute: 'artistTerm',
      limit: '5',
    });

    const [songsRes, albumsRes] = await Promise.allSettled([
      fetchJsonWithTimeout<{ results?: ItunesSearchResult[] }>(
        `https://itunes.apple.com/search?${songParams.toString()}`,
        6500
      ),
      fetchJsonWithTimeout<{ results?: ItunesSearchResult[] }>(
        `https://itunes.apple.com/search?${albumParams.toString()}`,
        6500
      ),
    ]);

    return {
      rawSongs:
        songsRes.status === 'fulfilled' && Array.isArray(songsRes.value.results)
          ? songsRes.value.results
          : [],
      rawAlbums:
        albumsRes.status === 'fulfilled' && Array.isArray(albumsRes.value.results)
          ? albumsRes.value.results
          : [],
    };
  };

  let { rawSongs, rawAlbums } = await queryArtistStorefront(country);
  if (rawSongs.length === 0 && rawAlbums.length === 0 && country !== 'us') {
    ({ rawSongs, rawAlbums } = await queryArtistStorefront('us'));
  }

  const normArtist = cleanName.toLowerCase();

  const matchedSongs = rawSongs.filter(
    (s) =>
      s.trackName &&
      s.artistName &&
      (s.artistName.toLowerCase().includes(normArtist) ||
        normArtist.includes(s.artistName.toLowerCase()))
  );
  const effectiveSongs = matchedSongs.length > 0 ? matchedSongs : rawSongs.filter((s) => s.trackName);

  const matchedAlbums = rawAlbums
    .filter(
      (a) =>
        a.collectionName &&
        a.artistName &&
        (a.artistName.toLowerCase().includes(normArtist) ||
          normArtist.includes(a.artistName.toLowerCase()))
    )
    .sort((a, b) => {
      const da = a.releaseDate ? Date.parse(a.releaseDate) : 0;
      const db = b.releaseDate ? Date.parse(b.releaseDate) : 0;
      return db - da;
    });

  const topTracks: NormalizedDiscoveryTrack[] = effectiveSongs.slice(0, 6).map((s, idx) => ({
    id: String(s.trackId || `${cleanName}_${idx}`),
    title: s.trackName || 'Unknown Track',
    artist: s.artistName || cleanName,
    album: s.collectionName || 'Single',
    artworkUrl: upgradeArtworkUrl(s.artworkUrl100 || s.artworkUrl60),
    previewUrl: s.previewUrl,
    releaseDate: s.releaseDate,
    genre: s.primaryGenreName,
    externalUrl: s.trackViewUrl,
    durationSec: s.trackTimeMillis ? Math.round(s.trackTimeMillis / 1000) : undefined,
  }));

  const newestAlbum = matchedAlbums[0];
  const newestSongByDate = effectiveSongs
    .slice()
    .sort((a, b) => {
      const da = a.releaseDate ? Date.parse(a.releaseDate) : 0;
      const db = b.releaseDate ? Date.parse(b.releaseDate) : 0;
      return db - da;
    })[0];

  let latestRelease: ArtistRadarPayload['latestRelease'];
  const albumDate = newestAlbum?.releaseDate ? Date.parse(newestAlbum.releaseDate) : 0;
  const songDate = newestSongByDate?.releaseDate ? Date.parse(newestSongByDate.releaseDate) : 0;

  if (newestAlbum && albumDate >= songDate) {
    latestRelease = {
      id: `alb_${newestAlbum.collectionId || newestAlbum.collectionName}`,
      title: newestAlbum.collectionName || 'New Release',
      releaseDate: newestAlbum.releaseDate || '',
      artworkUrl: upgradeArtworkUrl(newestAlbum.artworkUrl100),
      genre: newestAlbum.primaryGenreName,
      externalUrl: newestAlbum.collectionViewUrl,
    };
  } else if (newestSongByDate && newestSongByDate.trackName) {
    latestRelease = {
      id: `trk_${newestSongByDate.trackId || newestSongByDate.trackName}`,
      title: newestSongByDate.trackName,
      releaseDate: newestSongByDate.releaseDate || '',
      artworkUrl: upgradeArtworkUrl(newestSongByDate.artworkUrl100),
      genre: newestSongByDate.primaryGenreName,
      externalUrl: newestSongByDate.trackViewUrl,
    };
  }

  return {
    artistName: effectiveSongs[0]?.artistName || newestAlbum?.artistName || cleanName,
    artworkUrl: latestRelease?.artworkUrl || topTracks[0]?.artworkUrl,
    latestRelease,
    topTracks,
  };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'neo-player' });
  });

  app.get('/privacy', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neo Player — Privacy Policy &amp; Google API Limited Use</title>
  <style>
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 740px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #18181b; background: #fafafa; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.15rem; margin-top: 1.75rem; }
    .meta { color: #52525b; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px 20px; margin: 16px 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Neo Player Privacy Policy</h1>
  <p class="meta">Effective Date: November 2026 &middot; Application: Neo Player</p>
  <div class="card">
    <strong>Summary:</strong> Neo Player stores your local audio library, artwork, playlists, lyrics, and personalization preferences on your own device using IndexedDB and native Android device storage. When you optionally connect a Google account, Neo Player requests strictly read-only YouTube access (<code>https://www.googleapis.com/auth/youtube.readonly</code>) solely inside your client session to display and stream your playlists, liked music, and subscriptions.
  </div>
  <h2>1. Google Account &amp; YouTube Data Access</h2>
  <ul>
    <li><strong>Multi-User Sign-In:</strong> Any Google account user may sign in, switch accounts, or disconnect at any time.</li>
    <li><strong>Scope Used:</strong> <code>youtube.readonly</code> only. Neo Player never modifies, deletes, uploads, or posts content to your YouTube or Google account.</li>
    <li><strong>Storage &amp; Sharing:</strong> OAuth access tokens remain in client memory during active sessions and are never sold, shared with advertisers, or transmitted to unrelated third-party servers.</li>
  </ul>
  <h2>2. Google API Services User Data Policy (Limited Use)</h2>
  <p>Neo Player&rsquo;s use and transfer to any other app of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
  <h2>3. Local Audio Files &amp; Revoking Access</h2>
  <p>You can clear cached application data or disconnect your Google account anytime inside <strong>Settings &rarr; Google &amp; YouTube Account</strong>, or revoke permissions directly in your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account Permissions</a> page.</p>
</body>
</html>`);
  });

  app.get('/terms', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neo Player — Terms of Service</title>
  <style>
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 740px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #18181b; background: #fafafa; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.15rem; margin-top: 1.75rem; }
    .meta { color: #52525b; font-size: 0.9rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Neo Player Terms of Service</h1>
  <p class="meta">Effective Date: November 2026 &middot; Application: Neo Player</p>
  <h2>1. Acceptable Use</h2>
  <p>Neo Player is a personal media player for local audio files owned or licensed by the user and optional authorized YouTube playback via official YouTube APIs and embedded IFrame Player.</p>
  <h2>2. Third-Party Services</h2>
  <p>Optional YouTube integration is governed by the YouTube Terms of Service and Google Privacy Policy. Users may connect or disconnect their Google account at their discretion.</p>
  <h2>3. Disclaimer</h2>
  <p>Neo Player is provided on an &ldquo;as is&rdquo; basis. Always keep backups of irreplaceable audio files prior to editing embedded file tags.</p>
</body>
</html>`);
  });

  app.get('/api/discovery/trending', async (req, res) => {
    try {
      const country = sanitizeCountry(req.query.country);
      const limit = clampLimit(req.query.limit, 25);
      const data = await fetchTrendingTracks(country, limit);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch trending charts',
      });
    }
  });

  app.get('/api/discovery/preview', async (req, res) => {
    const artist = typeof req.query.artist === 'string' ? req.query.artist.slice(0, 80) : '';
    const title = typeof req.query.title === 'string' ? req.query.title.slice(0, 100) : '';
    const country = sanitizeCountry(req.query.country);
    if (!artist && !title) {
      res.status(400).json({ error: 'artist or title is required' });
      return;
    }
    const result = await lookupItunesPreview(artist, title, country);
    res.json(result);
  });

  app.post('/api/discovery/artist-updates', async (req, res) => {
    try {
      const body = req.body as { artists?: unknown; country?: unknown } | undefined;
      const country = sanitizeCountry(body?.country);
      const rawList = Array.isArray(body?.artists) ? body.artists : [];
      const artists = Array.from(
        new Set(
          rawList
            .filter((item): item is string => typeof item === 'string')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && s.toLowerCase() !== 'unknown artist')
        )
      ).slice(0, 8);

      if (artists.length === 0) {
        res.json({ artists: [], updatedAt: Date.now() });
        return;
      }

      const resolved = await Promise.all(
        artists.map((artist) => fetchSingleArtistRadar(artist, country))
      );

      res.json({
        artists: resolved.filter((a): a is ArtistRadarPayload => Boolean(a)),
        updatedAt: Date.now(),
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch artist updates',
      });
    }
  });

  app.get('/api/enrichment/musicbrainz', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 240) : '';
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }
    try {
      const params = new URLSearchParams({ query: q, fmt: 'json', limit: '6' });
      const data = await fetchJsonWithTimeout<unknown>(
        `https://musicbrainz.org/ws/2/recording?${params.toString()}`,
        8000
      );
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'MusicBrainz lookup failed',
      });
    }
  });

  app.get('/api/enrichment/lrclib', async (req, res) => {
    const mode = req.query.mode === 'get' ? 'get' : 'search';
    try {
      const params = new URLSearchParams();
      if (mode === 'get') {
        const trackName =
          typeof req.query.track_name === 'string' ? req.query.track_name.trim().slice(0, 160) : '';
        const artistName =
          typeof req.query.artist_name === 'string'
            ? req.query.artist_name.trim().slice(0, 160)
            : '';
        if (!trackName || !artistName) {
          res.status(400).json({ error: 'track_name and artist_name are required' });
          return;
        }
        params.set('track_name', trackName);
        params.set('artist_name', artistName);
        if (typeof req.query.album_name === 'string' && req.query.album_name.trim()) {
          params.set('album_name', req.query.album_name.trim().slice(0, 160));
        }
        if (typeof req.query.duration === 'string' && /^\d{1,5}$/.test(req.query.duration)) {
          params.set('duration', req.query.duration);
        }
        const data = await fetchJsonWithTimeout<unknown>(
          `https://lrclib.net/api/get?${params.toString()}`,
          8000
        );
        res.json(data);
        return;
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
      if (!q) {
        res.status(400).json({ error: 'Query parameter q is required' });
        return;
      }
      params.set('q', q);
      const data = await fetchJsonWithTimeout<unknown>(
        `https://lrclib.net/api/search?${params.toString()}`,
        8000
      );
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LRCLIB lookup failed';
      const status = msg.includes('404') ? 404 : 502;
      res.status(status).json({ error: msg });
    }
  });

  app.get('/api/enrichment/cover', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl || rawUrl.length > 512) {
      res.status(400).json({ error: 'Invalid cover URL' });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Malformed URL' });
      return;
    }

    if (
      parsed.protocol !== 'https:' ||
      isPrivateOrLoopbackHost(parsed.hostname) ||
      !isAllowedCoverHostname(parsed.hostname)
    ) {
      res.status(403).json({ error: 'Cover host not allowed' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const upstream = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }
      const ctype = upstream.headers.get('content-type') || 'image/jpeg';
      if (!ctype.startsWith('image/')) {
        res.status(415).end();
        return;
      }
      const ab = await upstream.arrayBuffer();
      if (ab.byteLength > 8 * 1024 * 1024) {
        res.status(413).end();
        return;
      }
      res.setHeader('Content-Type', ctype);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(Buffer.from(ab));
    } catch {
      res.status(502).end();
    } finally {
      clearTimeout(timer);
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build missing. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Neo Player server running on http://0.0.0.0:${PORT}`);
  });
}

void createApp();
