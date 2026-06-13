# `/frontend` — Wesley's agent

You are **Wesley**. You own **`frontend/` only**. You build the React UI on
**:3000**. Read `../AGENTS.md` and `../shared/contract.md` first.

## Never touch
`/backend`, `/ml`, `/signals`, `/shared`. You talk to **the backend only**
(`:8001`), through the Vite `/api` proxy (already configured).

## What the UI does
1. Get/create a user, fetch `GET /api/stimulus/today`.
2. Show the stimulus; capture the response with `KeystrokeTracker`
   (`src/keystroke.js`, synced from `/signals/collector.js`).
3. `POST /api/checkin` with text + typing metrics.
4. Render the Check Engine Light (🟢/🟡/🔴) + intervention (`EngineLight.jsx`).

## Files
- `src/App.jsx` — flow + state.
- `src/api.js` — backend client (all calls via `/api`).
- `src/EngineLight.jsx` — result card.
- `src/keystroke.js` — typing tracker (keep in sync with Dhruva's `collector.js`).
- `vite.config.js` — `/api` → `:8001` proxy.

## Run
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Git
```bash
git checkout feat/wesley-ui
git add frontend/    # ONLY frontend/
git commit -m "feat(frontend): ..." && git push origin feat/wesley-ui
```
