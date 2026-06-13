"""GET /metrics/{user_id} — trends + latest breakdown (prefix /metrics)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from models.database import get_db

router = APIRouter()


@router.get("/{user_id}")
def get_metrics(user_id: str, db: Session = Depends(get_db)):
    recs = crud.score_trend(db, user_id)  # oldest first
    return {
        "user_id": user_id,
        "score_trend": [
            {
                "date": r.timestamp.isoformat() if r.timestamp else None,
                "score": r.score,
                "level": r.level,
            }
            for r in recs
        ],
        "latest_breakdown": recs[-1].breakdown if recs else {},
        "total_checkins": len(recs),
    }
