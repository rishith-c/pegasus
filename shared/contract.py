"""Pegasus shared contract — canonical request/response models.

Owner: Jason (`/shared`). This is the source of truth. Services may mirror
these models locally (FastAPI idiom) but must stay shape-compatible.

Usage from a service (run uvicorn from the repo root):
    from shared.contract import CheckIn, BurnoutScore
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Level = Literal["green", "yellow", "red"]
StimulusType = Literal["image", "audio", "text"]
EnergyLevel = Literal["low", "medium", "high"]


class Stimulus(BaseModel):
    stimulus_id: str
    type: StimulusType
    content: str  # url for image/audio, raw text for text
    prompt: str


class CheckIn(BaseModel):
    user_id: str
    stimulus_id: str
    text_response: str
    response_time_ms: int = 0
    typing_wpm: int = 0
    error_rate: float = 0.0  # % backspaces, 0-100


class BehavioralSignal(BaseModel):
    sentiment_score: float = Field(ge=0.0, le=1.0)
    energy_level: EnergyLevel
    flags: List[str] = []
    combined_signal_score: float = Field(ge=0.0, le=1.0)


class BrainPrediction(BaseModel):
    predicted_engagement: float = Field(ge=0.0, le=1.0)
    predicted_valence: float = Field(ge=0.0, le=1.0)
    activation_summary: List[float] = []


class ScoreComponents(BaseModel):
    engagement_gap: float = 0.0
    valence_gap: float = 0.0
    signal_gap: float = 0.0


class BurnoutScore(BaseModel):
    score: int = Field(ge=0, le=100)
    level: Level
    deviation: float = 0.0
    components: ScoreComponents = ScoreComponents()


class Intervention(BaseModel):
    message: str
    suggested_action: str


class User(BaseModel):
    user_id: str
    name: str
    phone: Optional[str] = None


def level_for_score(score: int) -> Level:
    """Engine-light thresholds. See contract.md."""
    if score >= 70:
        return "red"
    if score >= 40:
        return "yellow"
    return "green"
