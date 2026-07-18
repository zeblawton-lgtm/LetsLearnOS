import { Router } from "express";
import { db } from "@workspace/db";
import { attemptsTable, insertAttemptSchema } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.post("/attempts", async (req, res) => {
  const parsed = insertAttemptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [attempt] = await db.insert(attemptsTable).values(parsed.data).returning();
  res.status(201).json(attempt);
});

router.get("/stats/:profileId", async (req, res) => {
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId)) { res.status(400).json({ error: "profileId must be an integer" }); return; }

  const rows = await db.select({
    module: attemptsTable.module,
    correct: sql<number>`count(*) filter (where ${attemptsTable.correct} = true)`,
    total: sql<number>`count(*)`,
  })
    .from(attemptsTable)
    .where(eq(attemptsTable.profileId, profileId))
    .groupBy(attemptsTable.module);

  const moduleBreakdown: Record<string, { correct: number; total: number }> = {};
  let totalCorrect = 0;
  let totalAttempts = 0;

  for (const row of rows) {
    const c = Number(row.correct);
    const t = Number(row.total);
    moduleBreakdown[row.module] = { correct: c, total: t };
    totalCorrect += c;
    totalAttempts += t;
  }

  res.json({ totalCorrect, totalAttempts, moduleBreakdown });
});

export default router;
