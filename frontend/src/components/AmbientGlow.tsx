import React from 'react';
import { View, StyleSheet } from 'react-native';
import { hexToRgba } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

export default function AmbientGlow() {
  const { colors, isDark } = useTheme();
  const alpha = isDark ? 0.16 : 0.3;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.blob, styles.blobTop, { backgroundColor: hexToRgba(colors.blue, alpha) }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: hexToRgba(colors.green, alpha) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 320, height: 320, borderRadius: 160 },
  blobTop: { top: -120, right: -110 },
  blobBottom: { bottom: -100, left: -130 },
});
