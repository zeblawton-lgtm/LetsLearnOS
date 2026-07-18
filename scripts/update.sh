#!/usr/bin/env bash
# =============================================================================
# update.sh — LetsLearnOS update script
#
# Run as root on an already-installed kiosk (after scripts/install.sh):
#
#   sudo bash scripts/update.sh            # pull + build + deploy + restart
#   sudo bash scripts/update.sh --no-pull  # deploy current checkout as-is
#
# WHAT THIS SCRIPT DOES:
#   1. git pull main, or LETSLEARNOS_UPDATE_REF (unless --no-pull)
#   2. pnpm install + build frontend & backend
#   3. rsync built output to /opt/letslearnos/ (same layout as install.sh)
#   4. Refresh the installed systemd user unit (same as install.sh Step 8)
#   5. Restart letslearnos.service for the kids user
#   6. Optionally save an explicitly configured static IPv4 profile
#
# It does NOT touch: user accounts, system packages, GDM autologin, polkit,
# lockdown settings, the SQLite database, or /opt/letslearnos/.env.
# Profiles and session history are preserved.
#
# IDEMPOTENCY: Re-running this script is safe.
# =============================================================================

set -euo pipefail

INSTALL_DIR="/opt/letslearnos"
KIDS_USER="kids"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="letslearnos.service"

info() { echo "    $*"; }
ok()   { echo "    [OK] $*"; }
warn() { echo "    [WARN] $*"; }
die()  { echo ""; echo "FATAL: $*" >&2; exit 1; }
step() { echo ""; echo "==> $*"; }

[[ "${EUID}" -eq 0 ]] || die "Run as root: sudo bash scripts/update.sh"
[[ -d "${INSTALL_DIR}" ]] || die "${INSTALL_DIR} not found — run scripts/install.sh first."
[[ -f "${REPO_DIR}/artifacts/api-server/package.json" ]] || \
  die "Not a LetsLearnOS checkout: ${REPO_DIR}"

NO_PULL=0
[[ "${1:-}" == "--no-pull" ]] && NO_PULL=1

# ---------------------------------------------------------------------------
# 1. Pull latest code
# ---------------------------------------------------------------------------
if [[ "${NO_PULL}" -eq 0 ]]; then
  # main is canonical (ADR-015). This intentionally migrates kiosks whose
  # checkout is still parked on the retired repair branch.
  UPDATE_REF="${LETSLEARNOS_UPDATE_REF:-main}"
  step "Pulling latest code (origin/${UPDATE_REF})"
  git -C "${REPO_DIR}" fetch origin "${UPDATE_REF}" || \
    die "git fetch failed for origin/${UPDATE_REF}."
  git -C "${REPO_DIR}" checkout "${UPDATE_REF}" || \
    die "git checkout failed for ${UPDATE_REF}."
  git -C "${REPO_DIR}" pull --ff-only origin "${UPDATE_REF}" || \
    die "git pull failed. Fix the checkout or re-run with --no-pull."
  ok "Now at $(git -C "${REPO_DIR}" log --oneline -1)"
else
  step "Skipping git pull (--no-pull)"
  info "Deploying $(git -C "${REPO_DIR}" log --oneline -1 2>/dev/null || echo 'current checkout')"
fi

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
step "Building application"
cd "${REPO_DIR}"

pnpm install --frozen-lockfile || pnpm install
ok "pnpm install complete."

BASE_PATH=/ pnpm --filter @workspace/letslearnos run build
ok "Frontend built → artifacts/letslearnos/dist/public/"

pnpm --filter @workspace/api-server run build
ok "Backend built → artifacts/api-server/dist/"

# ---------------------------------------------------------------------------
# 3. Deploy to /opt/letslearnos/
# ---------------------------------------------------------------------------
step "Deploying to ${INSTALL_DIR}/"

rsync -a --delete \
  "${REPO_DIR}/artifacts/api-server/dist/" \
  "${INSTALL_DIR}/api-dist/" && ok "api-dist/ synced."

rsync -a --delete \
  "${REPO_DIR}/artifacts/letslearnos/dist/public/" \
  "${INSTALL_DIR}/web/" && ok "web/ synced."

rsync -a "${REPO_DIR}/system/" "${INSTALL_DIR}/system/" && ok "system/ synced."
# scripts/ is a pnpm workspace package — its node_modules are store symlinks
# that dangle outside the repo, so they must not be deployed.
rsync -a --exclude node_modules --exclude __pycache__ \
  "${REPO_DIR}/scripts/" "${INSTALL_DIR}/scripts/" && ok "scripts/ synced."

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

