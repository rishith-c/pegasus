"""User table. Identified by a client-supplied user_id; phone used for SMS alerts."""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    phone = Column(String, unique=True, nullable=True)  # red-alert SMS via signals service
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
