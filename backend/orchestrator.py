"""Orchestrates a check-in across Signals (:8002) and ML (:8003).

Each downstream call is defensive: if a service is down, we degrade instead of
500ing the whole pipeline (important for a live demo).
"""
from __future__ import annotations

import os
from typing import Dict

import httpx

SIGNALS_URL = os.getenv("SIGNALS_URL", "http://localhost:8002")
ML_URL = os.getenv("ML_URL", "http://localhost:8003")
TIMEOUT = float(os.getenv("PEGASUS_HTTP_TIMEOUT", "30"))


def _post(url: str, payload: Dict) -> Dict:
    r = httpx.post(url, json=payload, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def run_checkin(checkin: Dict, stimulus: Dict, phone: str | None) -> Dict:
    # 1. Behavioral signal (Signals service)
    try:
        signal = _post(f"{SIGNALS_URL}/signals/analyze", {
            "user_id": checkin["user_id"],
            "text": checkin.get("text_response", ""),
            "typing_wpm": checkin.get("typing_wpm", 0),
            "error_rate": checkin.get("error_rate", 0),
            "response_time_ms": checkin.get("response_time_ms", 0),
        })
    except Exception:
        signal = {"sentiment_score": 0.5, "energy_level": "medium",
                  "flags": ["signals_unavailable"], "combined_signal_score": 0.5}

    # 2. Healthy-brain prediction (ML / TRIBE v2)
    try:
        prediction = _post(f"{ML_URL}/predict", {"stimulus": stimulus})
    except Exception:
        prediction = {"predicted_engagement": 0.7, "predicted_valence": 0.7, "activation_summary": []}

    # 3. Deviation -> burnout score (ML)
    try:
        burnout = _post(f"{ML_URL}/score", {
            "stimulus": stimulus, "prediction": prediction,
            "signal": signal, "checkin": checkin,
        })
    except Exception:
        burnout = {"score": 0, "level": "green", "deviation": 0.0, "components": {}}

    # 4. Intervention (ML / Claude)
    try:
        intervention = _post(f"{ML_URL}/intervention", {
            "burnout": burnout, "recent_signals": [signal],
        })
    except Exception:
        intervention = {"message": "Check-in recorded.", "suggested_action": "Take a short break."}

    # 5. Alert on red (Signals / Twilio)
    alerted = False
    if burnout.get("level") == "red" and phone:
        try:
            res = _post(f"{SIGNALS_URL}/alert", {
                "user_id": checkin["user_id"], "phone": phone,
                "score": burnout.get("score"), "level": "red",
                "intervention": intervention.get("message", ""),
            })
            alerted = bool(res.get("sent"))
        except Exception:
            alerted = False

    return {
        "score": burnout.get("score"),
        "level": burnout.get("level"),
        "deviation": burnout.get("deviation"),
        "components": burnout.get("components", {}),
        "signal": signal,
        "intervention": intervention,
        "alerted": alerted,
    }
