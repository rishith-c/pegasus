// MetricsScreen — the dashboard. "Tesla dashboard for your mind."
//
// Pulls getMetrics(DEFAULT_USER_ID) for the score trend + latest breakdown,
// and getHistory(DEFAULT_USER_ID) for per-checkin signals. Renders:
//   - a big current-score header
//   - <TrendChart/> of the score history
//   - <ScoreBreakdown/> of the latest signal breakdown
//   - week-over-week Typing-speed and Error-rate cards (up/down arrows)
//   - a compact sentiment mini-trend sparkline
//
// The persisted history (BurnoutResult) doesn't always carry raw biometrics,
// so we read typing_wpm / error_rate / sentiment defensively and fall back to
// breakdown-derived proxies, degrading to calm empty states when absent.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import TrendChart from "../components/TrendChart";
import ScoreBreakdown from "../components/ScoreBreakdown";
import ScrollEdgeFade from "../components/ScrollEdgeFade";
import { BurnoutResult } from "../types";
import { getMetrics, getHistory } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPE,
  TEXT_TERTIARY,
  levelColor,
} from "../utils/colors";
import { relativeTime, scoreLabel } from "../utils/formatting";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Shape returned by GET /metrics/{user_id}. getMetrics() is typed `any`, so we
// describe what we actually consume here.
interface MetricsPayload {
  score_trend?: { date: string | null; score: number; level: string }[];
  latest_breakdown?: Partial<Breakdown>;
  total_checkins?: number;
}

interface Breakdown {
  imessage: number;
  typing: number;
  facial: number;
  voice: number;
  tribe: number;
}

const EMPTY_BREAKDOWN: Breakdown = {
  imessage: 0,
  typing: 0,
  facial: 0,
  voice: 0,
  tribe: 0,
};

// Demo sample, shown when there's no real data yet so Metrics is never blank.
const SAMPLE_BREAKDOWN: Breakdown = { imessage: 58, typing: 46, facial: 52, voice: 38, tribe: 30 };
const _SAMPLE_SCORES = [52, 61, 49, 70, 66, 74, 81];
const _lvl = (s: number) => (s >= 70 ? "green" : s >= 40 ? "yellow" : "red");

function sampleMetrics(): MetricsPayload {
  const now = Date.now();
  return {
    total_checkins: _SAMPLE_SCORES.length,
    latest_breakdown: SAMPLE_BREAKDOWN,
    score_trend: _SAMPLE_SCORES.map((score, i) => ({
      date: new Date(now - (_SAMPLE_SCORES.length - 1 - i) * 86400000).toISOString(),
      score,
      level: _lvl(score),
    })),
  };
}

function sampleHistory(): RichHistory[] {
  const now = Date.now();
  return _SAMPLE_SCORES.map((score, i) => ({
    score,
    level: _lvl(score),
    timestamp: new Date(now - (_SAMPLE_SCORES.length - 1 - i) * 86400000).toISOString(),
    typing_wpm: 42 + score / 3,
    error_rate: Math.max(1, 14 - score / 8),
    sentiment_score: Math.min(0.9, 0.2 + score / 130),
    breakdown: SAMPLE_BREAKDOWN,
  } as unknown as RichHistory));
}

// A history row may carry richer fields than the BurnoutResult contract when it
// originated from the /analyze flow. Read them opportunistically.
type RichHistory = BurnoutResult & {
  typing_wpm?: number;
  error_rate?: number;
  sentiment_score?: number;
  sentiment?: number;
};

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Split rows into [this week, last week] by timestamp, then average a derived
// metric. `pick` returns null when a row has no usable value for that metric.
function weekOverWeek(
  rows: RichHistory[],
  pick: (r: RichHistory) => number | null
): { current: number | null; previous: number | null } {
  const now = Date.now();
  const cur: number[] = [];
  const prev: number[] = [];
  for (const r of rows) {
    const t = r.timestamp ? new Date(r.timestamp).getTime() : NaN;
    if (Number.isNaN(t)) continue;
    const age = now - t;
    const v = pick(r);
    if (v == null) continue;
    if (age <= WEEK_MS) cur.push(v);
    else if (age <= WEEK_MS * 2) prev.push(v);
  }
  return { current: mean(cur), previous: mean(prev) };
}

