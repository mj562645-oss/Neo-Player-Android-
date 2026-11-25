import firebaseConfig from '../../firebase-applet-config.json';
import type {
  Track,
  YouTubeChannelInfo,
  YouTubePlaylistSummary,
  YouTubeSubscriptionItem,
} from '../types/music';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_YT_API_ENABLE_URL = `https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=${firebaseConfig.projectId}`;

export class YouTubeApiError extends Error {
  status: number;
  isAuthError: boolean;
  isApiDisabled: boolean;
  activationUrl?: string;

  constructor(
    message: string,
    status: number,
    options?: { isApiDisabled?: boolean; activationUrl?: string }
  ) {
    super(message);
    this.name = 'YouTubeApiError';
    this.status = status;
    this.isAuthError = status === 401;
    this.isApiDisabled = Boolean(options?.isApiDisabled);
    this.activationUrl = options?.activationUrl;
  }
}

interface YTThumbnailSet {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
  standard?: { url: string };
  maxres?: { url: string };
}

function pickThumbnail(thumbs?: YTThumbnailSet): string | undefined {
  return (
    thumbs?.maxres?.url ||
    thumbs?.standard?.url ||
    thumbs?.high?.url ||
    thumbs?.medium?.url ||
    thumbs?.default?.url
  );
}

export function parseIsoDuration(iso?: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanChannelArtist(raw?: string): string {
  if (!raw) return 'YouTube Music';
  return raw.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim() || 'YouTube Music';
}

function parseYouTubeTrackTitle(
  rawTitle: string,
  channelTitle?: string
): { title: string; artist: string } {
  const cleanedRaw = rawTitle
    .replace(/\s*[\(\[]\s*(official\s*(music\s*)?(video|audio|lyric\s*video|visualizer)|lyrics?|audio|hd|4k|hq|mv)\s*[\)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const fallbackArtist = cleanChannelArtist(channelTitle);

  const dashMatch = cleanedRaw.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    const maybeArtist = dashMatch[1].trim();
    const maybeTitle = dashMatch[2].trim();
    if (maybeArtist.length >= 2 && maybeTitle.length >= 2) {
      return {
        artist: maybeArtist,
        title: maybeTitle,
      };
    }
  }

  return {
    title: cleanedRaw || rawTitle || 'Untitled Track',
    artist: fallbackArtist,
  };
}

async function ytFetch<T>(
  path: string,
  token: string | null,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${YT_API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (firebaseConfig.apiKey) {
    url.searchParams.set('key', firebaseConfig.apiKey);
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    let errMsg = `YouTube request failed (${res.status})`;
    let isApiDisabled = false;
    let activationUrl: string | undefined;
    let isKeyBlocked = false;

    try {
      const errJson = (await res.json()) as {
        error?: {
          message?: string;
          errors?: Array<{ reason?: string }>;
          details?: Array<{ reason?: string; metadata?: { activationUrl?: string } }>;
        };
      };
      if (errJson.error?.message) {
        errMsg = errJson.error.message;
      }
      isKeyBlocked = Boolean(
        errJson.error?.details?.some(
          (d) =>
            d.reason === 'API_KEY_SERVICE_BLOCKED' ||
            d.reason === 'API_KEY_HTTP_REFERRER_BLOCKED' ||
            d.reason === 'API_KEY_INVALID'
        )
      );
      const hasDisabledReason =
        !isKeyBlocked &&
        (errJson.error?.errors?.some((e) => e.reason === 'accessNotConfigured') ||
          errJson.error?.details?.some((d) => d.reason === 'SERVICE_DISABLED') ||
          /has not been used in project|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(
            errMsg
          ));

      if (res.status === 403 && hasDisabledReason) {
        isApiDisabled = true;
        const urlMatch = errMsg.match(/https:\/\/console\.[^\s]+/);
        activationUrl =
          errJson.error?.details?.find((d) => d.metadata?.activationUrl)?.metadata?.activationUrl ||
          urlMatch?.[0] ||
          DEFAULT_YT_API_ENABLE_URL;
      }
    } catch {
      // ignore json parse failure
    }
    const effectiveStatus = !token && (res.status === 400 || (res.status === 403 && isKeyBlocked)) ? 401 : res.status;
    throw new YouTubeApiError(errMsg, effectiveStatus, { isApiDisabled, activationUrl });
  }

  return (await res.json()) as T;
}

interface YTChannelListResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      thumbnails?: YTThumbnailSet;
    };
    statistics?: {
      subscriberCount?: string;
    };
    contentDetails?: {
      relatedPlaylists?: {
        likes?: string;
        uploads?: string;
      };
    };
  }>;
}

export async function fetchMyYouTubeChannel(token: string): Promise<{
  channel: YouTubeChannelInfo | null;
  likesPlaylistId?: string;
}> {
  const data = await ytFetch<YTChannelListResponse>('channels', token, {
    part: 'snippet,statistics,contentDetails',
    mine: 'true',
  });

  const item = data.items?.[0];
  if (!item) {
    return { channel: null };
  }

  return {
    channel: {
      id: item.id,
      title: item.snippet?.title || 'YouTube Account',
      description: item.snippet?.description,
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
      subscriberCount: item.statistics?.subscriberCount,
      customUrl: item.snippet?.customUrl,
    },
    likesPlaylistId: item.contentDetails?.relatedPlaylists?.likes,
  };
}

interface YTPlaylistsResponse {
  nextPageToken?: string;
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: YTThumbnailSet;
    };
    contentDetails?: {
      itemCount?: number;
    };
    status?: {
      privacyStatus?: string;
    };
  }>;
}

