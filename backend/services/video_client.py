"""HTTP client for Rishith's video service (localhost:8004).

Forwards the uploaded video for facial + voice stress analysis.
Raises on transport/HTTP error; the route degrades gracefully.
"""
import httpx

from config import VIDEO_SERVICE, VIDEO_TIMEOUT


async def analyze(video_bytes: bytes, filename: str) -> dict:
    files = {"video": (filename, video_bytes, "video/mp4")}
    async with httpx.AsyncClient(timeout=VIDEO_TIMEOUT) as client:
        res = await client.post(f"{VIDEO_SERVICE}/analyze/video", files=files)
        res.raise_for_status()
        return res.json()
