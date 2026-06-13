from sms_bot.bot import send_daily_pulse_check


async def trigger_checkin(user_id: str, phone: str) -> dict:
    sid = await send_daily_pulse_check(user_id, phone)
    return {"sent": True, "sid": sid}
