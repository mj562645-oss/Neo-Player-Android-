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
    tagline: 'Modern & balanced UI',
    displayFont: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    bodyFont: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'inter',
    name: 'Inter Studio',
    tagline: 'Precision crisp readability',
    displayFont: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    bodyFont: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'outfit',
    name: 'Outfit Neo',
    tagline: 'Rounded contemporary display',
    displayFont: "'Outfit', 'Plus Jakarta Sans', sans-serif",
    bodyFont: "'DM Sans', 'Inter', sans-serif",
  },
  {
    id: 'grotesk',
    name: 'Space Grotesk',
    tagline: 'Bold futuristic geometry',
    displayFont: "'Space Grotesk', 'Inter', sans-serif",
    bodyFont: "'DM Sans', 'Inter', sans-serif",
  },
  {
    id: 'sora',
    name: 'Sora Clean',
    tagline: 'Sleek technical clarity',
    displayFont: "'Sora', 'Inter', sans-serif",
    bodyFont: "'Inter', 'DM Sans', sans-serif",
  },
  {
    id: 'material',
    name: 'Google Material Sans',
    tagline: 'Authentic Material You type',
    displayFont: "'Plus Jakarta Sans', 'Roboto', 'Inter', sans-serif",
    bodyFont: "'Inter', 'Roboto', sans-serif",
  },
  {
    id: 'fluent',
    name: 'Segoe UI Variable',
    tagline: 'Authentic Windows 11 typography',
    displayFont: "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', 'Inter', sans-serif",
    bodyFont: "'Segoe UI Variable Text', 'Segoe UI', 'Inter', sans-serif",
  },
  {
    id: 'editorial',
    name: 'Lora Editorial',
    tagline: 'Warm literary serif headings',
    displayFont: "'Lora', Georgia, serif",
    bodyFont: "'DM Sans', 'Inter', sans-serif",
  },
  {
    id: 'technical',
    name: 'JetBrains Mono',
    tagline: 'Hi-Fi audiophile monospace',
    displayFont: "'JetBrains Mono', ui-monospace, monospace",
    bodyFont: "'Inter', 'DM Sans', sans-serif",
  },
];

export const UI_THEMES: UiThemeMeta[] = [
  {
    id: 'neo',
    name: 'Neo Player',
    tagline: 'Liquid Glass & Depth',
    description: 'Luminous frosted glass panels with specular edge highlights and deep ambient color.',
    defaultPaletteId: 'crimson_glass',
    defaultGlassStyle: 'frosted',
    defaultCornerStyle: 'balanced',
    defaultFontStyle: 'geometric',
    previewBgLight: 'linear-gradient(135deg, #f8f5ff 0%, #ffeef3 100%)',
    previewBgDark: 'linear-gradient(135deg, #151422 0%, #241320 100%)',
  },
  {
    id: 'material',
    name: 'Material UI',
    tagline: 'Google Material Design 3',
    description: 'Authentic Google Material You tonal surface containers, pill indicators, and dynamic color.',
    defaultPaletteId: 'm3_cobalt',
    defaultGlassStyle: 'solid',
    defaultCornerStyle: 'pillowy',
    defaultFontStyle: 'material',
    previewBgLight: 'linear-gradient(135deg, #F8F9FA 0%, #D3E3FD 100%)',
    previewBgDark: 'linear-gradient(135deg, #131314 0%, #1E2538 100%)',
  },
  {
    id: 'windows',
    name: 'Windows',
    tagline: 'Windows 11 Fluent Design',
    description: 'Authentic WinUI 3 Mica canvas, crisp 1px card strokes, subtle bevels, and 3px left accent bars.',
    defaultPaletteId: 'win_fluent_blue',
    defaultGlassStyle: 'solid',
    defaultCornerStyle: 'sharp',
    defaultFontStyle: 'fluent',
    previewBgLight: 'linear-gradient(135deg, #F3F3F3 0%, #E5EFF9 100%)',
    previewBgDark: 'linear-gradient(135deg, #202020 0%, #2B2D32 100%)',
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

  // Material Design 3 (Google Material You) Palettes
  {
    id: 'm3_cobalt',
    name: 'Google Blue',
    accent: '#0B57D0',
    secondary: '#A8C7FA',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_violet',
    name: 'Baseline Violet',
    accent: '#6750A4',
    secondary: '#7D5260',
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
    name: 'Pixel Clay',
    accent: '#B3261E',
    secondary: '#984061',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_ocean',
    name: 'Marine Teal',
    accent: '#006874',
    secondary: '#4A6267',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_amber',
    name: 'Warm Honey',
    accent: '#8F4E00',
    secondary: '#755B00',
    themeId: 'material',
    isBuiltIn: true,
  },

  // Windows 11 Fluent Theme Palettes
  {
    id: 'win_fluent_blue',
    name: 'Windows Blue',
    accent: '#0067C0',
    secondary: '#60CDFF',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_seafoam',
    name: 'Acrylic Teal',
    accent: '#0078D4',
    secondary: '#00B7C3',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_coral',
    name: 'Sunset Coral',
    accent: '#C42B1C',
    secondary: '#FF8C00',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_orchid',
    name: 'Iris Glow',
    accent: '#8764B8',
    secondary: '#C239B3',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_forest',
    name: 'Meadow Green',
    accent: '#107C10',
    secondary: '#00B294',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_graphite',
    name: 'Mica Slate',
    accent: '#5C6670',
    secondary: '#8A949E',
    themeId: 'windows',
    isBuiltIn: true,
  },
];

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
};

