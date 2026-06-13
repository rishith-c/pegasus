"""Pegasus Backend — orchestrator + persistence. Frontend talks ONLY to this.

Run (from inside /backend):
    uvicorn main:app --reload --port 8001
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import orchestrator
import stimuli

app = FastAPI(title="Pegasus Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init_db()


class UserIn(BaseModel):
    name: str
    phone: Optional[str] = None


class CheckInIn(BaseModel):
    user_id: str
    stimulus_id: str
    text_response: str
    response_time_ms: int = 0
    typing_wpm: int = 0
    error_rate: float = 0.0


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/users")
def create_user(body: UserIn):
    return db.create_user(body.name, body.phone)


@app.get("/users/{user_id}")
def get_user(user_id: str):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return user


@app.get("/stimulus/today")
def stimulus_today(user_id: str = "demo"):
    return stimuli.stimulus_for(user_id)


@app.post("/checkin")
def checkin(body: CheckInIn):
    user = db.get_user(body.user_id)
    phone = user.get("phone") if user else None
    stimulus = stimuli.stimulus_for(body.user_id)
    result = orchestrator.run_checkin(body.model_dump(), stimulus, phone)
    db.save_checkin(body.user_id, body.stimulus_id,
                    {"score": result["score"], "level": result["level"], "deviation": result["deviation"]},
                    result["signal"], result["intervention"])
    return result


@app.get("/status/{user_id}")
def status(user_id: str):
    history = db.get_history(user_id)
    return {"latest": history[0] if history else None, "history": history}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
