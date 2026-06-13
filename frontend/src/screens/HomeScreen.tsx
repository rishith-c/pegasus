// HomeScreen — the hero. "A check engine light for your mind."
// Live burnout score via useBurnoutScore, the breathing CheckEngine orb,
// the top indicators, an intervention suggestion, and the primary check-in CTA.
// On a red reading we fire a heavy haptic and surface a calm full-screen alert.
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import CheckEngine from "../components/CheckEngine";
import IndicatorCard, { type IndicatorTone } from "../components/IndicatorCard";
import InterventionCard from "../components/InterventionCard";
import { useBurnoutScore } from "../hooks/useBurnoutScore";
import { DEFAULT_USER_ID } from "../services/config";
import { COLORS, RADIUS, SPACING, TYPE, levelColor } from "../utils/colors";
import type { BurnoutLevel } from "../utils/colors";
import { scoreLabel } from "../utils/formatting";

// The tab navigator route names — mirror of TabNavigator's TabParamList so
// navigation.navigate("Check-In") is type-checked here.
type TabParamList = {
  Home: undefined;
  Pulse: undefined;
  "Check-In": undefined;
  Metrics: undefined;
  Brain: undefined;
  History: undefined;
};

type Props = BottomTabScreenProps<TabParamList, "Home">;

// Each indicator dot inherits the current level's accent — red reads urgent,
// yellow elevated, green calm.
function toneForLevel(level: BurnoutLevel): IndicatorTone {
  return level;
}

export default function HomeScreen({ navigation }: Props) {
  const { score, loading, refresh } = useBurnoutScore(DEFAULT_USER_ID);
  const insets = useSafeAreaInsets();

  const [alertVisible, setAlertVisible] = useState(false);
  // Track the last level we alerted on so we don't re-buzz on every poll.
  const lastAlertedLevel = useRef<BurnoutLevel | null>(null);

  // On a fresh transition into "red", fire a heavy haptic and raise the alert.
  useEffect(() => {
    const level = score?.level;
    if (level === "red") {
      if (lastAlertedLevel.current !== "red") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {}
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setAlertVisible(true);
      }
      lastAlertedLevel.current = "red";
    } else if (level) {
      lastAlertedLevel.current = level;
    }
  }, [score?.level]);

  // First load, before any score has arrived: a calm, minimal loading state.
  if (loading && !score) {
    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <Text style={styles.brand}>PEGASUS</Text>
        <ActivityIndicator color={COLORS.textDim} style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Reading your signals…</Text>
      </View>
    );
  }

  // After first load we always have a score (the hook polls). Guard anyway so
  // a transient null never crashes the hero.
  const level: BurnoutLevel = (score?.level as BurnoutLevel) ?? "green";
  const numericScore = score?.score ?? 0;
  const accent = levelColor(level);
  const indicators = (score?.top_indicators ?? []).filter(Boolean).slice(0, 3);
  const intervention = score?.intervention ?? "";
  // `support` is the longer, reassuring copy shown on a red alert. The backend
  // may not always send it, so fall back to the intervention text.
  const support =
    ((score as unknown as { support?: string } | null)?.support ?? "").trim() ||
    intervention ||
    "Your signals are running hot. Take a few slow breaths, step away from the screen, and reach out to someone you trust.";

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SPACING.lg, paddingBottom: SPACING.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={COLORS.textDim}
            colors={[COLORS.green]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>PEGASUS</Text>
          <Text style={styles.subtitle}>a check engine light for your mind</Text>
        </View>

        {/* Hero orb */}
        <View style={styles.hero}>
          <CheckEngine score={numericScore} level={level} />
          <Text style={[styles.statusLabel, { color: accent }]}>
            {scoreLabel(level)}
          </Text>
        </View>

        {/* Top indicators */}
        {indicators.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHAT WE'RE SEEING</Text>
            <View style={styles.indicatorList}>
              {indicators.map((text, i) => (
                <IndicatorCard
                  key={`${i}-${text}`}
                  text={text}
                  tone={toneForLevel(level)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Intervention suggestion */}
        {intervention.length > 0 && (
          <View style={styles.section}>
            <InterventionCard text={intervention} />
          </View>
        )}

        {/* Primary CTA */}
        <View style={styles.ctaWrap}>
          <CheckInButton
            accent={accent}
            onPress={() => navigation.navigate("Check-In")}
          />
        </View>
      </ScrollView>

      {/* Red-level alert overlay */}
      <AlertOverlay
        visible={alertVisible}
        support={support}
        onDismiss={() => setAlertVisible(false)}
        onCheckIn={() => {
          setAlertVisible(false);
          navigation.navigate("Check-In");
        }}
      />
    </View>
  );
}

// The big primary action. Subtle press-scale, accent-tinted glow.
function CheckInButton({
  accent,
  onPress,
}: {
  accent: string;
  onPress: () => void;
}) {
  const press = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.03 }],
  }));

  return (
    <Animated.View style={[styles.ctaShadow, { shadowColor: accent }, animatedStyle]}>
      <Pressable
        onPressIn={() => {
          press.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.ease) });
        }}
        onPress={onPress}
        style={[styles.cta, { borderColor: accent }]}
        accessibilityRole="button"
        accessibilityLabel="Do a 30-second check-in"
      >
        <Text style={styles.ctaText}>Do a 30-second check-in</Text>
      </Pressable>
    </Animated.View>
  );
}

