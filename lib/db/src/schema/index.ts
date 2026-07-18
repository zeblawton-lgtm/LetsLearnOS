// Dialect-aware schema surface.
//
// Table *values* are swapped to the active dialect at runtime (Postgres in
// dev, SQLite on the kiosk) so that drizzle issues the correct SQL. They are
// re-typed as the Postgres tables so the api-server route code — which is typed
// against Postgres — continues to typecheck. The two dialect definitions are
// kept structurally identical (same columns, same row shapes), so this cast is
// sound for every query the app performs.
//
// Zod insert schemas and row/insert TYPES are always taken from the Postgres
// definitions: they describe the dialect-independent logical shape used for
// request validation and are correct for both backends.
import { useSqlite } from "../driver";
import * as pg from "./pg";
import * as lite from "../schema-sqlite";

const S = useSqlite();

export const profilesTable = (S ? lite.profilesTable : pg.profilesTable) as unknown as typeof pg.profilesTable;
export const sessionsTable = (S ? lite.sessionsTable : pg.sessionsTable) as unknown as typeof pg.sessionsTable;
export const attemptsTable = (S ? lite.attemptsTable : pg.attemptsTable) as unknown as typeof pg.attemptsTable;
export const settingsTable = (S ? lite.settingsTable : pg.settingsTable) as unknown as typeof pg.settingsTable;

export const {
  insertProfileSchema,
  insertSessionSchema,
  insertAttemptSchema,
  insertSettingSchema,
} = pg;

export type {
  Profile,
  InsertProfile,
  Session,
  InsertSession,
  Attempt,
  InsertAttempt,
  Setting,
  InsertSetting,
} from "./pg";
