# GOAL.md — LetsLearnOS

> This is the project source of truth. Architectural changes are recorded in
> `DECISIONS.md`; repository conventions live in `AGENTS.md`.

## 1. Final deliverable

LetsLearnOS is an open-source, touch-first educational kiosk for young learners.
The primary release artifact is a reproducible x86_64 Ubuntu kiosk image at
`dist/letslearnos.iso`; the same application can also run in a normal local
development environment.

The kiosk boots directly into a full-screen learning experience with local
profiles, progress tracking, and a parent-only administration flow. Fresh
installations use generic sample profiles that a parent can replace.

## 2. Reference hardware

- x86_64 laptop or 2-in-1 capable of running Ubuntu LTS and Chromium.
- Touch is the primary input; keyboard and mouse remain development fallbacks.
- The reference display is 3840×2160 at 200% scaling, but layouts must remain
  usable on smaller 16:9 displays.
- Hardware acceleration is expected for the three.js learning modules.

## 3. Accessibility and child experience

- Touch targets are at least 88×88 px, preferably 120 px.
- No critical controls live in the top 80 px of the viewport.
- Text is large, legible, and usable by pre-readers with narration support.
- The younger profile receives positive feedback only: no streak loss,
  punishment, or negative framing.

## 4. Stack

pnpm workspaces · React 19 · Vite · TypeScript · Tailwind CSS · Express 5 ·
Drizzle ORM · Postgres for development · SQLite on the kiosk · Chromium on
Ubuntu LTS.

## 5. Learning content

The project includes template- and data-driven activities for math, geography,
Spanish, space, science, creative play, printable worksheets, puzzles, memory,
music, stories, mazes, and seek-and-find games.

- Math questions and explanations are deterministic templates, never generated
  by an AI model.
- Geography and science content represents the real world accurately.
- Story and activity content is static at runtime.
- There is no child-facing free chat.
- Optional character artwork is a theme layer, not a runtime dependency.

## 6. Sessions and parent controls

- Sessions are not time-limited.
- Sessions record time and activity attempts for the Progress page only.
- A parent PIN protects administrative controls and ending an active session.
- The kiosk is intended for parent-supervised use.

## 7. Offline core and optional OpenAI narration

- Every learning activity works without internet access.
- Fonts, application code, maps, and the neutral fallback artwork are bundled.
- This public repository contains no proprietary character art or commercial
  music. Users may install artwork or music only when they have the right to
  use and distribute it; missing optional assets degrade to neutral fallbacks.
- Browser `SpeechSynthesis` is the default offline narration path.
- A server administrator may optionally enable higher-quality narration with
  the OpenAI Speech API by setting a backend `OPENAI_API_KEY` or externally
  issued short-lived `OPENAI_ACCESS_TOKEN`.
- The API key must never be sent to or stored by the frontend. The backend is
  the only component permitted to contact OpenAI.
- OpenAI narration is best-effort and cached on disk. Missing credentials,
  network failures, rate limits, or API errors fall back to browser speech and
  never block a learning activity.
- The parent-facing UI and documentation disclose that OpenAI narration is an
  AI-generated voice when it is enabled.

## 8. Kiosk safety

- The `kids` account has no sudo access, interactive shell, or desktop session.
- Chromium launches full-screen inside a restricted kiosk session.
- Host-mutating operations are delivered as scripts for a human administrator;
  automated contributors do not execute them.

## 9. Public release gate

A release is ready only when all of the following are true:

- The frontend, backend, and database initialize successfully.
- Generic sample profiles can start sessions and record progress.
- Parent PIN controls work.
- The app remains usable with OpenAI disabled and with the network unavailable.
- OpenAI credentials are backend-only and no real credential is committed.
- No private hosts, private IP addresses, personal profile defaults, proprietary
  character images, or commercial music are included.
- No non-OpenAI assistant-provider integration, configuration, documentation,
  or private development history is present in the public repository.
- `pnpm run typecheck`, backend tests, frontend/backend builds, asset checks,
  secret scans, and shell/Python syntax checks pass.
- The ISO build command exists and CI can reproduce the release artifact.
- Public setup, security, licensing, and parent documentation are current.

## Non-goals

- Child-facing AI chat or AI-generated lessons.
- AI-generated math questions or answers.
- Runtime calls to third-party character-data services.
- Shipping content or assets that contributors do not have permission to
  redistribute.
- Accepting API keys in browser code, query strings, local storage, or the
  application database.
