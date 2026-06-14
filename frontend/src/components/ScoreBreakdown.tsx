// ScoreBreakdown — horizontal bars for the 5 signal streams.
// Owned by Wesley (visual layer). "Tesla dashboard for your mind."
//
// Each bar shows how much *strain* a single signal is contributing (higher =
// more strain), so it reads independently of the overall wellness score. Bars
// fill 0..100, colored low→high (green → yellow → red), and animate their width
// in on mount / when values change.

import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

type Stream = "imessage" | "typing" | "facial" | "voice" | "tribe";

interface ScoreBreakdownProps {
  breakdown: {
    imessage: number;
    typing: number;
    facial: number;
    voice: number;
    tribe: number;
  };
}

// Display order + human labels for each stream.
const STREAMS: { key: Stream; label: string }[] = [
  { key: "imessage", label: "iMessage" },
  { key: "typing", label: "Typing" },
  { key: "facial", label: "Facial" },
  { key: "voice", label: "Voice" },
  { key: "tribe", label: "Tribe" },
];

// Clamp any incoming number into the 0..100 range we render against.
function clamp(n: number): number {
  if (n == null || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

// Higher stream value = more strain. Green calm, yellow watch, red alert.
function barColor(value: number): string {
  if (value >= 66) return COLORS.red;
  if (value >= 33) return COLORS.yellow;
  return COLORS.green;
}

function Bar({
  label,
  value,
  index,
}: {
  label: string;
  value: number;
  index: number;
}) {
  const progress = useSharedValue(0);
  const color = barColor(value);

  useEffect(() => {
    progress.value = withDelay(
      index * 90,
      withTiming(value, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [value, index, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{Math.round(value)}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { backgroundColor: color }, fillStyle]}
        />
      </View>
    </View>
  );
}

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  const rows = useMemo(
    () =>
      STREAMS.map(({ key, label }) => ({
        key,
        label,
        value: clamp(breakdown?.[key]),
      })),
    [breakdown]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Signal Breakdown</Text>
      {rows.map((row, i) => (
        <Bar key={row.key} label={row.label} value={row.value} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    ...TYPE.label,
    color: COLORS.textDim,
    textTransform: "uppercase",
    marginBottom: SPACING.lg,
  },
  row: {
    marginBottom: SPACING.md,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPE.body,
    color: COLORS.text,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  track: {
    height: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
});
