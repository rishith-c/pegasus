import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import PulseRing from '../components/PulseRing';
import CheckEngine from '../components/CheckEngine';
import ScoreBreakdown from '../components/ScoreBreakdown';
import { COLORS, ColorTheme, Level } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

// TODO: replace with `await submitVideo(userId, videoUri)` result
const PLACEHOLDER_RESULT: {
  facialStress: number;
  level: Level;
  breakdown: { label: string; value: number }[];
  voice: { pitch: string; rate: string; tremor: boolean };
  newScore: number;
  newLevel: Level;
} = {
  facialStress: 58,
  level: 'yellow',
  breakdown: [
    { label: 'Brow', value: 0.6 },
    { label: 'Eyes', value: 0.45 },
    { label: 'Jaw', value: 0.55 },
  ],
  voice: { pitch: 'Slightly elevated', rate: 'Faster than usual', tremor: true },
  newScore: 58,
  newLevel: 'yellow',
};

const PROMPTS = [
  'Tell me about your day.',
  "What's been on your mind lately?",
  'How did you sleep last night?',
];

const CHECK_IN_SECONDS = 60;

type Stage = 'idle' | 'recording' | 'analyzing' | 'result';

export default function CheckInScreen() {
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [stage, setStage] = useState<Stage>('idle');
  const [secondsLeft, setSecondsLeft] = useState(CHECK_IN_SECONDS);
  const [promptIndex, setPromptIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shutterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoStartRef = useRef<number | undefined>(undefined);
  const stageRef = useRef(stage);
  const cameraRef = useRef<CameraView>(null);
  const videoUriRef = useRef<string | null>(null);
  const permissionRequestedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const hasPermissions = !!cameraPermission?.granted && !!microphonePermission?.granted;
  const shutterScale = useSharedValue(1);
  const recording = useSharedValue(0);
  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
    width: interpolate(recording.value, [0, 1], [56, 28]),
    height: interpolate(recording.value, [0, 1], [56, 28]),
    borderRadius: interpolate(recording.value, [0, 1], [28, 8]),
  }));

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (permissionRequestedRef.current) return;
    if (!cameraPermission || !microphonePermission) return;
    permissionRequestedRef.current = true;
    if (!cameraPermission.granted) requestCameraPermission();
    if (!microphonePermission.granted) requestMicrophonePermission();
  }, [cameraPermission, microphonePermission, requestCameraPermission, requestMicrophonePermission]);

  const requestPermissions = () => {
    permissionRequestedRef.current = true;
    requestCameraPermission();
    requestMicrophonePermission();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (shutterTimeoutRef.current) clearTimeout(shutterTimeoutRef.current);
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    };
  }, []);

  const startRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (shutterTimeoutRef.current) clearTimeout(shutterTimeoutRef.current);
    if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    setSecondsLeft(CHECK_IN_SECONDS);
    setStage('recording');
    recording.value = withTiming(1, { duration: 200 });
    cameraRef.current
      ?.recordAsync({ maxDuration: CHECK_IN_SECONDS })
      .then((video) => {
        videoUriRef.current = video?.uri ?? null;
      })
      .catch(() => {});
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recording.value = withTiming(0, { duration: 200 });
    setStage('analyzing');
    cameraRef.current?.stopRecording();
    // TODO: const result = await submitVideo(userId, videoUriRef.current)
    analyzeTimeoutRef.current = setTimeout(() => setStage('result'), 1800);
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (shutterTimeoutRef.current) clearTimeout(shutterTimeoutRef.current);
    if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    cameraRef.current?.stopRecording();
    recording.value = 0;
    setSecondsLeft(CHECK_IN_SECONDS);
    setStage('idle');
    // discard the temp video file from this cancelled take
    videoUriRef.current = null;
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (stageRef.current !== 'idle') {
          cancelRecording();
        }
      };
    }, [])
  );

  useEffect(() => {
    const token = route.params?.autoStart;
    if (token && token !== lastAutoStartRef.current) {
      lastAutoStartRef.current = token;
      startRecording();
    }
  }, [route.params?.autoStart]);

  const reset = () => {
    setPromptIndex((i) => (i + 1) % PROMPTS.length);
    setStage('idle');
  };

  const pressShutter = () => {
    if (!hasPermissions) {
      requestPermissions();
      return;
    }
    const wasRecording = stage === 'recording';
    shutterScale.value = withSequence(
      withTiming(0.85, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) })
    );
    shutterTimeoutRef.current = setTimeout(wasRecording ? finishRecording : startRecording, 160);
  };

  if (stage === 'result') {
    return (
      <Animated.View key="result" style={styles.container} entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
        <View style={styles.content}>
          <Text style={styles.title}>Check-In Results</Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Facial Stress</Text>
            <Text style={[styles.resultScore, { color: levelTint(PLACEHOLDER_RESULT.level) }]}>
              {PLACEHOLDER_RESULT.facialStress}
            </Text>
            <ScoreBreakdown items={PLACEHOLDER_RESULT.breakdown} />
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Voice</Text>
            <Text style={styles.voiceRow}>Pitch: {PLACEHOLDER_RESULT.voice.pitch}</Text>
            <Text style={styles.voiceRow}>Speaking rate: {PLACEHOLDER_RESULT.voice.rate}</Text>
            <Text style={styles.voiceRow}>
              Tremor detected: {PLACEHOLDER_RESULT.voice.tremor ? 'Yes' : 'No'}
            </Text>
          </View>

          <Text style={styles.updatedLabel}>This updated your Pegasus score to</Text>
          <CheckEngine score={PLACEHOLDER_RESULT.newScore} level={PLACEHOLDER_RESULT.newLevel} size={160} />

          <TouchableOpacity style={styles.button} onPress={reset}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  if (stage === 'analyzing') {
    return (
      <Animated.View key="analyzing" style={styles.container} entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
        <View style={styles.centerContent}>
          <PulseRing duration={1600} scaleTo={1.12}>
            <MaterialCommunityIcons name="brain" size={64} color={colors.blue} />
          </PulseRing>
          <Text style={styles.analyzingText}>Analyzing your check-in...</Text>
        </View>
      </Animated.View>
    );
  }

  const recordingNow = stage === 'recording';

  return (
    <Animated.View key="main" style={styles.container} entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
      <View style={styles.centerContent}>
        <Text style={styles.title}>Video Check-In</Text>
        <View style={styles.cameraPreview}>
          {hasPermissions ? (
            <>
              <CameraView ref={cameraRef} style={styles.cameraView} facing="front" mode="video" />
              <View style={styles.faceOval} />
            </>
          ) : (
            <View style={styles.permissionPrompt}>
              <MaterialCommunityIcons name="camera-off-outline" size={36} color={colors.textDim} />
              <Text style={styles.permissionText}>
                Camera & microphone access is needed for video check-ins
              </Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
                <Text style={styles.permissionButtonText}>Allow Access</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.prompt}>{PROMPTS[promptIndex]}</Text>
        <View style={styles.shutterWrapper}>
          {recordingNow && (
            <PulseRing duration={1400} scaleTo={1.15} style={styles.recordingRing}>
              <View style={styles.recordingRingInner} />
            </PulseRing>
          )}
          <Pressable style={styles.recordButton} onPress={pressShutter}>
            <Animated.View style={[styles.recordButtonInner, shutterStyle]} />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {recordingNow ? `Recording... ${secondsLeft}s left, tap to finish` : 'Tap to start a 60-second check-in'}
        </Text>
      </View>
    </Animated.View>
  );
}

function levelTint(level: Level) {
  return level === 'green' ? COLORS.green : level === 'yellow' ? COLORS.yellow : COLORS.red;
}

function createStyles(colors: ColorTheme, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 24, paddingTop: 60, alignItems: 'center', gap: 16 },
    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    cameraPreview: {
      width: 220,
      height: 280,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraView: { ...StyleSheet.absoluteFillObject },
    faceOval: {
      width: 140,
      height: 180,
      borderRadius: 90,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    permissionPrompt: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 14,
    },
    permissionText: {
      color: colors.textDim,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    permissionButton: {
      backgroundColor: colors.green,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 24,
    },
    permissionButtonText: { color: '#05050a', fontSize: 13, fontWeight: '800' },
    prompt: { color: colors.text, fontSize: 18, textAlign: 'center', lineHeight: 26 },
    shutterWrapper: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
    recordButton: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 4,
      borderColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordButtonInner: { backgroundColor: colors.red },
    recordingRing: { position: 'absolute', width: 96, height: 96, top: -10, left: -10 },
    recordingRingInner: {
      flex: 1,
      borderRadius: 48,
      borderWidth: isDark ? 2 : 3,
      borderColor: isDark ? colors.red : '#c0392b',
    },
    hint: { color: colors.textDim, fontSize: 13 },
    analyzingText: { color: colors.textDim, fontSize: 15 },
    resultCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    resultLabel: {
      color: colors.textDim,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    resultScore: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
    voiceRow: { color: colors.text, fontSize: 14 },
    updatedLabel: { color: colors.textDim, fontSize: 13, marginTop: 8 },
    button: {
      marginTop: 8,
      backgroundColor: colors.green,
      borderRadius: 999,
      paddingVertical: 16,
      paddingHorizontal: 48,
      width: '100%',
      alignItems: 'center',
    },
    buttonText: { color: '#05050a', fontSize: 16, fontWeight: '800' },
  });
}
