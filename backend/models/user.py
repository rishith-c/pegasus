"""User table. A user is identified by a client-supplied user_id."""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)  # used for red-alert SMS via signals service
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
