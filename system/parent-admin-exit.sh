#!/usr/bin/env bash
# Emergency parent exit from kiosk mode
# Usage: Run in a separate terminal or bind to a hidden key sequence
# Default: Ctrl+Alt+F1 to reach the GDM login screen (tty2-6 gettys are
#          masked by kiosk-lockdown.sh, so Ctrl+Alt+F2..F6 are dead),
#          log in as parent, open a terminal, run this script
set -euo pipefail

echo "LetsLearnOS Parent Exit"
echo "Enter parent PIN to stop kiosk:"
read -rs PIN

HASH=$(echo -n "${PIN}letslearnos" | sha256sum | cut -d' ' -f1)
KIDS_USER="${KIDS_USER:-kids}"
KIDS_HOME="/home/${KIDS_USER}"
DB="${DATABASE_URL:-sqlite:${KIDS_HOME}/.local/share/letslearnos/db.sqlite}"
DB="${DB#sqlite:}"

if [ -f "$DB" ]; then
  STORED=$(sqlite3 "$DB" "SELECT value FROM settings WHERE key='parent_pin_hash' LIMIT 1" 2>/dev/null || echo "")
  if [ -z "$STORED" ]; then
    # No PIN row yet (parent never changed it) — use the precomputed salted
    # bootstrap digest. Keep this synchronized with DEFAULT_PIN_HASH in
    # artifacts/api-server/src/lib/admin-auth.ts; never store plaintext here.
    STORED="12a6854113dce6a82e013f446b1a2249802623be1db267a7f32788f0f94e22c2"
  fi
  if [ "$HASH" = "$STORED" ]; then
    echo "PIN verified. Stopping kiosk..."
    KIDS_UID="$(id -u "${KIDS_USER}")"
    sudo -u "${KIDS_USER}" XDG_RUNTIME_DIR="/run/user/${KIDS_UID}" \
      systemctl --user stop letslearnos.service
    pkill -u "${KIDS_USER}" chromium 2>/dev/null || true
    pkill -u "${KIDS_USER}" chromium-browser 2>/dev/null || true
    echo "Kiosk stopped. Type 'sudo -u ${KIDS_USER} XDG_RUNTIME_DIR=/run/user/${KIDS_UID} systemctl --user start letslearnos.service' to restart."
  else
    echo "Incorrect PIN."
    exit 1
  fi
else
  echo "Database not found at $DB"
  exit 1
fi
