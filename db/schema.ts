import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Short-lived counters only. No uploaded pictures, story text, generated
// artwork, raw IP addresses, or other child content is stored here.
export const requestLimits = sqliteTable("storygen_request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
