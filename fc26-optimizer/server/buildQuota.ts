import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * AI build quota (server-side, the only place limits are enforced).
 *
 * - Guests never reach this: AI procedures are protectedProcedure (login required).
 * - Free accounts: 5 AI builds per calendar month (resets automatically, no Stripe event needed).
 * - Paid tiers: reset by the Stripe webhook on each paid renewal (invoice.paid). Safety net: if no reset has
 *   happened for 31 days (e.g. the webhook event isn't subscribed), the counter resets by itself.
 * - owner: unmetered.
 */
export const TIER_LIMITS: Record<string, number> = {
  free: 5,          // free account
  premium: 20,      // £0.99 / month
  premium_plus: 60, // £1.99 / month
  vip: 150,         // £3.99 / month
  owner: Infinity,
};

const rowsOf = (res: any): any[] => res?.rows ?? (Array.isArray(res) ? res : []);

// True when this user's counter belongs to a previous period and should count as 0.
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

export interface ReserveResult {
  allowed: boolean;
  /** false for unmetered tiers (nothing was reserved, so nothing to refund) */
  metered: boolean;
  tier: string;
  used: number;
  limit: number;
}

/**
 * Atomically reserve ONE build BEFORE any AI call is made.
 * A single UPDATE both checks the limit and increments the counter, so parallel requests
 * can never push a user past their cap.
 */
export async function reserveBuild(userId: number, tierOverride?: string): Promise<ReserveResult> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const found = rowsOf(
    await db.execute(sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`)
  )[0];
  if (!found) throw new Error("User not found");

  // The plan the user is treated as having (the owner can preview other plans); defaults to the stored plan
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

/** Give the build back when generation failed, so the user is never charged for an error. */
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

/** Owner testing only: zero a user's AI build counter so a plan's limit can be tested again. */
export async function resetBuilds(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.execute(sql`UPDATE users SET "monthlyBuilds" = 0, "buildsResetAt" = now() WHERE id = ${userId}`);
}
