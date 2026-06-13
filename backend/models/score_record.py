"""Score history table ("scores"). One row per scored response (app or sms)."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String

import safety
from models.database import Base


class ScoreRecord(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True)
    stimulus_id = Column(String, nullable=True)

    score = Column(Integer)
    level = Column(String)
    breakdown = Column(JSON, default=dict)          # {imessage, typing, facial, voice, tribe}
    indicators = Column(JSON, default=list)         # top_indicators: list[str]
    intervention = Column(String)
    tribe_deviation = Column(Float, default=0.0)
    behavioral_deviation = Column(Float, default=0.0)
    brain_regions_flagged = Column(JSON, default=list)
    confidence = Column(Float, default=0.0)
    source = Column(String, default="app")          # "app" | "sms"

    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_result(self) -> dict:
        """Render as a contract `burnout_result` (with helpful extra fields)."""
        return {
            "user_id": self.user_id,
            "stimulus_id": self.stimulus_id,
            "score": self.score,
            "level": self.level,
            "tribe_deviation": self.tribe_deviation,
            "behavioral_deviation": self.behavioral_deviation,
            "top_indicators": self.indicators or [],
            "intervention": self.intervention,
            "brain_regions_flagged": self.brain_regions_flagged or [],
            "confidence": self.confidence,
            "breakdown": self.breakdown or {},
            "support": safety.support_for(self.level),
            "source": self.source,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
