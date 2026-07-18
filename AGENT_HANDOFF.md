# LetsLearnOS Agent Handoff

This file points to live project sources rather than recording machine-specific
state.

## Canonical state

- Repository and deployment branch: `main`.
- Product specification: `GOAL.md`.
- Contributor conventions: `AGENTS.md`.
- Architecture decisions: append-only `DECISIONS.md`.

Before changing anything:

```bash
git status --short
git branch --show-current
git log --oneline -3
```

Preserve pre-existing worktree changes. Inspect a target kiosk directly when
deployment state matters; never infer it from documentation.

## Verification

```bash
python3 scripts/waldo-pack.py --check
python3 scripts/verify-assets.py --repository
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/letslearnos build
pnpm --filter @workspace/api-server build
find scripts system iso -type f -name '*.sh' -print0 | xargs -0 -r bash -n
```

Linux x64 CI is authoritative for pinned native packages and the ISO build.

## Deployment

- Existing Ubuntu kiosk: a human administrator runs `scripts/install.sh` or
  `scripts/update.sh`.
- Persistent USB image: follow `iso/README.md` or run the ISO workflow.
- Never execute host-mutating install/lockdown scripts from an automated agent.

## Handoff report

Report files changed, one verification command or short procedure, remaining
work, and any architectural decision that belongs in `DECISIONS.md`.
