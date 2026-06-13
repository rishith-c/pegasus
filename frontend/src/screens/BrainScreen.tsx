// BrainScreen — "Your Brain Activity", a calm, futuristic readout of the live
// neural map. We pull BrainData for the demo user, render the GPU brain point
// cloud (Brain3D), and below it list the flagged regions in plain English.
//
// A "Healthy Baseline" / "Your Pattern" toggle morphs the whole view: in
// Baseline mode every region is shown at a calm resting activation so you can
// see what a settled brain looks like; in Your Pattern mode we show the real
// measured activations. The brain colors and the flagged-region cards animate
// between the two states.
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
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import Brain3D from "../components/Brain3D";
import { getBrainData } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import { BrainData } from "../types";
import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

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

// Display order — most stress-relevant first.
const REGION_ORDER: RegionKey[] = [
  "amygdala_region",
  "prefrontal_cortex",
  "temporal_lobe",
  "motor_cortex",
  "visual_cortex",
];

// A region counts as "flagged" once its activation crosses this threshold.
const FLAG_THRESHOLD = 0.6;

// Calm resting activations used for the "Healthy Baseline" view. Low and even —
// what a settled brain looks like.
const BASELINE: BrainData["regions"] = {
  prefrontal_cortex: 0.22,
  amygdala_region: 0.18,
  temporal_lobe: 0.24,
  motor_cortex: 0.2,
  visual_cortex: 0.26,
};

// Activation 0..1 -> accent. Calm blue, then yellow, then red — mirrors Brain3D.
function activationAccent(a: number): string {
  if (a >= FLAG_THRESHOLD) return COLORS.red;
  if (a >= 0.4) return COLORS.yellow;
  return COLORS.blue;
}

