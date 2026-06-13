import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/colors';

interface InterventionCardProps {
  text: string;
}

export default function InterventionCard({ text }: InterventionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>SUGGESTION</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  label: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6,
    fontWeight: '700',
  },
  text: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 22,
  },
});
