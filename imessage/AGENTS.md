# `/imessage` — iMessage bridge (owner: TBD)

A **standalone** delivery channel. Not one of the four service lanes — assign
an owner before serious work. Read `../AGENTS.md` and `../shared/contract.md`.

## Boundary
You may ONLY edit `imessage/`. Never touch `frontend/`, `backend/`, `ml/`,
`signals/`, `shared/`. The bridge talks to the **backend only** (`:8001`):
- `POST /users` (register a phone)
- `GET /stimulus/today?user_id=` (what to send)
- `POST /checkin` (score a reply)

## What it does (macOS-only)
- **Send** via AppleScript → Messages.app (`send.applescript`, `imessage.send`).
- **Receive** by polling `~/Library/Messages/chat.db` (`imessage.fetch_new`).
- `bridge.py` is the CLI/loop: `register`, `send`, `send-daily`, `listen`.
- `registry.py` maps phone ⇄ backend user_id.

## Run
See `README.md`. Needs Full Disk Access + signed-in iMessage on the Mac.

## Git
```bash
git add imessage/     # ONLY imessage/
git commit -m "feat(imessage): ..."
```
