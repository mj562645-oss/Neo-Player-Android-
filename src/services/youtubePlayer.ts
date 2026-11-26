export type YouTubePlayerState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type YouTubePlayerEvent =
  | 'stateChange'
  | 'timeUpdate'
  | 'durationChange'
  | 'error';

export type YouTubePlayerListener<T = unknown> = (payload: T) => void;

export interface YouTubePlayerLoadOptions {
  videoId: string;
  startSeconds?: number;
  autoplay?: boolean;
}

class YouTubePlayerService {
  private state: YouTubePlayerState = 'idle';
  private currentVideoId: string | null = null;
  private currentTime = 0;
  private duration = 0;
  private volume = 100;
  private muted = false;
  private listeners: Map<YouTubePlayerEvent, Set<YouTubePlayerListener<any>>> = new Map();

  public on<T = unknown>(event: YouTubePlayerEvent, listener: YouTubePlayerListener<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  public off<T = unknown>(event: YouTubePlayerEvent, listener: YouTubePlayerListener<T>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<T = unknown>(event: YouTubePlayerEvent, payload: T): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        // Ignore listener errors so playback flow continues
      }
    });
  }

  private setState(nextState: YouTubePlayerState): void {
    this.state = nextState;
    this.emit('stateChange', {
      state: this.state,
      videoId: this.currentVideoId,
    });
  }

  public async load(options: YouTubePlayerLoadOptions): Promise<void> {
    this.currentVideoId = options.videoId;
    this.currentTime = options.startSeconds ?? 0;
    this.duration = 0;
    this.setState('loading');
    this.emit('timeUpdate', { currentTime: this.currentTime, duration: this.duration });

    if (options.autoplay !== false) {
      await this.play();
    } else {
      this.setState('paused');
    }
  }

  public async play(): Promise<void> {
    if (!this.currentVideoId) return;
    this.setState('playing');
  }

  public async pause(): Promise<void> {
    if (this.state === 'playing' || this.state === 'loading') {
      this.setState('paused');
    }
  }

  public async stop(): Promise<void> {
    this.currentTime = 0;
    this.setState('idle');
    this.emit('timeUpdate', { currentTime: this.currentTime, duration: this.duration });
  }

  public async seekTo(seconds: number): Promise<void> {
    const safeTime = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    this.currentTime = this.duration > 0 ? Math.min(safeTime, this.duration) : safeTime;
    this.emit('timeUpdate', { currentTime: this.currentTime, duration: this.duration });
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, Math.round(volume)));
    if (this.volume > 0 && this.muted) {
      this.muted = false;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public mute(): void {
    this.muted = true;
  }

  public unmute(): void {
    this.muted = false;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getVideoId(): string | null {
    return this.currentVideoId;
  }

  public getState(): YouTubePlayerState {
    return this.state;
  }

  public destroy(): void {
    this.currentVideoId = null;
    this.currentTime = 0;
    this.duration = 0;
    this.setState('idle');
    this.listeners.clear();
  }
}

export const youtubePlayer = new YouTubePlayerService();
export default youtubePlayer;
