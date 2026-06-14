// BrainScreen — "Your Brain Activity", a calm, plain-English readout of the live
// neural map. We pull BrainData for the demo user and, for each region, simply
// state whether it's affected and what that means — no 3D, no jargon.
//
// A "Your Pattern" / "Healthy Baseline" toggle drives the numbers: in Baseline
// mode every region is shown at a calm resting activation so you can see what a
// settled brain reads like; in Your Pattern mode we show the real measured
// activations. Regions are ordered most-affected first.
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getBrainData } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import { BrainData } from "../types";
import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";
import ScrollEdgeFade from "../components/ScrollEdgeFade";

type RegionKey = keyof BrainData["regions"];

// Human-readable name + a plain-English description of what elevated activation
// in each region tends to mean for stress / burnout. Kept gentle, not clinical.
const REGION_INFO: Record<
  RegionKey,
  { name: string; plain: string }
> = {
  prefrontal_cortex: {
    name: "Prefrontal Cortex",
    plain:
      "Your focus and decision-making hub. When it runs hot, planning feels harder and small choices get heavy.",
  },
  amygdala_region: {
    name: "Amygdala",
    plain:
      "Your alarm system. Elevated activity here points to heightened stress, worry, or feeling on-edge.",
  },
  temporal_lobe: {
    name: "Temporal Lobe",
    plain:
      "Tied to memory and processing language. High activation can show up as mental fog or replaying conversations.",
  },
  motor_cortex: {
    name: "Motor Cortex",
    plain:
      "Drives movement and restlessness. Spikes here often track with fidgeting, tension, or trouble settling.",
  },
  visual_cortex: {
    name: "Visual Cortex",
    plain:
      "Processes what you see. Sustained load here can reflect long, unbroken hours staring at screens.",
  },
};

// Stable tie-break order — most stress-relevant first. Used when two regions
// read the same activation, so the list never jitters between renders.
const REGION_ORDER: RegionKey[] = [
  "amygdala_region",
  "prefrontal_cortex",
  "temporal_lobe",
  "motor_cortex",
  "visual_cortex",
];

// Thresholds. At/above HOT a region is "Affected"; at/above WARM it's
// "Elevated"; below that it's "Calm".
const HOT_THRESHOLD = 0.6;
const WARM_THRESHOLD = 0.4;

// Calm resting activations used for the "Healthy Baseline" view. Low and even —
// what a settled brain looks like.
const BASELINE: BrainData["regions"] = {
  prefrontal_cortex: 0.22,
  amygdala_region: 0.18,
  temporal_lobe: 0.24,
  motor_cortex: 0.2,
  visual_cortex: 0.26,
};

type Status = {
  label: string; // pill + headline word, e.g. "Affected"
  accent: string; // bar + pill color
  tint: string; // pill background wash
};

// Activation 0..1 -> status. Red "Affected", amber "Elevated", green "Calm".
function statusFor(a: number): Status {
  if (a >= HOT_THRESHOLD) {
    return { label: "Affected", accent: COLORS.red, tint: "rgba(255,59,48,0.12)" };
  }
  if (a >= WARM_THRESHOLD) {
    return { label: "Elevated", accent: COLORS.yellow, tint: "rgba(255,159,10,0.14)" };
  }
  return { label: "Calm", accent: COLORS.green, tint: "rgba(52,199,89,0.14)" };
}

// One-line, human verdict for a region given its activation.
function verdictFor(name: string, a: number): string {
  if (a >= HOT_THRESHOLD) return `${name} — affected. This region is reading hot.`;
  if (a >= WARM_THRESHOLD)
    return `${name} — slightly elevated. Worth keeping an eye on.`;
  return `${name} — calm. Sitting in a healthy range.`;
}

