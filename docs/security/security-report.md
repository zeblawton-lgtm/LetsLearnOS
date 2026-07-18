# LetsLearnOS security report

**Baseline:** 2026-07-18

**Model:** parent-supervised child kiosk

## Threat model

The primary threat is a curious child attempting to leave the application or
reach operating-system controls. Secondary threats include unauthorized local
admin API calls, accidental credential exposure, and publication of private or
unlicensed material. Physical forensics and hostile remote administration are
outside the supervised-home baseline.

## Implemented controls

| Control | Implementation |
|---|---|
| Restricted account | `kids` has no sudo, password login, shell, or desktop |
| Process supervision | systemd restarts the backend/Chromium launcher |
| Local network boundary | Express binds to `127.0.0.1` |
| Parent API auth | Rate-limited PIN verification and short-lived HMAC bearer tokens |
| PIN storage | Salted digest in the database; no plaintext PIN environment variable |
| API credential boundary | `.env` is sourced only in the backend subshell; Chromium does not inherit it |
| OpenAI fallback | Missing key/provider failure returns 503 and browser speech continues |
| Content boundary | No child chat or model-generated lessons/math |
| Public-source audit | CI rejects private hosts, provider traces, secret-shaped strings, and restricted assets |

## OpenAI data flow

OpenAI narration is disabled unless a server administrator supplies
`OPENAI_API_KEY`. The backend sends only the already-authored narration string
and speech configuration to the official Speech endpoint. It does not send
profile names, ages, progress, PINs, database rows, or browser credentials.

The API key is placed in an ignored `.env`, loaded by the backend process, sent
as a bearer credential over HTTPS, and never returned to the frontend. Audio is
cached locally using a one-way hash of non-secret configuration plus text.

## Remaining risks

1. Change the bootstrap parent PIN before normal use.
2. The supervised kiosk model does not defend against a determined person with
   physical access to an unencrypted disk.
3. The custom ISO bootloader is unsigned, so Secure Boot must be disabled.
4. Administrators are responsible for file permissions on `.env`, backups, and
   any optional asset pack.
5. OpenAI usage can incur separate API charges; use project limits and monitor
   the API dashboard.
