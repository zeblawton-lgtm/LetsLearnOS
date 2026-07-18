#!/usr/bin/env bash
# Build the LetsLearnOS Ubuntu 24.04 live kiosk image.
#
# The resulting image boots on legacy BIOS and x86_64 UEFI systems. Chromium
# is seeded into the image as a snap, so first boot does not need a network.
# A labeled ext4 persistence partition is appended to the hybrid image; after
# the image is flashed to writable media, the kiosk database and browser state
# survive reboots.
#
# Run only on an amd64 Ubuntu host. This script intentionally writes only below
# /tmp and the repository's dist/ directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WORK_DIR="${WORK_DIR:-/tmp/letslearnos-build}"
DIST_DIR="$ROOT_DIR/dist"
ISO_NAME="letslearnos.iso"
UBUNTU_MIRROR="${UBUNTU_MIRROR:-http://archive.ubuntu.com/ubuntu}"
UBUNTU_RELEASE="noble"
PERSISTENCE_SIZE_MB="${PERSISTENCE_SIZE_MB:-1024}"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "Run as root: sudo bash iso/build-iso.sh"
[[ "$(uname -m)" == "x86_64" ]] || \
  die "The ISO must be built on x86_64 Linux (the target architecture)."

# WORK_DIR is recursively recreated below. Keep that destructive operation
# narrowly constrained even when the environment variable is overridden.
case "$WORK_DIR" in
  /tmp/letslearnos-*|/var/tmp/letslearnos-*) ;;
  *) die "WORK_DIR must be /tmp/letslearnos-* or /var/tmp/letslearnos-*." ;;
esac
[[ "$PERSISTENCE_SIZE_MB" =~ ^[0-9]+$ ]] || \
  die "PERSISTENCE_SIZE_MB must be an integer."
(( PERSISTENCE_SIZE_MB >= 512 )) || \
  die "PERSISTENCE_SIZE_MB must be at least 512."

for tool in \
  debootstrap xorriso mksquashfs grub-mkstandalone mkfs.vfat mmd mcopy \
  mkfs.ext4 snap curl sha256sum tar xz rsync; do
  command -v "$tool" >/dev/null 2>&1 || \
    die "Required tool '$tool' is missing. See iso/README.md."
done

BIOS_GRUB_DIR="/usr/lib/grub/i386-pc"
[[ -f "$BIOS_GRUB_DIR/cdboot.img" ]] || \
  die "Missing $BIOS_GRUB_DIR/cdboot.img (install grub-pc-bin)."
[[ -f "$BIOS_GRUB_DIR/boot_hybrid.img" ]] || \
  die "Missing $BIOS_GRUB_DIR/boot_hybrid.img (install grub-pc-bin)."
[[ -d /usr/lib/grub/x86_64-efi ]] || \
  die "Missing x86_64 GRUB modules (install grub-efi-amd64-bin)."

for required in \
  "$ROOT_DIR/artifacts/letslearnos/dist/public/index.html" \
  "$ROOT_DIR/artifacts/api-server/dist/index.mjs" \
  "$SCRIPT_DIR/runtime-package.json"; do
  [[ -f "$required" ]] || die "Missing build artifact: $required. Build the app first."
done

CHROOT="$WORK_DIR/chroot"
ISO_ROOT="$WORK_DIR/iso"
GRUB_CFG="$WORK_DIR/grub.cfg"
EFI_IMG="$WORK_DIR/efiboot.img"
PERSIST_IMG="$WORK_DIR/persistence.img"
MODEL_ASSERTION="$WORK_DIR/generic-classic.model"
BOOT_REPORT="$WORK_DIR/boot-report.txt"

echo "=== LetsLearnOS ISO build ==="
echo "Ubuntu: $UBUNTU_RELEASE (amd64)"
echo "Work directory: $WORK_DIR"
echo "Output: $DIST_DIR/$ISO_NAME"

rm -rf -- "$WORK_DIR"
mkdir -p "$CHROOT" "$ISO_ROOT/live" "$ISO_ROOT/boot/grub/i386-pc" \
  "$DIST_DIR"

echo "[1/10] Bootstrapping Ubuntu $UBUNTU_RELEASE..."
debootstrap --arch=amd64 "$UBUNTU_RELEASE" "$CHROOT" "$UBUNTU_MIRROR"

