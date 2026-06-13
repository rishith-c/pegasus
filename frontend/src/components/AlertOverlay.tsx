// AlertOverlay — fullscreen red alert modal for a critical (red) burnout score.
// A breathing red pulse fills the screen, the intervention text is front and
// center, and a list of human-support contacts can be tapped to call or text.
// Fires a heavy haptic impact the moment it becomes visible.

import React, { useEffect } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

// A single human you can reach out to. `value` is the raw phone/email/url.
export interface SupportContact {
  id?: string;
  name: string;
  // What the contact is for, e.g. "Crisis line", "Manager", "Friend".
  role?: string;
  // "tel" -> phone call, "sms" -> text message, "url" -> any other link.
  type?: "tel" | "sms" | "url";
  value: string;
}

export interface AlertOverlayProps {
  visible: boolean;
  score: number;
  intervention: string;
  support?: SupportContact[];
  onClose: () => void;
}

// Build the platform link for a contact based on its type.
function contactHref(c: SupportContact): string {
  const raw = c.value.trim();
  switch (c.type) {
    case "sms":
      return `sms:${raw.replace(/\s+/g, "")}`;
    case "url":
      return raw;
    case "tel":
    default:
      return `tel:${raw.replace(/\s+/g, "")}`;
  }
}

function openContact(c: SupportContact) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  Linking.openURL(contactHref(c)).catch(() => {});
}

function ContactRow({ contact }: { contact: SupportContact }) {
  const verb =
    contact.type === "sms" ? "Text" : contact.type === "url" ? "Open" : "Call";
  return (
    <Pressable
      onPress={() => openContact(contact)}
      style={({ pressed }) => [styles.contact, pressed && styles.contactPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${verb} ${contact.name}`}
    >
      <View style={styles.contactBody}>
        <Text style={styles.contactName} numberOfLines={1}>
          {contact.name}
        </Text>
        {contact.role ? (
          <Text style={styles.contactRole} numberOfLines={1}>
            {contact.role}
          </Text>
        ) : null}
      </View>
      <View style={styles.contactAction}>
        <Text style={styles.contactActionText}>{verb}</Text>
      </View>
    </Pressable>
  );
}

export default function AlertOverlay({
  visible,
  score,
  intervention,
  support,
  onClose,
}: AlertOverlayProps) {
  // 0..1 breathing value driving the background pulse + halo.
  const pulse = useSharedValue(0);

  // Heavy haptic the instant the alert surfaces.
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  }, [visible]);

  // Run the breathing pulse only while visible; stop it otherwise.
  useEffect(() => {
    if (visible) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1,
        true // reverse — breathe in and out
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [visible, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.18, 0.42]),
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.25, 0.7]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1.04]) }],
  }));

  const message = intervention?.trim();
  const contacts = (support ?? []).filter((c) => c && c.value && c.name);
  const shownScore = Number.isFinite(score) ? Math.round(score) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Base dark wash so text stays legible over the pulse. */}
        <View style={styles.backdrop} />

        {/* Breathing red radial glow filling the screen. */}
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <LinearGradient
            colors={["rgba(239,68,68,0.55)", "rgba(239,68,68,0.0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Alert badge + breathing halo behind the score. */}
          <View style={styles.scoreBlock}>
            <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
            <View style={styles.alertPill}>
              <View style={styles.alertDot} />
              <Text style={styles.alertLabel}>CRITICAL</Text>
            </View>
            <Text style={styles.score}>{shownScore}</Text>
            <Text style={styles.scoreCaption}>Burnout index</Text>
          </View>

          {/* The intervention, front and center. */}
          <Text style={styles.intervention}>
            {message && message.length > 0
              ? message
              : "Stop and step away. Your signals are spiking — reach out to someone now."}
          </Text>

          {/* Human support. Tap to call / text / open. */}
          {contacts.length > 0 ? (
            <View style={styles.supportBlock}>
              <Text style={styles.supportHeading}>Reach a human</Text>
              {contacts.map((c, i) => (
                <ContactRow key={c.id ?? `${c.value}-${i}`} contact={c} />
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* Dismiss. */}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss alert"
        >
          <Text style={styles.dismissText}>I'm okay — dismiss</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const RED = COLORS.red;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.82)",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  scoreBlock: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  halo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -56,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  alertPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(239,68,68,0.10)",
    marginBottom: SPACING.lg,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RED,
    marginRight: SPACING.sm,
  },
  alertLabel: {
    ...TYPE.label,
    color: RED,
    letterSpacing: 2,
  },
  score: {
    ...TYPE.hero,
    fontSize: 88,
    color: COLORS.text,
    lineHeight: 92,
  },
  scoreCaption: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 1.2,
    marginTop: SPACING.xs,
  },
  intervention: {
    ...TYPE.body,
    color: COLORS.text,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  supportBlock: {
    marginTop: SPACING.sm,
  },
  supportHeading: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 1.4,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm + 2,
  },
  contactPressed: {
    backgroundColor: "#181820",
    borderColor: "rgba(239,68,68,0.4)",
  },
  contactBody: {
    flex: 1,
    marginRight: SPACING.md,
  },
  contactName: {
    ...TYPE.body,
    color: COLORS.text,
    fontWeight: "700",
  },
  contactRole: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: 2,
  },
  contactAction: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
  },
  contactActionText: {
    ...TYPE.label,
    color: RED,
    letterSpacing: 0.6,
  },
  dismiss: {
    margin: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  dismissPressed: {
    backgroundColor: "#181820",
  },
  dismissText: {
    ...TYPE.body,
    color: COLORS.textDim,
    fontWeight: "600",
  },
});
