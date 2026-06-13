// Owned by Rishith. On a physical phone, localhost won't reach the laptop —
// use the laptop's LAN IP. Find it with:  ipconfig getifaddr en0   (macOS)
// Override without editing code via Expo extra / env if you prefer.
export const BACKEND_URL = "http://192.168.1.XXX:8001"; // CHANGE to your laptop's LAN IP
export const DEFAULT_USER_ID = "demo_user";

// Polling cadence for the live burnout score (ms).
export const SCORE_POLL_MS = 30_000;
