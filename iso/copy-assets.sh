#!/usr/bin/env bash
# Copy pre-built LetsLearnOS artifacts into the ISO chroot and install the one
# native Node runtime dependency inside that amd64 chroot.
set -euo pipefail

CHROOT="${1:?Usage: copy-assets.sh <chroot-path>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DEST="$CHROOT/opt/letslearnos"
NODE_VERSION="22.23.1"
NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"
NODE_SHA256="9749e988f437343b7fa832c69ded82a312e41a03116d766797ac14f6f9eee578"
NODE_DOWNLOAD="https://nodejs.org/download/release/v${NODE_VERSION}/${NODE_ARCHIVE}"

[[ "${EUID}" -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ -d "$CHROOT/etc" ]] || { echo "Invalid chroot: $CHROOT" >&2; exit 1; }
[[ -f "$ROOT_DIR/artifacts/letslearnos/dist/public/index.html" ]] || {
  echo "Frontend build is missing. See iso/README.md." >&2
  exit 1
}
[[ -f "$ROOT_DIR/artifacts/api-server/dist/index.mjs" ]] || {
  echo "Backend build is missing. See iso/README.md." >&2
  exit 1
}

mkdir -p "$DEST/api-dist" "$DEST/web" "$DEST/system"
rsync -a --delete "$ROOT_DIR/artifacts/api-server/dist/" "$DEST/api-dist/"
rsync -a --delete "$ROOT_DIR/artifacts/letslearnos/dist/public/" "$DEST/web/"
rsync -a --delete "$ROOT_DIR/system/" "$DEST/system/"
cp "$SCRIPT_DIR/runtime-package.json" "$DEST/package.json"

echo "Installing pinned Node.js ${NODE_VERSION} runtime..."
NODE_TMP="$CHROOT/tmp/$NODE_ARCHIVE"
curl --fail --location --silent --show-error "$NODE_DOWNLOAD" --output "$NODE_TMP"
printf '%s  %s\n' "$NODE_SHA256" "$NODE_TMP" | sha256sum --check --status
mkdir -p "$DEST/runtime"
tar -xJf "$NODE_TMP" --strip-components=1 -C "$DEST/runtime"
rm -f "$NODE_TMP"
[[ "$(chroot "$CHROOT" /opt/letslearnos/runtime/bin/node --version)" == "v${NODE_VERSION}" ]] || {
  echo "Pinned Node.js runtime verification failed." >&2
  exit 1
}

chmod 0755 "$DEST/system/"*.sh
chown -R root:root "$DEST"
chmod -R a+rX "$DEST"

echo "Installing the pinned better-sqlite3 runtime inside the image..."
cleanup() {
  umount -R "$CHROOT/sys" 2>/dev/null || true
  umount -R "$CHROOT/proc" 2>/dev/null || true
  umount -R "$CHROOT/dev" 2>/dev/null || true
}
trap cleanup EXIT
mount --rbind /dev "$CHROOT/dev"
mount --make-rslave "$CHROOT/dev"
mount -t proc proc "$CHROOT/proc"
mount -t sysfs sysfs "$CHROOT/sys"
chroot "$CHROOT" /bin/bash -c \
  'export PATH=/opt/letslearnos/runtime/bin:/usr/bin:/bin; cd /opt/letslearnos && npm install --omit=dev --no-audit --no-fund'
[[ -f "$DEST/node_modules/better-sqlite3/package.json" ]] || {
  echo "better-sqlite3 did not install; the backend cannot start." >&2
  exit 1
}

# The same deny rules used by the installed kiosk apply to the ISO session.
mkdir -p "$CHROOT/etc/polkit-1/rules.d"
cp "$ROOT_DIR/system/50-kids.rules" \
  "$CHROOT/etc/polkit-1/rules.d/50-kids.rules"
chmod 0644 "$CHROOT/etc/polkit-1/rules.d/50-kids.rules"

echo "Application copied to $DEST."
