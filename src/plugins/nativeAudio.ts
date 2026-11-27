import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { RepeatMode } from '../types/music';

export interface NativeAudioStatus {
  isPlaying: boolean;
  ended?: boolean;
  positionMs: number;
  durationMs: number;
}

export interface NativeMediaActionEvent {
  action: 'play' | 'pause' | 'next' | 'previous' | 'like' | 'repeat' | 'ended';
}

export interface NativePlaybackStateEvent {
  isPlaying: boolean;
  ended: boolean;
  positionMs: number;
  durationMs: number;
}

export interface NativeAudioPlugin {
  saveAudio(options: { trackId: string; fileName: string; base64: string }): Promise<{ uri: string; size: number }>;
  playLocal(options: {
    uri: string;
    title: string;
    artist: string;
    album?: string;
    artworkBase64?: string;
    positionMs?: number;
    autoplay?: boolean;
    volume?: number;
    muted?: boolean;
    playbackRate?: number;
    pauseOnBluetoothDisconnect?: boolean;
    isFavourite?: boolean;
    repeatMode?: RepeatMode;
    livePillNotification?: boolean;
  }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(options: { positionMs: number }): Promise<void>;
  stop(): Promise<void>;
  setPlaybackOptions(options: {
    volume?: number;
    muted?: boolean;
    playbackRate?: number;
    volumeNormalization?: boolean;
    pauseOnBluetoothDisconnect?: boolean;
    isFavourite?: boolean;
    repeatMode?: RepeatMode;
    livePillNotification?: boolean;
    eqEnabled?: boolean;
    eqBass?: number;
    eqMid?: number;
    eqTreble?: number;
  }): Promise<void>;
  updateMetadata(options: {
    title: string;
    artist: string;
    album?: string;
    artworkBase64?: string;
    isFavourite?: boolean;
    repeatMode?: RepeatMode;
    livePillNotification?: boolean;
  }): Promise<void>;
  getStatus(): Promise<NativeAudioStatus>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  previewLivePillNotification(options: {
    title: string;
    artist: string;
    artworkBase64?: string;
    isPlaying?: boolean;
    isFavourite?: boolean;
    repeatMode?: RepeatMode;
    promptPermission?: boolean;
  }): Promise<{ ok: boolean; permissionGranted: boolean }>;
  addListener(
    eventName: 'mediaAction',
    listenerFunc: (event: NativeMediaActionEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackState',
    listenerFunc: (event: NativePlaybackStateEvent) => void
  ): Promise<PluginListenerHandle>;
}

const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio');

export const isNativeAudioAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export default NativeAudio;
