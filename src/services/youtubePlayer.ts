import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'] as const;

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GisErrorResponse {
  type?: string;
  message?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: {
    prompt?: string;
    hint?: string;
    scope?: string;
    include_granted_scopes?: boolean;
  }) => void;
}

interface GoogleIdentityOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    hint?: string;
    include_granted_scopes?: boolean;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: GisErrorResponse) => void;
  }) => GisTokenClient;
}

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function getGisOAuth2(): GoogleIdentityOAuth2 | null {
  if (typeof window === 'undefined') return null;
  const g = (window as unknown as { google?: { accounts?: { oauth2?: GoogleIdentityOAuth2 } } })
    .google;
  return g?.accounts?.oauth2 || null;
}

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let gisLoadPromise: Promise<boolean> | null = null;

function preloadGisClient(): Promise<boolean> {
  if (isCapacitorNative()) return Promise.resolve(false);
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (getGisOAuth2()) return Promise.resolve(true);
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );
    if (existing) {
      if (getGisOAuth2()) {
        resolve(true);
        return;
      }
      existing.addEventListener('load', () => resolve(Boolean(getGisOAuth2())), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      window.setTimeout(() => resolve(Boolean(getGisOAuth2())), 4000);
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(getGisOAuth2()));
    script.onerror = () => {
      gisLoadPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Fallback handled automatically by Firebase Auth
});

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let isSigningIn = false;

function setInMemoryToken(token: string, expiresInSeconds = 3500): void {
  cachedAccessToken = token;
  const ttlMs = Math.max(120, Math.min(3600, expiresInSeconds)) * 1000;
  tokenExpiresAt = Date.now() + ttlMs;
}

export function initYouTubeAuth(handlers: {
  onUserRestored?: (user: User, token: string | null) => void;
  onTokenObtained?: (user: User, token: string) => void;
  onTokenUnavailable?: (user: User) => void;
  onSignedOut?: () => void;
}): () => void {
  let cancelled = false;

  void preloadGisClient();

  const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
    if (cancelled) return;

    if (!user) {
      cachedAccessToken = null;
      tokenExpiresAt = 0;
      handlers.onSignedOut?.();
      return;
    }

    if (cachedAccessToken && Date.now() < tokenExpiresAt - 30_000) {
      handlers.onUserRestored?.(user, cachedAccessToken);
      handlers.onTokenObtained?.(user, cachedAccessToken);
      return;
    }

    if (isSigningIn) {
      handlers.onUserRestored?.(user, cachedAccessToken);
      return;
    }

    cachedAccessToken = null;
    tokenExpiresAt = 0;
    handlers.onUserRestored?.(user, null);
    handlers.onTokenUnavailable?.(user);
  });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

function requestGisTokenOnGesture(
  oauth2: GoogleIdentityOAuth2,
  clientId: string,
  hintEmail?: string,
  promptMode: '' | 'none' = 'none'
): Promise<{ accessToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Google token refresh timed out.'));
    }, 30_000);

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_SCOPES.join(' '),
      prompt: promptMode,
      hint: hintEmail,
      include_granted_scopes: true,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (resp.error || !resp.access_token) {
          reject(
            new Error(resp.error_description || resp.error || 'Could not refresh YouTube token.')
          );
          return;
        }
        const expiresIn =
          typeof resp.expires_in === 'number'
            ? resp.expires_in
            : parseInt(String(resp.expires_in || '3500'), 10) || 3500;
        resolve({ accessToken: resp.access_token, expiresIn });
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (err.type === 'popup_closed') {
          reject(new Error('auth/popup-closed-by-user'));
          return;
        }
        reject(new Error(err.message || err.type || 'Google token window could not open.'));
      },
    });

    client.requestAccessToken({
      prompt: promptMode,
      hint: hintEmail,
      include_granted_scopes: true,
    });
  });
}

export async function signInWithYouTube(forceAccountPicker = false): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;

    if (isCapacitorNative()) {
      throw new Error(
        'Google sign-in on Android requires a native Capacitor auth plugin rather than web browser popups.'
      );
    }

    const existingUser = auth.currentUser;
    const oauth2 = getGisOAuth2();
    const oAuthClientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;

    if (!forceAccountPicker && existingUser && oauth2 && oAuthClientId) {
      try {
        const { accessToken, expiresIn } = await requestGisTokenOnGesture(
          oauth2,
          oAuthClientId,
          existingUser.email || undefined,
          'none'
        );
        setInMemoryToken(accessToken, expiresIn);
        return {
          user: existingUser,
          accessToken,
        };
      } catch (gisErr) {
        const msg = gisErr instanceof Error ? gisErr.message.toLowerCase() : '';
        if (msg.includes('popup-closed')) {
          throw gisErr;
        }
      }
    }

    const activeProvider = new GoogleAuthProvider();
    for (const scope of YOUTUBE_SCOPES) {
      activeProvider.addScope(scope);
    }

    const currentEmail = existingUser?.email || undefined;
    if (forceAccountPicker) {
      activeProvider.setCustomParameters({
        prompt: 'select_account',
        include_granted_scopes: 'true',
      });
    } else if (currentEmail) {
      activeProvider.setCustomParameters({
        login_hint: currentEmail,
        include_granted_scopes: 'true',
      });
    } else {
      activeProvider.setCustomParameters({
        include_granted_scopes: 'true',
      });
    }

    const result = await signInWithPopup(auth, activeProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google access token for YouTube.');
    }

    setInMemoryToken(credential.accessToken, 3500);
    return {
      user: result.user,
      accessToken: credential.accessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getYouTubeAccessToken(): string | null {
  if (cachedAccessToken && Date.now() >= tokenExpiresAt) {
    cachedAccessToken = null;
    tokenExpiresAt = 0;
  }
  return cachedAccessToken;
}

export function clearYouTubeAccessToken(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export async function signOutYouTube(): Promise<void> {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  await auth.signOut();
}
