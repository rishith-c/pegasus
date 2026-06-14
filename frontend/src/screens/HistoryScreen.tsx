// HistoryScreen — your timeline of past check-ins and talks. A calm, most-recent-
// first list pulled from getHistory(DEFAULT_USER_ID). Each card shows what kind of
// moment it was (Talk / Check-in), when it happened, a wellness score chip
// (higher is better, colored by level), the user's own words, and the gentle
// intervention Pegasus offered. White cards on the Apple off-white canvas with
// hairline borders, soft shadows, and frosted top/bottom scroll bands.
import React, { useCallback, useEffect, useState } from "react";
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

import { getHistory } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import { HistoryEntry } from "../types";
import { COLORS, RADIUS, SPACING, TYPE, levelColor } from "../utils/colors";
import ScrollEdgeFade from "../components/ScrollEdgeFade";

// Short, Apple-style timestamp: the time of day for moments from today
// (e.g. "2:45 PM"), the month + day for anything older (e.g. "Jun 14").
function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getHistory(DEFAULT_USER_ID)
      .then((d) => setHistory(d ?? []))
      .catch((e) => setError(e?.message ?? "Couldn't load your history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // First load: calm, minimal spinner.
  if (loading && !history) {
    return (
      <View style={[styles.root, styles.centerRoot]}>
        <ActivityIndicator color={COLORS.textDim} />
        <Text style={styles.centerText}>Loading your history…</Text>
      </View>
    );
  }

  // Error / unreachable: clear, non-alarming fallback with a retry.
  if (error && !history) {
    return (
      <View style={[styles.root, styles.centerRoot]}>
        <Text style={styles.errorTitle}>History unavailable</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Pressable
          onPress={load}
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="Retry loading history"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const entries = history ?? [];

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
            onRefresh={load}
            tintColor={COLORS.textDim}
            colors={[COLORS.green]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Your past check-ins and talks</Text>
        </View>

        {/* Inline error — keeps any previously loaded list visible below. */}
        {error && (
          <Pressable style={styles.errorCard} onPress={load}>
            <Text style={styles.errorCardText}>{error}</Text>
            <Text style={styles.errorCardHint}>Tap to retry</Text>
          </Pressable>
        )}

        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={styles.list}>
            {entries.map((entry, i) => (
              <HistoryCard key={`${entry.timestamp}-${i}`} entry={entry} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Frosted top/bottom bands — content blurs softly as it scrolls under. */}
      <ScrollEdgeFade topInset={insets.top} />
    </View>
  );
}

// One past moment. Top row: a KIND badge + short timestamp on the left, the
// wellness score chip on the right. Below: the user's words in quotes (if any),
// then the intervention in a subtle inset row (if any).
function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const accent = levelColor(entry.level);
  const kindLabel = entry.kind === "talk" ? "Talk" : "Check-in";
  const when = shortWhen(entry.timestamp);
  const text = entry.text?.trim();
  const intervention = entry.intervention?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.metaRow}>
          <View style={styles.kindBadge}>
            <Text style={styles.kindText}>{kindLabel}</Text>
          </View>
          {when ? <Text style={styles.when}>{when}</Text> : null}
        </View>

        {/* Wellness score — higher is better, colored by level. */}
        <View style={[styles.scoreChip, { borderColor: accent }]}>
          <Text style={[styles.scoreNum, { color: accent }]}>
            {Math.round(entry.score ?? 0)}
          </Text>
          <Text style={styles.scoreOutOf}>/100</Text>
        </View>
      </View>

      {/* The user's own words. */}
      {text ? <Text style={styles.quote}>“{text}”</Text> : null}

      {/* Pegasus's gentle nudge for this moment. */}
      {intervention ? (
        <View style={styles.interventionRow}>
          <View style={[styles.interventionBar, { backgroundColor: accent }]} />
          <Text style={styles.interventionText}>{intervention}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Empty state — calm invitation to start a history.
function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyDot} />
      <Text style={styles.emptyTitle}>No check-ins yet</Text>
      <Text style={styles.emptyText}>
        Talk to Pegasus or reply to a text to start your history.
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
    padding: SPACING.lg,
  },
  centerText: {
    ...TYPE.body,
    color: COLORS.textDim,
    marginTop: SPACING.md,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
  },

  // Header
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPE.title,
    color: COLORS.text,
  },
  subtitle: {
    ...TYPE.body,
    color: COLORS.textDim,
    marginTop: SPACING.xs,
  },

  // Full-screen error fallback
  errorTitle: {
    ...TYPE.heading,
    color: COLORS.text,
  },
  errorBody: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.card,
  },
  retryText: {
    ...TYPE.body,
    color: COLORS.text,
    fontWeight: "700",
  },

  // Inline (non-blocking) error card
  errorCard: {
    backgroundColor: "rgba(255, 59, 48, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.30)",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorCardText: {
    ...TYPE.body,
    color: COLORS.text,
  },
  errorCardHint: {
    ...TYPE.caption,
    color: COLORS.red,
    marginTop: SPACING.xs,
  },

  // List
  list: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.sm,
  },
  kindBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  kindText: {
    ...TYPE.label,
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 0.5,
  },
  when: {
    ...TYPE.caption,
    color: COLORS.textDim,
  },

  // Wellness score chip
  scoreChip: {
    flexDirection: "row",
    alignItems: "baseline",
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginLeft: SPACING.sm,
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  scoreOutOf: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textDim,
    marginLeft: 1,
  },

  // User's words
  quote: {
    ...TYPE.body,
    fontStyle: "italic",
    color: COLORS.textDim,
    lineHeight: 23,
    marginTop: SPACING.md,
  },

  // Intervention row
  interventionRow: {
    flexDirection: "row",
    marginTop: SPACING.md,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  interventionBar: {
    width: 3,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.md,
  },
  interventionText: {
    flex: 1,
    ...TYPE.body,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },

  // Empty state
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
