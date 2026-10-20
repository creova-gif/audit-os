import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portalAccessTokensTable = pgTable("portal_access_tokens", {
  id: serial("id").primaryKey(),
  engagementId: integer("engagement_id").notNull(),
  clientEmail: text("client_email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortalAccessTokenSchema = createInsertSchema(portalAccessTokensTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPortalAccessToken = z.infer<typeof insertPortalAccessTokenSchema>;
export type PortalAccessToken = typeof portalAccessTokensTable.$inferSelect;
