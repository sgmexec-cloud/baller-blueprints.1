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
  const clean = raw.toLowerCase().replace(/[^a-z]/g, "");
  return STAT_KEY_MAP[clean] ?? null;
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
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_fut_cards_search ON fut_cards (LOWER(name), position, rarity)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_fut_cards_overall ON fut_cards (overall DESC)`
  );
  schemaReady = true;
}

function rowToFutCard(row: any): FutCard {
  const parseJson = <T>(val: any, fallback: T): T => {
    if (val == null) return fallback;
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
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
    faceStats: parseJson(row.face_stats, {
      pace: 75,
      shooting: 75,
      passing: 75,
      dribbling: 75,
      defending: 50,
      physical: 75,
    }),
    attributes: parseJson<Record<string, number>>(row.attributes, {}),
    playstylePlus: parseJson<string[]>(row.playstyle_plus, []),
    playstyles: parseJson<string[]>(row.playstyles, []),
    avatarUrl: row.avatar_url ?? null,
  };
}

export async function upsertFutCards(cards: FutCard[]): Promise<number> {
  if (!cards.length) return 0;
  await ensureFutCardsSchema();

  let count = 0;
  for (const c of cards) {
    await db.execute(sql`
      INSERT INTO fut_cards (
        id, ea_asset_id, name, common_name, rarity, overall, position,
        alt_positions, club, league, nation, height_cm, weight_kg,
        skill_moves, weak_foot, preferred_foot, face_stats, attributes,
        playstyle_plus, playstyles, avatar_url, updated_at
      ) VALUES (
        ${c.id},
        ${c.eaAssetId},
        ${c.name},
        ${c.commonName},
        ${c.rarity},
        ${c.overall},
        ${c.position},
        ${JSON.stringify(c.altPositions)}::jsonb,
        ${c.club},
        ${c.league},
        ${c.nation},
        ${c.heightCm},
        ${c.weightKg},
        ${c.skillMoves},
        ${c.weakFoot},
        ${c.preferredFoot},
        ${JSON.stringify(c.faceStats)}::jsonb,
        ${JSON.stringify(c.attributes)}::jsonb,
        ${JSON.stringify(c.playstylePlus)}::jsonb,
        ${JSON.stringify(c.playstyles)}::jsonb,
        ${c.avatarUrl},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        common_name = EXCLUDED.common_name,
        rarity = EXCLUDED.rarity,
        overall = EXCLUDED.overall,
        position = EXCLUDED.position,
        alt_positions = EXCLUDED.alt_positions,
        club = EXCLUDED.club,
        league = EXCLUDED.league,
        nation = EXCLUDED.nation,
        height_cm = EXCLUDED.height_cm,
        weight_kg = EXCLUDED.weight_kg,
        skill_moves = EXCLUDED.skill_moves,
        weak_foot = EXCLUDED.weak_foot,
        preferred_foot = EXCLUDED.preferred_foot,
        face_stats = EXCLUDED.face_stats,
        attributes = EXCLUDED.attributes,
        playstyle_plus = EXCLUDED.playstyle_plus,
        playstyles = EXCLUDED.playstyles,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
    `);
    count++;
  }
  return count;
}

/**
 * Safe HTTP JSON fetcher that never throws on empty or HTML responses from CDNs.
 */
async function fetchJsonSafe(url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en;q=0.9",
        Origin: "https://www.ea.com",
        Referer: "https://www.ea.com/games/ea-sports-fc/ratings",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseEaItem(item: any): FutCard | null {
  const fullName =
    item.commonName ||
    [item.firstName, item.lastName].filter(Boolean).join(" ").trim() ||
    item.name;
  if (!fullName || !item.overallRating) return null;

  const rawStats = item.stats ?? {};
  const attrs: Record<string, number> = {};

  for (const [k, v] of Object.entries(rawStats)) {
    const val = typeof v === "object" && v !== null ? Number((v as any).value) : Number(v);
    if (!Number.isFinite(val)) continue;
    const mapped = normalizeStatKey(k);
    if (mapped) attrs[mapped] = val;
  }

  const avg = (keys: string[], fallback: number) => {
    const vals = keys.map((k) => attrs[k]).filter((n) => typeof n === "number");
    return vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : fallback;
  };

  const faceStats = {
    pace: Number(rawStats.pac?.value ?? rawStats.pace ?? avg(["Acceleration", "Sprint Speed"], 75)),
    shooting: Number(
      rawStats.sho?.value ??
        rawStats.shooting ??
        avg(["Att. Position", "Finishing", "Shot Power", "Long Shots", "Volleys", "Penalties"], 75)
    ),
    passing: Number(
      rawStats.pas?.value ??
        rawStats.passing ??
        avg(["Vision", "Crossing", "FK Acc.", "Short Pass", "Long Pass", "Curve"], 75)
    ),
    dribbling: Number(
      rawStats.dri?.value ??
        rawStats.dribbling ??
        avg(["Agility", "Balance", "Reactions", "Ball Control", "Dribbling", "Composure"], 75)
    ),
    defending: Number(
      rawStats.def?.value ??
        rawStats.defending ??
        avg(["Interceptions", "Heading Acc.", "Def. Awareness", "Stand Tackle", "Slide Tackle"], 50)
    ),
    physical: Number(
      rawStats.phy?.value ??
        rawStats.physical ??
        avg(["Jumping", "Stamina", "Strength", "Aggression"], 75)
    ),
  };

  const psPlus: string[] = [];
  const psStd: string[] = [];
  const rawAbilities = item.playerAbilities ?? item.playStyles ?? [];
  if (Array.isArray(rawAbilities)) {
    for (const ab of rawAbilities) {
      const label = typeof ab === "string" ? ab : ab?.label || ab?.name;
      if (!label) continue;
      const isPlus =
        typeof ab === "object" &&
        (ab?.type?.id === "playStylePlus" || ab?.isPlus === true || String(label).endsWith("+"));
      const cleanName = String(label).replace(/\+$/, "").trim();
      if (isPlus) psPlus.push(cleanName);
      else psStd.push(cleanName);
    }
  }

  const posObj = item.position;
  const position =
    typeof posObj === "string" ? posObj : posObj?.shortLabel || posObj?.label || "ST";
  const altPositions = Array.isArray(item.alternatePositions)
    ? item.alternatePositions.map((p: any) => (typeof p === "string" ? p : p?.shortLabel)).filter(Boolean)
    : [];

  const assetId = String(item.id ?? item.assetId ?? `${fullName}-${item.overallRating}`);
  const rarity =
    item.rarity?.label ||
    item.rarityName ||
    (Number(item.overallRating) >= 75 ? "Gold Rare" : "Silver Rare");

  return {
    id: `ea-${assetId}-${String(rarity).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    eaAssetId: assetId,
    name: fullName,
    commonName: item.commonName ?? null,
    rarity,
    overall: Number(item.overallRating),
    position,
    altPositions,
    club: item.team?.label ?? item.club?.name ?? null,
    league: item.league?.label ?? item.league?.name ?? null,
    nation: item.nationality?.label ?? item.nation?.name ?? null,
    heightCm: item.height != null ? Number(item.height) : null,
    weightKg: item.weight != null ? Number(item.weight) : null,
    skillMoves: Number(item.skillMoves ?? 3),
    weakFoot: Number(item.weakFootAbility ?? item.weakFoot ?? 3),
    preferredFoot: item.preferredFoot === 2 || item.preferredFoot === "Left" ? "Left" : "Right",
    faceStats,
    attributes: attrs,
    playstylePlus: psPlus,
    playstyles: psStd,
    avatarUrl: item.avatarUrl ?? item.shieldUrl ?? null,
  };
}

