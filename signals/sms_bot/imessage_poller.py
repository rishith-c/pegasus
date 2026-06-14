"""Inbound iMessage reader — the local stand-in for Bloo.io's webhook.

Bloo.io delivered the user's replies to us via webhook. Without it (free trial
out of credits), we instead poll the Mac's Messages database
(~/Library/Messages/chat.db) for the user's incoming replies and route them
through the SAME scoring + companion pipeline (handle_incoming_sms); responses
go back out over the Mac's iMessage.

Needs Full Disk Access for this process (System Settings → Privacy & Security →
Full Disk Access → enable your terminal). Degrades to a logged no-op without it.
We distinguish the user's replies from Pegasus's own outbound by excluding text
we just sent (see alerts.twilio_sms.recently_sent), so it works whether the Mac
is on the same Apple ID or a separate "Pegasus" account.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sqlite3
from pathlib import Path

from sms_bot.webhook import handle_incoming_sms

log = logging.getLogger("signals.imessage")

DB = str(Path.home() / "Library" / "Messages" / "chat.db")
POLL_SECS = float(os.getenv("IMESSAGE_POLL_SECS", "3"))

_last_rowid = 0
_started = False


def _digits(s: str) -> str:
    return "".join(c for c in (s or "") if c.isdigit())[-10:]


def _connect():
    return sqlite3.connect(f"file:{DB}?mode=ro&immutable=1", uri=True, timeout=3)


def available() -> bool:
    try:
        con = _connect()
        con.execute("SELECT 1 FROM message LIMIT 1")
        con.close()
        return True
    except Exception:
        return False


def _max_rowid() -> int:
    try:
        con = _connect()
        row = con.execute("SELECT COALESCE(MAX(ROWID), 0) FROM message").fetchone()
        con.close()
        return int(row[0]) if row else 0
    except Exception:
        return 0


def _fetch_new(registered: set) -> list:
    """New text messages (since the last poll) in chats with a registered phone."""
    global _last_rowid
    out = []
    try:
        con = _connect()
        cur = con.execute(
            "SELECT m.ROWID, m.text, h.id "
            "FROM message m LEFT JOIN handle h ON m.handle_id = h.ROWID "
            "WHERE m.ROWID > ? ORDER BY m.ROWID ASC",
            (_last_rowid,),
        )
        for rowid, text, handle in cur.fetchall():
            _last_rowid = max(_last_rowid, rowid)
            if not text or not text.strip():
                continue
            if _digits(handle) not in registered:
                continue
            out.append((handle or "", text.strip()))
        con.close()
    except Exception as e:
        log.warning("chat.db read failed: %s", e)
    return out


async def _loop():
    global _last_rowid
    _last_rowid = _max_rowid()  # only act on messages that arrive from now on
    log.info("iMessage inbound poller running (from ROWID %s).", _last_rowid)
    from alerts.twilio_sms import USER_PHONES, recently_sent

    while True:
        await asyncio.sleep(POLL_SECS)
        try:
            registered = {_digits(p) for p in USER_PHONES.values() if p}
            if not registered:
                continue
            for handle, text in _fetch_new(registered):
                if recently_sent(text):
                    continue  # our own outbound, echoed in the thread
                log.info("inbound iMessage from %s: %r", handle, text[:60])
                await handle_incoming_sms(handle, text)
        except Exception as e:
            log.warning("poller loop error: %s", e)


def start() -> None:
    """Start the background poller if chat.db is reachable."""
    global _started
    if _started:
        return
    if not available():
        log.info("iMessage inbound poller DISABLED — no chat.db access "
                 "(grant Full Disk Access to read incoming replies).")
        return
    _started = True
    try:
        asyncio.create_task(_loop())
    except RuntimeError:
        _started = False  # no running loop yet
