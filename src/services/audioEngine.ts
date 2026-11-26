import { DEFAULT_EQUALIZER_SETTINGS, clampDb } from '../lib/equalizer';
import {
  bindNavigatorMediaSessionHandlers,
  setMediaSessionHandlers,
  setMediaSessionPlaybackState,
  updateMediaSessionPosition,
  updateMediaSessionTrackMetadata,
  type MediaSessionActionHandlers,
} from '../lib/mediaSession';
import { resolveMediaStorePlayableUrl } from '../plugins/mediaStore';
import type { EqualizerSettings, Track } from '../types/music';
import { db } from './db';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

type SinkIdAudioElement = HTMLAudioElement & {
  sinkId?: string;
  setSinkId?: (sinkId: string) => Promise<void>;
};

export type AudioEngineEvents = {
  timeupdate: { currentTime: number; duration: number };
  playstate: { isPlaying: boolean };
  ended: void;
  error: { message: string };
  loaded: { duration: number };
};

type Listener<K extends keyof AudioEngineEvents> = (payload: AudioEngineEvents[K]) => void;
type DeckIndex = 0 | 1;

class SharedAudioEngine {
  private decks: [HTMLAudioElement, HTMLAudioElement];
  private activeDeckIndex: DeckIndex = 0;
  private deckUrls: [string | null, string | null] = [null, null];
  private deckTrackIds: [string | null, string | null] = [null, null];
  private deckPendingHandlers: [(() => void) | null, (() => void) | null] = [null, null];
  private deckFadeMultipliers: [number, number] = [1, 1];

  private crossfadeTimer: number | null = null;
  private fadeOutTimer: number | null = null;
  private fadingOutgoingIndex: DeckIndex | null = null;

  private listeners: { [K in keyof AudioEngineEvents]?: Set<Listener<K>> } = {};
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private deckGainNodes: [GainNode | null, GainNode | null] = [null, null];
  private sourceNodes: [MediaElementAudioSourceNode | null, MediaElementAudioSourceNode | null] = [
    null,
    null,
  ];
  private compressorNode: DynamicsCompressorNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private normalizationEnabled = false;
  private equalizerSettings: EqualizerSettings = { ...DEFAULT_EQUALIZER_SETTINGS };
  private baseVolume = 0.85;
  private isMuted = false;
  private playbackRate = 1;
  private currentOutputDeviceId = '';

  constructor() {
    const deckA = new Audio();
    const deckB = new Audio();
    deckA.preload = 'auto';
    deckB.preload = 'auto';
    deckA.setAttribute('playsinline', '');
    deckB.setAttribute('playsinline', '');
    this.decks = [deckA, deckB];

    this.attachDeckEvents(0);
    this.attachDeckEvents(1);
    bindNavigatorMediaSessionHandlers();
  }

  isSinkIdSupported(): boolean {
    if (typeof HTMLMediaElement === 'undefined') return false;
    return typeof (this.decks[0] as SinkIdAudioElement).setSinkId === 'function';
  }

