import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../theme/ThemeContext';

interface TrendChartProps {
  data: { date: string; score: number }[];
}

const screenWidth = Dimensions.get('window').width;

export default function TrendChart({ data }: TrendChartProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels: data.map((d) => d.date),
          datasets: [{ data: data.map((d) => d.score) }],
        }}
        width={screenWidth - 48}
        height={200}
        chartConfig={{
          backgroundColor: colors.card,
          backgroundGradientFrom: colors.card,
          backgroundGradientTo: colors.card,
          decimalPlaces: 0,
          color: () => colors.blue,
          labelColor: () => colors.textDim,
          propsForDots: { r: '4', strokeWidth: '2', stroke: colors.blue },
          fillShadowGradientOpacity: 0,
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 24 },
  chart: { borderRadius: 16 },
});
