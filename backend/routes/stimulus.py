"""POST /stimulus/send and GET /stimuli."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
from models.database import get_db
from schemas import StimulusSendRequest
from services import stimuli

router = APIRouter(tags=["stimulus"])


@router.post("/stimulus/send")
def send_stimulus(req: StimulusSendRequest, db: Session = Depends(get_db)):
    stimulus = stimuli.get_stimulus(req.stimulus_id)
    if stimulus is None:
        raise HTTPException(status_code=404, detail=f"Unknown stimulus_id '{req.stimulus_id}'")
    crud.ensure_user(db, req.user_id)
    crud.record_session(db, req.user_id, req.stimulus_id)
    return {"user_id": req.user_id, "stimulus": stimulus}


@router.get("/stimuli")
def list_stimuli():
    items = stimuli.all_stimuli()
    return {"count": len(items), "stimuli": items}
