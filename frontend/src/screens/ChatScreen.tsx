// ChatScreen — the Talk tab: a check-in "call" with Pegasus.
//
// Your front camera fills the screen with a face outline to center yourself.
// TAP the shutter to start talking, tap again to send (no holding). NVIDIA STT
// transcribes you → the companion replies to your actual words → it speaks back
// (NVIDIA TTS). The face outline pulses with your voice; a live emotion read
// (face + voice) and the last exchange show as captions.
//
// Crash-safe: when you switch tabs (lose focus) we stop recording + the camera
// so nothing keeps running in the background.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useConversation } from "../hooks/useConversation";
import { useBurnoutScore } from "../hooks/useBurnoutScore";
import { analyzeFrame } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import { COLORS, RADIUS, SPACING, TYPE, levelColor } from "../utils/colors";

function moodLabel(face: string | null, tremor?: boolean, pitchVar?: number): string {
  const voice = tremor ? "shaky voice" : (pitchVar ?? 0) > 55 ? "tense voice" : "steady voice";
  return face ? `${face} · ${voice}` : voice;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { score } = useBurnoutScore(DEFAULT_USER_ID);
  const { recording, sending, speaking, error, level, voice, messages, startRecording, stopAndSend, cancel, greet } =
    useConversation(DEFAULT_USER_ID, score?.score, score?.level);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [faceEmotion, setFaceEmotion] = useState<string | null>(null);

  const accent = score?.level ? levelColor(score.level) : COLORS.blue;

  // Open the call once: camera + Pegasus speaks first.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        if (!camPerm?.granted) await requestCamPerm();
      } catch {}
      greet();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the tab → stop recording + camera so nothing runs in the background.
  useEffect(() => {
    if (!isFocused) cancel();
  }, [isFocused, cancel]);

  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = recording || sending;
  }, [recording, sending]);

  // Live facial emotion — only while the tab is focused + not mid-recording.
  useEffect(() => {
    if (!isFocused || !camPerm?.granted) return;
    let alive = true;
    const id = setInterval(async () => {
      if (!camRef.current || busyRef.current) return;
      try {
        const photo = await camRef.current.takePictureAsync({ quality: 0.4, skipProcessing: true });
        if (!photo?.uri) return;
        const r = await analyzeFrame(photo.uri);
        const dist = r?.emotion_distribution ?? {};
        const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (alive) setFaceEmotion(top ?? r?.overall_affect ?? null);
      } catch {
        /* optional */
      }
    }, 9000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isFocused, camPerm?.granted]);

  // --- the face-outline glow (pulses with your voice) -------------------
  const amp = useSharedValue(0.2);
  useEffect(() => {
    if (recording) return;
    cancelAnimation(amp);
    if (speaking) {
      amp.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 340, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.45, { duration: 340, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      amp.value = withRepeat(
        withSequence(
          withTiming(0.32, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.14, { duration: 1700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
    return () => cancelAnimation(amp);
  }, [recording, speaking, amp]);
  useEffect(() => {
    if (!recording) return;
    amp.value = withTiming(Math.max(0.2, Math.min(1, level)), { duration: 90 });
  }, [level, recording, amp]);

  const ovalGlow = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + amp.value * 0.55,
    shadowRadius: 14 + amp.value * 26,
    transform: [{ scale: 1 + amp.value * 0.04 }],
  }));

  const onShutter = () => {
    if (sending) return;
    if (recording) stopAndSend();
    else startRecording();
  };

  const lastAI = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const status = recording
    ? "Listening — tap to send"
    : sending
    ? "Thinking…"
    : speaking
    ? "Pegasus is speaking…"
    : "Tap to talk";

  return (
    <View style={styles.root}>
      {isFocused && camPerm?.granted ? (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" />
      ) : (
        <LinearGradient colors={["#dfe4ee", COLORS.bg]} style={StyleSheet.absoluteFill} />
      )}

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.55)", "transparent"]}
        style={[styles.topScrim, { height: insets.top + 130 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.82)"]}
        locations={[0, 0.5, 1]}
        style={styles.bottomScrim}
      />

      {/* Face outline */}
      <View style={styles.ovalWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.oval,
            { borderColor: recording ? COLORS.red : "rgba(255,255,255,0.9)", shadowColor: recording ? COLORS.red : accent },
            ovalGlow,
          ]}
        />
        <Text style={styles.ovalHint} allowFontScaling={false}>
          {recording ? "Speak naturally" : "Center your face"}
        </Text>
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.title} allowFontScaling={false}>
          Pegasus
        </Text>
        <Text style={styles.sub} allowFontScaling={false}>
          {score != null ? `check-in · pulse ${score.score}/100` : "let's check in"}
        </Text>
        {(faceEmotion || voice) ? (
          <View style={styles.moodChip}>
            <View style={[styles.moodDot, { backgroundColor: accent }]} />
            <Text style={styles.moodText} allowFontScaling={false}>
              {moodLabel(faceEmotion, voice?.voice_tremor, voice?.pitch_variability)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Captions */}
      <View style={styles.captions} pointerEvents="none">
        {lastUser ? (
          <Text style={styles.capYou} numberOfLines={2} allowFontScaling={false}>
            “{lastUser.content}”
          </Text>
        ) : null}
        {lastAI ? (
          <Text style={styles.capAI} numberOfLines={4} allowFontScaling={false}>
            {lastAI.content}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.err} allowFontScaling={false}>
            {error}
          </Text>
        ) : null}
      </View>

      {/* Apple-camera-style shutter (tap to talk) */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <Shutter recording={recording} sending={sending} onPress={onShutter} />
        <Text style={styles.status} allowFontScaling={false}>
          {status}
        </Text>
      </View>
    </View>
  );
}

function Shutter({
  recording,
  sending,
  onPress,
}: {
  recording: boolean;
  sending: boolean;
  onPress: () => void;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(pulse);
    if (recording) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 650, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(pulse);
  }, [recording, pulse]);

  const innerStyle = useAnimatedStyle(() => ({ opacity: recording ? 0.65 + pulse.value * 0.35 : 1 }));

  return (
    <Pressable
      onPress={onPress}
      disabled={sending}
      style={({ pressed }) => [styles.shutterOuter, pressed && { opacity: 0.85 }, sending && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityLabel={recording ? "Stop and send" : "Tap to talk"}
    >
      <Animated.View style={[recording ? styles.shutterInnerRec : styles.shutterInner, innerStyle]}>
        {sending ? <ActivityIndicator color={recording ? "#fff" : COLORS.text} size="small" /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", bottom: 0, left: 0, right: 0, height: 320 },

  ovalWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  oval: {
    width: 230,
    height: 300,
    borderRadius: 150,
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
  },
  ovalHint: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.85)",
    marginTop: SPACING.lg,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 5,
  },

  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  title: { ...TYPE.heading, color: "#fff" },
  sub: { ...TYPE.caption, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  moodDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  moodText: { ...TYPE.caption, color: "#fff", textTransform: "capitalize" },

  captions: {
    position: "absolute",
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: 210,
    alignItems: "center",
    gap: SPACING.sm,
  },
  capYou: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.8)",
    fontStyle: "italic",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
  },
  capAI: {
    ...TYPE.title,
    fontSize: 22,
    lineHeight: 30,
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowRadius: 8,
  },
  err: { ...TYPE.caption, color: COLORS.yellow, textAlign: "center" },

  dock: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingTop: SPACING.md },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInnerRec: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { ...TYPE.label, color: "#fff", marginTop: SPACING.md, letterSpacing: 0.4 },
});
