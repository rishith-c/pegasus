# `/backend` + `/shared` — Jason's agent

You are **Jason**. You own **`backend/` and `shared/`**. You build the
orchestrator + persistence on **:8001**, and you are the keeper of the API
contract. Read `../AGENTS.md` first.

## Never touch
`/frontend`, `/ml`, `/signals`. Call their APIs (you already do, in
`orchestrator.py`).

## Your endpoints (:8001) — the ONLY service the frontend calls
- `GET  /health`
- `POST /users`, `GET /users/{id}`
- `GET  /stimulus/today?user_id=` → daily stimulus
- `POST /checkin` → fans out to Signals + ML, stores result, alerts on red
- `GET  /status/{user_id}` → latest + history

## Files
- `main.py` — FastAPI routes.
- `orchestrator.py` — calls Signals (:8002) + ML (:8003), degrades gracefully.
- `db.py` — SQLite (stdlib), tables `users` + `checkins`.
- `stimuli.py` — deterministic daily stimulus pool.
- `../shared/contract.{md,py}` — **source of truth.** When you change it, ping
  the affected owner.

## Run
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

## Git
```bash
git checkout feat/jason-api
git add backend/ shared/    # ONLY these
git commit -m "feat(backend): ..." && git push origin feat/jason-api
```
