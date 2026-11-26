import {
  bindNavigatorMediaSessionHandlers,
  setMediaSessionPlaybackState,
  updateMediaSessionPosition,
  updateMediaSessionTrackMetadata,
} from '../lib/mediaSession';
import type { Track } from '../types/music';

export type YouTubePlayerEvent =
  | 'timeupdate'
  | 'loaded'
  | 'playstate'
  | 'error'
  | 'ended';

export interface YouTubeTimeUpdatePayload {
  currentTime: number;
  duration: number;
}

export interface YouTubeLoadedPayload {
  duration: number;
}

export interface YouTubePlayStatePayload {
  isPlaying: boolean;
}

export interface YouTubeErrorPayload {
  message: string;
}

type ListenerMap = {
  timeupdate: Set<(payload: YouTubeTimeUpdatePayload) => void>;
  loaded: Set<(payload: YouTubeLoadedPayload) => void>;
  playstate: Set<(payload: YouTubePlayStatePayload) => void>;
  error: Set<(payload: YouTubeErrorPayload) => void>;
  ended: Set<() => void>;
};

interface YtPlayerInstance {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  setPlaybackRate(suggestedRate: number): void;
  getAvailablePlaybackRates(): number[];
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YtNamespace {
  Player: new (
    elementId: string | HTMLElement,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YtPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YtPlayerInstance }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YtPlayerInstance;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;

let apiLoadPromise: Promise<void> | null = null;

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('YouTube playback requires a browser environment.'));
  }
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve();
  }
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeoutId = window.setTimeout(() => {
      if (!(window.YT && typeof window.YT.Player === 'function')) {
        apiLoadPromise = null;
        reject(new Error('Timed out loading YouTube audio player. Check your connection.'));
      }
    }, 15000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeoutId);
      previousReady?.();
      resolve();
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        apiLoadPromise = null;
        reject(new Error('Unable to load YouTube player script.'));
      };
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

class YouTubePlayerService {
  private currentTrack: Track | null = null;
  private playing = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 0.85;
  private muted = false;
  private playbackRate = 1;

  private player: YtPlayerInstance | null = null;
  private playerReady = false;
  private initPromise: Promise<void> | null = null;
  private pendingLoad: {
    videoId: string;
    startSeconds: number;
    autoplay: boolean;
    fadeInSeconds: number;
  } | null = null;

  private pollTimer: number | null = null;
  private fadeTimer: number | null = null;
  private activeLoadSeq = 0;

  private listeners: ListenerMap = {
    timeupdate: new Set(),
    loaded: new Set(),
    playstate: new Set(),
    error: new Set(),
    ended: new Set(),
  };

