#!/usr/bin/env bash
# =============================================================================
# install.sh — LetsLearnOS full deployment script (Node.js / Vite edition)
#
# Run as root on a supported Ubuntu LTS x86_64 installation.
#
#   sudo bash scripts/install.sh
#
# WHAT THIS SCRIPT DOES (read before running — each step has a human prompt):
#
#   Step 0:  Pre-flight — confirm supported Ubuntu, confirm not running as kids
#   Step 1:  Create 'parent' admin account (interactive)
#   Step 2:  Create 'kids' kiosk user (no shell, locked password)
#   Step 3:  Install system packages (minimal X kiosk + Chromium + Node.js)
#   Step 4:  Build the app on-device (pnpm install + build) OR deploy pre-built
#   Step 5:  Deploy app to /opt/letslearnos/ via rsync
#   Step 6:  Configure SQLite database + run migrations
#   Step 7:  Configure generic first-run profiles
#   Step 8:  Install systemd user unit for the kids account
#   Step 9:  Prepare GDM (lockdown selects the no-desktop kids session)
#   Step 10: Install polkit rules
#   Step 11: Enable linger for the kids user
#
# WHAT YOU MUST DO AFTER THIS SCRIPT:
#   a. Run:  sudo bash system/kiosk-lockdown.sh
#   b. Set the parent PIN via the admin overlay (default: 1234)
#   c. Reboot the device.
#
# IDEMPOTENCY: Re-running this script is safe.
#
# Run from the repository root:
#   sudo bash scripts/install.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
INSTALL_DIR="/opt/letslearnos"
KIDS_USER="kids"
PARENT_USER="parent"
LEGACY_USER="letslearnos"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="letslearnos.service"
SERVICE_SRC="${REPO_DIR}/system/${SERVICE_NAME}"
POLKIT_RULES_SRC="${REPO_DIR}/system/50-kids.rules"
POLKIT_RULES_DEST="/etc/polkit-1/rules.d/50-kids.rules"
NODE_VERSION="22"   # Node.js LTS major version

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
step()    { echo ""; echo ""; echo "==========================================================================="; echo "  STEP $*"; echo "==========================================================================="; }
info()    { echo "    $*"; }
ok()      { echo "    [OK] $*"; }
warn()    { echo "    [WARN] $*"; }
die()     { echo ""; echo "FATAL: $*" >&2; exit 1; }

confirm() {
  local msg="$1" default="${2:-y}" prompt
  [[ "$default" == "y" ]] && prompt="[Y/n]" || prompt="[y/N]"
  echo ""; printf "  >>> %s %s: " "${msg}" "${prompt}"
  read -r answer; answer="${answer:-$default}"
  case "${answer}" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "This script must be run as root: sudo bash scripts/install.sh"
}

# ---------------------------------------------------------------------------
# Step 0 — Pre-flight
# ---------------------------------------------------------------------------
step "0/11: Pre-flight checks"
require_root

[[ "${SUDO_USER:-}" == "${KIDS_USER}" ]] && die "Do not run install.sh as the ${KIDS_USER} user."

if ! grep -Eq 'VERSION_ID="(24\.04|26\.04)"' /etc/os-release 2>/dev/null; then
  warn "LetsLearnOS is tested on Ubuntu 24.04 and 26.04 LTS."
  confirm "Continue anyway?" "n" || die "Aborted."
fi

[[ -f "${REPO_DIR}/artifacts/api-server/package.json" ]] || \
  die "artifacts/api-server/package.json not found in ${REPO_DIR}. Run from the repository root."

ok "Pre-flight passed. Installing from: ${REPO_DIR}"
info "Install target: ${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# Step 1 — Create 'parent' admin account
# ---------------------------------------------------------------------------
step "1/11: Create parent/admin account"

info "The parent account is the recovery and admin shell account."
info "It logs in at the GDM screen (Ctrl+Alt+F1) and opens a terminal, or"
info "SSH — only if you have installed openssh-server (apt-get install -y openssh-server)."
info "It has sudo rights. The kids user does NOT."
echo ""
printf "    Enter parent account username [${PARENT_USER}]: "
read -r PARENT_USER_INPUT
PARENT_USER="${PARENT_USER_INPUT:-${PARENT_USER}}"

if id "${PARENT_USER}" &>/dev/null; then
  ok "User '${PARENT_USER}' already exists — skipping creation."
