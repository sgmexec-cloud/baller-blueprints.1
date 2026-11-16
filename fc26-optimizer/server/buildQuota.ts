import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * AI build & FUT Card Match quotas (server-side, the only place limits are enforced).
 *
 * - Guests never reach this: AI and Card Match procedures are protectedProcedure (login required).
 * - Free accounts: reset automatically each calendar month.
 * - Paid tiers: reset by the Stripe webhook on each paid renewal (invoice.paid), with a 31-day safety net.
 * - owner: unmetered.
 */
export const TIER_LIMITS: Record<string, number> = {
  free: 5,          // free account
  premium: 20,      // £0.99 / month
  premium_plus: 60, // £1.99 / month
  vip: 150,         // £3.99 / month
  owner: Infinity,
};

export const CARD_MATCH_LIMITS: Record<string, number> = {
  free: 10,          // free account
  premium: 40,       // £0.99 / month
  premium_plus: 100, // £1.99 / month
  vip: Infinity,     // £3.99 / month
  owner: Infinity,
};

const rowsOf = (res: any): any[] => res?.rows ?? (Array.isArray(res) ? res : []);

let cardColsEnsured = false;
async function ensureCardQuotaColumns(db: any): Promise<void> {
  if (cardColsEnsured) return;
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "monthlyCardMatches" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "cardMatchesResetAt" timestamp,
      ADD COLUMN IF NOT EXISTS "lastCardMatchDate" timestamp
  `);
  cardColsEnsured = true;
}

// True when this user's AI counter belongs to a previous period and should count as 0.
const needsReset = (tier: string) => sql`(
  CASE
    WHEN ${tier}::text = 'free'
      THEN ("lastBuildDate" IS NOT NULL AND "lastBuildDate" < date_trunc('month', now()))
    ELSE (
      COALESCE("buildsResetAt", "lastBuildDate") IS NOT NULL
      AND COALESCE("buildsResetAt", "lastBuildDate") < now() - interval '31 days'
    )
  END
)`;

// True when this user's Card Match counter belongs to a previous period and should count as 0.
const needsCardReset = (tier: string) => sql`(
  CASE
    WHEN ${tier}::text = 'free'
      THEN ("lastCardMatchDate" IS NOT NULL AND "lastCardMatchDate" < date_trunc('month', now()))
    ELSE (
      COALESCE("cardMatchesResetAt", "lastCardMatchDate") IS NOT NULL
      AND COALESCE("cardMatchesResetAt", "lastCardMatchDate") < now() - interval '31 days'
    )
  END
)`;

export interface ReserveResult {
  allowed: boolean;
  /** false for unmetered tiers (nothing was reserved, so nothing to refund) */
  metered: boolean;
  tier: string;
  used: number;
  limit: number;
}

/**
 * Atomically reserve ONE AI build BEFORE any AI call is made.
 */
export async function reserveBuild(userId: number, tierOverride?: string): Promise<ReserveResult> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const found = rowsOf(
    await db.execute(sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`)
  )[0];
  if (!found) throw new Error("User not found");

  const tier: string = tierOverride ?? found.tier ?? "free";
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const NEEDS_RESET = needsReset(tier);

  if (limit === Infinity) {
    return { allowed: true, metered: false, tier, used: 0, limit };
  }

  const updated = rowsOf(
    await db.execute(sql`
      UPDATE users
      SET "monthlyBuilds" = CASE WHEN ${NEEDS_RESET} THEN 1 ELSE "monthlyBuilds" + 1 END,
          "buildsResetAt" = CASE WHEN ${NEEDS_RESET} THEN now() ELSE "buildsResetAt" END,
          "lastBuildDate" = now()
      WHERE id = ${userId}
        AND (${NEEDS_RESET} OR "monthlyBuilds" < ${limit})
      RETURNING "monthlyBuilds"
    `)
  )[0];

  if (!updated) {
    return { allowed: false, metered: true, tier, used: limit, limit };
  }
  return { allowed: true, metered: true, tier, used: Number(updated.monthlyBuilds), limit };
}

/** Give the AI build back when generation failed, so the user is never charged for an error. */
export async function refundBuild(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(
      sql`UPDATE users SET "monthlyBuilds" = GREATEST("monthlyBuilds" - 1, 0) WHERE id = ${userId}`
    );
  } catch (err) {
    console.error("refundBuild failed:", err);
  }
}

