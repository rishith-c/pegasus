import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import CheckEngine from '../components/CheckEngine';
import IndicatorCard from '../components/IndicatorCard';
import InterventionCard from '../components/InterventionCard';
import AlertOverlay from '../components/AlertOverlay';
import { COLORS, levelColor, levelLabel, Level } from '../utils/colors';
import { humanizeIndicator } from '../utils/formatting';

// TODO: replace with `const { score, loading, refresh } = useBurnoutScore(DEFAULT_USER_ID)` once Rishith's hook lands
const PLACEHOLDER_SCORE: { score: number; level: Level; intervention: string; top_indicators: string[] } = {
  score: 62,
  level: 'yellow',
  intervention: 'Take a short walk and step away from your screen for 10 minutes.',
  top_indicators: ['slower_typing', 'negative_sentiment', 'longer_response_time'],
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const score = PLACEHOLDER_SCORE;
  const [alertVisible, setAlertVisible] = useState(score.level === 'red');

  useEffect(() => {
    if (score.level === 'red') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [score.level]);

  const onRefresh = () => {
    setRefreshing(true);
    // TODO: call refresh() from useBurnoutScore once available
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textDim} />}
      >
        <Text style={styles.wordmark}>PEGASUS</Text>
        <Text style={styles.subtitle}>your mind's check engine light</Text>

        <View style={styles.engineWrapper}>
          <CheckEngine score={score.score} level={score.level} />
        </View>

        <Text style={[styles.levelLabel, { color: levelColor(score.level) }]}>{levelLabel(score.level)}</Text>

        <View style={styles.indicators}>
          {score.top_indicators.slice(0, 3).map((indicator) => (
            <IndicatorCard key={indicator} label={humanizeIndicator(indicator)} />
          ))}
        </View>

        <InterventionCard text={score.intervention} />

        <TouchableOpacity style={styles.checkInButton} onPress={() => navigation.navigate('Pulse Check')}>
          <Text style={styles.checkInButtonText}>Do a 30-second check-in</Text>
        </TouchableOpacity>
      </ScrollView>

      {score.level === 'red' && <View style={styles.vignette} pointerEvents="none" />}

      <AlertOverlay visible={alertVisible} message={score.intervention} onClose={() => setAlertVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { alignItems: 'center', padding: 24, paddingTop: 60, paddingBottom: 60 },
  wordmark: { color: COLORS.text, fontSize: 32, fontWeight: '800', letterSpacing: 4 },
  subtitle: { color: COLORS.textDim, fontSize: 14, marginTop: 4, marginBottom: 24 },
  engineWrapper: { marginVertical: 16 },
  levelLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  indicators: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  checkInButton: {
    marginTop: 32,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  checkInButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 12,
  },
});