async function fetchUpstreamCards(searchTerm?: string): Promise<FutCard[]> {
  const q = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
  const endpoints = [
    `https://drop-api.ea.com/rating/ea-sports-fc?locale=en&limit=100${q}`,
    `https://drop-api.ea.com/rating/fc-27?locale=en&limit=100${q}`,
    `https://drop-api.ea.com/rating/fc-26?locale=en&limit=100${q}`,
  ];

  const collected: FutCard[] = [];
  for (const url of endpoints) {
    const data = await fetchJsonSafe(url);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    if (items.length > 0) {
      for (const item of items) {
        const parsed = parseEaItem(item);
        if (parsed && parsed.position !== "GK") collected.push(parsed);
      }
      break;
    }
  }
  return collected;
}

/**
 * Helper to build a full 29-attribute FC card entry cleanly from group profiles.
 */
function buildSeedCard(spec: {
  id: string;
  name: string;
  rarity: string;
  overall: number;
  position: string;
  altPositions?: string[];
  club: string;
  league: string;
  nation: string;
  heightCm: number;
  weightKg: number;
  skillMoves: number;
  weakFoot: number;
  preferredFoot: "Right" | "Left";
  faceStats: { pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number };
  attrs: Record<string, number>;
  playstylePlus: string[];
  playstyles: string[];
}): FutCard {
  const f = spec.faceStats;
  const fullAttrs: Record<string, number> = {
    Acceleration: f.pace,
    "Sprint Speed": f.pace,
    "Att. Position": f.shooting,
    Finishing: f.shooting,
    "Shot Power": f.shooting,
    "Long Shots": f.shooting,
    Volleys: Math.max(40, f.shooting - 2),
    Penalties: Math.max(40, f.shooting - 2),
    Vision: f.passing,
    Crossing: Math.max(40, f.passing - 2),
    "FK Acc.": Math.max(40, f.passing - 4),
    "Short Pass": f.passing,
    "Long Pass": Math.max(40, f.passing - 1),
    Curve: Math.max(40, f.passing - 2),
    Agility: f.dribbling,
    Balance: Math.max(40, f.dribbling - 2),
    Reactions: f.dribbling,
    "Ball Control": f.dribbling,
    Dribbling: f.dribbling,
    Composure: f.dribbling,
    Interceptions: f.defending,
    "Heading Acc.": Math.max(40, f.defending),
    "Def. Awareness": f.defending,
    "Stand Tackle": f.defending,
    "Slide Tackle": Math.max(40, f.defending - 2),
    Jumping: f.physical,
    Stamina: f.physical,
    Strength: f.physical,
    Aggression: Math.max(40, f.physical - 2),
    ...spec.attrs,
  };

  return {
    id: spec.id,
    eaAssetId: spec.id,
    name: spec.name,
    commonName: spec.name,
    rarity: spec.rarity,
    overall: spec.overall,
    position: spec.position,
    altPositions: spec.altPositions ?? [],
    club: spec.club,
    league: spec.league,
    nation: spec.nation,
    heightCm: spec.heightCm,
    weightKg: spec.weightKg,
    skillMoves: spec.skillMoves,
    weakFoot: spec.weakFoot,
    preferredFoot: spec.preferredFoot,
    faceStats: spec.faceStats,
    attributes: fullAttrs,
    playstylePlus: spec.playstylePlus,
    playstyles: spec.playstyles,
    avatarUrl: null,
  };
}

