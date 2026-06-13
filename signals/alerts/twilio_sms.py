import os
from dotenv import load_dotenv

load_dotenv()


def send_red_alert(phone: str, user_id: str, score: float, intervention: str) -> dict:
    from twilio.rest import Client

    sid = os.getenv("TWILIO_SID")
    auth = os.getenv("TWILIO_AUTH")
    from_number = os.getenv("TWILIO_NUMBER")

    if not all([sid, auth, from_number]):
        raise EnvironmentError("Twilio credentials missing — check TWILIO_SID, TWILIO_AUTH, TWILIO_NUMBER in .env")

    with open(
        os.path.join(os.path.dirname(__file__), "templates", "red_alert.txt"),
        encoding="utf-8",
    ) as f:
        template = f.read()

    body = template.format(
        user_id=user_id,
        score=round(score, 1),
        intervention=intervention,
    )

    client = Client(sid, auth)
    message = client.messages.create(body=body, from_=from_number, to=phone)

    return {"sent": True, "message_sid": message.sid}