export function normalizeUiThemeId(themeId?: string): UiThemeId {
  if (themeId === 'material' || themeId === 'windows' || themeId === 'neo') {
    return themeId;
  }
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
  const found = all.find((item) => item.id === p.activePaletteId);
  if (found) return found;
  const themeDefault = getPalettesForTheme(normalizeUiThemeId(p.uiTheme))[0];
  return themeDefault || BUILT_IN_PALETTES[0];
}

function resolveRadii(uiTheme: UiThemeId, cornerStyle: CornerRadiusPreset) {
  if (uiTheme === 'windows') {
    return cornerStyle === 'pillowy'
      ? { card: '12px', button: '6px', artwork: '10px' }
      : cornerStyle === 'balanced'
        ? { card: '8px', button: '5px', artwork: '8px' }
        : { card: '8px', button: '4px', artwork: '6px' };
  }
  if (uiTheme === 'material') {
    return cornerStyle === 'sharp'
      ? { card: '16px', button: '14px', artwork: '14px' }
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
  const effectiveAccent =
    uiTheme === 'windows' && resolvedTheme === 'dark' && palette.id === 'win_fluent_blue'
      ? '#4CC2FF'
      : palette.accent;
  const effectiveRgb = hexToRgb(effectiveAccent);

  root.style.setProperty('--neo-accent', effectiveAccent);
  root.style.setProperty(
    '--neo-accent-soft',
    hexToRgba(effectiveAccent, resolvedTheme === 'dark' ? 0.22 : 0.14)
  );
  root.style.setProperty('--neo-secondary', palette.secondary);
  root.style.setProperty(
    '--neo-secondary-soft',
    hexToRgba(palette.secondary, resolvedTheme === 'dark' ? 0.18 : 0.12)
  );

  // Material Design 3 tonal container tokens
  root.style.setProperty(
    '--neo-m3-primary-container',
    resolvedTheme === 'dark'
      ? mixRgb([28, 28, 34], { r: ar, g: ag, b: ab }, 0.36)
      : mixRgb([255, 255, 255], { r: ar, g: ag, b: ab }, 0.18)
  );
  root.style.setProperty(
    '--neo-m3-on-primary-container',
    resolvedTheme === 'dark'
      ? mixRgb([255, 255, 255], { r: ar, g: ag, b: ab }, 0.24)
      : mixRgb([12, 14, 22], { r: ar, g: ag, b: ab }, 0.45)
  );
  root.style.setProperty(
    '--neo-m3-outline-variant',
    resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(17, 18, 22, 0.12)'
  );

  // Blur & saturation per UI theme
  const rawBlur = p.glassStyle === 'solid' ? 0 : Math.max(8, Math.min(44, p.glassBlur ?? 28));
  const effectiveBlur = uiTheme === 'neo' ? rawBlur : 0;
  const saturate = uiTheme === 'neo' ? '185%' : '100%';

  root.style.setProperty('--neo-glass-blur', `${effectiveBlur}px`);
  root.style.setProperty('--neo-glass-saturate', saturate);

  // Base app canvas background + surface tokens per UI Design Theme
  if (uiTheme === 'material') {
    if (resolvedTheme === 'dark') {
      // Material Design 3 dark tonal hierarchy (Surface -> SurfaceContainer -> SurfaceContainerHigh)
      root.style.setProperty('--neo-app-bg', mixRgb([19, 19, 22], { r: ar, g: ag, b: ab }, 0.035));
      root.style.setProperty('--neo-glass-bg', mixRgb([30, 30, 35], { r: ar, g: ag, b: ab }, 0.055));
      root.style.setProperty('--neo-glass-bg-elevated', mixRgb([39, 39, 46], { r: ar, g: ag, b: ab }, 0.08));
      root.style.setProperty('--neo-glass-bg-subtle', mixRgb([34, 34, 40], { r: ar, g: ag, b: ab }, 0.065));
      root.style.setProperty('--neo-glass-border', 'rgba(255, 255, 255, 0.09)');
      root.style.setProperty('--neo-glass-highlight', 'transparent');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 1px 3px 0 rgba(0, 0, 0, 0.36), 0 4px 12px -2px rgba(0, 0, 0, 0.28)'
      );
    } else {
      // Google Material 3 light tonal hierarchy (#F8F9FA / tonal tint)
      root.style.setProperty('--neo-app-bg', mixRgb([248, 249, 252], { r: ar, g: ag, b: ab }, 0.025));
      root.style.setProperty('--neo-glass-bg', mixRgb([241, 243, 248], { r: ar, g: ag, b: ab }, 0.045));
      root.style.setProperty('--neo-glass-bg-elevated', mixRgb([255, 255, 255], { r: ar, g: ag, b: ab }, 0.015));
      root.style.setProperty('--neo-glass-bg-subtle', mixRgb([233, 236, 244], { r: ar, g: ag, b: ab }, 0.065));
      root.style.setProperty('--neo-glass-border', 'rgba(17, 18, 22, 0.085)');
      root.style.setProperty('--neo-glass-highlight', 'transparent');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 1px 2px rgba(17, 18, 22, 0.06), 0 2px 6px rgba(17, 18, 22, 0.04)'
      );
    }
  } else if (uiTheme === 'windows') {
    if (resolvedTheme === 'dark') {
      // Windows 11 Dark Mode Mica & WinUI 3 Card layers
      root.style.setProperty('--neo-app-bg', '#202020');
      root.style.setProperty('--neo-glass-bg', '#2B2B2B');
      root.style.setProperty('--neo-glass-bg-elevated', '#323232');
      root.style.setProperty('--neo-glass-bg-subtle', '#383838');
      root.style.setProperty('--neo-glass-border', 'rgba(255, 255, 255, 0.075)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.05)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 2px 4px rgba(0, 0, 0, 0.26), 0 8px 18px -4px rgba(0, 0, 0, 0.34)'
      );
    } else {
      // Windows 11 Light Mode Mica (#F3F3F3) & WinUI 3 Layer Fill (#FFFFFF / #FBFBFB)
      root.style.setProperty('--neo-app-bg', '#F3F3F3');
      root.style.setProperty('--neo-glass-bg', '#FBFBFB');
      root.style.setProperty('--neo-glass-bg-elevated', '#FFFFFF');
      root.style.setProperty('--neo-glass-bg-subtle', '#F0F0F0');
      root.style.setProperty('--neo-glass-border', 'rgba(0, 0, 0, 0.068)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.95)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 10px -2px rgba(0, 0, 0, 0.055)'
      );
    }
  } else {
    // Default Neo Player Liquid Glass
    if (resolvedTheme === 'dark') {
      root.style.setProperty('--neo-app-bg', '#08090C');
      if (p.glassStyle === 'clear') {
        root.style.setProperty('--neo-glass-bg', 'rgba(20, 21, 28, 0.48)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(26, 27, 36, 0.64)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(20, 21, 28, 0.34)');
      } else if (p.glassStyle === 'tinted') {
        root.style.setProperty(
          '--neo-glass-bg',
          `rgba(${Math.round(18 + effectiveRgb.r * 0.08)}, ${Math.round(19 + effectiveRgb.g * 0.08)}, ${Math.round(26 + effectiveRgb.b * 0.08)}, 0.74)`
        );
        root.style.setProperty(
          '--neo-glass-bg-elevated',
          `rgba(${Math.round(24 + effectiveRgb.r * 0.1)}, ${Math.round(25 + effectiveRgb.g * 0.1)}, ${Math.round(34 + effectiveRgb.b * 0.1)}, 0.86)`
        );
        root.style.setProperty(
          '--neo-glass-bg-subtle',
          `rgba(${Math.round(18 + effectiveRgb.r * 0.06)}, ${Math.round(19 + effectiveRgb.g * 0.06)}, ${Math.round(24 + effectiveRgb.b * 0.06)}, 0.56)`
        );
      } else if (p.glassStyle === 'solid') {
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
      if (p.glassStyle === 'clear') {
        root.style.setProperty('--neo-glass-bg', 'rgba(255, 255, 255, 0.48)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(255, 255, 255, 0.68)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(255, 255, 255, 0.36)');
      } else if (p.glassStyle === 'tinted') {
        root.style.setProperty(
          '--neo-glass-bg',
          `rgba(${Math.round(245 + (effectiveRgb.r - 245) * 0.06)}, ${Math.round(245 + (effectiveRgb.g - 245) * 0.06)}, ${Math.round(248 + (effectiveRgb.b - 248) * 0.06)}, 0.78)`
        );
        root.style.setProperty(
          '--neo-glass-bg-elevated',
          `rgba(${Math.round(248 + (effectiveRgb.r - 248) * 0.07)}, ${Math.round(248 + (effectiveRgb.g - 248) * 0.07)}, ${Math.round(252 + (effectiveRgb.b - 252) * 0.07)}, 0.90)`
        );
        root.style.setProperty(
          '--neo-glass-bg-subtle',
          `rgba(${Math.round(244 + (effectiveRgb.r - 244) * 0.05)}, ${Math.round(244 + (effectiveRgb.g - 244) * 0.05)}, ${Math.round(248 + (effectiveRgb.b - 248) * 0.05)}, 0.58)`
        );
      } else if (p.glassStyle === 'solid') {
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

  // Modern Typography
  const fontPreset = getFontPresetMeta(p.fontStyle);
  root.style.setProperty('--neo-font-display', fontPreset.displayFont);
  root.style.setProperty('--neo-font-body', fontPreset.bodyFont);
}

