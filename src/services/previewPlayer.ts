import { audioEngine } from './audioEngine';
import { youtubePlayer } from './youtubePlayer';
import type { DiscoveryTrackItem } from '../types/music';

export interface PreviewPlayerState {
  currentTrack: DiscoveryTrackItem | null;
  stationLabel: string;
  queue: DiscoveryTrackItem[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

type Listener = (state: PreviewPlayerState) => void;

class DiscoveryPreviewPlayer {
  private audio: HTMLAudioElement;
  private listeners = new Set<Listener>();
  private state: PreviewPlayerState = {
    currentTrack: null,
    stationLabel: '',
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 30,
  };

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      this.update({
        currentTime: this.audio.currentTime || 0,
        duration: Number.isFinite(this.audio.duration) && this.audio.duration > 0 ? this.audio.duration : 30,
      });
    });

    this.audio.addEventListener('play', () => {
      if (audioEngine.isPlaying()) {
        audioEngine.pause();
      }
      if (youtubePlayer.isPlaying()) {
        youtubePlayer.pause();
      }
      this.update({ isPlaying: true });
    });

    this.audio.addEventListener('pause', () => {
      this.update({ isPlaying: false });
    });

    this.audio.addEventListener('ended', () => {
      void this.next();
    });

    // If user resumes offline library or YouTube playback, stop preview stream automatically
    audioEngine.on('playstate', ({ isPlaying }) => {
      if (isPlaying && !this.audio.paused) {
        this.audio.pause();
      }
    });
    youtubePlayer.on('playstate', ({ isPlaying }) => {
      if (isPlaying && !this.audio.paused) {
        this.audio.pause();
      }
    });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getState(): PreviewPlayerState {
    return this.state;
  }

  private update(patch: Partial<PreviewPlayerState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  async playStation(
    items: DiscoveryTrackItem[],
    startIndex = 0,
    stationLabel = 'Tune In'
  ): Promise<boolean> {
    const playable = items.filter((item) => Boolean(item.previewUrl));
    if (playable.length === 0) return false;
    const requested = items[startIndex];
    const resolvedIdx = requested
      ? Math.max(
          0,
          playable.findIndex((i) => i.id === requested.id)
        )
      : 0;
    const track = playable[resolvedIdx];
    return this.loadAndPlay(track, playable, resolvedIdx, stationLabel);
  }

  async playSingle(item: DiscoveryTrackItem, label = 'Preview'): Promise<boolean> {
    if (!item.previewUrl) return false;
    return this.loadAndPlay(item, [item], 0, label);
  }

  private async loadAndPlay(
    track: DiscoveryTrackItem,
    queue: DiscoveryTrackItem[],
    index: number,
    stationLabel: string
  ): Promise<boolean> {
    if (!track.previewUrl) return false;
    if (audioEngine.isPlaying()) {
      audioEngine.pause();
    }
    if (youtubePlayer.isPlaying()) {
      youtubePlayer.pause();
    }
    this.audio.src = track.previewUrl;
    this.audio.currentTime = 0;
    this.update({
      currentTrack: track,
      queue,
      currentIndex: index,
      stationLabel,
      currentTime: 0,
      duration: 30,
    });
    try {
      await this.audio.play();
      return true;
    } catch {
      this.update({ isPlaying: false });
      return false;
    }
  }

  async togglePlay(): Promise<void> {
    if (!this.state.currentTrack) return;
    if (this.audio.paused) {
      if (audioEngine.isPlaying()) audioEngine.pause();
      if (youtubePlayer.isPlaying()) youtubePlayer.pause();
      try {
        await this.audio.play();
      } catch {
        this.update({ isPlaying: false });
      }
    } else {
      this.audio.pause();
    }
  }

  async next(): Promise<void> {
    const { queue, currentIndex, stationLabel } = this.state;
    if (queue.length === 0) {
      this.stop();
      return;
    }
    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) {
      await this.loadAndPlay(queue[nextIdx], queue, nextIdx, stationLabel);
    } else {
      this.update({ isPlaying: false, currentTime: 0 });
    }
  }

  async prev(): Promise<void> {
    const { queue, currentIndex, stationLabel } = this.state;
    if (queue.length === 0) return;
    const prevIdx = Math.max(0, currentIndex - 1);
    await this.loadAndPlay(queue[prevIdx], queue, prevIdx, stationLabel);
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.update({
      currentTrack: null,
      stationLabel: '',
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 30,
    });
  }
}

export const previewPlayer = new DiscoveryPreviewPlayer();
