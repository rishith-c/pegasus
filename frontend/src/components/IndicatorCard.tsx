import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

// Tones map to the design system's accent palette. "neutral" falls back to
// dim text so an unspecified indicator still reads as calm, not alarming.
export type IndicatorTone = "green" | "yellow" | "red" | "blue" | "neutral";

const TONE_COLOR: Record<IndicatorTone, string> = {
  green: COLORS.green,
  yellow: COLORS.yellow,
  red: COLORS.red,
  blue: COLORS.blue,
  neutral: COLORS.textDim,
};

interface IndicatorCardProps {
  text: string;
  tone?: IndicatorTone;
}

// Small, single-line indicator: a tone-colored dot beside one short insight.
// Renders nothing for empty/whitespace text so callers can pass through
// optional data without an empty shell appearing.
export default function IndicatorCard({ text, tone = "neutral" }: IndicatorCardProps) {
  const label = text?.trim();
  if (!label) return null;

  const dotColor = TONE_COLOR[tone] ?? TONE_COLOR.neutral;

  return (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md + 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.md,
  },
  text: {
    flex: 1,
    ...TYPE.body,
    color: COLORS.text,
  },
});
