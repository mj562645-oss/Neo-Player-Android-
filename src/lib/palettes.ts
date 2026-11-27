import type {
  AppPalette,
  CornerRadiusPreset,
  FontStylePreset,
  GlassStylePreset,
  PersonalizationSettings,
  UiThemeId,
} from '../types/music';

export interface UiThemeMeta {
  id: UiThemeId;
  name: string;
  tagline: string;
  description: string;
  defaultPaletteId: string;
  defaultGlassStyle: GlassStylePreset;
  defaultCornerStyle: CornerRadiusPreset;
  defaultFontStyle: FontStylePreset;
  previewBgLight: string;
  previewBgDark: string;
}

export interface FontPresetMeta {
  id: FontStylePreset;
  name: string;
  tagline: string;
  displayFont: string;
  bodyFont: string;
}

export const FONT_PRESETS: FontPresetMeta[] = [
  {
    id: 'geometric',
    name: 'Jakarta Sans',
    tagline: 'Modern & balanced studio UI',
    displayFont: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    bodyFont: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'editorial',
    name: 'Playfair Editorial',
    tagline: 'Curatorial serif display & clean sans',
    displayFont: "'Playfair Display', 'Fraunces', Georgia, serif",
    bodyFont: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'material',
    name: 'Material Expressive',
    tagline: 'Latest Material 3 Expressive type',
    displayFont: "'Plus Jakarta Sans', 'Outfit', sans-serif",
    bodyFont: "'DM Sans', 'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'outfit',
    name: 'Outfit Neo',
    tagline: 'Rounded contemporary display',
    displayFont: "'Outfit', 'Plus Jakarta Sans', sans-serif",
    bodyFont: "'DM Sans', sans-serif",
  },
  {
    id: 'sora',
    name: 'Sora Clean',
    tagline: 'Sleek architectural clarity',
    displayFont: "'Sora', 'Plus Jakarta Sans', sans-serif",
    bodyFont: "'DM Sans', sans-serif",
  },
  {
    id: 'inter',
    name: 'DM Studio',
    tagline: 'Neutral precision readability',
    displayFont: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    bodyFont: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'grotesk',
    name: 'Fraunces Display',
    tagline: 'Expressive soft-serif headline craft',
    displayFont: "'Fraunces', 'Playfair Display', Georgia, serif",
    bodyFont: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
  },
  {
    id: 'fluent',
    name: 'Lora Classic',
    tagline: 'Balanced literary prose & captions',
    displayFont: "'Lora', Georgia, serif",
    bodyFont: "'DM Sans', sans-serif",
  },
  {
    id: 'technical',
    name: 'JetBrains Mono',
    tagline: 'Hi-Fi audiophile monospace',
    displayFont: "'JetBrains Mono', ui-monospace, monospace",
    bodyFont: "'DM Sans', sans-serif",
  },
];

export const UI_THEMES: UiThemeMeta[] = [
  {
    id: 'neo',
    name: 'Neo Player',
    tagline: 'Liquid Glass & Chromatic Depth',
    description: 'Luminous frosted glass panels with specular edge shaders and deep ambient color.',
    defaultPaletteId: 'crimson_glass',
    defaultGlassStyle: 'frosted',
    defaultCornerStyle: 'balanced',
    defaultFontStyle: 'geometric',
    previewBgLight: 'linear-gradient(135deg, #f8f5ff 0%, #ffeef3 100%)',
    previewBgDark: 'linear-gradient(135deg, #151422 0%, #241320 100%)',
  },
  {
    id: 'material',
    name: 'Material 3',
    tagline: 'Material 3 Expressive · Glassy',
    description:
      'Minimal Material You dynamic tonal containers layered over a translucent shader glass canvas.',
    defaultPaletteId: 'm3_cobalt',
    defaultGlassStyle: 'frosted',
    defaultCornerStyle: 'pillowy',
    defaultFontStyle: 'material',
    previewBgLight: 'linear-gradient(135deg, #F6F8FC 0%, #D3E3FD 100%)',
    previewBgDark: 'linear-gradient(135deg, #121318 0%, #1F2840 100%)',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    tagline: 'Curatorial Glass & Serif Craft',
    description:
      'Architectural hairlines, Playfair serif headings, and gallery alabaster or obsidian frosted glass.',
    defaultPaletteId: 'editorial_champagne',
    defaultGlassStyle: 'frosted',
    defaultCornerStyle: 'balanced',
    defaultFontStyle: 'editorial',
    previewBgLight: 'linear-gradient(135deg, #FAF8F4 0%, #EAE3D5 100%)',
    previewBgDark: 'linear-gradient(135deg, #0B0B0E 0%, #1E1A16 100%)',
  },
];

