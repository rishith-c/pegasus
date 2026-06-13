# imessage — the iMessage bridge

Closes the Pegasus loop over real iMessage on macOS, with **no API and no paid
service** — just Messages.app (to send) and `chat.db` (to receive).

```
send-daily ── stimulus ──▶ user's iPhone/Mac
                                │ replies in iMessage
chat.db poll ◀── reply ─────────┘
   └─▶ POST :8001/checkin ─▶ score + intervention ─▶ iMessage reply
```

It talks **only** to the backend (`:8001`). It does not import or edit any other
service.

## One-time Mac setup
1. Sign into **iMessage** in Messages.app on this Mac.
2. Grant **Full Disk Access** to whatever runs the bridge (Terminal, iTerm, or
   your Python) so it can read `~/Library/Messages/chat.db`:
   System Settings → Privacy & Security → **Full Disk Access** → add the app.
3. First time you send, macOS may prompt to allow controlling Messages — allow it.

## Install & run
```bash
cd imessage
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# make sure the backend is up first (port 8001)
python bridge.py register "+15551234567" "Alex"   # register a tester
python bridge.py send-daily                         # text them today's stimulus
python bridge.py listen                             # watch for replies & score them
```

`listen` polls `chat.db` every `POLL_SECONDS`, scores each reply via the
backend, and texts back the 🟢/🟡/🔴 + intervention. It starts from "now" so it
never replays old history; progress is saved in `.state.json`.

## Caveats (it's a local hack, not a product)
- The Mac must stay on and signed into iMessage; it uses **your** account.
- AppleScript send syntax is macOS-version-sensitive — see the note in
  `send.applescript` if `send-daily` errors.
- Newer macOS stores some message text in `attributedBody` (binary), not the
  `text` column. `imessage.decode_attributed_body` handles the common cases;
  `pip install typedstream` if you hit a message it can't read.
- No keystroke dynamics over iMessage, so check-ins score on text sentiment
  (typing metrics are sent as 0).

## Owner
Standalone service — **assign an owner**. It lives outside the four service
lanes; whoever owns it works only inside `imessage/` and against the backend API.
