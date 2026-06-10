/**
 * Ubiquity Mobile — Design System
 *
 * Light: committed amber (#F5A623) page bg + white card surfaces — matches reference UI.
 * Dark:  deep slate bg + amber accents — same design language, dark variant.
 */

import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  // ── Light (Nordic Minimalist Theme) ──────────────────────────────────────────
  light: {
    // Page & surfaces
    background:         '#FAF8F5',   // Warm Oat / Sand page background
    backgroundElement:  '#FFFFFF',   // White card surface
    backgroundSelected: '#F0ECE3',   // light oatmeal selection background
    surface:            '#FFFFFF',
    surfaceFloat:       'rgba(255,255,255,0.96)',

    // Text
    text:               '#181A20',   // matte obsidian
    textSecondary:      '#5E6475',   // slate secondary text
    textMuted:          '#9A9FA0',   // soft muted gray text

    // Borders
    primary:            '#181A20',
    border:             'rgba(24, 26, 32, 0.08)',
    borderSubtle:       'rgba(24, 26, 32, 0.04)',

    // Status
    success:            '#27AE60',
    error:              '#E53935',

    // Overlay
    overlay:            'rgba(24, 26, 32, 0.4)',

    // Accent palette (folder tiles, icon chips, badges)
    accentYellow:       '#E2A93C',   // Ochre Gold
    accentOrange:       '#C95B43',   // Soft Terracotta
    accentGreen:        '#27AE60',
    accentBlue:         '#3498DB',
    accentPink:         '#E91E63',
    accentPurple:       '#9B59B6',

    // Semantic extras
    separator:          'rgba(24, 26, 32, 0.06)',
    tile:               '#E2A93C',
    cta:                '#181A20',
  },

  // ── Dark (Matte Obsidian Theme) ─────────────────────────────────────────────
  dark: {
    // Page & surfaces
    background:         '#0D0E11',   // super dark obsidian
    backgroundElement:  '#181A20',   // matte obsidian card surface
    backgroundSelected: '#242831',
    surface:            '#181A20',
    surfaceFloat:       'rgba(24, 26, 32, 0.96)',

    // Text
    text:               '#FFFFFF',
    textSecondary:      '#8C909F',
    textMuted:          '#5E6475',

    // Borders
    primary:            '#F0ECE3',
    border:             'rgba(255, 255, 255, 0.08)',
    borderSubtle:       'rgba(255, 255, 255, 0.04)',

    // Status
    success:            '#2ECC71',
    error:              '#EF5350',

    // Overlay
    overlay:            'rgba(0,0,0,0.75)',

    // Accent palette
    accentYellow:       '#E2A93C',
    accentOrange:       '#C95B43',
    accentGreen:        '#2ECC71',
    accentBlue:         '#3498DB',
    accentPink:         '#E91E63',
    accentPurple:       '#9B59B6',

    // Semantic extras
    separator:          'rgba(255, 255, 255, 0.06)',
    tile:               '#E2A93C',
    cta:                '#E2A93C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios:     { sans: '-apple-system', mono: 'Menlo' },
  android: { sans: 'Roboto',        mono: 'monospace' },
  default: { sans: 'System',        mono: 'monospace' },
});

export const Spacing = {
  xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 48,
  // legacy keys kept for existing components
  one: 4, two: 8, three: 12, four: 16, five: 20, six: 24,
} as const;

export const TAB_BAR_HEIGHT   = 64;
export const MaxContentWidth  = 800;
export const BottomTabInset   = Platform.select({ ios: 50, android: 80 }) ?? 0;
