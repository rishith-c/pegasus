# Pegasus — Agent Rules (root)

Read this, then read the `AGENTS.md` in **your** folder. Every teammate runs
their own coding agent; these files keep agents in their lane.

## What Pegasus is
A mental-health "check engine light." Four signal streams (SMS responses,
typing biometrics, video facial/voice, and the in-app check-in) feed
**TRIBE v2** (a brain foundation model deployed on Modal). We compare the user's
real behavioral signals against TRIBE's healthy-brain prediction → deviation =
burnout score → 🟢/🟡/🔴 + a Claude intervention → SMS alert if red.

## Team & services
| Owner   | Folder(s)                                   | Port(s)        |
|---------|---------------------------------------------|----------------|
| Rishith | frontend **data layer** + `ml/` + `video/`  | 3000, 8003, 8004 |
| Wesley  | frontend **screens/components**             | 3000           |
| Jason   | `backend/` + `shared/`                      | 8001           |
| Dhruva  | `signals/` (Twilio SMS bot + alerts)        | 8002           |

`frontend/` is an **Expo** app shared by Rishith (services/hooks/types) and
Wesley (App.tsx/screens/components/navigation/utils) — see `frontend/AGENTS.md`.
`imessage/` is a legacy macOS bridge, **superseded by Twilio SMS in `signals/`**.

## The 5 rules (non-negotiable)
1. **Stay in your files.** Only edit what you own (table above + per-folder
   AGENTS.md). Need something from another area? **Call its API / import it — never edit it.**
2. **The contract is law.** `shared/contract.md` is the source of truth. Need a
   field changed? Jason changes it there first, then tells the owner.
3. **Branch + PR.** Work on `feat/<you>-*`, PR into `dev`. Never push to `main`.
   Stage only your files — never `git add .` / `git add -A`.
4. **Stay runnable.** Your service must start on its port and answer `GET /health`.
5. **Sync every ~45 min** (below) so integration never drifts far.

## The 45-minute sync (everyone, every ~45 min)
```bash
# 1. Push your work + open/merge a PR into dev
git add YOUR_FILES_ONLY/        # e.g. Rishith: ml/ video/ frontend/src/{services,hooks,types}/
git commit -m "feat: what you did"
git push origin feat/<you>
#    → open PR feat/<you> → dev on GitHub, merge it

# 2. Pull everyone else's merged work back into your branch
git checkout dev && git pull origin dev
git checkout feat/<you> && git merge dev
# keep building
```

## Secrets
Each service reads keys from a `.env` in its folder (gitignored). NEVER commit
`.env` or put keys in code. Templates: `*/.env.example`.

## Run locally
```bash
./dev.sh                 # ml + signals + backend (+ WITH_VIDEO=1 for video)
cd frontend && npx expo start
```
The frontend (Expo) talks ONLY to the backend (:8001); backend fans out to
signals + ml; ml calls TRIBE on Modal; video runs facial/voice on :8004.
