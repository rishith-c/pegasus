"""iMessage send/receive on macOS — no API, just Messages.app + chat.db.

Send:    drives Messages.app via AppleScript (osascript).
Receive: reads ~/Library/Messages/chat.db (read-only) for new inbound rows.

Requires (on the Mac running this):
  - signed into iMessage in Messages.app, app allowed to run
  - **Full Disk Access** for whatever runs this (Terminal / python) so it can
    read chat.db (System Settings → Privacy & Security → Full Disk Access)
"""
from __future__ import annotations

import os
import sqlite3
import subprocess
from pathlib import Path
from typing import List, Optional, TypedDict

CHAT_DB = Path(os.path.expanduser("~/Library/Messages/chat.db"))
SEND_SCRIPT = Path(__file__).with_name("send.applescript")


class InboundMessage(TypedDict):
    rowid: int
    handle: str  # sender phone/email
    text: str


# --- send ------------------------------------------------------------------
def send(phone: str, message: str) -> None:
    """Send an iMessage. Raises subprocess.CalledProcessError on failure."""
    subprocess.run(
        ["osascript", str(SEND_SCRIPT), phone, message],
        check=True,
        capture_output=True,
        text=True,
    )


# --- receive ----------------------------------------------------------------
def _connect_ro() -> sqlite3.Connection:
    # Open read-only so we never lock the live Messages database.
    conn = sqlite3.connect(f"file:{CHAT_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def max_rowid() -> int:
    with _connect_ro() as c:
        row = c.execute("SELECT MAX(ROWID) AS m FROM message").fetchone()
    return int(row["m"] or 0)


def fetch_new(after_rowid: int) -> List[InboundMessage]:
    """Return inbound (received) messages with ROWID > after_rowid."""
    query = """
        SELECT m.ROWID AS rowid, m.text AS text, m.attributedBody AS body,
               h.id AS handle
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.is_from_me = 0 AND m.ROWID > ?
        ORDER BY m.ROWID ASC
    """
    out: List[InboundMessage] = []
    with _connect_ro() as c:
        for row in c.execute(query, (after_rowid,)).fetchall():
            text = row["text"]
            if not text and row["body"] is not None:
                text = decode_attributed_body(row["body"])
            if not text or not row["handle"]:
                continue
            out.append({"rowid": int(row["rowid"]), "handle": row["handle"], "text": text})
    return out


def decode_attributed_body(data: bytes) -> Optional[str]:
    """Best-effort extraction of message text from a streamtyped
    NSAttributedString blob (used when the `text` column is NULL on newer
    macOS). Handles the common short/long-string cases; returns None if the
    layout isn't recognized. For 100% fidelity, `pip install typedstream`.
    """
    if not data:
        return None
    try:
        idx = data.index(b"NSString")
    except ValueError:
        return None
    chunk = data[idx + len(b"NSString"):]
    plus = chunk.find(b"+")  # type marker that precedes the length byte
    if plus == -1:
        return None
    p = plus + 1
    if p >= len(chunk):
        return None
    length = chunk[p]
    p += 1
    if length == 0x81:  # 2-byte little-endian length
        length = int.from_bytes(chunk[p:p + 2], "little")
        p += 2
    elif length == 0x82:  # 4-byte little-endian length
        length = int.from_bytes(chunk[p:p + 4], "little")
        p += 4
    raw = chunk[p:p + length]
    text = raw.decode("utf-8", errors="ignore").strip()
    return text or None
