"""Intervention generation via Claude. Falls back to deterministic copy when
ANTHROPIC_API_KEY is unset so the demo always works offline."""
from __future__ import annotations

import json
import os
from typing import Dict, List

MODEL = "claude-sonnet-4-6"

_FALLBACK = {
    "green": {
        "message": "You're tracking well across your signals today. Keep the rhythm.",
        "suggested_action": "Take a real 5-minute break before your next task.",
    },
    "yellow": {
        "message": "Some drift showing up — your signals are flatter than your healthy baseline.",
        "suggested_action": "Step outside for 10 minutes and drink water before continuing.",
    },
    "red": {
        "message": "Your signals are well below baseline. This is the kind of drift that precedes burnout.",
        "suggested_action": "Stop work for today if you can, and message one person you trust.",
    },
}


def generate_intervention(score: int, level: str, indicators: List[str] | None = None) -> Dict:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return dict(_FALLBACK.get(level, _FALLBACK["yellow"]))
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=api_key)
        prompt = (
            "You are a calm, concise burnout coach for the Pegasus mental-health app. "
            f"The user's combined burnout score is {score}/100 (level: {level}). "
            f"Top indicators: {json.dumps(indicators or [])}. "
            'Return ONLY a JSON object: {"message": "1-2 warm, specific sentences that '
            'reference an indicator", "suggested_action": "one concrete action for the next hour"}'
        )
        resp = client.messages.create(
            model=MODEL, max_tokens=250,
            messages=[{"role": "user", "content": prompt}],
        )
        data = json.loads(resp.content[0].text.strip())
        return {"message": str(data["message"]), "suggested_action": str(data["suggested_action"])}
    except Exception:
        return dict(_FALLBACK.get(level, _FALLBACK["yellow"]))