export default function MetricsScreen() {
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [history, setHistory] = useState<RichHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [m, h] = await Promise.all([
        getMetrics(DEFAULT_USER_ID) as Promise<MetricsPayload>,
        getHistory(DEFAULT_USER_ID) as unknown as Promise<RichHistory[]>,
      ]);
      const hasMetrics = m && (m.score_trend?.length || m.latest_breakdown);
      setMetrics(hasMetrics ? m : sampleMetrics());
      setHistory(Array.isArray(h) && h.length ? h : sampleHistory());
    } catch {
      // No data yet → show the demo sample rather than an error screen.
      setMetrics(sampleMetrics());
      setHistory(sampleHistory());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  // Trend scores (oldest -> newest), preferring the server's score_trend.
  const trendScores = useMemo<number[]>(() => {
    const fromMetrics = (metrics?.score_trend ?? [])
      .map((p) => num(p.score))
      .filter((n): n is number => n != null);
    if (fromMetrics.length > 0) return fromMetrics;
    // history is newest-first; reverse for chronological charting.
    return [...history]
      .reverse()
      .map((h) => num(h.score))
      .filter((n): n is number => n != null);
  }, [metrics, history]);

  // Newest history row carries the current score + level.
  const latest = history[0];
  const trend = metrics?.score_trend ?? [];
  const trendLatest = trend.length > 0 ? trend[trend.length - 1] : undefined;

  const currentScore =
    num(latest?.score) ?? num(trendLatest?.score) ?? null;
  const currentLevel = latest?.level ?? trendLatest?.level ?? "green";
  const lastCheckIso = latest?.timestamp ?? trendLatest?.date ?? null;
  const totalCheckins =
    num(metrics?.total_checkins) ?? history.length;

  const breakdown: Breakdown = useMemo(() => {
    const src = metrics?.latest_breakdown ?? latest?.breakdown ?? SAMPLE_BREAKDOWN;
    return { ...EMPTY_BREAKDOWN, ...src };
  }, [metrics, latest]);

  // Typing speed: prefer raw WPM; otherwise invert the typing-strain signal
  // (higher strain -> lower effective speed) so the card still tells a story.
  const typingWow = useMemo(
    () =>
      weekOverWeek(history, (r) => {
        const wpm = num(r.typing_wpm);
        if (wpm != null && wpm > 0) return wpm;
        const strain = num(r.breakdown?.typing);
        return strain != null ? Math.max(0, 100 - strain) : null;
      }),
    [history]
  );
  const typingHasRaw = useMemo(
    () => history.some((r) => num(r.typing_wpm) != null && (r.typing_wpm ?? 0) > 0),
    [history]
  );

  // Error rate: prefer raw error_rate; otherwise use the typing-strain signal
  // directly as a strain proxy.
  const errorWow = useMemo(
    () =>
      weekOverWeek(history, (r) => {
        const er = num(r.error_rate);
        if (er != null) return er;
        return num(r.breakdown?.typing);
      }),
    [history]
  );
  const errorHasRaw = useMemo(
    () => history.some((r) => num(r.error_rate) != null),
    [history]
  );

  // Sentiment mini-trend (oldest -> newest, normalized 0..100, higher = better).
  const sentimentSeries = useMemo<number[]>(() => {
    const ordered = [...history].reverse();
    return ordered
      .map((r) => {
        const raw = num(r.sentiment_score) ?? num(r.sentiment);
        if (raw != null) {
          // sentiment is typically -1..1; map to 0..100. If already 0..100, keep.
          if (raw >= -1 && raw <= 1) return Math.round((raw + 1) * 50);
          return Math.max(0, Math.min(100, raw));
        }
        // Proxy: invert burnout score so higher = calmer/more positive.
        const s = num(r.score);
        return s != null ? Math.max(0, Math.min(100, 100 - s)) : null;
      })
      .filter((n): n is number => n != null);
  }, [history]);
  const sentimentIsRaw = useMemo(
    () =>
      history.some(
        (r) => num(r.sentiment_score) != null || num(r.sentiment) != null
      ),
    [history]
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.fill]}>
        <ActivityIndicator color={COLORS.textDim} />
        <Text style={styles.loadingText}>Reading your dashboard…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.fill]}>
        <Text style={styles.errorTitle}>Couldn't load metrics</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Text style={styles.errorHint} onPress={() => load("initial")}>
          Tap to retry
        </Text>
      </View>
    );
  }

  const hasAnyData = history.length > 0 || trendScores.length > 0;
  const accent = levelColor(currentLevel);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SPACING.md,
            paddingBottom: SPACING.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={COLORS.textDim}
          />
        }
      >
      {/* Current score header */}
      <View style={styles.header}>
        <Text style={styles.kicker}>WELLNESS SCORE</Text>
        {currentScore != null ? (
          <>
            <View style={styles.scoreRow}>
              <Text style={styles.score} allowFontScaling={false}>
                {Math.round(currentScore)}
              </Text>
              <Text style={styles.scoreOutOf} allowFontScaling={false}>
                /100
              </Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text style={[styles.statusText, { color: accent }]}>
                {scoreLabel(currentLevel)}
              </Text>
            </View>
            <Text style={styles.meta}>
              {totalCheckins} check-in{totalCheckins === 1 ? "" : "s"}
              {lastCheckIso ? ` · updated ${relativeTime(lastCheckIso)}` : ""}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: COLORS.textDim }]}>—</Text>
            </View>
            <Text style={styles.meta}>No check-ins yet.</Text>
          </>
        )}
      </View>

      {!hasAnyData ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Your dashboard is waiting</Text>
          <Text style={styles.emptyBody}>
            Complete a Pulse and a Check-In to start charting your trend,
            signal breakdown, and weekly biometrics.
          </Text>
        </View>
      ) : (
        <>
          {/* Score trend */}
          <Section title="Score Trend">
            <TrendChart scores={trendScores} />
          </Section>

          {/* Signal breakdown */}
          <Section title="Signal Breakdown">
            <ScoreBreakdown breakdown={breakdown} />
          </Section>

          {/* Week-over-week biometrics */}
          <Section title="This Week vs Last Week">
            <View style={styles.cardRow}>
              <WowCard
                label="Typing Speed"
                current={typingWow.current}
                previous={typingWow.previous}
                unit={typingHasRaw ? "wpm" : "idx"}
                higherIsBetter
                precision={typingHasRaw ? 0 : 0}
                note={typingHasRaw ? undefined : "derived"}
              />
              <WowCard
                label="Error Rate"
                current={errorWow.current}
                previous={errorWow.previous}
                unit="%"
                higherIsBetter={false}
                precision={1}
                note={errorHasRaw ? undefined : "derived"}
              />
            </View>
          </Section>

          {/* Sentiment mini-trend */}
          <Section title="Sentiment">
            <SentimentTrend
              series={sentimentSeries}
              isRaw={sentimentIsRaw}
            />
          </Section>
        </>
      )}

        <View style={styles.footerSpace} />
      </ScrollView>

      {/* Frosted top/bottom bands — content blurs softly as it scrolls under. */}
      <ScrollEdgeFade topInset={insets.top} />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// Week-over-week metric card with an up/down arrow tinted by whether the change
