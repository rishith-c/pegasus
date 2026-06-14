import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Svg, { Ellipse, Circle, Text as SvgText } from 'react-native-svg';
import AmbientGlow from '../components/AmbientGlow';
import GlassCard from '../components/GlassCard';
import { ColorTheme } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

// TODO: replace with `await getBrainData(userId)` once Rishith's api.ts lands
const REGIONS = [
  { name: 'Prefrontal Cortex', cx: 110, cy: 60, r: 28, baseline: 0.4, current: 0.62, explanation: 'Elevated cognitive load' },
  { name: 'Amygdala', cx: 150, cy: 110, r: 18, baseline: 0.35, current: 0.7, explanation: 'Heightened stress response' },
  { name: 'Anterior Cingulate', cx: 110, cy: 95, r: 16, baseline: 0.3, current: 0.5, explanation: 'Increased conflict monitoring' },
  { name: 'Hippocampus', cx: 130, cy: 130, r: 16, baseline: 0.4, current: 0.45, explanation: 'Slightly elevated memory encoding load' },
  { name: 'Insula', cx: 80, cy: 110, r: 16, baseline: 0.35, current: 0.55, explanation: 'Increased interoceptive awareness' },
];

const FLAG_THRESHOLD = 0.1;
const BADGE_TEXT_COLOR = '#05050a';

function activationColor(value: number) {
  const hue = 240 - value * 240;
  return `hsl(${hue}, 45%, 62%)`;
}

export default function BrainScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tabBarHeight = useBottomTabBarHeight();
  const [showBaseline, setShowBaseline] = useState(false);

  const flaggedRegions = REGIONS.filter((r) => r.current - r.baseline > FLAG_THRESHOLD);

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 40 }]}>
        <Text style={styles.title}>Your Brain Activity</Text>
        <Text style={styles.subtitle}>powered by Meta TRIBE v2</Text>

        <GlassCard style={styles.brainCard} intensity={30}>
          <Svg width={220} height={180} viewBox="0 0 220 180">
            <Ellipse cx={110} cy={95} rx={100} ry={75} fill={colors.bg} stroke={colors.border} strokeWidth={2} />
            {REGIONS.map((region) => {
              const flagIndex = flaggedRegions.findIndex((r) => r.name === region.name);
              const isFlagged = flagIndex !== -1;
              return (
                <React.Fragment key={region.name}>
                  <Circle
                    cx={region.cx}
                    cy={region.cy}
                    r={region.r}
                    fill={activationColor(showBaseline ? region.baseline : region.current)}
                    opacity={isFlagged ? 0.9 : 0.35}
                    stroke={isFlagged ? BADGE_TEXT_COLOR : 'none'}
                    strokeWidth={isFlagged ? 2 : 0}
                  />
                  {isFlagged && (
                    <SvgText
                      x={region.cx}
                      y={region.cy}
                      dy={4}
                      fontSize={12}
                      fontWeight="bold"
                      fill={BADGE_TEXT_COLOR}
                      textAnchor="middle"
                    >
                      {flagIndex + 1}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
        </GlassCard>

        <GlassCard style={styles.toggle} intensity={30}>
          <TouchableOpacity style={styles.toggleInner} onPress={() => setShowBaseline((v) => !v)}>
            <Text style={styles.toggleText}>
              {showBaseline ? 'Showing: Healthy Baseline' : 'Showing: Your Pattern'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.sectionLabel}>Flagged Regions</Text>
        {flaggedRegions.map((region, index) => (
          <GlassCard key={region.name} style={styles.regionCard} intensity={30}>
            <View style={[styles.badge, { backgroundColor: activationColor(region.current) }]}>
              <Text style={styles.badgeText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.regionName}>{region.name}</Text>
              <Text style={styles.regionExplanation}>{region.explanation}</Text>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 24, paddingTop: 60, paddingBottom: 60, alignItems: 'center' },
    title: { color: colors.text, fontSize: 28, fontWeight: '800' },
    subtitle: { color: colors.textDim, fontSize: 13, marginBottom: 24 },
    brainCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    toggle: {
      borderRadius: 999,
      marginBottom: 24,
    },
    toggleInner: {
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    toggleText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    sectionLabel: {
      color: colors.textDim,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 12,
      alignSelf: 'flex-start',
    },
    regionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      width: '100%',
    },
    badge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    badgeText: { color: '#05050a', fontSize: 12, fontWeight: '800' },
    regionName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    regionExplanation: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  });
}
