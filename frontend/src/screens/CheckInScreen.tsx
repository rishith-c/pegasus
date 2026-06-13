import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PulseRing from '../components/PulseRing';
import CheckEngine from '../components/CheckEngine';
import ScoreBreakdown from '../components/ScoreBreakdown';
import { COLORS, Level } from '../utils/colors';

// TODO: wire up `useCamera()` for permissions + preview + startRecording/stopRecording
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
  const [stage, setStage] = useState<Stage>('idle');
  const [secondsLeft, setSecondsLeft] = useState(CHECK_IN_SECONDS);
  const [promptIndex, setPromptIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    setSecondsLeft(CHECK_IN_SECONDS);
    setStage('recording');
    // TODO: await camera.startRecording(CHECK_IN_SECONDS)
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
    setStage('analyzing');
    // TODO: const videoUri = await camera.stopRecording()
    // TODO: const result = await submitVideo(userId, videoUri)
    setTimeout(() => setStage('result'), 1800);
  };

  const reset = () => {
    setPromptIndex((i) => (i + 1) % PROMPTS.length);
    setStage('idle');
  };

  if (stage === 'result') {
    return (
      <View style={styles.container}>
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
      </View>
    );
  }

  if (stage === 'analyzing') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <PulseRing duration={900} scaleTo={1.2}>
            <Text style={styles.brainEmoji}>🧠</Text>
          </PulseRing>
          <Text style={styles.analyzingText}>Analyzing your check-in...</Text>
        </View>
      </View>
    );
  }

  if (stage === 'recording') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.cameraPreview}>
            <View style={styles.faceOval} />
          </View>
          <View style={styles.recordingRow}>
            <PulseRing duration={500} scaleTo={1.4}>
              <View style={styles.recDot} />
            </PulseRing>
            <Text style={styles.countdown}>{secondsLeft}s</Text>
          </View>
          <Text style={styles.prompt}>{PROMPTS[promptIndex]}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <Text style={styles.title}>Video Check-In</Text>
        <View style={styles.cameraPreview}>
          <View style={styles.faceOval} />
          <Text style={styles.previewHint}>Camera preview</Text>
        </View>
        <Text style={styles.prompt}>{PROMPTS[promptIndex]}</Text>
        <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
          <View style={styles.recordButtonInner} />
        </TouchableOpacity>
        <Text style={styles.hint}>Tap to start a 60-second check-in</Text>
      </View>
    </View>
  );
}

function levelTint(level: Level) {
  return level === 'green' ? COLORS.green : level === 'yellow' ? COLORS.yellow : COLORS.red;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 60, alignItems: 'center', gap: 16 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  cameraPreview: {
    width: 220,
    height: 280,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOval: {
    width: 140,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  previewHint: { color: COLORS.textDim, fontSize: 12, marginTop: 12, position: 'absolute', bottom: 16 },
  prompt: { color: COLORS.text, fontSize: 18, textAlign: 'center', lineHeight: 26 },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.red },
  hint: { color: COLORS.textDim, fontSize: 13 },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.red },
  countdown: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  brainEmoji: { fontSize: 64 },
  analyzingText: { color: COLORS.textDim, fontSize: 15 },
  resultCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  resultLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resultScore: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
  voiceRow: { color: COLORS.text, fontSize: 14 },
  updatedLabel: { color: COLORS.textDim, fontSize: 13, marginTop: 8 },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.green,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#05050a', fontSize: 16, fontWeight: '800' },
});