else
  if confirm "Create parent account '${PARENT_USER}'?" "y"; then
    adduser --gecos "LetsLearnOS Parent/Admin" "${PARENT_USER}"
    usermod -aG sudo "${PARENT_USER}"
    ok "Parent account '${PARENT_USER}' created with sudo access."
  else
    warn "Skipped parent account creation. Recovery will be harder without it."
  fi
fi

# ---------------------------------------------------------------------------
# Step 2 — Create 'kids' kiosk user
# ---------------------------------------------------------------------------
step "2/11: Create '${KIDS_USER}' kiosk user"

info "The kids user: no password (locked), no sudo, no shell, GDM autologin."

if id "${KIDS_USER}" &>/dev/null; then
  ok "User '${KIDS_USER}' already exists — skipping creation."
else
  if confirm "Create kiosk user '${KIDS_USER}'?" "y"; then
    useradd --create-home --shell /usr/sbin/nologin \
      --comment "LetsLearnOS Kiosk User" "${KIDS_USER}"
    usermod -L "${KIDS_USER}"
    ok "Kiosk user '${KIDS_USER}' created (password locked)."
  else
    die "Cannot proceed without the ${KIDS_USER} user."
  fi
fi

usermod --shell /usr/sbin/nologin "${KIDS_USER}"
usermod -L "${KIDS_USER}"
if id -nG "${KIDS_USER}" | tr ' ' '\n' | grep -qx sudo; then
  gpasswd -d "${KIDS_USER}" sudo >/dev/null 2>&1 || true
fi
for group in audio video input render; do
  if getent group "${group}" >/dev/null; then
    usermod -a -G "${group}" "${KIDS_USER}"
  fi
done

KIDS_HOME="/home/${KIDS_USER}"
KIDS_UID="$(id -u "${KIDS_USER}")"

if id "${LEGACY_USER}" &>/dev/null; then
  warn "Legacy user '${LEGACY_USER}' exists. Locking it and disabling shell."
  usermod -L "${LEGACY_USER}" || true
  usermod --shell /usr/sbin/nologin "${LEGACY_USER}" || true
fi

LEGACY_STAMP="$(date +%Y%m%d%H%M%S)"
if [[ -f /etc/systemd/system/letslearnos.service ]]; then
  systemctl disable --now letslearnos.service >/dev/null 2>&1 || true
  mv /etc/systemd/system/letslearnos.service "/etc/systemd/system/letslearnos.service.legacy-${LEGACY_STAMP}"
  systemctl daemon-reload || true
  ok "Legacy system service quarantined."
fi
for legacy_path in /var/lib/letslearnos /var/log/letslearnos; do
  if [[ -e "${legacy_path}" ]]; then
    mv "${legacy_path}" "${legacy_path}.legacy-${LEGACY_STAMP}"
    ok "Legacy path quarantined: ${legacy_path}.legacy-${LEGACY_STAMP}"
  fi
done

# ---------------------------------------------------------------------------
# Step 3 — Install system packages
# ---------------------------------------------------------------------------
step "3/11: Install system packages"

info "Required: minimal Matchbox X kiosk, Chromium (snap), Node.js (via fnm),"
info "          pnpm, speech-dispatcher, iio-sensor-proxy, ufw, rsync"
echo ""

