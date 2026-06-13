"""POST /video/submit — video check-in (prefix /video).

Forwards the upload to Rishith's video service (8004), stores facial + voice
stress, and returns the analysis. Degrades gracefully if the service is offline.
"""
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

import crud
from models.database import get_db
from services import video_client

router = APIRouter()
log = logging.getLogger("pegasus.backend")


@router.post("/submit")
async def submit_video(
    video: UploadFile = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db),
):
    crud.ensure_user(db, user_id)
    content = await video.read()

    video_ok = True
    try:
        result = await video_client.analyze(content, video.filename or "checkin.mp4")
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("video service unavailable: %s", exc)
        result = {"facial": {}, "voice": {}, "error": f"video service unavailable: {exc}"}
        video_ok = False

    facial = result.get("facial", {}) or {}
    voice = result.get("voice", {}) or {}
    facial_score = int(facial.get("facial_stress_score", 0) or 0)
    crud.save_video(db, user_id, facial_score, facial, voice)

    result["video_service"] = video_ok
    return result
