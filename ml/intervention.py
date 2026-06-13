"""Personalized intervention generation via Claude.

Falls back to a deterministic canned message when ANTHROPIC_API_KEY is unset
so the demo still works offline.
"""
from __future__ import annotations

import json
import os
from typing import Dict, List

MODEL = "claude-sonnet-4-6"

_FALLBACK = {
    "green": {
        "message": "You're tracking well today. Whatever you're doing, keep the rhythm.",
        "suggested_action": "Take a real 5-minute break before your next task.",
    },
    "yellow": {
        "message": "Some drift showing up. Not alarming, but your responses are flatter than your healthy baseline.",
        "suggested_action": "Step outside for 10 minutes and drink water before continuing.",
    },
    "red": {
        "message": "Your signals are well below baseline. This is the kind of drift that precedes burnout.",
        "suggested_action": "Stop work for today if you can. Message one person you trust.",
    },
}


def generate_intervention(burnout: Dict, recent_signals: List[Dict] | None = None) -> Dict:
    level = burnout.get("level", "yellow")
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return dict(_FALLBACK.get(level, _FALLBACK["yellow"]))

    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=api_key)
        prompt = (
            "You are a calm, concise burnout coach for the Pegasus mental-health app. "
            f"The user's burnout score is {burnout.get('score')} / 100 (level: {level}). "
            f"Deviation components: {json.dumps(burnout.get('components', {}))}. "
            f"Recent behavioral signals: {json.dumps(recent_signals or [])}. "
            'Return ONLY a JSON object: {"message": "1-2 warm, specific sentences", '
            '"suggested_action": "one concrete action they can take in the next hour"}'
        )
        resp = client.messages.create(
            model=MODEL,
            max_tokens=250,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        data = json.loads(text)
        return {
            "message": str(data["message"]),
            "suggested_action": str(data["suggested_action"]),
        }
    except Exception:
        # Never let intervention generation break the pipeline.
        return dict(_FALLBACK.get(level, _FALLBACK["yellow"]))
