"""Maps phone numbers <-> backend user_ids, persisted to registry.json.

Auto-registers unknown phones as backend users on first contact so anyone can
text the bot and start checking in.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Dict, Optional

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
REGISTRY_PATH = Path(__file__).with_name("registry.json")


def _norm(phone: str) -> str:
    """Normalize a handle to digits (+ optional leading +) so '+1 (555) 123'
    and '+15551230000' match."""
    phone = phone.strip()
    if "@" in phone:  # email handle — keep as-is
        return phone.lower()
    digits = re.sub(r"[^\d]", "", phone)
    return f"+{digits}" if digits else phone


def _load() -> Dict[str, Dict]:
    if REGISTRY_PATH.exists():
        return json.loads(REGISTRY_PATH.read_text())
    return {}


def _save(data: Dict[str, Dict]) -> None:
    REGISTRY_PATH.write_text(json.dumps(data, indent=2))


def all_users() -> Dict[str, Dict]:
    return _load()


def get_user_id(phone: str) -> Optional[str]:
    return _load().get(_norm(phone), {}).get("user_id")


def register(phone: str, name: str = "iMessage User") -> str:
    """Ensure a backend user exists for this phone; return its user_id."""
    key = _norm(phone)
    data = _load()
    if key in data:
        return data[key]["user_id"]

    resp = httpx.post(f"{BACKEND_URL}/users", json={"name": name, "phone": key}, timeout=15)
    resp.raise_for_status()
    user_id = resp.json()["user_id"]

    data[key] = {"user_id": user_id, "name": name}
    _save(data)
    return user_id
