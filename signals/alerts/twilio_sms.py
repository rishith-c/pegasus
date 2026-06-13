import os
import requests
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

BLOOIO_BASE = "https://backend.blooio.com/v2/api"

USER_PHONES: dict[str, str] = {}  # user_id -> phone


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {os.getenv('BLOOIO_API_KEY')}",
        "Content-Type": "application/json",
    }


def send_sms(phone: str, body: str, media_url: str = None) -> str:
    chat_id = quote(phone, safe="")
    payload = {"text": body}
    resp = requests.post(
        f"{BLOOIO_BASE}/chats/{chat_id}/messages",
        headers=_headers(),
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("message_id", "sent")


def send_alert_sms(user_id: str, score: int, intervention: str) -> str:
    from alerts.templates import red_alert
    phone = USER_PHONES.get(user_id)
    if not phone:
        return "no_phone_on_file"
    body = red_alert(score, intervention)
    return send_sms(phone, body)
