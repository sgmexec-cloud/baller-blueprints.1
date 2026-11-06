import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { factsFromItem } from "../client/src/utils/socialCopy";
import { generateSocialRecord } from "./socialAI";

/**
 * Batch Build Generator: saved batches of AI builds (for social content). Owner only for now.
 *
 *  - batches       one row per batch: name + the settings it was started with
 *  - batch_items   one row per player: status, the AI blueprint, the finished build and the social copy
 *
 * The browser runs the builds (it needs the builder's own logic) and saves each result here the moment it
 * finishes, so a closed tab never loses finished work. Mounted inside the scout router: trpc.scout.batches.*
 * The tables are created on first use, so nothing else has to change at startup.
 */

const MAX_ITEMS_PER_BATCH = 100;
const MAX_BATCHES_PER_USER = 50;

const rowsOf = (res: any): any[] => res?.rows ?? (Array.isArray(res) ? res : []);
const asJson = (v: any) => (typeof v === "string" ? JSON.parse(v) : v ?? null);
const iso = (v: any) => new Date(v).toISOString();

let tablesReady: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS batches (
          id serial PRIMARY KEY,
          user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name varchar(80) NOT NULL,
          settings jsonb NOT NULL,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS batches_user_idx ON batches (user_id, updated_at DESC)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS batch_items (
          id serial PRIMARY KEY,
          batch_id integer NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
          position integer NOT NULL,
          player_name varchar(120) NOT NULL,
          note varchar(300),
          status varchar(16) NOT NULL DEFAULT 'queued',
          error text,
          blueprint jsonb,
          build jsonb,
          social jsonb,
          selected boolean NOT NULL DEFAULT true,
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS batch_items_batch_idx ON batch_items (batch_id, position)`);
    })().catch(err => {
      tablesReady = null; // try again next time
      throw err;
    });
  }
  return tablesReady;
}

async function requireDb() {
  await ensureTables();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** Owner only. realTier is the stored plan, so previewing another plan doesn't lock the owner out. */
function ownerOf(ctx: any): number {
  const id = Number(ctx?.user?.id);
  if (!Number.isFinite(id)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in." });
  if ((ctx.user.realTier ?? ctx.user.tier) !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "OWNER_ONLY" });
  }
  return id;
}

// ── Validation: never trust what the client sends ──
const facilitiesSchema = z
  .record(z.string().max(60), z.number().int().min(1).max(3))
  .refine(v => Object.keys(v).length <= 40, "Too many facilities");

export const BatchSettingsSchema = z.object({
  level: z.number().int().min(1).max(55).default(55),
  facilityMode: z.enum(["ai", "keep"]).default("ai"),
  clubLevel: z.number().int().min(1).max(60).default(10),
  keptFacilities: facilitiesSchema.default({}),
  masteriesMode: z.enum(["all", "profile"]).default("all"),
  buildStyle: z.enum(["balanced", "authentic"]).default("balanced"),
  concurrency: z.number().int().min(1).max(3).default(2),
  useSavedResults: z.boolean().default(true),
});

const ItemInputSchema = z.object({
  playerName: z.string().trim().min(1).max(120),
  note: z.string().trim().max(300).optional(),
});

const statusSchema = z.enum(["queued", "running", "done", "failed"]);

const blob = (maxChars: number) =>
  z.record(z.string(), z.unknown()).refine(v => JSON.stringify(v).length <= maxChars, "Too much data");

const batchName = z.string().trim().min(1).max(80);

/** Drop repeated names (ignoring case and extra spaces), keeping the first */
function dedupe<T extends { playerName: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(i => {
    const k = i.playerName.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const batchesRouter = router({
  /** My batches, newest first, with progress counts */
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ownerOf(ctx);
    const db = await requireDb();
    const rows = rowsOf(
      await db.execute(sql`
        SELECT b.id, b.name, b.created_at, b.updated_at,
               count(i.id) AS total,
               count(i.id) FILTER (WHERE i.status = 'done') AS done,
               count(i.id) FILTER (WHERE i.status = 'failed') AS failed,
               count(i.id) FILTER (WHERE i.selected AND i.status = 'done') AS selected
        FROM batches b LEFT JOIN batch_items i ON i.batch_id = b.id
        WHERE b.user_id = ${userId}
        GROUP BY b.id
        ORDER BY b.updated_at DESC
        LIMIT 100
      `)
    );
    return rows.map(r => ({
      id: Number(r.id),
      name: String(r.name),
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      total: Number(r.total),
      done: Number(r.done),
      failed: Number(r.failed),
      selected: Number(r.selected),
    }));
  }),

  /** One batch with every player */
  get: protectedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const userId = ownerOf(ctx);
    const db = await requireDb();
    const batch = rowsOf(
      await db.execute(sql`
        SELECT id, name, settings, created_at, updated_at FROM batches WHERE id = ${input.id} AND user_id = ${userId} LIMIT 1
      `)
    )[0];
    if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found." });
    const items = rowsOf(
      await db.execute(sql`
        SELECT id, position, player_name, note, status, error, blueprint, build, social, selected, updated_at
        FROM batch_items WHERE batch_id = ${input.id} ORDER BY position
      `)
    );
    return {
      id: Number(batch.id),
      name: String(batch.name),
      settings: BatchSettingsSchema.parse(asJson(batch.settings) ?? {}),
      createdAt: iso(batch.created_at),
      updatedAt: iso(batch.updated_at),
      items: items.map(r => ({
        id: Number(r.id),
        position: Number(r.position),
        playerName: String(r.player_name),
        note: r.note ? String(r.note) : null,
        status: String(r.status) as z.infer<typeof statusSchema>,
        error: r.error ? String(r.error) : null,
        blueprint: asJson(r.blueprint),
        build: asJson(r.build),
        social: asJson(r.social),
        selected: Boolean(r.selected),
        updatedAt: iso(r.updated_at),
      })),
    };
  }),

  /** Start a batch: the settings plus the list of players (repeated names are dropped) */
  create: protectedProcedure
    .input(z.object({ name: batchName, settings: BatchSettingsSchema, items: z.array(ItemInputSchema).min(1).max(MAX_ITEMS_PER_BATCH) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ownerOf(ctx);
      const db = await requireDb();
      const items = dedupe(input.items);

      const have = Number(rowsOf(await db.execute(sql`SELECT count(*) AS n FROM batches WHERE user_id = ${userId}`))[0]?.n ?? 0);
      if (have >= MAX_BATCHES_PER_USER) throw new TRPCError({ code: "FORBIDDEN", message: "BATCH_LIMIT_REACHED" });

      const id = await db.transaction(async (tx: any) => {
        const created = rowsOf(
          await tx.execute(sql`
            INSERT INTO batches (user_id, name, settings) VALUES (${userId}, ${input.name}, ${JSON.stringify(input.settings)}::jsonb)
            RETURNING id
          `)
        )[0];
        const batchId = Number(created.id);
        for (let i = 0; i < items.length; i++) {
          await tx.execute(sql`
            INSERT INTO batch_items (batch_id, position, player_name, note)
            VALUES (${batchId}, ${i}, ${items[i].playerName}, ${items[i].note ?? null})
          `);
        }
        return batchId;
      });
      return { id, count: items.length };
    }),

  /** Rename a batch and/or change its settings */
  updateBatch: protectedProcedure
    .input(z.object({ id: z.number().int(), name: batchName.optional(), settings: BatchSettingsSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ownerOf(ctx);
      const db = await requireDb();
      const settingsJson = input.settings ? JSON.stringify(input.settings) : null;
      const updated = rowsOf(
        await db.execute(sql`
          UPDATE batches
          SET name = COALESCE(${input.name ?? null}::varchar, name),
              settings = COALESCE(${settingsJson}::jsonb, settings),
              updated_at = now()
          WHERE id = ${input.id} AND user_id = ${userId}
          RETURNING id
        `)
      )[0];
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found." });
      return { success: true };
    }),

  /** Add more players to an existing batch */
  addItems: protectedProcedure
    .input(z.object({ batchId: z.number().int(), items: z.array(ItemInputSchema).min(1).max(MAX_ITEMS_PER_BATCH) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ownerOf(ctx);
      const db = await requireDb();
      const owned = rowsOf(await db.execute(sql`SELECT id FROM batches WHERE id = ${input.batchId} AND user_id = ${userId} LIMIT 1`))[0];
      if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found." });

      const existing = rowsOf(await db.execute(sql`SELECT player_name FROM batch_items WHERE batch_id = ${input.batchId}`));
      const taken = new Set(existing.map(r => String(r.player_name).toLowerCase().replace(/\s+/g, " ").trim()));
      const fresh = dedupe(input.items).filter(i => !taken.has(i.playerName.toLowerCase().replace(/\s+/g, " ").trim()));
      if (existing.length + fresh.length > MAX_ITEMS_PER_BATCH) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `A batch holds at most ${MAX_ITEMS_PER_BATCH} players.` });
      }

      await db.transaction(async (tx: any) => {
        const next = Number(rowsOf(await tx.execute(sql`SELECT COALESCE(MAX(position), -1) + 1 AS n FROM batch_items WHERE batch_id = ${input.batchId}`))[0]?.n ?? 0);
        for (let i = 0; i < fresh.length; i++) {
          await tx.execute(sql`
            INSERT INTO batch_items (batch_id, position, player_name, note)
            VALUES (${input.batchId}, ${next + i}, ${fresh[i].playerName}, ${fresh[i].note ?? null})
          `);
        }
        await tx.execute(sql`UPDATE batches SET updated_at = now() WHERE id = ${input.batchId}`);
      });
      return { added: fresh.length };
    }),

  /**
   * Save progress on one player: status, error, the AI blueprint, the finished build, the social copy,
   * whether it is selected for export, or edits to the name / note. Only the fields sent are changed.
   */
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: statusSchema.optional(),
        error: z.string().max(1000).nullable().optional(),
        blueprint: blob(60_000).nullable().optional(),
        build: blob(250_000).nullable().optional(),
        social: blob(30_000).nullable().optional(),
        selected: z.boolean().optional(),
        playerName: z.string().trim().min(1).max(120).optional(),
        note: z.string().trim().max(300).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ownerOf(ctx);
      const db = await requireDb();
      const j = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

      const row = await db.transaction(async (tx: any) => {
        const updated = rowsOf(
          await tx.execute(sql`
            UPDATE batch_items
            SET status      = COALESCE(${input.status ?? null}::varchar, status),
                error       = CASE WHEN ${input.status ?? null}::varchar IS NULL AND ${input.error === undefined}::boolean THEN error ELSE ${input.error ?? null}::text END,
                blueprint   = CASE WHEN ${input.blueprint === null}::boolean THEN NULL ELSE COALESCE(${j(input.blueprint)}::jsonb, blueprint) END,
                build       = CASE WHEN ${input.build === null}::boolean THEN NULL ELSE COALESCE(${j(input.build)}::jsonb, build) END,
                social      = CASE WHEN ${input.social === null}::boolean THEN NULL ELSE COALESCE(${j(input.social)}::jsonb, social) END,
                selected    = COALESCE(${input.selected ?? null}::boolean, selected),
                player_name = COALESCE(${input.playerName ?? null}::varchar, player_name),
                note        = CASE WHEN ${input.note === undefined}::boolean THEN note ELSE ${input.note ?? null}::varchar END,
                updated_at  = now()
            WHERE id = ${input.id} AND batch_id IN (SELECT id FROM batches WHERE user_id = ${userId})
            RETURNING batch_id
          `)
        )[0];
        if (updated) await tx.execute(sql`UPDATE batches SET updated_at = now() WHERE id = ${Number(updated.batch_id)}`);
        return updated;
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
      return { success: true };
    }),

  /**
   * Write the social copy (title, description, caption, hashtags, highlights, scout report) for a FINISHED player.
   * Everything is built from the saved build; the AI only words the title and description from those facts, and a
   * template is used if its answer fails the checks. Replaces any copy the player already has.
   */
  generateSocial: protectedProcedure
    .input(z.object({ id: z.number().int(), useAI: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ownerOf(ctx);
      const db = await requireDb();
      const row = rowsOf(
        await db.execute(sql`
          SELECT i.id, i.player_name, i.note, i.status, i.blueprint, i.build
          FROM batch_items i JOIN batches b ON b.id = i.batch_id
          WHERE i.id = ${input.id} AND b.user_id = ${userId} LIMIT 1
        `)
      )[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
      if (row.status !== "done" || !row.build) throw new TRPCError({ code: "BAD_REQUEST", message: "Build this player first." });

      const facts = factsFromItem({
        playerName: String(row.player_name),
        note: row.note ? String(row.note) : null,
        blueprint: asJson(row.blueprint),
        build: asJson(row.build),
      });
      if (!facts) throw new TRPCError({ code: "BAD_REQUEST", message: "This build is missing data. Regenerate the player." });

      const social = await generateSocialRecord(facts, input.useAI ? invokeLLM : null, resp => {
        const u = resp?.usage;
        console.log(`[AI usage] social in=${u?.prompt_tokens ?? u?.input_tokens ?? "?"} out=${u?.completion_tokens ?? u?.output_tokens ?? "?"}`);
      });
      await db.execute(sql`UPDATE batch_items SET social = ${JSON.stringify(social)}::jsonb, updated_at = now() WHERE id = ${input.id}`);
      return social;
    }),

  /** After reopening a batch: anything left "running" by a closed tab goes back in the queue */
  requeueRunning: protectedProcedure.input(z.object({ batchId: z.number().int() })).mutation(async ({ ctx, input }) => {
    const userId = ownerOf(ctx);
    const db = await requireDb();
    const res = rowsOf(
      await db.execute(sql`
        UPDATE batch_items SET status = 'queued', updated_at = now()
        WHERE batch_id = ${input.batchId} AND status = 'running'
          AND batch_id IN (SELECT id FROM batches WHERE user_id = ${userId})
        RETURNING id
      `)
    );
    return { requeued: res.length };
  }),

  /** Select (or deselect) every finished player for export */
  setAllSelected: protectedProcedure
    .input(z.object({ batchId: z.number().int(), selected: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ownerOf(ctx);
      const db = await requireDb();
      await db.execute(sql`
        UPDATE batch_items SET selected = ${input.selected}, updated_at = now()
        WHERE batch_id = ${input.batchId} AND status = 'done'
          AND batch_id IN (SELECT id FROM batches WHERE user_id = ${userId})
      `);
      return { success: true };
    }),

  removeItem: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const userId = ownerOf(ctx);
    const db = await requireDb();
    await db.execute(sql`
      DELETE FROM batch_items WHERE id = ${input.id} AND batch_id IN (SELECT id FROM batches WHERE user_id = ${userId})
    `);
    return { success: true };
  }),

  remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const userId = ownerOf(ctx);
    const db = await requireDb();
    await db.execute(sql`DELETE FROM batches WHERE id = ${input.id} AND user_id = ${userId}`);
    return { success: true };
  }),
});
