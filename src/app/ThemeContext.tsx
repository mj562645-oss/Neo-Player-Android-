import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { setMediaSessionMetadataSyncEnabled } from '../lib/mediaSession';
import {
  applyPersonalizationCssVars,
  DEFAULT_PERSONALIZATION,
  getPalettesForTheme,
} from '../lib/palettes';
import { createId } from '../lib/utils';
import NativeAudio, { isNativeAudioAvailable } from '../plugins/nativeAudio';
import { syncAndroidStatusBar } from '../services/androidPlatform';
import { audioEngine } from '../services/audioEngine';
import { db, DEFAULT_USER_SETTINGS } from '../services/db';
import { previewPlayer } from '../services/previewPlayer';
import { youtubePlayer } from '../services/youtubePlayer';
import type {
  AppPalette,
  EqualizerSettings,
  MoodCategory,
  PersonalizationSettings,
  ThemePreference,
  UserSettings,
} from '../types/music';

interface ThemeContextValue {
  settings: UserSettings;
  resolvedTheme: 'light' | 'dark';
  settingsLoaded: boolean;
  setTheme: (theme: ThemePreference) => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  updateEqualizer: (patch: Partial<EqualizerSettings>) => Promise<void>;
  updatePersonalization: (patch: Partial<PersonalizationSettings>) => Promise<void>;
  upsertCustomPalette: (palette: AppPalette) => Promise<void>;
  deleteCustomPalette: (paletteId: string) => Promise<void>;
  uploadBackgroundImage: (file: File) => Promise<void>;
  removeBackgroundImage: () => Promise<void>;
  resetPersonalization: () => Promise<void>;
  upsertMoodCategory: (category: MoodCategory) => Promise<void>;
  deleteMoodCategory: (id: string) => Promise<void>;
  isArtistFollowed: (artistName: string) => boolean;
  toggleFollowArtist: (artistName: string) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncAudioOptionsToEngines(next: UserSettings, fullSync = false, patch?: Partial<UserSettings>): void {
  if (fullSync || patch?.volume !== undefined || patch?.muted !== undefined) {
    audioEngine.setVolume(next.volume, next.muted);
    youtubePlayer.setVolume(next.volume, next.muted);
    previewPlayer.setVolume(next.volume, next.muted);
  }
  if (fullSync || patch?.playbackRate !== undefined) {
    audioEngine.setPlaybackRate(next.playbackRate);
    youtubePlayer.setPlaybackRate(next.playbackRate);
  }
  if (fullSync || patch?.volumeNormalization !== undefined) {
    audioEngine.setVolumeNormalization(next.volumeNormalization);
  }
  if (fullSync || patch?.equalizer !== undefined) {
    audioEngine.setEqualizer(next.equalizer);
  }
  if (fullSync || patch?.audioOutputDeviceId !== undefined) {
    void audioEngine.setAudioOutputDevice(next.audioOutputDeviceId || '');
    void previewPlayer.setAudioOutputDevice(next.audioOutputDeviceId || '');
  }
  if (fullSync || patch?.bluetoothMetadataSync !== undefined) {
    setMediaSessionMetadataSyncEnabled(next.bluetoothMetadataSync ?? true);
  }
  if (
    isNativeAudioAvailable() &&
    (fullSync ||
      patch?.volume !== undefined ||
      patch?.muted !== undefined ||
      patch?.playbackRate !== undefined ||
      patch?.volumeNormalization !== undefined ||
      patch?.pauseOnBluetoothDisconnect !== undefined ||
      patch?.androidLivePillNotification !== undefined ||
      patch?.equalizer !== undefined)
  ) {
    void NativeAudio.setPlaybackOptions({
      volume: next.volume,
      muted: next.muted,
      playbackRate: next.playbackRate,
      volumeNormalization: next.volumeNormalization,
      pauseOnBluetoothDisconnect: next.pauseOnBluetoothDisconnect ?? true,
      livePillNotification: next.androidLivePillNotification ?? true,
      eqEnabled: next.equalizer.enabled,
      eqBass: next.equalizer.bass,
      eqMid: next.equalizer.mid,
      eqTreble: next.equalizer.treble,
    });
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const savedTheme =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('neo-player-theme') as ThemePreference | null)
        : null;
    const seenIntro =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('neo-player-intro-seen') === 'true'
        : false;
    return {
      ...DEFAULT_USER_SETTINGS,
      theme:
        savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
          ? savedTheme
          : 'system',
      hasSeenIntro: seenIntro,
    };
  });
  const settingsRef = useRef<UserSettings>(settings);
  settingsRef.current = settings;
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(resolveSystemTheme);

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'system' ? systemTheme : settings.theme;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    let active = true;
    db.getSettings().then((loaded) => {
      if (!active) return;
      settingsRef.current = loaded;
      setSettings(loaded);
      try {
        localStorage.setItem('neo-player-theme', loaded.theme);
      } catch {
        // ignore storage errors
      }
      syncAudioOptionsToEngines(loaded, true);
      setSettingsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    applyPersonalizationCssVars(settings.personalization, resolvedTheme);
    void syncAndroidStatusBar(resolvedTheme);
    try {
      localStorage.setItem('neo-player-theme', settings.theme);
    } catch {
      // ignore
    }
  }, [resolvedTheme, settings.theme, settings.personalization]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const next: UserSettings = { ...settingsRef.current, ...patch, id: 'user_settings' };
    settingsRef.current = next;
    setSettings(next);
    if (patch.hasSeenIntro !== undefined) {
      try {
        localStorage.setItem('neo-player-intro-seen', String(patch.hasSeenIntro));
      } catch {
        // ignore
      }
    }
    syncAudioOptionsToEngines(next, false, patch);
    await db.putSettings(next);
  }, []);

  const updateEqualizer = useCallback(async (patch: Partial<EqualizerSettings>) => {
    const prev = settingsRef.current;
    const nextEq: EqualizerSettings = {
      ...prev.equalizer,
      ...patch,
    };
    const next: UserSettings = {
      ...prev,
      equalizer: nextEq,
      id: 'user_settings',
    };
    settingsRef.current = next;
    setSettings(next);
    syncAudioOptionsToEngines(next, false, { equalizer: nextEq });
    await db.putSettings(next);
  }, []);

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      await updateSettings({ theme });
    },
    [updateSettings]
  );

  const updatePersonalization = useCallback(async (patch: Partial<PersonalizationSettings>) => {
    const prev = settingsRef.current;
    const nextPersonalization: PersonalizationSettings = {
      ...prev.personalization,
      ...patch,
    };
    const next: UserSettings = {
      ...prev,
      personalization: nextPersonalization,
      id: 'user_settings',
    };
    settingsRef.current = next;
    setSettings(next);
    await db.putSettings(next);
  }, []);

  const upsertCustomPalette = useCallback(async (palette: AppPalette) => {
    const prev = settingsRef.current;
    const existing = prev.personalization.customPalettes || [];
    const has = existing.some((p) => p.id === palette.id);
    const nextCustom = has
      ? existing.map((p) => (p.id === palette.id ? palette : p))
      : [...existing, palette];
    const next: UserSettings = {
      ...prev,
      personalization: {
        ...prev.personalization,
        customPalettes: nextCustom,
        activePaletteId: palette.id,
      },
      id: 'user_settings',
    };
    settingsRef.current = next;
    setSettings(next);
    await db.putSettings(next);
  }, []);

  const deleteCustomPalette = useCallback(async (paletteId: string) => {
    const prev = settingsRef.current;
    const nextCustom = (prev.personalization.customPalettes || []).filter(
      (p) => p.id !== paletteId
    );
    const themeFallback =
      getPalettesForTheme(prev.personalization.uiTheme || 'neo')[0]?.id ||
      DEFAULT_PERSONALIZATION.activePaletteId;
    const nextActive =
      prev.personalization.activePaletteId === paletteId
        ? themeFallback
        : prev.personalization.activePaletteId;
    const next: UserSettings = {
      ...prev,
      personalization: {
        ...prev.personalization,
        customPalettes: nextCustom,
        activePaletteId: nextActive,
      },
      id: 'user_settings',
    };
    settingsRef.current = next;
    setSettings(next);
    await db.putSettings(next);
  }, []);

  const uploadBackgroundImage = useCallback(
    async (file: File) => {
      const newId = createId('bg');
      const oldId = settingsRef.current.personalization.backgroundImageId;
      await db.putArtwork({
        id: newId,
        blob: file,
        size: file.size,
        mimeType: file.type || 'image/jpeg',
      });
      await updatePersonalization({
        backgroundImageId: newId,
        backgroundMode: 'image',
      });
      if (oldId) {
        await db.deleteArtworks([oldId]);
      }
    },
    [updatePersonalization]
  );

  const removeBackgroundImage = useCallback(async () => {
    const current = settingsRef.current.personalization;
    const oldId = current.backgroundImageId;
    await updatePersonalization({
      backgroundImageId: undefined,
      backgroundMode: current.backgroundMode === 'image' ? 'ambient' : current.backgroundMode,
    });
    if (oldId) {
      await db.deleteArtworks([oldId]);
    }
  }, [updatePersonalization]);

  const resetPersonalization = useCallback(async () => {
    const oldId = settingsRef.current.personalization.backgroundImageId;
    await updateSettings({ personalization: DEFAULT_PERSONALIZATION });
    if (oldId) {
      await db.deleteArtworks([oldId]);
    }
  }, [updateSettings]);

  const upsertMoodCategory = useCallback(
    async (category: MoodCategory) => {
      const current = settingsRef.current.moodCategories;
      const exists = current.some((c) => c.id === category.id);
      const nextCategories = exists
        ? current.map((c) => (c.id === category.id ? category : c))
        : [...current, category];
      await updateSettings({ moodCategories: nextCategories });
    },
    [updateSettings]
  );

  const deleteMoodCategory = useCallback(
    async (id: string) => {
      const nextCategories = settingsRef.current.moodCategories.filter((c) => c.id !== id);
      await updateSettings({ moodCategories: nextCategories });
    },
    [updateSettings]
  );

  const isArtistFollowed = useCallback(
    (artistName: string) => {
      const target = artistName.trim().toLowerCase();
      if (!target) return false;
      return (settings.followedArtists || []).some((a) => a.trim().toLowerCase() === target);
    },
    [settings.followedArtists]
  );

  const toggleFollowArtist = useCallback(async (artistName: string): Promise<boolean> => {
    const clean = artistName.trim();
    if (!clean || clean.toLowerCase() === 'unknown artist') return false;
    const norm = clean.toLowerCase();
    const prev = settingsRef.current;
    const existing = prev.followedArtists || [];
    const exists = existing.some((a) => a.trim().toLowerCase() === norm);
    const followedNow = !exists;
    const nextFollowed = exists
      ? existing.filter((a) => a.trim().toLowerCase() !== norm)
      : [clean, ...existing];
    const next: UserSettings = {
      ...prev,
      followedArtists: nextFollowed,
      id: 'user_settings',
    };
    settingsRef.current = next;
    setSettings(next);
    await db.putSettings(next);
    return followedNow;
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        settings,
        resolvedTheme,
        settingsLoaded,
        setTheme,
        updateSettings,
        updateEqualizer,
        updatePersonalization,
        upsertCustomPalette,
        deleteCustomPalette,
        uploadBackgroundImage,
        removeBackgroundImage,
        resetPersonalization,
        upsertMoodCategory,
        deleteMoodCategory,
        isArtistFollowed,
        toggleFollowArtist,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
