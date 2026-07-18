#!/usr/bin/env bash
# =============================================================================
# kiosk-launcher.sh — LetsLearnOS kiosk launcher (Node.js / Vite edition)
#
# The Node.js Express backend also serves the pre-built Vite frontend.
#
# Invoked by letslearnos.service (systemd user unit for the kids account).
#
# Sequence:
#   1. Kill any stale Node process on the backend port.
#   2. Start the Express backend (NODE_ENV=production) in background.
#   3. Wait up to 15s for GET /api/healthz to return HTTP 200.
#   4. Run Chromium in kiosk mode while this wrapper supervises both processes.
#      Restart=always relaunches the session after either a crash or clean exit.
#
# Wayland vs X11:
#   Auto-detected via WAYLAND_DISPLAY. --ozone-platform wayland is added when
#   a Wayland session is present. No manual editing required.
#
# HiDPI displays:
#   --force-device-scale-factor=$CHROMIUM_SCALE_FACTOR. The legacy GNOME path
#   used the launcher fallback of 0.7 because GNOME also scaled the display.
#   Both current no-desktop sessions explicitly set 2.0, supplying the required
#   scale directly without a desktop compositor.
#
# This script must stay under /opt/letslearnos/system/ — owned root:root,
# not writable by the kids user.
# =============================================================================

set -euo pipefail

INSTALL_DIR="${LETSLEARNOS_INSTALL:-/opt/letslearnos}"
KIDS_HOME="${HOME:-/home/kids}"
BACKEND_HOST="127.0.0.1"
BACKEND_PORT="${PORT:-8765}"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}/api/healthz"
BACKEND_TIMEOUT=15   # seconds to wait for /api/healthz before aborting
CHROMIUM_SCALE_FACTOR="${CHROMIUM_SCALE_FACTOR:-0.7}"

log() { echo "[letslearnos] $*"; }
die() { echo "[letslearnos] FATAL: $*" >&2; exit 1; }

log "kiosk-launcher starting — install dir: ${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 0. Kill any stale Node process from a previous systemd restart cycle
# ---------------------------------------------------------------------------
if ss -tlnp "sport = :${BACKEND_PORT}" 2>/dev/null | grep -q ":${BACKEND_PORT}"; then
  log "WARNING: Port ${BACKEND_PORT} already in use — killing prior process."
  fuser -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
  sleep 0.5
fi

