"""GET /score/{user_id} — latest burnout_result for a user."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
from models.database import get_db

router = APIRouter(tags=["score"])


@router.get("/score/{user_id}")
def get_score(user_id: str, db: Session = Depends(get_db)):
    rec = crud.latest_score(db, user_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No score yet for user '{user_id}'")
    return rec.to_result()