  public on<E extends YouTubePlayerEvent>(
    event: E,
    listener: ListenerMap[E] extends Set<infer Fn> ? Fn : never
  ): () => void {
    const set = this.listeners[event] as Set<typeof listener>;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  private emitTimeUpdate(): void {
    const payload = { currentTime: this.currentTime, duration: this.duration };
    this.listeners.timeupdate.forEach((fn) => fn(payload));
  }

  private emitPlayState(isPlaying: boolean): void {
    this.playing = isPlaying;
    this.listeners.playstate.forEach((fn) => fn({ isPlaying }));
    if (this.currentTrack) {
      setMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');
      if (this.duration > 0) {
        updateMediaSessionPosition(this.currentTime, this.duration, this.playbackRate);
      }
    }
  }

  private emitError(message: string): void {
    this.listeners.error.forEach((fn) => fn({ message }));
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.fadeTimer);
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private stopPolling(): void {
    if (this.pollTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startPolling(): void {
    if (this.pollTimer !== null || typeof window === 'undefined') return;
    this.pollTimer = window.setInterval(() => {
      if (!this.player || !this.playerReady) return;
      try {
        const ct = this.player.getCurrentTime();
        const dur = this.player.getDuration();
        if (Number.isFinite(dur) && dur > 0 && Math.abs(dur - this.duration) > 0.2) {
          this.duration = dur;
          this.listeners.loaded.forEach((fn) => fn({ duration: dur }));
        }
        if (Number.isFinite(ct) && ct >= 0) {
          this.currentTime = ct;
          this.emitTimeUpdate();
          if (this.duration > 0) {
            updateMediaSessionPosition(this.currentTime, this.duration, this.playbackRate);
          }
        }
      } catch {
        // Ignore transient YT bridge errors
      }
    }, 250);
  }

  private ensureHostElement(): HTMLElement {
    let host = document.getElementById('neo-yt-player-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'neo-yt-player-root';
      host.setAttribute('aria-hidden', 'true');
      // Must NOT be display:none or visibility:hidden so Chrome/Android WebView keeps audio playing
      host.style.position = 'fixed';
      host.style.bottom = '0px';
      host.style.right = '0px';
      host.style.width = '2px';
      host.style.height = '2px';
      host.style.opacity = '0.001';
      host.style.overflow = 'hidden';
      host.style.pointerEvents = 'none';
      host.style.zIndex = '-1';
      document.body.appendChild(host);
    }
    let mount = document.getElementById('neo-yt-player-iframe');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'neo-yt-player-iframe';
      host.appendChild(mount);
    }
    return mount;
  }

  private applyEffectiveVolume(multiplier = 1): void {
    if (!this.player || !this.playerReady) return;
    try {
      const effective = this.muted ? 0 : Math.round(Math.max(0, Math.min(1, this.volume * multiplier)) * 100);
      if (this.muted || effective === 0) {
        this.player.setVolume(0);
      } else {
        this.player.unMute();
        this.player.setVolume(effective);
      }
    } catch {
      // Ignore YT volume race before video loads
    }
  }

  private applyPlaybackRateToPlayer(): void {
    if (!this.player || !this.playerReady) return;
    try {
      const available = this.player.getAvailablePlaybackRates?.();
      if (Array.isArray(available) && available.length > 0) {
        const closest = available.reduce((best, r) =>
          Math.abs(r - this.playbackRate) < Math.abs(best - this.playbackRate) ? r : best
        );
        this.player.setPlaybackRate(closest);
      } else {
        this.player.setPlaybackRate(this.playbackRate);
      }
    } catch {
      // Ignore rate error before playback starts
    }
  }

  private runFadeIn(fadeInSeconds: number): void {
    this.clearFadeTimer();
    if (fadeInSeconds <= 0.1 || typeof window === 'undefined') {
      this.applyEffectiveVolume(1);
      return;
    }
    this.applyEffectiveVolume(0.02);
    const fadeMs = Math.max(300, Math.round(fadeInSeconds * 1000));
    const startedAt = Date.now();
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / fadeMs);
      this.applyEffectiveVolume(Math.sin(progress * Math.PI * 0.5));
      if (progress >= 1) {
        this.clearFadeTimer();
        this.applyEffectiveVolume(1);
      }
    }, 40);
  }

  private async ensurePlayerInitialized(): Promise<void> {
    if (this.player && this.playerReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = ensureYouTubeIframeApi()
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            if (!window.YT || typeof window.YT.Player !== 'function') {
              reject(new Error('YouTube IFrame Player API unavailable.'));
              return;
            }
            const mount = this.ensureHostElement();
            const initialVideo = this.pendingLoad?.videoId || '';
            this.player = new window.YT.Player(mount, {
              width: 2,
              height: 2,
              videoId: initialVideo || undefined,
              playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                enablejsapi: 1,
                fs: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                origin: window.location.origin,
              },
              events: {
                onReady: () => {
                  this.playerReady = true;
                  this.applyEffectiveVolume(1);
                  resolve();
                  const pending = this.pendingLoad;
                  if (pending) {
                    this.pendingLoad = null;
                    this.dispatchVideoToPlayer(
                      pending.videoId,
                      pending.startSeconds,
                      pending.autoplay,
                      pending.fadeInSeconds
                    );
                  }
                },
                onStateChange: (event) => {
                  const state = event.data;
                  if (state === YT_STATE_PLAYING) {
                    this.applyPlaybackRateToPlayer();
                    try {
                      const dur = this.player?.getDuration() || 0;
                      if (Number.isFinite(dur) && dur > 0) {
                        this.duration = dur;
                        this.listeners.loaded.forEach((fn) => fn({ duration: dur }));
                      }
                      const ct = this.player?.getCurrentTime() || 0;
                      if (Number.isFinite(ct) && ct >= 0) {
                        this.currentTime = ct;
                      }
                    } catch {
                      // ignore
                    }
                    this.startPolling();
                    this.emitPlayState(true);
                    this.emitTimeUpdate();
                  } else if (state === YT_STATE_PAUSED) {
                    this.stopPolling();
                    try {
                      const ct = this.player?.getCurrentTime();
                      if (typeof ct === 'number' && Number.isFinite(ct)) {
                        this.currentTime = ct;
                      }
                    } catch {
                      // ignore
                    }
                    this.emitPlayState(false);
                    this.emitTimeUpdate();
                  } else if (state === YT_STATE_ENDED) {
                    this.stopPolling();
                    this.playing = false;
                    setMediaSessionPlaybackState('paused');
                    this.listeners.ended.forEach((fn) => fn());
                  }
                },
                onError: (event) => {
                  this.stopPolling();
                  this.emitPlayState(false);
                  const code = event.data;
                  const msg =
                    code === 101 || code === 150
                      ? 'The uploader blocked embedded playback for this YouTube track.'
                      : code === 100
                        ? 'This YouTube track is private or unavailable.'
                        : code === 2
                          ? 'Invalid YouTube video ID.'
                          : 'YouTube stream error occurred during playback.';
                  this.emitError(msg);
                },
              },
            });
          })
      )
      .catch((err) => {
        this.initPromise = null;
        throw err;
      });

    return this.initPromise;
  }

  private dispatchVideoToPlayer(
    videoId: string,
    startSeconds: number,
    autoplay: boolean,
    fadeInSeconds: number
  ): void {
    if (!this.player || !this.playerReady) return;
    try {
      if (autoplay) {
        this.runFadeIn(fadeInSeconds);
        this.player.loadVideoById({ videoId, startSeconds });
        this.player.playVideo();
        this.startPolling();
      } else {
        this.player.cueVideoById({ videoId, startSeconds });
        this.stopPolling();
        this.emitPlayState(false);
      }
      this.applyPlaybackRateToPlayer();
    } catch {
      this.emitError('Unable to start YouTube playback.');
      this.emitPlayState(false);
    }
  }

  public async loadTrack(
    track: Track,
    startSeconds = 0,
    autoplay = true,
    fadeInSeconds = 0
  ): Promise<boolean> {
    const seq = ++this.activeLoadSeq;
    this.clearFadeTimer();
    const videoId = track.youtubeVideoId;
    if (!videoId) {
      this.emitError('Missing YouTube video ID for this track.');
      return false;
    }

    this.currentTrack = track;
    this.currentTime = Math.max(0, startSeconds || 0);
    this.duration = Math.max(0, track.duration || 0);

    bindNavigatorMediaSessionHandlers();
    void updateMediaSessionTrackMetadata(track);
    if (this.duration > 0) {
      updateMediaSessionPosition(this.currentTime, this.duration, this.playbackRate);
    }

    this.listeners.loaded.forEach((fn) => fn({ duration: this.duration }));
    this.emitTimeUpdate();

    this.pendingLoad = {
      videoId,
      startSeconds: this.currentTime,
      autoplay,
      fadeInSeconds,
    };

    try {
      await this.ensurePlayerInitialized();
      if (seq !== this.activeLoadSeq) return false;
      if (this.player && this.playerReady && this.pendingLoad?.videoId === videoId) {
        const pending = this.pendingLoad;
        this.pendingLoad = null;
        this.dispatchVideoToPlayer(
          pending.videoId,
          pending.startSeconds,
          pending.autoplay,
          pending.fadeInSeconds
        );
      }
      return true;
    } catch (err) {
      if (seq === this.activeLoadSeq) {
        this.emitError(
          err instanceof Error ? err.message : 'Unable to initialize YouTube playback.'
        );
        this.emitPlayState(false);
      }
      return false;
    }
  }

  public play(): boolean {
    if (!this.currentTrack || !this.currentTrack.youtubeVideoId) return false;
    this.clearFadeTimer();
    if (!this.player || !this.playerReady) {
      void this.loadTrack(this.currentTrack, this.currentTime, true);
      return true;
    }
    try {
      bindNavigatorMediaSessionHandlers();
      this.applyEffectiveVolume(1);
      this.applyPlaybackRateToPlayer();
      this.player.playVideo();
      this.startPolling();
      this.emitPlayState(true);
      return true;
    } catch {
      return false;
    }
  }

  public pause(): void {
    this.clearFadeTimer();
    this.stopPolling();
    if (this.pendingLoad) {
      this.pendingLoad.autoplay = false;
    }
    if (this.player && this.playerReady) {
      try {
        this.player.pauseVideo();
      } catch {
        // ignore
      }
    }
    if (this.playing) {
      this.emitPlayState(false);
    }
  }

  public seek(seconds: number): void {
    const safeSec = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const clamped = this.duration > 0 ? Math.min(safeSec, this.duration) : safeSec;
    this.currentTime = clamped;
    if (this.player && this.playerReady) {
      try {
        this.player.seekTo(clamped, true);
      } catch {
        // ignore
      }
    }
    this.emitTimeUpdate();
    if (this.duration > 0) {
      updateMediaSessionPosition(this.currentTime, this.duration, this.playbackRate);
    }
  }

  public fadeOut(seconds = 1, onComplete?: () => void): void {
    this.clearFadeTimer();
    const fadeMs = Math.max(0, Math.min(10, seconds)) * 1000;
    if (fadeMs <= 100 || typeof window === 'undefined' || !this.player || !this.playerReady) {
      this.pause();
      onComplete?.();
      return;
    }

    const startedAt = Date.now();
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / fadeMs);
      this.applyEffectiveVolume(Math.cos(progress * Math.PI * 0.5));
      if (progress >= 1) {
        this.clearFadeTimer();
        this.pause();
        this.applyEffectiveVolume(1);
        onComplete?.();
      }
    }, 40);
  }

  public unload(): void {
    this.activeLoadSeq++;
    this.clearFadeTimer();
    this.stopPolling();
    this.pendingLoad = null;
    if (this.player && this.playerReady) {
      try {
        this.player.stopVideo();
      } catch {
        // ignore
      }
    }
    this.currentTrack = null;
    this.currentTime = 0;
    this.duration = 0;
    this.playing = false;
    this.listeners.playstate.forEach((fn) => fn({ isPlaying: false }));
    this.emitTimeUpdate();
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getCurrentTime(): number {
    if (this.player && this.playerReady) {
      try {
        const ct = this.player.getCurrentTime();
        if (Number.isFinite(ct) && ct >= 0) return ct;
      } catch {
        // fallback
      }
    }
    return this.currentTime;
  }

  public getDuration(): number {
    if (this.player && this.playerReady) {
      try {
        const dur = this.player.getDuration();
        if (Number.isFinite(dur) && dur > 0) return dur;
      } catch {
        // fallback
      }
    }
    return this.duration;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number, muted = this.muted): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (!this.fadeTimer) {
      this.applyEffectiveVolume(1);
    }
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, rate));
    this.applyPlaybackRateToPlayer();
    if (this.duration > 0) {
      updateMediaSessionPosition(this.currentTime, this.duration, this.playbackRate);
    }
  }

  public async refreshMetadata(track: Track): Promise<void> {
    if (!this.currentTrack || this.currentTrack.id !== track.id) return;
    this.currentTrack = track;
    await updateMediaSessionTrackMetadata(track);
  }
}

export const youtubePlayer = new YouTubePlayerService();
export default youtubePlayer;
