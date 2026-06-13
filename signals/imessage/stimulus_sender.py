import os
from dotenv import load_dotenv
from stimuli.bank import select_session_stimuli

load_dotenv()

# Pick one positive stimulus per daily check — most likely to reveal blunted affect
def _pick_daily_stimulus() -> dict:
    stimuli = select_session_stimuli(n_positive=1, n_negative=0, n_neutral=0, n_cognitive=0)
    return stimuli[0]


def send_stimulus(phone: str, user_id: str, stimulus: dict | None = None) -> dict:
    """Send a daily pulse-check stimulus to a phone number via Twilio SMS."""
    from twilio.rest import Client

    sid  = os.getenv("TWILIO_SID")
    auth = os.getenv("TWILIO_AUTH")
    from_number = os.getenv("TWILIO_NUMBER")

    if not all([sid, auth, from_number]):
        raise EnvironmentError("Twilio credentials missing — check TWILIO_SID, TWILIO_AUTH, TWILIO_NUMBER in .env")

    if stimulus is None:
        stimulus = _pick_daily_stimulus()

    body = (
        f"Hey! Quick pulse check 💭\n\n"
        f"{stimulus['content']}\n\n"
        f"{stimulus['prompt']}"
    )

    client = Client(sid, auth)
    message = client.messages.create(body=body, from_=from_number, to=phone)

    return {
        "sent":        True,
        "message_sid": message.sid,
        "stimulus":    stimulus,
        "user_id":     user_id,
        "phone":       phone,
    }
