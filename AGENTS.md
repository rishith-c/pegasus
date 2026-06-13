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

## The 45-minute sync (safe — never reverts or deletes)

> **NON-NEGOTIABLE:** no sync step may ever revert, overwrite, or delete anyone's committed, staged, or uncommitted work. If a command risks that, **stop and `git merge --abort`** — drift is recoverable, lost work is not.

**Quick path:** run `./sync.sh` from the repo root — it does the whole safe local half (backup → push → ff-only dev → merge dev in) and refuses to do anything destructive. Then open/merge your PR on GitHub. The manual steps below are what it runs.

```bash
# Run from repo root, on YOUR feature branch (feat/<you>). Replace owned paths with yours.
# Rishith owns: ml/ video/ frontend/src/services/ frontend/src/hooks/ frontend/src/types/

# 1. COMMIT your work first — stage ONLY your owned paths (never git add . / -A)
git add -- ml/ video/ frontend/src/services/ frontend/src/hooks/ frontend/src/types/
git status                                  # verify ONLY your paths are staged
git commit -m "sync: <what you did>"        # skip only if nothing is staged

# 2. BACKUP branch BEFORE touching dev (your recovery point) — plain push, never force
#    NOTE: a git branch backup canNOT capture gitignored/untracked files (e.g. .env).
#    If dev introduces a tracked file at a path where you keep an untracked one, see the
#    .env warning below and move yours aside FIRST.
git branch    "backup/feat-<you>-$(date +%Y%m%d-%H%M%S)"
git push origin "backup/feat-<you>-$(date +%Y%m%d-%H%M%S)"

# 3. PUSH your feature branch (plain push only — NEVER --force / --force-with-lease)
git push origin feat/<you>
#    → on GitHub: open / MERGE the PR  feat/<you> → dev  (PR only; never push to dev/main)
#    → use "Create a merge commit" — NOT squash / rebase-merge (keeps SHAs stable for the team)

# 4. Update local dev FAST-FORWARD-ONLY (cannot rewrite or diverge), then go back
git fetch origin --prune
git checkout dev
git pull --ff-only origin dev               # if this FAILS, dev diverged: do NOT force — just skip it this round
git checkout feat/<you>

# 5. MERGE dev INTO your branch (the only real merge), then push the result.
#    Disable rerere for THIS merge so a previously-learned one-sided resolution
#    can never be silently replayed and drop a teammate's side (see warning below).
git -c rerere.enabled=false -c rerere.autoupdate=false merge --no-ff dev
git push origin feat/<you>                  # plain push; open another PR if it brought in mergeable work
```

**Never do this (it can delete a teammate's work):**
- **`git push --force` / `--force-with-lease`** — on any branch. Plain `git push` only; brand-new backup refs only.
- **`git reset --hard`** (incl. `reset --hard origin/...`, `@{u}`) — unrecoverable loss of working tree + unpushed commits.
- **`git clean -fd` / `-fdx`** — deletes untracked files and gitignored `.env` keys with no recovery.
- **`git checkout --theirs` / `--ours`** (or `merge -X theirs/ours`) — silently drops one author's whole side.
- **`git checkout -- <path>` / `git restore` / `git checkout .` to "clean up"** — discards uncommitted edits.
- **`git add .` / `git add -A`** — stage every owned path explicitly; never touch another lane.
- **`git stash drop` / `clear`, `git rebase --skip`** — delete work outright. Use `git stash apply` and `git rebase --abort`.
- **`git branch -D feat/<you>` before its PR merges** — discards commits that only live on that branch.
- **Pushing directly to `dev` or `main`** — integration is PRs only; `main` is protected.

**Two silent ways work can vanish even WITHOUT any banned command — guard against both:**
- **`git rerere` (resolve-recorded-resolution).** If your *global* git config has `rerere.enabled true` **and** `rerere.autoupdate true`, then the second time the SAME conflict appears (e.g. after you `git merge --abort` and re-sync, or re-sync after discarding an unpushed merge) git will **silently re-apply your earlier resolution and auto-stage it**. If that earlier resolution was one-sided, the file ends up containing only your side — **with NO conflict markers** — and `git diff --name-only --diff-filter=U` is **empty**. An empty diff-filter is therefore **NOT proof the merge is safe**; it can mean rerere dropped the teammate's side. `sync.sh` runs its merge with `-c rerere.enabled=false -c rerere.autoupdate=false` so this can't happen through the script. If you ever merge by hand, do the same, and after any conflict **open each previously-conflicted file and confirm the teammate's lines from dev are still there** before `git commit --no-edit`.
- **A merge overwriting a gitignored/untracked file (e.g. `.env`).** Your real `.env` secrets are gitignored, so they live in **no git object and no branch backup**. If a teammate force-committed a tracked file at that same path into dev, merging dev in will **silently overwrite your local `.env`** on disk with their version — no conflict, no warning, and `git merge --abort` can't help because the merge "succeeds". `sync.sh` detects this (it compares `git diff --name-only HEAD origin/dev` against files that exist on disk but git isn't tracking) and **refuses to merge**, telling you to move the file aside first. If you merge by hand, `cp .env .env.local.bak` before the merge and reconcile afterward.

**Conflict? Keep BOTH sides, or run `git merge --abort` — both are safe, nothing is lost.**

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
