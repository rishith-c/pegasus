// All calls go through the Vite proxy to the backend (:8001).
const BASE = "/api";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  health: () => req("/health"),
  createUser: (name, phone) =>
    req("/users", { method: "POST", body: JSON.stringify({ name, phone }) }),
  todayStimulus: (userId) => req(`/stimulus/today?user_id=${encodeURIComponent(userId)}`),
  checkin: (payload) =>
    req("/checkin", { method: "POST", body: JSON.stringify(payload) }),
  status: (userId) => req(`/status/${encodeURIComponent(userId)}`),
};
