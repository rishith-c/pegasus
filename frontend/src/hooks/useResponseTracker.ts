// Owned by Rishith. Captures typing/behavioral biometrics from a TextInput.
// Wesley wires the returned handlers into <ResponseInput />:
//   const t = useResponseTracker();
//   <TextInput onKeyPress={t.onKeyPress} onChangeText={(s)=>{ t.onChangeText(s); setText(s); }} />
//   const metrics = t.getMetrics();   // spread into submitResponse({...metrics})
//   t.reset();                        // call when a new stimulus is shown
import { useCallback, useRef } from "react";
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native";

interface Metrics {
  typing_wpm: number;
  error_rate: number;
  hesitation_count: number;
  response_time_ms: number;
  response_latency_ms: number;
}

interface TrackerState {
  shownAt: number;        // when stimulus was shown (reset())
  startTime: number | null; // first keystroke
  lastKeyTime: number | null;
  keystrokes: number;
  backspaces: number;
  hesitations: number;
  text: string;
}

const fresh = (): TrackerState => ({
  shownAt: Date.now(),
  startTime: null,
  lastKeyTime: null,
  keystrokes: 0,
  backspaces: 0,
  hesitations: 0,
  text: "",
});

export function useResponseTracker() {
  const s = useRef<TrackerState>(fresh());

  const onKeyPress = useCallback((e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const now = Date.now();
    const key = e?.nativeEvent?.key;
    const st = s.current;
    if (st.startTime === null) st.startTime = now;
    if (st.lastKeyTime !== null && now - st.lastKeyTime > 3000) st.hesitations++;
    if (key === "Backspace") st.backspaces++;
    st.keystrokes++;
    st.lastKeyTime = now;
  }, []);

  // onKeyPress isn't reliable for every platform/IME — track text length too.
  const onChangeText = useCallback((value: string) => {
    const st = s.current;
    if (st.startTime === null) st.startTime = Date.now();
    st.text = value;
  }, []);

  const getMetrics = useCallback((): Metrics => {
    const st = s.current;
    const now = Date.now();
    const start = st.startTime ?? now;
    const elapsedMin = Math.max((now - start) / 60000, 1 / 60000);
    const words = st.text.trim() ? st.text.trim().split(/\s+/).length : 0;
    const typedChars = Math.max(st.keystrokes, st.text.length);
    return {
      typing_wpm: Math.round(words / elapsedMin) || 0,
      error_rate: typedChars ? Math.round((st.backspaces / typedChars) * 100) : 0,
      hesitation_count: st.hesitations,
      response_time_ms: now - st.shownAt,
      response_latency_ms: (st.startTime ?? now) - st.shownAt,
    };
  }, []);

  const reset = useCallback(() => {
    s.current = fresh();
  }, []);

  return { onKeyPress, onChangeText, getMetrics, reset };
}
