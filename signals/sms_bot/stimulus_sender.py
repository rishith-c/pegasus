from sms_bot.bot import send_daily_pulse_check


async def trigger_checkin(user_id: str, phone: str) -> dict:
    sid = await send_daily_pulse_check(user_id, phone)
    ok = not sid.startswith(("send_failed", "payment_required", "noop"))
    detail = (
        "Bloo.io credits exhausted (free trial) — add credits to send texts."
        if sid.startswith("payment_required") else
        "SMS provider unavailable." if sid.startswith("send_failed") else
        "No BLOOIO_API_KEY set." if sid.startswith("noop") else None
    )
    return {"sent": ok, "sid": sid, **({"detail": detail} if detail else {})}
