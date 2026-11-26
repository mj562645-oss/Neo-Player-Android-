import type {
  AppPalette,
  CornerRadiusPreset,
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
  previewBgLight: string;
  previewBgDark: string;
}

export const UI_THEMES: UiThemeMeta[] = [
  {
    id: 'neo',
    name: 'Neo Player',
    tagline: 'Liquid Glass & Depth',
    description: 'Luminous frosted glass panels with specular edge highlights and deep ambient color.',
    defaultPaletteId: 'crimson_glass',
    defaultGlassStyle: 'frosted',
    defaultCornerStyle: 'balanced',
    previewBgLight: 'linear-gradient(135deg, #f8f5ff 0%, #ffeef3 100%)',
    previewBgDark: 'linear-gradient(135deg, #151422 0%, #241320 100%)',
  },
  {
    id: 'ios',
    name: 'iOS',
    tagline: 'Clean Native Surfaces',
    description: 'Apple Music inspired colors, crisp controls, and simple opaque surfaces.',
    defaultPaletteId: 'ios_apple_music',
    defaultGlassStyle: 'solid',
    defaultCornerStyle: 'balanced',
    previewBgLight: 'linear-gradient(135deg, #f2f2f7 0%, #fff0f2 100%)',
    previewBgDark: 'linear-gradient(135deg, #0b0b0e 0%, #1c1c1e 100%)',
  },
  {
    id: 'material',
    name: 'Material UI',
    tagline: 'Material You',
    description: 'Expressive tonal colors, clear surface hierarchy, and simple pill controls.',
    defaultPaletteId: 'm3_violet',
    defaultGlassStyle: 'solid',
    defaultCornerStyle: 'pillowy',
    previewBgLight: 'linear-gradient(135deg, #f6f2fa 0%, #ece4f5 100%)',
    previewBgDark: 'linear-gradient(135deg, #141218 0%, #231f2c 100%)',
  },
  {
    id: 'windows',
    name: 'Windows',
    tagline: 'Fluent Surfaces',
    description: 'Windows inspired colors, crisp geometry, and clean opaque surfaces.',
    defaultPaletteId: 'win_fluent_blue',
    defaultGlassStyle: 'solid',
    defaultCornerStyle: 'sharp',
    previewBgLight: 'linear-gradient(135deg, #f3f5f8 0%, #e6eef7 100%)',
    previewBgDark: 'linear-gradient(135deg, #1b1d21 0%, #20252d 100%)',
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

  // iOS Theme Palettes
  {
    id: 'ios_apple_music',
    name: 'Apple Music Red',
    accent: '#FA243C',
    secondary: '#FF6482',
    themeId: 'ios',
    isBuiltIn: true,
  },
  {
    id: 'ios_system_blue',
    name: 'System Blue',
    accent: '#007AFF',
    secondary: '#5AC8FA',
    themeId: 'ios',
    isBuiltIn: true,
  },
  {
    id: 'ios_indigo',
    name: 'Vibrant Indigo',
    accent: '#5856D6',
    secondary: '#AF52DE',
    themeId: 'ios',
    isBuiltIn: true,
  },
  {
    id: 'ios_mint',
    name: 'Mint Meadow',
    accent: '#00C7BE',
    secondary: '#34C759',
    themeId: 'ios',
    isBuiltIn: true,
  },
  {
    id: 'ios_tangerine',
    name: 'Sunset Orange',
    accent: '#FF9500',
    secondary: '#FF2D55',
    themeId: 'ios',
    isBuiltIn: true,
  },
  {
    id: 'ios_graphite',
    name: 'Space Graphite',
    accent: '#636366',
    secondary: '#AEAEB2',
    themeId: 'ios',
    isBuiltIn: true,
  },

  // Material UI Theme Palettes
  {
    id: 'm3_violet',
    name: 'Dynamic Violet',
    accent: '#6750A4',
    secondary: '#7D5260',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_sage',
    name: 'Eucalyptus Sage',
    accent: '#146C2E',
    secondary: '#386A20',
    themeId: 'material',
    isBuiltIn: true,
  },
  {
    id: 'm3_terracotta',
    name: 'Terracotta Clay',
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
    id: 'm3_cobalt',
    name: 'Expressive Blue',
    accent: '#0B57D0',
    secondary: '#7CACF8',
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

  // Windows Fluent Theme Palettes
  {
    id: 'win_fluent_blue',
    name: 'Fluent Blue',
    accent: '#0078D4',
    secondary: '#60CDFF',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_seafoam',
    name: 'Acrylic Teal',
    accent: '#0099BC',
    secondary: '#00B7C3',
    themeId: 'windows',
    isBuiltIn: true,
  },
  {
    id: 'win_coral',
    name: 'Sunset Coral',
    accent: '#E74856',
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
    name: 'Sage Green',
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
};

export function getUiThemeMeta(themeId?: UiThemeId): UiThemeMeta {
  return UI_THEMES.find((t) => t.id === themeId) || UI_THEMES[0];
}

export function getPalettesForTheme(themeId: UiThemeId): AppPalette[] {
  return BUILT_IN_PALETTES.filter((p) => p.themeId === themeId);
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

export function resolveActivePalette(p: PersonalizationSettings): AppPalette {
  const all = [...BUILT_IN_PALETTES, ...(p.customPalettes || [])];
  const found = all.find((item) => item.id === p.activePaletteId);
  if (found) return found;
  const themeDefault = getPalettesForTheme(p.uiTheme || 'neo')[0];
  return themeDefault || BUILT_IN_PALETTES[0];
}

function resolveRadii(uiTheme: UiThemeId, cornerStyle: CornerRadiusPreset) {
  if (uiTheme === 'windows') {
    return cornerStyle === 'pillowy'
      ? { card: '16px', button: '10px', artwork: '14px' }
      : cornerStyle === 'balanced'
        ? { card: '12px', button: '8px', artwork: '10px' }
        : { card: '8px', button: '6px', artwork: '8px' };
  }
  if (uiTheme === 'material') {
    return cornerStyle === 'sharp'
      ? { card: '16px', button: '14px', artwork: '14px' }
      : cornerStyle === 'pillowy'
        ? { card: '30px', button: '9999px', artwork: '28px' }
        : { card: '24px', button: '9999px', artwork: '24px' };
  }
  if (uiTheme === 'ios') {
    return cornerStyle === 'sharp'
      ? { card: '16px', button: '10px', artwork: '16px' }
      : cornerStyle === 'pillowy'
        ? { card: '28px', button: '18px', artwork: '28px' }
        : { card: '22px', button: '14px', artwork: '24px' };
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
  const uiTheme: UiThemeId = p.uiTheme || 'neo';
  const palette = resolveActivePalette(p);

  root.dataset.uiTheme = uiTheme;

  root.style.setProperty('--neo-accent', palette.accent);
  root.style.setProperty(
    '--neo-accent-soft',
    hexToRgba(palette.accent, resolvedTheme === 'dark' ? 0.22 : 0.14)
  );
  root.style.setProperty('--neo-secondary', palette.secondary);
  root.style.setProperty(
    '--neo-secondary-soft',
    hexToRgba(palette.secondary, resolvedTheme === 'dark' ? 0.18 : 0.12)
  );

  // Glass blur & saturation tuned per UI theme + user glassStyle
  const rawBlur = p.glassStyle === 'solid' ? 0 : Math.max(8, Math.min(44, p.glassBlur ?? 28));
  const effectiveBlur =
    uiTheme === 'material'
      ? p.glassStyle === 'clear'
        ? Math.min(18, rawBlur)
        : p.glassStyle === 'solid'
          ? 0
          : Math.min(14, Math.round(rawBlur * 0.5))
      : uiTheme === 'windows'
        ? p.glassStyle === 'solid'
          ? 0
          : Math.min(32, Math.round(rawBlur * 0.85))
        : uiTheme === 'ios'
          ? p.glassStyle === 'solid'
            ? 0
            : Math.max(20, rawBlur)
          : rawBlur;

  const saturate =
    uiTheme === 'ios'
      ? '210%'
      : uiTheme === 'windows'
        ? '135%'
        : uiTheme === 'material'
          ? '120%'
          : '185%';

  root.style.setProperty('--neo-glass-blur', `${effectiveBlur}px`);
  root.style.setProperty('--neo-glass-saturate', saturate);

  const { r: ar, g: ag, b: ab } = hexToRgb(palette.accent);

  // Base app canvas background
  if (resolvedTheme === 'dark') {
    root.style.setProperty(
      '--neo-app-bg',
      uiTheme === 'windows'
        ? '#1C1D21'
        : uiTheme === 'material'
          ? `rgb(${Math.round(18 + ar * 0.03)}, ${Math.round(16 + ag * 0.03)}, ${Math.round(22 + ab * 0.04)})`
          : uiTheme === 'ios'
            ? '#000000'
            : '#08090C'
    );
  } else {
    root.style.setProperty(
      '--neo-app-bg',
      uiTheme === 'windows'
        ? '#F3F4F6'
        : uiTheme === 'material'
          ? `rgb(${Math.round(249 + (ar - 249) * 0.03)}, ${Math.round(247 + (ag - 247) * 0.03)}, ${Math.round(251 + (ab - 251) * 0.04)})`
          : uiTheme === 'ios'
            ? '#F2F2F7'
            : '#F7F7FA'
    );
  }

  // Surface colors, borders, highlights, and shadows per UI Theme + Glass Style
  if (uiTheme === 'material') {
    if (resolvedTheme === 'dark') {
      const alpha =
        p.glassStyle === 'clear' ? 0.72 : p.glassStyle === 'solid' ? 0.98 : 0.92;
      const subtleAlpha =
        p.glassStyle === 'clear' ? 0.56 : p.glassStyle === 'solid' ? 0.94 : 0.84;
      root.style.setProperty(
        '--neo-glass-bg',
        `rgba(${Math.round(28 + ar * 0.08)}, ${Math.round(26 + ag * 0.07)}, ${Math.round(34 + ab * 0.09)}, ${alpha})`
      );
      root.style.setProperty(
        '--neo-glass-bg-elevated',
        `rgba(${Math.round(35 + ar * 0.1)}, ${Math.round(32 + ag * 0.08)}, ${Math.round(43 + ab * 0.11)}, ${Math.min(0.99, alpha + 0.05)})`
      );
      root.style.setProperty(
        '--neo-glass-bg-subtle',
        `rgba(${Math.round(32 + ar * 0.06)}, ${Math.round(30 + ag * 0.06)}, ${Math.round(38 + ab * 0.07)}, ${subtleAlpha})`
      );
      root.style.setProperty('--neo-glass-border', `rgba(${ar}, ${ag}, ${ab}, 0.16)`);
      root.style.setProperty('--neo-glass-highlight', 'transparent');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 4px 14px -2px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.35)'
      );
    } else {
      const alpha =
        p.glassStyle === 'clear' ? 0.76 : p.glassStyle === 'solid' ? 0.99 : 0.92;
      const subtleAlpha =
        p.glassStyle === 'clear' ? 0.62 : p.glassStyle === 'solid' ? 0.96 : 0.86;
      root.style.setProperty(
        '--neo-glass-bg',
        `rgba(${Math.round(246 + (ar - 246) * 0.06)}, ${Math.round(244 + (ag - 244) * 0.06)}, ${Math.round(250 + (ab - 250) * 0.07)}, ${alpha})`
      );
      root.style.setProperty(
        '--neo-glass-bg-elevated',
        `rgba(${Math.round(250 + (ar - 250) * 0.07)}, ${Math.round(248 + (ag - 248) * 0.07)}, ${Math.round(254 + (ab - 254) * 0.08)}, ${Math.min(0.99, alpha + 0.05)})`
      );
      root.style.setProperty(
        '--neo-glass-bg-subtle',
        `rgba(${Math.round(238 + (ar - 238) * 0.07)}, ${Math.round(235 + (ag - 235) * 0.07)}, ${Math.round(244 + (ab - 244) * 0.08)}, ${subtleAlpha})`
      );
      root.style.setProperty('--neo-glass-border', `rgba(${ar}, ${ag}, ${ab}, 0.12)`);
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.5)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 3px 12px -2px rgba(17, 18, 22, 0.08), 0 1px 3px rgba(17, 18, 22, 0.05)'
      );
    }
  } else if (uiTheme === 'windows') {
    if (resolvedTheme === 'dark') {
      const alpha =
        p.glassStyle === 'clear' ? 0.54 : p.glassStyle === 'solid' ? 0.96 : 0.78;
      root.style.setProperty('--neo-glass-bg', `rgba(38, 40, 46, ${alpha})`);
      root.style.setProperty('--neo-glass-bg-elevated', `rgba(44, 46, 54, ${Math.min(0.98, alpha + 0.1)})`);
      root.style.setProperty('--neo-glass-bg-subtle', `rgba(48, 50, 58, ${Math.max(0.42, alpha - 0.14)})`);
      root.style.setProperty('--neo-glass-border', 'rgba(255, 255, 255, 0.09)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 8px 24px -4px rgba(0, 0, 0, 0.48), 0 2px 6px rgba(0, 0, 0, 0.3)'
      );
    } else {
      const alpha =
        p.glassStyle === 'clear' ? 0.56 : p.glassStyle === 'solid' ? 0.97 : 0.78;
      root.style.setProperty('--neo-glass-bg', `rgba(251, 251, 253, ${alpha})`);
      root.style.setProperty('--neo-glass-bg-elevated', `rgba(255, 255, 255, ${Math.min(0.98, alpha + 0.12)})`);
      root.style.setProperty('--neo-glass-bg-subtle', `rgba(246, 247, 250, ${Math.max(0.48, alpha - 0.14)})`);
      root.style.setProperty('--neo-glass-border', 'rgba(0, 0, 0, 0.075)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.92)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 6px 20px -4px rgba(0, 0, 0, 0.09), 0 1px 4px rgba(0, 0, 0, 0.05)'
      );
    }
  } else if (uiTheme === 'ios') {
    if (resolvedTheme === 'dark') {
      const bg =
        p.glassStyle === 'clear'
          ? 'rgba(28, 28, 30, 0.44)'
          : p.glassStyle === 'tinted'
            ? `rgba(${Math.round(24 + ar * 0.08)}, ${Math.round(24 + ag * 0.08)}, ${Math.round(28 + ab * 0.08)}, 0.72)`
            : p.glassStyle === 'solid'
              ? 'rgba(28, 28, 30, 0.96)'
              : 'rgba(28, 28, 30, 0.68)';
      root.style.setProperty('--neo-glass-bg', bg);
      root.style.setProperty('--neo-glass-bg-elevated', p.glassStyle === 'solid' ? 'rgba(38, 38, 42, 0.98)' : 'rgba(36, 36, 40, 0.80)');
      root.style.setProperty('--neo-glass-bg-subtle', p.glassStyle === 'solid' ? 'rgba(32, 32, 36, 0.92)' : 'rgba(34, 34, 38, 0.50)');
      root.style.setProperty('--neo-glass-border', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.16)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 14px 36px -12px rgba(0, 0, 0, 0.58), 0 1px 4px rgba(0, 0, 0, 0.35)'
      );
    } else {
      const bg =
        p.glassStyle === 'clear'
          ? 'rgba(255, 255, 255, 0.48)'
          : p.glassStyle === 'tinted'
            ? `rgba(${Math.round(248 + (ar - 248) * 0.06)}, ${Math.round(248 + (ag - 248) * 0.06)}, ${Math.round(252 + (ab - 252) * 0.06)}, 0.78)`
            : p.glassStyle === 'solid'
              ? 'rgba(255, 255, 255, 0.97)'
              : 'rgba(255, 255, 255, 0.72)';
      root.style.setProperty('--neo-glass-bg', bg);
      root.style.setProperty('--neo-glass-bg-elevated', p.glassStyle === 'solid' ? 'rgba(255, 255, 255, 0.99)' : 'rgba(255, 255, 255, 0.85)');
      root.style.setProperty('--neo-glass-bg-subtle', p.glassStyle === 'solid' ? 'rgba(246, 246, 249, 0.95)' : 'rgba(255, 255, 255, 0.54)');
      root.style.setProperty('--neo-glass-border', 'rgba(60, 60, 67, 0.1)');
      root.style.setProperty('--neo-glass-highlight', 'rgba(255, 255, 255, 0.9)');
      root.style.setProperty(
        '--neo-glass-shadow',
        '0 10px 28px -10px rgba(17, 18, 22, 0.1), 0 1px 4px rgba(17, 18, 22, 0.04)'
      );
    }
  } else {
    // Default Neo Player Liquid Glass
    if (resolvedTheme === 'dark') {
      if (p.glassStyle === 'clear') {
        root.style.setProperty('--neo-glass-bg', 'rgba(20, 21, 28, 0.48)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(26, 27, 36, 0.64)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(20, 21, 28, 0.34)');
      } else if (p.glassStyle === 'tinted') {
        root.style.setProperty(
          '--neo-glass-bg',
          `rgba(${Math.round(18 + ar * 0.08)}, ${Math.round(19 + ag * 0.08)}, ${Math.round(26 + ab * 0.08)}, 0.74)`
        );
        root.style.setProperty(
          '--neo-glass-bg-elevated',
          `rgba(${Math.round(24 + ar * 0.1)}, ${Math.round(25 + ag * 0.1)}, ${Math.round(34 + ab * 0.1)}, 0.86)`
        );
        root.style.setProperty(
          '--neo-glass-bg-subtle',
          `rgba(${Math.round(18 + ar * 0.06)}, ${Math.round(19 + ag * 0.06)}, ${Math.round(24 + ab * 0.06)}, 0.56)`
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
      if (p.glassStyle === 'clear') {
        root.style.setProperty('--neo-glass-bg', 'rgba(255, 255, 255, 0.48)');
        root.style.setProperty('--neo-glass-bg-elevated', 'rgba(255, 255, 255, 0.68)');
        root.style.setProperty('--neo-glass-bg-subtle', 'rgba(255, 255, 255, 0.36)');
      } else if (p.glassStyle === 'tinted') {
        root.style.setProperty(
          '--neo-glass-bg',
          `rgba(${Math.round(245 + (ar - 245) * 0.06)}, ${Math.round(245 + (ag - 245) * 0.06)}, ${Math.round(248 + (ab - 248) * 0.06)}, 0.78)`
        );
        root.style.setProperty(
          '--neo-glass-bg-elevated',
          `rgba(${Math.round(248 + (ar - 248) * 0.07)}, ${Math.round(248 + (ag - 248) * 0.07)}, ${Math.round(252 + (ab - 252) * 0.07)}, 0.90)`
        );
        root.style.setProperty(
          '--neo-glass-bg-subtle',
          `rgba(${Math.round(244 + (ar - 244) * 0.05)}, ${Math.round(244 + (ag - 244) * 0.05)}, ${Math.round(248 + (ab - 248) * 0.05)}, 0.58)`
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

  if (uiTheme !== 'neo') {
    const surfaceColors =
      uiTheme === 'material'
        ? resolvedTheme === 'dark'
          ? ['#24212B', '#302C39', '#292631']
          : ['#F5F1F8', '#FBF8FF', '#EEEAF2']
        : uiTheme === 'windows'
          ? resolvedTheme === 'dark'
            ? ['#26282E', '#2C2E36', '#30323A']
            : ['#FBFBFD', '#FFFFFF', '#F6F7FA']
          : resolvedTheme === 'dark'
            ? ['#1C1C1E', '#242426', '#202022']
            : ['#FFFFFF', '#FFFFFF', '#F6F6F8'];
    root.style.setProperty('--neo-glass-bg', surfaceColors[0]);
    root.style.setProperty('--neo-glass-bg-elevated', surfaceColors[1]);
    root.style.setProperty('--neo-glass-bg-subtle', surfaceColors[2]);
    root.style.setProperty('--neo-glass-highlight', 'transparent');
    root.style.setProperty('--neo-glass-blur', '0px');
    root.style.setProperty('--neo-glass-saturate', '100%');
  }

  // Corner radii derived from UI Theme + Corner Style
  const radii = resolveRadii(uiTheme, p.cornerStyle);
  root.style.setProperty('--neo-radius-card', radii.card);
  root.style.setProperty('--neo-radius-button', radii.button);
  root.style.setProperty('--neo-radius-artwork', radii.artwork);

  // Typography
  if (p.fontStyle === 'editorial') {
    root.style.setProperty('--neo-font-display', "'Lora', Georgia, serif");
    root.style.setProperty('--neo-font-body', "'DM Sans', -apple-system, sans-serif");
  } else if (p.fontStyle === 'technical') {
    root.style.setProperty('--neo-font-display', "'JetBrains Mono', ui-monospace, monospace");
    root.style.setProperty('--neo-font-body', "'Plus Jakarta Sans', -apple-system, sans-serif");
  } else if (uiTheme === 'windows') {
    root.style.setProperty(
      '--neo-font-display',
      "'Segoe UI Variable', 'Segoe UI', 'Plus Jakarta Sans', sans-serif"
    );
    root.style.setProperty(
      '--neo-font-body',
      "'Segoe UI Variable Text', 'Segoe UI', 'DM Sans', sans-serif"
    );
  } else if (uiTheme === 'ios') {
    root.style.setProperty(
      '--neo-font-display',
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Plus Jakarta Sans', sans-serif"
    );
    root.style.setProperty(
      '--neo-font-body',
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'DM Sans', sans-serif"
    );
  } else if (uiTheme === 'material') {
    root.style.setProperty(
      '--neo-font-display',
      "'Plus Jakarta Sans', 'Roboto', -apple-system, sans-serif"
    );
    root.style.setProperty(
      '--neo-font-body',
      "'DM Sans', 'Roboto', -apple-system, sans-serif"
    );
  } else {
    root.style.setProperty(
      '--neo-font-display',
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    );
    root.style.setProperty(
      '--neo-font-body',
      "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    );
  }
}
