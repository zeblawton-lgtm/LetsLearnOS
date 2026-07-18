#!/usr/bin/env bash
# Minimal LightDM X session used only by the live ISO. It deliberately starts
# no shell, panel, file manager, settings application, or desktop menu.
set -euo pipefail

export HOME=/home/kids
export USER=kids
export LOGNAME=kids
export XDG_SESSION_TYPE=x11
export LETSLEARNOS_INSTALL=/opt/letslearnos
export CHROMIUM_SCALE_FACTOR=2.0

xset s off
xset -dpms
xset s noblank

matchbox-window-manager -use_titlebar no &
unclutter -idle 2 -root &

exec dbus-run-session -- /opt/letslearnos/system/kiosk-launcher.sh
