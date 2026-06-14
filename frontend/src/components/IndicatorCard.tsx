import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, ColorTheme } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';
import GlassCard from './GlassCard';

interface IndicatorCardProps {
  label: string;
}

export default function IndicatorCard({ label }: IndicatorCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <GlassCard style={styles.card} intensity={30}>
      <View style={styles.dot} />
      <Text style={styles.label}>{label}</Text>
    </GlassCard>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginRight: 8,
      marginBottom: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.yellow,
      marginRight: 8,
    },
    label: {
      color: colors.textDim,
      fontSize: 13,
    },
  });
}
