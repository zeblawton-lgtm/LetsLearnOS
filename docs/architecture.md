# LetsLearnOS Architecture

## Runtime topology

```text
Chromium kiosk / React PWA
  ├─ same-origin /api requests
  ├─ local fonts, maps, content, and fallback artwork
  └─ offline browser SpeechSynthesis fallback
             │
             ▼
Express backend bound to loopback
  ├─ profiles, sessions, attempts, settings
  ├─ Postgres or SQLite through Drizzle
  ├─ static frontend in kiosk mode
  └─ optional OpenAI Speech API proxy with disk cache
```

## Workspace

- `artifacts/letslearnos`: React/Vite frontend and offline PWA assets.
- `artifacts/api-server`: Express API and production static server.
- `lib/db`: dual Postgres/SQLite schema and driver selection.
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`: shared API contracts.
- `system`, `scripts`, `iso`: reviewed human-run kiosk and image tooling.

## Frontend

`src/App.tsx` owns routing. `SessionContext` holds the selected learner and
active session. Learning content is static TypeScript data or deterministic
templates. Character images resolve only to same-origin local files and use a
neutral SVG fallback when an optional asset pack is absent.

The service worker caches the application shell and same-origin static assets.
It never turns a missing asset into an external request.

## Backend and database

Routes are mounted below `/api`. The server binds to `127.0.0.1`; remote parent
access uses an administrator-created SSH tunnel rather than a public listener.

`@workspace/db` selects the database from `DATABASE_URL`. Postgres is convenient
for hosted development; `sqlite:` or `file:` selects the kiosk database.
Both schema definitions remain structurally identical, and SQLite initialization
uses idempotent DDL.

## Narration boundary

`GET /api/tts?text&lang=en|es|auto` is the only optional cloud path. The route:

1. checks its model/voice/instructions-aware disk cache;
2. calls the official OpenAI Speech endpoint only when a backend API key or
   short-lived access token exists;
3. never serializes or logs the credential;
4. returns `503` for missing credentials or provider failures; and
5. lets the frontend immediately fall back to browser SpeechSynthesis.

Narration text is static or template-generated learning copy. Profiles, child
names, progress, PINs, and database records are not sent to OpenAI.

## Deployment layouts

Both the existing-Ubuntu installer and the ISO use `/opt/letslearnos` for the
backend bundle, frontend build, system scripts, and optional `.env`. The kiosk
database lives below the restricted user's local data directory.

The `kids` account starts a dedicated Matchbox/Chromium session without a
desktop, shell, launcher, file manager, or settings application.