export const BUILT_IN_PALETTES: AppPalette[] = [
  // Neo Player Palettes
  {
    id: 'crimson_glass',
    name: 'Crimson Glass',
    accent: '#FF2D55',
    secondary: '#5E5CE6',
    themeId: 'neo',
    isBuiltIn: true,
  },
  {
    id: 'cobalt_studio',
    name: 'Cobalt Studio',
    accent: '#0A84FF',
    secondary: '#64D2FF',
    themeId: 'neo',
    isBuiltIn: true,
  },
  {
    id: 'emerald_hifi',
    name: 'Emerald Hi-Fi',
    accent: '#28CD41',
    secondary: '#0A84FF',
    themeId: 'neo',
    isBuiltIn: true,
  },
  {
    id: 'amber_vinyl',
    name: 'Amber Vinyl',
    accent: '#FF9F0A',
    secondary: '#FF375F',
    themeId: 'neo',
    isBuiltIn: true,
  },
  {
    id: 'violet_midnight',
    name: 'Violet Midnight',
    accent: '#BF5AF2',
    secondary: '#5E5CE6',
    themeId: 'neo',
    isBuiltIn: true,
  },
  {
    id: 'titanium_mono',
    name: 'Titanium Mono',
    accent: '#5C5E66',
    secondary: '#8E8E93',
    themeId: 'neo',
    isBuiltIn: true,
  },

  // Material 3 Expressive Palettes
  {
    id: 'm3_cobalt',
    name: 'Expressive Cobalt',
    accent: '#1A62D6',
    secondary: '#7CACF8',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_violet',
    name: 'Iris Tonal',
    accent: '#6750A4',
    secondary: '#B69DF8',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_sage',
    name: 'Pixel Sage',
    accent: '#146C2E',
    secondary: '#6DD58C',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_terracotta',
    name: 'Clay Coral',
    accent: '#B3261E',
    secondary: '#F2B8B5',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_ocean',
    name: 'Lagoon Teal',
    accent: '#006874',
    secondary: '#4FD8EB',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_amber',
    name: 'Solaris Ochre',
    accent: '#8F4E00',
    secondary: '#FFB951',
    themeId: 'material',
    isBuiltIn: true,
  },

  // Editorial Curatorial Palettes
  {
    id: 'editorial_champagne',
    name: 'Champagne & Ink',
    accent: '#9A6B22',
    secondary: '#5E6B7B',
    themeId: 'editorial',
    isBuiltIn: true,
  },
  {
    id: 'editorial_vermilion',
    name: 'Gallery Vermilion',
    accent: '#B93822',
    secondary: '#2B4C7E',
    themeId: 'editorial',
    isBuiltIn: true,
  },
  {
    id: 'editorial_lapis',
    name: 'Prussian Lapis',
    accent: '#1E40AF',
    secondary: '#64748B',
    themeId: 'editorial',
    isBuiltIn: true,
  },
  {
    id: 'editorial_pine',
    name: 'Botanical Ink',
    accent: '#166534',
    secondary: '#A6833E',
    themeId: 'editorial',
    isBuiltIn: true,
  },
  {
    id: 'editorial_rose',
    name: 'Atelier Rose',
    accent: '#88394F',
    secondary: '#6B627D',
    themeId: 'editorial',
    isBuiltIn: true,
  },
  {
    id: 'editorial_monolith',
    name: 'Monolith Noir',
    accent: '#3F3F46',
    secondary: '#A1A1AA',
    themeId: 'editorial',
    isBuiltIn: true,
  },
];

