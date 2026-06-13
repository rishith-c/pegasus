#!/usr/bin/env bash
#
# sync.sh — Pegasus SAFE 45-minute sync (local half).
#
# Runs ONLY the safe, local steps of the cadence and is impossible to use
# destructively. It contains ZERO destructive commands: no reset --hard,
# no clean, no checkout --theirs/--ours, no force-push.
#
# What it does:
#   1. Refuses to run on main or dev.
#   2. Refuses to run if the working tree is dirty (commit your OWNED files
#      first — staging is a human decision, this script never stages for you).
#   3. Refuses to run if updating dev would clobber a gitignored/untracked file
#      that already exists on disk (e.g. your real .env secrets) — git branch
#      backups CANNOT capture ignored content, so we stop instead of losing it.
#   4. Creates a timestamped backup branch as a recovery point BEFORE anything.
#   5. Plain-pushes your feature branch (never --force / --force-with-lease).
#   6. Fetches origin and fast-forward-only updates local dev, then returns
#      you to your feature branch (even if the dev update fails).
#   7. Merges origin/dev INTO your feature branch with git's "rerere" feature
#      NEUTRALIZED, so a previously-learned one-sided resolution can NEVER be
#      silently re-applied and drop a teammate's side. On conflict it prints
#      clear recovery steps and exits non-zero WITHOUT touching your work.
#
# After this script: open/merge your PR feat/<you> -> dev on GitHub, and
# push again if the merge brought in mergeable work.

set -euo pipefail

# --- cd to the script's own directory (repo root) ---------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd -- "$SCRIPT_DIR"

# --- detect current branch --------------------------------------------------
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "HEAD" ]; then
  echo "ABORT: detached HEAD. Check out your feat/<you> branch first." >&2
  exit 1
fi

# --- refuse on protected / integration branches ----------------------------
case "$BRANCH" in
  main|dev)
    echo "ABORT: you are on '$BRANCH'. Never sync from main or dev." >&2
    echo "       Check out your own feature branch: git checkout feat/<you>" >&2
    exit 1
    ;;
esac

echo "Branch: $BRANCH"

# --- safety net: ALWAYS get back to the feature branch on any early exit -----
# If `set -e` (or any error) trips us while we are temporarily on dev, this
# trap returns us to the feature branch. It only ever performs a plain
# checkout (never resets/cleans), so it cannot discard work; if the worktree
# is mid-merge or otherwise can't switch, it leaves a loud note instead.
restore_branch() {
  cur="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  if [ "$cur" != "$BRANCH" ]; then
    if ! git checkout "$BRANCH" 2>/dev/null; then
      echo "WARNING: could not auto-return to '$BRANCH' (now on '$cur')." >&2
      echo "         Run: git checkout $BRANCH" >&2
    fi
  fi
}
trap restore_branch EXIT

