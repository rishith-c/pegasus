"""GET /history/{user_id} — recent burnout_results, newest first (prefix /history)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from models.database import get_db

router = APIRouter()


@router.get("/{user_id}")
def get_history(user_id: str, db: Session = Depends(get_db)):
    recs = crud.score_history(db, user_id)
    return [r.to_result() for r in recs]
