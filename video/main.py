"""Pegasus Video service (:8004) — facial + voice stress from a check-in clip.

Run (from inside /video):
    uvicorn main:app --reload --port 8004

Endpoints:
    GET  /health
    POST /analyze/video   multipart 'file' (video) -> { facial, voice }
    POST /analyze/frame   multipart 'file' (image) -> facial indicators

Heavy models (MediaPipe, Whisper) load lazily on first analyze call, so the
service boots instantly and /health works before anything is downloaded.
"""
from __future__ import annotations

import os
import tempfile
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Pegasus Video", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Sample at most this many frames from a clip (keeps latency reasonable).
MAX_FRAMES = int(os.getenv("VIDEO_MAX_FRAMES", "150"))

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

        _voice = VoiceStressAnalyzer(os.getenv("WHISPER_MODEL", "base"))
    return _voice


def _read_frames(path: str):
    import cv2

    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, total // MAX_FRAMES) if total else 1
    frames, i = [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            frames.append(frame)
        i += 1
    cap.release()
    return frames, int(fps)


@app.get("/health")
def health():
    return {"status": "ok", "service": "video", "facial_loaded": _facial is not None,
            "voice_loaded": _voice is not None}


@app.post("/analyze/video")
async def analyze_video(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "clip.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        path = tmp.name
    try:
        facial_result, voice_result = {}, {}
        try:
            frames, fps = _read_frames(path)
            facial_result = _get_facial().analyze_video(frames, fps) if frames else {"error": "no frames"}
        except Exception as e:
            facial_result = {"error": f"facial analysis failed: {e}"}
        try:
            voice_result = _get_voice().analyze_audio(path)
        except Exception as e:
            voice_result = {"error": f"voice analysis failed: {e}"}
        return {"facial": facial_result, "voice": voice_result}
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


@app.post("/analyze/frame")
async def analyze_frame(file: UploadFile = File(...)):
    try:
        import cv2
        import numpy as np

        data = np.frombuffer(await file.read(), np.uint8)
        frame = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(400, "could not decode image")
        result = _get_facial().analyze_frame(frame)
        if result is None:
            return {"error": "no face detected"}
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"facial analysis unavailable: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8004)
