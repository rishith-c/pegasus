"""POST /response/submit — the orchestrator (prefix /response).

Flow: signals (8002) -> ML score (8003) -> persist -> red-alert (best effort).
Called by Wesley's app (source="app") and Dhruva's SMS bot (source="sms").
Each downstream call degrades gracefully so the backend works standalone.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import safety
from models.database import get_db
from schemas import ResponseSubmitRequest
from services import ml_client, scoring, signal_client, stimuli

router = APIRouter()
log = logging.getLogger("pegasus.backend")


@router.post("/submit")
async def submit_response(data: ResponseSubmitRequest, db: Session = Depends(get_db)):
    crud.ensure_user(db, data.user_id)
    stimulus = stimuli.get_stimulus(data.stimulus_id)
    video = crud.video_signals_for(db, data.user_id)  # latest facial/voice, if any
    raw = {
        "response_text": data.response_text,
        "response_time_ms": data.response_time_ms,
        "response_latency_ms": data.response_latency_ms,
        "typing_wpm": data.typing_wpm,
        "error_rate": data.error_rate,
    }

    # 1) Signal analysis (Dhruva, 8002). Fall back to a local heuristic if offline.
    signals_ok = True
    try:
        analysis = await signal_client.analyze(
            {
                "user_id": data.user_id,
                "response_text": data.response_text,
                "response_time_ms": data.response_time_ms,
                "typing_wpm": data.typing_wpm,
                "error_rate": data.error_rate,
            }
        )
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("signals service unavailable, using local analysis: %s", exc)
        analysis = scoring.local_analysis(raw)
        signals_ok = False

    # 2) Burnout scoring (Rishith, 8003). Fall back to local scoring if offline.
    ml_signals = {
        "sentiment_score": analysis.get("sentiment_score"),
        "energy_level": analysis.get("energy_level"),
        "linguistic_flags": analysis.get("linguistic_flags"),
        "combined_signal_score": analysis.get("combined_signal_score"),
        "typing_wpm": data.typing_wpm,
        "error_rate": data.error_rate,
        "response_time_ms": data.response_time_ms,
        "response_latency_ms": data.response_latency_ms,
        "facial_score": (video or {}).get("facial_score"),
        "voice_score": (video or {}).get("voice_score"),
    }
    try:
        ml_result = await ml_client.score(data.user_id, data.stimulus_id, ml_signals)
        result = scoring.normalize_ml_result(ml_result, stimulus, analysis, raw, video)
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("ML service unavailable, using fallback scoring: %s", exc)
        result = scoring.fallback_score(stimulus, analysis, raw, video)

    # Safety invariant: a red result always carries a human-support path (PRD §6).
    result = safety.ensure_human_support(result)

    # 3) Persist.
    rec = crud.save_score(db, data.user_id, data.stimulus_id, result, data.source)

    # 4) Red alert via signals service (best effort, never fails the request).
    #    Signals looks up the user's registered phone; we just fire on red.
    alert = None
    if result["level"] == "red":
        try:
            alert = await signal_client.send_alert(
                data.user_id, result["score"], result["level"], result["intervention"]
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("alert dispatch failed: %s", exc)
            alert = {"sent": False, "error": str(exc)}

    out = rec.to_result()
    out["services"] = {"signals": signals_ok, "ml": result["source"] == "tribe"}
    if alert is not None:
        out["alert"] = alert
    return out