if confirm "Install system packages?" "y"; then
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    curl \
    speech-dispatcher \
    espeak-ng \
    iio-sensor-proxy \
    matchbox-window-manager \
    unclutter \
    x11-xserver-utils \
    dbus-x11 \
    ufw \
    rsync \
    sqlite3 \
    git

  # Chromium via snap
  if snap list chromium &>/dev/null 2>&1; then
    ok "chromium snap already installed."
  else
    snap install chromium && ok "chromium snap installed." || \
      warn "chromium snap install failed — install manually: snap install chromium"
  fi

  # Node.js via fnm (Fast Node Manager — manages multiple Node versions)
  if command -v node &>/dev/null && node --version | grep -q "^v${NODE_VERSION}"; then
    ok "Node.js $(node --version) already installed."
  else
    info "Installing fnm (Node.js version manager) ..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /usr/local/fnm --skip-shell
    FNM="/usr/local/fnm/fnm"
    [[ -x "${FNM}" ]] || die "fnm install failed."
    "${FNM}" install "${NODE_VERSION}" --fnm-dir /usr/local/fnm
    NODE_BIN="$("${FNM}" exec --using="${NODE_VERSION}" --fnm-dir /usr/local/fnm -- which node)"
    # Symlink to /usr/local/bin so it's on PATH for all users
    ln -sf "${NODE_BIN}" /usr/local/bin/node
    ln -sf "$(dirname "${NODE_BIN}")/npm" /usr/local/bin/npm
    ok "Node.js $(node --version) installed."
  fi

  # pnpm
  if command -v pnpm &>/dev/null; then
    ok "pnpm $(pnpm --version) already installed."
  else
    npm install -g pnpm && ok "pnpm installed." || warn "pnpm install failed."
    # npm -g installs into the fnm node dir — symlink pnpm onto PATH like node/npm
    if ! command -v pnpm &>/dev/null && [[ -L /usr/local/bin/node ]]; then
      ln -sf "$(dirname "$(readlink -f /usr/local/bin/node)")/pnpm" /usr/local/bin/pnpm
      ok "pnpm symlinked to /usr/local/bin/pnpm ($(pnpm --version))."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Step 4 — Build the application
# ---------------------------------------------------------------------------
step "4/11: Build application (pnpm install + build)"

info "Building frontend (Vite) and backend (TypeScript → ESM) ..."
info "This step runs in ${REPO_DIR} — requires internet for first install."
echo ""

if confirm "Build the application now?" "y"; then
  cd "${REPO_DIR}"

  pnpm install --frozen-lockfile || pnpm install
  ok "pnpm install complete."

  # Build frontend — outputs to artifacts/letslearnos/dist/public/
  BASE_PATH=/ pnpm --filter @workspace/letslearnos run build
  ok "Frontend built → artifacts/letslearnos/dist/public/"

  # Build backend — outputs to artifacts/api-server/dist/
  pnpm --filter @workspace/api-server run build
  ok "Backend built → artifacts/api-server/dist/"
else
  warn "Skipped build step. Ensure dist/ directories exist before continuing."
fi

# ---------------------------------------------------------------------------
# Step 5 — Deploy to /opt/letslearnos/
# ---------------------------------------------------------------------------
step "5/11: Deploy application to ${INSTALL_DIR}/ [DESTRUCTIVE — overwrites existing deploy]"

info "Deploying:"
info "  artifacts/api-server/dist/     → ${INSTALL_DIR}/api-dist/"
info "  artifacts/letslearnos/dist/public/ → ${INSTALL_DIR}/web/"
info "  system/                        → ${INSTALL_DIR}/system/"
info "  scripts/                       → ${INSTALL_DIR}/scripts/"
info "  package.json                   → ${INSTALL_DIR}/"
echo ""

