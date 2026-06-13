import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/colors';

interface IndicatorCardProps {
  label: string;
}

export default function IndicatorCard({ label }: IndicatorCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.dot} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
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
    color: COLORS.textDim,
    fontSize: 13,
  },
});