# Refresh runtime node_modules only when the required version changed
INSTALLED_BS3="$(node -p "try{require('${INSTALL_DIR}/node_modules/better-sqlite3/package.json').version}catch{''}" 2>/dev/null)"
if [[ "${INSTALLED_BS3}" == "${BS3_VERSION}" ]]; then
  ok "Runtime node_modules up to date (better-sqlite3 ${BS3_VERSION})."
else
  cd "${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR}/node_modules" "${INSTALL_DIR}/package-lock.json"
  npm install --omit=dev --no-audit --no-fund && \
    ok "Runtime node_modules updated (better-sqlite3 ${BS3_VERSION})." || \
    die "npm install failed in ${INSTALL_DIR} — backend cannot start without better-sqlite3."
fi

# Permissions (same as install.sh; .env content is untouched).
# .env must be re-tightened AFTER the recursive chmod, which re-adds o+r.
chown -R root:root "${INSTALL_DIR}"
chmod -R o+rX "${INSTALL_DIR}"
if [[ -f "${INSTALL_DIR}/.env" ]]; then
  chown "root:${KIDS_USER}" "${INSTALL_DIR}/.env"
  chmod 640 "${INSTALL_DIR}/.env"
fi
chmod +x "${INSTALL_DIR}/system/kiosk-launcher.sh" \
         "${INSTALL_DIR}/system/installed-kiosk-session.sh" \
         "${INSTALL_DIR}/system/kiosk-lockdown.sh" \
         "${INSTALL_DIR}/system/parent-admin-exit.sh" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/scripts/configure-static-ip.sh" 2>/dev/null || true
ok "Permissions set."

# ---------------------------------------------------------------------------
# 4. Refresh the installed systemd user unit (install.sh Step 8 layout)
# ---------------------------------------------------------------------------
step "Refreshing systemd user unit"

KIDS_UID="$(id -u "${KIDS_USER}")"
KIDS_SYSTEMD_DIR="/home/${KIDS_USER}/.config/systemd/user"
SERVICE_SRC="${REPO_DIR}/system/${SERVICE_NAME}"
if [[ -f "${SERVICE_SRC}" ]]; then
  mkdir -p "${KIDS_SYSTEMD_DIR}"
  cp "${SERVICE_SRC}" "${KIDS_SYSTEMD_DIR}/${SERVICE_NAME}"
  chown -R "${KIDS_USER}:${KIDS_USER}" "${KIDS_SYSTEMD_DIR}"
  if sudo -u "${KIDS_USER}" XDG_RUNTIME_DIR="/run/user/${KIDS_UID}" \
       systemctl --user daemon-reload 2>/dev/null; then
    ok "User unit refreshed and daemon reloaded."
  else
    warn "Unit copied but daemon-reload failed (no ${KIDS_USER} user manager?) — applies after reboot."
  fi
else
  warn "${SERVICE_SRC} not found — user unit not refreshed."
fi

# ---------------------------------------------------------------------------
# 5. Restart the kiosk service
# ---------------------------------------------------------------------------
step "Restarting ${SERVICE_NAME}"

if sudo -u "${KIDS_USER}" XDG_RUNTIME_DIR="/run/user/${KIDS_UID}" \
     systemctl --user restart "${SERVICE_NAME}" 2>/dev/null; then
  ok "Service restarted."
else
  warn "Could not restart service (no ${KIDS_USER} session?). Reboot to apply: sudo reboot"
fi

# ---------------------------------------------------------------------------
# 6. Configure static IP profile for the kiosk laptop
# ---------------------------------------------------------------------------
step "Checking optional static IP profile"

if [[ -n "${LETSLEARNOS_STATIC_IP:-}" && -f "${REPO_DIR}/scripts/configure-static-ip.sh" ]]; then
  bash "${REPO_DIR}/scripts/configure-static-ip.sh" || \
    warn "Static IP configuration failed; app update is still complete."
else
  info "No LETSLEARNOS_STATIC_IP supplied; network profile unchanged."
fi

echo ""
echo "==========================================================================="
echo "  Update complete: $(git -C "${REPO_DIR}" log --oneline -1 2>/dev/null)"
echo "==========================================================================="
