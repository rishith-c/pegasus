"""Pegasus Video service (:8004) — facial + voice stress from a check-in clip.

Run (from inside /video):
    uvicorn main:app --port 8004 --reload

Endpoints:
    GET  /health
    POST /analyze/video   multipart 'video' -> { facial, voice, combined_score }

Heavy analyzers (MediaPipe / librosa) load lazily on the first call, so the
service boots instantly and /health works before models are ready.
Requires ffmpeg on the system (audio extraction):  brew install ffmpeg
"""
from __future__ import annotations

import os
import tempfile

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Pegasus Video")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_facial = None
_voice = None


def _get_facial():
    global _facial
    if _facial is None:
        from facial_analyzer import FacialStressAnalyzer

        _facial = FacialStressAnalyzer()
    return _facial


def _get_voice():
    global _voice
    if _voice is None:
        from voice_analyzer import VoiceStressAnalyzer

        _voice = VoiceStressAnalyzer()
    return _voice


@app.get("/health")
def health():
    return {"status": "video running"}


@app.post("/analyze/video")
async def analyze_video(video: UploadFile = File(...)):
    import cv2

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(await video.read())
        path = tmp.name
    audio = path.replace(".mp4", ".wav")
    try:
        # Sample every 10th frame (~3fps from 30fps source).
        cap = cv2.VideoCapture(path)
        frames, i = [], 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if i % 10 == 0:
                frames.append(frame)
            i += 1
        cap.release()

        try:
            facial_result = _get_facial().analyze_video(frames) if frames else {"error": "no frames", "facial_stress_score": 0}
        except Exception as e:
            facial_result = {"error": f"facial failed: {e}", "facial_stress_score": 0}

        try:
            os.system(f"ffmpeg -i {path} -vn -ar 16000 {audio} -y -loglevel quiet")
            voice_result = _get_voice().analyze_audio(audio)
        except Exception as e:
            voice_result = {"error": f"voice failed: {e}", "pitch_mean_hz": 0, "voice_tremor": False, "pause_frequency": 0}

        fs = facial_result.get("facial_stress_score", 0)
        vs = (
            min(voice_result.get("pitch_mean_hz", 150) / 300, 1) * 40
            + (20 if voice_result.get("voice_tremor") else 0)
            + min(voice_result.get("pause_frequency", 0) / 10, 1) * 40
        )
        return {"facial": facial_result, "voice": voice_result, "combined_score": int(fs * 0.6 + vs * 0.4)}
    finally:
        for p in (path, audio):
            try:
                os.unlink(p)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8004)
