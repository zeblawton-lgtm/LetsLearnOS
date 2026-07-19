# Architecture Decisions

This file is append-only after the public LetsLearnOS baseline. Earlier private
development history is intentionally not part of the public repository.

## ADR-001 — Dual-dialect database (2026-07-18)

**Decision:** LetsLearnOS uses Drizzle with Postgres during hosted development
and SQLite on a standalone kiosk. The schemas remain structurally identical,
and SQLite applies idempotent initialization DDL on first boot.

## ADR-002 — Offline core with optional local asset packs (2026-07-18)

**Decision:** The application shell, fonts, maps, learning content, synthesized
sound effects, and neutral fallback art ship locally. Proprietary character art
and commercial music are excluded from the public repository. Administrators
may install a separately licensed local asset pack; missing files never trigger
a runtime network request and always degrade to the bundled fallback.

## ADR-003 — Optional server-side OpenAI narration (2026-07-18)

**Decision:** Browser SpeechSynthesis is the zero-configuration narration path.
When a server administrator supplies `OPENAI_API_KEY`, the backend may call the
OpenAI Speech API, cache the returned audio by model/voice/instructions/language/
text, and stream it to the same-origin frontend. Credentials never reach the
browser. Any configuration, network, quota, or provider failure returns a
service-unavailable response and the frontend immediately uses browser speech.
The UI and documentation disclose that OpenAI output is AI-generated.

## ADR-004 — Deterministic learning content (2026-07-18)

**Decision:** Math, explanations, worksheets, stories, and learning prompts are
static data or deterministic templates. LetsLearnOS has no child-facing chat and
does not generate lessons with a model at runtime. Optional OpenAI use is limited
to speech synthesis of already-authored narration.

## ADR-005 — Generic public profiles and clean history (2026-07-18)

**Decision:** Fresh databases seed generic sample learners instead of personal
names. LetsLearnOS begins with a new public Git history containing only the
generalized source tree, so private development tooling, infrastructure, assets,
and historical credentials cannot be recovered from public commits.

## ADR-006 — Restricted supervised kiosk account (2026-07-18)

**Decision:** The kiosk runs as a `kids` account without sudo, an interactive
shell, or a desktop. A parent PIN controls administrative UI. OS-changing work is
provided as reviewed scripts for a human administrator to run.

## ADR-007 — Separate adult-facing showcase (2026-07-19)

**Decision:** The public marketing and project-explainer site is a separate
Next.js package deployed through ChatGPT Sites. It is written for parents,
educators, and contributors, not child users, and has no chat, accounts, forms,
analytics, visitor storage, or runtime API credentials. The kiosk remains
offline-first and independent of the showcase deployment.
