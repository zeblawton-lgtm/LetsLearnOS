# LetsLearnOS release QA

**Baseline:** 2026-07-18

## Automated gates

| Check | Command |
|---|---|
| Generated search content | `python3 scripts/waldo-pack.py --check` |
| Public asset manifest | `python3 scripts/verify-assets.py --repository` |
| TypeScript | `pnpm run typecheck` |
| API tests | `pnpm --filter @workspace/api-server test` |
| Frontend build | `pnpm --filter @workspace/letslearnos build` |
| Backend build | `pnpm --filter @workspace/api-server build` |
| Shell syntax | `find scripts system iso -name '*.sh' -print0 \| xargs -0 -r bash -n` |
| Python syntax | `python3 -m py_compile scripts/*.py` |
| Public-source audit | `scripts/audit-public-release.sh` |

Linux x64 CI is authoritative for native build packages and the ISO. A release
is pending until the exact commit passes CI and the hardware checklist below.

## Functional contract

- Fresh databases seed generic learner profiles and a hashed bootstrap PIN.
- Sessions record progress without time-based blocking.
- Math and explanations are deterministic templates.
- Missing optional art uses the neutral local fallback.
- OpenAI narration is optional, backend-only, and falls back to browser speech.
- Parent mutations require short-lived bearer authorization.
- The kiosk backend listens on loopback.

## Hardware checklist

1. Boot the workflow-built image without network access.
2. Verify touch coordinates, scaling, 88 px controls, audio, and GPU modules.
3. Complete activities with both sample profiles and confirm persistence after
   reboot.
4. Exercise the parent PIN, PIN change, worksheets, and session end.
5. Confirm a Chromium/backend crash relaunches without exposing a desktop.
6. Test browser narration with no API key.
7. If OpenAI narration is configured, test English/Spanish, then disconnect the
   network and confirm browser fallback.
