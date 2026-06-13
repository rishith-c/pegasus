// Design tokens for Pegasus. Owned by Wesley (visual layer).
// "Tesla dashboard for your mind" — dark, premium, calm, futuristic.

export const COLORS = {
  bg: "#0a0a0a",
  card: "#12121a",
  border: "#23232e",
  text: "#ffffff",
  textDim: "#9aa0aa",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
} as const;

export type BurnoutLevel = "green" | "yellow" | "red";

// Map a burnout level to its accent hex. Falls back to dim text for unknowns.
export function levelColor(level: string): string {
  switch (level) {
    case "green":
      return COLORS.green;
    case "yellow":
      return COLORS.yellow;
    case "red":
      return COLORS.red;
    default:
      return COLORS.textDim;
  }
}

// 8pt-based spacing scale. Generous negative space.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Corner radii — cards sit in the 16-20 range per design spec.
export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

// Typographic scale. Big numerals for scores, calm body copy.
export const TYPE = {
  hero: { fontSize: 64, fontWeight: "800" as const, letterSpacing: -1 },
  score: { fontSize: 48, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "500" as const },
  label: { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.4 },
  caption: { fontSize: 12, fontWeight: "500" as const },
} as const;
