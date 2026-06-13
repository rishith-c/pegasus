"""HTTP client for Dhruva's signal-processing service (localhost:8002).

Functions raise on transport/HTTP error; callers decide how to degrade.
NOTE: the live alert endpoint is POST /alert and REQUIRES `phone`.
"""
import httpx

from config import SERVICE_TIMEOUT, SIGNAL_SERVICE


async def analyze(data: dict) -> dict:
    """data: { user_id, response_text, response_time_ms, typing_wpm, error_rate }"""
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        res = await client.post(f"{SIGNAL_SERVICE}/analyze", json=data)
        res.raise_for_status()
        return res.json()


async def get_signals(user_id: str) -> dict:
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        res = await client.get(f"{SIGNAL_SERVICE}/signals/{user_id}")
        res.raise_for_status()
        return res.json()


async def send_alert(user_id: str, phone: str, score, level: str, intervention: str) -> dict:
    payload = {
        "user_id": user_id,
        "phone": phone,
        "score": score,
        "level": level,
        "intervention": intervention,
    }
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        res = await client.post(f"{SIGNAL_SERVICE}/alert", json=payload)
        res.raise_for_status()
        return res.json()
