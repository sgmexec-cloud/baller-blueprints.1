import { pgTable, serial, varchar, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
// 👉 Updated to perfectly match your live database tiers
export const tierEnum = pgEnum("tier", ["free", "premium", "premium_plus", "vip", "owner"]);

// 👉 NEW: Enum to safely lock the game version
export const gameVersionEnum = pgEnum("game_version", ["FC26", "FC27"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  
  otpCode: text("otp_code"),
  otpExpires: timestamp("otp_expires"),
  
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

// 👉 NEW: The Builds Table to save FC26 and FC27 builds separately
export const builds = pgTable("builds", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  gameVersion: gameVersionEnum("gameVersion").default("FC26").notNull(),
  name: text("name").notNull(),
  archetype: text("archetype").notNull(),
  level: integer("level").notNull(),
  buildData: text("buildData"), // We will store the JSON math result here
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
