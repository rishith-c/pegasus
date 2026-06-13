// CheckInScreen — the daily video check-in.
// Flow: permission gate -> live camera with face-oval + rotating prompt ->
// record (60s countdown ring + pulsing red dot) -> "Analyzing..." brain pulse
// -> facial/voice results + the freshly-updated Pegasus (burnout) score.
//
// Data layer is imported, never redefined. The camera lifecycle lives entirely
// in useCamera(); this screen only orchestrates UI state around it.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { VideoResult, BurnoutResult } from "../types";
import { submitVideo } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import { useCamera } from "../hooks/useCamera";
import { COLORS, RADIUS, SPACING, TYPE, levelColor } from "../utils/colors";
import CheckEngine from "../components/CheckEngine";

// The backend (/video/submit) actually fuses facial + voice into a burnout
// score and returns it alongside the analysis. VideoResult doesn't declare it,
// so read it defensively rather than assuming it's always there.
type VideoResultWithBurnout = VideoResult & { burnout_result?: BurnoutResult };

const RECORD_SECONDS = 60;

// Rotating prompts shown over the live preview to keep the check-in natural.
const PROMPTS = [
  "Tell me about your day",
  "What's been on your mind lately?",
  "How are you really feeling right now?",
  "What gave you energy today? What drained it?",
  "What's one thing you're looking forward to?",
];

type Phase = "preview" | "recording" | "analyzing" | "result" | "error";

