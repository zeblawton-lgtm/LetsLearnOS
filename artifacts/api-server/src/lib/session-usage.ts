const SECOND_MS = 1000;

export type SessionTimestamps = {
  startedAt: Date | string | number;
  endedAt: Date | string | number | null;
};

export function sessionElapsedSeconds(
  session: SessionTimestamps,
  now = new Date(),
): number {
  const endMs = session.endedAt ? toMillis(session.endedAt) : now.getTime();
  const startMs = toMillis(session.startedAt);
  return Math.max(0, Math.ceil((endMs - startMs) / SECOND_MS));
}

// Minutes persisted on sessions.minutesUsed — Progress-page history only;
// nothing enforces a limit on it (ADR-004).
export function persistedMinutesForSession(
  session: SessionTimestamps,
  now = new Date(),
): number {
  const seconds = sessionElapsedSeconds(session, now);
  return seconds === 0 ? 0 : Math.ceil(seconds / 60);
}

export const STALE_SESSION_CAP_MINUTES = 60;

// Minutes to persist when auto-closing a session that was never explicitly
// ended. Kiosk power-off never calls /sessions/:id/end, so the gap until the
// next /sessions/start (often overnight) is wall-clock time, not play time —
// cap it so minutesUsed history isn't permanently poisoned with ~900-minute
// entries.
export function persistedMinutesForStaleSession(
  session: SessionTimestamps,
  now = new Date(),
): number {
  return Math.min(persistedMinutesForSession(session, now), STALE_SESSION_CAP_MINUTES);
}

function toMillis(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}
