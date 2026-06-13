# `/video` — Rishith's agent (second folder)

You are **Rishith**. You own **`video/`** — facial + voice stress on **:8004**.
Read `../AGENTS.md`, `../ml/AGENTS.md`, and the contract first.

## Never touch
`/frontend` screens (Wesley), `/backend`, `/signals`, `/shared`. The backend
forwards clips here; you return facial + voice + combined_score.

## Endpoints (:8004)
- `GET  /health`
- `POST /analyze/video` — multipart `video` → `{ facial, voice, combined_score }`

## Files
- `facial_analyzer.py` — **my own** stress logic on MediaPipe Face Mesh
  landmarks (EAR-style eye openness, brow gap, lip compression, jaw). No CV API.
- `voice_analyzer.py` — **NVIDIA STT** transcript + librosa pitch/tremor.
- `tts.py` — **NVIDIA TTS** to speak interventions (bonus).
- `main.py` — FastAPI; ffmpeg extracts audio; analyzers lazy-load.

## Secrets (.env, gitignored)
`NVIDIA_STT_KEY`, `NVIDIA_TTS_KEY`. Read via `os.getenv`. Confirm the exact NIM
endpoints at build.nvidia.com (URLs in code are overridable via env).

## Run
```bash
cd video && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && brew install ffmpeg
cp .env.example .env
uvicorn main:app --port 8004 --reload
```

## Git — same branch as ml: `feat/rishith-ml`
```bash
git add ml/ video/ frontend/src/services/ frontend/src/hooks/ frontend/src/types/
```
