#!/usr/bin/env bash
# Install packages and configure the restricted ISO kiosk session.
set -euo pipefail

CHROOT="${1:?Usage: chroot-customize.sh <chroot-path>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGES_FILE="$SCRIPT_DIR/packages.list"

[[ "${EUID}" -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ -d "$CHROOT/etc" ]] || { echo "Invalid chroot: $CHROOT" >&2; exit 1; }
[[ -f "$PACKAGES_FILE" ]] || { echo "Missing $PACKAGES_FILE" >&2; exit 1; }

cleanup() {
  rm -f "$CHROOT/usr/sbin/policy-rc.d"
  umount -R "$CHROOT/sys" 2>/dev/null || true
  umount -R "$CHROOT/proc" 2>/dev/null || true
  umount -R "$CHROOT/dev" 2>/dev/null || true
}
trap cleanup EXIT

mount --rbind /dev "$CHROOT/dev"
mount --make-rslave "$CHROOT/dev"
mount -t proc proc "$CHROOT/proc"
mount -t sysfs sysfs "$CHROOT/sys"

cat > "$CHROOT/etc/apt/sources.list" << 'EOF'
deb http://archive.ubuntu.com/ubuntu noble main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu noble-updates main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu noble-security main restricted universe multiverse
EOF

# Prevent package post-install scripts from trying to start daemons inside the
# build chroot. Services are enabled explicitly for first boot below.
cat > "$CHROOT/usr/sbin/policy-rc.d" << 'EOF'
#!/bin/sh
exit 101
EOF
chmod 0755 "$CHROOT/usr/sbin/policy-rc.d"

mapfile -t PACKAGES < <(sed -e 's/#.*$//' -e '/^[[:space:]]*$/d' "$PACKAGES_FILE")
chroot "$CHROOT" /usr/bin/env DEBIAN_FRONTEND=noninteractive \
  apt-get update -q
chroot "$CHROOT" /usr/bin/env DEBIAN_FRONTEND=noninteractive \
  apt-get install -y --no-install-recommends "${PACKAGES[@]}"

chroot "$CHROOT" /bin/bash << 'INNERSCRIPT'
set -euo pipefail

if ! id kids >/dev/null 2>&1; then
  useradd --create-home --shell /usr/sbin/nologin kids
fi
for group in audio video input render; do
  if getent group "$group" >/dev/null; then
    usermod -a -G "$group" kids
  fi
done
passwd --lock kids >/dev/null

mkdir -p /etc/lightdm/lightdm.conf.d /usr/share/xsessions
cat > /etc/lightdm/lightdm.conf.d/50-letslearnos.conf << 'EOF'
[Seat:*]
autologin-user=kids
autologin-user-timeout=0
user-session=letslearnos-kiosk
greeter-hide-users=true
allow-guest=false
EOF

cat > /usr/share/xsessions/letslearnos-kiosk.desktop << 'EOF'
[Desktop Entry]
Name=LetsLearnOS Kiosk
Comment=Restricted child kiosk session
Exec=/opt/letslearnos/system/iso-kiosk-session.sh
TryExec=/opt/letslearnos/system/iso-kiosk-session.sh
Type=Application
DesktopNames=LetsLearnOS
EOF

# Chromium is seeded into the classic image after this script runs. Do not let
# LightDM race the snap seed service on first boot.
mkdir -p /etc/systemd/system/lightdm.service.d
cat > /etc/systemd/system/lightdm.service.d/50-letslearnos.conf << 'EOF'
[Unit]
Wants=snapd.seeded.service
After=snapd.seeded.service
EOF

systemctl enable lightdm.service NetworkManager.service snapd.service

# No text login consoles are exposed to the kids session. The graphical kiosk
# remains the only login surface on this dedicated image.
for tty in 1 2 3 4 5 6; do
  systemctl mask "getty@tty${tty}.service"
done
systemctl mask \
  sleep.target suspend.target hibernate.target hybrid-sleep.target

mkdir -p /var/lib/letslearnos /home/kids/.local/share/letslearnos
chown -R kids:kids /var/lib/letslearnos /home/kids
chmod 0750 /var/lib/letslearnos /home/kids/.local/share/letslearnos

apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
INNERSCRIPT

echo "Chroot customization complete."
