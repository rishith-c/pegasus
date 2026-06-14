"""HTTP client for Rishith's ML/TRIBE service (localhost:8003).

Functions raise on transport/HTTP error; callers decide how to degrade.
"""
import httpx

from config import ML_SERVICE, SERVICE_TIMEOUT


async def score(user_id: str, stimulus_id: str, signals: dict) -> dict:
    payload = {"user_id": user_id, "stimulus_id": stimulus_id, "signals": signals}
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        res = await client.post(f"{ML_SERVICE}/score", json=payload)
        res.raise_for_status()
        return res.json()


async def get_baseline(stimulus_id: str) -> dict:
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        res = await client.get(f"{ML_SERVICE}/baseline/{stimulus_id}")
        res.raise_for_status()
        return res.json()
