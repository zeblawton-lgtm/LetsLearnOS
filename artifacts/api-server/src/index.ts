import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { profilesTable, settingsTable } from "@workspace/db/schema";
import { DEFAULT_PIN_HASH } from "./lib/admin-auth";
import { DEFAULT_PROFILES } from "./lib/default-profiles";

// Auto-seed generic profiles on a fresh database. Existing installations are
// never renamed or otherwise modified.
async function seedIfEmpty(): Promise<void> {
  // Persist only the salted bootstrap digest. Existing/changed PIN rows win.
  await db.insert(settingsTable)
    .values({ key: "parent_pin_hash", value: DEFAULT_PIN_HASH })
    .onConflictDoNothing({ target: settingsTable.key });

  const existing = await db.select().from(profilesTable);
  if (existing.length === 0) {
    await db
      .insert(profilesTable)
      .values(DEFAULT_PROFILES.map((profile) => ({ ...profile })));
    logger.info("Fresh database — seeded generic learner profiles");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = "127.0.0.1";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedIfEmpty().catch((err) => {
  // Non-fatal: the kiosk can still serve; profiles can be seeded manually.
  logger.error({ err }, "Auto-seed failed");
});

app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host, port }, "Server listening");
});
