"""Pegasus ML service — TRIBE v2 prediction, deviation scoring, intervention.

Run (from repo root or from /ml):
    uvicorn main:app --reload --port 8003   # from inside /ml
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from intervention import generate_intervention
from scoring import compute_score
from tribe import TribePredictor

app = FastAPI(title="Pegasus ML", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

predictor = TribePredictor()


# --- request models (mirror shared/contract.md) ---------------------------
class StimulusIn(BaseModel):
    stimulus_id: str = "demo"
    type: str = "text"
    content: str = ""
    prompt: str = ""


class PredictIn(BaseModel):
    stimulus: StimulusIn


class ScoreIn(BaseModel):
    stimulus: StimulusIn
    prediction: Dict
    signal: Dict
    checkin: Dict


class InterventionIn(BaseModel):
    burnout: Dict
    recent_signals: Optional[List[Dict]] = None


@app.get("/health")
def health():
    return {"status": "ok", "model": predictor.model_name}


@app.post("/predict")
def predict(body: PredictIn):
    return predictor.predict(body.stimulus.model_dump())


@app.post("/score")
def score(body: ScoreIn):
    pred = body.prediction or predictor.predict(body.stimulus.model_dump())
    return compute_score(pred, body.signal, body.checkin)


@app.post("/intervention")
def intervention(body: InterventionIn):
    return generate_intervention(body.burnout, body.recent_signals)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
