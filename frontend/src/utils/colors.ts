// Design tokens for Pegasus. Owned by Wesley (visual layer).
// Apple-HIG light theme — clean, airy, high-contrast. Matches the pitch deck
// (apple.com / keynote aesthetic): off-white canvas, white elevated cards with
// hairline borders and soft shadows, Apple-blue accents, SF system type.

export const COLORS = {
  bg: "#f5f5f7", // Apple off-white canvas
  card: "#ffffff", // elevated surfaces (hairline border + soft shadow)
  border: "#d2d2d7", // hairline separators / borders
  text: "#1d1d1f", // primary text
  textDim: "#6e6e73", // secondary / dim text
  green: "#34C759", // engine-light: calm
  yellow: "#FF9F0A", // engine-light: elevated (Apple amber)
  red: "#FF3B30", // engine-light: alert
  blue: "#0071e3", // accent: primary / links / active (Apple blue)
} as const;

// Tertiary text — quieter than textDim, for the lightest captions/footnotes.
export const TEXT_TERTIARY = "#86868b";

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

// Corner radii — Apple-ish soft rounding. Cards sit in the 16-20 range.
export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

// Typographic scale. Big, tight SF headlines; calm body copy. The app uses the
// platform system font (-apple-system / SF) via React Native defaults.
export const TYPE = {
  hero: { fontSize: 64, fontWeight: "700" as const, letterSpacing: -1.5 },
  score: { fontSize: 48, fontWeight: "700" as const, letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.4 },
  caption: { fontSize: 12, fontWeight: "400" as const },
} as const;
