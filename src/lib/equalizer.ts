import type { EqualizerSettings } from '../types/music';

export interface EqualizerPreset {
  id: string;
  name: string;
  description: string;
  bass: number;
  mid: number;
  treble: number;
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { id: 'flat', name: 'Flat', description: 'Neutral uncolored response', bass: 0, mid: 0, treble: 0 },
  { id: 'bass_boost', name: 'Bass Boost', description: 'Deep low-end punch', bass: 6.5, mid: -0.5, treble: 1 },
  { id: 'vocal_clarity', name: 'Vocal Clarity', description: 'Forward presence & crisp diction', bass: -2, mid: 4.5, treble: 2.5 },
  { id: 'acoustic', name: 'Acoustic', description: 'Natural warmth for strings & wood', bass: 3, mid: 2, treble: 3.5 },
  { id: 'electronic', name: 'Electronic', description: 'Tight sub-bass & sparkling highs', bass: 5.5, mid: -1.5, treble: 4.5 },
  { id: 'late_night', name: 'Late Night', description: 'Warm low-volume balance', bass: 3.5, mid: 1.5, treble: -2.5 },
  { id: 'treble_boost', name: 'Treble Boost', description: 'Airy shimmer & detail', bass: 0, mid: 1, treble: 6 },
  { id: 'studio', name: 'Studio', description: 'Gentle contour for detail', bass: 1.5, mid: 0.5, treble: 2 },
];

export const DEFAULT_EQUALIZER_SETTINGS: EqualizerSettings = {
  enabled: false,
  presetId: 'flat',
  bass: 0,
  mid: 0,
  treble: 0,
};

export function clampDb(val: number): number {
  return Math.max(-12, Math.min(12, Math.round(val * 2) / 2));
}

export function formatDb(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  if (Math.abs(rounded) < 0.05) return '0.0 dB';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} dB`;
}

export function findMatchingPresetId(bass: number, mid: number, treble: number): string {
  const match = EQUALIZER_PRESETS.find(
    (p) =>
      Math.abs(p.bass - bass) < 0.05 &&
      Math.abs(p.mid - mid) < 0.05 &&
      Math.abs(p.treble - treble) < 0.05
  );
  return match ? match.id : 'custom';
}
