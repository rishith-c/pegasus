from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from datetime import datetime, timezone

from analyzers.sentiment import analyze_sentiment
from analyzers.linguistic import analyze_linguistic
from analyzers.typing_patterns import analyze_typing
from analyzers.temporal import analyze_temporal
from alerts.twilio_sms import send_alert_sms, send_sms, USER_PHONES
from sms_bot.webhook import handle_incoming_sms

load_dotenv()

app = FastAPI(title="Pegasus Signals")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# in-memory signal store
_latest:  dict[str, dict] = {}
_history: dict[str, list] = {}
_LIMIT = 30


# ── Request models ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    user_id: str
    response_text: str
    response_time_ms: int = 0
    typing_wpm: int = 0
    error_rate: int = 0
    # rich biometrics from TypingBiometrics (collector.js)
    hesitation_count: Optional[int]   = 0
    burst_pattern:    Optional[str]   = "steady"
    avg_key_hold_ms:  Optional[float] = 100
    flight_time_ms:   Optional[float] = 150
    correction_loops: Optional[int]   = 0

class AlertRequest(BaseModel):
    user_id: str
    score: int
    level: str
    intervention: str

class RegisterPhoneRequest(BaseModel):
    user_id: str
    phone: str

class CheckinRequest(BaseModel):
    user_id: str
    phone: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "signals service running", "port": 8002}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    sentiment  = analyze_sentiment(req.response_text)
    linguistic = analyze_linguistic(req.response_text)
    typing     = analyze_typing({
        "typing_wpm":        req.typing_wpm,
        "error_rate":        req.error_rate,
        "response_time_ms":  req.response_time_ms,
        "hesitation_count":  req.hesitation_count,
        "burst_pattern":     req.burst_pattern,
        "avg_key_hold_ms":   req.avg_key_hold_ms,
        "flight_time_ms":    req.flight_time_ms,
        "correction_loops":  req.correction_loops,
    })
    temporal = analyze_temporal(req.response_time_ms)

    combined = min(100, round(
        (1 - sentiment["sentiment_score"]) * 40
        + typing["burnout_contribution"]
        + temporal["burnout_contribution"]
        + linguistic["burnout_contribution"],
        1,
    ))

    result = {
        # ── spec-required fields ──
        "sentiment_score":     sentiment["sentiment_score"],
        "energy_level":        sentiment["energy_level"],
        "future_tense_pct":    linguistic["future_tense_pct"],
        "self_referential_pct": linguistic["self_referential_pct"],
        "hedging_count":       linguistic["hedging_count"],
        "flat_affect":         linguistic["flat_affect"],
        "typing_stress_score": typing["stress_score"],
        "linguistic_flags":    linguistic["linguistic_flags"],
        # ── extras for Jason's combined scorer ──
        "user_id":             req.user_id,
        "response_latency_ms": req.response_time_ms,
        "word_count":          linguistic["word_count"],
        "exclamation_count":   linguistic["exclamation_count"],
        "emoji_count":         linguistic["emoji_count"],
        "typing_wpm":          typing["typing_wpm"],
        "error_rate":          typing["error_rate"],
        "hesitation_count":    typing["hesitation_count"],
        "burst_pattern":       typing["burst_pattern"],
        "combined_signal_score": combined,
        "timestamp":           datetime.now(timezone.utc).isoformat(),
        "detail": {
            "sentiment":  sentiment,
            "typing":     typing,
            "temporal":   temporal,
            "linguistic": linguistic,
        },
    }

    _latest[req.user_id] = result
    hist = _history.setdefault(req.user_id, [])
    hist.append(result)
    if len(hist) > _LIMIT:
        hist.pop(0)

    return result


@app.get("/signals/{user_id}")
def get_signals(user_id: str):
    if user_id not in _latest:
        raise HTTPException(404, f"No signals for user {user_id}")
    return _latest[user_id]


@app.get("/signals/{user_id}/history")
def get_history(user_id: str):
    hist = _history.get(user_id, [])
    if not hist:
        raise HTTPException(404, f"No history for user {user_id}")
    scores = [r["combined_signal_score"] for r in hist]
    words  = [r["word_count"] for r in hist]
    return {
        "user_id":          user_id,
        "record_count":     len(hist),
        "avg_score":        round(sum(scores) / len(scores), 1),
        "score_trend":      "worsening" if len(scores) > 2 and scores[-1] > scores[0] + 10 else "stable",
        "word_count_trend": "declining" if len(words) > 2 and words[-1] < words[0] * 0.7 else "stable",
        "records":          hist,
    }


@app.post("/alert/send")
async def alert_send(req: AlertRequest):
    if req.level == "red":
        sid = send_alert_sms(req.user_id, req.score, req.intervention)
        return {"sent": True, "message_sid": sid}
    return {"sent": False, "reason": f"level is '{req.level}', SMS reserved for red"}


@app.post("/register-phone")
def register_phone(req: RegisterPhoneRequest):
    """Register a user's phone so alert SMS knows where to send."""
    USER_PHONES[req.user_id] = req.phone
    return {"registered": True, "user_id": req.user_id, "phone": req.phone}


@app.post("/send-checkin")
async def send_checkin(req: CheckinRequest):
    """Manually trigger today's pulse-check SMS (demo / cron endpoint)."""
    from sms_bot.stimulus_sender import trigger_checkin
    try:
        return await trigger_checkin(req.user_id, req.phone)
    except Exception as e:
        raise HTTPException(500, str(e))


class ReminderRequest(BaseModel):
    user_id: str
    text: str


@app.post("/schedule-reminder")
def schedule_reminder_route(req: ReminderRequest):
    """Parse a reminder from free text ('text me in 15 min to take a break') and
    schedule an SMS to the user's registered phone. Used by the voice call."""
    from sms_bot.reminders import parse_reminder, schedule_reminder, human_delay
    rem = parse_reminder(req.text)
    if not rem:
        return {"scheduled": False, "reason": "no_reminder"}
    phone = USER_PHONES.get(req.user_id)
    if not phone:
        return {"scheduled": False, "reason": "no_phone"}
    delay, task = rem
    schedule_reminder(phone, delay, task)
    return {"scheduled": True, "delay": delay, "task": task, "human": human_delay(delay)}


@app.post("/sms/webhook")
async def sms_webhook(request: Request):
    """Bloo.io inbound webhook. Payload is a flat WebhookEventPayload with
    `event`, `sender` (phone), and `text`. We only act on genuine inbound
    messages — ignore our own outbound echoes + delivery/status events so we
    don't score messages Pegasus itself sent."""
    payload     = await request.json()
    event       = (payload.get("event") or "").lower()
    if event and event not in ("message.received", "message.inbound"):
        return {"status": "ignored", "event": event}
    from_number = payload.get("sender") or payload.get("from") or payload.get("phone", "")
    body        = payload.get("text") or payload.get("body") or payload.get("message", "")
    if not from_number or not body:
        return {"status": "ignored", "reason": "missing sender/text"}
    return await handle_incoming_sms(from_number, body)


@app.on_event("startup")
async def _start_imessage_inbound():
    """Read the user's iMessage replies locally (Bloo.io webhook replacement)."""
    from sms_bot.imessage_poller import start
    start()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
