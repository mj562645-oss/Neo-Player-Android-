import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveTrackArtworkBase64 as resolveTrackArtworkBase64FromMedia } from '../lib/mediaSession';
import { createId } from '../lib/utils';
import { syncScreenWakeLock, triggerHaptic } from '../services/androidPlatform';
import { audioEngine } from '../services/audioEngine';
import NativeAudio, { isNativeAudioAvailable } from '../plugins/nativeAudio';
import { db, DEFAULT_PLAYBACK_STATE } from '../services/db';
import {
  clearPhoneNotificationCenterPill,
  showPhoneNotificationCenterPill,
} from '../services/phoneNotifications';
import { youtubePlayer } from '../services/youtubePlayer';
import type { PlaybackState, QueueItem, RepeatMode, Track } from '../types/music';
import { useLibrary } from './LibraryContext';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';
import { useYouTube } from './YouTubeContext';

export type SleepTimerMode = 'off' | 'end_of_track' | 15 | 30 | 45 | 60;

interface PlayerContextValue {
  currentTrack: Track | null;
  queue: QueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  nowPlayingOpen: boolean;
  queueOpen: boolean;
  setNowPlayingOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  resolveTrack: (trackId: string) => Track | undefined;
  playTrack: (track: Track, contextTracks?: Track[], sourceLabel?: string) => Promise<void>;
  playQueueIndex: (index: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seek: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNextInQueue: (tracksToAdd: Track | Track[], source?: string) => void;
  addToQueue: (tracksToAdd: Track | Track[], source?: string) => void;
  removeQueueItem: (queueId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  shuffleUpcomingQueue: () => void;
  clearQueue: () => void;
  toggleTrackLike: (track: Track) => Promise<void>;
  sleepTimerMode: SleepTimerMode;
  sleepRemainingSeconds: number | null;
  setSleepTimer: (mode: SleepTimerMode) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function shuffleArray<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isYouTubeTrack(track?: Track | null): boolean {
  return Boolean(track && track.source === 'youtube' && track.youtubeVideoId);
}

function getNativePlaybackUri(track?: Track | null): string | null {
  if (!track) return null;
  if (track.nativeAudioUri) return track.nativeAudioUri;
  if ((track.source === 'mediastore' || track.source === 'document') && track.contentUri) {
    return track.contentUri;
  }
  return null;
}

async function resolveTrackArtworkBase64(track?: Track | null): Promise<string | undefined> {
  if (!track) return undefined;
  return resolveTrackArtworkBase64FromMedia(track.artworkId, track.artworkUrl);
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    tracks,
    isLoading: libraryLoading,
    recordTrackPlay,
    saveTrackPosition,
    toggleFavourite,
  } = useLibrary();
  const { isYouTubeTrackLiked, toggleYouTubeLike } = useYouTube();
  const { settings, settingsLoaded, updateSettings } = useTheme();
  const { showToast } = useToast();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [originalQueueOrder, setOriginalQueueOrder] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [externalTrackMap, setExternalTrackMap] = useState<Record<string, Track>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepTimerMode, setSleepTimerMode] = useState<SleepTimerMode>('off');
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState<number | null>(null);

  const hydratedRef = useRef(false);
  const lastSavedPosRef = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const currentTrackIdRef = useRef<string | null>(currentTrackId);
  currentTrackIdRef.current = currentTrackId;
  const tracksRef = useRef<Track[]>(tracks);
  tracksRef.current = tracks;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const sleepTimerModeRef = useRef<SleepTimerMode>('off');
  sleepTimerModeRef.current = sleepTimerMode;
  const crossfadeSecondsRef = useRef(0);
  crossfadeSecondsRef.current = Math.max(0, Math.min(12, settings.crossfadeSeconds ?? 0));
  const queueRef = useRef<QueueItem[]>(queue);
  queueRef.current = queue;
  const originalQueueOrderRef = useRef<QueueItem[]>(originalQueueOrder);
  originalQueueOrderRef.current = originalQueueOrder;
  const shuffleRef = useRef<boolean>(shuffle);
  shuffleRef.current = shuffle;
  const currentIndexRef = useRef<number>(currentIndex);
  currentIndexRef.current = currentIndex;
  const repeatRef = useRef<RepeatMode>(repeat);
  repeatRef.current = repeat;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const crossfadeTriggeredKeyRef = useRef<string | null>(null);
  const nativeEndedTrackRef = useRef<string | null>(null);

  const registerExternalTracks = useCallback((list: Track[]) => {
    const ytTracks = list.filter((t) => isYouTubeTrack(t));
    if (ytTracks.length === 0) return;
    setExternalTrackMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of ytTracks) {
        next[t.id] = t;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const trackById = useMemo(() => {
    const map = new Map<string, Track>();
    for (const [id, t] of Object.entries(externalTrackMap)) {
      map.set(id, { ...t, isFavourite: isYouTubeTrackLiked(t.id, t.isFavourite) });
    }
    for (const t of tracks) {
      map.set(t.id, t);
    }
    return map;
  }, [tracks, externalTrackMap, isYouTubeTrackLiked]);

  const trackByIdRef = useRef(trackById);
  trackByIdRef.current = trackById;

  const currentTrack = useMemo(
    () => (currentTrackId ? trackById.get(currentTrackId) || null : null),
    [currentTrackId, trackById]
  );

  currentTrackRef.current = currentTrack;

  const resolveTrack = useCallback((trackId: string) => trackById.get(trackId), [trackById]);

  const toggleTrackLike = useCallback(
    async (track: Track) => {
      void triggerHaptic(settingsRef.current.hapticFeedback, 'light');
      if (isYouTubeTrack(track) || track.source === 'youtube') {
        toggleYouTubeLike(track);
      } else {
        await toggleFavourite(track.id);
      }
    },
    [toggleYouTubeLike, toggleFavourite]
  );

  const getActivePosition = useCallback(() => {
    const track = currentTrackRef.current;
    if (isYouTubeTrack(track)) return youtubePlayer.getCurrentTime();
    if (isNativeAudioAvailable() && getNativePlaybackUri(track)) return currentTimeRef.current;
    return audioEngine.getCurrentTime();
  }, []);

  // Persist playback state helper (always reads fresh refs so listeners stay stable)
  const persistState = useCallback(
    (patch: Partial<PlaybackState>) => {
      const state: PlaybackState = {
        ...DEFAULT_PLAYBACK_STATE,
        currentTrackId: currentTrackIdRef.current,
        queue: queueRef.current,
        originalQueueOrder: originalQueueOrderRef.current,
        currentIndex: currentIndexRef.current,
        position: getActivePosition(),
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
        ...patch,
        id: 'playback_state',
        updatedAt: Date.now(),
      };
      void db.putPlaybackState(state);
    },
    [getActivePosition]
  );

  const playNativeTrack = useCallback(
    async (targetTrack: Track, startPosSec: number, autoplay: boolean) => {
      const nativeUri = getNativePlaybackUri(targetTrack);
      if (!nativeUri || !isNativeAudioAvailable()) return;
      const syncMeta = settingsRef.current.bluetoothMetadataSync ?? true;
      const artworkBase64 = syncMeta ? await resolveTrackArtworkBase64(targetTrack) : undefined;
      await NativeAudio.playLocal({
        uri: nativeUri,
        title: syncMeta ? targetTrack.title : 'Neo Player',
        artist: syncMeta ? targetTrack.artist : 'Audio Playback',
        album: syncMeta ? targetTrack.album : '',
        artworkBase64,
        positionMs: Math.max(0, startPosSec) * 1000,
        autoplay,
        volume: settingsRef.current.volume,
        muted: settingsRef.current.muted,
        playbackRate: settingsRef.current.playbackRate,
        pauseOnBluetoothDisconnect: settingsRef.current.pauseOnBluetoothDisconnect ?? true,
        isFavourite: Boolean(targetTrack.isFavourite),
        repeatMode: repeatRef.current,
        livePillNotification: settingsRef.current.androidLivePillNotification ?? true,
      });
    },
    []
  );

  // Hydrate saved playback state once library & settings load
  useEffect(() => {
    if (hydratedRef.current || libraryLoading || !settingsLoaded) return;
    hydratedRef.current = true;

    db.getPlaybackState().then(async (saved) => {
      if (!settingsRef.current.resumeOnLaunch) return;
      const validIds = new Set(tracksRef.current.map((t) => t.id));
      const cleanQueue = saved.queue.filter((q) => validIds.has(q.trackId));
      const cleanOrig = saved.originalQueueOrder.filter((q) => validIds.has(q.trackId));
      setShuffle(saved.shuffle);
      setRepeat(saved.repeat);

      if (cleanQueue.length > 0) {
        setQueue(cleanQueue);
        setOriginalQueueOrder(cleanOrig.length > 0 ? cleanOrig : cleanQueue);
        const idx =
          saved.currentIndex >= 0 && saved.currentIndex < cleanQueue.length
            ? saved.currentIndex
            : 0;
        const targetTrack = trackByIdRef.current.get(cleanQueue[idx].trackId);
        if (targetTrack && !isYouTubeTrack(targetTrack)) {
          setCurrentIndex(idx);
          setCurrentTrackId(targetTrack.id);
          setCurrentTime(saved.position || 0);
          setDuration(targetTrack.duration || 0);
          const nativeUri = getNativePlaybackUri(targetTrack);
          if (isNativeAudioAvailable() && nativeUri) {
            await playNativeTrack(targetTrack, saved.position || 0, false);
          } else {
            await audioEngine.loadTrack(targetTrack, saved.position || 0, false);
          }
        }
      }
    });
  }, [libraryLoading, settingsLoaded, playNativeTrack]);

  // Clean queue if local tracks are deleted from library (preserve YouTube tracks in queue)
  useEffect(() => {
    if (!hydratedRef.current) return;
    const validLocalIds = new Set(tracks.map((t) => t.id));
    const isTrackValid = (trackId: string) =>
      validLocalIds.has(trackId) || Boolean(externalTrackMap[trackId]);

    setQueue((prev) => {
      const next = prev.filter((item) => isTrackValid(item.trackId));
      if (next.length === prev.length) return prev;
      if (currentTrackId && !isTrackValid(currentTrackId)) {
        audioEngine.unload();
        youtubePlayer.unload();
        if (isNativeAudioAvailable()) void NativeAudio.stop();
        setCurrentTrackId(null);
        setCurrentIndex(-1);
        setIsPlaying(false);
      } else if (currentTrackId) {
        const newIdx = next.findIndex((i) => i.trackId === currentTrackId);
        setCurrentIndex(newIdx);
      }
      return next;
    });
  }, [tracks, externalTrackMap, currentTrackId]);

  const startTrackAt = useCallback(
    async (targetTrack: Track, indexInQueue: number, startPos = 0) => {
      crossfadeTriggeredKeyRef.current = null;
      nativeEndedTrackRef.current = null;
      setCurrentTrackId(targetTrack.id);
      setCurrentIndex(indexInQueue);
      setDuration(targetTrack.duration || 0);
      setCurrentTime(startPos);

      if (isYouTubeTrack(targetTrack)) {
        if (isNativeAudioAvailable() && getNativePlaybackUri(currentTrackRef.current)) {
          await NativeAudio.pause();
        }
        audioEngine.pause();
        const ok = await youtubePlayer.loadTrack(targetTrack, startPos, true);
        if (!ok) {
          setIsPlaying(false);
        }
      } else {
        youtubePlayer.pause();
        const nativeUri = getNativePlaybackUri(targetTrack);
        if (isNativeAudioAvailable() && nativeUri) {
          audioEngine.pause();
          await playNativeTrack(targetTrack, startPos, true);
          setIsPlaying(true);
          void recordTrackPlay(targetTrack.id);
        } else {
          if (isNativeAudioAvailable() && getNativePlaybackUri(currentTrackRef.current)) {
            await NativeAudio.pause();
          }
          const ok = await audioEngine.loadTrack(targetTrack, startPos, true);
          if (ok) void recordTrackPlay(targetTrack.id);
        }
      }
    },
    [playNativeTrack, recordTrackPlay]
  );

  // Sync metadata / artwork / Like / Repeat edits immediately to OS MediaSession, Lockscreen, Now Bar & 4x1 Widget
  useEffect(() => {
    if (!currentTrack) return;
    const syncMeta = settings.bluetoothMetadataSync ?? true;
    if (isYouTubeTrack(currentTrack)) {
      youtubePlayer.refreshMetadata(currentTrack);
      return;
    }
    const nativeUri = getNativePlaybackUri(currentTrack);
    if (isNativeAudioAvailable() && nativeUri) {
      const controlSync = {
        isFavourite: Boolean(currentTrack.isFavourite),
        repeatMode: repeat,
        livePillNotification: settings.androidLivePillNotification ?? true,
      };
      if (!syncMeta) {
        void NativeAudio.updateMetadata({
          title: 'Neo Player',
          artist: 'Audio Playback',
          album: '',
          ...controlSync,
        });
        return;
      }
      void resolveTrackArtworkBase64(currentTrack).then((artworkBase64) =>
        NativeAudio.updateMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artworkBase64,
          ...controlSync,
        })
      );
      return;
    }
    audioEngine.refreshMetadata(currentTrack);
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    currentTrack?.artworkId,
    currentTrack?.isFavourite,
    repeat,
    settings.bluetoothMetadataSync,
    settings.androidLivePillNotification,
  ]);

  // Sync Web/PWA (and YouTube playback on Android APK) live album-art pill to the phone Notification Center
  const lastPhoneNotifKeyRef = useRef<string>('');
  useEffect(() => {
    const isNativeLocalTrack =
      isNativeAudioAvailable() && Boolean(currentTrack) && Boolean(getNativePlaybackUri(currentTrack));
    if (isNativeLocalTrack) return;

    const enabled = settings.androidLivePillNotification ?? true;
    if (!enabled || !currentTrack) {
      if (lastPhoneNotifKeyRef.current) {
        lastPhoneNotifKeyRef.current = '';
        void clearPhoneNotificationCenterPill();
      }
      return;
    }

    if (!isNativeAudioAvailable()) {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
    }

    const syncMeta = settings.bluetoothMetadataSync ?? true;
    const nextKey = `${currentTrack.id}:${isPlaying}:${currentTrack.title}:${currentTrack.artworkId || currentTrack.artworkUrl || ''}:${currentTrack.isFavourite}:${repeat}:${syncMeta}`;
    if (lastPhoneNotifKeyRef.current === nextKey) return;
    lastPhoneNotifKeyRef.current = nextKey;

    void showPhoneNotificationCenterPill({
      title: syncMeta ? currentTrack.title : 'Neo Player',
      artist: syncMeta ? currentTrack.artist : 'Audio Playback',
      album: syncMeta ? currentTrack.album : '',
      isPlaying,
      isFavourite: Boolean(currentTrack.isFavourite),
      repeatMode: repeat,
      artworkId: syncMeta ? currentTrack.artworkId : undefined,
      artworkUrl: syncMeta ? currentTrack.artworkUrl : undefined,
      requestPermissionIfNeeded: false,
    });
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    currentTrack?.artworkId,
    currentTrack?.artworkUrl,
    currentTrack?.isFavourite,
    isPlaying,
    repeat,
    settings.androidLivePillNotification,
    settings.bluetoothMetadataSync,
  ]);

  const transitionToQueueIndexWithCrossfade = useCallback(
    async (indexInQueue: number, fadeSeconds: number) => {
      const q = queueRef.current;
      if (indexInQueue < 0 || indexInQueue >= q.length) return;
      const item = q[indexInQueue];
      const targetTrack = trackByIdRef.current.get(item.trackId);
      if (!targetTrack) return;

      const outgoingTrack = currentTrackRef.current;
      const outgoingIsYt = isYouTubeTrack(outgoingTrack);
      const incomingIsYt = isYouTubeTrack(targetTrack);
      const usesNativePlayback =
        isNativeAudioAvailable() &&
        (Boolean(getNativePlaybackUri(outgoingTrack)) || Boolean(getNativePlaybackUri(targetTrack)));

      setCurrentTrackId(targetTrack.id);
      setCurrentIndex(indexInQueue);
      setDuration(targetTrack.duration || 0);
      setCurrentTime(0);
      persistState({ currentTrackId: targetTrack.id, currentIndex: indexInQueue, position: 0 });

      if (usesNativePlayback) {
        await startTrackAt(targetTrack, indexInQueue, 0);
      } else if (!outgoingIsYt && !incomingIsYt) {
        // Local -> Local: seamless dual-deck overlapping equal-power crossfade
        const ok = await audioEngine.crossfadeToTrack(targetTrack, fadeSeconds, 0);
        if (ok) {
          void recordTrackPlay(targetTrack.id);
        }
      } else if (!outgoingIsYt && incomingIsYt) {
        // Local -> YouTube: fade out local deck while fading in YouTube stream
        const blendSec = Math.min(fadeSeconds, 4);
        audioEngine.fadeOutCurrent(blendSec);
        const ok = await youtubePlayer.loadTrack(targetTrack, 0, true, blendSec);
        if (!ok) {
          setIsPlaying(false);
        }
      } else if (outgoingIsYt && !incomingIsYt) {
        // YouTube -> Local: fade out YouTube while starting local track
        const blendSec = Math.min(fadeSeconds, 2.5);
        youtubePlayer.fadeOut(blendSec);
        const ok = await audioEngine.loadTrack(targetTrack, 0, true);
        if (ok) {
          void recordTrackPlay(targetTrack.id);
        }
      } else {
        // YouTube -> YouTube: single IFrame smoothly fades out then fades in next track
        const blendSec = Math.min(fadeSeconds, 2);
        youtubePlayer.fadeOut(blendSec, () => {
          void youtubePlayer.loadTrack(targetTrack, 0, true, blendSec).then((ok) => {
            if (!ok) setIsPlaying(false);
          });
        });
      }
    },
    [persistState, recordTrackPlay, startTrackAt]
  );

  const playTrack = useCallback(
    async (track: Track, contextTracks?: Track[], sourceLabel = 'Library') => {
      const list = contextTracks && contextTracks.length > 0 ? contextTracks : [track];
      registerExternalTracks([track, ...list]);

      const baseQueue: QueueItem[] = list.map((t) => ({
        queueId: createId('q'),
        trackId: t.id,
        addedAt: Date.now(),
        source: sourceLabel,
      }));

      const clickedIdx = list.findIndex((t) => t.id === track.id);
      const safeIdx = clickedIdx >= 0 ? clickedIdx : 0;

      if (shuffleRef.current && baseQueue.length > 1) {
        const clickedItem = baseQueue[safeIdx];
        const rest = baseQueue.filter((_, i) => i !== safeIdx);
        const shuffledQueue = [clickedItem, ...shuffleArray(rest)];
        setOriginalQueueOrder(baseQueue);
        setQueue(shuffledQueue);
        await startTrackAt(track, 0, 0);
        persistState({
          currentTrackId: track.id,
          queue: shuffledQueue,
          originalQueueOrder: baseQueue,
          currentIndex: 0,
          position: 0,
        });
      } else {
        setOriginalQueueOrder(baseQueue);
        setQueue(baseQueue);
        await startTrackAt(track, safeIdx, 0);
        persistState({
          currentTrackId: track.id,
          queue: baseQueue,
          originalQueueOrder: baseQueue,
          currentIndex: safeIdx,
          position: 0,
        });
      }
    },
    [registerExternalTracks, startTrackAt, persistState]
  );

  const playQueueIndex = useCallback(
    async (index: number) => {
      const q = queueRef.current;
      if (index < 0 || index >= q.length) return;
      const item = q[index];
      const target = trackByIdRef.current.get(item.trackId);
      if (!target) return;
      await startTrackAt(target, index, 0);
      persistState({ currentTrackId: target.id, currentIndex: index, position: 0 });
    },
    [startTrackAt, persistState]
  );

  useEffect(() => {
    void syncScreenWakeLock(isPlaying && settings.keepScreenAwake);
  }, [isPlaying, settings.keepScreenAwake]);

  const playActive = useCallback(async () => {
    const activeTrack = currentTrackRef.current;
    if (!activeTrack) {
      const libraryTracks = tracksRef.current;
      if (libraryTracks.length > 0) {
        await playTrack(libraryTracks[0], libraryTracks, 'Library');
      }
      return;
    }

    if (isYouTubeTrack(activeTrack)) {
      audioEngine.pause();
      if (!youtubePlayer.isPlaying()) {
        const ok = youtubePlayer.play();
        if (!ok) {
          await youtubePlayer.loadTrack(activeTrack, currentTimeRef.current, true);
        }
      }
      return;
    }

    const nativeUri = getNativePlaybackUri(activeTrack);
    if (isNativeAudioAvailable() && nativeUri) {
      youtubePlayer.pause();
      audioEngine.pause();
      const status = await NativeAudio.getStatus();
      if (status.durationMs > 0) {
        await NativeAudio.resume();
      } else {
        await playNativeTrack(activeTrack, currentTimeRef.current, true);
      }
      setIsPlaying(true);
      return;
    }

    youtubePlayer.pause();
    const ok = await audioEngine.play();
    if (!ok) {
      await audioEngine.loadTrack(activeTrack, currentTimeRef.current, true);
    }
  }, [playNativeTrack, playTrack]);

  const pauseActive = useCallback(() => {
    const activeTrack = currentTrackRef.current;
    if (isYouTubeTrack(activeTrack)) {
      youtubePlayer.pause();
    } else if (isNativeAudioAvailable() && getNativePlaybackUri(activeTrack)) {
      void NativeAudio.pause();
      setIsPlaying(false);
    } else {
      audioEngine.pause();
    }
  }, []);

  // Auto-pause on Web/PWA when Bluetooth or wired audio output disconnects
  useEffect(() => {
    return audioEngine.onOutputDeviceDisconnected(({ selectedDeviceRemoved }) => {
      if (selectedDeviceRemoved) {
        void updateSettings({ audioOutputDeviceId: '' });
      }
      if (!settingsRef.current.pauseOnBluetoothDisconnect) return;
      const activeTrack = currentTrackRef.current;
      const isNativeTrack =
        Boolean(activeTrack) && isNativeAudioAvailable() && Boolean(getNativePlaybackUri(activeTrack));
      if (!isNativeTrack && isPlayingRef.current) {
        pauseActive();
        showToast('Audio output disconnected — playback paused', 'info');
      }
    });
  }, [pauseActive, showToast, updateSettings]);

  const togglePlay = useCallback(async () => {
    void triggerHaptic(settingsRef.current.hapticFeedback, 'light');
    const activeTrack = currentTrackRef.current;
    if (!activeTrack) {
      const libraryTracks = tracksRef.current;
      if (libraryTracks.length > 0) {
        await playTrack(libraryTracks[0], libraryTracks, 'Library');
      }
      return;
    }

    if (isYouTubeTrack(activeTrack)) {
      if (youtubePlayer.isPlaying()) {
        youtubePlayer.pause();
      } else {
        audioEngine.pause();
        const ok = youtubePlayer.play();
        if (!ok) {
          await youtubePlayer.loadTrack(activeTrack, currentTimeRef.current, true);
        }
      }
      return;
    }

    const nativeUri = getNativePlaybackUri(activeTrack);
    if (isNativeAudioAvailable() && nativeUri) {
      const status = await NativeAudio.getStatus();
      if (status.isPlaying) {
        await NativeAudio.pause();
        setIsPlaying(false);
      } else if (status.durationMs > 0) {
        await NativeAudio.resume();
        setIsPlaying(true);
      } else {
        await playNativeTrack(activeTrack, currentTimeRef.current, true);
        setIsPlaying(true);
      }
    } else if (audioEngine.isPlaying()) {
      audioEngine.pause();
    } else {
      youtubePlayer.pause();
      const ok = await audioEngine.play();
      if (!ok) await audioEngine.loadTrack(activeTrack, currentTimeRef.current, true);
    }
  }, [playNativeTrack, playTrack]);

  const setSleepTimer = useCallback(
    (mode: SleepTimerMode) => {
      setSleepTimerMode(mode);
      if (mode === 'off') {
        setSleepRemainingSeconds(null);
        showToast('Sleep timer turned off', 'info');
      } else if (mode === 'end_of_track') {
        setSleepRemainingSeconds(null);
        showToast('Playback will pause after this track', 'info');
      } else {
        setSleepRemainingSeconds(mode * 60);
        showToast(`Sleep timer set for ${mode} minutes`, 'success');
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (typeof sleepTimerMode !== 'number') return;
    const id = window.setInterval(() => {
      setSleepRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          pauseActive();
          setSleepTimerMode('off');
          showToast('Sleep timer paused playback', 'info');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerMode, pauseActive, showToast]);

  const nextTrack = useCallback(async () => {
    void triggerHaptic(settingsRef.current.hapticFeedback, 'light');
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    const rep = repeatRef.current;
    if (q.length === 0) return;
    if (idx + 1 < q.length) {
      await playQueueIndex(idx + 1);
    } else if (rep === 'all') {
      await playQueueIndex(0);
    } else {
      if (isYouTubeTrack(currentTrackRef.current)) {
        youtubePlayer.pause();
        youtubePlayer.seek(0);
      } else if (isNativeAudioAvailable() && getNativePlaybackUri(currentTrackRef.current)) {
        await NativeAudio.pause();
        await NativeAudio.seek({ positionMs: 0 });
      } else {
        audioEngine.pause();
        audioEngine.seek(0);
      }
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [playQueueIndex]);

  const prevTrack = useCallback(async () => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    const rep = repeatRef.current;
    if (q.length === 0) return;
    const ct = getActivePosition();
    if (ct > 3) {
      if (isYouTubeTrack(currentTrackRef.current)) {
        youtubePlayer.seek(0);
      } else if (isNativeAudioAvailable() && getNativePlaybackUri(currentTrackRef.current)) {
        void NativeAudio.seek({ positionMs: 0 });
      } else {
        audioEngine.seek(0);
      }
      setCurrentTime(0);
      return;
    }
    if (idx > 0) {
      await playQueueIndex(idx - 1);
    } else if (rep === 'all') {
      await playQueueIndex(q.length - 1);
    } else {
      if (isYouTubeTrack(currentTrackRef.current)) {
        youtubePlayer.seek(0);
      } else if (isNativeAudioAvailable() && getNativePlaybackUri(currentTrackRef.current)) {
        void NativeAudio.seek({ positionMs: 0 });
      } else {
        audioEngine.seek(0);
      }
      setCurrentTime(0);
    }
  }, [playQueueIndex, getActivePosition]);

  const handleNativeTrackEnded = useCallback(async () => {
    const activeTrack = currentTrackRef.current;
    if (!activeTrack) return;
    const endKey = `${activeTrack.id}:${currentIndexRef.current}`;
    if (nativeEndedTrackRef.current === endKey) return;
    nativeEndedTrackRef.current = endKey;

    if (sleepTimerModeRef.current === 'end_of_track') {
      setSleepTimerMode('off');
      setSleepRemainingSeconds(null);
      await NativeAudio.pause();
      setIsPlaying(false);
      showToast('Sleep timer paused at end of track', 'info');
      return;
    }
    if (repeatRef.current === 'one') {
      nativeEndedTrackRef.current = null;
      await NativeAudio.seek({ positionMs: 0 });
      await NativeAudio.resume();
      setIsPlaying(true);
      return;
    }
    await nextTrack();
  }, [nextTrack, showToast]);

  // Native Android Media3 event listeners + resilient fallback status poller
  useEffect(() => {
    if (!isNativeAudioAvailable()) return;
    let active = true;
    const handleMedia = NativeAudio.addListener('mediaAction', ({ action }) => {
      if (!active) return;
      if (action === 'play') {
        void playActive();
      } else if (action === 'pause') {
        pauseActive();
      } else if (action === 'next') {
        void nextTrack();
      } else if (action === 'previous') {
        void prevTrack();
      } else if (action === 'like') {
        const activeTrack = currentTrackRef.current;
        if (activeTrack) {
          void toggleTrackLike(activeTrack);
        }
      } else if (action === 'repeat') {
        setRepeat((prev) => {
          const next: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
          persistState({ repeat: next });
          return next;
        });
      } else if (action === 'ended') {
        void handleNativeTrackEnded();
      }
    });
    const handleState = NativeAudio.addListener('playbackState', (ev) => {
      if (!active) return;
      const activeTrack = currentTrackRef.current;
      if (!activeTrack || !getNativePlaybackUri(activeTrack)) return;
      setIsPlaying(ev.isPlaying);
      if (ev.positionMs >= 0) {
        const sec = ev.positionMs / 1000;
        setCurrentTime(sec);
        if (Math.abs(sec - lastSavedPosRef.current) >= 5) {
          lastSavedPosRef.current = sec;
          void saveTrackPosition(activeTrack.id, sec);
          persistState({ position: sec });
        }
      }
      if (ev.durationMs > 0) setDuration(ev.durationMs / 1000);
      if (ev.ended) {
        void handleNativeTrackEnded();
      }
    });

    return () => {
      active = false;
      void handleMedia.then((sub) => sub.remove());
      void handleState.then((sub) => sub.remove());
    };
  }, [
    playActive,
    pauseActive,
    nextTrack,
    prevTrack,
    toggleTrackLike,
    handleNativeTrackEnded,
    saveTrackPosition,
    persistState,
  ]);

  useEffect(() => {
    if (!currentTrack || !isNativeAudioAvailable() || !getNativePlaybackUri(currentTrack)) return;
    let active = true;
    const poll = async () => {
      try {
        const status = await NativeAudio.getStatus();
        if (!active) return;
        setIsPlaying(status.isPlaying);
        if (status.positionMs >= 0) {
          const sec = status.positionMs / 1000;
          setCurrentTime(sec);
          if (Math.abs(sec - lastSavedPosRef.current) >= 5) {
            lastSavedPosRef.current = sec;
            void saveTrackPosition(currentTrack.id, sec);
            persistState({ position: sec });
          }
        }
        if (status.durationMs > 0) setDuration(status.durationMs / 1000);
        if (
          status.ended ||
          (!status.isPlaying &&
            status.durationMs > 0 &&
            status.positionMs >= status.durationMs - 250)
        ) {
          await handleNativeTrackEnded();
        }
      } catch (error) {
        console.warn('[Neo Player] Native playback status unavailable', error);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    currentTrack?.id,
    currentTrack?.nativeAudioUri,
    currentTrack?.contentUri,
    currentTrack?.source,
    handleNativeTrackEnded,
    saveTrackPosition,
    persistState,
  ]);

  const seek = useCallback(
    (seconds: number) => {
      crossfadeTriggeredKeyRef.current = null;
      nativeEndedTrackRef.current = null;
      if (isYouTubeTrack(currentTrackRef.current)) {
        youtubePlayer.seek(seconds);
      } else if (isNativeAudioAvailable() && getNativePlaybackUri(currentTrackRef.current)) {
        void NativeAudio.seek({ positionMs: seconds * 1000 });
      } else {
        audioEngine.seek(seconds);
      }
      setCurrentTime(seconds);
      persistState({ position: seconds });
    },
    [persistState]
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const target = Math.max(0, getActivePosition() + deltaSeconds);
      seek(target);
    },
    [getActivePosition, seek]
  );

  // Wire AudioEngine & YouTubePlayerEngine events once cleanly using refs
  useEffect(() => {
    const unsubAudioTime = audioEngine.on('timeupdate', ({ currentTime: ct, duration: dur }) => {
      if (isYouTubeTrack(currentTrackRef.current)) return;
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);
      const trackId = currentTrackIdRef.current;
      if (trackId && Math.abs(ct - lastSavedPosRef.current) >= 5) {
        lastSavedPosRef.current = ct;
        void saveTrackPosition(trackId, ct);
        persistState({ position: ct });
      }

      const fadeSec = crossfadeSecondsRef.current;
      const activeTrack = currentTrackRef.current;
      if (
        fadeSec > 0 &&
        isPlayingRef.current &&
        activeTrack &&
        !isYouTubeTrack(activeTrack) &&
        repeatRef.current !== 'one' &&
        sleepTimerModeRef.current !== 'end_of_track' &&
        dur > fadeSec + 2
      ) {
        const remaining = dur - ct;
        const key = `${activeTrack.id}:${currentIndexRef.current}`;
        if (remaining > 0.15 && remaining <= fadeSec && crossfadeTriggeredKeyRef.current !== key) {
          const q = queueRef.current;
          const idx = currentIndexRef.current;
          const nextIdx =
            idx + 1 < q.length ? idx + 1 : repeatRef.current === 'all' && q.length > 0 ? 0 : -1;
          if (nextIdx >= 0 && nextIdx !== idx) {
            crossfadeTriggeredKeyRef.current = key;
            void transitionToQueueIndexWithCrossfade(nextIdx, Math.min(fadeSec, remaining));
          }
        }
      }
    });
    const unsubAudioLoaded = audioEngine.on('loaded', ({ duration: dur }) => {
      if (isYouTubeTrack(currentTrackRef.current)) return;
      if (dur > 0) setDuration(dur);
    });
    const unsubAudioPlay = audioEngine.on('playstate', ({ isPlaying: playing }) => {
      if (isYouTubeTrack(currentTrackRef.current)) return;
      setIsPlaying(playing);
    });
    const unsubAudioError = audioEngine.on('error', ({ message }) => {
      if (isYouTubeTrack(currentTrackRef.current)) return;
      showToast(message, 'error');
    });
    const unsubAudioEnded = audioEngine.on('ended', () => {
      if (isYouTubeTrack(currentTrackRef.current)) return;
      if (sleepTimerModeRef.current === 'end_of_track') {
        setSleepTimerMode('off');
        setSleepRemainingSeconds(null);
        setIsPlaying(false);
        showToast('Sleep timer paused at end of track', 'info');
        return;
      }
      if (repeatRef.current === 'one' && currentTrackRef.current) {
        audioEngine.seek(0);
        void audioEngine.play();
      } else {
        void nextTrack();
      }
    });

    const unsubYtTime = youtubePlayer.on('timeupdate', ({ currentTime: ct, duration: dur }) => {
      if (!isYouTubeTrack(currentTrackRef.current)) return;
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);

      const fadeSec = crossfadeSecondsRef.current;
      const activeTrack = currentTrackRef.current;
      if (
        fadeSec > 0 &&
        isPlayingRef.current &&
        activeTrack &&
        isYouTubeTrack(activeTrack) &&
        repeatRef.current !== 'one' &&
        sleepTimerModeRef.current !== 'end_of_track' &&
        dur > fadeSec + 3
      ) {
        const remaining = dur - ct;
        const triggerThreshold = Math.min(fadeSec, 2.2);
        const key = `${activeTrack.id}:${currentIndexRef.current}`;
        if (
          remaining > 0.25 &&
          remaining <= triggerThreshold &&
          crossfadeTriggeredKeyRef.current !== key
        ) {
          const q = queueRef.current;
          const idx = currentIndexRef.current;
          const nextIdx =
            idx + 1 < q.length ? idx + 1 : repeatRef.current === 'all' && q.length > 0 ? 0 : -1;
          if (nextIdx >= 0 && nextIdx !== idx) {
            crossfadeTriggeredKeyRef.current = key;
            void transitionToQueueIndexWithCrossfade(nextIdx, Math.min(fadeSec, remaining));
          }
        }
      }
    });
    const unsubYtLoaded = youtubePlayer.on('loaded', ({ duration: dur }) => {
      if (!isYouTubeTrack(currentTrackRef.current)) return;
      if (dur > 0) setDuration(dur);
    });
    const unsubYtPlay = youtubePlayer.on('playstate', ({ isPlaying: playing }) => {
      if (!isYouTubeTrack(currentTrackRef.current)) return;
      setIsPlaying(playing);
    });
    const unsubYtError = youtubePlayer.on('error', ({ message }) => {
      if (!isYouTubeTrack(currentTrackRef.current)) return;
      showToast(message, 'error');
    });
    const unsubYtEnded = youtubePlayer.on('ended', () => {
      if (!isYouTubeTrack(currentTrackRef.current)) return;
      if (sleepTimerModeRef.current === 'end_of_track') {
        setSleepTimerMode('off');
        setSleepRemainingSeconds(null);
        setIsPlaying(false);
        showToast('Sleep timer paused at end of track', 'info');
        return;
      }
      if (repeatRef.current === 'one' && currentTrackRef.current) {
        youtubePlayer.seek(0);
        youtubePlayer.play();
      } else {
        void nextTrack();
      }
    });

    audioEngine.setNavigationHandlers({
      onNext: () => void nextTrack(),
      onPrev: () => void prevTrack(),
      onSeekStep: (delta) => seekBy(delta),
      onPlay: () => void playActive(),
      onPause: () => pauseActive(),
      onSeekTo: (sec) => seek(sec),
    });

    return () => {
      unsubAudioTime();
      unsubAudioLoaded();
      unsubAudioPlay();
      unsubAudioError();
      unsubAudioEnded();
      unsubYtTime();
      unsubYtLoaded();
      unsubYtPlay();
      unsubYtError();
      unsubYtEnded();
    };
  }, [
    nextTrack,
    prevTrack,
    seekBy,
    playActive,
    pauseActive,
    seek,
    saveTrackPosition,
    persistState,
    showToast,
    transitionToQueueIndexWithCrossfade,
  ]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const nextShuffle = !prev;
      if (queue.length > 1) {
        if (nextShuffle) {
          const currentItem = queue[currentIndex];
          const upcoming = queue.filter((_, i) => i !== currentIndex);
          const nextQ = currentItem ? [currentItem, ...shuffleArray(upcoming)] : shuffleArray(queue);
          const nextIdx = currentItem ? 0 : -1;
          setOriginalQueueOrder(queue);
          setQueue(nextQ);
          setCurrentIndex(nextIdx);
          persistState({
            shuffle: true,
            queue: nextQ,
            originalQueueOrder: queue,
            currentIndex: nextIdx,
          });
        } else if (originalQueueOrder.length > 0) {
          const restoredIdx = currentTrackId
            ? originalQueueOrder.findIndex((item) => item.trackId === currentTrackId)
            : 0;
          const safeIdx = restoredIdx >= 0 ? restoredIdx : 0;
          setQueue(originalQueueOrder);
          setCurrentIndex(safeIdx);
          persistState({
            shuffle: false,
            queue: originalQueueOrder,
            currentIndex: safeIdx,
          });
        }
      } else {
        persistState({ shuffle: nextShuffle });
      }
      return nextShuffle;
    });
  }, [queue, currentIndex, originalQueueOrder, currentTrackId, persistState]);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const next: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      persistState({ repeat: next });
      return next;
    });
  }, [persistState]);

  const playNextInQueue = useCallback(
    (tracksToAdd: Track | Track[], source = 'Play Next') => {
      const list = Array.isArray(tracksToAdd) ? tracksToAdd : [tracksToAdd];
      if (list.length === 0) return;
      registerExternalTracks(list);

      if (queue.length === 0 || !currentTrack) {
        void playTrack(list[0], list, source);
        return;
      }

      const newItems: QueueItem[] = list.map((t) => ({
        queueId: createId('q'),
        trackId: t.id,
        addedAt: Date.now(),
        source,
      }));
      const insertAt = Math.max(0, currentIndex + 1);
      const nextQ = [...queue.slice(0, insertAt), ...newItems, ...queue.slice(insertAt)];
      setQueue(nextQ);
      setOriginalQueueOrder(nextQ);
      persistState({ queue: nextQ, originalQueueOrder: nextQ });
      showToast(
        list.length === 1 ? `Playing "${list[0].title}" next` : `Playing ${list.length} tracks next`,
        'success'
      );
    },
    [queue, currentTrack, currentIndex, registerExternalTracks, playTrack, persistState, showToast]
  );

  const addToQueue = useCallback(
    (tracksToAdd: Track | Track[], source = 'Queue') => {
      const list = Array.isArray(tracksToAdd) ? tracksToAdd : [tracksToAdd];
      if (list.length === 0) return;
      registerExternalTracks(list);

      if (queue.length === 0 || !currentTrack) {
        void playTrack(list[0], list, source);
        return;
      }

      const newItems: QueueItem[] = list.map((t) => ({
        queueId: createId('q'),
        trackId: t.id,
        addedAt: Date.now(),
        source,
      }));
      const nextQ = [...queue, ...newItems];
      setQueue(nextQ);
      setOriginalQueueOrder(nextQ);
      persistState({ queue: nextQ, originalQueueOrder: nextQ });
      showToast(
        list.length === 1 ? `Added "${list[0].title}" to queue` : `Added ${list.length} tracks to queue`,
        'success'
      );
    },
    [queue, currentTrack, registerExternalTracks, playTrack, persistState, showToast]
  );

  const removeQueueItem = useCallback(
    (queueId: string) => {
      const removeIdx = queue.findIndex((item) => item.queueId === queueId);
      if (removeIdx === -1) return;
      const nextQ = queue.filter((item) => item.queueId !== queueId);
      let nextIdx = currentIndex;
      if (removeIdx < currentIndex) {
        nextIdx = currentIndex - 1;
      } else if (removeIdx === currentIndex) {
        if (nextQ.length === 0) {
          audioEngine.unload();
          youtubePlayer.unload();
          setCurrentTrackId(null);
          setCurrentIndex(-1);
          setQueue([]);
          setOriginalQueueOrder([]);
          persistState({ currentTrackId: null, currentIndex: -1, queue: [], originalQueueOrder: [] });
          return;
        }
        nextIdx = Math.min(currentIndex, nextQ.length - 1);
        const nextTrackItem = trackById.get(nextQ[nextIdx].trackId);
        if (nextTrackItem) {
          void startTrackAt(nextTrackItem, nextIdx, 0);
        }
      }
      setQueue(nextQ);
      setCurrentIndex(nextIdx);
      persistState({ queue: nextQ, currentIndex: nextIdx });
    },
    [queue, currentIndex, trackById, startTrackAt, persistState]
  );

  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= queue.length ||
        toIndex >= queue.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const nextQ = queue.slice();
      const [moved] = nextQ.splice(fromIndex, 1);
      nextQ.splice(toIndex, 0, moved);
      const nextIdx = currentTrackId
        ? nextQ.findIndex((item) => item.trackId === currentTrackId)
        : currentIndex;
      setQueue(nextQ);
      setCurrentIndex(nextIdx);
      persistState({ queue: nextQ, currentIndex: nextIdx });
    },
    [queue, currentTrackId, currentIndex, persistState]
  );

  const shuffleUpcomingQueue = useCallback(() => {
    if (queue.length <= currentIndex + 2) return;
    const head = queue.slice(0, currentIndex + 1);
    const upcoming = shuffleArray(queue.slice(currentIndex + 1));
    const nextQ = [...head, ...upcoming];
    setQueue(nextQ);
    persistState({ queue: nextQ });
    showToast('Upcoming queue shuffled', 'info');
  }, [queue, currentIndex, persistState, showToast]);

  const clearQueue = useCallback(() => {
    if (currentTrack && currentIndex >= 0 && queue[currentIndex]) {
      const currentItem = queue[currentIndex];
      setQueue([currentItem]);
      setOriginalQueueOrder([currentItem]);
      setCurrentIndex(0);
      persistState({ queue: [currentItem], originalQueueOrder: [currentItem], currentIndex: 0 });
      showToast('Cleared upcoming tracks', 'info');
    } else {
      audioEngine.unload();
      youtubePlayer.unload();
      setQueue([]);
      setOriginalQueueOrder([]);
      setCurrentIndex(-1);
      setCurrentTrackId(null);
      persistState({ queue: [], originalQueueOrder: [], currentIndex: -1, currentTrackId: null });
    }
  }, [currentTrack, currentIndex, queue, persistState, showToast]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        currentIndex,
        isPlaying,
        currentTime,
        duration,
        shuffle,
        repeat,
        nowPlayingOpen,
        queueOpen,
        setNowPlayingOpen,
        setQueueOpen,
        resolveTrack,
        playTrack,
        playQueueIndex,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        seekBy,
        toggleShuffle,
        cycleRepeat,
        playNextInQueue,
        addToQueue,
        removeQueueItem,
        reorderQueue,
        shuffleUpcomingQueue,
        clearQueue,
        toggleTrackLike,
        sleepTimerMode,
        sleepRemainingSeconds,
        setSleepTimer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