if confirm "Deploy to ${INSTALL_DIR}/?" "y"; then
  mkdir -p "${INSTALL_DIR}/api-dist" "${INSTALL_DIR}/web" \
           "${INSTALL_DIR}/system" "${INSTALL_DIR}/scripts"

  # Backend compiled output
  rsync -a --delete \
    "${REPO_DIR}/artifacts/api-server/dist/" \
    "${INSTALL_DIR}/api-dist/" && ok "api-dist/ synced."

  # Frontend built output (Vite)
  rsync -a --delete \
    "${REPO_DIR}/artifacts/letslearnos/dist/public/" \
    "${INSTALL_DIR}/web/" && ok "web/ synced."

  # System scripts
  rsync -a "${REPO_DIR}/system/" "${INSTALL_DIR}/system/" && ok "system/ synced."
  rsync -a "${REPO_DIR}/scripts/" "${INSTALL_DIR}/scripts/" && ok "scripts/ synced."

  # Minimal runtime package.json — the backend bundle externalizes only
  # native modules (better-sqlite3). npm cannot parse pnpm's workspace:/catalog:
  # protocols, so we must NOT copy the api-server package.json here.
  BS3_VERSION="$(node -p "require('${REPO_DIR}/artifacts/api-server/node_modules/better-sqlite3/package.json').version")"
  cat > "${INSTALL_DIR}/package.json" << PKGEOF
{
  "name": "letslearnos-runtime",
  "private": true,
  "dependencies": {
    "better-sqlite3": "${BS3_VERSION}"
  }
}
PKGEOF

  # .env — only if present in repo root
  if [[ -f "${REPO_DIR}/.env" ]]; then
    cp "${REPO_DIR}/.env" "${INSTALL_DIR}/.env"
    chmod 640 "${INSTALL_DIR}/.env"
    chown "root:${KIDS_USER}" "${INSTALL_DIR}/.env"
    ok ".env deployed (mode 640, root:kids)."
  else
    info ".env not found — using SQLite and offline narration defaults."
    info "Create ${INSTALL_DIR}/.env from .env.example for optional OpenAI narration."
  fi

  # Install production node_modules for the backend (better-sqlite3 only)
  info "Installing runtime Node.js dependencies (better-sqlite3 ${BS3_VERSION}) ..."
  cd "${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR}/node_modules" "${INSTALL_DIR}/package-lock.json"
  if npm install --omit=dev --no-audit --no-fund; then
    [[ -d "${INSTALL_DIR}/node_modules/better-sqlite3" ]] && \
      ok "Runtime node_modules installed." || \
      die "npm install ran but better-sqlite3 is missing in ${INSTALL_DIR}/node_modules."
  else
    die "npm install failed in ${INSTALL_DIR} — backend cannot start without better-sqlite3."
  fi

  # Permissions: root owns everything; world-readable for kids user
  chown -R root:root "${INSTALL_DIR}"
  chmod -R o+rX "${INSTALL_DIR}"
  chmod +x "${INSTALL_DIR}/system/kiosk-launcher.sh" \
           "${INSTALL_DIR}/system/installed-kiosk-session.sh" \
           "${INSTALL_DIR}/system/kiosk-lockdown.sh" \
           "${INSTALL_DIR}/system/parent-admin-exit.sh" 2>/dev/null || true
  # Re-tighten .env — the recursive chown/chmod above just made it root:root 644.
  if [[ -f "${INSTALL_DIR}/.env" ]]; then
    chown "root:${KIDS_USER}" "${INSTALL_DIR}/.env"
    chmod 640 "${INSTALL_DIR}/.env"
  fi
  ok "Permissions set: root:root, world-readable, scripts executable, .env 640."
fi

# ---------------------------------------------------------------------------
# Step 6 — Database
# ---------------------------------------------------------------------------
step "6/11: Database (SQLite)"

KIDS_DATA_DIR="${KIDS_HOME}/.local/share/letslearnos"
DB_PATH="${KIDS_DATA_DIR}/db.sqlite"

mkdir -p "${KIDS_DATA_DIR}"
chown -R "${KIDS_USER}:${KIDS_USER}" "${KIDS_DATA_DIR}"
chmod 750 "${KIDS_DATA_DIR}"

if [[ -f "${DB_PATH}" ]]; then
  ok "Database already exists at ${DB_PATH} — not touched."
else
  info "Database will be initialized on first run via Drizzle migrations."
  info "Set DATABASE_URL=sqlite:${DB_PATH} in ${INSTALL_DIR}/.env"
  ok "Data directory prepared: ${KIDS_DATA_DIR}"
fi

# Write .env defaults if no .env file present
if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  cat > "${INSTALL_DIR}/.env" << ENVEOF
# LetsLearnOS — generated by install.sh
DATABASE_URL=sqlite:${DB_PATH}
APP_ENV=kiosk
NODE_ENV=production
PORT=8765
OPENAI_TTS_CACHE_DIR=${KIDS_DATA_DIR}/openai-tts
ENVEOF
  chmod 640 "${INSTALL_DIR}/.env"
  chown "root:${KIDS_USER}" "${INSTALL_DIR}/.env"
  ok ".env created with SQLite defaults."
fi

# ---------------------------------------------------------------------------
# Step 7 — Generic first-run profiles
# ---------------------------------------------------------------------------
step "7/11: Configure generic first-run profiles"

info "Profiles are seeded automatically when the kiosk backend starts."
info "  Learner One: age 5, generic avatar, no limit"
info "  Learner Two: age 3, generic avatar, no limit"
ok "Profile seeding configured (auto-seeds on first run)."

# ---------------------------------------------------------------------------
# Step 8 — Install systemd user unit
# ---------------------------------------------------------------------------
step "8/11: Install systemd user unit"

