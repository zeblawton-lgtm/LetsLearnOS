# LetsLearnOS ISO build guide

The ISO pipeline creates an x86_64 Ubuntu 24.04 hybrid BIOS/UEFI live image with
an appended ext4 persistence partition. It installs the same frontend/backend
layout as `scripts/install.sh` and starts a restricted Matchbox/Chromium kiosk
session for the `kids` account.

## Recommended: GitHub Actions

Run the `Build kiosk ISO` workflow. It installs dependencies, verifies public
content, builds both packages, assembles the image on Ubuntu 24.04, checks the
boot metadata/checksum, and uploads the ISO artifact.

## Local Linux build

Run on Ubuntu 24.04 x86_64:

```bash
pnpm install --frozen-lockfile
python3 scripts/waldo-pack.py --check
python3 scripts/verify-assets.py --repository
pnpm --filter @workspace/letslearnos build
pnpm --filter @workspace/api-server build
sudo bash iso/build-iso.sh
```

Output:

```text
dist/letslearnos.iso
dist/checksums.txt
```

The script validates its temporary build directory, downloads only pinned
Ubuntu/Node/Chromium build inputs, and never writes to a mounted target device.

## Flashing

Flashing destroys the selected target device. A human administrator must first
identify and unmount the exact USB device, verify its capacity/model, and then
use an appropriate imaging tool. Never use a broad path, unresolved variable,
or guessed device name.

After flashing, disable Secure Boot (the custom GRUB image is unsigned), boot
the UEFI USB entry, and complete the hardware checklist in
`docs/qa/release-test-report.md`.

## Persistence and data

The image includes a labeled persistence partition. The kiosk database and
browser state survive reboot. Fresh databases create generic learner profiles.
Back up persistent data before rebuilding or replacing the device.

## OpenAI configuration

The image works without OpenAI. To enable optional narration, a human
administrator adds `OPENAI_API_KEY` to `/opt/letslearnos/.env`, applies strict
file permissions, and restarts the service. No credential is baked into the ISO
or GitHub Actions.
