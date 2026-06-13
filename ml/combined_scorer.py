"""Combined scoring engine — merges all signal streams into one burnout score.

Streams (each 0-100, higher = more burnout signal):
  imessage  (text sentiment / latency / linguistics)   weight 0.25
  typing    (wpm / error rate / hesitation / burst)     weight 0.20
  facial    (MediaPipe stress score)                    weight 0.30  (hardest to fake)
  voice     (pitch / variability / pauses / tremor)     weight 0.15
  tribe     (deviation from healthy TRIBE baseline)     weight 0.10

Any stream may be absent (e.g. a text-only check-in has no facial/voice). We
renormalize the weights over whatever streams are actually present, so a
text-only check-in still produces a sensible score.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from claude_interpreter import generate_intervention

WEIGHTS = {"imessage": 0.25, "typing": 0.20, "facial": 0.30, "voice": 0.15, "tribe": 0.10}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


# --- per-stream sub-scores (return None when the stream is absent) ---------
def _imessage_subscore(s: Optional[Dict]) -> Optional[float]:
    if not s:
        return None
    sentiment = float(s.get("sentiment_score", 0.5))
    latency = float(s.get("response_latency_ms", s.get("response_time_ms", 0)))
    future_pct = float(s.get("future_tense_pct", 50))
    return _clamp(
        (1 - sentiment) * 40
        + min(latency / 10000, 1) * 30
        + (1 - future_pct / 100) * 30
    )


def _typing_subscore(t: Optional[Dict]) -> Optional[float]:
    if not t:
        return None
    return _clamp(
        min(float(t.get("error_rate", 0)) / 20, 1) * 30
        + max(1 - float(t.get("typing_wpm", 60)) / 80, 0) * 25
        + min(float(t.get("hesitation_count", 0)) / 5, 1) * 25
        + (20 if t.get("burst_pattern") == "erratic" else 0)
    )


def _facial_subscore(f: Optional[Dict]) -> Optional[float]:
    if not f or "facial_stress_score" not in f:
        return None
    return _clamp(float(f["facial_stress_score"]))


def _voice_subscore(v: Optional[Dict]) -> Optional[float]:
    if not v:
        return None
    return _clamp(
        min(float(v.get("pitch_mean_hz", 150)) / 300, 1) * 30
        + (1 - min(float(v.get("pitch_variability", 20)) / 40, 1)) * 25
        + min(float(v.get("pause_frequency", 0)) / 10, 1) * 25
        + (20 if v.get("voice_tremor", False) else 0)
    )


def _level(score: int) -> str:
    if score < 30:
        return "green"
    if score < 65:
        return "yellow"
    return "red"


def compute_final_score(
    imessage: Optional[Dict] = None,
    typing: Optional[Dict] = None,
    facial: Optional[Dict] = None,
    voice: Optional[Dict] = None,
    tribe_deviation: Optional[float] = None,
) -> Dict:
    subs = {
        "imessage": _imessage_subscore(imessage),
        "typing": _typing_subscore(typing),
        "facial": _facial_subscore(facial),
        "voice": _voice_subscore(voice),
        "tribe": (None if tribe_deviation is None else _clamp(float(tribe_deviation) * 100)),
    }
    present = {k: v for k, v in subs.items() if v is not None}
    if not present:
        return {"score": 0, "level": "green", "breakdown": {}, "streams_used": [],
                "top_indicators": ["No signals submitted yet."],
                "intervention": generate_intervention(0, "green", [])}

    # Renormalize weights over present streams.
    total_w = sum(WEIGHTS[k] for k in present)
    final = sum(present[k] * (WEIGHTS[k] / total_w) for k in present)
    final = int(_clamp(final))
    level = _level(final)
    indicators = get_top_indicators(imessage, typing, facial, voice, subs)

    return {
        "score": final,
        "level": level,
        "breakdown": {k: int(v) for k, v in subs.items() if v is not None},
        "streams_used": list(present.keys()),
        "top_indicators": indicators,
        "intervention": generate_intervention(final, level, indicators),
    }


def get_top_indicators(imessage, typing, facial, voice, subs: Dict) -> List[str]:
    """Human-readable callouts, ordered by which streams contributed most."""
    out: List[str] = []
    if typing:
        er = float(typing.get("error_rate", 0))
        if er >= 15:
            out.append(f"Typing error rate elevated at {int(er)}%")
        if typing.get("burst_pattern") == "erratic":
            out.append("Erratic typing rhythm (cognitive load)")
        if float(typing.get("hesitation_count", 0)) >= 4:
            out.append("Frequent mid-response hesitations")
    if imessage and float(imessage.get("sentiment_score", 0.5)) < 0.35:
        out.append("Response sentiment is low / flat")
    if facial and float(facial.get("facial_stress_score", 0)) >= 60:
        out.append("Elevated facial tension on video check-in")
    if voice and voice.get("voice_tremor"):
        out.append("Voice tremor detected")
    # Fall back to the single biggest stream if nothing tripped a threshold.
    if not out:
        ranked = sorted(((v, k) for k, v in subs.items() if v is not None), reverse=True)
        if ranked and ranked[0][0] > 0:
            out.append(f"Highest signal: {ranked[0][1]} ({int(ranked[0][0])}/100)")
        else:
            out.append("All streams within healthy range")
    return out[:3]
