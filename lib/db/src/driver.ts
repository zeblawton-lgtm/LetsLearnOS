// Runtime driver selection for @workspace/db.
//
// Hosted/local development -> Postgres (DATABASE_URL=postgres://...)
// Kiosk / device -> SQLite  (DATABASE_URL=sqlite:/path/db.sqlite, set by install.sh)
//
// SQLite is selected when DB_DRIVER=sqlite, or when DATABASE_URL uses a
// sqlite:/file: scheme, or points at a *.sqlite / *.db file.
export function useSqlite(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return (
    process.env.DB_DRIVER === "sqlite" ||
    url.startsWith("sqlite:") ||
    url.startsWith("file:") ||
    url.endsWith(".sqlite") ||
    url.endsWith(".db")
  );
}

// Extract a filesystem path from the configured DATABASE_URL for SQLite mode.
// Accepts: sqlite:/abs/path, sqlite:///abs/path, file:/abs/path, /abs/path.sqlite
export function sqlitePath(): string {
  const url = process.env.DATABASE_URL ?? "";
  let p = url
    .replace(/^sqlite:\/\/\//, "/")
    .replace(/^sqlite:\/\//, "")
    .replace(/^sqlite:/, "")
    .replace(/^file:\/\/\//, "/")
    .replace(/^file:\/\//, "")
    .replace(/^file:/, "");
  if (!p) p = "./letslearnos.sqlite";
  return p;
}
