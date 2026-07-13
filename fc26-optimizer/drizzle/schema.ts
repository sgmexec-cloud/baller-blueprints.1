import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // ── FREEMIUM COLUMNS ────────────────────────────────────────────────────────
  tier: mysqlEnum("tier", ["free", "premium"]).default("free").notNull(),
  monthlyBuilds: int("monthlyBuilds").default(0).notNull(),
  lastBuildDate: timestamp("lastBuildDate"),
  // ────────────────────────────────────────────────────────────────────────────

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── GUEST TRACKER ─────────────────────────────────────────────────────────────
export const guestUsage = mysqlTable("guest_usage", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  builds: int("builds").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