# ---------------------------------------------------------------------------
# 1. Locate Node.js binary
# ---------------------------------------------------------------------------
NODE_BIN=""
for candidate in \
    "${INSTALL_DIR}/runtime/bin/node" \
    "/usr/local/bin/node" \
    "/usr/bin/node" \
    "$(command -v node 2>/dev/null || true)"; do
  if [[ -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

[[ -z "$NODE_BIN" ]] && die "node not found. Run install.sh first."
log "Node.js binary: ${NODE_BIN} ($(${NODE_BIN} --version))"

# ---------------------------------------------------------------------------
# 2. Start the Express backend
# ---------------------------------------------------------------------------
cd "${INSTALL_DIR}"

# Source .env only inside the backend subshell. Chromium must never inherit
# backend-only secrets or API credentials.
(
  if [[ -f "${INSTALL_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${INSTALL_DIR}/.env"
    set +a
  fi

  export DATABASE_URL="${DATABASE_URL:-sqlite:${KIDS_HOME}/.local/share/letslearnos/db.sqlite}"
  if [[ "${DATABASE_URL}" == sqlite:* ]]; then
    mkdir -p "$(dirname "${DATABASE_URL#sqlite:}")"
  fi

  export APP_ENV=kiosk
  export NODE_ENV=production
  export PORT="${BACKEND_PORT}"
  export LETSLEARNOS_INSTALL="${INSTALL_DIR}"
  exec "${NODE_BIN}" "${INSTALL_DIR}/api-dist/index.mjs"
) &
BACKEND_PID=$!
log "Backend PID: ${BACKEND_PID}"

cleanup() {
  if [[ -n "${CHROMIUM_PID:-}" ]] && kill -0 "${CHROMIUM_PID}" 2>/dev/null; then
    kill "${CHROMIUM_PID}" 2>/dev/null || true
    wait "${CHROMIUM_PID}" 2>/dev/null || true
  fi
  if kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT HUP
trap 'exit 143' TERM

# ---------------------------------------------------------------------------
# 3. Wait for the backend /api/healthz endpoint
# ---------------------------------------------------------------------------
log "Waiting up to ${BACKEND_TIMEOUT}s for backend /api/healthz ..."
# Each iteration sleeps 0.5s, so count half-second ticks — 2 per second of
# BACKEND_TIMEOUT. (An earlier revision counted whole seconds per 0.5s tick,
# halving the advertised timeout when the port was still refusing.)
TICKS=0
READY=false
while [[ $TICKS -lt $(( BACKEND_TIMEOUT * 2 )) ]]; do
  if curl -fsS --max-time 1 "${BACKEND_URL}" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.5
  TICKS=$(( TICKS + 1 ))
done

if ! $READY; then
  die "Backend did not respond within ${BACKEND_TIMEOUT}s."
fi

log "Backend is healthy. Launching Chromium kiosk."

# ---------------------------------------------------------------------------
# 4. Build Chromium flags
# ---------------------------------------------------------------------------
CHROMIUM_FLAGS=(
  # Core kiosk mode — no address bar, no tabs, no chrome UI
  --kiosk
  # App URL — backend serves both API (/api/*) and Vite frontend (/)
  "--app=http://${BACKEND_HOST}:${BACKEND_PORT}/"
  --no-first-run

  # HiDPI — 4K panel at 13.3" (3840×2160, ~331 PPI).
  # Dedicated kiosk sessions set 2.0. The 0.7 fallback remains only so an
  # installed kiosk can be migrated from the retired GNOME session safely.
  "--force-device-scale-factor=${CHROMIUM_SCALE_FACTOR}"

  # Touch
  --touch-events=enabled
  --enable-touch-drag-drop

  # Prevent escape gestures
  --disable-pinch
  --overscroll-history-navigation=0

  # Audio — allow autoplay so TTS and feedback audio work without gesture
  --autoplay-policy=no-user-gesture-required

  # Isolated Chromium profile for the kiosk session.
  # NOTE: must NOT be a hidden dot-directory — snap confinement blocks those,
  # Chromium then silently falls back to its default profile (which on this
  # machine still carried the v2 service-worker cache). snap/chromium/common
  # is always writable by the chromium snap.
  --user-data-dir="${KIDS_HOME}/snap/chromium/common/letslearnos-kiosk"

  # Disable UI chrome that has no place in a kiosk
  --disable-features=TranslateUI
  --no-default-browser-check
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-restore-session-state

  # No crash/metrics reporting
  --disable-breakpad
  --disable-domain-reliability
  --metrics-recording-only
)

# Wayland vs X11 auto-detection
if [[ -n "${WAYLAND_DISPLAY:-}" ]]; then
  log "Wayland session detected (WAYLAND_DISPLAY=${WAYLAND_DISPLAY})"
  CHROMIUM_FLAGS+=(--ozone-platform=wayland)
elif [[ -n "${DISPLAY:-}" ]]; then
  log "X11 session detected (DISPLAY=${DISPLAY})"
else
  log "WARNING: Neither WAYLAND_DISPLAY nor DISPLAY is set — Chromium may fail."
fi

# Locate the Chromium binary (snap or .deb)
CHROMIUM_BIN=""
for candidate in \
    /snap/bin/chromium \
    /usr/bin/chromium \
    /usr/bin/chromium-browser \
    /usr/bin/google-chrome; do
  if [[ -x "$candidate" ]]; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

[[ -z "$CHROMIUM_BIN" ]] && die "Chromium binary not found. Run install.sh first."
log "Launching: ${CHROMIUM_BIN} (kiosk mode)"

# ---------------------------------------------------------------------------
# 5. Supervise Chromium and backend; either process ending stops the pair
# ---------------------------------------------------------------------------
mkdir -p "${KIDS_HOME}/snap/chromium/common/letslearnos-kiosk"
"${CHROMIUM_BIN}" "${CHROMIUM_FLAGS[@]}" &
CHROMIUM_PID=$!
log "Chromium PID: ${CHROMIUM_PID}"

FIRST_STATUS=0
wait -n "${BACKEND_PID}" "${CHROMIUM_PID}" || FIRST_STATUS=$?
if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
  log "Backend exited with status ${FIRST_STATUS}; stopping Chromium."
else
  log "Chromium exited with status ${FIRST_STATUS}; stopping backend."
fi
exit "${FIRST_STATUS}"