export async function fetchMyYouTubePlaylists(token: string): Promise<YouTubePlaylistSummary[]> {
  const playlists: YouTubePlaylistSummary[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    const data = await ytFetch<YTPlaylistsResponse>('playlists', token, {
      part: 'snippet,contentDetails,status',
      mine: 'true',
      maxResults: 50,
      pageToken,
    });

    for (const item of data.items || []) {
      playlists.push({
        id: item.id,
        title: item.snippet?.title || 'Untitled Playlist',
        description: item.snippet?.description || '',
        thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
        itemCount: item.contentDetails?.itemCount ?? 0,
        channelTitle: item.snippet?.channelTitle,
        privacyStatus: item.status?.privacyStatus,
        publishedAt: item.snippet?.publishedAt,
      });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return playlists;
}

interface YTVideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      categoryId?: string;
      thumbnails?: YTThumbnailSet;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
}

async function fetchVideoDetailsBatch(
  token: string | null,
  videoIds: string[]
): Promise<Map<string, { duration: number; channelTitle?: string; thumbnailUrl?: string; title?: string; publishedAt?: string; categoryId?: string }>> {
  const map = new Map<
    string,
    {
      duration: number;
      channelTitle?: string;
      thumbnailUrl?: string;
      title?: string;
      publishedAt?: string;
      categoryId?: string;
    }
  >();

  const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));
  for (let i = 0; i < uniqueIds.length; i += 50) {
    const chunk = uniqueIds.slice(i, i + 50);
    if (chunk.length === 0) continue;
    const data = await ytFetch<YTVideosResponse>('videos', token, {
      part: 'contentDetails,snippet',
      id: chunk.join(','),
    });

    for (const v of data.items || []) {
      map.set(v.id, {
        duration: parseIsoDuration(v.contentDetails?.duration),
        channelTitle: v.snippet?.channelTitle,
        thumbnailUrl: pickThumbnail(v.snippet?.thumbnails),
        title: v.snippet?.title,
        publishedAt: v.snippet?.publishedAt,
        categoryId: v.snippet?.categoryId,
      });
    }
  }

  return map;
}

interface YTPlaylistItemsResponse {
  nextPageToken?: string;
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      channelTitle?: string;
      videoOwnerChannelTitle?: string;
      thumbnails?: YTThumbnailSet;
      resourceId?: {
        videoId?: string;
      };
    };
    contentDetails?: {
      videoId?: string;
    };
  }>;
}

