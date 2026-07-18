import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attemptsTable = pgTable("attempts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  profileId: integer("profile_id").notNull(),
  module: text("module").notNull(),
  questionId: text("question_id").notNull(),
  correct: boolean("correct").notNull(),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
});

export const insertAttemptSchema = createInsertSchema(attemptsTable).omit({ id: true, answeredAt: true });
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type Attempt = typeof attemptsTable.$inferSelect;
