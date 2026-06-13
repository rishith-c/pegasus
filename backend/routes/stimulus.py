"""Stimulus selection + delivery (prefix /stimulus)."""
from fastapi import APIRouter, HTTPException

from services import stimuli

router = APIRouter()


@router.get("/today/{user_id}")
def get_today_stimulus(user_id: str):
    """Return today's stimulus for a user (stable daily rotation)."""
    return stimuli.stimulus_for_today(user_id)


@router.get("/all")
def get_all_stimuli():
    items = stimuli.all_stimuli()
    return {"count": len(items), "stimuli": items}


@router.get("/{stimulus_id}")
def get_stimulus(stimulus_id: str):
    s = stimuli.get_stimulus(stimulus_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"Unknown stimulus_id '{stimulus_id}'")
    return s
