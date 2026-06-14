import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ColorTheme } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';
import GlassCard from './GlassCard';

interface InterventionCardProps {
  text: string;
}

export default function InterventionCard({ text }: InterventionCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <GlassCard style={styles.card} intensity={30}>
      <Text style={styles.label}>SUGGESTION</Text>
      <Text style={styles.text}>{text}</Text>
    </GlassCard>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
    },
    label: {
      color: colors.textDim,
      fontSize: 11,
      letterSpacing: 2,
      marginBottom: 6,
      fontWeight: '700',
    },
    text: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
    },
  });
}
