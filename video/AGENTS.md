# `/video` — Rishith's agent (second folder)

You are **Rishith**. You also own **`video/`** — facial + voice stress analysis
on **:8004**. Read `../AGENTS.md`, `../ml/AGENTS.md`, and `../shared/contract.md`.

## Never touch
`/frontend`, `/backend`, `/signals`, `/shared`. The frontend posts clips to you;
the backend forwards your output to `/ml`'s `/score`.

## Your endpoints (:8004)
- `GET  /health`
- `POST /analyze/video` — multipart `file` (video) → `{ facial, voice }`
- `POST /analyze/frame` — multipart `file` (image) → facial indicators

## Files
- `facial_analyzer.py` — MediaPipe Face Mesh → stress score, eye/brow/lip/jaw.
- `voice_analyzer.py` — Whisper transcribe + librosa pitch/pauses/tremor.
- `main.py` — FastAPI; lazy-loads heavy models so `/health` is instant.
- `models/` — local model artifacts (gitignored when large).

## Constraints
- Heavy installs (mediapipe, whisper, librosa, opencv); whisper needs `ffmpeg`.
- `facial_stress_score` is the highest-weighted stream in the ML scorer.
- `forced_smile` / `gaze_stability` are placeholders — improve with iris
  tracking + AU6/AU12 mismatch if time allows.

## Run
```bash
cd video && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && brew install ffmpeg
uvicorn main:app --reload --port 8004
```

## Git — same branch as ml
```bash
git add video/      # with ml/, on feat/rishith-ml
```
