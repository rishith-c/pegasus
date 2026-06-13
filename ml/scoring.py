"""Deviation scoring — healthy brain prediction vs. actual behavioral signal.

Burnout = how far the user's real response drifts *below* what a healthy brain
would do with the same stimulus. Big positive gaps (healthy expects high
engagement/positive valence, user shows low) => higher burnout score.
"""
from __future__ import annotations

from typing import Dict


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_score(prediction: Dict, signal: Dict, checkin: Dict) -> Dict:
    """Return a BurnoutScore dict (see shared/contract.md)."""
    pred_eng = float(prediction.get("predicted_engagement", 0.7))
    pred_val = float(prediction.get("predicted_valence", 0.7))

    obs_eng = float(signal.get("combined_signal_score", 0.5))
    obs_val = float(signal.get("sentiment_score", 0.5))

    # Typing/timing penalty: high error rate, abandoned/very slow responses, or
    # near-zero typing all push the "signal gap" up.
    error_rate = float(checkin.get("error_rate", 0.0)) / 100.0          # 0-1
    wpm = float(checkin.get("typing_wpm", 0))
    rt_ms = float(checkin.get("response_time_ms", 0))
    slow = _clamp01((rt_ms - 60_000) / 120_000)        # >1min starts to count
    low_wpm = _clamp01((25 - wpm) / 25) if wpm > 0 else 0.5
    typing_penalty = _clamp01(0.5 * error_rate + 0.3 * low_wpm + 0.2 * slow)

    engagement_gap = _clamp01(pred_eng - obs_eng)
    valence_gap = _clamp01(pred_val - obs_val)
    signal_gap = typing_penalty

    deviation = 0.50 * engagement_gap + 0.35 * valence_gap + 0.15 * signal_gap
    score = round(_clamp01(deviation) * 100)

    level = "red" if score >= 70 else "yellow" if score >= 40 else "green"

    return {
        "score": score,
        "level": level,
        "deviation": round(deviation, 4),
        "components": {
            "engagement_gap": round(engagement_gap, 4),
            "valence_gap": round(valence_gap, 4),
            "signal_gap": round(signal_gap, 4),
        },
    }
