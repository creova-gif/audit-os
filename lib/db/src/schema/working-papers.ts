import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workingPapersTable = pgTable("working_papers", {
  id: serial("id").primaryKey(),
  engagementId: integer("engagement_id").notNull(),
  wpRef: text("wp_ref").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  aiDrafted: boolean("ai_drafted").notNull().default(false),
  contentText: text("content_text"),
  aiDraftText: text("ai_draft_text"),
  aiDraftStatus: text("ai_draft_status"),
  status: text("status").notNull().default("draft"),
  preparedBy: integer("prepared_by"),
  preparedAt: text("prepared_at"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  signedOffBy: integer("signed_off_by"),
  signedOffAt: text("signed_off_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWorkingPaperSchema = createInsertSchema(workingPapersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkingPaper = z.infer<typeof insertWorkingPaperSchema>;
export type WorkingPaper = typeof workingPapersTable.$inferSelect;
