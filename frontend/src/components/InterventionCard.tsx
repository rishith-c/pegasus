// InterventionCard — warm, friendly card for the HF-generated intervention.
// Slightly highlighted with a soft glow, a small "suggestion" label, and
// readable body copy. Subtle entrance via reanimated. Owned by the visual layer.

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

type Props = {
  text: string;
};

export default function InterventionCard({ text }: Props) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(
      80,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
  }, [enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));

  const message = text?.trim();

  return (
    <Animated.View style={animatedStyle}>
      <LinearGradient
        colors={["#16131f", "#12121a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Warm accent rail on the left edge */}
        <View style={styles.rail} />

        <View style={styles.body}>
          <View style={styles.labelRow}>
            <View style={styles.dot} />
            <Text style={styles.label}>SUGGESTION</Text>
          </View>

          <Text style={styles.message}>
            {message && message.length > 0
              ? message
              : "Take a breath. A small reset can go a long way right now."}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// Warm amber accent for the friendly, encouraging tone.
const WARM = COLORS.yellow;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.22)",
    overflow: "hidden",
    // Soft warm glow to make the card feel highlighted and inviting.
    shadowColor: WARM,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  rail: {
    width: 3,
    backgroundColor: WARM,
  },
  body: {
    flex: 1,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WARM,
    marginRight: SPACING.sm,
  },
  label: {
    ...TYPE.label,
    color: WARM,
    letterSpacing: 1.2,
  },
  message: {
    ...TYPE.body,
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "500",
  },
});
