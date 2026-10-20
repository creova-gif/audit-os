import { pgTable, text, serial, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const anomaliesTable = pgTable("gl_anomalies", {
  id: serial("id").primaryKey(),
  engagementId: integer("engagement_id").notNull(),
  anomalyType: text("anomaly_type").notNull(),
  riskLevel: text("risk_level").notNull(),
  accountCode: text("account_code"),
  accountName: text("account_name"),
  journalRef: text("journal_ref"),
  transactionDate: text("transaction_date"),
  amount: doublePrecision("amount"),
  description: text("description"),
  detectionMethod: text("detection_method").notNull().default("deterministic"), // 'deterministic' | 'ai_synthesis'
  aiExplanation: text("ai_explanation"),
  auditorStatus: text("auditor_status").notNull().default("unreviewed"),
  auditorNotes: text("auditor_notes"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnomalySchema = createInsertSchema(anomaliesTable).omit({ id: true, createdAt: true });
export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomaliesTable.$inferSelect;
