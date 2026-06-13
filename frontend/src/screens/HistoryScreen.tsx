// HistoryScreen — your timeline of past readings. "Tesla dashboard for your mind."
// Newest-first list from getHistory(DEFAULT_USER_ID). Each row shows a relative
// timestamp, a small level-colored score circle, and the top indicator. Tapping a
// row expands the full signal breakdown + intervention. Filter chips (All / green /
// yellow / red), pull-to-refresh, and graceful loading / empty / error states.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import ScoreBreakdown from "../components/ScoreBreakdown";
import InterventionCard from "../components/InterventionCard";
import { getHistory } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import type { BurnoutResult } from "../types";
import { COLORS, RADIUS, SPACING, TYPE, levelColor } from "../utils/colors";
import type { BurnoutLevel } from "../utils/colors";
import { relativeTime, scoreLabel, titleCase } from "../utils/formatting";

type Filter = "all" | "green" | "yellow" | "red";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "green", label: "Calm" },
  { key: "yellow", label: "Watch" },
  { key: "red", label: "Alert" },
];

// A stable key for a reading. Timestamps should be unique per reading; the
// index guards against any duplicates the backend might return.
function readingKey(r: BurnoutResult, i: number): string {
  return `${r.timestamp ?? "t"}-${i}`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<BurnoutResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await getHistory(DEFAULT_USER_ID);
      // Newest-first. Sort defensively in case the API returns oldest-first.
      const sorted = [...(data ?? [])].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setHistory(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  const filtered = useMemo(() => {
    if (!history) return [];
    if (filter === "all") return history;
    return history.filter((r) => r.level === filter);
  }, [history, filter]);

  // First load, before any data has arrived.
  if (loading && !history) {
    return (
      <View style={[styles.root, styles.centerRoot]}>
        <ActivityIndicator color={COLORS.textDim} />
        <Text style={styles.centerText}>Loading your timeline…</Text>
      </View>
    );
  }

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
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={COLORS.textDim}
            colors={[COLORS.green]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>your readings over time</Text>
        </View>

        {/* Filter chips */}
        <View style={styles.chips}>
          {FILTERS.map(({ key, label }) => (
            <FilterChip
              key={key}
              label={label}
              filterKey={key}
              active={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </View>

        {/* Error state — keeps any previously loaded data visible below. */}
        {error && (
          <Pressable style={styles.errorCard} onPress={() => load("refresh")}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Tap to retry</Text>
          </Pressable>
        )}

        {/* Empty state */}
        {!error && filtered.length === 0 ? (
          <EmptyState filter={filter} hasAny={(history?.length ?? 0) > 0} />
        ) : (
          <View style={styles.list}>
            {filtered.map((reading, i) => {
              const key = readingKey(reading, i);
              return (
                <HistoryRow
                  key={key}
                  reading={reading}
                  expanded={expandedKey === key}
                  onToggle={() =>
                    setExpandedKey((cur) => (cur === key ? null : key))
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// A single filter chip. Active state tints to the level's accent (or white for All).
function FilterChip({
  label,
  filterKey,
  active,
  onPress,
}: {
  label: string;
  filterKey: Filter;
  active: boolean;
  onPress: () => void;
}) {
  const accent = filterKey === "all" ? COLORS.text : levelColor(filterKey);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        active && { borderColor: accent, backgroundColor: "rgba(255,255,255,0.04)" },
      ]}
    >
      {filterKey !== "all" && (
        <View style={[styles.chipDot, { backgroundColor: accent }]} />
      )}
      <Text style={[styles.chipText, active && { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

// A history row. Collapsed: timestamp + score circle + top indicator. Expanded:
// status label, full signal breakdown, and the intervention copy.
function HistoryRow({
  reading,
  expanded,
  onToggle,
}: {
  reading: BurnoutResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const level = (reading.level as BurnoutLevel) ?? "green";
  const accent = levelColor(level);
  const when = relativeTime(reading.timestamp);
  const topIndicator = (reading.top_indicators ?? []).filter(Boolean)[0];

  const press = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.015 }],
  }));

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={onToggle}
        onPressIn={() => {
          press.value = withTiming(1, {
            duration: 110,
            easing: Easing.out(Easing.ease),
          });
        }}
        onPressOut={() => {
          press.value = withTiming(0, {
            duration: 150,
            easing: Easing.out(Easing.ease),
          });
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Reading ${when || ""}, score ${Math.round(
          reading.score
        )}, ${scoreLabel(level)}`}
        style={[styles.row, expanded && { borderColor: "rgba(255,255,255,0.12)" }]}
      >
        {/* Collapsed header */}
        <View style={styles.rowHeader}>
          <ScoreCircle score={reading.score} accent={accent} />
          <View style={styles.rowBody}>
            <Text style={styles.rowWhen}>{when || "—"}</Text>
            <Text style={[styles.rowIndicator, { color: COLORS.textDim }]} numberOfLines={1}>
              {topIndicator ?? scoreLabel(level)}
            </Text>
          </View>
          <Text style={[styles.chevron, expanded && styles.chevronOpen]}>
            {expanded ? "−" : "+"}
          </Text>
        </View>

        {/* Expanded detail */}
        {expanded && (
          <View style={styles.detail}>
            <Text style={[styles.statusLabel, { color: accent }]}>
              {scoreLabel(level)}
            </Text>

            {/* Top indicators, beyond the one shown collapsed. */}
            {(() => {
              const indicators = (reading.top_indicators ?? []).filter(Boolean);
              if (indicators.length === 0) return null;
              return (
                <View style={styles.indicatorList}>
                  {indicators.map((text, i) => (
                    <View key={`${i}-${text}`} style={styles.indicatorRow}>
                      <View style={[styles.indicatorDot, { backgroundColor: accent }]} />
                      <Text style={styles.indicatorText}>{titleCase(text)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Full signal breakdown. */}
            {reading.breakdown && (
              <View style={styles.breakdownWrap}>
                <ScoreBreakdown breakdown={reading.breakdown} />
              </View>
            )}

            {/* Intervention copy for this reading. */}
            {reading.intervention?.trim() ? (
              <View style={styles.interventionWrap}>
                <InterventionCard text={reading.intervention} />
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// Small level-colored score circle. Big-ish numeral, tinted ring + glow.
function ScoreCircle({ score, accent }: { score: number; accent: string }) {
  return (
    <View style={[styles.circle, { borderColor: accent, shadowColor: accent }]}>
      <Text style={[styles.circleScore, { color: accent }]}>
        {Math.round(score ?? 0)}
      </Text>
    </View>
  );
}

// Empty state — distinguishes "no readings at all" from "none match this filter".
function EmptyState({
  filter,
  hasAny,
}: {
  filter: Filter;
  hasAny: boolean;
}) {
  const filteredOut = filter !== "all" && hasAny;
  return (
    <View style={styles.empty}>
      <View style={styles.emptyDot} />
      <Text style={styles.emptyTitle}>
        {filteredOut ? "Nothing here yet" : "No readings yet"}
      </Text>
      <Text style={styles.emptyText}>
        {filteredOut
          ? "No readings match this filter. Try another, or pull to refresh."
          : "Your readings will appear here after your first check-in. Pull to refresh."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerRoot: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    ...TYPE.body,
    color: COLORS.textDim,
    marginTop: SPACING.md,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPE.title,
    color: COLORS.text,
  },
  subtitle: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.xs,
    letterSpacing: 0.4,
  },
  // Filter chips
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },
  chipText: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 0.3,
  },
  // Error
  errorCard: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    ...TYPE.body,
    color: COLORS.text,
  },
  errorHint: {
    ...TYPE.caption,
    color: COLORS.red,
    marginTop: SPACING.xs,
  },
  // List
  list: {
    gap: SPACING.md,
  },
  row: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowBody: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rowWhen: {
    ...TYPE.body,
    color: COLORS.text,
    fontWeight: "600",
  },
  rowIndicator: {
    ...TYPE.caption,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    fontWeight: "400",
    color: COLORS.textDim,
    marginLeft: SPACING.sm,
    width: 18,
    textAlign: "center",
  },
  chevronOpen: {
    color: COLORS.text,
  },
  // Score circle
  circle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  circleScore: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  // Expanded detail
  detail: {
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.lg,
  },
  statusLabel: {
    ...TYPE.heading,
    marginBottom: SPACING.md,
  },
  indicatorList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },
  indicatorText: {
    flex: 1,
    ...TYPE.body,
    color: COLORS.text,
  },
  breakdownWrap: {
    marginBottom: SPACING.lg,
  },
  interventionWrap: {
    marginTop: SPACING.xs,
  },
  // Empty
  empty: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyDot: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
});
