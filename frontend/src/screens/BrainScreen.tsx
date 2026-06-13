import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Ellipse, Circle } from 'react-native-svg';
import { COLORS } from '../utils/colors';

// TODO: replace with `await getBrainData(userId)` once Rishith's api.ts lands
const REGIONS = [
  { name: 'Prefrontal Cortex', cx: 110, cy: 60, r: 28, baseline: 0.4, current: 0.62, explanation: 'Elevated cognitive load' },
  { name: 'Amygdala', cx: 150, cy: 110, r: 18, baseline: 0.35, current: 0.7, explanation: 'Heightened stress response' },
  { name: 'Anterior Cingulate', cx: 110, cy: 95, r: 16, baseline: 0.3, current: 0.5, explanation: 'Increased conflict monitoring' },
  { name: 'Hippocampus', cx: 130, cy: 130, r: 16, baseline: 0.4, current: 0.45, explanation: 'Slightly elevated memory encoding load' },
  { name: 'Insula', cx: 80, cy: 110, r: 16, baseline: 0.35, current: 0.55, explanation: 'Increased interoceptive awareness' },
];

function activationColor(value: number) {
  const hue = 240 - value * 240;
  return `hsl(${hue}, 80%, 55%)`;
}

export default function BrainScreen() {
  const [showBaseline, setShowBaseline] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Brain Activity</Text>
      <Text style={styles.subtitle}>powered by Meta TRIBE v2</Text>

      <View style={styles.brainCard}>
        <Svg width={220} height={180} viewBox="0 0 220 180">
          <Ellipse cx={110} cy={95} rx={100} ry={75} fill={COLORS.bg} stroke={COLORS.border} strokeWidth={2} />
          {REGIONS.map((region) => (
            <Circle
              key={region.name}
              cx={region.cx}
              cy={region.cy}
              r={region.r}
              fill={activationColor(showBaseline ? region.baseline : region.current)}
              opacity={0.8}
            />
          ))}
        </Svg>
      </View>

      <TouchableOpacity style={styles.toggle} onPress={() => setShowBaseline((v) => !v)}>
        <Text style={styles.toggleText}>
          {showBaseline ? 'Showing: Healthy Baseline' : 'Showing: Your Pattern'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Flagged Regions</Text>
      {REGIONS.filter((r) => r.current - r.baseline > 0.1).map((region) => (
        <View key={region.name} style={styles.regionCard}>
          <View style={[styles.dot, { backgroundColor: activationColor(region.current) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.regionName}>{region.name}</Text>
            <Text style={styles.regionExplanation}>{region.explanation}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60, alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: COLORS.textDim, fontSize: 13, marginBottom: 24 },
  brainCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  toggle: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  toggleText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    width: '100%',
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  regionName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  regionExplanation: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
});
