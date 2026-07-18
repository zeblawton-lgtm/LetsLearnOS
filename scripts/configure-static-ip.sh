#!/usr/bin/env bash
# Configure the active NetworkManager connection with an administrator-supplied
# static IPv4 address. LetsLearnOS intentionally ships no site-specific hosts,
# subnets, gateways, or DNS servers.
#
# Example using the documentation-only TEST-NET-1 range:
#   LETSLEARNOS_STATIC_IP=192.0.2.50 \
#   LETSLEARNOS_STATIC_GATEWAY=192.0.2.1 \
#   sudo bash scripts/configure-static-ip.sh
#
# Optional overrides:
#   LETSLEARNOS_STATIC_PREFIX / _DEVICE / _DNS
#
# The script edits the NetworkManager profile but does not bounce the connection;
# settings apply on the next reconnect or reboot.

set -euo pipefail

info() { echo "    $*"; }
ok()   { echo "    [OK] $*"; }
warn() { echo "    [WARN] $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "Run as root: sudo bash scripts/configure-static-ip.sh"
command -v nmcli >/dev/null 2>&1 || die "NetworkManager nmcli is required."

TARGET_IP="${LETSLEARNOS_STATIC_IP:-}"
[[ -n "${TARGET_IP}" ]] || die "Set LETSLEARNOS_STATIC_IP explicitly."

PREFIX="${LETSLEARNOS_STATIC_PREFIX:-24}"
DEFAULT_ROUTE="$(ip route show default 2>/dev/null | head -n 1 || true)"
DEVICE="${LETSLEARNOS_STATIC_DEVICE:-$(awk '{for (i=1;i<=NF;i++) if ($i=="dev") {print $(i+1); exit}}' <<< "${DEFAULT_ROUTE}")}"
GATEWAY="${LETSLEARNOS_STATIC_GATEWAY:-$(awk '{for (i=1;i<=NF;i++) if ($i=="via") {print $(i+1); exit}}' <<< "${DEFAULT_ROUTE}")}"

[[ -n "${DEVICE}" ]] || die "Set LETSLEARNOS_STATIC_DEVICE or establish a default route."
[[ -n "${GATEWAY}" ]] || die "Set LETSLEARNOS_STATIC_GATEWAY explicitly."

DNS="${LETSLEARNOS_STATIC_DNS:-${GATEWAY}}"

# nmcli -g backslash-escapes ':' and '\\' in values; undo it so profiles with
# those characters can be selected correctly.
CONNECTION="$(nmcli -g GENERAL.CONNECTION device show "${DEVICE}" 2>/dev/null \
  | head -n 1 | sed 's/\\\(.\)/\1/g' || true)"
if [[ -z "${CONNECTION}" || "${CONNECTION}" == "--" ]]; then
  die "No NetworkManager connection is active for ${DEVICE}."
fi

warn "Saving a static address can make the device unreachable after reconnect."
info "Connection '${CONNECTION}': ${TARGET_IP}/${PREFIX}, gateway ${GATEWAY}, DNS ${DNS}"

nmcli connection modify "${CONNECTION}" \
  connection.autoconnect yes \
  ipv4.method manual \
  ipv4.addresses "${TARGET_IP}/${PREFIX}" \
  ipv4.gateway "${GATEWAY}" \
  ipv4.dns "${DNS}" \
  ipv4.never-default no \
  ipv6.method ignore

ok "Static IPv4 profile saved."
info "Reconnect or reboot to apply it; this script does not interrupt the current session."
