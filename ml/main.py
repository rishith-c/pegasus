"""Pegasus ML service (:8003) — TRIBE v2 prediction + combined burnout scoring.

Run (from inside /ml):
    uvicorn main:app --reload --port 8003

Endpoints:
    GET  /health
    POST /predict          TRIBE v2 healthy-brain prediction for a stimulus
    GET  /baseline/{sid}   cached prediction for a stimulus_id
    POST /score            merge all signal streams -> burnout_result
"""
from __future__ import annotations

from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from combined_scorer import compute_final_score
from scoring import compute_tribe_deviation
from tribe_inference import TribeModel

app = FastAPI(title="Pegasus ML", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = TribeModel()


class StimulusIn(BaseModel):
    stimulus_id: str = "demo"
    type: str = "text"
    content: str = ""
    prompt: str = ""


class PredictIn(BaseModel):
    stimulus: StimulusIn


class ScoreIn(BaseModel):
    """All signal streams. Any may be omitted — the scorer renormalizes over
    whatever is present (e.g. a text-only check-in has no facial/voice)."""
    user_id: str = "demo"
    stimulus: Optional[StimulusIn] = None
    imessage_signals: Optional[Dict] = None
    typing_biometrics: Optional[Dict] = None
    facial_analysis: Optional[Dict] = None
    voice_analysis: Optional[Dict] = None


@app.get("/health")
def health():
    return {"status": "ok", "model": model.model_name}


@app.post("/predict")
def predict(body: PredictIn):
    return model.predict(body.stimulus.model_dump())


@app.get("/baseline/{stimulus_id}")
def baseline(stimulus_id: str):
    b = model.baseline(stimulus_id)
    if not b:
        raise HTTPException(404, "no cached baseline for that stimulus_id")
    return b


@app.post("/score")
def score(body: ScoreIn):
    tribe_dev = None
    if body.stimulus is not None:
        b = model.predict(body.stimulus.model_dump())
        tribe_dev = compute_tribe_deviation(b, body.imessage_signals)
    result = compute_final_score(
        imessage=body.imessage_signals,
        typing=body.typing_biometrics,
        facial=body.facial_analysis,
        voice=body.voice_analysis,
        tribe_deviation=tribe_dev,
    )
    result["user_id"] = body.user_id
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
