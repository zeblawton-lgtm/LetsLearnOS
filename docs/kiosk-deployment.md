# Kiosk deployment

LetsLearnOS targets an x86_64 Ubuntu LTS laptop or 2-in-1 with Chromium and
hardware-accelerated graphics. The reference layout uses 200% Chromium scaling
for a 4K touchscreen; administrators can change `CHROMIUM_SCALE_FACTOR` for a
different display.

## Option A: persistent USB image

1. Build the image by following `iso/README.md` or running the ISO workflow.
2. Verify `dist/checksums.txt`.
3. Flash `dist/letslearnos.iso` to a correctly identified USB device.
4. Disable Secure Boot because the custom GRUB image is unsigned.
5. Boot the UEFI USB entry.

The appended persistence partition retains SQLite data and browser state.

## Option B: existing Ubuntu installation

```bash
git clone https://github.com/zeblawton-lgtm/LetsLearnOS.git
cd LetsLearnOS
sudo bash scripts/install.sh
sudo bash system/kiosk-lockdown.sh
sudo reboot
```

Review every privileged script before running it. Repository agents produce and
verify these scripts but do not execute them.

## Optional OpenAI narration

Create `/opt/letslearnos/.env` from `.env.example`, add a server-side
`OPENAI_API_KEY`, restrict the file to the administrator and kiosk service
account, then restart `letslearnos.service`. Leave the key blank for offline
browser narration. Never put the key in frontend files.

## Kiosk account

The installer and lockdown script create/configure a `kids` account with:

- no sudo, password login, interactive shell, or desktop;
- a dedicated Matchbox session that starts Chromium only;
- polkit restrictions for system, package, power, and network changes;
- masked text gettys and sleep targets; and
- a backend bound to loopback.

## Parent recovery

Use the on-screen parent control to end a session. For maintenance from the
parent account:

```bash
sudo -u kids XDG_RUNTIME_DIR=/run/user/$(id -u kids) \
  systemctl --user stop letslearnos.service

sudo -u kids XDG_RUNTIME_DIR=/run/user/$(id -u kids) \
  systemctl --user start letslearnos.service
```

Stopping the service leaves a blank restricted session; it does not expose a
desktop to the kiosk account.

## Data

Kiosk SQLite data defaults to:

```text
/home/kids/.local/share/letslearnos/db.sqlite
```

Back up that file before resetting or replacing a kiosk. Deletion is destructive
and should be performed only by a human administrator who has confirmed the
exact path.

## Static network configuration

LetsLearnOS contains no site-specific addresses. If a deployment genuinely
requires a static address, set the explicit `LETSLEARNOS_STATIC_*` variables and
have an administrator review and run `scripts/configure-static-ip.sh`.