KIDS_SYSTEMD_DIR="${KIDS_HOME}/.config/systemd/user"
mkdir -p "${KIDS_SYSTEMD_DIR}"
chown -R "${KIDS_USER}:${KIDS_USER}" "${KIDS_HOME}/.config"

if [[ -f "${SERVICE_SRC}" ]]; then
  cp "${SERVICE_SRC}" "${KIDS_SYSTEMD_DIR}/${SERVICE_NAME}"
  chown "${KIDS_USER}:${KIDS_USER}" "${KIDS_SYSTEMD_DIR}/${SERVICE_NAME}"

  # Enable the unit as the kids user. On a truly fresh install the kids user
  # manager is not running yet (linger only comes in Step 11), and systemd
  # never auto-enables units on login — so when systemctl --user fails, create
  # the [Install] symlink (WantedBy=graphical-session.target) directly as root.
  if sudo -u "${KIDS_USER}" \
      XDG_RUNTIME_DIR="/run/user/${KIDS_UID}" \
      systemctl --user enable "${SERVICE_NAME}" 2>/dev/null; then
    ok "letslearnos.service enabled for ${KIDS_USER} user."
  else
    WANTS_DIR="${KIDS_SYSTEMD_DIR}/graphical-session.target.wants"
    mkdir -p "${WANTS_DIR}"
    ln -sf "../${SERVICE_NAME}" "${WANTS_DIR}/${SERVICE_NAME}"
    chown -R "${KIDS_USER}:${KIDS_USER}" "${KIDS_SYSTEMD_DIR}"
    ok "User manager not running — enablement symlink created directly (graphical-session.target.wants)."
  fi
else
  warn "${SERVICE_SRC} not found — service NOT installed."
fi

# ---------------------------------------------------------------------------
# Step 9 — GDM3 handoff
# ---------------------------------------------------------------------------
step "9/11: Prepare GDM3 kiosk-session handoff"

# kiosk-lockdown.sh writes GDM configuration and pins the kids account to the
# dedicated Matchbox session. Keep that security-sensitive selection in one
# idempotent script instead of partially configuring a GNOME session here.
GDM_CONF="/etc/gdm3/custom.conf"
if [[ -f "${GDM_CONF}" ]]; then
  if grep -q "AutomaticLogin=${KIDS_USER}" "${GDM_CONF}"; then
    ok "GDM3 autologin already configured for ${KIDS_USER}."
  else
    cp "${GDM_CONF}" "${GDM_CONF}.bak"
    info "Run sudo bash system/kiosk-lockdown.sh to select the no-desktop session."
  fi
else
  warn "${GDM_CONF} not found — kiosk-lockdown.sh will create it."
fi

# ---------------------------------------------------------------------------
# Step 10 — Install polkit rules
# ---------------------------------------------------------------------------
step "10/11: Install polkit rules"

if [[ -f "${POLKIT_RULES_SRC}" ]]; then
  cp "${POLKIT_RULES_SRC}" "${POLKIT_RULES_DEST}"
  chmod 644 "${POLKIT_RULES_DEST}"
  ok "Installed ${POLKIT_RULES_DEST}"
else
  warn "${POLKIT_RULES_SRC} not found — polkit rules NOT installed."
fi

# ---------------------------------------------------------------------------
# Step 11 — Enable linger
# ---------------------------------------------------------------------------
step "11/11: Enable linger for '${KIDS_USER}'"

loginctl enable-linger "${KIDS_USER}" 2>/dev/null && \
  ok "Linger enabled — ${KIDS_USER} user services will start on boot." || \
  warn "loginctl enable-linger failed. Run manually: loginctl enable-linger ${KIDS_USER}"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "==========================================================================="
echo "  Installation complete."
echo "==========================================================================="
echo ""
echo "  Next steps (required):"
echo "    1. sudo bash system/kiosk-lockdown.sh   (hardens the OS for kiosk use)"
echo "    2. Reboot the device"
echo "    3. Verify autologin works and the kiosk launches"
echo "    4. Change the parent PIN from 1234 via the admin overlay (lock icon in the top bar)"
echo ""
echo "  Default profiles (auto-seeded on first run):"
echo "    Learner One — age 5 — generic avatar — no limit"
echo "    Learner Two — age 3 — generic avatar — no limit"
echo ""
echo "  Logs:  journalctl _UID=$(id -u "${KIDS_USER}") -f"
echo ""
