import { db } from "./db";
import { sql } from "drizzle-orm";

export interface FutCard {
  id: string;
  eaAssetId: string | null;
  name: string;
  commonName: string | null;
  rarity: string;
  overall: number;
  position: string;
  altPositions: string[];
  club: string | null;
  league: string | null;
  nation: string | null;
  heightCm: number | null;
  weightKg: number | null;
  skillMoves: number;
  weakFoot: number;
  preferredFoot: string;
  faceStats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  attributes: Record<string, number>;
  playstylePlus: string[];
  playstyles: string[];
  avatarUrl: string | null;
}

const STAT_KEY_MAP: Record<string, string> = {
  acceleration: "Acceleration",
  sprintspeed: "Sprint Speed",
  positioning: "Att. Position",
  attposition: "Att. Position",
  finishing: "Finishing",
  shotpower: "Shot Power",
  longshots: "Long Shots",
  volleys: "Volleys",
  penalties: "Penalties",
  vision: "Vision",
  crossing: "Crossing",
  freekickaccuracy: "FK Acc.",
  fkacc: "FK Acc.",
  shortpassing: "Short Pass",
  shortpass: "Short Pass",
  longpassing: "Long Pass",
  longpass: "Long Pass",
  curve: "Curve",
  agility: "Agility",
  balance: "Balance",
  reactions: "Reactions",
  ballcontrol: "Ball Control",
  dribbling: "Dribbling",
  composure: "Composure",
  interceptions: "Interceptions",
  headingaccuracy: "Heading Acc.",
  headingacc: "Heading Acc.",
  defensiveawareness: "Def. Awareness",
  defawareness: "Def. Awareness",
  marking: "Def. Awareness",
  standingtackle: "Stand Tackle",
  standtackle: "Stand Tackle",
  slidingtackle: "Slide Tackle",
  slidetackle: "Slide Tackle",
  jumping: "Jumping",
  stamina: "Stamina",
  strength: "Strength",
  aggression: "Aggression",
};

