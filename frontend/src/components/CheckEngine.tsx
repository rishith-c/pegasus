// CheckEngine — the hero component. A large, living, pulsing score orb.
// "Tesla dashboard for your mind": glowing ring, breathing pulse, calm numerals.
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, levelColor } from "../utils/colors";
import type { BurnoutLevel } from "../utils/colors";

interface CheckEngineProps {
  score: number;
  level: BurnoutLevel;
  size?: number;
}

// Pulse cadence by level — calmer when green, urgent when red.
const PULSE_MS: Record<BurnoutLevel, number> = {
  green: 2000,
  yellow: 1200,
  red: 600,
};

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function CheckEngine({ score, level, size = 260 }: CheckEngineProps) {
  // Breathing scale 1.0 -> 1.12 -> 1.0, speed driven by level.
  const pulse = useSharedValue(0);
  // 0 = green, 1 = yellow, 2 = red. Animated for smooth color transitions.
  const levelIndex = useSharedValue(level === "yellow" ? 1 : level === "red" ? 2 : 0);

  const duration = PULSE_MS[level] ?? PULSE_MS.green;

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(pulse);
  }, [duration, pulse]);

  useEffect(() => {
    const target = level === "yellow" ? 1 : level === "red" ? 2 : 0;
    levelIndex.value = withTiming(target, { duration: 600, easing: Easing.out(Easing.ease) });
  }, [level, levelIndex]);

  // Smoothly-interpolated accent color tracking the level transition.
  const accent = useDerivedValue(() =>
    interpolateColor(
      levelIndex.value,
      [0, 1, 2],
      [COLORS.green, COLORS.yellow, COLORS.red]
    )
  );

  // Outer glow ring: scales with the pulse, glows in the accent color.
  const ringStyle = useAnimatedStyle(() => {
    const scale = 1 + pulse.value * 0.12;
    const c = accent.value;
    return {
      transform: [{ scale }],
      borderColor: c,
      shadowColor: c,
      shadowOpacity: 0.55 + pulse.value * 0.35,
      shadowRadius: 28 + pulse.value * 22,
    };
  });

  // A second, larger halo ring for layered glow depth.
  const haloStyle = useAnimatedStyle(() => {
    const scale = 1 + pulse.value * 0.18;
    const c = accent.value;
    return {
      transform: [{ scale }],
      borderColor: c,
      opacity: 0.18 + pulse.value * 0.12,
      shadowColor: c,
      shadowOpacity: 0.4 + pulse.value * 0.3,
      shadowRadius: 40 + pulse.value * 30,
    };
  });

  // Radial-ish fill: tint shifts subtly with the accent color.
  const fillStyle = useAnimatedStyle(() => ({
    shadowColor: accent.value,
    shadowOpacity: 0.5 + pulse.value * 0.25,
    shadowRadius: 24 + pulse.value * 16,
  }));

  // Thin accent text color synced to the live accent.
  const accentTextStyle = useAnimatedStyle(() => ({ color: accent.value }));

  // Static fallback color for the gradient (LinearGradient colors can't be
  // animated per-frame cheaply, so we re-key it on level change instead).
  const c = levelColor(level);
  const ringDim = size;
  const haloDim = size + 36;
  const fillDim = size - 28;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <View style={[styles.root, { width: haloDim + 80, height: haloDim + 80 }]}>
      {/* Outer halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ringAbs,
          {
            width: haloDim,
            height: haloDim,
            borderRadius: haloDim / 2,
            borderWidth: 1,
          },
          haloStyle,
        ]}
      />

      {/* Primary glowing ring */}
      <Animated.View
        style={[
          styles.ringAbs,
          {
            width: ringDim,
            height: ringDim,
            borderRadius: ringDim / 2,
            borderWidth: 2,
          },
          ringStyle,
        ]}
      >
        {/* Radial-ish gradient fill via stacked linear gradients */}
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillDim,
              height: fillDim,
              borderRadius: fillDim / 2,
            },
            fillStyle,
          ]}
        >
          <LinearGradient
            colors={[withAlpha(c, 0.28), withAlpha(c, 0.08), COLORS.card]}
            start={{ x: 0.3, y: 0.15 }}
            end={{ x: 0.7, y: 0.95 }}
            style={[StyleSheet.absoluteFill, { borderRadius: fillDim / 2 }]}
          />
          <LinearGradient
            colors={[withAlpha(c, 0.22), "transparent", "transparent"]}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.85, y: 0.85 }}
            style={[StyleSheet.absoluteFill, { borderRadius: fillDim / 2 }]}
          />

          {/* Center numerals */}
          <View style={styles.center}>
            <View style={styles.scoreRow}>
              <Text style={styles.score} allowFontScaling={false}>
                {clamped}
              </Text>
              <Text style={styles.outOf} allowFontScaling={false}>
                /100
              </Text>
            </View>
            <Animated.Text style={[styles.label, accentTextStyle]} allowFontScaling={false}>
              {labelFor(level)}
            </Animated.Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function labelFor(level: BurnoutLevel): string {
  switch (level) {
    case "green":
      return "CALM";
    case "yellow":
      return "ELEVATED";
    case "red":
      return "BURNOUT RISK";
    default:
      return "";
  }
}

// Convert a hex color to rgba with the given alpha.
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringAbs: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    // iOS glow; Android approximates via elevation on the fill.
    shadowOffset: { width: 0, height: 0 },
  },
  fill: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: COLORS.card,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  score: {
    fontSize: 56,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -1.5,
    lineHeight: 60,
  },
  outOf: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textDim,
    marginBottom: 9,
    marginLeft: 2,
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