  async listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      return outputs.map((d, index) => ({
        deviceId: d.deviceId,
        label:
          d.label?.trim() ||
          (d.deviceId === 'default'
            ? 'System Default (Bluetooth / Speaker)'
            : d.deviceId === 'communications'
              ? 'Communications Audio Output'
              : `Audio Output ${index + 1}`),
      }));
    } catch {
      return [];
    }
  }

  async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    const normalizedId = deviceId || '';
    this.currentOutputDeviceId = normalizedId;
    if (!this.isSinkIdSupported()) return false;
    try {
      await Promise.all(
        this.decks.map(async (deck) => {
          const sinkDeck = deck as SinkIdAudioElement;
          if (typeof sinkDeck.setSinkId === 'function') {
            await sinkDeck.setSinkId(normalizedId);
          }
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  onOutputDeviceDisconnected(
    callback: (info: { selectedDeviceRemoved: boolean }) => void
  ): () => void {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== 'function' ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return () => {};
    }

    let knownOutputIds = new Set<string>();
    let disposed = false;

    const refreshKnownIds = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (disposed) return;
        knownOutputIds = new Set(
          devices
            .filter((d) => d.kind === 'audiooutput' && d.deviceId)
            .map((d) => d.deviceId)
        );
      } catch {
        // Ignore device enumeration permission errors
      }
    };

    void refreshKnownIds();

    const handleDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (disposed) return;
        const nextIds = new Set(
          devices
            .filter((d) => d.kind === 'audiooutput' && d.deviceId)
            .map((d) => d.deviceId)
        );

        if (knownOutputIds.size > 0) {
          let anyRemoved = false;
          for (const prevId of knownOutputIds) {
            if (prevId !== 'default' && prevId !== 'communications' && !nextIds.has(prevId)) {
              anyRemoved = true;
              break;
            }
          }
          const selectedDeviceRemoved = Boolean(
            this.currentOutputDeviceId &&
              this.currentOutputDeviceId !== 'default' &&
              !nextIds.has(this.currentOutputDeviceId)
          );

          if (anyRemoved || selectedDeviceRemoved) {
            callback({ selectedDeviceRemoved });
          }
        }
        knownOutputIds = nextIds;
      } catch {
        // Ignore transient device change errors
      }
    };

    const listener = () => {
      void handleDeviceChange();
    };
    navigator.mediaDevices.addEventListener('devicechange', listener);
    return () => {
      disposed = true;
      navigator.mediaDevices.removeEventListener('devicechange', listener);
    };
  }

  private get activeAudio(): HTMLAudioElement {
    return this.decks[this.activeDeckIndex];
  }

  private attachDeckEvents(deckIndex: DeckIndex): void {
    const el = this.decks[deckIndex];

    el.addEventListener('timeupdate', () => {
      if (deckIndex !== this.activeDeckIndex) return;
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      this.emit('timeupdate', {
        currentTime: el.currentTime || 0,
        duration: dur,
      });
      this.syncMediaSessionPosition();
    });

    el.addEventListener('loadedmetadata', () => {
      if (deckIndex !== this.activeDeckIndex) return;
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      this.emit('loaded', { duration: dur });
      this.syncMediaSessionPosition();
    });

    el.addEventListener('play', () => {
      if (deckIndex !== this.activeDeckIndex) return;
      this.emit('playstate', { isPlaying: true });
      setMediaSessionPlaybackState('playing');
      this.syncMediaSessionPosition();
    });

    el.addEventListener('pause', () => {
      if (deckIndex !== this.activeDeckIndex) return;
      this.emit('playstate', { isPlaying: false });
      setMediaSessionPlaybackState('paused');
      this.syncMediaSessionPosition();
    });

    el.addEventListener('ended', () => {
      if (deckIndex !== this.activeDeckIndex) {
        this.cleanupDeck(deckIndex);
        if (this.fadingOutgoingIndex === deckIndex) {
          this.fadingOutgoingIndex = null;
        }
        return;
      }
      this.emit('ended', undefined);
    });

    el.addEventListener('error', () => {
      if (deckIndex !== this.activeDeckIndex) return;
      if (!el.getAttribute('src')) return;
      const code = el.error?.code;
      const msg =
        code === 4
          ? 'This audio format is not supported by your browser.'
          : 'Unable to play this audio file.';
      this.emit('error', { message: msg });
      this.emit('playstate', { isPlaying: false });
    });
  }

  on<K extends keyof AudioEngineEvents>(event: K, fn: Listener<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as never;
    }
    const set = this.listeners[event] as Set<Listener<K>>;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  private emit<K extends keyof AudioEngineEvents>(event: K, payload: AudioEngineEvents[K]): void {
    const set = this.listeners[event] as Set<Listener<K>> | undefined;
    if (!set) return;
    for (const fn of set) {
      fn(payload);
    }
  }

  setNavigationHandlers(handlers: {
    onNext: () => void;
    onPrev: () => void;
    onSeekStep: (delta: number) => void;
    onPlay?: () => void;
    onPause?: () => void;
    onSeekTo?: (seconds: number) => void;
  }): void {
    const normalized: MediaSessionActionHandlers = {
      onNext: handlers.onNext,
      onPrev: handlers.onPrev,
      onSeekStep: handlers.onSeekStep,
      onPlay: handlers.onPlay ?? (() => void this.play()),
      onPause: handlers.onPause ?? (() => this.pause()),
      onSeekTo: handlers.onSeekTo ?? ((sec) => this.seek(sec)),
    };
    setMediaSessionHandlers(normalized);
  }

  async refreshMetadata(track: Track): Promise<void> {
    if (this.deckTrackIds[this.activeDeckIndex] !== track.id) return;
    await updateMediaSessionTrackMetadata(track);
  }

  private syncMediaSessionPosition(): void {
    const el = this.activeAudio;
    const dur = Number.isFinite(el.duration) ? el.duration : 0;
    if (dur > 0) {
      updateMediaSessionPosition(el.currentTime || 0, dur, el.playbackRate || 1);
    }
  }

  private ensureWebAudioGraph(): void {
    const needsDsp = this.normalizationEnabled || this.equalizerSettings.enabled;

    if (!needsDsp || this.audioCtx || typeof window === 'undefined') return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    try {
      this.audioCtx = new Ctx();

      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 120;

      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1.0;

      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 6500;

      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.compressorNode.knee.value = 18;
      this.compressorNode.attack.value = 0.005;
      this.compressorNode.release.value = 0.2;

      this.gainNode = this.audioCtx.createGain();

      for (const idx of [0, 1] as const) {
        const src = this.audioCtx.createMediaElementSource(this.decks[idx]);
        const dGain = this.audioCtx.createGain();
        dGain.gain.value = this.deckFadeMultipliers[idx];
        src.connect(dGain);
        dGain.connect(this.bassFilter);
        this.sourceNodes[idx] = src;
        this.deckGainNodes[idx] = dGain;
      }

      this.bassFilter.connect(this.midFilter);
      this.midFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.applyDspParams();
      this.applyVolumes();
    } catch {
      this.audioCtx = null;
      this.gainNode = null;
      this.deckGainNodes = [null, null];
      this.sourceNodes = [null, null];
      this.compressorNode = null;
      this.bassFilter = null;
      this.midFilter = null;
      this.trebleFilter = null;
    }
  }

  private applyDspParams(): void {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const eqActive = this.equalizerSettings.enabled;

    if (this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(
        eqActive ? clampDb(this.equalizerSettings.bass) : 0,
        t,
        0.015
      );
    }
    if (this.midFilter) {
      this.midFilter.gain.setTargetAtTime(
        eqActive ? clampDb(this.equalizerSettings.mid) : 0,
        t,
        0.015
      );
    }
    if (this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(
        eqActive ? clampDb(this.equalizerSettings.treble) : 0,
        t,
        0.015
      );
    }
    if (this.compressorNode) {
      this.compressorNode.threshold.setTargetAtTime(this.normalizationEnabled ? -16 : -2, t, 0.02);
      this.compressorNode.ratio.setTargetAtTime(this.normalizationEnabled ? 4 : 1.5, t, 0.02);
    }
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(this.normalizationEnabled ? 1.08 : 1.0, t, 0.02);
    }
  }

  private applyVolumes(): void {
    const master = this.isMuted ? 0 : this.baseVolume;
    for (const idx of [0, 1] as const) {
      const mult = Math.max(0, Math.min(1, this.deckFadeMultipliers[idx]));
      const dGain = this.deckGainNodes[idx];
      if (this.audioCtx && dGain) {
        this.decks[idx].volume = master;
        dGain.gain.setTargetAtTime(mult, this.audioCtx.currentTime, 0.012);
      } else {
        this.decks[idx].volume = Math.max(0, Math.min(1, master * mult));
      }
    }
  }

  private clearCrossfadeTimers(): void {
    if (this.crossfadeTimer !== null) {
      window.clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.fadeOutTimer !== null) {
      window.clearInterval(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
  }

  cancelCrossfade(cleanupOutgoing = true): void {
    this.clearCrossfadeTimers();
    if (cleanupOutgoing && this.fadingOutgoingIndex !== null) {
      this.cleanupDeck(this.fadingOutgoingIndex);
    }
    this.fadingOutgoingIndex = null;
    this.deckFadeMultipliers[this.activeDeckIndex] = 1;
    this.applyVolumes();
  }

  isFadingOut(): boolean {
    return this.fadeOutTimer !== null || this.crossfadeTimer !== null;
  }

  private cleanupDeck(deckIndex: DeckIndex): void {
    const handler = this.deckPendingHandlers[deckIndex];
    if (handler) {
      this.decks[deckIndex].removeEventListener('loadedmetadata', handler);
      this.deckPendingHandlers[deckIndex] = null;
    }
    const el = this.decks[deckIndex];
    el.pause();
    el.removeAttribute('src');
    this.releaseDeckUrl(deckIndex);
    this.deckTrackIds[deckIndex] = null;
    this.deckFadeMultipliers[deckIndex] = 0;
  }

  private async resolveHandleFile(trackId: string): Promise<File | null> {
    const handle = await db.getFileHandle(trackId);
    if (!handle) return null;

    type PermissionCapableHandle = FileSystemFileHandle & {
      queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
      requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    };
    const permHandle = handle as PermissionCapableHandle;

    try {
      if (typeof permHandle.queryPermission === 'function') {
        const perm = await permHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted' && typeof permHandle.requestPermission === 'function') {
          const req = await permHandle.requestPermission({ mode: 'read' });
          if (req !== 'granted') return null;
        }
      }
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  private async resolveTrackUrl(
    track: Track
  ): Promise<{ srcUrl: string; objectUrl: string | null; missingReason?: string } | null> {
    if (track.source === 'filehandle') {
      const file = await this.resolveHandleFile(track.id);
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        return { srcUrl: objectUrl, objectUrl };
      }
      return {
        srcUrl: '',
        objectUrl: null,
        missingReason:
          'Read permission or access to this original file expired. Relink or re-pick the file to resume.',
      };
    }

    const blob = await db.getAudioBlob(track.id);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      return { srcUrl: objectUrl, objectUrl };
    }

    // Fallback check in case track has an associated handle regardless of source field
    const fallbackFile = await this.resolveHandleFile(track.id);
    if (fallbackFile) {
      const objectUrl = URL.createObjectURL(fallbackFile);
      return { srcUrl: objectUrl, objectUrl };
    }

    if ((track.source === 'mediastore' || track.source === 'document') && track.contentUri) {
      try {
        const srcUrl = await resolveMediaStorePlayableUrl(track);
        if (srcUrl) return { srcUrl, objectUrl: null };
      } catch {
        return null;
      }
    }
    return null;
  }

  private attachStartPosition(deckIndex: DeckIndex, trackId: string, startPosition: number): void {
    if (startPosition <= 0) return;
    const el = this.decks[deckIndex];
    const applyStartPos = () => {
      if (
        this.deckTrackIds[deckIndex] === trackId &&
        Number.isFinite(el.duration) &&
        startPosition < el.duration
      ) {
        el.currentTime = startPosition;
      }
      if (this.deckPendingHandlers[deckIndex] === applyStartPos) {
        this.deckPendingHandlers[deckIndex] = null;
      }
      el.removeEventListener('loadedmetadata', applyStartPos);
    };
    if (el.readyState >= 1) {
      applyStartPos();
    } else {
      this.deckPendingHandlers[deckIndex] = applyStartPos;
      el.addEventListener('loadedmetadata', applyStartPos);
    }
  }

  async loadTrack(track: Track, startPosition = 0, autoplay = true): Promise<boolean> {
    this.cancelCrossfade(true);

    const idx = this.activeDeckIndex;
    const el = this.decks[idx];

    if (this.deckPendingHandlers[idx]) {
      el.removeEventListener('loadedmetadata', this.deckPendingHandlers[idx]!);
      this.deckPendingHandlers[idx] = null;
    }

    bindNavigatorMediaSessionHandlers();

    if (this.deckTrackIds[idx] === track.id && el.getAttribute('src')) {
      if (startPosition > 0 && Math.abs(el.currentTime - startPosition) > 0.5) {
        this.seek(startPosition);
      }
      this.deckFadeMultipliers[idx] = 1;
      this.applyVolumes();
      await updateMediaSessionTrackMetadata(track);
      if (autoplay) return this.play();
      setMediaSessionPlaybackState('paused');
      return true;
    }

    const resolved = await this.resolveTrackUrl(track);
    if (!resolved || !resolved.srcUrl) {
      this.releaseDeckUrl(idx);
      this.deckTrackIds[idx] = null;
      this.emit('error', {
        message: resolved?.missingReason || 'Audio file is missing from local storage.',
      });
      return false;
    }

    this.releaseDeckUrl(idx);
    this.deckUrls[idx] = resolved.objectUrl;
    this.deckTrackIds[idx] = track.id;
    this.deckFadeMultipliers[idx] = 1;

    el.src = resolved.srcUrl;
    el.playbackRate = this.playbackRate;
    this.applyVolumes();

    this.attachStartPosition(idx, track.id, startPosition);
    await updateMediaSessionTrackMetadata(track);

    if (autoplay) {
      return this.play();
    }
    setMediaSessionPlaybackState('paused');
    return true;
  }

  async forceReloadTrack(track: Track, positionSeconds: number, shouldPlay: boolean): Promise<void> {
    const idx = this.activeDeckIndex;
    if (this.deckTrackIds[idx] !== track.id) return;
    this.cleanupDeck(idx);
    await this.loadTrack(track, positionSeconds, shouldPlay);
  }

  async crossfadeToTrack(
    track: Track,
    crossfadeSeconds: number,
    startPosition = 0
  ): Promise<boolean> {
    if (crossfadeSeconds <= 0.1 || !this.isPlaying()) {
      return this.loadTrack(track, startPosition, true);
    }

    if (this.crossfadeTimer !== null || this.fadeOutTimer !== null) {
      this.cancelCrossfade(true);
    }

    const resolved = await this.resolveTrackUrl(track);
    if (!resolved || !resolved.srcUrl) {
      this.emit('error', {
        message: resolved?.missingReason || 'Audio file is missing from local storage.',
      });
      return false;
    }

    const outgoingIdx: DeckIndex = this.activeDeckIndex;
    const incomingIdx: DeckIndex = outgoingIdx === 0 ? 1 : 0;

    this.cleanupDeck(incomingIdx);
    this.deckUrls[incomingIdx] = resolved.objectUrl;
    this.deckTrackIds[incomingIdx] = track.id;
    this.deckFadeMultipliers[incomingIdx] = 0.01;
    this.deckFadeMultipliers[outgoingIdx] = 1;

    const incomingEl = this.decks[incomingIdx];
    incomingEl.src = resolved.srcUrl;
    incomingEl.playbackRate = this.playbackRate;
    this.attachStartPosition(incomingIdx, track.id, startPosition);

    this.activeDeckIndex = incomingIdx;
    this.fadingOutgoingIndex = outgoingIdx;
    this.applyVolumes();

    try {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      await incomingEl.play();
    } catch {
      this.cleanupDeck(incomingIdx);
      this.activeDeckIndex = outgoingIdx;
      this.fadingOutgoingIndex = null;
      this.deckFadeMultipliers[outgoingIdx] = 1;
      this.applyVolumes();
      this.emit('playstate', { isPlaying: false });
      return false;
    }

    bindNavigatorMediaSessionHandlers();
    void updateMediaSessionTrackMetadata(track);

    const fadeMs = Math.max(400, Math.round(crossfadeSeconds * 1000));
    const startedAt = Date.now();

    this.crossfadeTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / fadeMs);

      this.deckFadeMultipliers[outgoingIdx] = Math.cos(progress * Math.PI * 0.5);
      this.deckFadeMultipliers[incomingIdx] = Math.sin(progress * Math.PI * 0.5);
      this.applyVolumes();

      if (progress >= 1) {
        this.clearCrossfadeTimers();
        this.cleanupDeck(outgoingIdx);
        this.fadingOutgoingIndex = null;
        this.deckFadeMultipliers[incomingIdx] = 1;
        this.applyVolumes();
      }
    }, 40);

    return true;
  }

  fadeOutCurrent(durationSeconds: number): void {
    this.clearCrossfadeTimers();
    if (!this.isPlaying() || durationSeconds <= 0.1) {
      this.pause();
      return;
    }

    const targetIdx = this.activeDeckIndex;
    this.fadingOutgoingIndex = targetIdx;
    const fadeMs = Math.max(400, Math.round(durationSeconds * 1000));
    const startedAt = Date.now();

    this.fadeOutTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / fadeMs);
      this.deckFadeMultipliers[targetIdx] = Math.cos(progress * Math.PI * 0.5);
      this.applyVolumes();

      if (progress >= 1) {
        this.clearCrossfadeTimers();
        this.cleanupDeck(targetIdx);
        this.fadingOutgoingIndex = null;
        this.deckFadeMultipliers[targetIdx] = 1;
        this.applyVolumes();
      }
    }, 40);
  }

  async play(): Promise<boolean> {
    const el = this.activeAudio;
    if (!el.src) return false;
    this.deckFadeMultipliers[this.activeDeckIndex] = 1;
    this.applyVolumes();
    bindNavigatorMediaSessionHandlers();
    try {
      if (this.normalizationEnabled || this.equalizerSettings.enabled) {
        this.ensureWebAudioGraph();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      await el.play();
      setMediaSessionPlaybackState('playing');
      this.syncMediaSessionPosition();
      return true;
    } catch {
      this.emit('playstate', { isPlaying: false });
      setMediaSessionPlaybackState('paused');
      return false;
    }
  }

  pause(): void {
    this.cancelCrossfade(true);
    this.activeAudio.pause();
    setMediaSessionPlaybackState('paused');
    this.syncMediaSessionPosition();
  }

  seek(seconds: number): void {
    this.cancelCrossfade(true);
    const el = this.activeAudio;
    if (!el.src) return;
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    const target = Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
    el.currentTime = target;
    this.emit('timeupdate', { currentTime: target, duration });
    this.syncMediaSessionPosition();
  }

  setVolume(volume: number, muted = false): void {
    this.baseVolume = Math.max(0, Math.min(1, volume));
    this.isMuted = muted;
    this.applyVolumes();
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, rate));
    this.decks[0].playbackRate = this.playbackRate;
    this.decks[1].playbackRate = this.playbackRate;
    this.syncMediaSessionPosition();
  }

  setVolumeNormalization(enabled: boolean): void {
    this.normalizationEnabled = enabled;
    if (enabled && this.isPlaying()) {
      this.ensureWebAudioGraph();
    }
    this.applyDspParams();
  }

  setEqualizer(eq: EqualizerSettings): void {
    this.equalizerSettings = { ...eq };
    if (eq.enabled && this.isPlaying()) {
      this.ensureWebAudioGraph();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
    }
    this.applyDspParams();
  }

  getCurrentTime(): number {
    return this.activeAudio.currentTime || 0;
  }

  getDuration(): number {
    const el = this.activeAudio;
    return Number.isFinite(el.duration) ? el.duration : 0;
  }

  isPlaying(): boolean {
    const el = this.activeAudio;
    return !el.paused && !el.ended && Boolean(el.src);
  }

  unload(): void {
    this.clearCrossfadeTimers();
    this.fadingOutgoingIndex = null;
    this.cleanupDeck(0);
    this.cleanupDeck(1);
    this.deckFadeMultipliers = [1, 1];
    this.applyVolumes();
    this.emit('playstate', { isPlaying: false });
    this.emit('timeupdate', { currentTime: 0, duration: 0 });
  }

  private releaseDeckUrl(deckIndex: DeckIndex): void {
    const existing = this.deckUrls[deckIndex];
    if (existing) {
      URL.revokeObjectURL(existing);
      this.deckUrls[deckIndex] = null;
    }
  }
}

export const audioEngine = new SharedAudioEngine();
