"""Pegasus iMessage bridge — closes the loop over iMessage on macOS.

  stimulus out  →  user replies in iMessage  →  /checkin  →  intervention back

Talks ONLY to the backend's public API (:8001). Standalone service; owner TBD.

Commands:
  python bridge.py register "+15551234567" "Alex"   # register a phone
  python bridge.py send-daily                        # push today's stimulus to all
  python bridge.py send "+15551234567" "hi"          # raw test send
  python bridge.py listen                            # poll for replies, score, reply

Env (see .env.example): BACKEND_URL, POLL_SECONDS, AUTO_REGISTER.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

import imessage
import registry

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "5"))
AUTO_REGISTER = os.getenv("AUTO_REGISTER", "1") == "1"
STATE_PATH = Path(__file__).with_name(".state.json")

LIGHT = {"green": "🟢", "yellow": "🟡", "red": "🔴"}


def _state() -> dict:
    return json.loads(STATE_PATH.read_text()) if STATE_PATH.exists() else {}


def _save_state(s: dict) -> None:
    STATE_PATH.write_text(json.dumps(s))


def _today_stimulus(user_id: str) -> dict:
    r = httpx.get(f"{BACKEND_URL}/stimulus/today", params={"user_id": user_id}, timeout=15)
    r.raise_for_status()
    return r.json()


# --- commands --------------------------------------------------------------
def cmd_register(phone: str, name: str) -> None:
    uid = registry.register(phone, name)
    print(f"registered {phone} -> user_id {uid}")


def cmd_send(phone: str, message: str) -> None:
    imessage.send(phone, message)
    print(f"sent to {phone}")


def cmd_send_daily() -> None:
    users = registry.all_users()
    if not users:
        print("no registered users — run `register` first.")
        return
    for phone, info in users.items():
        s = _today_stimulus(info["user_id"])
        body = f"{s['content']}\n\n{s['prompt']}"
        imessage.send(phone, body)
        print(f"daily stimulus → {phone}")


def _handle_reply(phone: str, text: str) -> None:
    user_id = registry.get_user_id(phone)
    if not user_id:
        if not AUTO_REGISTER:
            print(f"ignoring unknown sender {phone}")
            return
        user_id = registry.register(phone)
        print(f"auto-registered {phone} -> {user_id}")

    stimulus = _today_stimulus(user_id)
    # iMessage can't capture keystroke dynamics, so typing metrics are 0 —
    # scoring leans on text sentiment via the signals service.
    resp = httpx.post(f"{BACKEND_URL}/checkin", json={
        "user_id": user_id,
        "stimulus_id": stimulus["stimulus_id"],
        "text_response": text,
        "response_time_ms": 0, "typing_wpm": 0, "error_rate": 0,
    }, timeout=60)
    resp.raise_for_status()
    result = resp.json()

    light = LIGHT.get(result["level"], "")
    iv = result.get("intervention", {})
    reply = f"{light} score {result['score']}/100\n{iv.get('message','')}\n↳ {iv.get('suggested_action','')}"
    imessage.send(phone, reply)
    print(f"check-in {phone}: {result['level']} ({result['score']}) → replied")


def cmd_listen() -> None:
    state = _state()
    last = state.get("last_rowid")
    if last is None:
        last = imessage.max_rowid()  # don't replay history on first run
        _save_state({"last_rowid": last})
        print(f"listening from rowid {last} (every {POLL_SECONDS}s). Ctrl-C to stop.")

    while True:
        try:
            new = imessage.fetch_new(last)
            for msg in new:
                last = msg["rowid"]
                try:
                    _handle_reply(msg["handle"], msg["text"])
                except Exception as e:
                    print(f"  ! failed to handle msg from {msg['handle']}: {e}")
                _save_state({"last_rowid": last})
        except Exception as e:
            print(f"  ! poll error: {e}")
        time.sleep(POLL_SECONDS)


def main() -> None:
    p = argparse.ArgumentParser(prog="bridge")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("register"); r.add_argument("phone"); r.add_argument("name", nargs="?", default="iMessage User")
    s = sub.add_parser("send"); s.add_argument("phone"); s.add_argument("message")
    sub.add_parser("send-daily")
    sub.add_parser("listen")
    args = p.parse_args()

    if args.cmd == "register":
        cmd_register(args.phone, args.name)
    elif args.cmd == "send":
        cmd_send(args.phone, args.message)
    elif args.cmd == "send-daily":
        cmd_send_daily()
    elif args.cmd == "listen":
        try:
            cmd_listen()
        except KeyboardInterrupt:
            sys.exit(0)


if __name__ == "__main__":
    main()
