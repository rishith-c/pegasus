import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { hexToRgba } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

interface GlassCardProps {
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  children?: React.ReactNode;
}

export default function GlassCard({ style, intensity = 30, children }: GlassCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        style,
        styles.glass,
        {
          backgroundColor: hexToRgba(colors.card, isDark ? 0.45 : 0.6),
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.7)',
        },
      ]}
    >
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