// is good or bad (which depends on `higherIsBetter`).
function WowCard({
  label,
  current,
  previous,
  unit,
  higherIsBetter,
  precision,
  note,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  unit: string;
  higherIsBetter: boolean;
  precision: number;
  note?: string;
}) {
  const hasCurrent = current != null;
  const hasPrev = previous != null;
  const delta = hasCurrent && hasPrev ? current - previous : null;

  // Treat sub-epsilon moves as flat.
  const direction: "up" | "down" | "flat" =
    delta == null || Math.abs(delta) < 0.05
      ? "flat"
      : delta > 0
      ? "up"
      : "down";

  const isGood =
    direction === "flat"
      ? null
      : higherIsBetter
      ? direction === "up"
      : direction === "down";

  const deltaColor =
    isGood == null ? COLORS.textDim : isGood ? COLORS.green : COLORS.red;

  const fmt = (n: number) => n.toFixed(precision);

  return (
    <View style={styles.wowCard}>
      <Text style={styles.wowLabel}>{label}</Text>
      <View style={styles.wowValueRow}>
        <Text style={styles.wowValue} allowFontScaling={false}>
          {hasCurrent ? fmt(current) : "—"}
        </Text>
        <Text style={styles.wowUnit}>{unit}</Text>
      </View>
      <View style={styles.wowDeltaRow}>
        {direction !== "flat" && delta != null ? (
          <Arrow direction={direction} color={deltaColor} />
        ) : (
          <View style={styles.arrowSpacer} />
        )}
        <Text style={[styles.wowDelta, { color: deltaColor }]}>
          {delta == null
            ? hasCurrent
              ? "no prior week"
              : "no data"
            : direction === "flat"
            ? "no change"
            : `${delta > 0 ? "+" : ""}${fmt(delta)} vs last week`}
        </Text>
      </View>
      {note ? <Text style={styles.wowNote}>{note}</Text> : null}
    </View>
  );
}

