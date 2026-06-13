"""Pydantic request/response models aligned with shared/contract.json."""
from typing import Optional

from pydantic import BaseModel


class StimulusSendRequest(BaseModel):
    user_id: str
    stimulus_id: str


class ResponseSubmitRequest(BaseModel):
    user_id: str
    stimulus_id: str
    response_text: str
    response_time_ms: float = 0.0
    typing_wpm: float = 0.0
    error_rate: float = 0.0  # 0-100, percent of keystrokes that were backspaces


class BurnoutResult(BaseModel):
    user_id: str
    stimulus_id: Optional[str] = None
    score: int
    level: str
    tribe_deviation: float
    behavioral_deviation: float
    top_indicators: list[str]
    intervention: str
    brain_regions_flagged: list[str]
    confidence: float
    source: str
    timestamp: Optional[str] = None
