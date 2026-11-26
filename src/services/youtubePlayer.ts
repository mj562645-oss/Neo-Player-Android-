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

class YouTubePlayerService {
  private currentTrack: Track | null = null;
  private playing = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 1;
  private fadeTimer: number | null = null;
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
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  public async loadTrack(
    track: Track,
    startSeconds = 0,
    autoplay = true,
    _fadeInSeconds = 0
  ): Promise<boolean> {
    this.clearFadeTimer();
    this.currentTrack = track;
    this.currentTime = Math.max(0, startSeconds || 0);
    this.duration = Math.max(0, track.duration || 0);
    this.volume = 1;

    this.listeners.loaded.forEach((fn) => fn({ duration: this.duration }));
    this.emitTimeUpdate();

    if (autoplay) {
      return this.play();
    }

    this.emitPlayState(false);
    return true;
  }

  public play(): boolean {
    if (!this.currentTrack) return false;
    this.clearFadeTimer();
    this.emitPlayState(true);
    this.emitTimeUpdate();
    return true;
  }

  public pause(): void {
    this.clearFadeTimer();
    if (this.playing) {
      this.emitPlayState(false);
    }
  }

  public seek(seconds: number): void {
    const safeSec = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    this.currentTime = this.duration > 0 ? Math.min(safeSec, this.duration) : safeSec;
    this.emitTimeUpdate();
  }

  public fadeOut(seconds = 1, onComplete?: () => void): void {
    this.clearFadeTimer();
    const delayMs = Math.max(0, Math.min(10, seconds)) * 1000;
    this.volume = 0;

    if (delayMs === 0 || typeof window === 'undefined') {
      this.emitPlayState(false);
      onComplete?.();
      return;
    }

    this.fadeTimer = window.setTimeout(() => {
      this.fadeTimer = null;
      this.emitPlayState(false);
      onComplete?.();
    }, delayMs);
  }

  public unload(): void {
    this.clearFadeTimer();
    this.currentTrack = null;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 1;
    this.emitPlayState(false);
    this.emitTimeUpdate();
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

export const youtubePlayer = new YouTubePlayerService();
export default youtubePlayer;
