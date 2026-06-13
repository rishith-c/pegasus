// TrendChart — burnout score history as a calm, dark line chart.
// Wraps react-native-chart-kit's LineChart. The line is tinted by the
// burnout zone of the most recent score (green / yellow / red).
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

const CHART_HEIGHT = 200;
const CARD_PADDING = SPACING.md;

interface TrendChartProps {
  scores: number[];
  labels?: string[];
}

// Burnout score zone -> accent hex. Higher score = more burnout.
function zoneColor(score: number): string {
  if (score >= 70) return COLORS.red;
  if (score >= 40) return COLORS.yellow;
  return COLORS.green;
}

// chart-kit expects a color function: (opacity) => rgba string.
function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function TrendChart({ scores, labels }: TrendChartProps) {
  // chart-kit's container has horizontal padding baked in; measuring the
  // available width keeps the chart from overflowing the card.
  const [chartWidth, setChartWidth] = React.useState(0);

  const lineColor = useMemo(
    () => (scores.length > 0 ? zoneColor(scores[scores.length - 1]) : COLORS.blue),
    [scores]
  );

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: COLORS.card,
      backgroundGradientTo: COLORS.card,
      backgroundGradientFromOpacity: 1,
      backgroundGradientToOpacity: 1,
      decimalPlaces: 0,
      color: (opacity = 1) => hexToRgba(lineColor, opacity),
      labelColor: (opacity = 1) => hexToRgba(COLORS.textDim, opacity),
      propsForBackgroundLines: {
        stroke: COLORS.border,
        strokeWidth: 1,
      },
      propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: lineColor,
        fill: COLORS.bg,
      },
      propsForLabels: {
        fontSize: 11,
      },
    }),
    [lineColor]
  );

  // <2 points can't form a trend — show a calm placeholder instead.
  if (!scores || scores.length < 2) {
    return (
      <View style={styles.card}>
        <View style={[styles.placeholder, { height: CHART_HEIGHT }]}>
          <Text style={styles.placeholderTitle}>Not enough data yet</Text>
          <Text style={styles.placeholderBody}>
            Check in a few more times to see your burnout trend.
          </Text>
        </View>
      </View>
    );
  }

  const data = {
    labels: labels && labels.length === scores.length ? labels : scores.map(() => ""),
    datasets: [
      {
        data: scores,
        color: (opacity = 1) => hexToRgba(lineColor, opacity),
        strokeWidth: 3,
      },
    ],
  };

  return (
    <View
      style={styles.card}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
    >
      {chartWidth > 0 ? (
        <LineChart
          data={data}
          width={chartWidth - CARD_PADDING * 2}
          height={CHART_HEIGHT}
          chartConfig={chartConfig}
          bezier
          withInnerLines
          withOuterLines={false}
          withVerticalLines={false}
          fromZero
          segments={4}
          style={styles.chart}
        />
      ) : (
        // First render before layout measures the card width.
        <View style={{ height: CHART_HEIGHT }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: CARD_PADDING,
    paddingHorizontal: CARD_PADDING,
    overflow: "hidden",
  },
  chart: {
    marginVertical: 0,
    borderRadius: RADIUS.md,
    paddingRight: 0,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  placeholderTitle: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  placeholderBody: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
  },
});
