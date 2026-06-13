import os
import time
import httpx
from alerts.twilio_sms import send_sms
from alerts.templates import daily_stimulus

BACKEND = os.getenv("BACKEND_URL", "http://localhost:8001")

SENT_STIMULI: dict[str, dict] = {}  # phone -> {user_id, stimulus_id, sent_at}


_FALLBACK_STIMULI = [
    {"id": "local_1", "prompt": "How's your energy today? Be honest."},
    {"id": "local_2", "prompt": "What's been weighing on you most this week?"},
    {"id": "local_3", "prompt": "On a scale of 1-10, how present do you feel right now?"},
    {"id": "local_4", "prompt": "What's one thing that felt hard today that normally wouldn't?"},
    {"id": "local_5", "prompt": "How does this make you feel? 🌅"},
]

import random

async def send_daily_pulse_check(user_id: str, phone: str) -> str:
    stimulus = None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(f"{BACKEND}/stimulus/today/{user_id}")
            res.raise_for_status()
            stimulus = res.json()
    except Exception:
        stimulus = random.choice(_FALLBACK_STIMULI)

    body = daily_stimulus(stimulus["prompt"])
    sid  = send_sms(phone, body)

    SENT_STIMULI[phone] = {
        "user_id":     user_id,
        "stimulus_id": stimulus["id"],
        "sent_at":     time.time(),
    }
    return sid