/**
 * Atomically reserve ONE FUT Card Match BEFORE running the matcher.
 */
export async function reserveCardMatch(userId: number, tierOverride?: string): Promise<ReserveResult> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await ensureCardQuotaColumns(db);

  const found = rowsOf(
    await db.execute(sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`)
  )[0];
  if (!found) throw new Error("User not found");

  const tier: string = tierOverride ?? found.tier ?? "free";
  const limit = CARD_MATCH_LIMITS[tier] ?? CARD_MATCH_LIMITS.free;
  const NEEDS_RESET = needsCardReset(tier);

  if (limit === Infinity) {
    return { allowed: true, metered: false, tier, used: 0, limit };
  }

  const updated = rowsOf(
    await db.execute(sql`
      UPDATE users
      SET "monthlyCardMatches" = CASE WHEN ${NEEDS_RESET} THEN 1 ELSE "monthlyCardMatches" + 1 END,
          "cardMatchesResetAt" = CASE WHEN ${NEEDS_RESET} THEN now() ELSE "cardMatchesResetAt" END,
          "lastCardMatchDate" = now()
      WHERE id = ${userId}
        AND (${NEEDS_RESET} OR "monthlyCardMatches" < ${limit})
      RETURNING "monthlyCardMatches"
    `)
  )[0];

  if (!updated) {
    return { allowed: false, metered: true, tier, used: limit, limit };
  }
  return { allowed: true, metered: true, tier, used: Number(updated.monthlyCardMatches), limit };
}

/** Refund ONE Card Match if an unexpected error occurs during matching. */
export async function refundCardMatch(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await ensureCardQuotaColumns(db);
    await db.execute(
      sql`UPDATE users SET "monthlyCardMatches" = GREATEST("monthlyCardMatches" - 1, 0) WHERE id = ${userId}`
    );
  } catch (err) {
    console.error("refundCardMatch failed:", err);
  }
}

export interface QuotaInfo {
  tier: string;
  used: number;
  /** null = unlimited */
  limit: number | null;
  /** null = unlimited */
  remaining: number | null;
}

/** Read-only view for the UI ("3 of 5 left"), applying the same reset rule as reserveBuild. */
export async function getQuota(userId: number, tierOverride?: string): Promise<QuotaInfo> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const stored = rowsOf(await db.execute(sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`))[0];
  if (!stored) throw new Error("User not found");
  const tier: string = tierOverride ?? stored.tier ?? "free";

  const row = rowsOf(
    await db.execute(sql`
      SELECT CASE WHEN ${needsReset(tier)} THEN 0 ELSE "monthlyBuilds" END AS used
      FROM users WHERE id = ${userId} LIMIT 1
    `)
  )[0];
  if (!row) throw new Error("User not found");

  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const used = Number(row.used) || 0;

  if (limit === Infinity) return { tier, used, limit: null, remaining: null };
  return { tier, used, limit, remaining: Math.max(0, limit - used) };
}

/** Read-only view for FUT Card Match quota ("7 of 10 left"). */
export async function getCardMatchQuota(userId: number, tierOverride?: string): Promise<QuotaInfo> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await ensureCardQuotaColumns(db);

  const stored = rowsOf(await db.execute(sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`))[0];
  if (!stored) throw new Error("User not found");
  const tier: string = tierOverride ?? stored.tier ?? "free";

  const row = rowsOf(
    await db.execute(sql`
      SELECT CASE WHEN ${needsCardReset(tier)} THEN 0 ELSE "monthlyCardMatches" END AS used
      FROM users WHERE id = ${userId} LIMIT 1
    `)
  )[0];
  if (!row) throw new Error("User not found");

  const limit = CARD_MATCH_LIMITS[tier] ?? CARD_MATCH_LIMITS.free;
  const used = Number(row.used) || 0;

  if (limit === Infinity) return { tier, used, limit: null, remaining: null };
  return { tier, used, limit, remaining: Math.max(0, limit - used) };
}

/** Owner testing only: zero a user's AI & Card Match counters so a plan's limit can be tested again. */
export async function resetBuilds(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await ensureCardQuotaColumns(db);
  await db.execute(sql`
    UPDATE users
    SET "monthlyBuilds" = 0,
        "buildsResetAt" = now(),
        "monthlyCardMatches" = 0,
        "cardMatchesResetAt" = now()
    WHERE id = ${userId}
  `);
}
