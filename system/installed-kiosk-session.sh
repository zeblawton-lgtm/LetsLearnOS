#!/usr/bin/env bash
# Restricted GDM X session for the installed-Ubuntu deployment. This is the
# kids user's entire graphical session: no GNOME Shell, panel, launcher, file
# manager, terminal, settings application, or desktop menu is started.
set -uo pipefail

export HOME=/home/kids
export USER=kids
export LOGNAME=kids
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=LetsLearnOS
export LETSLEARNOS_INSTALL=/opt/letslearnos
# This session has no compositor-level HiDPI scaling, so Chromium supplies the
# required 200% scale directly.
export CHROMIUM_SCALE_FACTOR="${CHROMIUM_SCALE_FACTOR:-2.0}"

xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

matchbox-window-manager -use_titlebar no &
WM_PID=$!
unclutter -idle 2 -root &
CURSOR_PID=$!

cleanup() {
  systemctl --user stop letslearnos.service 2>/dev/null || true
  kill "${CURSOR_PID}" "${WM_PID}" 2>/dev/null || true
  wait "${CURSOR_PID}" "${WM_PID}" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT HUP
trap 'exit 143' TERM

# A user service manager can pre-date this graphical login. Import the display
# and D-Bus addresses before starting the kiosk so Chromium receives the live
# X session rather than stale or empty values.
dbus-update-activation-environment --systemd \
  DISPLAY XAUTHORITY DBUS_SESSION_BUS_ADDRESS XDG_RUNTIME_DIR \
  XDG_SESSION_TYPE XDG_CURRENT_DESKTOP 2>/dev/null || true
systemctl --user import-environment \
  DISPLAY XAUTHORITY DBUS_SESSION_BUS_ADDRESS XDG_RUNTIME_DIR \
  XDG_SESSION_TYPE XDG_CURRENT_DESKTOP LETSLEARNOS_INSTALL \
  CHROMIUM_SCALE_FACTOR 2>/dev/null || true

if ! systemctl --user start letslearnos.service; then
  echo "LetsLearnOS user service failed to start; leaving a blank restricted session." >&2
fi

# Keep the display-manager session alive even if the service is deliberately
# stopped for parent maintenance. Restart=always handles process failures; an
# explicit systemctl stop leaves only this blank, menu-free session.
while true; do
  sleep 3600 &
  wait $! || true
done
