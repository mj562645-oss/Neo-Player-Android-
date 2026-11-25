import React, { useMemo } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useTheme } from '../app/ThemeContext';
import {
  EQUALIZER_PRESETS,
  clampDb,
  findMatchingPresetId,
  formatDb,
  type EqualizerPreset,
} from '../lib/equalizer';
import { cn } from '../lib/utils';
import { GlassButton } from './glass/GlassButton';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';

interface EqualizerPanelProps {
  compact?: boolean;
}

const BANDS: Array<{
  key: 'bass' | 'mid' | 'treble';
  label: string;
  freqLabel: string;
}> = [
  { key: 'bass', label: 'Bass', freqLabel: '120 Hz · Low Shelf' },
  { key: 'mid', label: 'Mid', freqLabel: '1 kHz · Presence' },
  { key: 'treble', label: 'Treble', freqLabel: '6.5 kHz · High Shelf' },
];

function dbToSvgY(db: number, height: number, padY: number): number {
  const clamped = clampDb(db);
  const ratio = (12 - clamped) / 24; // +12 dB -> top, -12 dB -> bottom
  return padY + ratio * (height - padY * 2);
}

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({ compact = false }) => {
  const { settings, updateEqualizer } = useTheme();
  const eq = settings.equalizer;

  const activePreset = useMemo(
    () => EQUALIZER_PRESETS.find((p) => p.id === eq.presetId),
    [eq.presetId]
  );

  const handleSelectPreset = (preset: EqualizerPreset) => {
    void updateEqualizer({
      enabled: true,
      presetId: preset.id,
      bass: preset.bass,
      mid: preset.mid,
      treble: preset.treble,
    });
  };

  const handleBandChange = (band: 'bass' | 'mid' | 'treble', nextVal: number) => {
    const val = clampDb(nextVal);
    const nextBass = band === 'bass' ? val : eq.bass;
    const nextMid = band === 'mid' ? val : eq.mid;
    const nextTreble = band === 'treble' ? val : eq.treble;
    void updateEqualizer({
      enabled: true,
      bass: nextBass,
      mid: nextMid,
      treble: nextTreble,
      presetId: findMatchingPresetId(nextBass, nextMid, nextTreble),
    });
  };

  const handleReset = () => {
    void updateEqualizer({
      presetId: 'flat',
      bass: 0,
      mid: 0,
      treble: 0,
    });
  };

  // Build smooth SVG frequency response curve
  const { strokePath, areaPath, points } = useMemo(() => {
    const w = 360;
    const h = 96;
    const padY = 14;
    const midY = dbToSvgY(0, h, padY);
    const bY = dbToSvgY(eq.enabled ? eq.bass : 0, h, padY);
    const mY = dbToSvgY(eq.enabled ? eq.mid : 0, h, padY);
    const tY = dbToSvgY(eq.enabled ? eq.treble : 0, h, padY);

    const pts = [
      { x: 0, y: bY },
      { x: 64, y: bY },
      { x: 180, y: mY },
      { x: 296, y: tY },
      { x: w, y: tY },
    ];

    const stroke = [
      `M ${pts[0].x} ${pts[0].y}`,
      `L ${pts[1].x} ${pts[1].y}`,
      `C 110 ${pts[1].y}, 134 ${pts[2].y}, ${pts[2].x} ${pts[2].y}`,
      `C 226 ${pts[2].y}, 250 ${pts[3].y}, ${pts[3].x} ${pts[3].y}`,
      `L ${pts[4].x} ${pts[4].y}`,
    ].join(' ');

    const area = `${stroke} L ${w} ${h} L 0 ${h} Z`;

    return {
      strokePath: stroke,
      areaPath: area,
      points: [
        { x: 64, y: bY, label: '120 Hz' },
        { x: 180, y: mY, label: '1 kHz' },
        { x: 296, y: tY, label: '6.5 kHz' },
      ],
      midY,
    };
  }, [eq.enabled, eq.bass, eq.mid, eq.treble]);

  const isFlat =
    Math.abs(eq.bass) < 0.05 && Math.abs(eq.mid) < 0.05 && Math.abs(eq.treble) < 0.05;

  return (
    <div className={cn('space-y-4', compact ? 'text-sm' : '')}>
      {/* Header & Power Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[var(--neo-accent-soft)] text-[var(--neo-accent)] flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {eq.enabled
                ? activePreset
                  ? `${activePreset.name} Preset`
                  : 'Custom Curve'
                : 'Equalizer Bypassed'}
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
              {eq.enabled
                ? activePreset?.description || 'Manual Bass, Mid & Treble tuning'
                : 'Enable to shape Bass, Mid, and Treble frequencies'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <GlassButton
            size="sm"
            variant="ghost"
            disabled={isFlat}
            onClick={handleReset}
            aria-label="Reset equalizer to Flat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </GlassButton>
          <Switch
            checked={eq.enabled}
            onCheckedChange={(checked) => void updateEqualizer({ enabled: checked })}
            aria-label="Enable audio equalizer"
          />
        </div>
      </div>

      {/* Live Frequency Curve Visualizer */}
      <div className="rounded-2xl liquid-glass-subtle p-3 overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#6E6E73] dark:text-[#98989D] mb-1 px-1">
          <span>+12 dB</span>
          <span>0 dB</span>
          <span>-12 dB</span>
        </div>
        <svg
          viewBox="0 0 360 96"
          className="w-full h-24 overflow-visible"
          role="img"
          aria-label={`Equalizer frequency curve: Bass ${formatDb(eq.bass)}, Mid ${formatDb(eq.mid)}, Treble ${formatDb(eq.treble)}`}
        >
          <defs>
            <linearGradient id="neo-eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neo-accent)" stopOpacity={eq.enabled ? 0.34 : 0.1} />
              <stop offset="100%" stopColor="var(--neo-accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Reference gridlines */}
          <line
            x1="0"
            y1="48"
            x2="360"
            y2="48"
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeDasharray="4 4"
          />
          {points.map((pt) => (
            <line
              key={pt.label}
              x1={pt.x}
              y1="8"
              x2={pt.x}
              y2="88"
              stroke="currentColor"
              strokeOpacity="0.08"
            />
          ))}

          {/* Filled curve */}
          <path d={areaPath} fill="url(#neo-eq-fill)" />
          <path
            d={strokePath}
            fill="none"
            stroke="var(--neo-accent)"
            strokeOpacity={eq.enabled ? 1 : 0.38}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Control nodes */}
          {points.map((pt) => (
            <circle
              key={pt.label}
              cx={pt.x}
              cy={pt.y}
              r="4.5"
              fill="var(--neo-accent)"
              fillOpacity={eq.enabled ? 1 : 0.45}
              stroke="white"
              strokeWidth="1.5"
            />
          ))}
        </svg>
        <div className="grid grid-cols-3 text-center text-[11px] font-mono-tabular text-[#6E6E73] dark:text-[#98989D] mt-1">
          <span>120 Hz</span>
          <span>1 kHz</span>
          <span>6.5 kHz</span>
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">Presets</p>
          {eq.presetId === 'custom' && (
            <span className="text-[11px] font-mono-tabular text-[var(--neo-accent)] font-medium">
              Custom
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EQUALIZER_PRESETS.map((preset) => {
            const active = eq.enabled && eq.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'min-h-[36px] px-3 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0',
                  active
                    ? 'bg-[var(--neo-accent)] text-white shadow-sm'
                    : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
                )}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Frequency Band Sliders */}
      <div className="space-y-3 pt-1">
        {BANDS.map((band) => {
          const val = eq[band.key];
          return (
            <div
              key={band.key}
              className="rounded-2xl liquid-glass-subtle px-3.5 py-2.5 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-sm font-semibold">{band.label}</span>
                  <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
                    {band.freqLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleBandChange(band.key, 0)}
                  title={`Reset ${band.label} to 0 dB`}
                  className={cn(
                    'text-xs font-mono-tabular px-2 py-0.5 rounded-lg transition-colors cursor-pointer shrink-0',
                    Math.abs(val) > 0.05 && eq.enabled
                      ? 'text-[var(--neo-accent)] font-semibold hover:bg-black/5 dark:hover:bg-white/10'
                      : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white'
                  )}
                >
                  {formatDb(val)}
                </button>
              </div>
              <div className="relative flex items-center gap-2.5">
                <span className="text-[10px] font-mono-tabular text-[#8E8E93] w-7 shrink-0">
                  -12
                </span>
                <div className="relative flex-1">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-black/20 dark:bg-white/25 rounded-full"
                  />
                  <Slider
                    aria-label={`${band.label} frequency gain in dB`}
                    min={-12}
                    max={12}
                    step={0.5}
                    value={[val]}
                    onValueChange={(vals) => handleBandChange(band.key, vals[0] ?? 0)}
                    rangeClassName={eq.enabled ? 'bg-[var(--neo-accent)]' : undefined}
                  />
                </div>
                <span className="text-[10px] font-mono-tabular text-[#8E8E93] w-7 text-right shrink-0">
                  +12
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
