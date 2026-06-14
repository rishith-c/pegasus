import os
import json
import time
import random
import asyncio
from pathlib import Path

import httpx

from alerts.twilio_sms import send_sms

ML_URL = os.getenv("ML_URL", "http://localhost:8003").rstrip("/")

# Canonical stimulus catalog (shared/stimuli.json). We select from it directly so
# the stimulus_id we record matches the catalog the ML TRIBE baseline resolves
# against (ml/tribe_client.py reads the same file by id), and so we have the media
# `url` on hand for the MMS send.
STIMULI = Path(__file__).resolve().parents[2] / "shared" / "stimuli.json"

# Evocative media: image/video stimuli in the "activating" or "calm" categories
# drive divergent stress responses — the whole point of the pulse check.
MEDIA_TYPES = {"image", "video"}
EVOCATIVE_CATEGORIES = {"activating", "calm"}

# Short prompt sent as the MMS text body alongside the media stimulus.
MEDIA_PROMPT = "Quick check-in 📷 — look at this for a moment, then reply with the first feeling that comes up."

SENT_STIMULI: dict[str, dict] = {}  # phone -> {user_id, stimulus_id, sent_at, type}

# Alternate calm/activating across sends so the same user sees divergent stimuli.
_last_category: str | None = None


def _load_stimuli() -> list[dict]:
    data = json.loads(STIMULI.read_text())
    return data.get("stimuli", []) if isinstance(data, dict) else data


def select_stimulus() -> dict:
    """Pick an emotionally-evocative media stimulus.

    Prefers image/video in the activating|calm categories, alternating category
    between sends. Falls back to any text stimulus if no media exists.
    """
    global _last_category
    stimuli = _load_stimuli()

    media = [s for s in stimuli
             if s.get("type") in MEDIA_TYPES and s.get("category") in EVOCATIVE_CATEGORIES]
    if not media:
        # No media available — fall back to any text stimulus so the check-in still goes out.
        text = [s for s in stimuli if s.get("type") == "text"] or stimuli
        return random.choice(text)

    # Alternate calm <-> activating when both are present.
    want = "activating" if _last_category == "calm" else "calm"
    pool = [s for s in media if s.get("category") == want] or media
    chosen = random.choice(pool)
    _last_category = chosen.get("category")
    return chosen


async def send_daily_pulse_check(user_id: str, phone: str) -> str:
    stimulus = select_stimulus()
    media_url = stimulus.get("url") or None

    # Media stimulus → short evocative prompt as the body; plain text stimulus →
    # use the stimulus' own prompt (no media to look at).
    body = MEDIA_PROMPT if media_url else stimulus.get("prompt", MEDIA_PROMPT)
    sid  = send_sms(phone, body, media_url=media_url)

    SENT_STIMULI[phone] = {
        "user_id":     user_id,
        "stimulus_id": stimulus["id"],
        "sent_at":     time.time(),
        "type":        stimulus.get("type", "text"),
    }

    # Warm the Meta TRIBE v2 baseline for this stimulus in the background (it's a
    # cold GPU call on first use). By the time they reply, scoring is fast — so
    # the webhook responds quickly and Bloo.io never retries (no duplicate texts).
    try:
        asyncio.create_task(_warm_baseline(stimulus["id"]))
    except RuntimeError:
        pass  # no running loop (e.g. called synchronously) — skip warmup

    return sid


async def _warm_baseline(stimulus_id: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=150) as client:
            await client.get(f"{ML_URL}/baseline/{stimulus_id}")
    except Exception:
        pass
