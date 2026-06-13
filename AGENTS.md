# Pegasus — Agent Rules (root)

Read this, then read the `AGENTS.md` in **your** folder. Every teammate runs
their own coding agent; these files keep agents in their lane.

## What Pegasus is
A mental-health "check engine light." A daily stimulus is sent to the user →
they respond (text + typing/timing) → **TRIBE v2** predicts how a *healthy*
brain responds to that stimulus → we score the deviation between healthy
prediction and the user's real behavioral signal → 🟢/🟡/🔴 + a Claude
intervention → SMS alert if red.

## Services
| Folder      | Owner   | Stack              | Port |
|-------------|---------|--------------------|------|
| `frontend/` | Wesley  | React (Vite)       | 3000 |
| `backend/`  | Jason   | FastAPI + SQLite   | 8001 |
| `signals/`  | Dhruva  | FastAPI            | 8002 |
| `ml/`       | Rishith | FastAPI + TRIBE v2 | 8003 |
| `shared/`   | Jason   | API contract       | —    |
| `imessage/` | TBD     | macOS iMessage bridge (AppleScript + chat.db) | — |

## The 5 rules (non-negotiable)
1. **Stay in your folder.** Only edit the folder(s) you own (table above).
   Need something from another folder? **Call its API or import it — never edit it.**
2. **The contract is law.** `shared/contract.md` is the single source of truth.
   Need a field changed? Change it there first (Jason), then tell the owner.
3. **Branch + PR.** Work on `feat/<you>-*`, PR into `dev`. Never push to `main`.
   Stage only your folder: `git add ml/` — never `git add .`.
4. **Stay runnable.** Your service must start on its port and answer `GET /health`.
5. **Merge to `dev` every ~45 min** so integration never drifts far.

## Run everything
```bash
./dev.sh            # starts all 4 services (see script for per-service commands)
```
Backend is the only service the frontend talks to; backend fans out to signals + ml.
