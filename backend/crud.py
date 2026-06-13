"""Thin persistence helpers over the SQLAlchemy models."""
from sqlalchemy.orm import Session

from models.score_record import ScoreRecord
from models.session import Session as PulseSession
from models.user import User
from models.video_record import VideoRecord


def get_user(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def ensure_user(db: Session, user_id: str, name=None, phone=None) -> User:
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, name=name, phone=phone)
        db.add(user)
        db.commit()
    return user


def record_session(db: Session, user_id: str, stimulus_id: str) -> PulseSession:
    sess = PulseSession(user_id=user_id, stimulus_id=stimulus_id)
    db.add(sess)
    db.commit()
    return sess


def save_score(db: Session, user_id: str, stimulus_id: str, result: dict, source: str) -> ScoreRecord:
    rec = ScoreRecord(
        user_id=user_id,
        stimulus_id=stimulus_id,
        score=result["score"],
        level=result["level"],
        breakdown=result.get("breakdown", {}),
        indicators=result.get("top_indicators", []),
        intervention=result.get("intervention", ""),
        tribe_deviation=result.get("tribe_deviation", 0.0),
        behavioral_deviation=result.get("behavioral_deviation", 0.0),
        brain_regions_flagged=result.get("brain_regions_flagged", []),
        confidence=result.get("confidence", 0.0),
        source=source,
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


def score_history(db: Session, user_id: str, limit: int = 30) -> list[ScoreRecord]:
    """Most recent first, up to `limit`."""
    return (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.timestamp.desc(), ScoreRecord.id.desc())
        .limit(limit)
        .all()
    )


def score_trend(db: Session, user_id: str) -> list[ScoreRecord]:
    """Oldest first, for charting."""
    return (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.timestamp.asc(), ScoreRecord.id.asc())
        .all()
    )


def latest_video(db: Session, user_id: str) -> VideoRecord | None:
    return (
        db.query(VideoRecord)
        .filter(VideoRecord.user_id == user_id)
        .order_by(VideoRecord.timestamp.desc(), VideoRecord.id.desc())
        .first()
    )


def video_signals_for(db: Session, user_id: str) -> dict | None:
    """Normalized latest facial/voice signals for fusion, or None if no video yet."""
    rec = latest_video(db, user_id)
    if rec is None:
        return None
    voice = rec.voice_data or {}
    return {
        "facial_score": rec.facial_score or 0,
        "voice_score": voice.get("voice_stress_score", voice.get("stress_score", 0)) or 0,
        "combined_score": rec.combined_score or 0,
    }


def save_video(
    db: Session,
    user_id: str,
    facial_score: int,
    combined_score: int,
    facial_data: dict,
    voice_data: dict,
) -> VideoRecord:
    rec = VideoRecord(
        user_id=user_id,
        facial_score=facial_score,
        combined_score=combined_score,
        facial_data=facial_data,
        voice_data=voice_data,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec
