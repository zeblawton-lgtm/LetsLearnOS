// ---------------------------------------------------------------------------
// SQLite dialect schema (kiosk / on-device deployment)
//
// Mirror of the Postgres schema in ./schema/* using drizzle-orm/sqlite-core.
// The installed LetsLearnOS kiosk runs entirely offline against a local
// SQLite file (better-sqlite3) — no Postgres server is present on the device.
//
// Column names, types, defaults and the resulting row shapes are kept
// structurally identical to the Postgres tables so the api-server route code
// (which is typed against the Postgres schema) works unchanged at runtime.
// ---------------------------------------------------------------------------
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const profilesTable = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  avatarPokemonId: integer("avatar_pokemon_id").notNull().default(25),
  // Unused since ADR-004 (no time-based blocking); kept so existing kiosk
  // databases need no destructive migration.
  dailyLimitMinutes: integer("daily_limit_minutes").notNull().default(15),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const sessionsTable = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  minutesUsed: integer("minutes_used").notNull().default(0),
});

export const attemptsTable = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  profileId: integer("profile_id").notNull(),
  module: text("module").notNull(),
  questionId: text("question_id").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  answeredAt: integer("answered_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const settingsTable = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Idempotent DDL — used to initialise the on-device database on first run
// without requiring drizzle-kit (a dev dependency) to be present on the kiosk.
export const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  avatar_pokemon_id INTEGER NOT NULL DEFAULT 25,
  daily_limit_minutes INTEGER NOT NULL DEFAULT 15,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ended_at INTEGER,
  minutes_used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  question_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  answered_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_attempts_profile ON attempts(profile_id);
`;
