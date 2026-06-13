// PulseRing — reusable animated concentric rings that sit behind CheckEngine.
// A calm radar-style pulse: rings expand outward and fade, looping forever.
// Driven by a single reanimated shared value for cheap 60fps motion.

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export interface PulseRingProps {
  /** Ring stroke/glow color (typically the burnout level accent). */
  color: string;
  /** Diameter of the largest ring, in px. The container is sized to this. */
  size: number;
  /** Duration of one full expand+fade cycle, in ms. Defaults to 2600. */
  speedMs?: number;
}

// Number of concentric rings. Staggered so the pulse reads as continuous.
const RING_COUNT = 3;

interface RingProps {
  progress: Animated.SharedValue<number>;
  color: string;
  size: number;
  // Phase offset in [0,1) so rings don't all pulse in unison.
  offset: number;
}

function Ring({ progress, color, size, offset }: RingProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Each ring runs the same 0->1 cycle, shifted by its offset and wrapped.
    const t = (progress.value + offset) % 1;
    // Grow from a small core out to full size.
    const scale = interpolate(t, [0, 1], [0.35, 1]);
    // Bright as it emerges, fading to nothing at the edge. Quick fade-in
    // at the very start avoids a hard pop when the ring respawns.
    const opacity = interpolate(t, [0, 0.12, 1], [0, 0.55, 0]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function PulseRing({ color, size, speedMs = 2600 }: PulseRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: speedMs, easing: Easing.linear }),
      -1, // infinite
      false // no reverse — rings always travel outward
    );
    return () => cancelAnimation(progress);
  }, [progress, speedMs]);

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { width: size, height: size }]}
    >
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <Ring
          key={i}
          progress={progress}
          color={color}
          size={size}
          offset={i / RING_COUNT}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
  },
});
