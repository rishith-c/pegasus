// StimulusScreen — the daily pulse check. Shows today's stimulus, captures a
// typed response (with behavioral biometrics), submits it, and reveals the
// resulting CheckEngine + InterventionCard. Calm, inviting, premium.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio, AVPlaybackStatus } from "expo-av";

import CheckEngine from "../components/CheckEngine";
import InterventionCard from "../components/InterventionCard";
import { Stimulus, UserResponse, BurnoutResult } from "../types";
import { getStimulus, submitResponse } from "../services/api";
import { useResponseTracker } from "../hooks/useResponseTracker";
import { DEFAULT_USER_ID } from "../services/config";
import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

export default function StimulusScreen() {
  const tracker = useResponseTracker();

  const [stimulus, setStimulus] = useState<Stimulus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<BurnoutResult | null>(null);

  // expo-av audio playback for audio stimuli.
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const loadStimulus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setResult(null);
    setSubmitError(null);
    setText("");
    try {
      const s = await getStimulus(DEFAULT_USER_ID);
      setStimulus(s);
      // Start the behavioral clock the moment a fresh stimulus is shown.
      tracker.reset();
    } catch (e: any) {
      setLoadError(e?.message ?? "Couldn't load today's pulse.");
    } finally {
      setLoading(false);
    }
  }, [tracker]);

  useEffect(() => {
    loadStimulus();
  }, [loadStimulus]);

  // Clean up any loaded audio when the stimulus changes or we unmount.
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [stimulus?.id]);

  const onPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, []);

  const toggleAudio = useCallback(async () => {
    if (!stimulus) return;
    try {
      if (!soundRef.current) {
        setAudioLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: stimulus.url },
          { shouldPlay: true },
          onPlaybackStatus
        );
        soundRef.current = sound;
        setAudioLoading(false);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch {
      setAudioLoading(false);
      setSubmitError("Couldn't play the audio clip.");
    }
  }, [stimulus, onPlaybackStatus]);

  const onKeyPress = tracker.onKeyPress;
  const onChangeText = useCallback(
    (t: string) => {
      tracker.onChangeText(t);
      setText(t);
    },
    [tracker]
  );

  const handleSubmit = useCallback(async () => {
    if (!stimulus || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const metrics = tracker.getMetrics();
      const payload: UserResponse = {
        user_id: DEFAULT_USER_ID,
        stimulus_id: stimulus.id,
        response_text: text,
        ...metrics,
        source: "app",
        timestamp: new Date().toISOString(),
      };
      const res = await submitResponse(payload);
      setResult(res);
    } catch (e: any) {
      setSubmitError(e?.message ?? "Couldn't submit your response.");
    } finally {
      setSubmitting(false);
    }
  }, [stimulus, submitting, tracker, text]);

  // ---- Loading ----
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.fillCenter}>
          <ActivityIndicator color={COLORS.green} size="large" />
          <Text style={styles.muted}>Preparing today's pulse…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Load error / empty ----
  if (loadError || !stimulus) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.fillCenter}>
          <Text style={styles.eyebrow}>DAILY PULSE</Text>
          <Text style={styles.errorTitle}>Nothing to check in on</Text>
          <Text style={styles.muted}>
            {loadError ?? "There's no pulse check waiting for you right now."}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={loadStimulus}
          >
            <Text style={styles.secondaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Result view (after submit) ----
  if (result) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>YOUR PULSE</Text>
          <Text style={styles.resultTitle}>Thanks for checking in.</Text>

          <View style={styles.engineWrap}>
            <CheckEngine score={result.score} level={result.level} />
          </View>

          <InterventionCard text={result.intervention} />

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={loadStimulus}
          >
            <Text style={styles.secondaryBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Stimulus + response view ----
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>DAILY PULSE</Text>

          {/* Stimulus body, rendered by type. */}
          {stimulus.type === "image" && (
            <View style={styles.stimulusBlock}>
              <Image
                source={{ uri: stimulus.url }}
                style={styles.image}
                resizeMode="cover"
              />
              <Text style={styles.question}>
                {stimulus.prompt || "How does this make you feel?"}
              </Text>
            </View>
          )}

          {stimulus.type === "text" && (
            <View style={styles.stimulusBlock}>
              <Text style={styles.bigPrompt}>{stimulus.prompt}</Text>
            </View>
          )}

          {stimulus.type === "audio" && (
            <View style={styles.stimulusBlock}>
              <Pressable
                style={({ pressed }) => [styles.audioBtn, pressed && styles.pressed]}
                onPress={toggleAudio}
                disabled={audioLoading}
              >
                {audioLoading ? (
                  <ActivityIndicator color={COLORS.green} />
                ) : (
                  <View
                    style={isPlaying ? styles.pauseGlyph : styles.playGlyph}
                  />
                )}
              </Pressable>
              <Text style={styles.audioHint}>
                {isPlaying ? "Listening…" : "Tap to listen"}
              </Text>
              <Text style={styles.question}>{stimulus.prompt}</Text>
            </View>
          )}

          {/* Response input wired to the behavioral tracker. */}
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={onChangeText}
              onKeyPress={onKeyPress}
              placeholder="Take a moment. Write what comes to mind…"
              placeholderTextColor={COLORS.textDim}
              multiline
              textAlignVertical="top"
              selectionColor={COLORS.green}
              autoCorrect
              autoCapitalize="sentences"
            />
          </View>

          {submitError && <Text style={styles.errorInline}>{submitError}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (submitting || text.trim().length === 0) && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleSubmit}
            disabled={submitting || text.trim().length === 0}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Submit pulse</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  fillCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },
  resultContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    alignItems: "center",
    gap: SPACING.lg,
  },
  eyebrow: {
    ...TYPE.label,
    color: COLORS.textDim,
    letterSpacing: 2,
  },
  // Stimulus
  stimulusBlock: {
    gap: SPACING.md,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  question: {
    ...TYPE.title,
    color: COLORS.text,
    lineHeight: 34,
  },
  bigPrompt: {
    ...TYPE.hero,
    fontSize: 40,
    lineHeight: 48,
    color: COLORS.text,
  },
  // Audio
  audioBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.green,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  playGlyph: {
    width: 0,
    height: 0,
    marginLeft: 6,
    borderTopWidth: 16,
    borderBottomWidth: 16,
    borderLeftWidth: 26,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: COLORS.green,
  },
  pauseGlyph: {
    width: 24,
    height: 28,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderColor: COLORS.green,
  },
  audioHint: {
    ...TYPE.label,
    color: COLORS.textDim,
    textAlign: "center",
    letterSpacing: 1.5,
  },
  // Input
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  input: {
    ...TYPE.body,
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  primaryBtnText: {
    ...TYPE.heading,
    color: COLORS.bg,
    fontSize: 17,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  secondaryBtn: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  secondaryBtnText: {
    ...TYPE.body,
    color: COLORS.text,
  },
  pressed: {
    opacity: 0.7,
  },
  // States
  muted: {
    ...TYPE.body,
    color: COLORS.textDim,
    textAlign: "center",
  },
  errorTitle: {
    ...TYPE.title,
    color: COLORS.text,
    textAlign: "center",
  },
  errorInline: {
    ...TYPE.body,
    color: COLORS.red,
    textAlign: "center",
  },
  // Result
  resultTitle: {
    ...TYPE.title,
    color: COLORS.text,
    textAlign: "center",
  },
  engineWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: SPACING.sm,
  },
});
