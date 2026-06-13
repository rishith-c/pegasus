import os
import time
import httpx
from fastapi.responses import JSONResponse
from alerts.twilio_sms import send_sms
from sms_bot.bot import SENT_STIMULI

BACKEND = os.getenv("BACKEND_URL", "http://localhost:8001")


async def handle_incoming_sms(from_number: str, body: str) -> JSONResponse:
    sent = SENT_STIMULI.get(from_number)

    if not sent:
        send_sms(from_number, "Hey! I'll send you a pulse check soon. 🌱")
        return JSONResponse({"status": "ok"})

    latency_ms = int((time.time() - sent["sent_at"]) * 1000)
    score = await _get_score(sent, body, latency_ms)

    level_emoji = {"green": "🟢", "yellow": "🟡", "red": "🔴"}
    emoji  = level_emoji.get(score.get("level", "green"), "🟢")
    points = score.get("score", 50)
    hint   = score.get("intervention", "")
    send_sms(from_number, f"{emoji} Pulse: {points}/100\n\n{hint}")

    del SENT_STIMULI[from_number]
    return JSONResponse({"status": "ok"})


async def _get_score(sent: dict, body: str, latency_ms: int) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(f"{BACKEND}/response/submit", json={
                "user_id":             sent["user_id"],
                "stimulus_id":         sent["stimulus_id"],
                "response_text":       body,
                "response_time_ms":    min(latency_ms, 60_000),
                "response_latency_ms": latency_ms,
                "typing_wpm":          40,
                "error_rate":          0,
                "source":              "sms",
            })
            res.raise_for_status()
            return res.json()
    except Exception:
        return _local_score(body, latency_ms)


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
