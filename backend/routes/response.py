"""POST /response/submit — the orchestrator endpoint.

Flow: signals (8002) -> ML score (8003) -> persist -> red-alert (best effort).
Each downstream call degrades gracefully so the backend works standalone.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from models.database import get_db
from schemas import ResponseSubmitRequest
from services import scoring, signal_client, stimuli, tribe_client

router = APIRouter(tags=["response"])
log = logging.getLogger("pegasus.backend")


@router.post("/response/submit")
async def submit_response(req: ResponseSubmitRequest, db: Session = Depends(get_db)):
    crud.ensure_user(db, req.user_id)
    stimulus = stimuli.get_stimulus(req.stimulus_id)
    raw = {
        "response_text": req.response_text,
        "response_time_ms": req.response_time_ms,
        "typing_wpm": req.typing_wpm,
        "error_rate": req.error_rate,
    }

    # 1) Signal analysis (Dhruva, 8002). Fall back to a local heuristic if offline.
    signals_ok = True
    try:
        analysis = await signal_client.analyze(
            req.user_id, req.response_text, req.response_time_ms, req.typing_wpm, req.error_rate
        )
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("signals service unavailable, using local analysis: %s", exc)
        analysis = scoring.local_analysis(raw)
        signals_ok = False

    # 2) Burnout scoring (Rishith, 8003). Fall back to local scoring if offline.
    ml_signals = {
        **raw,
        "sentiment_score": analysis.get("sentiment_score"),
        "energy_level": analysis.get("energy_level"),
        "linguistic_flags": analysis.get("linguistic_flags"),
        "combined_signal_score": analysis.get("combined_signal_score"),
    }
    try:
        ml_result = await tribe_client.score(req.user_id, req.stimulus_id, ml_signals)
        result = scoring.normalize_ml_result(ml_result, stimulus)
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("ML service unavailable, using fallback scoring: %s", exc)
        result = scoring.fallback_score(stimulus, analysis, raw)

    # 3) Persist.
    rec = crud.save_score(db, req.user_id, req.stimulus_id, result, raw)

    # 4) Red alert via signals service (best effort, never fails the request).
    alert = None
    if result["level"] == "red":
        user = crud.get_user(db, req.user_id)
        if user and user.phone:
            try:
                alert = await signal_client.send_alert(
                    req.user_id, user.phone, result["score"], result["level"], result["intervention"]
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("alert dispatch failed: %s", exc)
                alert = {"sent": False, "error": str(exc)}

    out = rec.to_result()
    out["services"] = {"signals": signals_ok, "ml": result["source"] == "tribe"}
    if alert is not None:
        out["alert"] = alert
    return out
