"""Pegasus ML service (:8003) — scoring around TRIBE v2 (already on Modal).

TRIBE v2 is deployed separately on Modal as app `pegasus-tribe`, class
`TribePredictor`. We just call it; we do NOT redeploy or rewrite it.

Run (from inside /ml):
    modal token new           # once, to authenticate Modal
    uvicorn main:app --port 8003 --reload
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from scoring import BurnoutScorer

app = FastAPI(title="Pegasus ML")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

scorer = BurnoutScorer()


def _tribe():
    """Lazy handle to the deployed TRIBE class. Returns None if Modal isn't
    available (keeps the service runnable offline — scorer handles None baseline)."""
    try:
        import modal

        return modal.Cls.from_name("pegasus-tribe", "TribePredictor")
    except Exception:
        return None


def _baseline(stimulus_id: str):
    Tribe = _tribe()
    if Tribe is None:
        return None
    try:
        return Tribe().get_baseline.remote(stimulus_id)
    except Exception:
        return None


class ScoreReq(BaseModel):
    user_id: str
    stimulus_id: str
    signals: dict


@app.get("/health")
def health():
    return {"status": "ml running", "tribe": "connected" if _tribe() is not None else "offline"}


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
