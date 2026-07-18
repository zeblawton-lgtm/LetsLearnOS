import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable, insertProfileSchema } from "@workspace/db/schema";
import { requireAdminAuth } from "../lib/admin-auth";

const router = Router();

router.get("/profiles", async (req, res) => {
  const profiles = await db.select().from(profilesTable).orderBy(profilesTable.id);
  res.json(profiles);
});

router.post("/profiles", requireAdminAuth, async (req, res) => {
  const parsed = insertProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [profile] = await db.insert(profilesTable).values(parsed.data).returning();
  res.status(201).json(profile);
});

export default router;
