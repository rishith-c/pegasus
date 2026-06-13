"""Load the app-facing stimulus manifest from shared/stimuli.json."""
import hashlib
import json
import os
from datetime import date
from functools import lru_cache

from config import SHARED_DIR


@lru_cache(maxsize=1)
def _load() -> list[dict]:
    path = os.path.join(SHARED_DIR, "stimuli.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("stimuli", [])


def all_stimuli() -> list[dict]:
    return list(_load())


def get_stimulus(stimulus_id: str) -> dict | None:
    for s in _load():
        if s["id"] == stimulus_id:
            return s
    return None


def stimulus_for_today(user_id: str) -> dict:
    """Deterministic daily rotation per user (same stimulus all day = stable demo)."""
    items = _load()
    if not items:
        raise RuntimeError("stimulus manifest is empty")
    key = f"{user_id}:{date.today().isoformat()}".encode()
    idx = int(hashlib.sha256(key).hexdigest(), 16) % len(items)
    return items[idx]