const BUILTIN_FC27_CARDS: FutCard[] = [
  // HARRY KANE (Gold Rare, TOTW, TOTS)
  buildSeedCard({
    id: "fc27-harry-kane-90",
    name: "Harry Kane",
    rarity: "Gold Rare",
    overall: 90,
    position: "ST",
    altPositions: ["CAM"],
    club: "FC Bayern München",
    league: "Bundesliga",
    nation: "England",
    heightCm: 188,
    weightKg: 86,
    skillMoves: 3,
    weakFoot: 5,
    preferredFoot: "Right",
    faceStats: { pace: 67, shooting: 93, passing: 85, dribbling: 83, defending: 49, physical: 83 },
    attrs: {
      Acceleration: 65, "Sprint Speed": 69,
      "Att. Position": 94, Finishing: 95, "Shot Power": 93, "Long Shots": 89, Volleys: 89, Penalties: 93,
      Vision: 88, Crossing: 82, "FK Acc.": 72, "Short Pass": 88, "Long Pass": 87, Curve: 83,
      Agility: 72, Balance: 73, Reactions: 93, "Ball Control": 87, Dribbling: 82, Composure: 92,
      Interceptions: 45, "Heading Acc.": 90, "Def. Awareness": 46, "Stand Tackle": 46, "Slide Tackle": 38,
      Jumping: 82, Stamina: 83, Strength: 85, Aggression: 80,
    },
    playstylePlus: ["Finesse Shot"],
    playstyles: ["Power Shot", "Incisive Pass", "Long Ball Pass", "First Touch", "Aerial", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-harry-kane-92-totw",
    name: "Harry Kane",
    rarity: "Team of the Week",
    overall: 92,
    position: "ST",
    altPositions: ["CAM"],
    club: "FC Bayern München",
    league: "Bundesliga",
    nation: "England",
    heightCm: 188,
    weightKg: 86,
    skillMoves: 3,
    weakFoot: 5,
    preferredFoot: "Right",
    faceStats: { pace: 72, shooting: 95, passing: 87, dribbling: 85, defending: 51, physical: 85 },
    attrs: {
      Acceleration: 70, "Sprint Speed": 74,
      "Att. Position": 96, Finishing: 97, "Shot Power": 95, "Long Shots": 91, Volleys: 91, Penalties: 95,
      Vision: 90, Crossing: 84, "FK Acc.": 75, "Short Pass": 90, "Long Pass": 89, Curve: 85,
      Agility: 75, Balance: 76, Reactions: 95, "Ball Control": 89, Dribbling: 84, Composure: 94,
      Interceptions: 47, "Heading Acc.": 92, "Def. Awareness": 48, "Stand Tackle": 48, "Slide Tackle": 40,
      Jumping: 84, Stamina: 85, Strength: 87, Aggression: 82,
    },
    playstylePlus: ["Finesse Shot", "Incisive Pass"],
    playstyles: ["Power Shot", "Long Ball Pass", "First Touch", "Aerial", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-harry-kane-95-tots",
    name: "Harry Kane",
    rarity: "Team of the Season",
    overall: 95,
    position: "ST",
    altPositions: ["CAM"],
    club: "FC Bayern München",
    league: "Bundesliga",
    nation: "England",
    heightCm: 188,
    weightKg: 86,
    skillMoves: 4,
    weakFoot: 5,
    preferredFoot: "Right",
    faceStats: { pace: 84, shooting: 98, passing: 91, dribbling: 90, defending: 55, physical: 90 },
    attrs: {
      Acceleration: 82, "Sprint Speed": 86,
      "Att. Position": 99, Finishing: 99, "Shot Power": 98, "Long Shots": 95, Volleys: 94, Penalties: 97,
      Vision: 94, Crossing: 88, "FK Acc.": 80, "Short Pass": 94, "Long Pass": 93, Curve: 89,
      Agility: 82, Balance: 82, Reactions: 97, "Ball Control": 94, Dribbling: 90, Composure: 97,
      Interceptions: 50, "Heading Acc.": 95, "Def. Awareness": 52, "Stand Tackle": 52, "Slide Tackle": 44,
      Jumping: 88, Stamina: 90, Strength: 92, Aggression: 86,
    },
    playstylePlus: ["Finesse Shot", "Power Shot"],
    playstyles: ["Incisive Pass", "Long Ball Pass", "First Touch", "Aerial", "Technical", "Trivela"],
  }),

  // STRIKERS & FORWARDS
  buildSeedCard({
    id: "fc27-kylian-mbappe-91",
    name: "Kylian Mbappé",
    rarity: "Gold Rare",
    overall: 91,
    position: "ST",
    altPositions: ["LW"],
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "France",
    heightCm: 182,
    weightKg: 75,
    skillMoves: 5,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 97, shooting: 90, passing: 80, dribbling: 92, defending: 36, physical: 78 },
    attrs: {
      Acceleration: 97, "Sprint Speed": 97,
      "Att. Position": 93, Finishing: 94, "Shot Power": 90, "Long Shots": 83, Volleys: 84, Penalties: 84,
      Vision: 83, Crossing: 78, "FK Acc.": 69, "Short Pass": 86, "Long Pass": 71, Curve: 80,
      Agility: 93, Balance: 82, Reactions: 93, "Ball Control": 92, Dribbling: 93, Composure: 88,
      Interceptions: 38, "Heading Acc.": 73, "Def. Awareness": 26, "Stand Tackle": 34, "Slide Tackle": 32,
      Jumping: 88, Stamina: 88, Strength: 77, Aggression: 64,
    },
    playstylePlus: ["Quick Step"],
    playstyles: ["Finesse Shot", "Rapid", "Flair", "Trivela", "Acrobatic"],
  }),
  buildSeedCard({
    id: "fc27-erling-haaland-91",
    name: "Erling Haaland",
    rarity: "Gold Rare",
    overall: 91,
    position: "ST",
    club: "Manchester City",
    league: "Premier League",
    nation: "Norway",
    heightCm: 195,
    weightKg: 94,
    skillMoves: 3,
    weakFoot: 3,
    preferredFoot: "Left",
    faceStats: { pace: 88, shooting: 92, passing: 70, dribbling: 81, defending: 45, physical: 88 },
    attrs: {
      Acceleration: 81, "Sprint Speed": 94,
      "Att. Position": 95, Finishing: 96, "Shot Power": 94, "Long Shots": 86, Volleys: 90, Penalties: 88,
      Vision: 74, Crossing: 58, "FK Acc.": 62, "Short Pass": 77, "Long Pass": 63, Curve: 77,
      Agility: 76, Balance: 72, Reactions: 94, "Ball Control": 82, Dribbling: 79, Composure: 87,
      Interceptions: 43, "Heading Acc.": 83, "Def. Awareness": 38, "Stand Tackle": 47, "Slide Tackle": 29,
      Jumping: 92, Stamina: 78, Strength: 93, Aggression: 88,
    },
    playstylePlus: ["Acrobatic"],
    playstyles: ["Power Shot", "Power Header", "Quick Step", "Bruiser"],
  }),
  buildSeedCard({
    id: "fc27-alexander-isak-87",
    name: "Alexander Isak",
    rarity: "Gold Rare",
    overall: 87,
    position: "ST",
    club: "Newcastle United",
    league: "Premier League",
    nation: "Sweden",
    heightCm: 192,
    weightKg: 77,
    skillMoves: 4,
    weakFoot: 5,
    preferredFoot: "Right",
    faceStats: { pace: 86, shooting: 86, passing: 75, dribbling: 86, defending: 39, physical: 76 },
    attrs: {
      Acceleration: 85, "Sprint Speed": 87,
      "Att. Position": 88, Finishing: 88, "Shot Power": 85, "Long Shots": 81, Volleys: 82, Penalties: 84,
      Vision: 79, Crossing: 70, "FK Acc.": 68, "Short Pass": 81, "Long Pass": 70, Curve: 80,
      Agility: 84, Balance: 76, Reactions: 86, "Ball Control": 87, Dribbling: 88, Composure: 85,
      Interceptions: 36, "Heading Acc.": 79, "Def. Awareness": 35, "Stand Tackle": 37, "Slide Tackle": 30,
      Jumping: 82, Stamina: 80, Strength: 75, Aggression: 68,
    },
    playstylePlus: ["Finesse Shot"],
    playstyles: ["Technical", "Rapid", "First Touch", "Flair"],
  }),
  buildSeedCard({
    id: "fc27-viktor-gyokeres-87",
    name: "Viktor Gyökeres",
    rarity: "Gold Rare",
    overall: 87,
    position: "ST",
    club: "Sporting CP",
    league: "Liga Portugal",
    nation: "Sweden",
    heightCm: 187,
    weightKg: 90,
    skillMoves: 3,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 89, shooting: 86, passing: 74, dribbling: 83, defending: 40, physical: 90 },
    attrs: {
      Acceleration: 87, "Sprint Speed": 91,
      "Att. Position": 88, Finishing: 88, "Shot Power": 87, "Long Shots": 80, Volleys: 81, Penalties: 86,
      Vision: 77, Crossing: 70, "FK Acc.": 64, "Short Pass": 79, "Long Pass": 68, Curve: 75,
      Agility: 81, Balance: 80, Reactions: 86, "Ball Control": 84, Dribbling: 84, Composure: 84,
      Interceptions: 38, "Heading Acc.": 80, "Def. Awareness": 35, "Stand Tackle": 38, "Slide Tackle": 32,
      Jumping: 84, Stamina: 90, Strength: 92, Aggression: 88,
    },
    playstylePlus: ["Power Shot"],
    playstyles: ["Quick Step", "Rapid", "Bruiser", "Relentless"],
  }),
  buildSeedCard({
    id: "fc27-lautaro-martinez-89",
    name: "Lautaro Martínez",
    rarity: "Gold Rare",
    overall: 89,
    position: "ST",
    club: "Inter",
    league: "Serie A Enilive",
    nation: "Argentina",
    heightCm: 174,
    weightKg: 72,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 83, shooting: 88, passing: 76, dribbling: 86, defending: 48, physical: 85 },
    attrs: {
      Acceleration: 85, "Sprint Speed": 81,
      "Att. Position": 91, Finishing: 91, "Shot Power": 88, "Long Shots": 82, Volleys: 88, Penalties: 83,
      Vision: 80, Crossing: 68, "FK Acc.": 64, "Short Pass": 82, "Long Pass": 72, Curve: 78,
      Agility: 86, Balance: 87, Reactions: 90, "Ball Control": 87, Dribbling: 85, Composure: 86,
      Interceptions: 46, "Heading Acc.": 87, "Def. Awareness": 44, "Stand Tackle": 45, "Slide Tackle": 40,
      Jumping: 90, Stamina: 86, Strength: 83, Aggression: 88,
    },
    playstylePlus: ["Finesse Shot"],
    playstyles: ["Power Header", "Relentless", "Technical", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-antoine-griezmann-88",
    name: "Antoine Griezmann",
    rarity: "Gold Rare",
    overall: 88,
    position: "ST",
    altPositions: ["CAM", "CF"],
    club: "Atlético de Madrid",
    league: "LALIGA EA SPORTS",
    nation: "France",
    
