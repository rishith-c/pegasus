"""Real Meta TRIBE v2 client — calls the deployed Modal FastAPI endpoint.

App `synapse-tribe-v2-api` exposes (via @modal.asgi_app):
    GET  /health
    POST /api/analyze-text   (form field `text`)   -> TribeJsonResponse
    POST /api/analyze-video  (form field `video_url`)

We call it over HTTP (robust — avoids the modal.Cls local-instantiation bug).
`analyze-text` returns:
    { success, total_timesteps, chart_data: [{timestep, Attention, Auditory,
      Emotion, Language, Motor, Visual, overall}, ...], agent_summary, segments }

A "baseline" = TRIBE's healthy-brain response to the stimulus text. We take the
peak (max `overall`) frame, map the six TRIBE macro-groups into the region names
the scorer + Brain screen use, and cache per stimulus_id (TRIBE is GPU-heavy:
~30-90s cold, 2-10s warm — call it once per stimulus).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, Optional

import requests

TRIBE_API = os.getenv(
    "TRIBE_JSON_API",
    "https://rishithchennupati--synapse-tribe-v2-api-fastapi-app.modal.run",
).rstrip("/")
TRIBE_TIMEOUT = float(os.getenv("TRIBE_TIMEOUT", "180"))

_HERE = Path(__file__).resolve().parent
STIMULI = _HERE.parent / "shared" / "stimuli.json"
CACHE = _HERE / "cache" / "baselines.json"

MACRO = ("Attention", "Auditory", "Emotion", "Language", "Motor", "Visual")
_cache: Optional[Dict] = None


def _stimulus_text(stimulus_id: str) -> Optional[str]:
    try:
        data = json.loads(STIMULI.read_text())
    except Exception:
        return None
    items = data if isinstance(data, list) else (data.get("stimuli") or data.get("items") or [])
    for s in items:
        if isinstance(s, dict) and s.get("id") == stimulus_id:
            text = " ".join(str(s.get(k, "")) for k in ("prompt", "content")).strip()
            return text or str(s.get("url") or s.get("id"))
    return None


def _macro_to_regions(frame: Dict) -> Dict[str, float]:
    g = lambda k: float(frame.get(k, 0.0) or 0.0)
    return {
        "prefrontal_cortex": round((g("Attention") + g("Language")) / 2, 3),
        "amygdala_region": round(g("Emotion"), 3),
        "temporal_lobe": round((g("Auditory") + g("Language")) / 2, 3),
        "motor_cortex": round(g("Motor"), 3),
        "visual_cortex": round(g("Visual"), 3),
    }


def _load_cache() -> Dict:
    global _cache
    if _cache is None:
        try:
            _cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
        except Exception:
            _cache = {}
    return _cache


def _save_cache() -> None:
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(_cache, indent=2))
    except OSError:
        pass


def reachable() -> bool:
    try:
        r = requests.get(f"{TRIBE_API}/health", timeout=10)
        return r.ok and bool(r.json().get("ok"))
    except Exception:
        return False


def get_baseline(stimulus_id: str) -> Optional[Dict]:
    """Healthy TRIBE baseline for a stimulus (cached). None if unavailable."""
    cache = _load_cache()
    if stimulus_id in cache:
        return cache[stimulus_id]

    text = _stimulus_text(stimulus_id)
    if not text:
        return None
    try:
        r = requests.post(f"{TRIBE_API}/api/analyze-text", data={"text": text[:4000]}, timeout=TRIBE_TIMEOUT)
        r.raise_for_status()
        resp = r.json()
    except Exception:
        return None
    if not isinstance(resp, dict) or not resp.get("success"):
        return None

    chart = resp.get("chart_data") or []
    if not chart:
        return None
    peak = max(chart, key=lambda f: f.get("overall", 0.0))
    baseline = {
        "stimulus_id": stimulus_id,
        "regions": _macro_to_regions(peak),
        "macro_groups": {k: round(float(peak.get(k, 0.0) or 0.0), 3) for k in MACRO},
        "overall": round(float(peak.get("overall", 0.0) or 0.0), 3),
        "total_timesteps": resp.get("total_timesteps"),
        "agent_summary": resp.get("agent_summary", ""),
        "source": "tribe-v2",
    }
    cache[stimulus_id] = baseline
    _save_cache()
    return baseline
