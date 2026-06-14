"""Conversational reminders. When the user tells the agent "remind me to take a
break in 15 minutes" (by text or in the voice call), we parse the delay + task
and schedule an SMS that actually fires after that delay.

Lives in signals because this is where SMS sending happens. Never raises.
"""
from __future__ import annotations

import asyncio
import re
from typing import Optional, Tuple

from alerts.twilio_sms import send_sms

_UNIT_SECONDS = {
    "second": 1, "seconds": 1, "sec": 1, "secs": 1,
    "minute": 60, "minutes": 60, "min": 60, "mins": 60,
    "hour": 3600, "hours": 3600, "hr": 3600, "hrs": 3600,
}
_NUM_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "ten": 10, "fifteen": 15, "twenty": 20, "thirty": 30, "forty-five": 45, "sixty": 60,
}

_INTENT_RE = re.compile(r"\b(?:remind|text|message|ping|nudge)\s+me\b", re.I)
_TIME_RE = re.compile(
    r"\bin\s+(\d+|a|an|one|two|three|four|five|ten|fifteen|twenty|thirty|forty-five|sixty)\s*"
    r"(seconds?|secs?|sec|minutes?|mins?|min|hours?|hrs?|hr)\b",
    re.I,
)
_TASK_RE = re.compile(r"\bto\s+(.+?)(?:\s+in\s+\S+\s+(?:sec|min|hour|hr)|[.!?]|$)", re.I)


def parse_reminder(text: str) -> Optional[Tuple[int, str]]:
    """(delay_seconds, task) if `text` asks for a reminder, else None."""
    if not text or not _INTENT_RE.search(text):
        return None
    tm = _TIME_RE.search(text)
    if not tm:
        return None
    num_raw, unit = tm.group(1).lower(), tm.group(2).lower()
    num = int(num_raw) if num_raw.isdigit() else _NUM_WORDS.get(num_raw, 1)
    secs = _UNIT_SECONDS.get(unit) or _UNIT_SECONDS.get(unit.rstrip("s")) or 60
    delay = max(10, num * secs)

    tk = _TASK_RE.search(text)
    task = (tk.group(1).strip() if tk else "take a break").rstrip(".!?, ")
    if not task or len(task) > 80:
        task = "take a break"
    return delay, task


def human_delay(delay: int) -> str:
    if delay >= 3600:
        h = delay / 3600
        h = int(h) if h == int(h) else round(h, 1)
        return f"{h} hour" + ("s" if h != 1 else "")
    if delay >= 60:
        m = round(delay / 60)
        return f"{m} minute" + ("s" if m != 1 else "")
    return f"{delay} seconds"


async def _fire(phone: str, delay: int, task: str) -> None:
    await asyncio.sleep(delay)
    send_sms(phone, f"⏰ Reminder: {task}. You asked me to nudge you — take a moment for yourself. 🌱")


def schedule_reminder(phone: str, delay: int, task: str) -> bool:
    """Fire-and-forget an SMS after `delay` seconds. True if scheduled."""
    try:
        asyncio.create_task(_fire(phone, delay, task))
        return True
    except RuntimeError:
        return False
