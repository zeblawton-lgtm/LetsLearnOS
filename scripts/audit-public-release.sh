#!/usr/bin/env bash
# Reject private-development residue, credential-shaped strings, and restricted
# binary assets before public release. Patterns are assembled from fragments so
# the audit does not contain the forbidden terms it is designed to detect.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

fail=0

check_pattern() {
  local label="$1"
  local pattern="$2"
  if rg -n -i --hidden --glob '!.git/**' --glob '!scripts/audit-public-release.sh' \
    "${pattern}" .; then
    echo "ERROR: ${label} found in public tree." >&2
    fail=1
  fi
}

provider_one="clau""de"
provider_two="anth""ropic"
old_product="pok[eé]""learn"
private_ipv4_a="10""\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}"
private_ipv4_b="192""\\.168\\.[0-9]{1,3}\\.[0-9]{1,3}"
private_ipv4_c="172""\\.(1[6-9]|2[0-9]|3[01])\\.[0-9]{1,3}\\.[0-9]{1,3}"
internal_tts="koko""ro|qwen|llama\\.cpp|local-""llm|worker_""llm|(^|[^A-Z_])TTS_(URL|VOICE|SPEED)"
personal_names="\\bmich""ael\\b|\\ble""o\\b|mikes""laptop|leos""laptop"

check_pattern "unsupported assistant-provider reference" "${provider_one}|${provider_two}"
check_pattern "old product name" "${old_product}"
check_pattern "private IPv4 address" "${private_ipv4_a}|${private_ipv4_b}|${private_ipv4_c}"
check_pattern "private narration/model infrastructure" "${internal_tts}"
check_pattern "personal first-run profile or hostname" "${personal_names}"
developer_home="/Us""ers/[A-Za-z0-9._-]+/"
check_pattern "absolute developer home path" "${developer_home}"
check_pattern "secret-shaped API credential" "sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}"

restricted_assets="$(git ls-files -- \
  'artifacts/letslearnos/public/audio/*.mp3' \
  'artifacts/letslearnos/public/sprites/official-artwork/*.png')"
if [[ -n "${restricted_assets}" ]]; then
  echo "${restricted_assets}"
  echo "ERROR: optional restricted asset-pack files are tracked." >&2
  fail=1
fi

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi

echo "Public-release audit passed."
