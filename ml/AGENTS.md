# `/ml` (+ `/video`) — Rishith's agent

You are **Rishith**. You own **`ml/` and `video/`**. `ml/` is the brain pipeline
+ combined scorer on **:8003**; `video/` is facial/voice analysis on **:8004**
(see `../video/AGENTS.md`). Read `../AGENTS.md` and `../shared/contract.md` first.

## Never touch
`/frontend`, `/backend`, `/signals`, `/shared`. Need data? Call their API. Need a
contract change? Tell Jason (see below — the score contract has changed).

## Your endpoints (:8003)
- `GET  /health` → `{status, model}`
- `POST /predict` → TRIBE v2 healthy-brain prediction (+ per-region activations)
- `GET  /baseline/{stimulus_id}` → cached prediction for the Brain View
- `POST /score` → **merges all signal streams** → burnout result

## Files
- `tribe_inference.py` — TRIBE v2 wrapper (`TribeModel`). **Currently a seeded
  STUB** — your headline task is real TRIBE v2 inference in `_infer`. Predictions
  are cached in `cache/baselines.json`.
- `scoring.py` — `compute_tribe_deviation` (behavior vs healthy baseline → 0-1).
- `combined_scorer.py` — the 4-stream + tribe weighted engine; renormalizes over
  whichever streams are present (text-only check-ins still score).
- `claude_interpreter.py` — Claude (`claude-sonnet-4-6`) intervention + fallback.
- `stimuli/manifest.json` — stimulus pool.
- `main.py` — FastAPI wiring.

## ⚠️ Contract changes to tell Jason (`shared/contract.md`)
1. `POST /score` now takes the full bundle:
   `{ user_id, stimulus, imessage_signals, typing_biometrics, facial_analysis, voice_analysis }`
   and returns `{ score, level, breakdown{imessage,typing,facial,voice,tribe},
   streams_used, top_indicators, intervention, user_id }`.
2. Engine-light thresholds changed to spec: **green <30, yellow <65, red ≥65**
   (was 40/70). Backend + contract should match.
3. Standalone `/intervention` endpoint is **gone** — intervention is part of
   `/score`. New `GET /baseline/{stimulus_id}` added for the Brain View.

## Run
```bash
cd ml && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY optional (stub + fallback work without)
uvicorn main:app --reload --port 8003
```

## Git
```bash
git checkout feat/rishith-ml
git add ml/ video/     # ONLY your two folders
git commit -m "feat(ml): ..." && git push origin feat/rishith-ml
```
