import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import TrendChart from '../components/TrendChart';
import ScoreBreakdown from '../components/ScoreBreakdown';
import AmbientGlow from '../components/AmbientGlow';
import GlassCard from '../components/GlassCard';
import { ColorTheme } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tabBarHeight = useBottomTabBarHeight();
  const current = PLACEHOLDER_TREND[PLACEHOLDER_TREND.length - 1].score;
  const previous = PLACEHOLDER_TREND[PLACEHOLDER_TREND.length - 2].score;
  const delta = current - previous;

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 40 }]}>
        <Text style={styles.title}>Metrics</Text>

        <GlassCard style={styles.headerCard} intensity={30}>
          <Text style={styles.headerScore}>{current}</Text>
          <Text style={[styles.headerDelta, { color: delta <= 0 ? colors.green : colors.red }]}>
            {delta <= 0 ? '▼' : '▲'} {Math.abs(delta)} vs yesterday
          </Text>
        </GlassCard>

        <Text style={styles.sectionLabel}>7-Day Trend</Text>
        <TrendChart data={PLACEHOLDER_TREND} />

        <Text style={styles.sectionLabel}>Signal Breakdown</Text>
        <GlassCard style={styles.card} intensity={30}>
          <ScoreBreakdown items={PLACEHOLDER_BREAKDOWN} />
        </GlassCard>

        <Text style={styles.sectionLabel}>Typing Trends</Text>
        <GlassCard style={styles.card} intensity={30}>
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
            <Text style={[styles.rowValue, { color: colors.yellow }]}>+12%</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
    title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 20 },
    headerCard: {
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      marginBottom: 24,
    },
    headerScore: { color: colors.text, fontSize: 48, fontWeight: '800' },
    headerDelta: { fontSize: 14, marginTop: 4, fontWeight: '600' },
    sectionLabel: {
      color: colors.textDim,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 8,
    },
    card: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      gap: 12,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    rowLabel: { color: colors.textDim, fontSize: 14 },
    rowValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  });
}
