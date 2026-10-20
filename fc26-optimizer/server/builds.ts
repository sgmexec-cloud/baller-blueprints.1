import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";

/**
 * Saved builds + global profile.
 *
 *  - A saved build is a full snapshot of the builder (archetype, level, points, playstyles, physicals AND
 *    the Facilities / Masteries / Club level at that moment), so changing your profile later never silently
 *    changes an older build.
 *  - The profile holds your Facilities, Masteries and Club level. It is applied automatically to every new
 *    build (paid plans only).
 *
 * Mounted inside the scout router, so the client calls trpc.scout.builds.*
 */

// 👉 Commercial decision: how many builds each plan can keep. Change freely.
export const SAVE_LIMITS: Record<string, number> = {
  free: 1,
  premium: 5,
  premium_plus: 15,
  vip: 50,
  owner: Infinity,
};
const PROFILE_TIERS = new Set(["premium", "premium_plus", "vip", "owner"]);

const limitFor = (tier: string) => SAVE_LIMITS[tier] ?? SAVE_LIMITS.free;
const rowsOf = (res: any): any[] => res?.rows ?? (Array.isArray(res) ? res : []);

// ── Validation: never trust what the client sends ──
const masteriesSchema = z
  .record(z.string().max(64), z.object({ l10: z.boolean(), l30: z.boolean() }))
  .refine(v => Object.keys(v).length <= 40, "Too many masteries");
const facilitiesSchema = z
  .record(z.string().max(60), z.number().int().min(1).max(3))
  .refine(v => Object.keys(v).length <= 40, "Too many facilities");

const ProfileSchema = z.object({
  clubLevel: z.number().int().min(1).max(60),
  equippedFacilities: facilitiesSchema,
  unlockedMasteries: masteriesSchema,
});

const SnapshotSchema = z.object({
  v: z.literal(1),
  archetype: z.string().min(1).max(64),
  level: z.number().int().min(1).max(40),
  height: z.number().min(140).max(220),
  weight: z.number().min(40).max(140),
  addedPoints: z
    .record(z.string().max(40), z.number().int().min(0).max(100))
    .refine(v => Object.keys(v).length <= 40, "Too many attributes"),
  smLevel: z.number().int().min(1).max(5),
  wfLevel: z.number().int().min(1).max(5),
  equippedPlaystyles: z.array(z.string().max(60)).max(3),
  equippedSpecialization: z.string().max(80).nullable(),
  psPlusMode: z.enum(["auto", "signature", "spec"]),
  clubLevel: z.number().int().min(1).max(60),
  equippedFacilities: facilitiesSchema,
  unlockedMasteries: masteriesSchema,
});

