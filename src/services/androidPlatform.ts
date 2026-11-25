import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

export interface PlatformInfo {
  isNativeAndroid: boolean;
  isAndroidBrowser: boolean;
  platformName: 'android-native' | 'android-pwa' | 'web';
}

export function getPlatformInfo(): PlatformInfo {
  const isNativeAndroid =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isAndroidBrowser = !isNativeAndroid && ua.includes('android');

  return {
    isNativeAndroid,
    isAndroidBrowser,
    platformName: isNativeAndroid
      ? 'android-native'
      : isAndroidBrowser
        ? 'android-pwa'
        : 'web',
  };
}

export async function syncAndroidStatusBar(resolvedTheme: 'light' | 'dark'): Promise<void> {
  if (typeof document !== 'undefined') {
    const color = resolvedTheme === 'dark' ? '#08090C' : '#F7F7FA';
    const metaTags = document.querySelectorAll('meta[name="theme-color"]');
    if (metaTags.length > 0) {
      metaTags.forEach((tag) => {
        if (!tag.hasAttribute('media')) {
          tag.setAttribute('content', color);
        }
      });
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('StatusBar')) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({
        style: resolvedTheme === 'dark' ? Style.Dark : Style.Light,
      });
    } catch {
      // Ignore on unsupported webviews
    }
  }
}

export async function triggerHaptic(
  enabled: boolean,
  intensity: 'light' | 'medium' = 'light'
): Promise<void> {
  if (!enabled) return;
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
    try {
      await Haptics.impact({
        style: intensity === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
      });
      return;
    } catch {
      // fallback below
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(intensity === 'medium' ? 14 : 8);
    } catch {
      // ignore blocked vibration
    }
  }
}

export function registerAndroidBackHandler(onBack: () => boolean): () => void {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) {
    return () => {};
  }
  let handle: { remove: () => Promise<void> } | null = null;
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBack();
    if (!handled && !canGoBack) {
      void CapApp.minimizeApp();
    }
  }).then((h) => {
    handle = h;
  });

  return () => {
    void handle?.remove();
  };
}

let activeWakeLock: WakeLockSentinel | null = null;

export async function syncScreenWakeLock(shouldKeepAwake: boolean): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    if (shouldKeepAwake && !activeWakeLock) {
      activeWakeLock = await navigator.wakeLock.request('screen');
      activeWakeLock.addEventListener('release', () => {
        activeWakeLock = null;
      });
    } else if (!shouldKeepAwake && activeWakeLock) {
      await activeWakeLock.release();
      activeWakeLock = null;
    }
  } catch {
    // Ignore wake lock restrictions when battery saver or background tab is active
  }
}
