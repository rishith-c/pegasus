"""Pegasus Signals service — behavioral analysis + SMS alerts.

Run (from inside /signals):
    uvicorn main:app --reload --port 8002
"""
from __future__ import annotations

from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import alerts
import sentiment

app = FastAPI(title="Pegasus Signals", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# In-memory: latest signal per user (fine for a hackathon demo).
_LATEST: Dict[str, Dict] = {}


class AnalyzeIn(BaseModel):
    user_id: str
    text: str = ""
    typing_wpm: int = 0
    error_rate: float = 0.0
    response_time_ms: int = 0


class AlertIn(BaseModel):
    user_id: str
    phone: str
    score: int
    level: str
    intervention: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/signals/analyze")
def analyze(body: AnalyzeIn):
    result = sentiment.analyze(
        body.text, body.typing_wpm, body.error_rate, body.response_time_ms
    )
    _LATEST[body.user_id] = result
    return result


@app.get("/signals/{user_id}")
def latest(user_id: str):
    if user_id not in _LATEST:
        raise HTTPException(404, "no signals for user")
    return _LATEST[user_id]


@app.post("/alert")
def alert(body: AlertIn):
    if body.level != "red":
        return {"sent": False, "message_sid": None, "reason": "level_not_red"}
    return alerts.send_alert(body.phone, body.score, body.level, body.intervention)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
