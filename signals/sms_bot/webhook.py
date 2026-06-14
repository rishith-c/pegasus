import os
import time
import httpx
from fastapi.responses import JSONResponse
from alerts.twilio_sms import send_sms
from sms_bot.bot import SENT_STIMULI

ML_URL  = os.getenv("ML_URL", "http://localhost:8003").rstrip("/")
BACKEND = os.getenv("BACKEND_URL", "http://localhost:8001")

# Per-sender conversation memory so the SMS companion stays coherent across turns.
_history: dict[str, list] = {}        # phone(last10) -> recent [{role,content}] turns
_HISTORY_MAX = 10
# Exact-duplicate dedup: Bloo.io retries inbound webhooks if our handler is slow.
# We swallow a re-delivery of the SAME text within a short window; distinct
# messages are always processed.
_recent_msg: dict[str, tuple] = {}    # phone(last10) -> (text, ts)
_DEDUP_SECS = 90


def _digits(phone: str) -> str:
    """Last 10 digits — tolerant phone match (Bloo.io may format `sender`
    differently from how we stored it: +1XXXXXXXXXX vs 1XXXXXXXXXX vs spaces)."""
    return "".join(c for c in (phone or "") if c.isdigit())[-10:]


def _lookup(from_number: str):
    """Find the pending stimulus for a sender, matching on the last 10 digits."""
    if from_number in SENT_STIMULI:
        return from_number, SENT_STIMULI[from_number]
    target = _digits(from_number)
    for key, val in SENT_STIMULI.items():
        if _digits(key) == target:
            return key, val
    return None, None


async def handle_incoming_sms(from_number: str, body: str) -> JSONResponse:
    body = (body or "").strip()
    if not body:
        return JSONResponse({"status": "ignored", "reason": "empty"})

    key, sent = _lookup(from_number)
    digits = _digits(from_number)
    now = time.time()

    # Swallow Bloo.io retries / duplicate deliveries of the SAME text only.
    prev = _recent_msg.get(digits)
    if prev and prev[0] == body and now - prev[1] < _DEDUP_SECS:
        return JSONResponse({"status": "duplicate_ignored"})
    _recent_msg[digits] = (body, now)

    # Reminder request? "remind me to take a break in 15 minutes" → actually
    # schedule an SMS that fires after the delay, and confirm.
    from sms_bot.reminders import parse_reminder, schedule_reminder, human_delay

    rem = parse_reminder(body)
    if rem:
        delay, task = rem
        schedule_reminder(from_number, delay, task)
        send_sms(from_number, f"Got it — I'll text you in {human_delay(delay)} to {task}. 👍")
        return JSONResponse({"status": "ok", "mode": "reminder", "delay": delay, "task": task})

    if sent:
        # Reply to a pending check-in → score it against that stimulus. Claim it
        # atomically (no await before the pop) so a retry can't double-score.
        SENT_STIMULI.pop(key, None)
        latency_ms = int((now - sent["sent_at"]) * 1000)
        score = await _get_score(sent, body, latency_ms)
        ai_line = await _companion_reply(
            digits, sent["user_id"], body, score.get("score"), score.get("level")
        )
        emoji  = {"green": "🟢", "yellow": "🟡", "red": "🔴"}.get(score.get("level", "green"), "🟢")
        points = score.get("score", 50)
        hint   = score.get("intervention", "")
        msg = (f"{ai_line}\n\n{emoji} Pulse: {points}/100"
               if ai_line else f"{emoji} Pulse: {points}/100\n\n{hint}")
        send_sms(from_number, msg)
        return JSONResponse({"status": "ok", "mode": "checkin", "score": points, "level": score.get("level")})

    # No pending check-in → just talk. Pegasus is a companion you can message
    # anytime, not a vending machine that only replies to its own prompts.
    reply = await _companion_reply(digits, "sms_" + digits, body, None, None)
    send_sms(from_number, reply or "I'm here with you. What's on your mind?")
    return JSONResponse({"status": "ok", "mode": "chat"})


async def _get_score(sent: dict, body: str, latency_ms: int) -> dict:
    """Score the reply against the stimulus. Primary path is the ML service
    (real Meta TRIBE v2 on Modal + HF sentiment + RAG intervention) — TRIBE can
    be slow the first time a stimulus is seen, so we allow a generous timeout.
    Falls back to the backend orchestrator, then to a local heuristic."""
    # Over SMS we have no real keystroke biometrics, so we DON'T send typing
    # signals — the scorer then fuses only the real streams (what they wrote +
    # TRIBE), instead of letting fake typing defaults dilute a strong reply.
    signals = {
        "response_text":       body,
        "response_time_ms":    min(latency_ms, 60_000),
        "response_latency_ms": latency_ms,
    }
    # 1) ML service — TRIBE v2 + HF + RAG.
    try:
        async with httpx.AsyncClient(timeout=150) as client:
            res = await client.post(f"{ML_URL}/score", json={
                "user_id":     sent["user_id"],
                "stimulus_id": sent["stimulus_id"],
                "signals":     signals,
            })
            res.raise_for_status()
            return res.json()
    except Exception:
        pass
    # 2) Backend orchestrator (its schema wants typing fields — give neutral ones).
    try:
        async with httpx.AsyncClient(timeout=150) as client:
            res = await client.post(f"{BACKEND}/response/submit", json={
                "user_id": sent["user_id"], "stimulus_id": sent["stimulus_id"],
                "response_text": body, "source": "sms",
                "typing_wpm": 40, "error_rate": 0, **signals,
            })
            res.raise_for_status()
            return res.json()
    except Exception:
        # 3) Local heuristic — last resort so a reply is never dropped.
        return _local_score(body, latency_ms)


async def _companion_reply(digits: str, user_id: str, body: str,
                           score, level) -> str:
    """One conversational companion turn (HF chat + RAG), grounded in the burnout
    score/level when we have one, and remembering the recent conversation so it
    stays coherent across texts. Returns '' on failure."""
    history = _history.get(digits, [])
    messages = history + [{"role": "user", "content": body}]
    reply = ""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(f"{ML_URL}/chat", json={
                "user_id": user_id, "messages": messages, "score": score, "level": level,
            })
            res.raise_for_status()
            reply = (res.json().get("reply") or "").strip()
    except Exception:
        reply = ""
    # Persist trimmed history so the next text continues the thread.
    if reply:
        _history[digits] = (messages + [{"role": "assistant", "content": reply}])[-_HISTORY_MAX:]
    return reply


def _local_score(body: str, latency_ms: int) -> dict:
    from analyzers.sentiment import analyze_sentiment
    from analyzers.linguistic import analyze_linguistic
    from analyzers.temporal import analyze_temporal

    sentiment  = analyze_sentiment(body)
    linguistic = analyze_linguistic(body)
    temporal   = analyze_temporal(latency_ms)

    score = min(100, round(
        (1 - sentiment["sentiment_score"]) * 40
        + linguistic["burnout_contribution"]
        + temporal["burnout_contribution"]
    ))

    if score < 30:
        level, hint = "green",  "Keep it up — small things add up."
    elif score < 65:
        level, hint = "yellow", "Take a 10-minute break before your next task."
    else:
        level, hint = "red",    "Reach out to someone you trust today."

    return {"score": score, "level": level, "intervention": hint}
