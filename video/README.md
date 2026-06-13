# video — facial + voice stress (Rishith, :8004)

Analyzes a 30-60s check-in clip:
- **Facial** (MediaPipe Face Mesh, 468 landmarks): stress score, eye/blink,
  brow furrow, lip compression, jaw clench, affect.
- **Voice** (Whisper + librosa): transcript, pitch mean/variability, speaking
  rate, pause frequency, tremor.

Feeds the `facial_analysis` + `voice_analysis` streams into the ML combined
scorer (`/ml` :8003).

## Endpoints
- `GET  /health`
- `POST /analyze/video` — multipart `file` (video) → `{ facial, voice }`
- `POST /analyze/frame` — multipart `file` (image) → facial indicators

## Run
```bash
cd video && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # heavy: mediapipe, whisper, librosa
brew install ffmpeg                     # whisper needs it
uvicorn main:app --reload --port 8004
```
Models (MediaPipe, Whisper) load lazily on the first analyze call — `/health`
responds immediately. First `/analyze/video` will be slow while Whisper
downloads its weights.

## Notes
- `facial_stress_score` is the highest-weighted stream in the combined scorer
  (hardest to fake). `forced_smile` / `gaze_stability` are placeholders pending
  iris tracking + AU6/AU12 mismatch detection.
- On-device iOS path (Apple Vision + CoreML) is the privacy-preferred
  alternative to this cloud service — see the project spec.
