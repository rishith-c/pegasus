"""GET /brain/{user_id} — TRIBE brain data for the user's latest stimulus (prefix /brain)."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from models.database import get_db
from services import ml_client, scoring

router = APIRouter()
log = logging.getLogger("pegasus.backend")


@router.get("/{user_id}")
async def get_brain(user_id: str, db: Session = Depends(get_db)):
    rec = crud.latest_score(db, user_id)
    if rec is None:
        return {"user_id": user_id, "regions": {}, "brain_regions_flagged": [], "source": "none"}

    # Prefer the ML service's real TRIBE baseline; fall back to a synthesized map.
    try:
        baseline = await ml_client.get_baseline(rec.stimulus_id)
        baseline["user_id"] = user_id
        baseline["stimulus_id"] = rec.stimulus_id
        baseline.setdefault("source", "tribe")
        return baseline
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("ML baseline unavailable, synthesizing brain map: %s", exc)
        flagged, regions = scoring.synth_brain(rec.level, rec.score)
        return {
            "user_id": user_id,
            "stimulus_id": rec.stimulus_id,
            "level": rec.level,
            "score": rec.score,
            "regions": regions,
            "brain_regions_flagged": rec.brain_regions_flagged or flagged,
            "source": "fallback",
        }
