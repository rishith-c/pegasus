"""Score history table. One row per scored response (a burnout_result snapshot)."""
import json
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from models.database import Base


class ScoreRecord(Base):
    __tablename__ = "score_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True)
    stimulus_id = Column(String, nullable=True)

    score = Column(Integer)
    level = Column(String)
    tribe_deviation = Column(Float)
    behavioral_deviation = Column(Float)
    top_indicators = Column(Text)          # JSON-encoded list[str]
    intervention = Column(Text)
    brain_regions_flagged = Column(Text)   # JSON-encoded list[str]
    brain_regions = Column(Text)           # JSON-encoded dict[str, float]
    confidence = Column(Float)
    source = Column(String)                # "tribe" | "fallback"

    # Raw behavioral signals kept for history / debugging.
    response_text = Column(Text, nullable=True)
    response_time_ms = Column(Float, nullable=True)
    typing_wpm = Column(Float, nullable=True)
    error_rate = Column(Float, nullable=True)

    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_result(self) -> dict:
        """Render as a contract `burnout_result`."""
        return {
            "user_id": self.user_id,
            "stimulus_id": self.stimulus_id,
            "score": self.score,
            "level": self.level,
            "tribe_deviation": self.tribe_deviation,
            "behavioral_deviation": self.behavioral_deviation,
            "top_indicators": json.loads(self.top_indicators or "[]"),
            "intervention": self.intervention,
            "brain_regions_flagged": json.loads(self.brain_regions_flagged or "[]"),
            "confidence": self.confidence,
            "source": self.source,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

    def brain_payload(self) -> dict:
        """Render the richer brain view for GET /brain/{user_id}."""
        return {
            "user_id": self.user_id,
            "stimulus_id": self.stimulus_id,
            "level": self.level,
            "score": self.score,
            "brain_regions_flagged": json.loads(self.brain_regions_flagged or "[]"),
            "brain_regions": json.loads(self.brain_regions or "{}"),
            "source": self.source,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
