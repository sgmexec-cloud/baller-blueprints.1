import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

// Saved AI results. The same player + the same options always returns the same blueprint, so the archetype and
// PlayStyle picks stay consistent, and a repeat costs no AI tokens.
// Raise CACHE_VERSION to ignore every older saved result (for example after the AI prompt or rules change).
const CACHE_VERSION = 2; // 2: archetype now chosen by scoring all archetypes

let tableReady: Promise<void> | null = null;

// Created on first use, so nothing else has to change at startup
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "scout_cache" (
          "key" TEXT PRIMARY KEY,
          "blueprint" JSONB NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
          "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
        );
      `);
    })().catch(err => {
      tableReady = null; // try again next time
      throw err;
    });
  }
  return tableReady;
}

export function makeScoutCacheKey(p: {
  playerIdentity: string;
  forcedArchetype?: string | null;
  customHeight?: string;
  customWeight?: string;
  customSkillMoves?: number;
  customWeakFoot?: number;
  customPlaystyles?: string[];
}): string {
  const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const payload = JSON.stringify({
    v: CACHE_VERSION,
    player: norm(p.playerIdentity),
    arch: norm(p.forcedArchetype),
    h: norm(p.customHeight),
    w: norm(p.customWeight),
    sm: p.customSkillMoves ?? null,
    wf: p.customWeakFoot ?? null,
    ps: (p.customPlaystyles ?? []).map(norm).sort(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** The saved blueprint for this key, or null. Never throws: a cache problem must not break a build. */
export async function getCachedBlueprint(key: string): Promise<unknown | null> {
  try {
    await ensureTable();
    const db = await getDb();
    if (!db) return null;
    const res: any = await db.execute(sql`SELECT "blueprint" FROM "scout_cache" WHERE "key" = ${key} LIMIT 1`);
    const rows: any[] = Array.isArray(res) ? res : res?.rows ?? [];
    const raw = rows[0]?.blueprint;
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("Scout cache read failed:", err);
    return null;
  }
}

/** Save (or overwrite) the blueprint for this key. Never throws. */
export async function saveCachedBlueprint(key: string, blueprint: unknown): Promise<void> {
  try {
    await ensureTable();
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO "scout_cache" ("key", "blueprint")
      VALUES (${key}, ${JSON.stringify(blueprint)}::jsonb)
      ON CONFLICT ("key") DO UPDATE SET "blueprint" = EXCLUDED."blueprint", "updatedAt" = now()
    `);
  } catch (err) {
    console.error("Scout cache write failed:", err);
  }
}
