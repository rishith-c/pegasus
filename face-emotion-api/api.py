"""Pegasus Face-Emotion API — a thin HTTP service over the framework.

    uvicorn api:app --port 8010

    POST /detect        multipart 'image'                -> emotion read
    POST /detect/frames multipart 'images' (several)      -> aggregated read
    POST /fuse          json {face, voice}                -> multimodal read
    GET  /health
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from face_emotion import EmotionDetector, fuse

app = FastAPI(title="Pegasus Face-Emotion API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

detector = EmotionDetector()


@app.get("/health")
def health():
    return {"status": "ok", "model": detector.model}


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    return detector.detect(await image.read())


@app.post("/detect/frames")
async def detect_frames(images: List[UploadFile] = File(...)):
    frames = [await im.read() for im in images]
    return detector.detect_frames(frames)


class Voice(BaseModel):
    pitch_variability: float = 0.0
    voice_tremor: bool = False


class FuseReq(BaseModel):
    face: dict
    voice: Optional[Voice] = None


@app.post("/fuse")
def fuse_route(req: FuseReq):
    return fuse(req.face, req.voice.dict() if req.voice else None)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8010)
