import os
from dotenv import load_dotenv

load_dotenv()

# phone lookup: populated at runtime when users register via /register-phone
USER_PHONES: dict[str, str] = {}  # user_id -> phone


def _client():
    from twilio.rest import Client
    sid  = os.getenv("TWILIO_ACCOUNT_SID")
    auth = os.getenv("TWILIO_AUTH_TOKEN")
    if not sid or not auth:
        raise EnvironmentError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in .env")
    return Client(sid, auth)


def send_sms(phone: str, body: str, media_url: str = None) -> str:
    params = {
        "body":   body,
        "from_":  os.getenv("TWILIO_PHONE_NUMBER"),
        "to":     phone,
    }
    if media_url:
        params["media_url"] = [media_url]
    msg = _client().messages.create(**params)
    return msg.sid


def send_alert_sms(user_id: str, score: int, intervention: str) -> str:
    from alerts.templates import red_alert
    phone = USER_PHONES.get(user_id)
    if not phone:
        return "no_phone_on_file"
    body = red_alert(score, intervention)
    return send_sms(phone, body)
