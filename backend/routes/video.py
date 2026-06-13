"""POST /video/submit — video check-in (prefix /video).

Forwards the upload to Rishith's video service (8004), stores facial + voice
stress, then FUSES facial/voice into a burnout score (PRD §4.5, facial weighted
highest) so a video check-in actually moves the check engine light. Degrades
gracefully if the video or ML service is offline.

Raw video bytes are never persisted — only the derived analysis (PRD §8).
"""
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

import crud
import safety
from models.database import get_db
from services import ml_client, scoring, video_client

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
        analysis = await video_client.analyze(content, video.filename or "checkin.mp4")
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("video service unavailable: %s", exc)
        analysis = {"facial": {}, "voice": {}, "error": f"video service unavailable: {exc}"}
        video_ok = False

    facial = analysis.get("facial", {}) or {}
    voice = analysis.get("voice", {}) or {}
    facial_score = int(facial.get("facial_stress_score", 0) or 0)
    voice_score = int(voice.get("voice_stress_score", voice.get("stress_score", 0)) or 0)
    combined_score = int(analysis.get("combined_score", 0) or 0)
    crud.save_video(db, user_id, facial_score, combined_score, facial, voice)

    # Fuse facial/voice into a burnout score (use ML if available, else local fusion).
    video_sig = {"facial_score": facial_score, "voice_score": voice_score, "combined_score": combined_score}
    prior = crud.latest_score(db, user_id)
    prior_result = prior.to_result() if prior else None
    try:
        ml_result = await ml_client.score(user_id, "video_checkin", {**video_sig, "channel": "video"})
        burnout = scoring.normalize_ml_result(ml_result, None, {}, {}, video_sig)
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("ML unavailable for video fusion, using local fusion: %s", exc)
        burnout = scoring.video_fallback_score(video_sig, prior_result)

    burnout = safety.ensure_human_support(burnout)  # PRD §6
    rec = crud.save_score(db, user_id, "video_checkin", burnout, "video")

    out = {
        "facial": facial,
        "voice": voice,
        "combined_score": combined_score,
        "video_service": video_ok,
        "burnout_result": rec.to_result(),
    }
    if "error" in analysis:
        out["error"] = analysis["error"]
    return out