const nameSchema = z.string().trim().min(1).max(60);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function userOf(ctx: any): { id: number; tier: string } {
  const id = Number(ctx?.user?.id);
  if (!Number.isFinite(id)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in." });
  return { id, tier: ctx.user.tier ?? "free" };
}

/** Called once at server start (index.ts), like the other "add if missing" database setup. */
export async function ensureBuildTables(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS saved_builds (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name varchar(60) NOT NULL,
      archetype varchar(64) NOT NULL,
      level integer NOT NULL,
      data jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS saved_builds_user_idx ON saved_builds (user_id, updated_at DESC)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data jsonb NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

export const buildsRouter = router({
  /** My saved builds (metadata only) plus how many I may keep. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { id, tier } = userOf(ctx);
    const db = await requireDb();
    const rows = rowsOf(
      await db.execute(sql`
        SELECT id, name, archetype, level, updated_at
        FROM saved_builds WHERE user_id = ${id} ORDER BY updated_at DESC
      `)
    );
    const limit = limitFor(tier);
    return {
      builds: rows.map(r => ({
        id: Number(r.id),
        name: String(r.name),
        archetype: String(r.archetype),
        level: Number(r.level),
        updatedAt: new Date(r.updated_at).toISOString(),
      })),
      used: rows.length,
      limit: Number.isFinite(limit) ? limit : null,
      canSaveProfile: PROFILE_TIERS.has(tier),
    };
  }),

  /** One saved build (the full snapshot). */
  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { id: userId } = userOf(ctx);
      const db = await requireDb();
      const row = rowsOf(
        await db.execute(sql`SELECT data FROM saved_builds WHERE id = ${input.id} AND user_id = ${userId} LIMIT 1`)
      )[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Build not found." });
      return (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as z.infer<typeof SnapshotSchema>;
    }),

  /** Create a new saved build (respecting the plan limit) or overwrite one of mine when an id is given. */
  save: protectedProcedure
    .input(z.object({ id: z.number().int().optional(), name: nameSchema, data: SnapshotSchema }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId, tier } = userOf(ctx);
      const db = await requireDb();

      const json = JSON.stringify(input.data);
      if (json.length > 20_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Build data is too large." });

      // Overwrite
      if (input.id !== undefined) {
        const updated = rowsOf(
          await db.execute(sql`
            UPDATE saved_builds
            SET name = ${input.name}, archetype = ${input.data.archetype}, level = ${input.data.level},
                data = ${json}::jsonb, updated_at = now()
            WHERE id = ${input.id} AND user_id = ${userId}
            RETURNING id
          `)
        )[0];
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Build not found." });
        return { id: Number(updated.id) };
      }

      // Create: lock this user's rows so two simultaneous saves can't both slip past the limit
      const limit = Number.isFinite(limitFor(tier)) ? limitFor(tier) : 1_000_000;
      const created = await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);
        return rowsOf(
          await tx.execute(sql`
            INSERT INTO saved_builds (user_id, name, archetype, level, data)
            SELECT ${userId}::int, ${input.name}::text, ${input.data.archetype}::text, ${input.data.level}::int, ${json}::jsonb
            WHERE (SELECT count(*) FROM saved_builds WHERE user_id = ${userId}::int) < ${limit}::int
            RETURNING id
          `)
        )[0];
      });
      if (!created) throw new TRPCError({ code: "FORBIDDEN", message: "BUILD_LIMIT_REACHED" });
      return { id: Number(created.id) };
    }),

  /** Copy one of my builds ("change one variable at a time"). */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId, tier } = userOf(ctx);
      const db = await requireDb();
      const limit = Number.isFinite(limitFor(tier)) ? limitFor(tier) : 1_000_000;

      const result = await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);
        const exists = rowsOf(
          await tx.execute(sql`SELECT 1 AS ok FROM saved_builds WHERE id = ${input.id} AND user_id = ${userId} LIMIT 1`)
        )[0];
        if (!exists) return "not_found" as const;
        const copy = rowsOf(
          await tx.execute(sql`
            INSERT INTO saved_builds (user_id, name, archetype, level, data)
            SELECT user_id, left(name, 52) || ' (copy)', archetype, level, data
            FROM saved_builds
            WHERE id = ${input.id} AND user_id = ${userId}
              AND (SELECT count(*) FROM saved_builds WHERE user_id = ${userId}) < ${limit}::int
            RETURNING id
          `)
        )[0];
        return copy ? Number(copy.id) : ("limit" as const);
      });

      if (result === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "Build not found." });
      if (result === "limit") throw new TRPCError({ code: "FORBIDDEN", message: "BUILD_LIMIT_REACHED" });
      return { id: result };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = userOf(ctx);
      const db = await requireDb();
      await db.execute(sql`DELETE FROM saved_builds WHERE id = ${input.id} AND user_id = ${userId}`);
      return { success: true };
    }),

  // ── Global profile: Facilities · Masteries · Club level ──
  profileGet: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId } = userOf(ctx);
    const db = await requireDb();
    const row = rowsOf(await db.execute(sql`SELECT data FROM user_profiles WHERE user_id = ${userId} LIMIT 1`))[0];
    if (!row) return null;
    return (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as z.infer<typeof ProfileSchema>;
  }),

  profileSave: protectedProcedure
    .input(z.object({ data: ProfileSchema }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId, tier } = userOf(ctx);
      if (!PROFILE_TIERS.has(tier)) throw new TRPCError({ code: "FORBIDDEN", message: "PAID_FEATURE" });
      const db = await requireDb();
      await db.execute(sql`
        INSERT INTO user_profiles (user_id, data) VALUES (${userId}, ${JSON.stringify(input.data)}::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `);
      return { success: true };
    }),

  profileClear: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = userOf(ctx);
    const db = await requireDb();
    await db.execute(sql`DELETE FROM user_profiles WHERE user_id = ${userId}`);
    return { success: true };
  }),
});