export default function BrainScreen() {
  const insets = useSafeAreaInsets();

  const [brain, setBrain] = useState<BrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // false = "Your Pattern" (live data), true = "Healthy Baseline".
  const [baseline, setBaseline] = useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    getBrainData(DEFAULT_USER_ID)
      .then((d) => setBrain(d))
      .catch((e) => setError(e?.message ?? "Could not reach the brain map."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The region set fed to the cards. Baseline mode shows calm resting values;
  // otherwise the measured data.
  const shownRegions = baseline ? BASELINE : brain?.regions ?? null;

  // Regions sorted most-affected first; ties broken by REGION_ORDER.
  const ranked = useMemo(() => {
    if (!shownRegions) return [];
    return [...REGION_ORDER].sort((a, b) => {
      const diff = (shownRegions[b] ?? 0) - (shownRegions[a] ?? 0);
      if (diff !== 0) return diff;
      return REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b);
    });
  }, [shownRegions]);

  // How many regions are reading hot — drives the summary line.
  const hotCount = useMemo(
    () =>
      shownRegions
        ? REGION_ORDER.filter((k) => (shownRegions[k] ?? 0) >= HOT_THRESHOLD).length
        : 0,
    [shownRegions]
  );

  // First load: calm, minimal spinner.
  if (loading && !brain) {
    return (
      <View style={[styles.root, styles.centerRoot]}>
        <Text style={styles.kicker}>META TRIBE v2</Text>
        <ActivityIndicator color={COLORS.blue} style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Reading your neural signals…</Text>
      </View>
    );
  }

  // Error / unreachable: clear, non-alarming fallback with a retry.
  if (error && !brain) {
    return (
      <View style={[styles.root, styles.centerRoot]}>
        <Text style={styles.kicker}>META TRIBE v2</Text>
        <Text style={styles.errorTitle}>Brain map unavailable</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Pressable
          onPress={load}
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="Retry loading brain data"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const summaryText =
    hotCount === 0
      ? "All regions calm"
      : `${hotCount} region${hotCount === 1 ? "" : "s"} reading hot`;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SPACING.lg, paddingBottom: SPACING.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={COLORS.textDim}
            colors={[COLORS.blue]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Brain Activity</Text>
          <View style={styles.poweredRow}>
            <View style={styles.poweredDot} />
            <Text style={styles.powered}>powered by Meta TRIBE v2</Text>
          </View>
        </View>

        {/* Summary banner */}
        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryDot,
              { backgroundColor: hotCount === 0 ? COLORS.green : COLORS.red },
            ]}
          />
          <Text style={styles.summaryText}>{summaryText}</Text>
        </View>

        {/* Your Pattern / Healthy Baseline toggle (drives the readout) */}
        <ModeToggle baseline={baseline} onSelect={setBaseline} />

        {/* Per-region readout — most affected first */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AFFECTED REGIONS</Text>

          {shownRegions ? (
            <View style={styles.regionList}>
              {ranked.map((key) => (
                <RegionCard
                  key={key}
                  region={key}
                  activation={shownRegions[key] ?? 0}
                />
              ))}
            </View>
          ) : (
            <View style={styles.summaryCard}>
              <View style={[styles.summaryDot, { backgroundColor: COLORS.textDim }]} />
              <Text style={styles.summaryText}>No neural data yet.</Text>
            </View>
          )}
        </View>

        {brain && (
          <Text style={styles.meanFootnote}>
            Mean activation across all regions:{" "}
            <Text style={styles.meanValue}>
              {Math.round((brain.activation_mean ?? 0) * 100)}%
            </Text>
          </Text>
        )}
      </ScrollView>

      {/* Frosted top/bottom bands — content blurs softly as it scrolls under. */}
      <ScrollEdgeFade topInset={insets.top} />
    </View>
  );
}

// Plain segmented control — no animation, just clean state. Selecting a segment
// swaps the activations the cards read from.
function ModeToggle({
  baseline,
  onSelect,
}: {
  baseline: boolean;
  onSelect: (baseline: boolean) => void;
}) {
  return (
    <View style={styles.toggleWrap}>
      <View style={styles.toggleTrack}>
        <Pressable
          style={[styles.toggleSeg, !baseline && styles.toggleSegActive]}
          onPress={() => onSelect(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !baseline }}
          accessibilityLabel="Show your pattern"
        >
          <Text style={[styles.toggleText, !baseline && styles.toggleTextActive]}>
            Your Pattern
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleSeg, baseline && styles.toggleSegActive]}
          onPress={() => onSelect(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: baseline }}
          accessibilityLabel="Show healthy baseline"
        >
          <Text style={[styles.toggleText, baseline && styles.toggleTextActive]}>
            Healthy Baseline
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// One region, stated plainly: name + status pill, a thin activation bar, the
// one-line verdict, and the gentle description of what this region does.
function RegionCard({
  region,
  activation,
}: {
  region: RegionKey;
  activation: number;
}) {
  const info = REGION_INFO[region];
  const status = statusFor(activation);
  const pct = Math.round(activation * 100);

  return (
    <View style={styles.regionCard}>
      <View style={styles.regionHeader}>
        <Text style={styles.regionName}>{info.name}</Text>
        <View style={[styles.pill, { backgroundColor: status.tint }]}>
          <View style={[styles.pillDot, { backgroundColor: status.accent }]} />
          <Text style={[styles.pillText, { color: status.accent }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${pct}%`, backgroundColor: status.accent },
            ]}
          />
        </View>
        <Text style={[styles.barPct, { color: status.accent }]}>{pct}%</Text>
      </View>

      <Text style={styles.regionVerdict}>{verdictFor(info.name, activation)}</Text>
      <Text style={styles.regionPlain}>{info.plain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerRoot: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
  },
  kicker: {
    ...TYPE.label,
    color: COLORS.blue,
    letterSpacing: 2,
  },
  loadingSpinner: {
    marginTop: SPACING.xl,
  },
  loadingText: {
    ...TYPE.body,
    color: COLORS.textDim,
    marginTop: SPACING.md,
  },
  errorTitle: {
    ...TYPE.heading,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  errorBody: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.card,
  },
  retryText: {
    ...TYPE.body,
    color: COLORS.text,
    fontWeight: "700",
  },

  // Header
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPE.title,
    color: COLORS.text,
  },
  poweredRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  poweredDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.blue,
    marginRight: SPACING.sm,
  },
  powered: {
    ...TYPE.caption,
    color: COLORS.textDim,
    letterSpacing: 0.6,
  },

  // Summary banner
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  summaryDot: {
    width: 9,
    height: 9,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.md,
  },
  summaryText: {
    ...TYPE.heading,
    color: COLORS.text,
    flex: 1,
  },

  // Toggle
  toggleWrap: {
    marginTop: SPACING.lg,
  },
  toggleTrack: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    padding: 4,
  },
  toggleSeg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  toggleSegActive: {
    backgroundColor: "rgba(0,113,227,0.10)",
  },
  toggleText: {
    ...TYPE.label,
    color: COLORS.textDim,
  },
  toggleTextActive: {
    color: COLORS.blue,
  },

  // Region readout
  section: {
    marginTop: SPACING.xl,
  },
  sectionLabel: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },
  regionList: {
    gap: SPACING.md,
  },
  regionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  regionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  regionName: {
    ...TYPE.heading,
    color: COLORS.text,
    flex: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.xs + 2,
  },
  pillText: {
    ...TYPE.label,
    letterSpacing: 0.2,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  barPct: {
    ...TYPE.label,
    fontVariant: ["tabular-nums"],
    marginLeft: SPACING.md,
    width: 40,
    textAlign: "right",
  },
  regionVerdict: {
    ...TYPE.body,
    fontWeight: "600",
    color: COLORS.text,
    lineHeight: 22,
    marginTop: SPACING.md,
  },
  regionPlain: {
    ...TYPE.body,
    color: COLORS.textDim,
    lineHeight: 22,
    marginTop: SPACING.xs,
  },

  meanFootnote: {
    ...TYPE.caption,
    color: COLORS.textDim,
    textAlign: "center",
    marginTop: SPACING.xl,
  },
  meanValue: {
    color: COLORS.text,
    fontWeight: "700",
  },
});
