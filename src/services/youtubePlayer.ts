import { audioEngine } from './audioEngine';
import type { Track } from '../types/music';

interface YTPlayerInstance {
  loadVideoById: (options: { videoId: string; startSeconds?: number } | string, startSeconds?: number) => void;
  cueVideoById: (options: { videoId: string; startSeconds?: number } | string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    elementId: string | HTMLElement,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: {
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
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubePlayerEvents = {
  timeupdate: { currentTime: number; duration: number };
  playstate: { isPlaying: boolean };
  ended: void;
  error: { message: string };
  loaded: { duration: number };
};

type Listener<K extends keyof YouTubePlayerEvents> = (payload: YouTubePlayerEvents[K]) => void;

const PLAYER_HOST_ID = 'neo-youtube-iframe-host';

class YouTubePlayerEngine {
  private player: YTPlayerInstance | null = null;
  private apiPromise: Promise<YTNamespace> | null = null;
  private playerReadyPromise: Promise<YTPlayerInstance> | null = null;
  private listeners: { [K in keyof YouTubePlayerEvents]?: Set<Listener<K>> } = {};
  private timeTimer: number | null = null;
  private activeTrack: Track | null = null;
  private isPlayingFlag = false;
  private baseVolume = 0.85;
  private isMuted = false;
  private playbackRate = 1;
  private fadeMultiplier = 1;
  private fadeTimer: number | null = null;
  private allowCoplayDuringFade = false;

  on<K extends keyof YouTubePlayerEvents>(event: K, fn: Listener<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as never;
    }
    const set = this.listeners[event] as Set<Listener<K>>;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  private emit<K extends keyof YouTubePlayerEvents>(
    event: K,
    payload: YouTubePlayerEvents[K]
  ): void {
    const set = this.listeners[event] as Set<Listener<K>> | undefined;
    if (!set) return;
    for (const fn of set) {
      fn(payload);
    }
  }

  private ensureHostElement(): HTMLElement {
    let host = document.getElementById(PLAYER_HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = PLAYER_HOST_ID;
      host.setAttribute('aria-hidden', 'true');
      host.style.position = 'fixed';
      host.style.left = '-9999px';
      host.style.top = '0';
      host.style.width = '1px';
      host.style.height = '1px';
      host.style.opacity = '0.001';
      host.style.pointerEvents = 'none';
      document.body.appendChild(host);
    }
    return host;
  }

  private loadIframeApi(): Promise<YTNamespace> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('YouTube player requires a browser environment.'));
    }
    if (window.YT?.Player) {
      return Promise.resolve(window.YT);
    }
    if (this.apiPromise) return this.apiPromise;

    this.apiPromise = new Promise<YTNamespace>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        this.apiPromise = null;
        reject(new Error('Timed out loading YouTube player. Check your connection.'));
      }, 15000);

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (window.YT?.Player) {
          resolve(window.YT);
        } else {
          this.apiPromise = null;
          reject(new Error('YouTube IFrame API failed to initialize.'));
        }
      };

      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (existing) {
        existing.addEventListener(
          'error',
          () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            this.apiPromise = null;
            reject(new Error('Failed to load YouTube playback script. Check internet connection.'));
          },
          { once: true }
        );
      } else {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          this.apiPromise = null;
          reject(new Error('Failed to load YouTube playback script. Check internet connection.'));
        };
        document.head.appendChild(script);
      }
    });

    return this.apiPromise;
  }

  private async ensurePlayer(): Promise<YTPlayerInstance> {
    if (this.player) return this.player;
    if (this.playerReadyPromise) return this.playerReadyPromise;

    this.playerReadyPromise = (async () => {
      const YT = await this.loadIframeApi();
      const host = this.ensureHostElement();
      const origin =
        typeof window !== 'undefined' && window.location.origin.startsWith('http')
          ? window.location.origin
          : undefined;

      return await new Promise<YTPlayerInstance>((resolve, reject) => {
        let settled = false;
        const initTimeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('YouTube player did not become ready in time.'));
        }, 12000);

        let instance: YTPlayerInstance | null = null;
        try {
          instance = new YT.Player(host, {
            height: '1',
            width: '1',
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
              ...(origin ? { origin } : {}),
            },
            events: {
              onReady: (ev) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(initTimeout);
                this.player = ev.target;
                this.applyAudioParams();
                resolve(ev.target);
              },
              onStateChange: (ev) => {
                const state = ev.data;
                const YTStates = window.YT?.PlayerState;
                if (!YTStates) return;

                if (state === YTStates.PLAYING) {
                  if (
                    audioEngine.isPlaying() &&
                    !this.allowCoplayDuringFade &&
                    !audioEngine.isFadingOut()
                  ) {
                    audioEngine.pause();
                  }
                  this.allowCoplayDuringFade = false;
                  this.isPlayingFlag = true;
                  this.startTimePolling();
                  this.emit('playstate', { isPlaying: true });
                  const dur = this.getDuration();
                  if (dur > 0) {
                    this.emit('loaded', { duration: dur });
                  }
                  if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                  }
                } else if (state === YTStates.PAUSED || state === YTStates.CUED) {
                  this.isPlayingFlag = false;
                  this.stopTimePolling();
                  this.emit('playstate', { isPlaying: false });
                  if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                  }
                } else if (state === YTStates.ENDED) {
                  this.isPlayingFlag = false;
                  this.stopTimePolling();
                  this.emit('playstate', { isPlaying: false });
                  this.emit('ended', undefined);
                }
              },
              onError: (ev) => {
                this.isPlayingFlag = false;
                this.stopTimePolling();
                this.emit('playstate', { isPlaying: false });
                const code = ev.data;
                const message =
                  code === 101 || code === 150
                    ? 'The rights holder restricted embedded playback for this YouTube track.'
                    : code === 100
                      ? 'This YouTube track is unavailable or removed.'
                      : 'Unable to stream this YouTube track right now.';
                if (!settled) {
                  settled = true;
                  window.clearTimeout(initTimeout);
                  try {
                    instance?.destroy();
                  } catch {
                    // ignore cleanup failure
                  }
                  reject(new Error(message));
                  return;
                }
                this.emit('error', { message });
              },
            },
          });
        } catch (err) {
          if (!settled) {
            settled = true;
            window.clearTimeout(initTimeout);
            reject(err instanceof Error ? err : new Error('Failed to initialize YouTube player.'));
          }
        }
      });
    })();

    try {
      return await this.playerReadyPromise;
    } catch (err) {
      this.playerReadyPromise = null;
      this.player = null;
      throw err;
    }
  }

  private startTimePolling(): void {
    this.stopTimePolling();
    this.timeTimer = window.setInterval(() => {
      if (!this.player) return;
      const ct = this.getCurrentTime();
      const dur = this.getDuration();
      this.emit('timeupdate', { currentTime: ct, duration: dur });
      this.updateMediaSessionPosition(ct, dur);
    }, 250);
  }

  private stopTimePolling(): void {
    if (this.timeTimer !== null) {
      window.clearInterval(this.timeTimer);
      this.timeTimer = null;
    }
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private applyAudioParams(): void {
    if (!this.player) return;
    try {
      const effectiveVol = Math.max(0, Math.min(1, this.baseVolume * this.fadeMultiplier));
      this.player.setVolume(Math.round(effectiveVol * 100));
      if (this.isMuted || this.baseVolume === 0) {
        this.player.mute();
      } else {
        this.player.unMute();
      }
      this.player.setPlaybackRate(this.playbackRate);
    } catch {
      // ignore if player not yet cued
    }
  }

  private updateMediaSessionMetadata(track: Track): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'YouTube Music',
        artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: '480x360' }] : [],
      });
    } catch {
      // ignore
    }
  }

  private updateMediaSessionPosition(position: number, duration: number): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.playbackRate || 1,
        position: Math.min(duration, Math.max(0, position || 0)),
      });
    } catch {
      // ignore
    }
  }

  async loadTrack(
    track: Track,
    startPosition = 0,
    autoplay = true,
    crossfadeInSeconds = 0
  ): Promise<boolean> {
    if (!track.youtubeVideoId) {
      this.emit('error', { message: 'Missing YouTube video ID for this track.' });
      return false;
    }

    this.clearFadeTimer();
    const blendingFromLocal = crossfadeInSeconds > 0.1 && audioEngine.isFadingOut();
    this.allowCoplayDuringFade = blendingFromLocal;
    if (!blendingFromLocal && audioEngine.isPlaying()) {
      audioEngine.pause();
    }

    this.fadeMultiplier = crossfadeInSeconds > 0.1 && autoplay ? 0.05 : 1;

    try {
      const player = await this.ensurePlayer();
      this.activeTrack = track;
      this.updateMediaSessionMetadata(track);

      if (autoplay) {
        player.loadVideoById({
          videoId: track.youtubeVideoId,
          startSeconds: Math.max(0, startPosition),
        });
        if (crossfadeInSeconds > 0.1) {
          this.fadeIn(crossfadeInSeconds);
        }
      } else {
        player.cueVideoById({
          videoId: track.youtubeVideoId,
          startSeconds: Math.max(0, startPosition),
        });
      }
      this.applyAudioParams();
      return true;
    } catch (err) {
      this.fadeMultiplier = 1;
      this.allowCoplayDuringFade = false;
      this.emit('error', {
        message: err instanceof Error ? err.message : 'Unable to start YouTube playback.',
      });
      return false;
    }
  }

  fadeIn(durationSeconds: number): void {
    this.clearFadeTimer();
    if (durationSeconds <= 0.1) {
      this.fadeMultiplier = 1;
      this.applyAudioParams();
      return;
    }
    const fadeMs = Math.max(400, Math.round(durationSeconds * 1000));
    const startedAt = Date.now();
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / fadeMs);
      this.fadeMultiplier = Math.sin(progress * Math.PI * 0.5);
      this.applyAudioParams();
      if (progress >= 1) {
        this.clearFadeTimer();
        this.fadeMultiplier = 1;
        this.applyAudioParams();
      }
    }, 60);
  }

  fadeOut(durationSeconds: number, onComplete?: () => void): void {
    this.clearFadeTimer();
    if (durationSeconds <= 0.1 || !this.isPlayingFlag) {
      this.pause();
      onComplete?.();
      return;
    }
    const fadeMs = Math.max(400, Math.round(durationSeconds * 1000));
    const startedAt = Date.now();
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / fadeMs);
      this.fadeMultiplier = Math.cos(progress * Math.PI * 0.5);
      this.applyAudioParams();
      if (progress >= 1) {
        this.clearFadeTimer();
        this.pause();
        this.fadeMultiplier = 1;
        this.applyAudioParams();
        onComplete?.();
      }
    }, 60);
  }

  play(): boolean {
    if (!this.player || !this.activeTrack) return false;
    this.clearFadeTimer();
    this.fadeMultiplier = 1;
    this.applyAudioParams();
    if (audioEngine.isPlaying()) {
      audioEngine.pause();
    }
    try {
      this.player.playVideo();
      return true;
    } catch {
      return false;
    }
  }

  pause(): void {
    this.clearFadeTimer();
    this.fadeMultiplier = 1;
    this.allowCoplayDuringFade = false;
    if (!this.player) return;
    try {
      this.player.pauseVideo();
    } catch {
      // ignore
    }
    this.isPlayingFlag = false;
    this.stopTimePolling();
    this.applyAudioParams();
    this.emit('playstate', { isPlaying: false });
  }

  seek(seconds: number): void {
    this.clearFadeTimer();
    this.fadeMultiplier = 1;
    this.applyAudioParams();
    if (!this.player) return;
    const dur = this.getDuration();
    const target = Math.max(0, dur > 0 ? Math.min(dur, seconds) : seconds);
    try {
      this.player.seekTo(target, true);
      this.emit('timeupdate', { currentTime: target, duration: dur });
      this.updateMediaSessionPosition(target, dur);
    } catch {
      // ignore
    }
  }

  setVolume(volume: number, muted = false): void {
    this.baseVolume = Math.max(0, Math.min(1, volume));
    this.isMuted = muted;
    this.applyAudioParams();
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, rate));
    this.applyAudioParams();
  }

  getCurrentTime(): number {
    if (!this.player) return 0;
    try {
      const t = this.player.getCurrentTime();
      return Number.isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  }

  getDuration(): number {
    if (!this.player) return this.activeTrack?.duration || 0;
    try {
      const d = this.player.getDuration();
      return Number.isFinite(d) && d > 0 ? d : this.activeTrack?.duration || 0;
    } catch {
      return this.activeTrack?.duration || 0;
    }
  }

  isPlaying(): boolean {
    return this.isPlayingFlag;
  }

  unload(): void {
    this.clearFadeTimer();
    this.fadeMultiplier = 1;
    this.allowCoplayDuringFade = false;
    this.stopTimePolling();
    this.isPlayingFlag = false;
    this.activeTrack = null;
    if (this.player) {
      try {
        this.player.stopVideo();
      } catch {
        // ignore
      }
    }
    this.emit('playstate', { isPlaying: false });
    this.emit('timeupdate', { currentTime: 0, duration: 0 });
  }
}

export const youtubePlayer = new YouTubePlayerEngine();