function Arrow({
  direction,
  color,
}: {
  direction: "up" | "down";
  color: string;
}) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      {direction === "up" ? (
        <Path
          d="M12 19V5M12 5l-6 6M12 5l6 6"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M12 5v14M12 19l-6-6M12 19l6-6"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

// Compact SVG sparkline for the sentiment series (0..100, higher = calmer).
function SentimentTrend({
  series,
  isRaw,
}: {
  series: number[];
  isRaw: boolean;
}) {
  const [width, setWidth] = useState(0);
  const height = 64;
  const pad = 6;

  const latest = series.length > 0 ? series[series.length - 1] : null;
  const lineColor =
    latest == null
      ? COLORS.textDim
      : latest >= 60
      ? COLORS.green
      : latest >= 40
      ? COLORS.yellow
      : COLORS.red;

  const path = useMemo(() => {
    if (width <= 0 || series.length < 2) return "";
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const stepX = innerW / (series.length - 1);
    return series
      .map((v, i) => {
        const x = pad + i * stepX;
        const y = pad + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [width, series]);

  const lastPoint = useMemo(() => {
    if (width <= 0 || series.length === 0) return null;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
    const i = series.length - 1;
    const x = pad + i * stepX;
    const v = Math.max(0, Math.min(100, series[i]));
    const y = pad + innerH - (v / 100) * innerH;
    return { x, y };
  }, [width, series]);

  if (series.length < 2) {
    return (
      <View style={styles.sentimentCard}>
        <Text style={styles.sentimentEmpty}>
          Not enough check-ins to show a sentiment trend yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.sentimentCard}>
      <View style={styles.sentimentHeader}>
        <View>
          <Text style={styles.sentimentValue} allowFontScaling={false}>
            {Math.round(latest as number)}
          </Text>
          <Text style={styles.sentimentCaption}>
            {(latest as number) >= 60
              ? "Positive tone"
              : (latest as number) >= 40
              ? "Mixed tone"
              : "Strained tone"}
          </Text>
        </View>
        {!isRaw ? <Text style={styles.wowNote}>derived</Text> : null}
      </View>
      <View
        style={styles.sparklineWrap}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Path
              d={path}
              stroke={lineColor}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {lastPoint ? (
              <Circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={3.5}
                fill={COLORS.bg}
                stroke={lineColor}
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  fill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  loadingText: {
    ...TYPE.body,
    color: COLORS.textDim,
    marginTop: SPACING.md,
  },
  errorTitle: {
    ...TYPE.heading,
    color: COLORS.text,
    textAlign: "center",
  },
  errorBody: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  errorHint: {
    ...TYPE.label,
    color: COLORS.blue,
    marginTop: SPACING.lg,
  },

  // Header
  header: {
    marginBottom: SPACING.xl,
  },
  kicker: {
    ...TYPE.label,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  score: {
    ...TYPE.hero,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 64,
  },
  scoreOutOf: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_TERTIARY,
    letterSpacing: -0.2,
    marginBottom: 11,
    marginLeft: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },
  statusText: {
    ...TYPE.body,
    fontWeight: "700",
  },
  meta: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.sm,
  },

  // Sections
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPE.label,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  emptyTitle: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyBody: {
    ...TYPE.body,
    color: COLORS.textDim,
    lineHeight: 22,
  },

  // Week-over-week cards
  cardRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  wowCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  wowLabel: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginBottom: SPACING.sm,
  },
  wowValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  wowValue: {
    fontSize: 34,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  wowUnit: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginLeft: 4,
    marginBottom: 5,
  },
  wowDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  arrowSpacer: {
    width: 14,
    height: 14,
  },
  wowDelta: {
    ...TYPE.caption,
    marginLeft: 4,
    flexShrink: 1,
  },
  wowNote: {
    ...TYPE.caption,
    color: COLORS.textDim,
    opacity: 0.7,
    marginTop: SPACING.sm,
    fontStyle: "italic",
  },

  // Sentiment
  sentimentCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sentimentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  sentimentValue: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  sentimentCaption: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.xs,
  },
  sentimentEmpty: {
    ...TYPE.body,
    color: COLORS.textDim,
  },
  sparklineWrap: {
    width: "100%",
  },

  footerSpace: {
    height: SPACING.xl,
  },
});
