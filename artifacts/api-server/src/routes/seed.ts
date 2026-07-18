import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db/schema";
import { requireAdminAuth } from "../lib/admin-auth";
import { DEFAULT_PROFILES } from "../lib/default-profiles";

const router = Router();

router.post("/admin/seed", requireAdminAuth, async (_req, res) => {
  // Same guard as boot-time seedIfEmpty (src/index.ts): only ever seed an
  // empty table — seeding alongside a partial profile set would duplicate
  // names (profiles.name has no unique constraint).
  const existing = await db.select().from(profilesTable);
  if (existing.length > 0) {
    res.json({ ok: true, message: "Already seeded", profiles: existing });
    return;
  }

  const profiles = await db
    .insert(profilesTable)
    .values(DEFAULT_PROFILES.map((profile) => ({ ...profile })))
    .returning();

  res.status(201).json({ ok: true, message: "Seeded", profiles });
});

export default router;
