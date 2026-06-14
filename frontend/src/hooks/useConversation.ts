// Owned by Rishith. The Talk-tab is a FaceTime-style voice call with Pegasus:
// press-and-hold to talk -> we record (expo-av, with live mic metering that
// drives the on-screen sound orb) -> POST the clip to the video service
// /converse, which transcribes it (NVIDIA parakeet), reads voice stress, asks
// the ML companion for a reply, and speaks it back (NVIDIA Chatterbox). We play
// that audio so Pegasus literally talks.
//
// `level` (0..1) is the live mic amplitude while recording — the screen scales
// the orb to it. Every turn is grounded in the user's burnout score/level.
// Cleans up the recorder + player on unmount. Nothing here throws to the screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
// SDK 54 moved the classic write/cacheDirectory API behind /legacy.
import * as FileSystem from "expo-file-system/legacy";

import { ChatMessage, ConverseResult } from "../types";
import { converse, speak } from "../services/api";

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hey, I'm Pegasus. No pressure and no judgement — how are you really doing right now?",
};

const RECORD_MODE = { allowsRecordingIOS: true, playsInSilentModeIOS: true } as const;
const PLAY_MODE = { allowsRecordingIOS: false, playsInSilentModeIOS: true } as const;

export function useConversation(userId: string, score?: number, level?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [sending, setSending] = useState(false); // a turn round-trip is in flight
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false); // Pegasus's voice is playing
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<ConverseResult["voice"] | null>(null);
  const [micLevel, setMicLevel] = useState(0); // live mic amplitude 0..1 (drives the orb)

  const recRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  // Mirror messages so async turns read the latest transcript without re-binding.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      recRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playB64 = useCallback(async (b64: string | null) => {
    if (!b64) return;
    try {
      await Audio.setAudioModeAsync(PLAY_MODE);
      const path = `${FileSystem.cacheDirectory}pegasus-reply-${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      await soundRef.current?.unloadAsync().catch(() => {});
      const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      soundRef.current = sound;
      setSpeaking(true);
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          setSpeaking(false);
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) soundRef.current = null;
        }
      });
    } catch {
      setSpeaking(false);
    }
  }, []);

  // --- VOICE turn (press to talk) -----------------------------------------
  const startRecording = useCallback(async () => {
    if (recording || sending) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone access is needed to talk.");
        return;
      }
      await Audio.setAudioModeAsync(RECORD_MODE);
      const rec = new Audio.Recording();
      // Enable metering so the orb can react to how loudly you're speaking.
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      rec.setProgressUpdateInterval(80);
      rec.setOnRecordingStatusUpdate((st) => {
        if (st.isRecording && typeof st.metering === "number") {
          // metering is dBFS (~-60 quiet .. 0 loud) -> 0..1
          setMicLevel(Math.max(0, Math.min(1, (st.metering + 55) / 55)));
        }
      });
      await rec.startAsync();
      recRef.current = rec;
      setRecording(true);
      setError(null);
    } catch {
      setRecording(false);
      setError("Couldn't start recording.");
    }
  }, [recording, sending]);

  const stopAndSend = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    setRecording(false);
    setMicLevel(0);
    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      uri = rec.getURI();
    } catch {
      /* fall through to the no-uri guard */
    }
    recRef.current = null;
    if (!uri) {
      setError("Didn't catch that — hold the mic and try again.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await converse(userId, uri, messagesRef.current, score, level);
      const turns: ChatMessage[] = [];
      if (res.transcript) turns.push({ role: "user", content: res.transcript });
      turns.push({ role: "assistant", content: res.reply });
      setMessages((prev) => [...prev, ...turns]);
      setVoice(res.voice ?? null);
      playB64(res.audio_b64);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't reach Pegasus. Check the video service is running.");
    } finally {
      setSending(false);
    }
  }, [userId, score, level, playB64]);

  // Stop recording WITHOUT sending — called when the screen loses focus or
  // unmounts, so the recorder + audio session don't keep running in the
  // background (which is what was crashing the app on tab switch).
  const cancel = useCallback(async () => {
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    setMicLevel(0);
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {}
    }
    try {
      await soundRef.current?.stopAsync();
    } catch {}
  }, []);

  // Speak Pegasus's opening line aloud (called when entering voice mode).
  const greet = useCallback(async () => {
    try {
      const { audio_b64 } = await speak(GREETING.content);
      playB64(audio_b64);
    } catch {
      /* greeting stays text-only */
    }
  }, [playB64]);

  const reset = useCallback(() => {
    setMessages([GREETING]);
    setError(null);
    setVoice(null);
  }, []);

  return {
    messages,
    sending,
    recording,
    speaking,
    error,
    voice,
    level: micLevel,
    startRecording,
    stopAndSend,
    cancel,
    greet,
    reset,
  };
}
