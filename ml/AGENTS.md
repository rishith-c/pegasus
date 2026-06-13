# `/ml` (+ `/video` + frontend data layer) — Rishith's agent

You are **Rishith**. You own **`ml/`**, **`video/`**, and the **frontend data
layer** (`frontend/src/services`, `frontend/src/hooks`, `frontend/src/types`).
`ml/` is the burnout scorer on **:8003**. Read `../AGENTS.md` first.

## Never touch
Wesley's screens/components (`frontend/App.tsx`, `src/screens`, `src/components`,
`src/navigation`, `src/utils`), `/backend`, `/signals`, `/shared`. Call APIs;
ask Jason for contract changes.

## TRIBE v2 — already deployed on Modal
TRIBE runs separately on Modal as app `pegasus-tribe`, class `TribePredictor`.
**Do NOT redeploy or rewrite it.** Just call it:
```python
import modal
Tribe = modal.Cls.from_name("pegasus-tribe", "TribePredictor")
baseline = Tribe().get_baseline.remote(stimulus_id)
```
`main.py` calls it lazily and degrades to a null baseline if Modal is offline.

## Endpoints (:8003)
- `GET  /health` → `{status, tribe}`
- `POST /score` → `{user_id, stimulus_id, signals}` → `BurnoutResult`
- `GET  /baseline/{stimulus_id}` → cached TRIBE prediction

## Files
- `main.py` — FastAPI + Modal TRIBE client.
- `scoring.py` — `BurnoutScorer`, **Hugging Face only (no Anthropic)**: HF
  emotion model (`hf_sentiment`) + deviation math (`compute_deviation`) + HF
  chat-model intervention (`_intervene`, via `huggingface_hub.InferenceClient`).
  Returns `BurnoutResult` (score, level, tribe/behavioral deviation, indicators,
  intervention, brain_regions_flagged, confidence, breakdown).

## Secrets (.env, gitignored)
`HF_TOKEN` (used for BOTH sentiment + interventions). Optional `HF_MODEL`,
`HF_EMOTION_MODEL`. Modal auth via `modal token new`. Read with `os.getenv`.
Levels: green <30, yellow <65, red ≥65.

## Run
```bash
cd ml && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cp .env.example .env
modal token new        # once
uvicorn main:app --port 8003 --reload
```

## Git — branch `feat/rishith-ml`
```bash
git add ml/ video/ frontend/src/services/ frontend/src/hooks/ frontend/src/types/
git commit -m "feat: ..." && git push origin feat/rishith-ml
```
