#!/usr/bin/env bash
# Start all of Pegasus locally. First run sets up venvs + node_modules.
#   ./dev.sh          # set up (if needed) + run everything
#   ./dev.sh setup    # just install deps, don't run
set -euo pipefail
cd "$(dirname "$0")"

PIDS=()
cleanup() { echo; echo "Stopping…"; for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

py_service() {  # name folder port
  local name=$1 folder=$2 port=$3
  pushd "$folder" >/dev/null
  [ -d .venv ] || python3 -m venv .venv
  ./.venv/bin/pip install -q -r requirements.txt
  if [ "${1:-}" != "__setup__" ] && [ "$RUN" = "1" ]; then
    echo "→ $name on :$port"
    ./.venv/bin/uvicorn main:app --port "$port" &
    PIDS+=($!)
  fi
  popd >/dev/null
}

RUN=1
[ "${1:-}" = "setup" ] && RUN=0

py_service ml      ml      8003
py_service signals signals 8002
py_service backend backend 8001

pushd frontend >/dev/null
[ -d node_modules ] || npm install
if [ "$RUN" = "1" ]; then
  echo "→ frontend on :3000"
  npm run dev &
  PIDS+=($!)
fi
popd >/dev/null

[ "$RUN" = "0" ] && { echo "Setup done. Run ./dev.sh to start."; exit 0; }

echo
echo "Pegasus up:  frontend http://localhost:3000  ·  backend :8001  ·  signals :8002  ·  ml :8003"
echo "Ctrl-C to stop."
wait
