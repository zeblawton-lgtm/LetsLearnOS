import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_PIN_HASH,
  hashPin,
  issueAdminToken,
  pinRateLimitStatus,
  recordFailedPinAttempt,
  requireAdminAuth,
  resetPinAttempts,
} from "../lib/admin-auth";

const router = Router();

router.post("/admin/verify-pin", async (req, res) => {
  const { pin } = req.body;
  if (typeof pin !== "string") { res.status(400).json({ error: "pin required" }); return; }

  const rateLimit = pinRateLimitStatus(req);
  if (rateLimit.limited) {
    res
      .status(429)
      .json({ error: "Too many PIN attempts", retryAfterSeconds: rateLimit.retryAfterSeconds });
    return;
  }

  const setting = await db.query.settingsTable.findFirst({
    where: eq(settingsTable.key, "parent_pin_hash"),
  });

  const storedHash = setting?.value ?? DEFAULT_PIN_HASH;
  const valid = hashPin(pin) === storedHash;
  if (!valid) {
    recordFailedPinAttempt(req);
    res.json({ valid: false });
    return;
  }

  resetPinAttempts(req);
  res.json({ valid: true, ...issueAdminToken() });
});

router.get("/admin/settings", requireAdminAuth, async (req, res) => {
  const rows = await db.select().from(settingsTable);
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.key !== "parent_pin_hash") out[row.key] = row.value;
  }
  res.json(out);
});

router.put("/admin/settings", requireAdminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) { res.status(400).json({ error: "key and value required" }); return; }
  if (key === "parent_pin_hash") { res.status(403).json({ error: "Use /admin/change-pin to update PIN" }); return; }

  await db.insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  res.json({ ok: true });
});

router.post("/admin/change-pin", requireAdminAuth, async (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!currentPin || !newPin) { res.status(400).json({ error: "currentPin and newPin required" }); return; }

  const setting = await db.query.settingsTable.findFirst({
    where: eq(settingsTable.key, "parent_pin_hash"),
  });
  const storedHash = setting?.value ?? DEFAULT_PIN_HASH;
  if (hashPin(currentPin) !== storedHash) { res.status(403).json({ error: "Current PIN is incorrect" }); return; }

  const newHash = hashPin(newPin);
  await db.insert(settingsTable)
    .values({ key: "parent_pin_hash", value: newHash })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: newHash, updatedAt: new Date() } });
  res.json({ ok: true });
});

export default router;
