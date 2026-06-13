"""GET /history/{user_id} — past burnout_results in chronological order."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from models.database import get_db

router = APIRouter(tags=["history"])


@router.get("/history/{user_id}")
def get_history(user_id: str, db: Session = Depends(get_db)):
    recs = crud.score_history(db, user_id)
    return {"user_id": user_id, "count": len(recs), "history": [r.to_result() for r in recs]}
