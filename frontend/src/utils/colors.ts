export const COLORS = {
  bg: '#0a0a0a',
  card: '#1a1a2e',
  border: '#2a2a3e',
  text: '#ffffff',
  textDim: '#9ca3af',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
} as const;

export type Level = 'green' | 'yellow' | 'red';

export const levelColor = (level: Level | string): string =>
  level === 'green' ? COLORS.green : level === 'yellow' ? COLORS.yellow : COLORS.red;

export const levelLabel = (level: Level | string): string =>
  level === 'green'
    ? 'Systems Normal'
    : level === 'yellow'
    ? 'Warning: Check In'
    : 'Alert: Take Action';
