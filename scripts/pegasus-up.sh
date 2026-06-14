#!/bin/bash
# Pegasus keep-alive supervisor.
#
# Starts and continuously heals everything the Expo app needs: the four Python
# services (backend 8001, signals 8002, ml 8003, video 8004), the web console
# (4000), a cloudflare tunnel for each of those + for Metro (8081), and Metro
# itself. It also keeps frontend/src/services/config.ts and the Desktop QR
# pointed at the LIVE tunnel URLs, rewriting them only when a tunnel's URL
# actually changes (e.g. after a crash + restart).
#
# Run once; it loops forever. Idempotent — it adopts anything already running
# and only (re)starts what's down, so it won't thrash a healthy setup.
#
#   bash scripts/pegasus-up.sh        # or via the launchd agent (always-on)

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
NODE_BIN="$(dirname "$(command -v node 2>/dev/null)" 2>/dev/null)"
[ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"

ROOT="/Users/rishith/Developer/pegasus"
PY="python3.12"
L="/tmp/pegasus"
mkdir -p "$L"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
up() { lsof -ti:"$1" >/dev/null 2>&1; }

start_svc() { # name port dir
  up "$2" && return 0
  log "start $1 on :$2"
  ( cd "$ROOT/$3" && set -a; [ -f .env ] && . ./.env; set +a; exec "$PY" -m uvicorn main:app --host 0.0.0.0 --port "$2" ) >"$L/$1.log" 2>&1 &
}

start_console() {
  up 4000 && return 0
  log "start console on :4000"
  ( cd "$ROOT/console" && exec "$PY" -m uvicorn server:app --host 0.0.0.0 --port 4000 ) >"$L/console.log" 2>&1 &
}

tun_url() { grep -Eo "https://[a-z0-9-]+\.trycloudflare\.com" "$L/tun_$1.log" 2>/dev/null | tail -1; }

ensure_tunnel() { # port
  local p="$1"
  # Adopt a live tunnel (process running + a known URL); otherwise (re)start it.
  if pgrep -f "cloudflared tunnel --url http://localhost:$p" >/dev/null 2>&1 && [ -n "$(tun_url "$p")" ]; then
    return 0
  fi
  pkill -f "cloudflared tunnel --url http://localhost:$p" 2>/dev/null
  : >"$L/tun_$p.log"
  log "start tunnel for :$p"
  ( exec cloudflared tunnel --url "http://localhost:$p" ) >"$L/tun_$p.log" 2>&1 &
  local i
  for i in $(seq 1 25); do [ -n "$(tun_url "$p")" ] && break; sleep 1; done
}

ensure_metro() {
  local cf; cf="$(tun_url 8081)"
  [ -z "$cf" ] && return 0
  local cur=""; [ -f "$L/metro_proxy" ] && cur="$(cat "$L/metro_proxy")"
  if up 8081 && [ "$cur" = "$cf" ]; then return 0; fi
  log "(re)start Metro with proxy $cf"
  lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null
  echo "$cf" >"$L/metro_proxy"
  ( cd "$ROOT/frontend" && EXPO_PACKAGER_PROXY_URL="$cf" REACT_NATIVE_PACKAGER_HOSTNAME="${cf#https://}" exec npx expo start --host lan ) >"$L/metro.log" 2>&1 &
}

write_config() {
  local b s m v
  b="$(tun_url 8001)"; s="$(tun_url 8002)"; m="$(tun_url 8003)"; v="$(tun_url 8004)"
  [ -z "$b" ] || [ -z "$s" ] || [ -z "$m" ] || [ -z "$v" ] && return 0
  local cfg="$ROOT/frontend/src/services/config.ts"
  if grep -qF "$b" "$cfg" 2>/dev/null && grep -qF "$s" "$cfg" && grep -qF "$m" "$cfg" && grep -qF "$v" "$cfg"; then
    return 0
  fi
  cat >"$cfg" <<EOF
// Auto-managed by scripts/pegasus-up.sh — live cloudflare tunnel URLs.
export const BACKEND_URL = "$b";
export const ML_URL = "$m";
export const VIDEO_URL = "$v";
export const SIGNALS_URL = "$s";
export const DEFAULT_USER_ID = "demo_user";

export const SCORE_POLL_MS = 30_000;
EOF
  log "rewrote config.ts with live tunnel URLs"
}

write_qr() {
  local cf; cf="$(tun_url 8081)"
  [ -z "$cf" ] && return 0
  local host="${cf#https://}"
  [ -f "$L/qr_host" ] && [ "$(cat "$L/qr_host")" = "$host" ] && return 0
  if npx -y qrcode -o "$HOME/Desktop/pegasus-expo-qr.png" "exp://$host" >/dev/null 2>&1; then
    echo "$host" >"$L/qr_host"
    log "wrote Desktop QR -> exp://$host"
  fi
}

log "Pegasus supervisor up (pid $$)"
while true; do
  start_svc backend 8001 backend
  start_svc signals 8002 signals
  start_svc ml 8003 ml
  start_svc video 8004 video
  start_console
  for p in 8001 8002 8003 8004 8081; do ensure_tunnel "$p"; done
  ensure_metro
  write_config
  write_qr
  sleep 15
done
