import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface PulseRingProps {
  children: React.ReactNode;
  duration?: number;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

export default function PulseRing({ children, duration = 1500, scaleTo = 1.08, style }: PulseRingProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(scaleTo, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [duration, scaleTo]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
