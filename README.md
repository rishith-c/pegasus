# pegasus

A mental-health **check engine light**. A daily stimulus goes to the user →
they respond (text + typing/timing) → **TRIBE v2** predicts how a *healthy*
brain responds to that stimulus → we score the deviation from the user's actual
behavioral signal → 🟢/🟡/🔴 + a Claude intervention → SMS alert if red.

```
frontend (Wesley)  React          :3000   ── talks only to backend
backend  (Jason)   FastAPI+SQLite :8001   ── orchestrator, fans out ↓
signals  (Dhruva)  FastAPI        :8002   ── sentiment + typing + Twilio
ml       (Rishith) FastAPI+TRIBE  :8003   ── predict · combined 4-stream score
video    (Rishith) MediaPipe+Whisper :8004 ── facial + voice stress (check-in)
imessage (TBD)     AppleScript + chat.db   ── optional iMessage delivery (macOS)
```

## Quickstart

```bash
./dev.sh            # sets up venvs + node_modules on first run, then starts all 4
# → http://localhost:3000
```

Optional iMessage channel (macOS only): see [`imessage/README.md`](imessage/README.md).

API contract: [`shared/contract.md`](shared/contract.md). Agent rules:
[`AGENTS.md`](AGENTS.md) (root) + one per folder. Dispatchable subagents live in
`.claude/agents/`.

## Branching model

```
main (protected — NEVER push directly)
 └── dev (integration branch — PRs only)
      ├── feat/rishith-ml      → /ml/*
      ├── feat/wesley-ui       → /frontend/*
      ├── feat/jason-api       → /backend/*, /shared/*
      └── feat/dhruva-sig      → /signals/*
```

## Ownership

| Branch            | Owner   | Scope                  |
| ----------------- | ------- | ---------------------- |
| `feat/rishith-ml` | Rishith | `ml/`                  |
| `feat/wesley-ui`  | Wesley  | `frontend/`            |
| `feat/jason-api`  | Jason   | `backend/`, `shared/`  |
| `feat/dhruva-sig` | Dhruva  | `signals/`             |

## Rules

- `main` is protected. No direct pushes. Releases only via PR from `dev`.
- `dev` is the integration branch. Feature branches PR into `dev`.
- Stay in your lane: only touch the directories listed for your branch.
- Rebase or merge `dev` into your feature branch regularly to stay current.
