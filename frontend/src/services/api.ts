// Owned by Rishith. All backend calls live here. Wesley imports these.
// Talks ONLY to Jason's backend (:8001). Endpoints per shared/contract.
import {
  UserResponse,
  BurnoutResult,
  Stimulus,
  BrainData,
  VideoResult,
} from "../types";
import { BACKEND_URL } from "./config";

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

export async function getScore(userId: string): Promise<BurnoutResult> {
  return json(await fetch(`${BACKEND_URL}/score/${userId}`));
}

export async function getHistory(userId: string): Promise<BurnoutResult[]> {
  return json(await fetch(`${BACKEND_URL}/history/${userId}`));
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
