"""GET /score/{user_id} — latest burnout_result (prefix /score)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from models.database import get_db

router = APIRouter()


@router.get("/{user_id}")
def get_latest_score(user_id: str, db: Session = Depends(get_db)):
    rec = crud.latest_score(db, user_id)
    if rec is None:
        # Same shape as a real burnout_result so the frontend never hits a missing key.
        return {
            "user_id": user_id,
            "stimulus_id": None,
            "score": 0,
            "level": "green",
            "tribe_deviation": 0.0,
            "behavioral_deviation": 0.0,
            "top_indicators": [],
            "intervention": "Take your first pulse check!",
            "brain_regions_flagged": [],
            "confidence": 0.0,
            "breakdown": {},
            "support": [],
            "source": "none",
            "timestamp": None,
        }
    return rec.to_result()
