import { sql } from "drizzle-orm";
import { getDb } from "./db";

export interface FutCard {
  id: string;
  name: string;
  commonName?: string;
  overall: number;
  position: string;
  altPositions: string[];
  rarity: string;
  club?: string;
  league?: string;
  nation?: string;
  heightCm: number | null;
  weightKg: number | null;
  preferredFoot: "Right" | "Left";
  skillMoves: number;
  weakFoot: number;
  imageUrl?: string;
  faceStats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  /** Keyed by ClubsDNA's 29 standard attribute names */
  attributes: Record<string, number>;
  playstylePlus: string[];
  playstyles: string[];
}

const rowsOf = (res: any): any[] => res?.rows ?? (Array.isArray(res) ? res : []);

let tableReady = false;
async function ensureFutCardsTable(): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  if (!tableReady) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fut_cards (
        id text PRIMARY KEY,
        name text NOT NULL,
        search_name text NOT NULL,
        overall integer NOT NULL,
        position text NOT NULL,
        rarity text NOT NULL DEFAULT 'Base',
        card_json jsonb NOT NULL,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fut_cards_search ON fut_cards (search_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fut_cards_overall ON fut_cards (overall DESC)`);
    tableReady = true;
  }
  return db;
}

const norm = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .toLowerCase()
    .trim();

const EA_TO_STD_ATTR: Record<string, string> = {
  acceleration: "Acceleration",
  sprintspeed: "Sprint Speed",
  positioning: "Attack Positioning",
  attackpositioning: "Attack Positioning",
  finishing: "Finishing",
  shotpower: "Shot Power",
  longshots: "Long Shots",
  volleys: "Volleys",
  penalties: "Penalties",
  vision: "Vision",
  crossing: "Crossing",
  freekickaccuracy: "FK Accuracy",
  fkaccuracy: "FK Accuracy",
  shortpassing: "Short Passing",
  longpassing: "Long Passing",
  curve: "Curve",
  agility: "Agility",
  balance: "Balance",
  reactions: "Reactions",
  ballcontrol: "Ball Control",
  dribbling: "Dribbling",
  composure: "Composure",
  interceptions: "Interceptions",
  headingaccuracy: "Heading Accuracy",
  defensiveawareness: "Def Awareness",
  defawareness: "Def Awareness",
  marking: "Def Awareness",
  standingtackle: "Standing Tackle",
  slidingtackle: "Sliding Tackle",
  jumping: "Jumping",
  stamina: "Stamina",
  strength: "Strength",
  aggression: "Aggression",
};

function mapAttributes(rawStats: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!rawStats || typeof rawStats !== "object") return out;
  for (const [k, v] of Object.entries(rawStats)) {
    const cleanKey = k.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const std = EA_TO_STD_ATTR[cleanKey];
    const num = typeof v === "object" && v !== null ? Number((v as any).value ?? (v as any).rating) : Number(v);
    if (std && Number.isFinite(num) && num > 0) {
      out[std] = Math.min(99, Math.max(1, Math.round(num)));
    }
  }
  return out;
}

function calcFaceStats(attrs: Record<string, number>, rawFace?: any): FutCard["faceStats"] {
  const avg = (pairs: Array<[string, number]>) => {
    let sum = 0;
    let wSum = 0;
    for (const [k, w] of pairs) {
      if (attrs[k] !== undefined) {
        sum += attrs[k] * w;
        wSum += w;
      }
    }
    return wSum > 0 ? Math.round(sum / wSum) : 70;
  };
  return {
    pace: Number(rawFace?.pac?.value ?? rawFace?.pace) || avg([["Acceleration", 0.45], ["Sprint Speed", 0.55]]),
    shooting: Number(rawFace?.sho?.value ?? rawFace?.shooting) || avg([["Attack Positioning", 0.05], ["Finishing", 0.45], ["Shot Power", 0.20], ["Long Shots", 0.20], ["Volleys", 0.05], ["Penalties", 0.05]]),
    passing: Number(rawFace?.pas?.value ?? rawFace?.passing) || avg([["Vision", 0.20], ["Crossing", 0.20], ["FK Accuracy", 0.05], ["Short Passing", 0.35], ["Long Passing", 0.15], ["Curve", 0.05]]),
    dribbling: Number(rawFace?.dri?.value ?? rawFace?.dribbling) || avg([["Agility", 0.10], ["Balance", 0.05], ["Reactions", 0.05], ["Ball Control", 0.30], ["Dribbling", 0.50]]),
    defending: Number(rawFace?.def?.value ?? rawFace?.defending) || avg([["Interceptions", 0.20], ["Heading Accuracy", 0.10], ["Def Awareness", 0.30], ["Standing Tackle", 0.30], ["Sliding Tackle", 0.10]]),
    physical: Number(rawFace?.phy?.value ?? rawFace?.physical) || avg([["Jumping", 0.05], ["Stamina", 0.25], ["Strength", 0.50], ["Aggression", 0.20]]),
  };
}

function normaliseEaItem(item: any): FutCard | null {
  if (!item) return null;
  const id = String(item.id ?? item.baseId ?? item.resourceId ?? "");
  const name = String(item.commonName || `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || item.name || "").trim();
  if (!id || !name) return null;

  const pos = String(item.position?.shortLabel ?? item.position ?? "CM").toUpperCase();
  if (pos === "GK") return null; // Pro Clubs outfield card matcher skips GK cards

  const attributes = mapAttributes(item.stats ?? item.attributes ?? item);
  if (Object.keys(attributes).length < 15) return null;

  const psPlus: string[] = [];
  const psBase: string[] = [];
  const rawStyles = [
    ...(Array.isArray(item.playStylesPlus) ? item.playStylesPlus.map((s: any) => ({ name: s?.label ?? s?.name ?? s, plus: true })) : []),
    ...(Array.isArray(item.playStyles) ? item.playStyles.map((s: any) => ({ name: s?.label ?? s?.name ?? s, plus: Boolean(s?.isPlus || String(s).endsWith("+")) })) : []),
  ];
  for (const s of rawStyles) {
    const clean = String(s.name || "").replace(/\+/g, "").trim();
    if (!clean) continue;
    if (s.plus) {
      if (!psPlus.includes(clean)) psPlus.push(clean);
    } else if (!psBase.includes(clean) && !psPlus.includes(clean)) {
      psBase.push(clean);
    }
  }

  const heightRaw = Number(item.height);
  const weightRaw = Number(item.weight);

  return {
    id: `ea_${id}`,
    name,
    commonName: item.commonName ? String(item.commonName) : undefined,
    overall: Number(item.overallRating ?? item.overall ?? 80),
    position: pos,
    altPositions: Array.isArray(item.alternatePositions)
      ? item.alternatePositions.map((p: any) => String(p?.shortLabel ?? p).toUpperCase())
      : [],
    rarity: String(item.rarity?.label ?? item.rarityName ?? item.rarity ?? "Base"),
    club: item.team?.label ?? item.club?.name,
    league: item.league?.label ?? item.league?.name,
    nation: item.nationality?.label ?? item.nation?.name,
    heightCm: Number.isFinite(heightRaw) && heightRaw >= 140 && heightRaw <= 220 ? heightRaw : null,
    weightKg: Number.isFinite(weightRaw) && weightRaw >= 45 && weightRaw <= 130 ? weightRaw : null,
    preferredFoot: Number(item.preferredFoot) === 2 || String(item.preferredFoot).toLowerCase() === "left" ? "Left" : "Right",
    skillMoves: Math.min(5, Math.max(1, Number(item.skillMoves ?? 3))),
    weakFoot: Math.min(5, Math.max(1, Number(item.weakFootAbility ?? item.weakFoot ?? 3))),
    imageUrl: item.shieldUrl ?? item.avatarUrl ?? item.imageUrl,
    faceStats: calcFaceStats(attributes, item.stats),
    attributes,
    playstylePlus: psPlus,
    playstyles: psBase,
  };
}

