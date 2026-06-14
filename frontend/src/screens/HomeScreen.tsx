import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CheckEngine from '../components/CheckEngine';
import IndicatorCard from '../components/IndicatorCard';
import InterventionCard from '../components/InterventionCard';
import AlertOverlay from '../components/AlertOverlay';
import AmbientGlow from '../components/AmbientGlow';
import GlassCard from '../components/GlassCard';
import { levelColor, levelLabel, Level, ColorTheme } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';
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
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = createStyles(colors);
  const tabBarHeight = useBottomTabBarHeight();
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
      <AmbientGlow />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.wordmark}>PEGASUS</Text>
            <Text style={styles.subtitle}>your mind's check engine light</Text>
          </View>
          <GlassCard style={styles.themeToggle} intensity={40}>
            <TouchableOpacity style={styles.themeToggleButton} onPress={toggleTheme} hitSlop={8}>
              <MaterialCommunityIcons
                name={isDark ? 'weather-night' : 'weather-sunny'}
                size={18}
                color={colors.textDim}
              />
            </TouchableOpacity>
          </GlassCard>
        </View>

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

        <GlassCard style={styles.checkInButton} intensity={40}>
          <TouchableOpacity
            style={styles.checkInButtonInner}
            onPress={() => navigation.navigate('Check-In', { autoStart: Date.now() })}
          >
            <Text style={styles.checkInButtonText}>Do a 60-second check-in</Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>

      {score.level === 'red' && <View style={styles.vignette} pointerEvents="none" />}

      <AlertOverlay visible={alertVisible} message={score.intervention} onClose={() => setAlertVisible(false)} />
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { alignItems: 'center', padding: 24, paddingTop: 60, paddingBottom: 60 },
    header: { width: '100%', alignItems: 'center' },
    headerTextWrap: { alignItems: 'center' },
    themeToggle: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    themeToggleButton: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: 4 },
    subtitle: { color: colors.textDim, fontSize: 14, marginTop: 4, marginBottom: 24 },
    engineWrapper: { marginVertical: 16 },
    levelLabel: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.3,
      marginBottom: 16,
    },
    indicators: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    checkInButton: {
      marginTop: 32,
      borderRadius: 999,
      width: '100%',
    },
    checkInButtonInner: {
      paddingVertical: 16,
      paddingHorizontal: 32,
      width: '100%',
      alignItems: 'center',
    },
    checkInButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    vignette: {
      ...StyleSheet.absoluteFillObject,
      borderColor: 'rgba(221, 144, 136, 0.3)',
      borderWidth: 8,
    },
  });
}
