import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

interface PulseRingProps {
  children: React.ReactNode;
  duration?: number;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

export default function PulseRing({ children, duration = 4000, scaleTo = 1.16, style }: PulseRingProps) {
  const { isDark } = useTheme();
  const progress = useSharedValue(0);
  const minOpacity = isDark ? 0.6 : 1;

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [duration, scaleTo]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, scaleTo]) }],
    opacity: interpolate(progress.value, [0, 1], [minOpacity, 1]),
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