export default function BrainScreen() {
  const insets = useSafeAreaInsets();

  const [brain, setBrain] = useState<BrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // false = "Your Pattern" (live data), true = "Healthy Baseline".
  const [baseline, setBaseline] = useState(false);

  // Drives the toggle pill + card color crossfade. 0 = Your Pattern, 1 = Baseline.
  const morph = useSharedValue(0);

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

  useEffect(() => {
    morph.value = withTiming(baseline ? 1 : 0, {
      duration: 520,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [baseline, morph]);

  // The region set fed to the brain + cards. In baseline mode the cloud rebuilds
  // its colors from the calm resting values; otherwise from the measured data.
  const liveRegions = brain?.regions ?? null;
  const shownRegions = baseline ? BASELINE : liveRegions;

  const flagged = useMemo(() => {
    if (!liveRegions) return [];
    return REGION_ORDER.filter((k) => (liveRegions[k] ?? 0) >= FLAG_THRESHOLD);
  }, [liveRegions]);

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

        {/* 3D brain */}
        <View style={styles.brainCard}>
          {shownRegions ? (
            <Brain3D regions={shownRegions} />
          ) : (
            <View style={styles.brainEmpty}>
              <Text style={styles.brainEmptyText}>No neural data yet.</Text>
            </View>
          )}
        </View>

        {/* Baseline / Your Pattern toggle */}
        <ModeToggle
          baseline={baseline}
          morph={morph}
          onSelect={setBaseline}
        />

        {/* Flagged regions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FLAGGED REGIONS</Text>

          {flagged.length === 0 ? (
            <View style={styles.clearCard}>
              <View style={[styles.clearDot, { backgroundColor: COLORS.green }]} />
              <Text style={styles.clearText}>
                Nothing flagged. Your regions are reading within a calm range.
              </Text>
            </View>
          ) : (
            <View style={styles.regionList}>
              {flagged.map((key) => (
                <RegionCard
                  key={key}
                  region={key}
                  live={liveRegions?.[key] ?? 0}
                  morph={morph}
                />
              ))}
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
    </View>
  );
}

// Segmented toggle. A reanimated highlight slides between the two modes; the
// `morph` value (shared with the cards) keeps everything visually in sync.
function ModeToggle({
  baseline,
  morph,
  onSelect,
}: {
  baseline: boolean;
  morph: Animated.SharedValue<number>;
  onSelect: (baseline: boolean) => void;
}) {
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${morph.value * 50}%`,
    backgroundColor: interpolateColor(
      morph.value,
      [0, 1],
      ["rgba(59, 130, 246, 0.18)", "rgba(34, 197, 94, 0.18)"]
    ),
    borderColor: interpolateColor(
      morph.value,
      [0, 1],
      [COLORS.blue, COLORS.green]
    ),
  }));

  return (
    <View style={styles.toggleWrap}>
      <View style={styles.toggleTrack}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
        <Pressable
          style={styles.toggleSeg}
          onPress={() => onSelect(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !baseline }}
          accessibilityLabel="Show your pattern"
        >
          <Text
            style={[
              styles.toggleText,
              !baseline && { color: COLORS.text },
            ]}
          >
            Your Pattern
          </Text>
        </Pressable>
        <Pressable
          style={styles.toggleSeg}
          onPress={() => onSelect(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: baseline }}
          accessibilityLabel="Show healthy baseline"
        >
          <Text
            style={[
              styles.toggleText,
              baseline && { color: COLORS.text },
            ]}
          >
            Healthy Baseline
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// One flagged region. Its accent crossfades between the calm baseline color and
// the measured (hot) color as the mode toggles, and the activation bar animates
// its width + tint to match.
function RegionCard({
  region,
  live,
  morph,
}: {
  region: RegionKey;
  live: number;
  morph: Animated.SharedValue<number>;
}) {
  const info = REGION_INFO[region];
  const baselineVal = BASELINE[region] ?? 0;
  const liveAccent = activationAccent(live);
  const baselineAccent = activationAccent(baselineVal);

  // Width % and accent both interpolate from the live (Your Pattern) reading to
  // the calm baseline reading as morph goes 0 -> 1.
  const barStyle = useAnimatedStyle(() => ({
    width: `${(live + (baselineVal - live) * morph.value) * 100}%`,
    backgroundColor: interpolateColor(
      morph.value,
      [0, 1],
      [liveAccent, baselineAccent]
    ),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      morph.value,
      [0, 1],
      [liveAccent, baselineAccent]
    ),
  }));

  return (
    <View style={styles.regionCard}>
      <View style={styles.regionHeader}>
        <Animated.View style={[styles.regionDot, dotStyle]} />
        <Text style={styles.regionName}>{info.name}</Text>
        <AnimatedPct
          live={live}
          baseline={baselineVal}
          morph={morph}
          fromColor={liveAccent}
          toColor={baselineAccent}
        />
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, barStyle]} />
      </View>

      <Text style={styles.regionPlain}>{info.plain}</Text>
    </View>
  );
}

// The numeric percentage label. Reanimated can't drive text content from the UI
// thread, so we poll the shared `morph` value on the JS thread to tween the
// number, and animate the text color in lockstep via interpolateColor.
function AnimatedPct({
  live,
  baseline,
  morph,
  fromColor,
  toColor,
}: {
  live: number;
  baseline: number;
  morph: Animated.SharedValue<number>;
  fromColor: string;
  toColor: string;
}) {
  const [shown, setShown] = useState(Math.round(live * 100));

  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(morph.value, [0, 1], [fromColor, toColor]),
  }));

  // Poll the morph value until it settles into its target mode, updating the
  // displayed integer percentage as it tweens.
  useEffect(() => {
    const id = setInterval(() => {
      const v = morph.value;
      setShown(Math.round((live + (baseline - live) * v) * 100));
      if (v <= 0.001 || v >= 0.999) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [live, baseline, morph]);

  return (
    <Animated.Text style={[styles.regionPct, colorStyle]}>{shown}%</Animated.Text>
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

  // 3D brain card
  brainCard: {
    height: 320,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },
  brainEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  brainEmptyText: {
    ...TYPE.body,
    color: COLORS.textDim,
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
    position: "relative",
  },
  toggleThumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    // Half the track minus the 4px outer padding on each side, so the thumb
    // sits flush inside whichever half `left` (0% or 50%) places it.
    width: "50%",
    marginHorizontal: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  toggleSeg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    zIndex: 1,
  },
  toggleText: {
    ...TYPE.label,
    color: COLORS.textDim,
  },

  // Flagged regions
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
  },
  regionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  regionDot: {
    width: 9,
    height: 9,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },
  regionName: {
    ...TYPE.heading,
    color: COLORS.text,
    flex: 1,
  },
  regionPct: {
    ...TYPE.heading,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: SPACING.md,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  regionPlain: {
    ...TYPE.body,
    color: COLORS.textDim,
    lineHeight: 22,
    marginTop: SPACING.md,
  },

  // Clear (nothing flagged)
  clearCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  clearDot: {
    width: 9,
    height: 9,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.md,
  },
  clearText: {
    ...TYPE.body,
    color: COLORS.textDim,
    flex: 1,
    lineHeight: 22,
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