# --- refuse if the working tree has uncommitted or staged changes -----------
# Commit-first is non-negotiable. This script never stages or commits for you,
# so that folder ownership stays intact and nothing of yours is touched.
if ! git diff --quiet || ! git diff --cached --quiet || \
   [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "ABORT: working tree is not clean." >&2
  echo "" >&2
  echo "Commit your OWNED files first (stage each path explicitly — never 'git add .'):" >&2
  echo "  git add -- ml/ video/ frontend/src/services/ frontend/src/hooks/ frontend/src/types/" >&2
  echo "  git commit -m \"sync: <what you did>\"" >&2
  echo "" >&2
  echo "Leftover changes outside your lane? Stash them (kept as a backup):" >&2
  echo "  git stash push --include-untracked -m presync" >&2
  echo "Then re-run ./sync.sh" >&2
  exit 1
fi

# --- timestamped backup branch BEFORE anything else -------------------------
# Use a collision-proof name (PID-stamped) so a same-second re-run can't fail,
# under a FLAT namespace that cannot directory/file-conflict with the feature
# branch's own slashed name (feat/<you> -> feat-<you>).
SAFE_BRANCH="$(printf '%s' "$BRANCH" | tr '/' '-')"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="backup/${SAFE_BRANCH}-${TS}-$$"
# Belt and suspenders: if that exact ref somehow exists, bump until it doesn't.
while git show-ref --quiet --verify "refs/heads/${BACKUP}"; do
  BACKUP="${BACKUP}x"
done
echo "Creating backup branch: $BACKUP"
if ! git branch -- "$BACKUP"; then
  echo "ABORT: could not create backup branch '$BACKUP' (name collision?)." >&2
  echo "       Stopping BEFORE any push or merge — nothing has changed." >&2
  exit 1
fi
# Push the backup off-machine (brand-new ref, plain push — never force).
if git push origin "$BACKUP"; then
  echo "Backup pushed to origin: $BACKUP"
else
  echo "WARNING: could not push backup '$BACKUP' to origin (offline?)." >&2
  echo "         The local backup branch still exists as a recovery point." >&2
fi

# --- plain-push the feature branch (NEVER --force) --------------------------
echo "Pushing $BRANCH to origin (plain push)..."
git push origin "$BRANCH"
echo ">> Now on GitHub: open / merge PR  $BRANCH -> dev  (PR only; never push to dev/main)."

# --- fetch latest origin ----------------------------------------------------
echo "Fetching origin..."
git fetch origin --prune

# --- GUARD: would updating to origin/dev clobber a gitignored/untracked file?
# `git branch` backups can NEVER capture ignored or untracked content (e.g. a
# real .env full of secrets). If origin/dev tracks a path that exists on disk
# but is NOT tracked by us, the merge below would silently overwrite it with
# dev's version and the original would exist in NO git object anywhere. Stop.
if git rev-parse -q --verify origin/dev >/dev/null; then
  COLLIDERS=""
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    # Path exists on disk AND is not tracked in our current branch?
    if [ -e "$p" ] && ! git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
      COLLIDERS="${COLLIDERS}  ${p}
"
    fi
  done < <(git diff --name-only HEAD origin/dev -- 2>/dev/null || true)

  if [ -n "$COLLIDERS" ]; then
    echo "ABORT: origin/dev would OVERWRITE local files that git is NOT tracking" >&2
    echo "       (e.g. your real .env). Backups cannot capture ignored/untracked" >&2
    echo "       content, so merging now could PERMANENTLY destroy this work:" >&2
    printf '%s' "$COLLIDERS" >&2
    echo "Move each file aside FIRST, then re-run ./sync.sh, then restore it:" >&2
    echo "  cp .env .env.local.bak      # for example" >&2
    echo "  ./sync.sh                   # merges dev's tracked version in" >&2
    echo "  # then reconcile .env by hand from .env.local.bak" >&2
    echo "Nothing merged. Your work is committed, backed up ($BACKUP), and pushed." >&2
    exit 1
  fi
fi

# --- fast-forward-only update of local dev ----------------------------------
echo "Updating local dev (fast-forward only)..."
DEV_OK=1
git checkout dev || DEV_OK=0
if [ "$DEV_OK" -eq 1 ]; then
  if git pull --ff-only origin dev; then
    echo "Local dev fast-forwarded to origin/dev."
  else
    echo "WARNING: local dev could not fast-forward (it has diverged)." >&2
    echo "         NOT forcing anything. Skipping the dev merge this round." >&2
    DEV_OK=0
  fi
fi

# Always return to the feature branch, even if the dev update failed.
# Guarded so the script never dies while standing on dev (the EXIT trap above
# is a second line of defence; this gives a precise message and a clean exit).
if ! git checkout "$BRANCH"; then
  echo "ERROR: could not return to '$BRANCH' — you are on dev." >&2
  echo "       Run: git checkout $BRANCH" >&2
  exit 1
fi

if [ "$DEV_OK" -eq 0 ]; then
  echo ""
  echo "Done (core sync complete). Dev was NOT merged in because local dev diverged." >&2
  echo "Your work is committed, backed up ($BACKUP), and pushed — nothing lost." >&2
  echo "Drift is recoverable; investigate dev later or just re-run next cycle." >&2
  exit 0
fi

# --- merge origin/dev INTO the feature branch ------------------------------
# rerere is NEUTRALIZED here (-c rerere.enabled=false -c rerere.autoupdate=false).
# WHY: with rerere.autoupdate, a recurring identical conflict is silently
# auto-resolved AND auto-staged from a previously learned (possibly one-sided)
# resolution. The file then contains only one side, with NO conflict markers,
# and `git diff --diff-filter=U` is EMPTY — which would fool any "no unmerged
# paths => safe to commit" check into recording a merge that dropped a
# teammate's committed side. Disabling rerere for THIS merge forces every real
# conflict to surface with markers so a human keeps BOTH sides.
echo "Merging origin/dev into $BRANCH (rerere disabled for safety)..."
if git -c rerere.enabled=false -c rerere.autoupdate=false \
       merge --no-ff -m "sync: merge dev into ${BRANCH} ${TS}" origin/dev; then
  echo ""
  echo "Sync complete. dev merged into $BRANCH."
  echo "Backup: $BACKUP"
  echo ">> Push the merge and open/merge a PR if it brought in mergeable work:"
  echo "   git push origin \"$BRANCH\""
  exit 0
fi

# --- conflict: STOP, print recovery, exit non-zero (no destructive cmds) ----
echo "" >&2
echo "CONFLICT while merging dev into $BRANCH. NOTHING has been discarded." >&2
echo "Conflicted files:" >&2
git diff --name-only --diff-filter=U >&2 || true
echo "" >&2
echo "Resolve by KEEPING BOTH sides (never pick one side blindly), then:" >&2
echo "  1) Edit each conflicted file to keep BOTH blocks (remove <<<<<<< ======= >>>>>>> markers)." >&2
echo "  2) Stage ONLY files in your lane, e.g.:" >&2
echo "       git add -- ml/ video/ frontend/src/services/ frontend/src/hooks/ frontend/src/types/" >&2
echo "  3) BEFORE committing, OPEN each previously-conflicted file and confirm it" >&2
echo "     STILL contains the teammate's lines from dev — not just your own side." >&2
echo "     (An empty 'git diff --diff-filter=U' alone is NOT proof both sides survived:" >&2
echo "      if your global git has rerere.autoupdate on, a prior one-sided fix can be" >&2
echo "      replayed and auto-staged with no markers. This script disables rerere for" >&2
echo "      its own merge, but verify by eye anyway.)" >&2
echo "  4) Finish the merge once you've verified BOTH sides are present:" >&2
echo "       git commit --no-edit" >&2
echo "" >&2
echo "OR back out cleanly (restores your branch exactly, loses nothing):" >&2
echo "  git merge --abort" >&2
echo "" >&2
echo "Recovery point if needed: git checkout $BACKUP" >&2
echo "Do NOT run reset --hard, clean, checkout --theirs/--ours, or any force-push." >&2
exit 1
