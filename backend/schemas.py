"""Pydantic request/response models aligned with shared/contract.json (v2)."""
from typing import Optional

from pydantic import BaseModel


class ResponseSubmitRequest(BaseModel):
    user_id: str
    stimulus_id: str
    response_text: str = ""
    response_time_ms: float = 0.0
    response_latency_ms: float = 0.0
    typing_wpm: float = 0.0
    error_rate: float = 0.0  # 0-100
    source: str = "app"      # "app" | "sms"


class Breakdown(BaseModel):
    imessage: float = 0.0
    typing: float = 0.0
    facial: float = 0.0
    voice: float = 0.0
    tribe: float = 0.0


class BurnoutResult(BaseModel):
    user_id: Optional[str] = None
    stimulus_id: Optional[str] = None
    score: int
    level: str
    tribe_deviation: float = 0.0
    behavioral_deviation: float = 0.0
    top_indicators: list[str] = []
    intervention: str = ""
    brain_regions_flagged: list[str] = []
    confidence: float = 0.0
    breakdown: Breakdown = Breakdown()
    support: list[dict] = []  # human-support resources, populated on red (PRD §6)
    source: Optional[str] = None  # "app" | "sms" | "video" | "tribe" | "fallback"
    timestamp: Optional[str] = None
