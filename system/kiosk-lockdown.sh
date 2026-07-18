#!/usr/bin/env bash
# =============================================================================
# kiosk-lockdown.sh — post-install restricted kiosk session
#
# Run as root after scripts/install.sh on the kiosk computer:
#
#   sudo bash system/kiosk-lockdown.sh
#
# This assigns the locked `kids` account a dedicated Matchbox X session. GNOME
# remains available to the parent account, but it is never launched for kids.
# The script is idempotent and only writes system configuration; a human must
# run it on the kiosk and reboot to activate the new display-manager session.
# =============================================================================
set -euo pipefail

KIDS_USER="kids"
INSTALL_DIR="/opt/letslearnos"
SESSION_NAME="letslearnos-kiosk"
SESSION_SCRIPT="${INSTALL_DIR}/system/installed-kiosk-session.sh"
SESSION_DESKTOP="/usr/share/xsessions/${SESSION_NAME}.desktop"
POLKIT_RULES_SRC="${INSTALL_DIR}/system/50-kids.rules"
POLKIT_RULES_DEST="/etc/polkit-1/rules.d/50-kids.rules"

step() { echo; echo "==> $*"; }
ok()   { echo "    [OK] $*"; }
warn() { echo "    [WARN] $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "Run as root: sudo bash system/kiosk-lockdown.sh"
id "${KIDS_USER}" >/dev/null 2>&1 || die "User '${KIDS_USER}' not found. Run scripts/install.sh first."
[[ -d "${INSTALL_DIR}" ]] || die "${INSTALL_DIR} not found. Run scripts/install.sh first."
[[ -x "${SESSION_SCRIPT}" ]] || die "Missing executable ${SESSION_SCRIPT}. Re-run scripts/install.sh."

if ! grep -Eq 'VERSION_ID="(24\.04|26\.04)"' /etc/os-release 2>/dev/null; then
  warn "This installed-Ubuntu path is maintained for Ubuntu 24.04 and 26.04 LTS."
fi

missing=()
for tool in matchbox-window-manager unclutter xset dbus-update-activation-environment; do
  command -v "${tool}" >/dev/null 2>&1 || missing+=("${tool}")
done
if (( ${#missing[@]} > 0 )); then
  die "Missing kiosk session tools: ${missing[*]}. Re-run scripts/install.sh package step."
fi

step "Enforcing the restricted kids account"
usermod --shell /usr/sbin/nologin "${KIDS_USER}"
usermod --lock "${KIDS_USER}"
if id -nG "${KIDS_USER}" | tr ' ' '\n' | grep -qx sudo; then
  gpasswd -d "${KIDS_USER}" sudo >/dev/null 2>&1 || true
fi
for group in audio video input render; do
  getent group "${group}" >/dev/null && usermod -a -G "${group}" "${KIDS_USER}"
done
ok "${KIDS_USER} is locked, nologin, and not in sudo."

step "Installing the no-desktop GDM session"
cat > "${SESSION_DESKTOP}" << EOF
[Desktop Entry]
Name=LetsLearnOS Kiosk
Comment=Restricted child kiosk session
Exec=${SESSION_SCRIPT}
TryExec=${SESSION_SCRIPT}
Type=Application
DesktopNames=LetsLearnOS
EOF
chmod 0644 "${SESSION_DESKTOP}"

mkdir -p /var/lib/AccountsService/users
cat > "/var/lib/AccountsService/users/${KIDS_USER}" << EOF
[User]
XSession=${SESSION_NAME}
SystemAccount=false
EOF
chmod 0600 "/var/lib/AccountsService/users/${KIDS_USER}"

cat > "/home/${KIDS_USER}/.dmrc" << EOF
[Desktop]
Session=${SESSION_NAME}
EOF
chown "${KIDS_USER}:${KIDS_USER}" "/home/${KIDS_USER}/.dmrc"
chmod 0644 "/home/${KIDS_USER}/.dmrc"

mkdir -p /etc/gdm3
if [[ -f /etc/gdm3/custom.conf ]] && \
   ! grep -q 'LetsLearnOS — managed by kiosk-lockdown.sh' /etc/gdm3/custom.conf && \
   [[ ! -e /etc/gdm3/custom.conf.pre-letslearnos ]]; then
  cp /etc/gdm3/custom.conf /etc/gdm3/custom.conf.pre-letslearnos
fi
cat > /etc/gdm3/custom.conf << EOF
# LetsLearnOS — managed by kiosk-lockdown.sh
[daemon]
AutomaticLoginEnable=True
AutomaticLogin=${KIDS_USER}

[security]
DisableUserList=True

[xdmcp]
Enable=False
EOF
ok "GDM autologin selects ${SESSION_NAME}; no GNOME desktop starts for kids."

step "Removing obsolete GNOME-kiosk policy from earlier installs"
# Earlier revisions launched a full GNOME session for kids and installed a
# machine-wide dconf profile. It is unnecessary with the dedicated session and
# also affected the parent desktop. Remove only the LetsLearnOS-owned profile.
if [[ -f /etc/dconf/profile/user ]] && \
   grep -q '^system-db:letslearnos$' /etc/dconf/profile/user; then
  if [[ "$(sed '/^[[:space:]]*$/d' /etc/dconf/profile/user)" == \
        $'user-db:user\nsystem-db:letslearnos' ]]; then
    rm -f /etc/dconf/profile/user
  else
    warn "Kept customized /etc/dconf/profile/user; remove only system-db:letslearnos manually."
  fi
fi
rm -rf /etc/dconf/db/letslearnos.d /etc/dconf/db/letslearnos
if command -v dconf >/dev/null 2>&1; then
  dconf update
fi
ok "Legacy machine-wide GNOME restrictions removed; parent desktop is unaffected."

step "Masking child-accessible consoles and sleep targets"
for tty in 2 3 4 5 6; do
  systemctl mask "getty@tty${tty}.service" >/dev/null 2>&1 || \
    warn "Could not mask getty@tty${tty}.service"
done
systemctl mask console-getty.service >/dev/null 2>&1 || true
for target in \
  sleep.target suspend.target hibernate.target hybrid-sleep.target \
  suspend-then-hibernate.target; do
  systemctl mask "${target}" >/dev/null 2>&1 || warn "Could not mask ${target}"
done
ok "Text gettys and sleep targets are masked."

step "Installing polkit denials"
[[ -f "${POLKIT_RULES_SRC}" ]] || die "Missing ${POLKIT_RULES_SRC}."
mkdir -p /etc/polkit-1/rules.d
cp "${POLKIT_RULES_SRC}" "${POLKIT_RULES_DEST}"
chmod 0644 "${POLKIT_RULES_DEST}"
ok "Installed ${POLKIT_RULES_DEST}."

step "Disabling unused Bluetooth"
systemctl disable --now bluetooth.service >/dev/null 2>&1 || \
  warn "Bluetooth was not installed or could not be disabled."

step "Making lid and power controls inert in the kiosk"
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/50-letslearnos.conf << 'EOF'
# LetsLearnOS — managed by kiosk-lockdown.sh
[Login]
HandlePowerKey=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
IdleActionSec=0
EOF
systemctl restart systemd-logind >/dev/null 2>&1 || \
  warn "logind will load the new policy after reboot."
ok "Power, suspend, and lid actions are disabled."

echo
echo "Lockdown complete. Reboot, then verify the kids session launches directly"
echo "into LetsLearnOS with no panel, desktop, launcher, terminal, or settings UI."
echo "Parent recovery remains available on the GDM login screen at Ctrl+Alt+F1."
