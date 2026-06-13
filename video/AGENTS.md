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
- `voice_analyzer.py` — **NVIDIA parakeet ASR** (hosted Riva gRPC) transcript +
  librosa pitch/tremor.
- `tts.py` — **NVIDIA Chatterbox TTS** (hosted Riva gRPC) speaks interventions.
- `main.py` — FastAPI; ffmpeg extracts audio; analyzers lazy-load.

## NVIDIA hosted speech (Riva gRPC)
Both call `grpc.nvcf.nvidia.com:443` via `nvidia-riva-client`, with metadata
`function-id` + `authorization: Bearer <nvapi-key>`. Function-ids (env-overridable):
- TTS Chatterbox: `ddacc747-1269-4fab-bfd9-8f593dead106`
- ASR Parakeet en-US: `1598d209-5e27-4d3c-8079-4751568b1081`

## Secrets (.env, gitignored)
`NVIDIA_STT_KEY`, `NVIDIA_TTS_KEY` (the `nvapi-...` keys). Read via `os.getenv`.
No Anthropic anywhere — language/AI is Hugging Face (in `/ml`).

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
