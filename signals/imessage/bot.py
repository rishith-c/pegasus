from datetime import datetime, timezone
from analyzers import analyze_sentiment, analyze_typing, analyze_temporal, analyze_linguistic

# phone → {stimulus, sent_at_ms}
_sessions: dict[str, dict] = {}


def record_stimulus_sent(phone: str, stimulus: dict) -> None:
    _sessions[phone] = {
        "stimulus":   stimulus,
        "sent_at_ms": datetime.now(timezone.utc).timestamp() * 1000,
    }


def get_session(phone: str) -> dict | None:
    return _sessions.get(phone)


async def handle_incoming(from_number: str, body: str, received_at_ms: float | None = None) -> str:
    """
    Analyze an incoming SMS response and return the bot's reply text.
    Uses signal analyzers locally — no TRIBE v2 call (that's Jason's orchestration layer).
    """
    if received_at_ms is None:
        received_at_ms = datetime.now(timezone.utc).timestamp() * 1000

    session = get_session(from_number)
    response_time_ms = (received_at_ms - session["sent_at_ms"]) if session else 30_000

    # SMS has no keystroke data — use neutral typing defaults
    sentiment  = analyze_sentiment(body)
    typing     = analyze_typing(typing_wpm=45, error_rate=0)
    temporal   = analyze_temporal(response_time_ms)
    linguistic = analyze_linguistic(body)

    score = min(100, round(
        (1 - sentiment["sentiment_score"]) * 40
        + typing["burnout_contribution"]
        + temporal["burnout_contribution"]
        + linguistic["burnout_contribution"],
        1,
    ))

    if score < 30:
        emoji, label = "🟢", "Systems Normal"
    elif score < 65:
        emoji, label = "🟡", "Check In Recommended"
    else:
        emoji, label = "🔴", "Alert: Take Action"

    flags = sentiment["flags"] + linguistic["linguistic_flags"]
    if "exhaustion_language" in flags:
        hint = "Try a 10-minute break before your next task."
    elif "high_negation" in flags:
        hint = "Write down one thing that went well today."
    elif "avoidant_future_focus" in flags:
        hint = "Focus on one small, completable task right now."
    elif score >= 65:
        hint = "Reach out to someone you trust today."
    else:
        hint = "Keep it up — small things add up."

    return f"{emoji} Pulse: {round(score)}/100 — {label}\n{hint}"
