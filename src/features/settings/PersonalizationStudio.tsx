import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Disc3,
  Download,
  ImagePlus,
  Palette,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { useToast } from '../../app/ToastContext';
import { useArtworkUrl } from '../../hooks/useDominantColor';
import {
  BUILT_IN_PALETTES,
  FONT_PRESETS,
  getFontPresetMeta,
  getPalettesForTheme,
  getUiThemeMeta,
  resolveActivePalette,
  STUDIO_GRADIENTS,
  UI_THEMES,
} from '../../lib/palettes';
import { cn, createId } from '../../lib/utils';
import type {
  AppPalette,
  ArtworkDisplayStyle,
  BackgroundStyleMode,
  CornerRadiusPreset,
  FontStylePreset,
  GlassStylePreset,
  PersonalizationSettings,
  UiThemeId,
} from '../../types/music';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassModal } from '../../components/glass/GlassModal';
import { Slider } from '../../components/ui/slider';
import { Switch } from '../../components/ui/switch';

export const PersonalizationStudio: React.FC<{ onBack?: () => void }> = ({
  onBack,
}) => {
  const {
    settings,
    resolvedTheme,
    updatePersonalization,
    upsertCustomPalette,
    deleteCustomPalette,
    uploadBackgroundImage,
    removeBackgroundImage,
    resetPersonalization,
  } = useTheme();
  const { showToast } = useToast();

  const p = settings.personalization;
  const activeUiTheme = p.uiTheme || 'neo';
  const activeThemeMeta = getUiThemeMeta(activeUiTheme);
  const activeFontMeta = getFontPresetMeta(p.fontStyle);
  const activePalette = resolveActivePalette(p);
  const bgImageUrl = useArtworkUrl(p.backgroundImageId);

  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const presetInputRef = useRef<HTMLInputElement | null>(null);

  const [paletteModalOpen, setPaletteModalOpen] = useState(false);
  const [showAllThemePalettes, setShowAllThemePalettes] = useState(false);
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [paletteName, setPaletteName] = useState('');
  const [paletteAccent, setPaletteAccent] = useState('#FF2D55');
  const [paletteSecondary, setPaletteSecondary] = useState('#5E5CE6');

  const themeBuiltInPalettes = showAllThemePalettes
    ? BUILT_IN_PALETTES
    : getPalettesForTheme(activeUiTheme);
  const visiblePalettes = [...themeBuiltInPalettes, ...(p.customPalettes || [])];

  const handleSelectUiTheme = async (themeId: UiThemeId) => {
    const meta = getUiThemeMeta(themeId);
    const isUsingCustomPalette = (p.customPalettes || []).some(
      (pal) => pal.id === p.activePaletteId
    );
    const currentBuiltInMatchesTheme = getPalettesForTheme(themeId).some(
      (pal) => pal.id === p.activePaletteId
    );

    const nextPaletteId = isUsingCustomPalette
      ? p.activePaletteId
      : currentBuiltInMatchesTheme
        ? p.activePaletteId
        : meta.defaultPaletteId;

    await updatePersonalization({
      uiTheme: themeId,
      activePaletteId: nextPaletteId,
      glassStyle: meta.defaultGlassStyle,
      cornerStyle: meta.defaultCornerStyle,
      fontStyle: meta.defaultFontStyle,
    });
    showToast(`Switched to ${meta.name} theme`, 'success');
  };

  const openCreatePalette = () => {
    setEditingPaletteId(null);
    setPaletteName('');
    setPaletteAccent(activePalette.accent);
    setPaletteSecondary(activePalette.secondary);
    setPaletteModalOpen(true);
  };

  const openEditPalette = (pal: AppPalette) => {
    setEditingPaletteId(pal.id);
    setPaletteName(pal.name);
    setPaletteAccent(pal.accent);
    setPaletteSecondary(pal.secondary);
    setPaletteModalOpen(true);
  };

  const handleSavePalette = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paletteName.trim()) return;
    await upsertCustomPalette({
      id: editingPaletteId || createId('pal'),
      name: paletteName.trim(),
      accent: paletteAccent,
      secondary: paletteSecondary,
      themeId: activeUiTheme,
      isBuiltIn: false,
    });
    setPaletteModalOpen(false);
    showToast(`Applied "${paletteName.trim()}" palette`, 'success');
  };

  const handleExportPreset = () => {
    const { backgroundImageId: _omit, ...exportable } = p;
    const json = JSON.stringify({ app: 'Neo Player', version: 1, personalization: exportable }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neo-player-style-${activePalette.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPreset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as { personalization?: Partial<PersonalizationSettings> };
      if (!raw.personalization) throw new Error('Invalid style file');
      await updatePersonalization(raw.personalization);
      showToast('Imported custom style preset', 'success');
    } catch {
      showToast('Could not read style preset JSON', 'error');
    }
    e.target.value = '';
  };

  const activeGradient =
    p.backgroundGradientId === 'custom'
      ? {
          from: p.customGradientFrom,
          to: p.customGradientTo,
          angle: p.customGradientAngle,
        }
      : STUDIO_GRADIENTS.find((g) => g.id === p.backgroundGradientId) || STUDIO_GRADIENTS[0];

  return (
    <GlassCard className="p-5 sm:p-6 space-y-6">
      <input
        ref={wallpaperInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void uploadBackgroundImage(f).then(() =>
              showToast('Background image saved offline', 'success')
            );
          }
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={presetInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportPreset}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <GlassButton size="sm" variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
              <span>Settings</span>
            </GlassButton>
          )}
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: 'var(--neo-accent)' }} />
            <div>
              <h2 className="text-base font-semibold font-display">Personalization Studio</h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                Design themes, color palettes, modern fonts, and custom backgrounds
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GlassButton size="sm" onClick={handleExportPreset}>
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Style</span>
          </GlassButton>
          <GlassButton size="sm" onClick={() => presetInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </GlassButton>
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={() => {
              void resetPersonalization();
              showToast('Reset to default Liquid Glass style', 'info');
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </GlassButton>
        </div>
      </div>

      {/* Live Preview Strip */}
      <div
        className="relative overflow-hidden p-4 sm:p-5 border border-black/8 dark:border-white/10"
        style={{
          borderRadius: 'var(--neo-radius-card)',
          background:
            p.backgroundMode === 'gradient'
              ? `linear-gradient(${activeGradient.angle}deg, ${activeGradient.from}, ${activeGradient.to})`
              : p.backgroundMode === 'image' && bgImageUrl
                ? `url(${bgImageUrl}) center/cover no-repeat`
                : `radial-gradient(circle at 20% 20%, ${activePalette.accent}35, transparent 60%), radial-gradient(circle at 85% 80%, ${activePalette.secondary}30, transparent 60%)`,
        }}
      >
        {p.backgroundMode === 'image' && bgImageUrl && (
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${Math.min(18, p.backgroundBlur)}px)`,
              backgroundColor: `rgba(0, 0, 0, ${p.backgroundDim / 120})`,
            }}
          />
        )}
        <div className="relative z-10 liquid-glass p-3.5 flex items-center justify-between gap-4 neo-card-radius">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'w-10 h-10 flex items-center justify-center text-white shrink-0',
                p.artworkStyle === 'vinyl' ? 'rounded-full' : 'rounded-xl'
              )}
              style={{ backgroundColor: activePalette.accent }}
            >
              <Disc3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold font-display truncate">
                {activeThemeMeta.name} · {activePalette.name}
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#AEAEB2] truncate">
                {activeFontMeta.name} · {p.cornerStyle} corners
              </p>
            </div>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1.5 neo-btn-radius text-white shrink-0"
            style={{ backgroundColor: activePalette.accent }}
          >
            Preview
          </span>
        </div>
      </div>

      {/* Section 0: UI Design Theme (Neo Player, Material UI, Windows) */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">App Design Theme</p>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
            Switch seamlessly between Neo Glass, Google Material Design 3, and Windows 11 Fluent
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {UI_THEMES.map((theme) => {
            const selected = activeUiTheme === theme.id;
            const themePalettes = getPalettesForTheme(theme.id);
            const sigPalette = themePalettes[0];
            const cardRadius =
              theme.id === 'windows'
                ? '8px'
                : theme.id === 'material'
                  ? '22px'
                  : '20px';
            const btnRadius =
              theme.id === 'windows'
                ? '5px'
                : theme.id === 'material'
                  ? '9999px'
                  : '12px';

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => void handleSelectUiTheme(theme.id)}
                className={cn(
                  'text-left p-3.5 neo-card-radius liquid-glass-subtle transition-all cursor-pointer flex flex-col gap-3',
                  selected
                    ? 'ring-2 ring-[var(--neo-accent)] shadow-md'
                    : 'hover:brightness-105'
                )}
              >
                {/* Mini Theme Surface Preview */}
                <div
                  className="w-full h-16 p-2.5 flex items-center justify-between border border-black/8 dark:border-white/10 overflow-hidden"
                  style={{
                    borderRadius: cardRadius,
                    background:
                      resolvedTheme === 'dark' ? theme.previewBgDark : theme.previewBgLight,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-7 h-7 flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{
                        borderRadius: btnRadius,
                        backgroundColor: sigPalette?.accent || '#FF2D55',
                      }}
                    >
                      ♪
                    </span>
                    <div className="space-y-1">
                      <span className="block w-12 h-2 rounded-full bg-[#111216]/25 dark:bg-white/30" />
                      <span className="block w-8 h-1.5 rounded-full bg-[#111216]/15 dark:bg-white/15" />
                    </div>
                  </div>
                  <div className="flex items-center -space-x-1 shrink-0">
                    {themePalettes.slice(0, 3).map((tp) => (
                      <span
                        key={tp.id}
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-white dark:ring-black/50"
                        style={{ backgroundColor: tp.accent }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold font-display truncate">{theme.name}</p>
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
                      {theme.tagline}
                    </p>
                  </div>
                  {selected && (
                    <span className="w-5 h-5 rounded-full bg-[var(--neo-accent)] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 1: App Palettes & Custom Palette Builder */}
      <div className="space-y-3 pt-3 border-t border-black/8 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              {showAllThemePalettes ? 'All Theme Palettes' : `${activeThemeMeta.name} Palettes`}
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              {showAllThemePalettes
                ? 'Showing palettes across Neo Player, Material UI, and Windows'
                : `Curated accent & surface palettes tailored for ${activeThemeMeta.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() => setShowAllThemePalettes((v) => !v)}
            >
              <span>{showAllThemePalettes ? 'Current Theme Only' : 'All Themes'}</span>
            </GlassButton>
            <GlassButton size="sm" onClick={openCreatePalette}>
              <Plus className="w-3.5 h-3.5" />
              <span>Create Palette</span>
            </GlassButton>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {visiblePalettes.map((pal) => {
            const active = pal.id === p.activePaletteId;
            return (
              <div
                key={pal.id}
                className={cn(
                  'relative flex items-center justify-between gap-2 p-3 neo-btn-radius liquid-glass-subtle transition-all',
                  active && 'ring-2'
                )}
                style={active ? { borderColor: pal.accent, boxShadow: `0 0 0 2px ${pal.accent}` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => void updatePersonalization({ activePaletteId: pal.id })}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className="flex items-center -space-x-1.5 shrink-0">
                    <span
                      className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-[#181920]"
                      style={{ backgroundColor: pal.accent }}
                    />
                    <span
                      className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-[#181920]"
                      style={{ backgroundColor: pal.secondary }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold truncate">{pal.name}</span>
                    {showAllThemePalettes && pal.themeId && (
                      <span className="block text-[10px] text-[#6E6E73] dark:text-[#98989D] truncate">
                        {getUiThemeMeta(pal.themeId).name}
                      </span>
                    )}
                  </span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {active && <Check className="w-3.5 h-3.5" style={{ color: pal.accent }} />}
                  {!pal.isBuiltIn && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditPalette(pal)}
                        aria-label={`Edit ${pal.name}`}
                        className="p-1 text-[#6E6E73] hover:text-[#111216] dark:hover:text-white cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCustomPalette(pal.id)}
                        aria-label={`Delete ${pal.name}`}
                        className="p-1 text-[#6E6E73] hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Background Style & Custom Image */}
      <div className="space-y-4 pt-3 border-t border-black/8 dark:border-white/10">
        <div className="p-3.5 neo-btn-radius liquid-glass-subtle flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Now Playing Album Art Background</p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Use the playing track&apos;s album artwork behind Now Playing, adapted to your Light/Dark mode and {activeThemeMeta.name} theme
            </p>
          </div>
          <Switch
            checked={p.nowPlayingArtworkBackground ?? true}
            onCheckedChange={(checked) =>
              void updatePersonalization({ nowPlayingArtworkBackground: checked })
            }
            aria-label="Now Playing album art background"
          />
        </div>

        <div className="p-3.5 neo-btn-radius liquid-glass-subtle flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Bottom Media Pill</p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Float a compact pill mini player with Like and Repeat controls
            </p>
          </div>
          <Switch
            checked={p.liveMediaPill ?? true}
            onCheckedChange={(checked) =>
              void updatePersonalization({ liveMediaPill: checked })
            }
            aria-label="Bottom media pill"
          />
        </div>

        <p className="text-sm font-semibold">App Background Style</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'ambient', label: 'Palette Mesh' },
              { id: 'artwork', label: 'Now Playing Art' },
              { id: 'gradient', label: 'Studio Gradient' },
              { id: 'image', label: 'Custom Image' },
            ] as { id: BackgroundStyleMode; label: string }[]
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                if (mode.id === 'image' && !p.backgroundImageId) {
                  wallpaperInputRef.current?.click();
                } else {
                  void updatePersonalization({ backgroundMode: mode.id });
                }
              }}
              className={cn(
                'min-h-[42px] px-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer',
                p.backgroundMode === mode.id
                  ? 'text-white shadow-sm'
                  : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2]'
              )}
              style={
                p.backgroundMode === mode.id
                  ? { backgroundColor: 'var(--neo-accent)' }
                  : undefined
              }
            >
              {mode.label}
            </button>
          ))}
        </div>

        {p.backgroundMode === 'gradient' && (
          <div className="space-y-3 p-4 rounded-2xl liquid-glass-subtle">
            <div className="flex flex-wrap gap-2">
              {STUDIO_GRADIENTS.map((g) => {
                const selected = p.backgroundGradientId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => void updatePersonalization({ backgroundGradientId: g.id })}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer border',
                      selected
                        ? 'border-white ring-2 ring-[var(--neo-accent)]'
                        : 'border-black/10 dark:border-white/10'
                    )}
                    style={{
                      background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`,
                      color: '#fff',
                    }}
                  >
                    <span>{g.name}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void updatePersonalization({ backgroundGradientId: 'custom' })}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer liquid-glass',
                  p.backgroundGradientId === 'custom' && 'ring-2 ring-[var(--neo-accent)]'
                )}
              >
                Custom Gradient
              </button>
            </div>

            {p.backgroundGradientId === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center justify-between gap-2 text-xs font-medium">
                  <span>Start Color</span>
                  <input
                    type="color"
                    value={p.customGradientFrom}
                    onChange={(e) =>
                      void updatePersonalization({ customGradientFrom: e.target.value })
                    }
                    className="w-10 h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs font-medium">
                  <span>End Color</span>
                  <input
                    type="color"
                    value={p.customGradientTo}
                    onChange={(e) =>
                      void updatePersonalization({ customGradientTo: e.target.value })
                    }
                    className="w-10 h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  <div className="flex justify-between">
                    <span>Angle</span>
                    <span className="font-mono-tabular">{p.customGradientAngle}°</span>
                  </div>
                  <Slider
                    min={0}
                    max={360}
                    step={5}
                    value={[p.customGradientAngle]}
                    onValueChange={(v) =>
                      void updatePersonalization({ customGradientAngle: v[0] ?? 135 })
                    }
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {(p.backgroundMode === 'image' || p.backgroundImageId) && (
          <div className="p-4 rounded-2xl liquid-glass-subtle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {bgImageUrl ? (
                  <img
                    src={bgImageUrl}
                    alt="Custom background wallpaper"
                    className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center">
                    <ImagePlus className="w-5 h-5 text-[#8E8E93]" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">Custom Wallpaper</p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                    Stored offline on your device
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <GlassButton size="sm" onClick={() => wallpaperInputRef.current?.click()}>
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{bgImageUrl ? 'Replace' : 'Upload Image'}</span>
                </GlassButton>
                {bgImageUrl && (
                  <GlassButton
                    size="sm"
                    onClick={() => void removeBackgroundImage()}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </GlassButton>
                )}
              </div>
            </div>

            {bgImageUrl && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Wallpaper Blur</span>
                    <span className="font-mono-tabular">{p.backgroundBlur}px</span>
                  </div>
                  <Slider
                    min={0}
                    max={40}
                    step={1}
                    value={[p.backgroundBlur]}
                    onValueChange={(v) =>
                      void updatePersonalization({ backgroundBlur: v[0] ?? 12 })
                    }
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Contrast Scrim</span>
                    <span className="font-mono-tabular">{p.backgroundDim}%</span>
                  </div>
                  <Slider
                    min={10}
                    max={85}
                    step={5}
                    value={[p.backgroundDim]}
                    onValueChange={(v) =>
                      void updatePersonalization({ backgroundDim: v[0] ?? 45 })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Surfaces, Corners, Font & Vinyl Style */}
      <div
        className={cn(
          'grid grid-cols-1 gap-5 pt-3 border-t border-black/8 dark:border-white/10',
          activeUiTheme === 'neo' && 'sm:grid-cols-2'
        )}
      >
        {activeUiTheme === 'neo' ? (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Glass Surface Material</span>
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['frosted', 'clear', 'tinted', 'solid'] as GlassStylePreset[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => void updatePersonalization({ glassStyle: style })}
                  className={cn(
                    'min-h-[38px] rounded-xl text-xs font-medium capitalize cursor-pointer transition-colors',
                    p.glassStyle === style
                      ? 'text-white'
                      : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2]'
                  )}
                  style={
                    p.glassStyle === style
                      ? { backgroundColor: 'var(--neo-accent)' }
                      : undefined
                  }
                >
                  {style}
                </button>
              ))}
            </div>
            {p.glassStyle !== 'solid' && (
              <div className="pt-1">
                <div className="flex justify-between text-xs font-medium mb-0.5">
                  <span>Glass Blur</span>
                  <span className="font-mono-tabular">{p.glassBlur}px</span>
                </div>
                <Slider
                  min={12}
                  max={42}
                  step={2}
                  value={[p.glassBlur]}
                  onValueChange={(v) => void updatePersonalization({ glassBlur: v[0] ?? 28 })}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
            {activeThemeMeta.name} uses opaque, blur-free surfaces for a clean look and smoother
            rendering.
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D]">
              Corner Geometry
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['sharp', 'balanced', 'pillowy'] as CornerRadiusPreset[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void updatePersonalization({ cornerStyle: c })}
                  className={cn(
                    'min-h-[38px] rounded-xl text-xs font-medium capitalize cursor-pointer transition-colors',
                    p.cornerStyle === c
                      ? 'text-white'
                      : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2]'
                  )}
                  style={
                    p.cornerStyle === c
                      ? { backgroundColor: 'var(--neo-accent)' }
                      : undefined
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1">
              <Disc3 className="w-3.5 h-3.5" />
              <span>Player Artwork</span>
            </p>
            <select
              aria-label="Player artwork display style"
              value={p.artworkStyle}
              onChange={(e) =>
                void updatePersonalization({
                  artworkStyle: e.target.value as ArtworkDisplayStyle,
                })
              }
              className="w-full min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-medium cursor-pointer"
            >
              <option value="cover">Album Cover</option>
              <option value="vinyl">Spinning Vinyl</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 4: Modern Typography Gallery */}
      <div className="space-y-3 pt-3 border-t border-black/8 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Type className="w-4 h-4 text-[var(--neo-accent)]" />
              <span>Typography &amp; Modern Fonts</span>
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Select a modern font family across headings, lyrics, and interface labels
            </p>
          </div>
          <span className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
            {activeFontMeta.name}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {FONT_PRESETS.map((font) => {
            const active = p.fontStyle === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() =>
                  void updatePersonalization({ fontStyle: font.id as FontStylePreset })
                }
                className={cn(
                  'p-3 neo-btn-radius liquid-glass-subtle text-left transition-all cursor-pointer flex items-center justify-between gap-2',
                  active ? 'ring-2 ring-[var(--neo-accent)]' : 'hover:brightness-105'
                )}
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-bold truncate"
                    style={{ fontFamily: font.displayFont }}
                  >
                    {font.name}
                  </p>
                  <p
                    className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5"
                    style={{ fontFamily: font.bodyFont }}
                  >
                    {font.tagline}
                  </p>
                </div>
                {active && (
                  <span className="w-5 h-5 rounded-full bg-[var(--neo-accent)] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Palette Builder Modal */}
      <GlassModal
        open={paletteModalOpen}
        onOpenChange={setPaletteModalOpen}
        title={editingPaletteId ? 'Edit Custom Palette' : 'Create Custom Palette'}
        description="Pick an accent color and secondary ambient glow for Neo Player."
      >
        <form onSubmit={handleSavePalette} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
              Palette Name
            </span>
            <input
              type="text"
              required
              autoFocus
              value={paletteName}
              onChange={(e) => setPaletteName(e.target.value)}
              placeholder="Tokyo Neon"
              className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                Primary Accent
              </span>
              <div className="flex items-center gap-2 p-2 rounded-xl liquid-glass-subtle">
                <input
                  type="color"
                  value={paletteAccent}
                  onChange={(e) => setPaletteAccent(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={paletteAccent}
                  onChange={(e) => setPaletteAccent(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono-tabular uppercase focus:outline-none"
                />
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                Secondary Glow
              </span>
              <div className="flex items-center gap-2 p-2 rounded-xl liquid-glass-subtle">
                <input
                  type="color"
                  value={paletteSecondary}
                  onChange={(e) => setPaletteSecondary(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={paletteSecondary}
                  onChange={(e) => setPaletteSecondary(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono-tabular uppercase focus:outline-none"
                />
              </div>
            </label>
          </div>

          <div
            className="p-4 rounded-2xl border border-black/8 dark:border-white/10 flex items-center justify-between"
            style={{
              background: `linear-gradient(120deg, ${paletteAccent}28, ${paletteSecondary}22)`,
            }}
          >
            <span className="text-sm font-semibold">{paletteName || 'Custom Palette'}</span>
            <span
              className="px-3 py-1 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: paletteAccent }}
            >
              Accent Button
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="ghost" onClick={() => setPaletteModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="accent">
              Save & Apply
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </GlassCard>
  );
};
