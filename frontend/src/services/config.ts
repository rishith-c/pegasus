// Owned by Rishith. The phone can't reach this Mac over the LAN (firewall + VPN),
// so every backend service is exposed over its own cloudflare tunnel and the app
// talks to those public HTTPS URLs. (Quick-tunnel URLs are regenerated each run —
// if they change, update them here.)
export const BACKEND_URL = "https://moms-efficiency-standard-accessory.trycloudflare.com"; // :8001 orchestrator
export const ML_URL = "https://pad-metropolitan-beverly-sender.trycloudflare.com"; // :8003 TRIBE+HF+RAG, /chat
export const VIDEO_URL = "https://suffered-cpu-sustainable-sciences.trycloudflare.com"; // :8004 facial/voice, /converse, /tts
export const SIGNALS_URL = "https://whale-epinions-summary-dry.trycloudflare.com"; // :8002 SMS bot

export const DEFAULT_USER_ID = "demo_user";

// Polling cadence for the live burnout score (ms).
export const SCORE_POLL_MS = 30_000;
