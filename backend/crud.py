"""Thin persistence helpers over the SQLAlchemy models."""
import json

from sqlalchemy.orm import Session

from models.score_record import ScoreRecord
from models.session import Session as StimulusSession
from models.user import User


def get_user(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def ensure_user(db: Session, user_id: str, name=None, phone=None) -> User:
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, name=name, phone=phone)
        db.add(user)
        db.commit()
    return user


def record_session(db: Session, user_id: str, stimulus_id: str) -> StimulusSession:
    sess = StimulusSession(user_id=user_id, stimulus_id=stimulus_id)
    db.add(sess)
    db.commit()
    return sess


def save_score(db: Session, user_id: str, stimulus_id: str, result: dict, raw: dict) -> ScoreRecord:
    rec = ScoreRecord(
        user_id=user_id,
        stimulus_id=stimulus_id,
        score=result["score"],
        level=result["level"],
        tribe_deviation=result["tribe_deviation"],
        behavioral_deviation=result["behavioral_deviation"],
        top_indicators=json.dumps(result.get("top_indicators", [])),
        intervention=result.get("intervention", ""),
        brain_regions_flagged=json.dumps(result.get("brain_regions_flagged", [])),
        brain_regions=json.dumps(result.get("brain_regions", {})),
        confidence=result.get("confidence", 0.0),
        source=result.get("source", "fallback"),
        response_text=raw.get("response_text"),
        response_time_ms=raw.get("response_time_ms"),
        typing_wpm=raw.get("typing_wpm"),
        error_rate=raw.get("error_rate"),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def latest_score(db: Session, user_id: str) -> ScoreRecord | None:
    return (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.timestamp.desc(), ScoreRecord.id.desc())
        .first()
    )


def score_history(db: Session, user_id: str, limit: int = 100) -> list[ScoreRecord]:
    return (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.timestamp.asc(), ScoreRecord.id.asc())
        .limit(limit)
        .all()
    )
