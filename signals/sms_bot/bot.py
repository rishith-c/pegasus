import os
import time
import httpx
from alerts.twilio_sms import send_sms
from alerts.templates import daily_stimulus

BACKEND = os.getenv("BACKEND_URL", "http://localhost:8001")

SENT_STIMULI: dict[str, dict] = {}  # phone -> {user_id, stimulus_id, sent_at}


async def send_daily_pulse_check(user_id: str, phone: str) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{BACKEND}/stimulus/today/{user_id}")
        stimulus = res.json()

    body = daily_stimulus(stimulus["prompt"])
    sid  = send_sms(phone, body)

    SENT_STIMULI[phone] = {
        "user_id":     user_id,
        "stimulus_id": stimulus["id"],
        "sent_at":     time.time(),
    }
    return sid
