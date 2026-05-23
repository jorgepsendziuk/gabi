/**
 * Design tokens GABI — fonte única de verdade para tema e CSS vars.
 * Alinhado ao logo: verde #66B000 / azul #002157.
 */
export const tokens = {
  color: {
    primary: '#002157',
    primaryLight: '#003380',
    primaryDark: '#001a3d',
    accent: '#66B000',
    accentLight: '#7acc00',
    accentDark: '#5a9c00',
    surface: '#ffffff',
    background: '#f8fafc',
    backgroundAlt: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    danger: '#b91c1c',
    dangerBg: '#fef2f2',
    warning: '#b45309',
    warningBg: '#fffbeb',
    success: '#15803d',
    successBg: '#f0fdf4',
    info: '#0369a1',
    infoBg: '#f0f9ff',
  },
  font: {
    family:
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    size: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.625',
    },
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  space: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
  },
  shadow: {
    sm: '0 1px 2px rgb(15 23 42 / 0.05)',
    md: '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
    lg: '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.06)',
  },
} as const;

/** Compatível com imports existentes (`gabiTheme.colors.*`). */
export const gabiTheme = {
  colors: {
    primary: tokens.color.primary,
    accent: tokens.color.accent,
    primaryLight: tokens.color.primaryLight,
    accentLight: tokens.color.accentLight,
    background: tokens.color.background,
    surface: tokens.color.surface,
    text: tokens.color.text,
    muted: tokens.color.textMuted,
  },
} as const;

export type GabiTheme = typeof gabiTheme;
