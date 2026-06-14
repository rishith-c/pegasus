export const darkColors = {
  bg: '#10151c',
  card: '#1b2330',
  border: '#2b3441',
  text: '#eef1f5',
  textDim: '#8b96a8',
  green: '#7fc8a8',
  yellow: '#e3b873',
  red: '#dd9088',
  blue: '#85aed1',
} as const;

export const lightColors = {
  bg: '#f4f6f9',
  card: '#ffffff',
  border: '#dde3ea',
  text: '#1c2733',
  textDim: '#6b7888',
  green: darkColors.green,
  yellow: darkColors.yellow,
  red: darkColors.red,
  blue: darkColors.blue,
} as const;

export type ColorTheme = typeof darkColors;

// Fixed dark palette, for elements (alert overlay, gauge core) that stay
// dark regardless of the active theme.
export const COLORS = darkColors;

export type Level = 'green' | 'yellow' | 'red';

export const levelColor = (level: Level | string): string =>
  level === 'green' ? COLORS.green : level === 'yellow' ? COLORS.yellow : COLORS.red;

export const levelLabel = (level: Level | string): string =>
  level === 'green'
    ? 'All systems normal'
    : level === 'yellow'
    ? 'Check-in recommended'
    : 'Action recommended';

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