echo "[2/10] Installing and configuring kiosk packages..."
bash "$SCRIPT_DIR/chroot-customize.sh" "$CHROOT"

echo "[3/10] Seeding Chromium for offline first boot..."
curl --fail --location --silent --show-error \
  -H 'Accept: application/x.ubuntu.assertion' \
  'https://assertions.ubuntu.com/v1/assertions/model/16/generic/generic-classic' \
  --output "$MODEL_ASSERTION"
grep -q '^type: model$' "$MODEL_ASSERTION" || \
  die "The generic-classic model assertion download was invalid."

# prepare-image deliberately does not resolve a snap's bases or content
# default-providers. Keep this list closed over Chromium's runtime dependency
# graph so the classic seed can be installed without network access:
#   snapd is the essential snap required by a modern classic seed
#   chromium (core24) -> GNOME, Mesa, themes, and CUPS providers
#   gtk-common-themes -> bare; CUPS -> core22
SNAP_SEED=(
  snapd=latest/stable
  bare=latest/stable
  core22=latest/stable
  core24=latest/stable
  gtk-common-themes=latest/stable
  gnome-46-2404=latest/stable
  mesa-2404=latest/stable
  cups=latest/stable
  chromium=latest/stable
)
SNAP_SEED_ARGS=()
for snap_spec in "${SNAP_SEED[@]}"; do
  SNAP_SEED_ARGS+=("--snap=$snap_spec")
done
snap prepare-image --classic --arch=amd64 \
  "${SNAP_SEED_ARGS[@]}" \
  "$MODEL_ASSERTION" "$CHROOT"
SEED_DIR="$CHROOT/var/lib/snapd/seed"
SEED_YAML="$SEED_DIR/seed.yaml"
[[ -f "$SEED_YAML" ]] || \
  die "snap prepare-image did not create the classic seed at $SEED_YAML."
[[ -d "$SEED_DIR/snaps" ]] || \
  die "snap prepare-image did not create the classic snap payload directory."
