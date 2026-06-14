import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, ColorTheme } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: { gap: 12 },
    row: { flexDirection: 'row', alignItems: 'center' },
    label: { color: colors.textDim, fontSize: 13, width: 70 },
    track: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginHorizontal: 10,
    },
    fill: { height: '100%', borderRadius: 4 },
    value: { color: colors.text, fontSize: 13, width: 40, textAlign: 'right' },
  });
}
