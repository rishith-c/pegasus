"""SQLite persistence for Pegasus backend. Stdlib only, no ORM."""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from typing import Dict, List, Optional

DB_PATH = os.getenv("PEGASUS_DB", os.path.join(os.path.dirname(__file__), "pegasus.db"))


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                name    TEXT NOT NULL,
                phone   TEXT
            );
            CREATE TABLE IF NOT EXISTS checkins (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      TEXT NOT NULL,
                stimulus_id  TEXT,
                score        INTEGER,
                level        TEXT,
                deviation    REAL,
                signal_json  TEXT,
                intervention_json TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


def create_user(name: str, phone: Optional[str]) -> Dict:
    user_id = uuid.uuid4().hex[:12]
    with _conn() as c:
        c.execute(
            "INSERT INTO users (user_id, name, phone) VALUES (?, ?, ?)",
            (user_id, name, phone),
        )
    return {"user_id": user_id, "name": name, "phone": phone}


def get_user(user_id: str) -> Optional[Dict]:
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def save_checkin(user_id: str, stimulus_id: str, score: Dict, signal: Dict, intervention: Dict) -> None:
    with _conn() as c:
        c.execute(
            """INSERT INTO checkins
               (user_id, stimulus_id, score, level, deviation, signal_json, intervention_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                stimulus_id,
                score.get("score"),
                score.get("level"),
                score.get("deviation"),
                json.dumps(signal),
                json.dumps(intervention),
            ),
        )


def get_history(user_id: str, limit: int = 30) -> List[Dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM checkins WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["signal"] = json.loads(d.pop("signal_json") or "{}")
        d["intervention"] = json.loads(d.pop("intervention_json") or "{}")
        out.append(d)
    return out
