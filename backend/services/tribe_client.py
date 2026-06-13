"""HTTP client for Rishith's ML/TRIBE service (localhost:8003).

Every function raises on transport/HTTP error; callers decide how to degrade.
"""
import httpx

from config import ML_SERVICE_URL, SERVICE_TIMEOUT


async def score(user_id: str, stimulus_id: str, signals: dict) -> dict:
    payload = {"user_id": user_id, "stimulus_id": stimulus_id, "signals": signals}
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        r = await client.post(f"{ML_SERVICE_URL}/score", json=payload)
        r.raise_for_status()
        return r.json()


async def predict(stimulus_path: str, modality: str) -> dict:
    payload = {"stimulus_path": stimulus_path, "modality": modality}
    async with httpx.AsyncClient(timeout=SERVICE_TIMEOUT) as client:
        r = await client.post(f"{ML_SERVICE_URL}/predict", json=payload)
        r.raise_for_status()
        return r.json()
