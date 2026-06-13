import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import ResponseInput from '../components/ResponseInput';
import CheckEngine from '../components/CheckEngine';
import InterventionCard from '../components/InterventionCard';
import { COLORS, Level } from '../utils/colors';

// TODO: replace with `await getStimulus(userId)` once Rishith's api.ts lands
const PLACEHOLDER_STIMULUS = {
  id: 'calm_01',
  type: 'text' as const,
  prompt: 'Picture yourself by a quiet lake at sunrise. How does this make you feel?',
};

// TODO: replace with the BurnoutResult returned from `submitResponse(...)`
const PLACEHOLDER_RESULT: { score: number; level: Level; intervention: string } = {
  score: 45,
  level: 'yellow',
  intervention: 'Your response took a bit longer than usual. Consider a short breathing exercise.',
};

type Stage = 'prompt' | 'result';

export default function StimulusScreen() {
  const [stage, setStage] = useState<Stage>('prompt');
  const [text, setText] = useState('');
  const startTimeRef = useRef<number | null>(null);
  const keystrokesRef = useRef(0);
  const backspacesRef = useRef(0);

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    if (e.nativeEvent.key === 'Backspace') backspacesRef.current += 1;
    keystrokesRef.current += 1;
  };

  const handleSubmit = () => {
    if (!text.trim()) return;

    const now = Date.now();
    const responseTimeMs = startTimeRef.current ? now - startTimeRef.current : 0;
    const elapsedMinutes = responseTimeMs / 1000 / 60;
    const wordCount = text.trim().split(/\s+/).length;
    const typingWpm = elapsedMinutes > 0 ? Math.round(wordCount / elapsedMinutes) : 0;
    const errorRate =
      keystrokesRef.current > 0 ? Math.round((backspacesRef.current / keystrokesRef.current) * 100) : 0;

    // TODO: replace with submitResponse({ user_id, stimulus_id: PLACEHOLDER_STIMULUS.id,
    //   response_text: text, response_time_ms: responseTimeMs, typing_wpm: typingWpm,
    //   error_rate: errorRate, source: 'app' })
    console.log('response signals', { responseTimeMs, typingWpm, errorRate });

    setStage('result');
  };

  const reset = () => {
    setText('');
    startTimeRef.current = null;
    keystrokesRef.current = 0;
    backspacesRef.current = 0;
    setStage('prompt');
  };

  if (stage === 'result') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Updated Score</Text>
          <CheckEngine score={PLACEHOLDER_RESULT.score} level={PLACEHOLDER_RESULT.level} size={180} />
          <InterventionCard text={PLACEHOLDER_RESULT.intervention} />
          <TouchableOpacity style={styles.button} onPress={reset}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>Pulse Check</Text>
        <Text style={styles.prompt}>{PLACEHOLDER_STIMULUS.prompt}</Text>
        <ResponseInput value={text} onChangeText={setText} onKeyPress={handleKeyPress} />
        <TouchableOpacity
          style={[styles.button, !text.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim()}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, padding: 24, paddingTop: 60, alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 24 },
  prompt: { color: COLORS.text, fontSize: 20, textAlign: 'center', marginBottom: 24, lineHeight: 28 },
  button: {
    marginTop: 24,
    backgroundColor: COLORS.green,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: COLORS.border },
  buttonText: { color: '#05050a', fontSize: 16, fontWeight: '800' },
});
