import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import TrendChart from '../components/TrendChart';
import ScoreBreakdown from '../components/ScoreBreakdown';
import { COLORS } from '../utils/colors';

// TODO: replace with `await getMetrics(userId)` once Rishith's api.ts lands
const PLACEHOLDER_TREND = [
  { date: 'Mon', score: 22 },
  { date: 'Tue', score: 30 },
  { date: 'Wed', score: 45 },
  { date: 'Thu', score: 58 },
  { date: 'Fri', score: 71 },
  { date: 'Sat', score: 64 },
  { date: 'Sun', score: 62 },
];

const PLACEHOLDER_BREAKDOWN = [
  { label: 'iMessage', value: 0.55 },
  { label: 'Typing', value: 0.7 },
  { label: 'Facial', value: 0.4 },
  { label: 'Voice', value: 0.35 },
];

export default function MetricsScreen() {
  const current = PLACEHOLDER_TREND[PLACEHOLDER_TREND.length - 1].score;
  const previous = PLACEHOLDER_TREND[PLACEHOLDER_TREND.length - 2].score;
  const delta = current - previous;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Metrics</Text>

      <View style={styles.headerCard}>
        <Text style={styles.headerScore}>{current}</Text>
        <Text style={[styles.headerDelta, { color: delta <= 0 ? COLORS.green : COLORS.red }]}>
          {delta <= 0 ? '▼' : '▲'} {Math.abs(delta)} vs yesterday
        </Text>
      </View>

      <Text style={styles.sectionLabel}>7-Day Trend</Text>
      <TrendChart data={PLACEHOLDER_TREND} />

      <Text style={styles.sectionLabel}>Signal Breakdown</Text>
      <View style={styles.card}>
        <ScoreBreakdown items={PLACEHOLDER_BREAKDOWN} />
      </View>

      <Text style={styles.sectionLabel}>Typing Trends</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>WPM this week</Text>
          <Text style={styles.rowValue}>38</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>WPM last week</Text>
          <Text style={styles.rowValue}>46</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Error rate trend</Text>
          <Text style={[styles.rowValue, { color: COLORS.yellow }]}>+12%</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginBottom: 20 },
  headerCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  headerScore: { color: COLORS.text, fontSize: 48, fontWeight: '800' },
  headerDelta: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.textDim, fontSize: 14 },
  rowValue: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
});
