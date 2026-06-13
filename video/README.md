# video — facial + voice stress (Rishith, :8004)

Analyzes a 30-60s check-in clip:
- **Facial** — my own stress heuristics on MediaPipe Face Mesh landmarks
  (EAR-style eye openness, inner-brow gap, lip compression, jaw width). No CV API.
- **Voice** — NVIDIA **parakeet ASR** (hosted Riva gRPC) transcript + librosa
  pitch / tremor / speaking rate.
- **TTS** — NVIDIA **Chatterbox** (hosted Riva gRPC) speaks the intervention (`tts.py`).

Returns `{ facial, voice, combined_score }`. The backend forwards the user's
clip here, then feeds the result into `/ml`'s scorer.

## Run
```bash
cd video && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # mediapipe, opencv, librosa
brew install ffmpeg                     # audio extraction
cp .env.example .env                    # NVIDIA_STT_KEY, NVIDIA_TTS_KEY
uvicorn main:app --port 8004 --reload
```
Models load lazily on first `/analyze/video`, so `/health` is instant.

## Notes
- `forced_smile` / `gaze_stability` are placeholders pending iris tracking +
  AU6/AU12 mismatch.
- Without NVIDIA keys, voice returns an empty transcript + librosa-only acoustics
  (still produces a stress signal); facial works fully offline.
