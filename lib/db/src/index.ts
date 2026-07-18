import { createRequire } from "node:module";
import fs from "node:fs";
import nodePath from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
// Pure JS — receives the better-sqlite3 instance as an argument, so it is
// safe to import statically and gets bundled (unlike the native driver below).
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import pg from "pg";
import * as schema from "./schema";
import { useSqlite, sqlitePath } from "./driver";
import { SQLITE_DDL } from "./schema-sqlite";

const { Pool } = pg;

// The app is typed against the Postgres database type. In kiosk (SQLite) mode
// the runtime instance is an API-compatible better-sqlite3 drizzle database;
// every query the app performs is portable across both dialects.
type DB = NodePgDatabase<typeof schema>;

let db: DB;
let pool: InstanceType<typeof Pool> | null = null;

if (useSqlite()) {
  // ----- Kiosk / on-device: local SQLite file (offline, no DB server) -----
  const require = createRequire(import.meta.url);
  // better-sqlite3 is a native module; it is externalized from the api-server
  // bundle and resolved from node_modules at runtime.
  const Database = require("better-sqlite3");

  const file = sqlitePath();
  const dir = nodePath.dirname(nodePath.resolve(file));
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Initialise tables on first run without requiring drizzle-kit on the device.
  sqlite.exec(SQLITE_DDL);

  db = drizzleSqlite(sqlite, { schema }) as unknown as DB;
} else {
  // ----- Hosted/local development: Postgres -----
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg(pool, { schema });
}

export { db, pool };
export * from "./schema";
