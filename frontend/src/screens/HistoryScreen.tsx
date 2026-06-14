import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import AmbientGlow from '../components/AmbientGlow';
import GlassCard from '../components/GlassCard';
import { COLORS, ColorTheme, levelColor, Level } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatDate } from '../utils/formatting';

interface HistoryEntry {
  id: string;
  timestamp: string;
  score: number;
  level: Level;
  stimulusType: string;
  topIndicator: string;
}

// TODO: replace with `await getHistory(userId)` once Rishith's api.ts lands
const PLACEHOLDER_HISTORY: HistoryEntry[] = [
  { id: '6', timestamp: '2026-06-13T09:00:00Z', score: 62, level: 'yellow', stimulusType: 'text', topIndicator: 'slower typing' },
  { id: '5', timestamp: '2026-06-12T09:00:00Z', score: 71, level: 'red', stimulusType: 'image', topIndicator: 'negative sentiment' },
  { id: '4', timestamp: '2026-06-11T09:00:00Z', score: 58, level: 'yellow', stimulusType: 'audio', topIndicator: 'longer response time' },
  { id: '3', timestamp: '2026-06-10T09:00:00Z', score: 45, level: 'yellow', stimulusType: 'text', topIndicator: 'flat affect' },
  { id: '2', timestamp: '2026-06-09T09:00:00Z', score: 30, level: 'green', stimulusType: 'image', topIndicator: 'normal typing' },
  { id: '1', timestamp: '2026-06-08T09:00:00Z', score: 22, level: 'green', stimulusType: 'text', topIndicator: 'positive sentiment' },
];

const FILTERS: { label: string; value: Level | 'all'; dot?: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Calm', value: 'green', dot: COLORS.green },
  { label: 'Warning', value: 'yellow', dot: COLORS.yellow },
  { label: 'Alert', value: 'red', dot: COLORS.red },
];

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tabBarHeight = useBottomTabBarHeight();
  const [filter, setFilter] = useState<Level | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const data = PLACEHOLDER_HISTORY.filter((e) => filter === 'all' || e.level === filter);

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <Text style={styles.title}>History</Text>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            {f.dot && <View style={[styles.filterDot, { backgroundColor: f.dot }]} />}
            <Text style={styles.filterText}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 40 }]}
        renderItem={({ item }) => (
          <GlassCard style={styles.row} intensity={30}>
            <TouchableOpacity
              style={styles.rowInner}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <View style={[styles.scoreDot, { backgroundColor: levelColor(item.level) }]}>
                <Text style={styles.scoreDotText}>{item.score}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.date}>{formatDate(item.timestamp)}</Text>
                <Text style={styles.indicator}>{item.topIndicator}</Text>
                {expandedId === item.id && <Text style={styles.detail}>Stimulus: {item.stimulusType}</Text>}
              </View>
            </TouchableOpacity>
          </GlassCard>
        )}
      />
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
    title: { color: colors.text, fontSize: 28, fontWeight: '800', paddingHorizontal: 24, marginBottom: 16 },
    filters: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 8 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 16,
      gap: 6,
    },
    filterChipActive: { borderColor: colors.textDim },
    filterDot: { width: 8, height: 8, borderRadius: 4 },
    filterText: { color: colors.text, fontSize: 14 },
    list: { paddingHorizontal: 24, paddingBottom: 60, gap: 10 },
    row: {
      borderRadius: 12,
    },
    rowInner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    scoreDot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    scoreDotText: { color: '#05050a', fontWeight: '800', fontSize: 14 },
    date: { color: colors.text, fontSize: 15, fontWeight: '700' },
    indicator: { color: colors.textDim, fontSize: 13, marginTop: 2 },
    detail: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  });
}