export async function upsertFutCards(cards: FutCard[]): Promise<number> {
  if (cards.length === 0) return 0;
  const db = await ensureFutCardsTable();
  if (!db) return 0;
  let saved = 0;
  for (const c of cards) {
    try {
      await db.execute(sql`
        INSERT INTO fut_cards (id, name, search_name, overall, position, rarity, card_json, updated_at)
        VALUES (${c.id}, ${c.name}, ${norm(c.name)}, ${c.overall}, ${c.position}, ${c.rarity}, ${JSON.stringify(c)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          search_name = EXCLUDED.search_name,
          overall = EXCLUDED.overall,
          position = EXCLUDED.position,
          rarity = EXCLUDED.rarity,
          card_json = EXCLUDED.card_json,
          updated_at = now()
      `);
      saved++;
    } catch (e) {
      console.error("upsertFutCards error:", e);
    }
  }
  return saved;
}

/** Pulls matching cards from EA's public FC 27 ratings feed and caches them in Postgres. */
async function fetchUpstreamEaCards(query: string): Promise<FutCard[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL("https://drop-api.ea.com/rating/fc-27");
    url.searchParams.set("locale", "en");
    url.searchParams.set("limit", "40");
    if (query.trim()) url.searchParams.set("search", query.trim());

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ClubsDNA/1.0)",
      },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const cards = items.map(normaliseEaItem).filter((c: FutCard | null): c is FutCard => c !== null);
    if (cards.length > 0) {
      await upsertFutCards(cards);
    }
    return cards;
  } catch (err) {
    console.warn("Upstream EA card fetch skipped:", (err as any)?.message ?? err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Built-in starter cards so the browser is populated even on a cold database or offline dev environment
const SEED_CARDS: FutCard[] = [
  {
    id: "seed_mbappe_91",
    name: "Kylian Mbappé",
    overall: 91,
    position: "ST",
    altPositions: ["LW"],
    rarity: "Base Gold",
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "France",
    heightCm: 182,
    weightKg: 75,
    preferredFoot: "Right",
    skillMoves: 5,
    weakFoot: 4,
    faceStats: { pace: 97, shooting: 90, passing: 80, dribbling: 92, defending: 36, physical: 78 },
    attributes: {
      "Acceleration": 97, "Sprint Speed": 97, "Attack Positioning": 93, "Finishing": 94, "Shot Power": 90,
      "Long Shots": 83, "Volleys": 84, "Penalties": 84, "Vision": 83, "Crossing": 78, "FK Accuracy": 69,
      "Short Passing": 86, "Long Passing": 71, "Curve": 80, "Agility": 93, "Balance": 82, "Reactions": 93,
      "Ball Control": 92, "Dribbling": 93, "Composure": 88, "Interceptions": 38, "Heading Accuracy": 73,
      "Def Awareness": 26, "Standing Tackle": 34, "Sliding Tackle": 32, "Jumping": 88, "Stamina": 88,
      "Strength": 77, "Aggression": 64,
    },
    playstylePlus: ["Quick Step"],
    playstyles: ["Finesse Shot", "Rapid", "Flair", "Trivela", "Acrobatic"],
  },
  {
    id: "seed_bellingham_90",
    name: "Jude Bellingham",
    overall: 90,
    position: "CAM",
    altPositions: ["CM"],
    rarity: "Base Gold",
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "England",
    heightCm: 186,
    weightKg: 75,
    preferredFoot: "Right",
    skillMoves: 4,
    weakFoot: 4,
    faceStats: { pace: 80, shooting: 87, passing: 83, dribbling: 88, defending: 78, physical: 83 },
    attributes: {
      "Acceleration": 81, "Sprint Speed": 80, "Attack Positioning": 91, "Finishing": 90, "Shot Power": 85,
      "Long Shots": 86, "Volleys": 77, "Penalties": 74, "Vision": 90, "Crossing": 66, "FK Accuracy": 68,
      "Short Passing": 89, "Long Passing": 89, "Curve": 73, "Agility": 82, "Balance": 83, "Reactions": 91,
      "Ball Control": 89, "Dribbling": 88, "Composure": 87, "Interceptions": 82, "Heading Accuracy": 75,
      "Def Awareness": 77, "Standing Tackle": 79, "Sliding Tackle": 77, "Jumping": 84, "Stamina": 93,
      "Strength": 77, "Aggression": 85,
    },
    playstylePlus: ["Relentless"],
    playstyles: ["Intercept", "Slide Tackle", "Technical", "Flair", "First Touch"],
  },
  {
    id: "seed_putellas_90",
    name: "Alexia Putellas",
    overall: 90,
    position: "CM",
    altPositions: ["CAM"],
    rarity: "Base Gold",
    club: "FC Barcelona",
    league: "Liga F",
    nation: "Spain",
    heightCm: 173,
    weightKg: 67,
    preferredFoot: "Left",
    skillMoves: 5,
    weakFoot: 5,
    faceStats: { pace: 82, shooting: 89, passing: 90, dribbling: 91, defending: 72, physical: 78 },
    attributes: {
      "Acceleration": 81, "Sprint Speed": 82, "Attack Positioning": 90, "Finishing": 91, "Shot Power": 86,
      "Long Shots": 89, "Volleys": 87, "Penalties": 90, "Vision": 91, "Crossing": 88, "FK Accuracy": 89,
      "Short Passing": 93, "Long Passing": 89, "Curve": 89, "Agility": 90, "Balance": 89, "Reactions": 91,
      "Ball Control": 92, "Dribbling": 91, "Composure": 92, "Interceptions": 78, "Heading Accuracy": 74,
      "Def Awareness": 70, "Standing Tackle": 74, "Sliding Tackle": 65, "Jumping": 76, "Stamina": 85,
      "Strength": 78, "Aggression": 70,
    },
    playstylePlus: ["First Touch"],
    playstyles: ["Finesse Shot", "Incisive Pass", "Tiki Taka", "Technical", "Trivela"],
  },
  {
    id: "seed_vandijk_89",
    name: "Virgil van Dijk",
    overall: 89,
    position: "CB",
    altPositions: [],
    rarity: "Base Gold",
    club: "Liverpool",
    league: "Premier League",
    nation: "Netherlands",
    heightCm: 193,
    weightKg: 92,
    preferredFoot: "Right",
    skillMoves: 2,
    weakFoot: 3,
    faceStats: { pace: 78, shooting: 60, passing: 71, dribbling: 72, defending: 89, physical: 86 },
    attributes: {
      "Acceleration": 66, "Sprint Speed": 87, "Attack Positioning": 47, "Finishing": 52, "Shot Power": 81,
      "Long Shots": 64, "Volleys": 45, "Penalties": 62, "Vision": 65, "Crossing": 53, "FK Accuracy": 70,
      "Short Passing": 79, "Long Passing": 83, "Curve": 60, "Agility": 57, "Balance": 49, "Reactions": 89,
      "Ball Control": 76, "Dribbling": 70, "Composure": 90, "Interceptions": 90, "Heading Accuracy": 89,
      "Def Awareness": 90, "Standing Tackle": 91, "Sliding Tackle": 86, "Jumping": 89, "Stamina": 74,
      "Strength": 93, "Aggression": 85,
    },
    playstylePlus: ["Aerial"],
    playstyles: ["Pinged Pass", "Long Ball Pass", "Jockey", "Block", "Anticipate", "Bruiser"],
  },
];

let seeded = false;
async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const db = await ensureFutCardsTable();
  if (!db) return;
  const countRow = rowsOf(await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM fut_cards`))[0];
  if ((countRow?.cnt ?? 0) === 0) {
    await upsertFutCards(SEED_CARDS);
  }
}

export async function searchFutCards(params: {
  query?: string;
  rarity?: string;
  position?: string;
  limit?: number;
}): Promise<FutCard[]> {
  await ensureSeeded();
  const db = await ensureFutCardsTable();
  const q = norm(params.query ?? "");
  const rarity = (params.rarity ?? "").trim();
  const position = (params.position ?? "").trim().toUpperCase();
  const limit = Math.min(50, Math.max(1, params.limit ?? 24));

  // Query local Postgres cache first
  let cached: FutCard[] = [];
  if (db) {
    const res = rowsOf(
      await db.execute(sql`
        SELECT card_json
        FROM fut_cards
        WHERE (${q === ""} OR search_name LIKE ${`%${q}%`})
          AND (${rarity === "" || rarity === "ALL"} OR rarity = ${rarity})
          AND (${position === "" || position === "ALL"} OR position = ${position})
        ORDER BY overall DESC, name ASC
        LIMIT ${limit}
      `)
    );
    cached = res.map((r: any) => r.card_json as FutCard);
  }

  // If cache has fewer than 6 matches for a text search, pull live from EA's ratings API and cache
  if (q.length >= 2 && cached.length < 6) {
    const live = await fetchUpstreamEaCards(params.query!);
    if (live.length > 0 && db) {
      const refreshed = rowsOf(
        await db.execute(sql`
          SELECT card_json
          FROM fut_cards
          WHERE search_name LIKE ${`%${q}%`}
            AND (${rarity === "" || rarity === "ALL"} OR rarity = ${rarity})
            AND (${position === "" || position === "ALL"} OR position = ${position})
          ORDER BY overall DESC, name ASC
          LIMIT ${limit}
        `)
      );
      return refreshed.map((r: any) => r.card_json as FutCard);
    }
  }

  return cached.length > 0 ? cached : SEED_CARDS.slice(0, limit);
}

export async function getFutCardById(cardId: string): Promise<FutCard | null> {
  await ensureSeeded();
  const db = await ensureFutCardsTable();
  if (db) {
    const row = rowsOf(await db.execute(sql`SELECT card_json FROM fut_cards WHERE id = ${cardId} LIMIT 1`))[0];
    if (row?.card_json) return row.card_json as FutCard;
  }
  return SEED_CARDS.find(c => c.id === cardId) ?? null;
}

export async function getAvailableRarities(): Promise<string[]> {
  await ensureSeeded();
  const db = await ensureFutCardsTable();
  if (!db) return ["Base Gold"];
  const rows = rowsOf(await db.execute(sql`SELECT DISTINCT rarity FROM fut_cards ORDER BY rarity ASC`));
  return rows.map((r: any) => String(r.rarity)).filter(Boolean);
}
