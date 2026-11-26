import { db } from '../services/db';
import type { Track } from '../types/music';

export interface MediaSessionActionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeekTo?: (seconds: number) => void;
  onSeekStep?: (delta: number) => void;
}

const dataUrlCache = new Map<string, string>();
let activeHandlers: MediaSessionActionHandlers = {};
let metadataRequestSeq = 0;
let metadataSyncEnabled = true;

export function setMediaSessionMetadataSyncEnabled(enabled: boolean): void {
  metadataSyncEnabled = enabled;
  if (!enabled && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    metadataRequestSeq++;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Neo Player',
        artist: 'Audio Playback',
        album: '',
        artwork: getDefaultAppArtwork(),
      });
    } catch {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function blobToNotificationArtworkDataUrl(blob: Blob): Promise<string | null> {
  if (typeof document === 'undefined') {
    return blobToDataUrl(blob);
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = objectUrl;
    });
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return await blobToDataUrl(blob);
    }
    const maxDim = 512;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return await blobToDataUrl(blob);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return await blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function resolveArtworkDataUrl(artworkId?: string): Promise<string | null> {
  if (!artworkId) return null;
  const cached = dataUrlCache.get(artworkId);
  if (cached) return cached;
  const blob = await db.getArtworkBlob(artworkId);
  if (!blob || blob.size === 0) return null;
  const dataUrl = await blobToNotificationArtworkDataUrl(blob);
  if (dataUrl) {
    if (dataUrlCache.size > 40) {
      const oldestKey = dataUrlCache.keys().next().value;
      if (oldestKey) dataUrlCache.delete(oldestKey);
    }
    dataUrlCache.set(artworkId, dataUrl);
  }
  return dataUrl;
}

export function invalidateArtworkDataUrlCache(artworkId?: string): void {
  if (artworkId) {
    dataUrlCache.delete(artworkId);
  } else {
    dataUrlCache.clear();
  }
}

export function setMediaSessionHandlers(handlers: MediaSessionActionHandlers): void {
  activeHandlers = handlers;
  bindNavigatorMediaSessionHandlers();
}

export function bindNavigatorMediaSessionHandlers(override?: MediaSessionActionHandlers): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const h = override || activeHandlers;
  const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      // Ignore unsupported Media Session action in older browsers
    }
  };

  safeSet('play', () => {
    h.onPlay?.();
  });
  safeSet('pause', () => {
    h.onPause?.();
  });
  safeSet('previoustrack', () => {
    h.onPrev?.();
  });
  safeSet('nexttrack', () => {
    h.onNext?.();
  });
  safeSet('seekto', (details) => {
    if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
      h.onSeekTo?.(details.seekTime);
    }
  });
  safeSet('seekbackward', (details) => {
    h.onSeekStep?.(-(details.seekOffset || 15));
  });
  safeSet('seekforward', (details) => {
    h.onSeekStep?.(details.seekOffset || 15);
  });
}

function getDefaultAppArtwork(): MediaImage[] {
  if (typeof window === 'undefined') return [];
  const origin = window.location.origin;
  return [
    { src: `${origin}/pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${origin}/pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
  ];
}

export async function updateMediaSessionTrackMetadata(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'artworkId' | 'artworkUrl'>
): Promise<void> {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const reqId = ++metadataRequestSeq;

  if (!metadataSyncEnabled) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Neo Player',
        artist: 'Audio Playback',
        album: '',
        artwork: getDefaultAppArtwork(),
      });
    } catch {
      // Ignore environments without MediaMetadata constructor
    }
    return;
  }

  const artwork: MediaImage[] = [];
  if (track.artworkId) {
    const dataUrl = await resolveArtworkDataUrl(track.artworkId);
    if (reqId !== metadataRequestSeq) return;
    if (dataUrl) {
      artwork.push({ src: dataUrl, sizes: '512x512', type: 'image/jpeg' });
    }
  } else if (track.artworkUrl) {
    artwork.push({ src: track.artworkUrl, sizes: '512x512' });
  }

  if (artwork.length === 0) {
    artwork.push(...getDefaultAppArtwork());
  }

  if (reqId !== metadataRequestSeq) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Neo Player',
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Single',
      artwork,
    });
  } catch {
    // Ignore environments without MediaMetadata constructor
  }
}

export function setMediaSessionPlaybackState(state: MediaSessionPlaybackState): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    // Ignore unsupported playbackState assignments
  }
}

export function updateMediaSessionPosition(
  positionSeconds: number,
  durationSeconds: number,
  playbackRate = 1
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (typeof navigator.mediaSession.setPositionState !== 'function') return;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

  const safeDuration = Math.max(0.01, durationSeconds);
  const safePosition = Math.min(
    safeDuration,
    Math.max(0, Number.isFinite(positionSeconds) ? positionSeconds : 0)
  );
  const safeRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;

  try {
    navigator.mediaSession.setPositionState({
      duration: safeDuration,
      playbackRate: safeRate,
      position: safePosition,
    });
  } catch {
    // Ignore range race during track switches
  }
}

export function clearMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  metadataRequestSeq++;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch {
    // Ignore cleanup errors
  }
}
