import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, levelColor, Level } from '../utils/colors';

interface CheckEngineProps {
  score: number;
  level: Level;
  size?: number;
}

// Durations are for one direction of the breath; full cycle = 2x duration.
const PULSE_DURATION: Record<Level, number> = {
  green: 4000, // slow, calm breathing (~7-8 breaths/min)
  yellow: 3000, // gently elevated (~10 breaths/min)
  red: 2000, // alert but not frantic (~15 breaths/min)
};

const PULSE_SCALE: Record<Level, number> = {
  green: 1.04,
  yellow: 1.06,
  red: 1.09,
};

export default function CheckEngine({ score, level, size = 240 }: CheckEngineProps) {
  const progress = useSharedValue(0);
  const color = levelColor(level);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: PULSE_DURATION[level],
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: PULSE_DURATION[level],
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1
    );
  }, [level]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, PULSE_SCALE[level]]) }],
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({ opacity: 0.12 * interpolate(progress.value, [0, 1], [0.5, 1]) }));
  const midGlowStyle = useAnimatedStyle(() => ({ opacity: 0.22 * interpolate(progress.value, [0, 1], [0.5, 1]) }));

  const outer = size * 1.35;
  const mid = size * 1.15;

  return (
    <View style={[styles.wrapper, { width: outer, height: outer }]}>
      <Animated.View style={[styles.center, animatedStyle, { width: outer, height: outer }]}>
        <Animated.View
          style={[
            styles.layer,
            outerGlowStyle,
            { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: color },
          ]}
        />
        <Animated.View
          style={[
            styles.layer,
            midGlowStyle,
            { width: mid, height: mid, borderRadius: mid / 2, backgroundColor: color },
          ]}
        />
        <LinearGradient
          colors={[color, '#080b0f']}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={[styles.layer, styles.core, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text style={styles.score}>{Math.round(score)}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  core: {},
  score: { fontSize: 64, fontWeight: '800', color: COLORS.text },
});
