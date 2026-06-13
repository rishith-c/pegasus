"""HTTP client for Dhruva's signal-processing service (localhost:8002).

Every function raises on transport/HTTP error; callers decide how to degrade.
"""
import httpx

from config import SERVICE_TIMEOUT, SIGNAL_SERVICE_URL


async def analyze(user_id, response_text, response_time_ms, typing_wpm, error_rate) -> dict:
    payload = {
        "user_id": user_id,
        "response_text": response_text,
        "response_time_ms": response_time_ms,
        "typing_wpm": typing_wpm,
        "error_rate": error_rate,
    }
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        r = await client.post(f"{SIGNAL_SERVICE_URL}/analyze", json=payload)
        r.raise_for_status()
        return r.json()


async def get_signals(user_id: str) -> dict:
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        r = await client.get(f"{SIGNAL_SERVICE_URL}/signals/{user_id}")
        r.raise_for_status()
        return r.json()


async def send_alert(user_id, phone, score, level, intervention) -> dict:
    payload = {
        "user_id": user_id,
        "phone": phone,
        "score": score,
        "level": level,
        "intervention": intervention,
    }
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        r = await client.post(f"{SIGNAL_SERVICE_URL}/alert", json=payload)
        r.raise_for_status()
        return r.json()
