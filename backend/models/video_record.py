"""Video check-in records ("videos"). Facial + voice stress from the video service."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Integer, String

from models.database import Base


class VideoRecord(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True)
    facial_score = Column(Integer, default=0)
    combined_score = Column(Integer, default=0)
    facial_data = Column(JSON, default=dict)
    voice_data = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "facial_score": self.facial_score,
            "combined_score": self.combined_score,
            "facial": self.facial_data or {},
            "voice": self.voice_data or {},
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