function normalizeStatKey(raw: string): string | null {
  return STAT_KEY_MAP[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

let schemaReady = false;

export async function ensureFutCardsSchema(): Promise<void> {
  if (schemaReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fut_cards (
      id VARCHAR(128) PRIMARY KEY,
      ea_asset_id VARCHAR(64),
      name VARCHAR(160) NOT NULL,
      common_name VARCHAR(160),
      rarity VARCHAR(80) NOT NULL DEFAULT 'Gold Rare',
      overall INTEGER NOT NULL,
      position VARCHAR(16) NOT NULL,
      alt_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
      club VARCHAR(120),
      league VARCHAR(120),
      nation VARCHAR(120),
      height_cm INTEGER,
      weight_kg INTEGER,
      skill_moves INTEGER NOT NULL DEFAULT 3,
      weak_foot INTEGER NOT NULL DEFAULT 3,
      preferred_foot VARCHAR(16) NOT NULL DEFAULT 'Right',
      face_stats JSONB NOT NULL,
      attributes JSONB NOT NULL,
      playstyle_plus JSONB NOT NULL DEFAULT '[]'::jsonb,
      playstyles JSONB NOT NULL DEFAULT '[]'::jsonb,
      avatar_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fut_cards_search ON fut_cards (LOWER(name), position, rarity)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fut_cards_overall ON fut_cards (overall DESC)`);
  schemaReady = true;
}

function rowToFutCard(row: any): FutCard {
  const parseJson = <T>(val: any, fallback: T): T => {
    if (val == null) return fallback;
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return fallback; }
    }
    return val as T;
  };
  return {
    id: String(row.id),
    eaAssetId: row.ea_asset_id ?? null,
    name: String(row.name),
    commonName: row.common_name ?? null,
    rarity: String(row.rarity || "Gold Rare"),
    overall: Number(row.overall),
    position: String(row.position),
    altPositions: parseJson<string[]>(row.alt_positions, []),
    club: row.club ?? null,
    league: row.league ?? null,
    nation: row.nation ?? null,
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
    skillMoves: Number(row.skill_moves ?? 3),
    weakFoot: Number(row.weak_foot ?? 3),
    preferredFoot: String(row.preferred_foot ?? "Right"),
    faceStats: parseJson(row.face_stats, { pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 50, physical: 75 }),
    attributes: parseJson<Record<string, number>>(row.attributes, {}),
    playstylePlus: parseJson<string[]>(row.playstyle_plus, []),
    playstyles: parseJson<string[]>(row.playstyles, []),
    avatarUrl: row.avatar_url ?? null,
  };
}

export async function upsertFutCards(cards: FutCard[]): Promise<number> {
  if (!cards.length) return 0;
  await ensureFutCardsSchema();
  for (const c of cards) {
    await db.execute(sql`
      INSERT INTO fut_cards (
        id, ea_asset_id, name, common_name, rarity, overall, position,
        alt_positions, club, league, nation, height_cm, weight_kg,
        skill_moves, weak_foot, preferred_foot, face_stats, attributes,
        playstyle_plus, playstyles, avatar_url, updated_at
      ) VALUES (
        ${c.id}, ${c.eaAssetId}, ${c.name}, ${c.commonName}, ${c.rarity}, ${c.overall}, ${c.position},
        ${JSON.stringify(c.altPositions)}::jsonb, ${c.club}, ${c.league}, ${c.nation}, ${c.heightCm}, ${c.weightKg},
        ${c.skillMoves}, ${c.weakFoot}, ${c.preferredFoot},
        ${JSON.stringify(c.faceStats)}::jsonb, ${JSON.stringify(c.attributes)}::jsonb,
        ${JSON.stringify(c.playstylePlus)}::jsonb, ${JSON.stringify(c.playstyles)}::jsonb, ${c.avatarUrl}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, rarity = EXCLUDED.rarity, overall = EXCLUDED.overall,
        position = EXCLUDED.position, alt_positions = EXCLUDED.alt_positions,
        club = EXCLUDED.club, league = EXCLUDED.league, nation = EXCLUDED.nation,
        height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
        skill_moves = EXCLUDED.skill_moves, weak_foot = EXCLUDED.weak_foot,
        preferred_foot = EXCLUDED.preferred_foot, face_stats = EXCLUDED.face_stats,
        attributes = EXCLUDED.attributes, playstyle_plus = EXCLUDED.playstyle_plus,
        playstyles = EXCLUDED.playstyles, updated_at = NOW()
    `);
  }
  return cards.length;
}

async function fetchJsonSafe(url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.ea.com/games/ea-sports-fc/ratings",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || (!text.trim().startsWith("{") && !text.trim().startsWith("["))) return null;
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseEaItem(item: any): FutCard | null {
  const fullName = item.commonName || [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || item.name;
  if (!fullName || !item.overallRating) return null;

  const rawStats = item.stats ?? {};
  const attrs: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawStats)) {
    const val = typeof v === "object" && v !== null ? Number((v as any).value) : Number(v);
    const mapped = normalizeStatKey(k);
    if (Number.isFinite(val) && mapped) attrs[mapped] = val;
  }

  const faceStats = {
    pace: Number(rawStats.pac?.value ?? rawStats.pace ?? 75),
    shooting: Number(rawStats.sho?.value ?? rawStats.shooting ?? 75),
    passing: Number(rawStats.pas?.value ?? rawStats.passing ?? 75),
    dribbling: Number(rawStats.dri?.value ?? rawStats.dribbling ?? 75),
    defending: Number(rawStats.def?.value ?? rawStats.defending ?? 50),
    physical: Number(rawStats.phy?.value ?? rawStats.physical ?? 75),
  };

  const psPlus: string[] = [];
  const psStd: string[] = [];
  for (const ab of item.playerAbilities ?? item.playStyles ?? []) {
    const label = typeof ab === "string" ? ab : ab?.label || ab?.name;
    if (!label) continue;
    const isPlus = typeof ab === "object" && (ab?.type?.id === "playStylePlus" || ab?.isPlus || String(label).endsWith("+"));
    const clean = String(label).replace(/\+$/, "").trim();
    if (isPlus) psPlus.push(clean);
    else psStd.push(clean);
  }

  const position = typeof item.position === "string" ? item.position : item.position?.shortLabel || "ST";
  const assetId = String(item.id ?? item.assetId ?? `${fullName}-${item.overallRating}`);
  const rarity = item.rarity?.label || item.rarityName || "Gold Rare";

  return {
    id: `ea-${assetId}-${String(rarity).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    eaAssetId: assetId,
    name: fullName,
    commonName: item.commonName ?? null,
    rarity,
    overall: Number(item.overallRating),
    position,
    altPositions: Array.isArray(item.alternatePositions)
      ? item.alternatePositions.map((p: any) => (typeof p === "string" ? p : p?.shortLabel)).filter(Boolean)
      : [],
    club: item.team?.label ?? null,
    league: item.league?.label ?? null,
    nation: item.nationality?.label ?? null,
    heightCm: item.height != null ? Number(item.height) : null,
    weightKg: item.weight != null ? Number(item.weight) : null,
    skillMoves: Number(item.skillMoves ?? 3),
    weakFoot: Number(item.weakFootAbility ?? item.weakFoot ?? 3),
    preferredFoot: item.preferredFoot === 2 || item.preferredFoot === "Left" ? "Left" : "Right",
    faceStats,
    attributes: attrs,
    playstylePlus: psPlus,
    playstyles: psStd,
    avatarUrl: item.avatarUrl ?? null,
  };
}

async function fetchUpstreamCards(searchTerm?: string): Promise<FutCard[]> {
  const q = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
  for (const url of [
    `https://drop-api.ea.com/rating/ea-sports-fc?locale=en&limit=100${q}`,
    `https://drop-api.ea.com/rating/fc-27?locale=en&limit=100${q}`,
  ]) {
    const data = await fetchJsonSafe(url);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    if (items.length > 0) {
      return items.map(parseEaItem).filter((c): c is FutCard => !!c && c.position !== "GK");
    }
  }
  return [];
}

// Tuple: [id, name, rarity, ovr, pos, alts, club, league, nation, h, w, sm, wf, foot, [pac,sho,pas,dri,def,phy], psPlus, psStd, overrides]
type SeedTuple = [
  string, string, string, number, string, string[], string, string, string,
  number, number, number, number, "Right" | "Left",
  [number, number, number, number, number, number],
  string[], string[], Record<string, number>?
];

const SEED_DATA: SeedTuple[] = [
  ["fc27-kane-90", "Harry Kane", "Gold Rare", 90, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 3, 5, "Right", [67, 93, 85, 83, 49, 83], ["Finesse Shot"], ["Power Shot", "Incisive Pass", "Long Ball Pass", "First Touch", "Aerial", "Trivela"], { Acceleration: 65, "Sprint Speed": 69, "Att. Position": 94, Finishing: 95, "Shot Power": 93, "Long Shots": 89, Penalties: 93, Vision: 88, "Short Pass": 88, "Long Pass": 87, Agility: 72, Balance: 73, Reactions: 93, "Ball Control": 87, Composure: 92, "Heading Acc.": 90, Strength: 85 }],
  ["fc27-kane-92", "Harry Kane", "Team of the Week", 92, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 3, 5, "Right", [72, 95, 87, 85, 51, 85], ["Finesse Shot", "Incisive Pass"], ["Power Shot", "Long Ball Pass", "First Touch", "Aerial", "Trivela"], { Acceleration: 70, "Sprint Speed": 74, "Att. Position": 96, Finishing: 97, "Shot Power": 95, "Long Shots": 91, Penalties: 95, Vision: 90, "Short Pass": 90, "Long Pass": 89, Agility: 75, Balance: 76, Reactions: 95, "Ball Control": 89, Composure: 94, "Heading Acc.": 92, Strength: 87 }],
  ["fc27-kane-95", "Harry Kane", "Team of the Season", 95, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 4, 5, "Right", [84, 98, 91, 90, 55, 90], ["Finesse Shot", "Power Shot"], ["Incisive Pass", "Long Ball Pass", "First Touch", "Aerial", "Technical", "Trivela"], { Acceleration: 82, "Sprint Speed": 86, "Att. Position": 99, Finishing: 99, "Shot Power": 98, "Long Shots": 95, Vision: 94, "Short Pass": 94, "Long Pass": 93, Agility
