"""Behavioral signal analysis via Claude + typing dynamics.

Combines sentiment/energy from the text (Claude) with typing metrics into a
single `combined_signal_score` (0-1, higher = healthier). Falls back to a
lexical heuristic when ANTHROPIC_API_KEY is unset so the demo runs offline.
"""
from __future__ import annotations

import json
import os
from typing import Dict

MODEL = "claude-sonnet-4-6"

_NEG = {"tired", "exhausted", "drained", "done", "overwhelmed", "stressed",
        "anxious", "numb", "empty", "cant", "can't", "nothing", "whatever", "fine"}
_POS = {"excited", "good", "great", "energized", "happy", "calm", "ready",
        "love", "looking", "forward", "rested", "grateful"}


def _heuristic(text: str) -> Dict:
    words = text.lower().split()
    if not words:
        return {"sentiment_score": 0.3, "energy_level": "low", "flags": ["empty_response"]}
    neg = sum(w.strip(".,!?") in _NEG for w in words)
    pos = sum(w.strip(".,!?") in _POS for w in words)
    score = 0.5 + 0.08 * (pos - neg)
    score = max(0.0, min(1.0, score))
    energy = "high" if score > 0.66 else "low" if score < 0.34 else "medium"
    flags = []
    if len(words) < 4:
        flags.append("very_short_response")
    if neg > pos:
        flags.append("negative_lexical_skew")
    return {"sentiment_score": round(score, 3), "energy_level": energy, "flags": flags}


def _claude(text: str) -> Dict:
    from anthropic import Anthropic

    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    resp = client.messages.create(
        model=MODEL,
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                f'Analyze the sentiment and energy of this check-in response: "{text}". '
                'Return ONLY a JSON object: '
                '{"sentiment_score": 0.0-1.0, "energy_level": "low|medium|high", "flags": []} '
                'where flags note burnout markers (e.g. "future_tense_low", '
                '"high_self_reference", "flat_affect", "very_short_response").'
            ),
        }],
    )
    data = json.loads(resp.content[0].text.strip())
    return {
        "sentiment_score": float(data["sentiment_score"]),
        "energy_level": str(data["energy_level"]),
        "flags": list(data.get("flags", [])),
    }


def analyze(text: str, typing_wpm: int = 0, error_rate: float = 0.0,
            response_time_ms: int = 0) -> Dict:
    try:
        base = _claude(text) if os.getenv("ANTHROPIC_API_KEY") else _heuristic(text)
    except Exception:
        base = _heuristic(text)

    # Fold typing dynamics into a combined health score.
    energy_w = {"low": 0.25, "medium": 0.55, "high": 0.85}.get(base["energy_level"], 0.5)
    err = max(0.0, min(1.0, error_rate / 100.0))
    wpm_health = max(0.0, min(1.0, typing_wpm / 40.0)) if typing_wpm else 0.5
    combined = 0.45 * base["sentiment_score"] + 0.25 * energy_w + 0.20 * wpm_health + 0.10 * (1 - err)
    combined = round(max(0.0, min(1.0, combined)), 3)

    return {
        "sentiment_score": base["sentiment_score"],
        "energy_level": base["energy_level"],
        "flags": base["flags"],
        "combined_signal_score": combined,
    }
