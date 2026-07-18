# Contributing to LetsLearnOS

Read `GOAL.md` and `AGENTS.md` before opening a change. Keep contributions
focused, child-safe, offline-capable, and testable.

## Development

```bash
pnpm install
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/letslearnos build
pnpm --filter @workspace/api-server build
```

Use conventional, descriptive commits. Add tests for behavior changes and a
dated ADR for architecture changes.

## Public-content rules

- Never commit credentials, `.env`, personal profile data, private hosts, or
  internal infrastructure details.
- Never commit artwork, music, text, or datasets without redistribution rights.
- Do not put OpenAI keys in frontend code or accept them through browser forms.
- Do not add child-facing chat or model-generated math/lessons.
- Keep OpenAI optional and preserve the offline fallback.

By contributing, you agree that your contribution is licensed under MIT and
that you have the right to submit all included material.
