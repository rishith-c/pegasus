import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { COLORS } from '../utils/colors';

interface TrendChartProps {
  data: { date: string; score: number }[];
}

const screenWidth = Dimensions.get('window').width;

export default function TrendChart({ data }: TrendChartProps) {
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
          backgroundColor: COLORS.card,
          backgroundGradientFrom: COLORS.card,
          backgroundGradientTo: COLORS.card,
          decimalPlaces: 0,
          color: () => COLORS.blue,
          labelColor: () => COLORS.textDim,
          propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.blue },
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
