"""GET /brain/{user_id} — latest brain region activations for a user."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
from models.database import get_db

router = APIRouter(tags=["brain"])


@router.get("/brain/{user_id}")
def get_brain(user_id: str, db: Session = Depends(get_db)):
    rec = crud.latest_score(db, user_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No brain data yet for user '{user_id}'")
    return rec.brain_payload()
