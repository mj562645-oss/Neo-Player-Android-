import {
  resolveTrackArtworkBase64,
  resolveTrackArtworkDataUrl,
} from '../lib/mediaSession';
import NativeAudio, { isNativeAudioAvailable } from '../plugins/nativeAudio';
import type { RepeatMode } from '../types/music';

const LIVE_PILL_TAG = 'neo-live-pill';

export interface PhoneLivePillPayload {
  title: string;
  artist: string;
  album?: string;
  isPlaying?: boolean;
  isFavourite?: boolean;
  repeatMode?: RepeatMode;
  artworkId?: string;
  artworkUrl?: string;
  requestPermissionIfNeeded?: boolean;
}

export interface PhoneNotificationResult {
  ok: boolean;
  permissionStatus: NotificationPermission | 'unsupported' | 'native-granted' | 'native-denied';
  message?: string;
}

async function getReadyServiceWorker(timeoutMs = 1500): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) =>
      window.setTimeout(() => resolve(null), timeoutMs)
    );
    return await Promise.race([readyPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

export async function requestPhoneNotificationPermission(): Promise<boolean> {
  if (isNativeAudioAvailable()) {
    try {
      const res = await NativeAudio.requestNotificationPermission();
      return Boolean(res.granted);
    } catch {
      return false;
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export async function showPhoneNotificationCenterPill(
  payload: PhoneLivePillPayload
): Promise<PhoneNotificationResult> {
  if (isNativeAudioAvailable()) {
    try {
      const artworkBase64 = await resolveTrackArtworkBase64(payload.artworkId, payload.artworkUrl);
      const res = await NativeAudio.previewLivePillNotification({
        title: payload.title,
        artist: payload.artist,
        artworkBase64,
        isPlaying: payload.isPlaying ?? true,
        isFavourite: payload.isFavourite ?? false,
        repeatMode: payload.repeatMode ?? 'off',
        promptPermission: Boolean(payload.requestPermissionIfNeeded),
      });
      return {
        ok: Boolean(res.ok),
        permissionStatus: res.permissionGranted ? 'native-granted' : 'native-denied',
        message: res.permissionGranted
          ? 'Sent album-art Live Pill to your Android notification center.'
          : 'Enable notification permission in Android Settings to show the Live Pill in your notification shade.',
      };
    } catch (err) {
      return {
        ok: false,
        permissionStatus: 'unsupported',
        message: err instanceof Error ? err.message : 'Unable to reach Android notification service.',
      };
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      ok: false,
      permissionStatus: 'unsupported',
      message: 'This browser does not support system notification-center alerts.',
    };
  }

  let perm = Notification.permission;
  if (perm !== 'granted' && payload.requestPermissionIfNeeded) {
    const granted = await requestPhoneNotificationPermission();
    perm = granted ? 'granted' : Notification.permission;
  }

  if (perm !== 'granted') {
    return {
      ok: false,
      permissionStatus: perm,
      message:
        perm === 'denied'
          ? 'Notifications are blocked for this site. Allow Notifications in your phone browser site settings.'
          : 'Allow notification permission to display Neo Player in your phone Notification Center.',
    };
  }

  const origin = window.location.origin;
  const dataArtworkUrl = await resolveTrackArtworkDataUrl(payload.artworkId, payload.artworkUrl);
  const artworkSrc = dataArtworkUrl || payload.artworkUrl || null;

  const defaultIcon = `${origin}/pwa-512x512.png`;
  const icon = artworkSrc || defaultIcon;
  const badge = `${origin}/pwa-192x192.png`;
  const statusLabel = payload.isPlaying ? 'Playing' : 'Paused';
  const body = payload.artist
    ? `${payload.artist}${payload.album ? ` · ${payload.album}` : ''} · ${statusLabel}`
    : `${statusLabel} on Neo Player`;

  const options: NotificationOptions & Record<string, unknown> = {
    body,
    tag: LIVE_PILL_TAG,
    icon,
    badge,
    silent: true,
    renotify: false,
    ...(artworkSrc ? { image: artworkSrc } : {}),
    data: { url: '/' },
  };

  // Android Chrome requires ServiceWorkerRegistration.showNotification() for Notification Center cards.
  const swReg = await getReadyServiceWorker();
  if (swReg) {
    try {
      await swReg.showNotification(payload.title || 'Neo Player', options);
      return {
        ok: true,
        permissionStatus: 'granted',
        message: 'Live notification sent — swipe down your phone Notification Center to view it.',
      };
    } catch {
      // Fallback below for restricted desktop/non-SW contexts
    }
  }

  try {
    new Notification(payload.title || 'Neo Player', options);
    return {
      ok: true,
      permissionStatus: 'granted',
      message: 'Notification posted to your device notification center.',
    };
  } catch {
    return {
      ok: false,
      permissionStatus: 'unsupported',
      message: 'Install as a PWA or allow Service Worker notifications to post to your phone Notification Center.',
    };
  }
}

export async function clearPhoneNotificationCenterPill(): Promise<void> {
  if (isNativeAudioAvailable()) {
    try {
      await NativeAudio.setPlaybackOptions({ livePillNotification: false });
    } catch {
      // Ignore if playback service isn't running
    }
    return;
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const existing = await reg.getNotifications({ tag: LIVE_PILL_TAG });
    for (const notif of existing) {
      notif.close();
    }
  } catch {
    // Ignore notification cleanup errors
  }
}
