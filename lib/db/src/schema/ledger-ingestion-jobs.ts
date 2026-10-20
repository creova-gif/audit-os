import { pgTable, text, serial, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ledgerIngestionJobsTable = pgTable("ledger_ingestion_jobs", {
  id: serial("id").primaryKey(),
  engagementId: integer("engagement_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  rowCount: integer("row_count").notNull().default(0),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
  totalDebits: doublePrecision("total_debits"),
  totalCredits: doublePrecision("total_credits"),
  anomaliesFound: integer("anomalies_found").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLedgerIngestionJobSchema = createInsertSchema(ledgerIngestionJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLedgerIngestionJob = z.infer<typeof insertLedgerIngestionJobSchema>;
export type LedgerIngestionJob = typeof ledgerIngestionJobsTable.$inferSelect;
