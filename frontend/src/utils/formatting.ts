// Formatting helpers for Pegasus UI. Owned by Wesley (visual layer).

// Human-friendly relative time, e.g. "just now", "5m ago", "3h ago", "2d ago".
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);

  if (sec < 0) return "just now";
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(day / 365);
  return `${yr}y ago`;
}

// Format a 0..1 ratio (or already-percent if > 1) as a rounded percent string.
export function pct(n: number): string {
  if (n == null || Number.isNaN(n)) return "0%";
  const value = Math.abs(n) <= 1 ? n * 100 : n;
  return `${Math.round(value)}%`;
}

// Title Case a string, handling snake_case and kebab-case separators.
export function titleCase(s: string): string {
  if (!s) return "";
  return s
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Map a wellness level to its dashboard status copy.
// Wellness is 0..100 where higher = better: green is thriving, yellow neutral,
// red is running low.
export function scoreLabel(
  level: string
): "Thriving" | "Keep an eye out" | "Running low" {
  switch (level) {
    case "green":
      return "Thriving";
    case "yellow":
      return "Keep an eye out";
    case "red":
      return "Running low";
    default:
      return "Thriving";
  }
}
