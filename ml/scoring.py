"""TRIBE deviation — how far the user's behavior drifts from the healthy
prediction. Returns 0-1 (0 = matches healthy baseline, 1 = maximal drift).

This is one of the five inputs to combined_scorer.compute_final_score.
"""
from __future__ import annotations

from typing import Dict


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_tribe_deviation(baseline: Dict | None, imessage_signals: Dict | None) -> float:
    """Deviation of observed behavior from the TRIBE healthy baseline.

    We proxy the user's neural engagement/valence with their behavioral signals
    (sentiment as valence; combined signal strength as engagement). A healthy
    baseline expecting high engagement/positive valence while the user shows low
    => large deviation.
    """
    if not baseline:
        return 0.0
    sig = imessage_signals or {}

    pred_eng = float(baseline.get("predicted_engagement", 0.7))
    pred_val = float(baseline.get("predicted_valence", 0.7))

    obs_eng = float(sig.get("combined_signal_score", sig.get("sentiment_score", 0.5)))
    obs_val = float(sig.get("sentiment_score", 0.5))

    engagement_gap = _clamp01(pred_eng - obs_eng)
    valence_gap = _clamp01(pred_val - obs_val)
    return round(_clamp01(0.6 * engagement_gap + 0.4 * valence_gap), 4)
