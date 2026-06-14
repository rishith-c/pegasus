"""Pegasus ML service (:8003) — scoring around TRIBE v2 (already on Modal).

TRIBE v2 is deployed separately on Modal (app `synapse-tribe-v2-api`, class
`TribeV2`, method `predict(text)`). See tribe_client.py — we map the stimulus to
text, call TRIBE, and cache the baseline. App/class are env-overridable.

Run (from inside /ml):
    modal token new           # once, to authenticate Modal
    uvicorn main:app --port 8003 --reload
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import tribe_client
from chat import ChatEngine
from scoring import BurnoutScorer

app = FastAPI(title="Pegasus ML")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

scorer = BurnoutScorer()
chat_engine = ChatEngine()

# Live wellness store — the app reads /wellness for the latest DERIVED reading.
# Every real turn (a texted reply or a voice-call turn) calls /score, which
# updates this, so the number actually moves instead of sitting on one value.
_latest: dict = {}
# Per-user history of readings (past check-ins + talks) for the History tab.
_history: dict = {}
_HISTORY_MAX = 60


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _baseline(stimulus_id: str):
    """Cached real TRIBE v2 baseline (regions + macro-groups). None if offline."""
    return tribe_client.get_baseline(stimulus_id)


class ScoreReq(BaseModel):
    user_id: str
    stimulus_id: str
    signals: dict


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    user_id: str
    messages: List[ChatMessage]
    score: Optional[int] = None
    level: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ml running", "tribe_api": tribe_client.TRIBE_API}


@app.post("/score")
def score(req: ScoreReq):
    baseline = _baseline(req.stimulus_id)
    result = scorer.compute_deviation(baseline, req.signals)
    result["timestamp"] = _now()
    result["user_id"] = req.user_id
    _latest[req.user_id] = result  # feed the live wellness reading

    kind = "talk" if req.stimulus_id == "conversation" else "check-in"
    entry = {
        "score": result["score"],
        "level": result["level"],
        "timestamp": result["timestamp"],
        "text": (req.signals.get("response_text") or "").strip()[:160],
        "intervention": result.get("intervention", ""),
        "kind": kind,
    }
    _history.setdefault(req.user_id, []).append(entry)
    _history[req.user_id] = _history[req.user_id][-_HISTORY_MAX:]
    return result


@app.get("/history/{user_id}")
def history(user_id: str):
    """Past check-ins + talks (most recent first) for the History tab."""
    return list(reversed(_history.get(user_id, [])))


@app.get("/wellness/{user_id}")
def wellness(user_id: str):
    """Latest DERIVED wellness reading (higher = better). Updates every time the
    user talks or texts; neutral starting state until their first turn."""
    r = _latest.get(user_id)
    if r:
        return r
    return {
        "user_id": user_id,
        "score": 72,
        "level": "green",
        "intervention": "Talk to Pegasus or reply to a text to get your first reading.",
        "top_indicators": ["No reading yet — start a conversation"],
        "tribe_deviation": 0,
        "behavioral_deviation": 0,
        "brain_regions_flagged": [],
        "confidence": 0.5,
        "breakdown": {},
        "timestamp": _now(),
        "source": "starting",
    }


@app.post("/chat")
def chat(req: ChatReq):
    """Multi-turn companion chat, grounded in the user's burnout reading + RAG."""
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    return {"reply": chat_engine.reply(msgs, req.score, req.level)}


@app.get("/baseline/{stimulus_id}")
def baseline(stimulus_id: str):
    return _baseline(stimulus_id) or {"error": "tribe baseline unavailable", "regions": {}}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
