"""Load the canonical stimulus manifest from shared/stimuli.json."""
import json
import os
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