export async function fetchYouTubePlaylistTracks(
  token: string | null,
  playlistId: string,
  albumLabel = 'YouTube Music'
): Promise<Track[]> {
  const rawItems: NonNullable<YTPlaylistItemsResponse['items']> = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 2; page++) {
    const data = await ytFetch<YTPlaylistItemsResponse>('playlistItems', token, {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
    });
    if (data.items) rawItems.push(...data.items);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  const playableRaw = rawItems.filter((item) => {
    const vid = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
    const title = item.snippet?.title || '';
    return Boolean(vid) && title !== 'Deleted video' && title !== 'Private video';
  });

  const videoIds = playableRaw
    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || '')
    .filter(Boolean);

  const detailMap = await fetchVideoDetailsBatch(token, videoIds);
  const seen = new Set<string>();
  const tracks: Track[] = [];

  for (let i = 0; i < playableRaw.length; i++) {
    const item = playableRaw[i];
    const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);

    const detail = detailMap.get(videoId);
    const rawTitle = detail?.title || item.snippet?.title || 'Untitled Track';
    const rawChannel =
      item.snippet?.videoOwnerChannelTitle ||
      detail?.channelTitle ||
      item.snippet?.channelTitle;
    const parsed = parseYouTubeTrackTitle(rawTitle, rawChannel);
    const thumb = detail?.thumbnailUrl || pickThumbnail(item.snippet?.thumbnails);
    const published = detail?.publishedAt || item.snippet?.publishedAt;
    const year = published ? new Date(published).getFullYear() : undefined;

    tracks.push({
      id: `yt:${videoId}`,
      title: parsed.title,
      artist: parsed.artist,
      album: albumLabel,
      albumArtist: parsed.artist,
      genre: 'YouTube Music',
      year: year && Number.isFinite(year) ? year : undefined,
      trackNumber: i + 1,
      duration: detail?.duration || 0,
      fileName: `${parsed.title}.yt`,
      mimeType: 'audio/youtube',
      fileSize: 0,
      format: 'YouTube',
      artworkUrl: thumb,
      isFavourite: albumLabel === 'Liked Music',
      addedAt: published ? new Date(published).getTime() : Date.now(),
      playCount: 0,
      source: 'youtube',
      youtubeVideoId: videoId,
    });
  }

  return tracks;
}

export async function fetchMyLikedYouTubeMusic(
  token: string,
  likesPlaylistId?: string
): Promise<Track[]> {
  const results: Track[] = [];
  const seen = new Set<string>();

  // 1. Try YouTube Music dedicated Liked Music playlist ("LM") or channel's likes playlist
  const candidatePlaylistIds = Array.from(
    new Set(['LM', likesPlaylistId].filter((id): id is string => Boolean(id)))
  );

  for (const plId of candidatePlaylistIds) {
    try {
      const tracks = await fetchYouTubePlaylistTracks(token, plId, 'Liked Music');
      for (const t of tracks) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          results.push(t);
        }
      }
      if (results.length > 0) break;
    } catch (err) {
      if (err instanceof YouTubeApiError && err.isAuthError) throw err;
      // Otherwise try next candidate / videos?myRating=like
    }
  }

  // 2. Also query videos?myRating=like as fallback or supplement (music category prioritized)
  try {
    const data = await ytFetch<YTVideosResponse>('videos', token, {
      part: 'snippet,contentDetails',
      myRating: 'like',
      maxResults: 50,
    });

    const items = data.items || [];
    // Sort music videos (categoryId === '10') first if mixed with non-music likes
    const sorted = items.slice().sort((a, b) => {
      const aMusic = a.snippet?.categoryId === '10' ? 0 : 1;
      const bMusic = b.snippet?.categoryId === '10' ? 0 : 1;
      return aMusic - bMusic;
    });

    for (const v of sorted) {
      const trackId = `yt:${v.id}`;
      if (seen.has(trackId)) continue;
      // If LM already returned music tracks, keep only music category from myRating=like
      if (results.length > 0 && v.snippet?.categoryId !== '10') continue;

      seen.add(trackId);
      const rawTitle = v.snippet?.title || 'Untitled Track';
      const parsed = parseYouTubeTrackTitle(rawTitle, v.snippet?.channelTitle);
      const published = v.snippet?.publishedAt;
      const year = published ? new Date(published).getFullYear() : undefined;

      results.push({
        id: trackId,
        title: parsed.title,
        artist: parsed.artist,
        album: 'Liked Music',
        albumArtist: parsed.artist,
        genre: v.snippet?.categoryId === '10' ? 'YouTube Music' : 'YouTube',
        year: year && Number.isFinite(year) ? year : undefined,
        duration: parseIsoDuration(v.contentDetails?.duration),
        fileName: `${parsed.title}.yt`,
        mimeType: 'audio/youtube',
        fileSize: 0,
        format: 'YouTube',
        artworkUrl: pickThumbnail(v.snippet?.thumbnails),
        isFavourite: true,
        addedAt: published ? new Date(published).getTime() : Date.now(),
        playCount: 0,
        source: 'youtube',
        youtubeVideoId: v.id,
      });
    }
  } catch (err) {
    if (err instanceof YouTubeApiError && err.isAuthError) throw err;
  }

  return results;
}

