import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/colors';

interface BreakdownItem {
  label: string;
  value: number; // 0-1
}

interface ScoreBreakdownProps {
  items: BreakdownItem[];
}

function barColor(value: number) {
  if (value < 0.3) return COLORS.green;
  if (value < 0.65) return COLORS.yellow;
  return COLORS.red;
}

export default function ScoreBreakdown({ items }: ScoreBreakdownProps) {
  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(item.value * 100)}%`, backgroundColor: barColor(item.value) },
              ]}
            />
          </View>
          <Text style={styles.value}>{Math.round(item.value * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: COLORS.textDim, fontSize: 13, width: 70 },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  fill: { height: '100%', borderRadius: 4 },
  value: { color: COLORS.text, fontSize: 13, width: 40, textAlign: 'right' },
});
