// Owned by Rishith. All backend calls live here. Wesley imports these.
// Talks ONLY to Jason's backend (:8001). Endpoints per shared/contract.
import {
  UserResponse,
  BurnoutResult,
  Stimulus,
  BrainData,
  VideoResult,
  ChatMessage,
  ConverseResult,
  HistoryEntry,
} from "../types";
import { BACKEND_URL, ML_URL, VIDEO_URL, SIGNALS_URL } from "./config";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getStimulus(userId: string): Promise<Stimulus> {
  return json(await fetch(`${BACKEND_URL}/stimulus/today/${userId}`));
}

export async function submitResponse(data: UserResponse): Promise<BurnoutResult> {
  return json(
    await fetch(`${BACKEND_URL}/response/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

// Live, DERIVED wellness reading (higher = better). The ML service updates this
// every time the user talks or texts, so it actually moves.
export async function getScore(userId: string): Promise<BurnoutResult> {
  return json(await fetch(`${ML_URL}/wellness/${userId}`));
}

// Past check-ins + talks (most recent first) — from the ML history store.
export async function getHistory(userId: string): Promise<HistoryEntry[]> {
  return json(await fetch(`${ML_URL}/history/${userId}`));
}

export async function getBrainData(userId: string): Promise<BrainData> {
  return json(await fetch(`${BACKEND_URL}/brain/${userId}`));
}

export async function getMetrics(userId: string): Promise<any> {
  return json(await fetch(`${BACKEND_URL}/metrics/${userId}`));
}

export async function submitVideo(userId: string, videoUri: string): Promise<VideoResult> {
  const fd = new FormData();
  // React Native FormData file shape:
  fd.append("video", { uri: videoUri, type: "video/mp4", name: "checkin.mp4" } as any);
  fd.append("user_id", userId);
  return json(await fetch(`${BACKEND_URL}/video/submit`, { method: "POST", body: fd }));
}

// Companion chat (text turn). Talks DIRECTLY to the ML service (:8003), not the
// backend — it's a stateless turn: send the running transcript + the user's
// current score/level for grounding, get back one reply.
export async function sendChat(
  userId: string,
  messages: ChatMessage[],
  score?: number,
  level?: string
): Promise<{ reply: string }> {
  return json(
    await fetch(`${ML_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, messages, score, level }),
    })
  );
}

// Voice-call turn (Talk tab, voice mode). Uploads the user's spoken audio to the
// video service, which transcribes it (NVIDIA parakeet), reads voice stress,
// asks the ML companion for a reply, and speaks it back (NVIDIA Chatterbox).
// Returns the transcript, reply text, reply audio (base64 WAV), and voice stress.
export async function converse(
  userId: string,
  audioUri: string,
  history: ChatMessage[],
  score?: number,
  level?: string
): Promise<ConverseResult> {
  const fd = new FormData();
  fd.append("audio", { uri: audioUri, type: "audio/m4a", name: "turn.m4a" } as any);
  fd.append("history", JSON.stringify(history));
  fd.append("user_id", userId);
  if (score != null) fd.append("score", String(score));
  if (level) fd.append("level", level);
  return json(await fetch(`${VIDEO_URL}/converse`, { method: "POST", body: fd }));
}

// Synthesize arbitrary text to speech (Pegasus's opening line). Returns base64
// WAV, or null audio if TTS is unavailable.
export async function speak(text: string): Promise<{ audio_b64: string | null; sample_rate: number }> {
  return json(
    await fetch(`${VIDEO_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
  );
}

// Single-frame facial affect (HF model) for the live video call — fast read of
// the user's face during the FaceTime conversation.
export async function analyzeFrame(
  imageUri: string
): Promise<{ facial_stress_score: number; overall_affect?: string; emotion_distribution?: Record<string, number> }> {
  const fd = new FormData();
  fd.append("image", { uri: imageUri, type: "image/jpeg", name: "frame.jpg" } as any);
  return json(await fetch(`${VIDEO_URL}/facial-frame`, { method: "POST", body: fd }));
}

// SMS / iMessage check-ins (Bloo.io). Talks to the signals service (:8002):
// register the phone, then trigger a pulse-check text (an emotionally-evocative
// image stimulus). The user replies by text and the bot scores it.
export async function registerPhone(
  userId: string,
  phone: string
): Promise<{ registered: boolean; phone: string }> {
  return json(
    await fetch(`${SIGNALS_URL}/register-phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, phone }),
    })
  );
}

export async function sendCheckin(userId: string, phone: string): Promise<any> {
  return json(
    await fetch(`${SIGNALS_URL}/send-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, phone }),
    })
  );
}