// Calm, full-screen alert for a red reading. Not a jarring popup — a gentle,
// dark scrim with reassuring support copy and a clear next step.
function AlertOverlay({
  visible,
  support,
  onDismiss,
  onCheckIn,
}: {
  visible: boolean;
  support: string;
  onDismiss: () => void;
  onCheckIn: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlayScrim} onPress={onDismiss}>
        <Pressable style={styles.overlayCard} onPress={() => {}}>
          <View style={[styles.overlayDot, { backgroundColor: COLORS.red }]} />
          <Text style={styles.overlayLabel}>ALERT: TAKE ACTION</Text>
          <Text style={styles.overlayTitle}>Your signals are running hot</Text>
          <Text style={styles.overlaySupport}>{support}</Text>

          <Pressable
            onPress={onCheckIn}
            style={[styles.overlayPrimary, { borderColor: COLORS.red }]}
            accessibilityRole="button"
          >
            <Text style={styles.overlayPrimaryText}>Do a 30-second check-in</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.overlaySecondary}>
            <Text style={styles.overlaySecondaryText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingRoot: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingSpinner: {
    marginTop: SPACING.xl,
  },
  loadingText: {
    ...TYPE.body,
    color: COLORS.textDim,
    marginTop: SPACING.md,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
  },
  header: {
    alignItems: "center",
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: 6,
  },
  subtitle: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.sm,
    letterSpacing: 0.4,
  },
  hero: {
    alignItems: "center",
    marginTop: SPACING.md,
  },
  statusLabel: {
    ...TYPE.heading,
    marginTop: SPACING.sm,
    letterSpacing: 0.2,
  },
  section: {
    marginTop: SPACING.xl,
  },
  sectionLabel: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },
  indicatorList: {
    gap: SPACING.sm,
  },
  ctaWrap: {
    marginTop: SPACING.xxl,
  },
  ctaShadow: {
    borderRadius: RADIUS.lg,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cta: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  // Alert overlay
  overlayScrim: {
    flex: 1,
    backgroundColor: "rgba(5, 5, 8, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    shadowColor: COLORS.red,
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  overlayDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.md,
  },
  overlayLabel: {
    ...TYPE.label,
    color: COLORS.red,
    letterSpacing: 1.5,
  },
  overlayTitle: {
    ...TYPE.title,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  overlaySupport: {
    ...TYPE.body,
    color: COLORS.textDim,
    lineHeight: 24,
    marginTop: SPACING.md,
  },
  overlayPrimary: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    marginTop: SPACING.xl,
  },
  overlayPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  overlaySecondary: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
  },
  overlaySecondaryText: {
    ...TYPE.body,
    color: COLORS.textDim,
  },
});
