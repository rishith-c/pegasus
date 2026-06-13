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
        return {
            "user_id": user_id,
            "score": 0,
            "level": "green",
            "intervention": "Take your first pulse check!",
            "breakdown": {},
            "top_indicators": [],
            "source": "none",
        }
    return rec.to_result()