interface YTSubscriptionsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      resourceId?: {
        channelId?: string;
      };
      thumbnails?: YTThumbnailSet;
    };
  }>;
}

export async function fetchMyYouTubeSubscriptions(
  token: string
): Promise<YouTubeSubscriptionItem[]> {
  const data = await ytFetch<YTSubscriptionsResponse>('subscriptions', token, {
    part: 'snippet',
    mine: 'true',
    order: 'relevance',
    maxResults: 50,
  });

  return (data.items || [])
    .map((item) => ({
      id: item.id,
      channelId: item.snippet?.resourceId?.channelId || '',
      title: cleanChannelArtist(item.snippet?.title),
      description: item.snippet?.description || '',
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
    }))
    .filter((sub) => Boolean(sub.channelId));
}

export async function fetchYouTubeChannelTracks(
  token: string | null,
  channelId: string,
  channelTitle: string
): Promise<Track[]> {
  const data = await ytFetch<YTChannelListResponse>('channels', token, {
    part: 'contentDetails',
    id: channelId,
  });

  const uploadsId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];

  return fetchYouTubePlaylistTracks(token, uploadsId, channelTitle);
}

interface YTSearchResponse {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: YTThumbnailSet;
    };
  }>;
}

export async function searchYouTubeMusic(token: string | null, query: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let data = await ytFetch<YTSearchResponse>('search', token, {
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10', // Music category
    maxResults: 24,
    q: trimmed,
  });

  let items = (data.items || []).filter((i) => Boolean(i.id?.videoId));
  if (items.length === 0) {
    data = await ytFetch<YTSearchResponse>('search', token, {
      part: 'snippet',
      type: 'video',
      maxResults: 24,
      q: trimmed,
    });
    items = (data.items || []).filter((i) => Boolean(i.id?.videoId));
  }

  const videoIds = items.map((i) => i.id!.videoId!).filter(Boolean);
  const details = await fetchVideoDetailsBatch(token, videoIds);

  return items.map((item, idx) => {
    const videoId = item.id!.videoId!;
    const detail = details.get(videoId);
    const rawTitle = detail?.title || item.snippet?.title || 'Untitled Track';
    const rawChannel = detail?.channelTitle || item.snippet?.channelTitle;
    const parsed = parseYouTubeTrackTitle(rawTitle, rawChannel);
    const published = detail?.publishedAt || item.snippet?.publishedAt;
    const year = published ? new Date(published).getFullYear() : undefined;

    return {
      id: `yt:${videoId}`,
      title: parsed.title,
      artist: parsed.artist,
      album: 'YouTube Music',
      albumArtist: parsed.artist,
      genre: 'YouTube Music',
      year: year && Number.isFinite(year) ? year : undefined,
      trackNumber: idx + 1,
      duration: detail?.duration || 0,
      fileName: `${parsed.title}.yt`,
      mimeType: 'audio/youtube',
      fileSize: 0,
      format: 'YouTube',
      artworkUrl: detail?.thumbnailUrl || pickThumbnail(item.snippet?.thumbnails),
      isFavourite: false,
      addedAt: published ? new Date(published).getTime() : Date.now(),
      playCount: 0,
      source: 'youtube',
      youtubeVideoId: videoId,
    };
  });
}