const LEGACY_PALETTE_MIGRATIONS: Record<string, string> = {
  win_fluent_blue: 'editorial_lapis',
  win_seafoam: 'editorial_champagne',
  win_coral: 'editorial_vermilion',
  win_orchid: 'editorial_rose',
  win_forest: 'editorial_pine',
  win_graphite: 'editorial_monolith',
};

export interface StudioGradient {
  id: string;
  name: string;
  from: string;
  to: string;
  angle: number;
}

export const STUDIO_GRADIENTS: StudioGradient[] = [
  { id: 'aurora', name: 'Midnight Aurora', from: '#162238', to: '#4B244A', angle: 135 },
  { id: 'velvet', name: 'Sunset Velvet', from: '#3A1C71', to: '#D76D77', angle: 130 },
  { id: 'ocean', name: 'Deep Ocean', from: '#0F2027', to: '#2C5364', angle: 145 },
  { id: 'rose_quartz', name: 'Rose Quartz', from: '#42275A', to: '#734B6D', angle: 120 },
  { id: 'nord', name: 'Nordic Slate', from: '#1F2937', to: '#475569', angle: 160 },
];

export const DEFAULT_PERSONALIZATION: PersonalizationSettings = {
  uiTheme: 'neo',
  activePaletteId: 'crimson_glass',
  customPalettes: [],
  backgroundMode: 'ambient',
  backgroundGradientId: 'aurora',
  customGradientFrom: '#162238',
  customGradientTo: '#4B244A',
  customGradientAngle: 135,
  backgroundBlur: 12,
  backgroundDim: 45,
  glassStyle: 'frosted',
  glassBlur: 28,
  cornerStyle: 'balanced',
  fontStyle: 'geometric',
  artworkStyle: 'cover',
  nowPlayingArtworkBackground: true,
  liveMediaPill: true,
};

export function normalizeUiThemeId(themeId?: string): UiThemeId {
  if (themeId === 'windows' || themeId === 'editorial') return 'editorial';
  if (themeId === 'material' || themeId === 'neo') return themeId;
  return 'neo';
}

export function getUiThemeMeta(themeId?: UiThemeId | string): UiThemeMeta {
  const safeId = normalizeUiThemeId(themeId);
  return UI_THEMES.find((t) => t.id === safeId) || UI_THEMES[0];
}

export function getFontPresetMeta(fontId?: FontStylePreset | string): FontPresetMeta {
  return FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];
}

