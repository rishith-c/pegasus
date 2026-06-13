# `/signals` — Dhruva's agent

You are **Dhruva**. You own **`signals/` only**. You build behavioral signal
analysis + SMS alerts on **:8002**. Read `../AGENTS.md` and
`../shared/contract.md` first.

## Never touch
`/frontend`, `/backend`, `/ml`, `/shared`. Ask Jason for contract changes.

## Your endpoints (:8002)
- `GET  /health`
- `POST /signals/analyze` → sentiment + energy + flags + `combined_signal_score`
- `GET  /signals/{user_id}` → latest signal
- `POST /alert` → Twilio SMS if `level == "red"`

## Files
- `sentiment.py` — Claude (`claude-sonnet-4-6`) sentiment + typing dynamics;
  lexical fallback when no API key.
- `alerts.py` — Twilio SMS; no-ops (console log) without creds.
- `collector.js` — `KeystrokeTracker`. **Wesley imports this** for the frontend
  (a synced copy lives at `frontend/src/keystroke.js`). Keep them in sync.
- `main.py` — FastAPI wiring.

## Run
```bash
cd signals && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY + TWILIO_* (all optional for demo)
uvicorn main:app --reload --port 8002
```

## Git
```bash
git checkout feat/dhruva-sig
git add signals/     # ONLY signals/
git commit -m "feat(signals): ..." && git push origin feat/dhruva-sig
```
