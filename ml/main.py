"""Pegasus ML service (:8003) — scoring around TRIBE v2 (already on Modal).

TRIBE v2 is deployed separately on Modal (app `synapse-tribe-v2-api`, class
`TribeV2`, method `predict(text)`). See tribe_client.py — we map the stimulus to
text, call TRIBE, and cache the baseline. App/class are env-overridable.

Run (from inside /ml):
    modal token new           # once, to authenticate Modal
    uvicorn main:app --port 8003 --reload
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import tribe_client
from scoring import BurnoutScorer

app = FastAPI(title="Pegasus ML")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

scorer = BurnoutScorer()


def _baseline(stimulus_id: str):
    """Cached real TRIBE v2 baseline (regions + macro-groups). None if offline."""
    return tribe_client.get_baseline(stimulus_id)


class ScoreReq(BaseModel):
    user_id: str
    stimulus_id: str
    signals: dict


@app.get("/health")
def health():
    return {"status": "ml running", "tribe_api": tribe_client.TRIBE_API}


@app.post("/score")
def score(req: ScoreReq):
    baseline = _baseline(req.stimulus_id)
    return scorer.compute_deviation(baseline, req.signals)


@app.get("/baseline/{stimulus_id}")
def baseline(stimulus_id: str):
    return _baseline(stimulus_id) or {"error": "tribe baseline unavailable", "regions": {}}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