export default function CheckInScreen() {
  const cam = useCamera();
  const [phase, setPhase] = useState<Phase>("preview");
  const [result, setResult] = useState<VideoResultWithBurnout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(RECORD_SECONDS);
  const [promptIndex, setPromptIndex] = useState(0);

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  // Rotate the prompt every few seconds while previewing / recording.
  useEffect(() => {
    if (phase !== "preview" && phase !== "recording") return;
    const id = setInterval(() => {
      setPromptIndex((i) => (i + 1) % PROMPTS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => clearCountdown, [clearCountdown]);

  const analyze = useCallback(async (uri: string) => {
    setPhase("analyzing");
    try {
      const res = (await submitVideo(DEFAULT_USER_ID, uri)) as VideoResultWithBurnout;
      setResult(res);
      setPhase("result");
    } catch {
      setErrorMsg("We couldn't analyze your check-in. Please try again.");
      setPhase("error");
    }
  }, []);

  const handleRecord = useCallback(async () => {
    setErrorMsg(null);
    setRemaining(RECORD_SECONDS);
    setPhase("recording");

    // Visible 60 -> 0 countdown. The real stop is driven by useCamera's
    // maxDuration; this just keeps the ring + numerals in sync.
    clearCountdown();
    countdownTimer.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

    const uri = await cam.startRecording(RECORD_SECONDS);
    clearCountdown();

    if (!uri) {
      setErrorMsg("Recording failed. Check camera + microphone access and try again.");
      setPhase("error");
      return;
    }
    await analyze(uri);
  }, [cam, analyze, clearCountdown]);

  const handleStopEarly = useCallback(() => {
    // Resolves the startRecording promise -> handleRecord continues to analyze.
    cam.stopRecording();
  }, [cam]);

  const reset = useCallback(() => {
    clearCountdown();
    setResult(null);
    setErrorMsg(null);
    setRemaining(RECORD_SECONDS);
    setPhase("preview");
  }, [clearCountdown]);

  // ---- Permission gate -----------------------------------------------------
  if (!cam.granted) {
    const denied =
      cam.permission?.granted === false && cam.permission?.canAskAgain === false;
    return (
      <PermissionGate
        denied={denied}
        onRequest={cam.requestPermission}
      />
    );
  }

  // ---- Analyzing -----------------------------------------------------------
  if (phase === "analyzing") {
    return <AnalyzingView />;
  }

  // ---- Result --------------------------------------------------------------
  if (phase === "result" && result) {
    return <ResultView result={result} onAgain={reset} />;
  }

  // ---- Error ---------------------------------------------------------------
  if (phase === "error") {
    return (
      <ErrorView
        message={errorMsg ?? "Something went wrong."}
        onRetry={reset}
      />
    );
  }

  // ---- Live camera (preview / recording) -----------------------------------
  const recording = phase === "recording";
  return (
    <View style={styles.cameraRoot}>
      <CameraView
        ref={cam.cameraRef}
        mode="video"
        facing="front"
        style={StyleSheet.absoluteFill}
      />

      {/* Darken edges so the face oval and controls read clearly. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10,10,10,0.55)", "transparent", "rgba(10,10,10,0.85)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <FaceOval active={recording} />

      <View style={styles.overlayTop} pointerEvents="none">
        <Text style={styles.promptEyebrow} allowFontScaling={false}>
          DAILY CHECK-IN
        </Text>
        <Text style={styles.promptText} allowFontScaling={false}>
          {PROMPTS[promptIndex]}
        </Text>
      </View>

      <View style={styles.overlayBottom}>
        {recording ? (
          <RecordingControls remaining={remaining} onStop={handleStopEarly} />
        ) : (
          <Pressable
            onPress={handleRecord}
            style={({ pressed }) => [styles.recordBtn, pressed && styles.pressed]}
          >
            <View style={styles.recordBtnInner} />
            <Text style={styles.recordBtnLabel} allowFontScaling={false}>
              Start check-in
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Permission gate
// ---------------------------------------------------------------------------
function PermissionGate({
  denied,
  onRequest,
}: {
  denied: boolean;
  onRequest: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = useCallback(async () => {
    setBusy(true);
    try {
      await onRequest();
    } finally {
      setBusy(false);
    }
  }, [onRequest]);

  return (
    <View style={styles.centerRoot}>
      <View style={styles.gateCard}>
        <View style={styles.gateIcon}>
          <View style={styles.gateLens} />
        </View>
        <Text style={styles.gateTitle} allowFontScaling={false}>
          Camera check-in
        </Text>
        <Text style={styles.gateBody} allowFontScaling={false}>
          A short video lets Pegasus read facial tension and voice patterns —
          subtle signals of stress you can't see yourself. Nothing is stored;
          only the analysis is kept.
        </Text>

        {denied ? (
          <Text style={styles.gateDenied} allowFontScaling={false}>
            Camera and microphone access are off. Enable them in Settings to use
            video check-ins.
          </Text>
        ) : null}

        <Pressable
          onPress={handle}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={COLORS.bg} />
          ) : (
            <Text style={styles.primaryBtnLabel} allowFontScaling={false}>
              {denied ? "Try again" : "Enable camera & mic"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Face-centering oval
// ---------------------------------------------------------------------------
function FaceOval({ active }: { active: boolean }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(glow);
    if (active) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      glow.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(glow);
  }, [active, glow]);

  const ovalStyle = useAnimatedStyle(() => {
    const c = active ? COLORS.red : "rgba(255,255,255,0.45)";
    return {
      borderColor: c,
      shadowColor: active ? COLORS.red : COLORS.blue,
      shadowOpacity: 0.25 + glow.value * 0.4,
      shadowRadius: 18 + glow.value * 18,
    };
  });

  return (
    <View style={styles.ovalWrap} pointerEvents="none">
      <Animated.View style={[styles.oval, ovalStyle]} />
      <Text style={styles.ovalHint} allowFontScaling={false}>
        {active ? "Recording — speak naturally" : "Center your face in the oval"}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Recording controls: 60->0 countdown ring + pulsing red dot + stop
// ---------------------------------------------------------------------------
function RecordingControls({
  remaining,
  onStop,
}: {
  remaining: number;
  onStop: () => void;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.55,
    transform: [{ scale: 0.85 + pulse.value * 0.3 }],
  }));

  const progress = remaining / RECORD_SECONDS; // 1 -> 0

  return (
    <View style={styles.recControls}>
      <View style={styles.recStatusRow}>
        <Animated.View style={[styles.redDot, dotStyle]} />
        <Text style={styles.recTime} allowFontScaling={false}>
          0:{String(remaining).padStart(2, "0")}
        </Text>
      </View>

      <CountdownRing progress={progress} />

      <Pressable
        onPress={onStop}
        style={({ pressed }) => [styles.stopBtn, pressed && styles.pressed]}
      >
        <View style={styles.stopSquare} />
        <Text style={styles.stopLabel} allowFontScaling={false}>
          Stop & analyze
        </Text>
      </Pressable>
    </View>
  );
}

// A simple SVG-free countdown ring: a track plus a foreground arc faked with a
// rotating, draining border. We approximate the depletion with width segments
// to avoid pulling in react-native-svg here — purposeful + lightweight.
function CountdownRing({ progress }: { progress: number }) {
  const size = 96;
  // Animate a shared value toward the latest progress for smooth depletion.
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 950, easing: Easing.linear });
  }, [progress, p]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + p.value * 0.4 }],
    opacity: 0.35 + p.value * 0.5,
  }));

  return (
    <View style={[styles.ringTrack, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View
        style={[
          styles.ringFill,
          { width: size - 16, height: size - 16, borderRadius: (size - 16) / 2 },
          fillStyle,
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Analyzing — brain pulse
// ---------------------------------------------------------------------------
function AnalyzingView() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.18 }],
    shadowOpacity: 0.5 + pulse.value * 0.4,
    shadowRadius: 30 + pulse.value * 26,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.35 }],
    opacity: 0.25 + pulse.value * 0.2,
  }));

  return (
    <View style={styles.centerRoot}>
      <View style={styles.brainWrap}>
        <Animated.View style={[styles.brainHalo, haloStyle]} />
        <Animated.View style={[styles.brainCore, coreStyle]}>
          <LinearGradient
            colors={["rgba(59,130,246,0.4)", "rgba(59,130,246,0.08)", COLORS.card]}
            start={{ x: 0.3, y: 0.2 }}
            end={{ x: 0.8, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <Text style={styles.analyzingTitle} allowFontScaling={false}>
        Analyzing…
      </Text>
      <Text style={styles.analyzingSub} allowFontScaling={false}>
        Reading facial tension and voice patterns
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
function ResultView({
  result,
  onAgain,
}: {
  result: VideoResultWithBurnout;
  onAgain: () => void;
}) {
  const facial = result.facial;
  const voice = result.voice;
  const burnout = result.burnout_result;

  const stress = clampScore(facial?.facial_stress_score ?? 0);
  // facial_stress_score is a STRESS score: low = calm/green, high = red.
  const stressColor = stressToColor(stress);

  const ind = facial?.facial_indicators;
  const eyes = facial?.eye_indicators;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.resultEyebrow} allowFontScaling={false}>
        CHECK-IN COMPLETE
      </Text>

      {/* Facial stress hero numeral */}
      <View style={styles.heroBlock}>
        <Text style={styles.heroLabel} allowFontScaling={false}>
          Facial stress
        </Text>
        <Text style={[styles.heroScore, { color: stressColor }]} allowFontScaling={false}>
          {stress}
          <Text style={styles.heroOutOf} allowFontScaling={false}>
            {" "}/100
          </Text>
        </Text>
        {ind?.overall_affect ? (
          <Text style={styles.heroAffect} allowFontScaling={false}>
            Affect: {ind.overall_affect}
          </Text>
        ) : null}
      </View>

      {/* Facial indicator bars (0-1 floats) */}
      {ind ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} allowFontScaling={false}>
            Facial tension
          </Text>
          <MetricBar label="Brow furrow" value01={ind.brow_furrow} />
          <MetricBar label="Eye strain" value01={1 - (eyes?.eye_openness ?? 1)} />
          <MetricBar label="Jaw clench" value01={ind.jaw_clench} />
          {typeof ind.lip_compression === "number" ? (
            <MetricBar label="Lip compression" value01={ind.lip_compression} />
          ) : null}
        </View>
      ) : null}

      {/* Voice readout */}
      {voice ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} allowFontScaling={false}>
            Voice
          </Text>
          <View style={styles.voiceRow}>
            <VoiceStat label="Pitch" value={fmtHz(voice.pitch_mean_hz)} />
            <VoiceStat label="Rate" value={fmtWpm(voice.speaking_rate_wpm)} />
            <VoiceStat
              label="Tremor"
              value={voice.voice_tremor ? "Yes" : "No"}
              tone={voice.voice_tremor ? COLORS.yellow : COLORS.green}
            />
          </View>
        </View>
      ) : null}

      {/* Updated Pegasus (burnout) score */}
      {burnout ? (
        <View style={styles.pegasusBlock}>
          <Text style={styles.pegasusLabel} allowFontScaling={false}>
            Updated your Pegasus score
          </Text>
          <CheckEngine
            score={burnout.score}
            level={burnout.level}
            size={220}
          />
          {burnout.intervention ? (
            <View style={[styles.card, styles.interventionCard]}>
              <Text style={styles.interventionText} allowFontScaling={false}>
                {burnout.intervention}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={onAgain}
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryBtnLabel} allowFontScaling={false}>
          New check-in
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function MetricBar({ label, value01 }: { label: string; value01: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value01 ?? 0) * 100)));
  const color = stressToColor(pct);
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHead}>
        <Text style={styles.metricLabel} allowFontScaling={false}>
          {label}
        </Text>
        <Text style={[styles.metricVal, { color }]} allowFontScaling={false}>
          {pct}%
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function VoiceStat({
  label,
  value,
  tone = COLORS.text,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={styles.voiceStat}>
      <Text style={[styles.voiceValue, { color: tone }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.voiceLabel} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------
function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centerRoot}>
      <View style={styles.gateCard}>
        <Text style={styles.errorTitle} allowFontScaling={false}>
          Check-in interrupted
        </Text>
        <Text style={styles.gateBody} allowFontScaling={false}>
          {message}
        </Text>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnLabel} allowFontScaling={false}>
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Map a 0-100 stress value to the accent palette (low = calm green).
function stressToColor(stress: number): string {
  if (stress >= 66) return levelColor("red");
  if (stress >= 33) return levelColor("yellow");
  return levelColor("green");
}

function fmtHz(hz?: number): string {
  if (typeof hz !== "number" || !isFinite(hz)) return "—";
  return `${Math.round(hz)} Hz`;
}

function fmtWpm(wpm?: number): string {
  if (typeof wpm !== "number" || !isFinite(wpm)) return "—";
  return `${Math.round(wpm)} wpm`;
}

const styles = StyleSheet.create({
  // Shared centered layout for gate / analyzing / error
  centerRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },

  // ---- Permission gate / error card ----
  gateCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  gateLens: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.blue,
  },
  gateTitle: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  gateBody: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
    lineHeight: 23,
    marginBottom: SPACING.lg,
  },
  gateDenied: {
    ...TYPE.caption,
    color: COLORS.yellow,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    ...TYPE.title,
    color: COLORS.red,
    marginBottom: SPACING.md,
    textAlign: "center",
  },

  // ---- Buttons ----
  primaryBtn: {
    width: "100%",
    backgroundColor: COLORS.text,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryBtnLabel: {
    ...TYPE.body,
    color: COLORS.bg,
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: SPACING.xl,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  secondaryBtnLabel: {
    ...TYPE.label,
    color: COLORS.text,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },

  // ---- Live camera ----
  cameraRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  overlayTop: {
    position: "absolute",
    top: 64,
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: "center",
  },
  promptEyebrow: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  promptText: {
    ...TYPE.heading,
    color: COLORS.text,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  ovalWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  oval: {
    width: 220,
    height: 290,
    borderRadius: 145,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  ovalHint: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.lg,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayBottom: {
    position: "absolute",
    bottom: 48,
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: "center",
  },

  // Idle record button
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  recordBtnInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    marginRight: SPACING.md,
  },
  recordBtnLabel: {
    ...TYPE.body,
    color: COLORS.text,
    fontWeight: "700",
  },

  // Recording controls
  recControls: {
    alignItems: "center",
  },
  recStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.red,
    marginRight: SPACING.sm,
  },
  recTime: {
    ...TYPE.heading,
    color: COLORS.text,
    fontVariant: ["tabular-nums"],
  },
  ringTrack: {
    borderWidth: 3,
    borderColor: "rgba(239,68,68,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  ringFill: {
    backgroundColor: "rgba(239,68,68,0.25)",
    borderWidth: 2,
    borderColor: COLORS.red,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: COLORS.red,
    marginRight: SPACING.sm,
  },
  stopLabel: {
    ...TYPE.body,
    color: COLORS.text,
    fontWeight: "700",
  },

  // ---- Analyzing brain ----
  brainWrap: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  brainHalo: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.blue,
  },
  brainCore: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  analyzingTitle: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  analyzingSub: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
  },

  // ---- Result ----
  scroll: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: 64,
    paddingBottom: SPACING.xxl,
  },
  resultEyebrow: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  heroBlock: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  heroLabel: {
    ...TYPE.label,
    color: COLORS.textDim,
    marginBottom: SPACING.sm,
  },
  heroScore: {
    fontSize: 72,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 76,
  },
  heroOutOf: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.textDim,
  },
  heroAffect: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.sm,
    textTransform: "capitalize",
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    ...TYPE.label,
    color: COLORS.textDim,
    marginBottom: SPACING.md,
  },
  metricRow: {
    marginBottom: SPACING.md,
  },
  metricHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  metricLabel: {
    ...TYPE.body,
    color: COLORS.text,
  },
  metricVal: {
    ...TYPE.label,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  voiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voiceStat: {
    flex: 1,
    alignItems: "center",
  },
  voiceValue: {
    ...TYPE.heading,
    fontVariant: ["tabular-nums"],
  },
  voiceLabel: {
    ...TYPE.caption,
    color: COLORS.textDim,
    marginTop: SPACING.xs,
  },
  pegasusBlock: {
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  pegasusLabel: {
    ...TYPE.heading,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  interventionCard: {
    marginTop: SPACING.lg,
    width: "100%",
  },
  interventionText: {
    ...TYPE.body,
    color: COLORS.text,
    lineHeight: 23,
  },
});
