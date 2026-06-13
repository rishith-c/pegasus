import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, levelColor, Level } from '../utils/colors';

interface CheckEngineProps {
  score: number;
  level: Level;
  size?: number;
}

const PULSE_DURATION: Record<Level, number> = {
  green: 2000,
  yellow: 1200,
  red: 600,
};

const PULSE_SCALE: Record<Level, number> = {
  green: 1.05,
  yellow: 1.08,
  red: 1.14,
};

export default function CheckEngine({ score, level, size = 240 }: CheckEngineProps) {
  const scale = useSharedValue(1);
  const color = levelColor(level);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(PULSE_SCALE[level], {
          duration: PULSE_DURATION[level],
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: PULSE_DURATION[level],
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1
    );
  }, [level]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const outer = size * 1.35;
  const mid = size * 1.15;

  return (
    <View style={[styles.wrapper, { width: outer, height: outer }]}>
      <Animated.View style={[styles.center, animatedStyle, { width: outer, height: outer }]}>
        <View
          style={[
            styles.layer,
            { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: color, opacity: 0.12 },
          ]}
        />
        <View
          style={[
            styles.layer,
            { width: mid, height: mid, borderRadius: mid / 2, backgroundColor: color, opacity: 0.22 },
          ]}
        />
        <LinearGradient
          colors={[color, '#05050a']}
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
