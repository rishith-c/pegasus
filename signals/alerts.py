"""Twilio SMS alerts for red-level burnout. No-ops gracefully if Twilio creds
are missing (logs to console) so the demo never crashes on the alert path."""
from __future__ import annotations

import os
from typing import Dict


def send_alert(phone: str, score: int, level: str, intervention: str) -> Dict:
    body = (
        f"Pegasus check-engine 🔴\n"
        f"Your burnout signal is high ({score}/100).\n{intervention}"
    )

    sid = os.getenv("TWILIO_SID")
    auth = os.getenv("TWILIO_AUTH")
    from_number = os.getenv("TWILIO_NUMBER")

    if not (sid and auth and from_number and phone):
        print(f"[alerts] (no Twilio creds) would SMS {phone}: {body}")
        return {"sent": False, "message_sid": None, "reason": "twilio_not_configured"}

    try:
        from twilio.rest import Client

        client = Client(sid, auth)
        msg = client.messages.create(body=body, from_=from_number, to=phone)
        return {"sent": True, "message_sid": msg.sid}
    except Exception as e:  # pragma: no cover - network
        print(f"[alerts] Twilio send failed: {e}")
        return {"sent": False, "message_sid": None, "reason": str(e)}