shopt -s nullglob
for snap_spec in "${SNAP_SEED[@]}"; do
  snap_name="${snap_spec%%=*}"
  seeded_snap_files=("$SEED_DIR/snaps/${snap_name}"_*.snap)
  (( ${#seeded_snap_files[@]} > 0 )) || \
    die "The classic snap seed payload does not contain $snap_name."
done
shopt -u nullglob
snap debug validate-seed "$SEED_YAML"

echo "[4/10] Copying the built application and runtime dependencies..."
bash "$SCRIPT_DIR/copy-assets.sh" "$CHROOT"

echo "[5/10] Selecting kernel and initrd..."
mapfile -t KERNELS < <(find "$CHROOT/boot" -maxdepth 1 -type f \
  -name 'vmlinuz-*' -print | sort -V)
(( ${#KERNELS[@]} > 0 )) || die "No kernel was installed in the chroot."
KERNEL_PATH="${KERNELS[$(( ${#KERNELS[@]} - 1 ))]}"
KERNEL_FILE="${KERNEL_PATH##*/}"
KERNEL_VERSION="${KERNEL_FILE#vmlinuz-}"
INITRD_PATH="$CHROOT/boot/initrd.img-$KERNEL_VERSION"
[[ -f "$INITRD_PATH" ]] || die "Missing initrd for kernel $KERNEL_VERSION."
cp "$KERNEL_PATH" "$ISO_ROOT/live/vmlinuz"
cp "$INITRD_PATH" "$ISO_ROOT/live/initrd"

echo "[6/10] Creating compressed live filesystem..."
du -sx --block-size=1 "$CHROOT" | cut -f1 > "$ISO_ROOT/live/filesystem.size"
mksquashfs "$CHROOT" "$ISO_ROOT/live/filesystem.squashfs" \
  -noappend -comp xz -b 1M -e boot

echo "[7/10] Building BIOS and UEFI GRUB boot images..."
cat > "$GRUB_CFG" << 'GRUBCFG'
set timeout=3
set default=0
search --no-floppy --file --set=root /live/vmlinuz

menuentry "LetsLearnOS" {
    linux /live/vmlinuz boot=live persistence quiet splash --
    initrd /live/initrd
}
GRUBCFG
cp "$GRUB_CFG" "$ISO_ROOT/boot/grub/grub.cfg"

# i386-pc core images have a hard size limit. A standalone image otherwise
# embeds every GRUB module, locale, font, and theme, which is far too large.
# Install only the modules needed to find this hybrid ISO and boot Linux.
BIOS_GRUB_INSTALL_MODULES="linux normal iso9660 biosdisk memdisk search search_fs_file tar part_gpt part_msdos"
BIOS_GRUB_PRELOAD_MODULES="linux normal iso9660 biosdisk search search_fs_file part_gpt part_msdos"
grub-mkstandalone \
  --format=i386-pc \
  --output="$WORK_DIR/core.img" \
  --install-modules="$BIOS_GRUB_INSTALL_MODULES" \
  --modules="$BIOS_GRUB_PRELOAD_MODULES" \
  --locales="" \
  --fonts="" \
  --themes="" \
  "boot/grub/grub.cfg=$GRUB_CFG"
cat "$BIOS_GRUB_DIR/cdboot.img" "$WORK_DIR/core.img" \
  > "$ISO_ROOT/boot/grub/i386-pc/eltorito.img"

EFI_GRUB_INSTALL_MODULES="linux normal iso9660 memdisk search search_fs_file tar part_gpt part_msdos efi_gop"
EFI_GRUB_PRELOAD_MODULES="linux normal iso9660 search search_fs_file part_gpt part_msdos efi_gop"
grub-mkstandalone \
  --format=x86_64-efi \
  --output="$WORK_DIR/BOOTX64.EFI" \
  --install-modules="$EFI_GRUB_INSTALL_MODULES" \
  --modules="$EFI_GRUB_PRELOAD_MODULES" \
  --locales="" \
  --fonts="" \
  --themes="" \
  "boot/grub/grub.cfg=$GRUB_CFG"
truncate -s 20M "$EFI_IMG"
# FAT volume labels are limited to 11 characters.
mkfs.vfat -n LETSLEARN "$EFI_IMG"
mmd -i "$EFI_IMG" ::/EFI ::/EFI/BOOT
mcopy -i "$EFI_IMG" "$WORK_DIR/BOOTX64.EFI" ::/EFI/BOOT/BOOTX64.EFI

echo "[8/10] Creating ${PERSISTENCE_SIZE_MB} MiB persistence partition..."
mkdir -p "$WORK_DIR/persistence-root"
printf '/ union\n' > "$WORK_DIR/persistence-root/persistence.conf"
truncate -s "${PERSISTENCE_SIZE_MB}M" "$PERSIST_IMG"
mkfs.ext4 -F -L persistence -d "$WORK_DIR/persistence-root" "$PERSIST_IMG"

echo "[9/10] Assembling hybrid ISO..."
xorriso -as mkisofs \
  -iso-level 3 \
  -full-iso9660-filenames \
  -volid LETSLEARNOS \
  -eltorito-boot boot/grub/i386-pc/eltorito.img \
  -eltorito-catalog boot/grub/boot.cat \
  -no-emul-boot \
  -boot-load-size 4 \
  -boot-info-table \
  --grub2-boot-info \
  --grub2-mbr "$BIOS_GRUB_DIR/boot_hybrid.img" \
  -partition_offset 16 \
  -append_partition 2 0xef "$EFI_IMG" \
  -append_partition 3 0x83 "$PERSIST_IMG" \
  -appended_part_as_gpt \
  -eltorito-alt-boot \
  -e --interval:appended_partition_2:all:: \
  -no-emul-boot \
  -output "$DIST_DIR/$ISO_NAME" \
  "$ISO_ROOT"

echo "[10/10] Writing checksum and inspecting boot metadata..."
(
  cd "$DIST_DIR"
  sha256sum "$ISO_NAME" > checksums.txt
)
xorriso -indev "$DIST_DIR/$ISO_NAME" \
  -report_el_torito plain -report_system_area plain \
  > "$BOOT_REPORT" 2>&1
cat "$BOOT_REPORT"
grep -q 'BIOS' "$BOOT_REPORT" || die "ISO report has no BIOS boot image."
grep -q 'UEFI' "$BOOT_REPORT" || die "ISO report has no UEFI boot image."
grep -q 'GPT' "$BOOT_REPORT" || die "ISO report has no GPT system area."

echo
echo "=== Build complete ==="
echo "ISO: $DIST_DIR/$ISO_NAME"
echo "Checksum: $DIST_DIR/checksums.txt"
echo "Secure Boot must be disabled because this custom GRUB image is unsigned."
