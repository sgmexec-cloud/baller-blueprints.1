import { pgTable, serial, varchar, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
// 👉 Added "vip" so it matches the logic in your scout.ts file
export const tierEnum = pgEnum("tier", ["free", "premium", "vip"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"), // 👉 NEW: Store the Discord profile picture URL
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  
  tier: tierEnum("tier").default("free").notNull(),
  monthlyBuilds: integer("monthlyBuilds").default(0).notNull(),
  lastBuildDate: timestamp("lastBuildDate"),

  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const guestUsage = pgTable("guest_usage", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  builds: integer("builds").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