export function getPalettesForTheme(themeId: UiThemeId | string): AppPalette[] {
  const safeId = normalizeUiThemeId(themeId);
  return BUILT_IN_PALETTES.filter((p) => p.themeId === safeId);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 255, g: 45, b: 85 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixRgba(
  base: [number, number, number],
  tint: { r: number; g: number; b: number },
  ratio: number,
  alpha: number
): string {
  const r = Math.round(base[0] + (tint.r - base[0]) * ratio);
  const g = Math.round(base[1] + (tint.g - base[1]) * ratio);
  const b = Math.round(base[2] + (tint.b - base[2]) * ratio);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixRgb(
  base: [number, number, number],
  tint: { r: number; g: number; b: number },
  ratio: number
): string {
  const r = Math.round(base[0] + (tint.r - base[0]) * ratio);
  const g = Math.round(base[1] + (tint.g - base[1]) * ratio);
  const b = Math.round(base[2] + (tint.b - base[2]) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export function resolveActivePalette(p: PersonalizationSettings): AppPalette {
  const all = [...BUILT_IN_PALETTES, ...(p.customPalettes || [])];
  const migratedId = LEGACY_PALETTE_MIGRATIONS[p.activePaletteId] || p.activePaletteId;
  const found = all.find((item) => item.id === migratedId);
  if (found) return found;
  const themeDefault = getPalettesForTheme(normalizeUiThemeId(p.uiTheme))[0];
  return themeDefault || BUILT_IN_PALETTES[0];
}

function resolveRadii(uiTheme: UiThemeId, cornerStyle: CornerRadiusPreset) {
  if (uiTheme === 'editorial') {
    return cornerStyle === 'sharp'
      ? { card: '10px', button: '6px', artwork: '8px' }
      : cornerStyle === 'pillowy'
        ? { card: '22px', button: '14px', artwork: '18px' }
        : { card: '16px', button: '10px', artwork: '12px' };
  }
  if (uiTheme === 'material') {
    return cornerStyle === 'sharp'
      ? { card: '18px', button: '14px', artwork: '16px' }
      : cornerStyle === 'pillowy'
        ? { card: '28px', button: '9999px', artwork: '24px' }
        : { card: '24px', button: '9999px', artwork: '20px' };
  }
  // neo
  return cornerStyle === 'sharp'
    ? { card: '14px', button: '12px', artwork: '14px' }
    : cornerStyle === 'pillowy'
      ? { card: '32px', button: '22px', artwork: '32px' }
      : { card: '24px', button: '16px', artwork: '28px' };
}

export function applyPersonalizationCssVars(
  p: PersonalizationSettings,
  resolvedTheme: 'light' | 'dark'
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const uiTheme = normalizeUiThemeId(p.uiTheme);
  const palette = resolveActivePalette(p);

  root.dataset.uiTheme = uiTheme;

  const { r: ar, g: ag, b: ab } = hexToRgb(palette.accent);
  // Calibrate editorial dark-mode accents so they glow clearly on obsidian while preserving >=4.5:1 white button contrast
  const effectiveAccent =
    uiTheme === 'editorial' && resolvedTheme === 'dark'
      ? palette.id === 'editorial_champagne'
        ? '#9F6D1E'
        : palette.id === 'editorial_lapis'
          ? '#2F5CE0'
          : palette.id === 'editorial_monolith'
            ? '#52525B'
            : palette.accent
      : palette.accent;
  const effectiveRgb = hexToRgb(effectiveAccent);

  root.style.setProperty('--neo-accent', effectiveAccent);
  root.style.setProperty(
    '--neo-accent-soft',
    hexToRgba(effectiveAccent, resolvedTheme === 'dark' ? 0.22 : 0.13)
  );
  root.style.setProperty('--neo-secondary', palette.secondary);
  root.style.setProperty(
    '--neo-secondary-soft',
    hexToRgba(palette.secondary, resolvedTheme === 'dark' ? 0.18 : 0.11)
  );

  // Material Design 3 Expressive tonal container tokens
  root.style.setProperty(
    '--neo-m3-primary-container',
    resolvedTheme === 'dark'
      ? mixRgba([30, 32, 42], { r: ar, g: ag, b: ab }, 0.38, 0.88)
      : mixRgba([244, 247, 254], { r: ar, g: ag, b: ab }, 0.2, 0.88)
  );
  root.style.setProperty(
    '--neo-m3-on-primary-container',
    resolvedTheme === 'dark'
      ? mixRgb([255, 255, 255], { r: ar, g: ag, b: ab }, 0.2)
      : mixRgb([12, 16, 26], { r: ar, g: ag, b: ab }, 0.5)
  );
  root.style.setProperty(
    '--neo-m3-outline-variant',
    resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(17, 18, 22, 0.10)'
  );

  // Optical glass blur & saturation enabled across all 3 themes (Material & Editorial use refined glassmorphic transparency)
  const baseBlur = Math.max(8, Math.min(44, p.glassBlur ?? 28));
  const effectiveBlur =
    p.glassStyle === 'solid'
      ? 0
      : uiTheme === 'material'
        ? Math.round(baseBlur * 0.82)
        : uiTheme === 'editorial'
          ? Math.round(baseBlur * 0.92)
          : baseBlur;
  const saturate =
    p.glassStyle === 'solid'
      ? '100%'
      : uiTheme === 'material'
        ? '155%'
        : uiTheme === 'editorial'
          ? '145%'
          : '185%';

  root.style.setProperty('--neo-glass-blur', `${effectiveBlur}px`);
  root.style.setProperty('--neo-glass-saturate', saturate);

  const isClear = p.glassStyle === 'clear';
  const isTinted = p.glassStyle === 'tinted';
  const isSolid = p.glassStyle === 'solid';

  if (uiTheme === 'material') {
    // Material 3 Expressive: minimal tonal layers with glassy translucency
    if (resolvedTheme === 'dark') {
      root.style.setProperty('--neo-app-bg', mixRgb([15, 16, 21], { r: ar, g: ag, b: ab }, 0.04));
      const alpha = isSolid ? 0.96 : isClear ? 0.54 : isTinted ? 0.76 : 0.72;
      const alphaElev = isSolid ? 0.98 : isClear ? 0.68 : 0.84;
      const alphaSubtle = isSolid ? 0.9 : isClear ? 0.42 : 0.58;
      const tintAmt = isTinted ? 0.12 : 0.065;
      root.style.setProperty('--neo-glass-bg', mixRgba([26, 28, 35], effectiveRgb, tintAmt, alpha));
      root.style.setProperty(
        '--neo-glass-bg-elevated',
        mixRgba([34, 36, 46], effectiveRgb, tintAmt + 0.02, alphaElev)
      );
      root.style.setProperty(
        '--neo-glass-bg-subtle',
        mixRgba([28, 30, 38], effectiveRgb, tintAmt, alphaSubtle)
      );
      root.style.setProperty('--neo-glass-border', 'rgba(255, 255, 255, 0.10)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.10)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 8px 28px -12px rgba(0, 0, 0, 0.55), 0 1px 3px rgba(0, 0, 0, 0.32)'
      );
    } else {
      root.style.setProperty('--neo-app-bg', mixRgb([245, 247, 252], { r: ar, g: ag, b: ab }, 0.03));
      const alpha = isSolid ? 0.96 : isClear ? 0.56 : isTinted ? 0.78 : 0.74;
      const alphaElev = isSolid ? 0.99 : isClear ? 0.72 : 0.88;
      const alphaSubtle = isSolid ? 0.92 : isClear ? 0.44 : 0.58;
      const tintAmt = isTinted ? 0.09 : 0.045;
      root.style.setProperty('--neo-glass-bg', mixRgba([250, 251, 255], effectiveRgb, tintAmt, alpha));
      root.style.setProperty(
        '--neo-glass-bg-elevated',
        mixRgba([255, 255, 255], effectiveRgb, tintAmt * 0.6, alphaElev)
      );
      root.style.setProperty(
        '--neo-glass-bg-subtle',
        mixRgba([238, 241, 248], effectiveRgb, tintAmt + 0.02, alphaSubtle)
      );
      root.style.setProperty('--neo-glass-border', 'rgba(17, 18, 22, 0.085)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.78)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 6px 24px -10px rgba(17, 24, 39, 0.10), 0 1px 3px rgba(17, 24, 39, 0.05)'
      );
    }
  } else if (uiTheme === 'editorial') {
    // Editorial: Archival Alabaster (Light) & Velvet Obsidian (Dark) architectural frosted glass
    if (resolvedTheme === 'dark') {
      root.style.setProperty('--neo-app-bg', '#0B0B0D');
      const alpha = isSolid ? 0.96 : isClear ? 0.52 : 0.74;
      const alphaElev = isSolid ? 0.98 : isClear ? 0.68 : 0.84;
      const alphaSubtle = isSolid ? 0.92 : isClear ? 0.40 : 0.56;
      const tintAmt = isTinted ? 0.08 : 0.02;
      root.style.setProperty('--neo-glass-bg', mixRgba([19, 19, 23], effectiveRgb, tintAmt, alpha));
      root.style.setProperty(
        '--neo-glass-bg-elevated',
        mixRgba([26, 26, 31], effectiveRgb, tintAmt, alphaElev)
      );
      root.style.setProperty(
        '--neo-glass-bg-subtle',
        mixRgba([23, 23, 27], effectiveRgb, tintAmt, alphaSubtle)
      );
      root.style.setProperty('--neo-glass-border', 'rgba(245, 240, 230, 0.11)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 250, 240, 0.12)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 18px 42px -18px rgba(0, 0, 0, 0.72), 0 1px 2px rgba(0, 0, 0, 0.45)'
      );
    } else {
      root.style.setProperty('--neo-app-bg', '#FAF8F4');
      const alpha = isSolid ? 0.97 : isClear ? 0.55 : 0.76;
      const alphaElev = isSolid ? 0.99 : isClear ? 0.72 : 0.88;
      const alphaSubtle = isSolid ? 0.92 : isClear ? 0.42 : 0.58;
      const tintAmt = isTinted ? 0.06 : 0.015;
      root.style.setProperty('--neo-glass-bg', mixRgba([255, 253, 249], effectiveRgb, tintAmt, alpha));
      root.style.setProperty(
        '--neo-glass-bg-elevated',
        mixRgba([255, 254, 251], effectiveRgb, tintAmt, alphaElev)
      );
      root.style.setProperty(
        '--neo-glass-bg-subtle',
        mixRgba([244, 240, 233], effectiveRgb, tintAmt, alphaSubtle)
      );
      root.style.setProperty('--neo-glass-border', 'rgba(24, 22, 19, 0.095)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.92)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 10px 28px -14px rgba(28, 25, 23, 0.11), 0 1px 2px rgba(28, 25, 23, 0.04)'
      );
    }
  } else {
    // Default Neo Player Liquid Glass
    if (resolvedTheme === 'dark') {
      root.style.setProperty('--neo-app-bg', '#08090C');
      if (isClear) {
        root.style.setProperty('--neo-glass-bg', 'rgba(20, 21, 28, 0.48)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(26, 27, 36, 0.64)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(20, 21, 28, 0.34)');
      } else if (isTinted) {
        root.style.setProperty('--neo-glass-bg', mixRgba([18, 19, 26], effectiveRgb, 0.08, 0.74));
        root.style.setProperty(
          '--neo-glass-bg-elevated',
          mixRgba([24, 25, 34], effectiveRgb, 0.1, 0.86)
        );
        root.style.setProperty('--neo-glass-bg-subtle', mixRgba([18, 19, 24], effectiveRgb, 0.06, 0.56));
      } else if (isSolid) {
        root.style.setProperty('--neo-glass-bg', 'rgba(20, 21, 26, 0.96)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(28, 29, 36, 0.98)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(25, 26, 32, 0.92)');
      } else {
        root.style.setProperty('--neo-glass-bg', 'rgba(24, 25, 32, 0.72)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(32, 33, 42, 0.82)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(22, 23, 29, 0.54)');
      }
      root.style.setProperty('--neo-glass-border', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.14)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 18px 44px -14px rgba(0, 0, 0, 0.65), 0 2px 10px -2px rgba(0, 0, 0, 0.45)'
      );
    } else {
      root.style.setProperty('--neo-app-bg', '#F7F7FA');
      if (isClear) {
        root.style.setProperty('--neo-glass-bg', 'rgba(255, 255, 255, 0.48)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(255, 255, 255, 0.68)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(255, 255, 255, 0.36)');
      } else if (isTinted) {
        root.style.setProperty('--neo-glass-bg', mixRgba([245, 245, 248], effectiveRgb, 0.06, 0.78));
        root.style.setProperty(
          '--neo-glass-bg-elevated',
          mixRgba([248, 248, 252], effectiveRgb, 0.07, 0.9)
        );
        root.style.setProperty('--neo-glass-bg-subtle', mixRgba([244, 244, 248], effectiveRgb, 0.05, 0.58));
      } else if (isSolid) {
        root.style.setProperty('--neo-glass-bg', 'rgba(255, 255, 255, 0.96)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(255, 255, 255, 0.99)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(246, 246, 249, 0.94)');
      } else {
        root.style.setProperty('--neo-glass-bg', 'rgba(255, 255, 255, 0.72)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(255, 255, 255, 0.84)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(255, 255, 255, 0.52)');
      }
      root.style.setProperty('--neo-glass-border', 'rgba(17, 18, 22, 0.08)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.85)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 12px 36px -12px rgba(17, 18, 22, 0.12), 0 2px 8px -2px rgba(17, 18, 22, 0.05)'
      );
    }
  }

  // Corner radii derived from UI Theme + Corner Style
  const radii = resolveRadii(uiTheme, p.cornerStyle);
  root.style.setProperty('--neo-radius-card', radii.card);
  root.style.setProperty('--neo-radius-button', radii.button);
  root.style.setProperty('--neo-radius-artwork', radii.artwork);

  // Typography
  const fontPreset = getFontPresetMeta(p.fontStyle);
  root.style.setProperty('--neo-font-display', fontPreset.displayFont);
  root.style.setProperty('--neo-font-body', fontPreset.bodyFont);
}
