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
    heightCm: 176,
    weightKg: 73,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Left",
    faceStats: { pace: 80, shooting: 88, passing: 87, dribbling: 89, defending: 59, physical: 75 },
    attrs: {
      Acceleration: 82, "Sprint Speed": 78,
      "Att. Position": 91, Finishing: 89, "Shot Power": 85, "Long Shots": 87, Volleys: 89, Penalties: 85,
      Vision: 90, Crossing: 86, "FK Acc.": 85, "Short Pass": 88, "Long Pass": 84, Curve: 89,
      Agility: 89, Balance: 85, Reactions: 91, "Ball Control": 90, Dribbling: 88, Composure: 89,
      Interceptions: 58, "Heading Acc.": 80, "Def. Awareness": 55, "Stand Tackle": 56, "Slide Tackle": 49,
      Jumping: 86, Stamina: 86, Strength: 68, Aggression: 73,
    },
    playstylePlus: ["Finesse Shot"],
    playstyles: ["Incisive Pass", "Technical", "Flair", "Relentless", "Trivela"],
  }),

  // WINGERS (LW / RW)
  buildSeedCard({
    id: "fc27-vinicius-jr-91",
    name: "Vinícius Jr.",
    rarity: "Gold Rare",
    overall: 91,
    position: "LW",
    altPositions: ["ST"],
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "Brazil",
    heightCm: 176,
    weightKg: 73,
    skillMoves: 5,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 95, shooting: 85, passing: 81, dribbling: 92, defending: 29, physical: 69 },
    attrs: {
      Acceleration: 95, "Sprint Speed": 95,
      "Att. Position": 87, Finishing: 88, "Shot Power": 82, "Long Shots": 80, Volleys: 76, Penalties: 76,
      Vision: 85, Crossing: 81, "FK Acc.": 62, "Short Pass": 83, "Long Pass": 77, Curve: 80,
      Agility: 94, Balance: 84, Reactions: 88, "Ball Control": 91, Dribbling: 94, Composure: 84,
      Interceptions: 26, "Heading Acc.": 50, "Def. Awareness": 32, "Stand Tackle": 25, "Slide Tackle": 18,
      Jumping: 75, Stamina: 85, Strength: 65, Aggression: 58,
    },
    playstylePlus: ["Quick Step"],
    playstyles: ["Finesse Shot", "Chip Shot", "Rapid", "Flair", "First Touch", "Trickster"],
  }),
  buildSeedCard({
    id: "fc27-mohamed-salah-90",
    name: "Mohamed Salah",
    rarity: "Gold Rare",
    overall: 90,
    position: "RW",
    altPositions: ["RM"],
    club: "Liverpool",
    league: "Premier League",
    nation: "Egypt",
    heightCm: 175,
    weightKg: 71,
    skillMoves: 4,
    weakFoot: 3,
    preferredFoot: "Left",
    faceStats: { pace: 89, shooting: 88, passing: 83, dribbling: 89, defending: 45, physical: 75 },
    attrs: {
      Acceleration: 89, "Sprint Speed": 89,
      "Att. Position": 92, Finishing: 92, "Shot Power": 84, "Long Shots": 85, Volleys: 84, Penalties: 86,
      Vision: 86, Crossing: 83, "FK Acc.": 69, "Short Pass": 85, "Long Pass": 78, Curve: 86,
      Agility: 89, Balance: 91, Reactions: 92, "Ball Control": 89, Dribbling: 89, Composure: 91,
      Interceptions: 55, "Heading Acc.": 59, "Def. Awareness": 38, "Stand Tackle": 43, "Slide Tackle": 41,
      Jumping: 69, Stamina: 87, Strength: 75, Aggression: 63,
    },
    playstylePlus: ["Finesse Shot"],
    playstyles: ["Chip Shot", "Rapid", "First Touch", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-bukayo-saka-88",
    name: "Bukayo Saka",
    rarity: "Gold Rare",
    overall: 88,
    position: "RW",
    altPositions: ["RM"],
    club: "Arsenal",
    league: "Premier League",
    nation: "England",
    heightCm: 178,
    weightKg: 72,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Left",
    faceStats: { pace: 86, shooting: 83, passing: 84, dribbling: 88, defending: 60, physical: 72 },
    attrs: {
      Acceleration: 88, "Sprint Speed": 84,
      "Att. Position": 87, Finishing: 84, "Shot Power": 82, "Long Shots": 81, Volleys: 78, Penalties: 85,
      Vision: 86, Crossing: 86, "FK Acc.": 74, "Short Pass": 86, "Long Pass": 79, Curve: 85,
      Agility: 89, Balance: 88, Reactions: 87, "Ball Control": 88, Dribbling: 88, Composure: 86,
      Interceptions: 58, "Heading Acc.": 56, "Def. Awareness": 60, "Stand Tackle": 62, "Slide Tackle": 58,
      Jumping: 68, Stamina: 88, Strength: 68, Aggression: 66,
    },
    playstylePlus: ["Whipped Pass"],
    playstyles: ["Finesse Shot", "Technical", "Flair", "Relentless"],
  }),
  buildSeedCard({
    id: "fc27-lamine-yamal-86",
    name: "Lamine Yamal",
    rarity: "Gold Rare",
    overall: 86,
    position: "RW",
    altPositions: ["RM"],
    club: "FC Barcelona",
    league: "LALIGA EA SPORTS",
    nation: "Spain",
    heightCm: 180,
    weightKg: 72,
    skillMoves: 5,
    weakFoot: 3,
    preferredFoot: "Left",
    faceStats: { pace: 86, shooting: 79, passing: 82, dribbling: 89, defending: 28, physical: 58 },
    attrs: {
      Acceleration: 88, "Sprint Speed": 84,
      "Att. Position": 81, Finishing: 80, "Shot Power": 78, "Long Shots": 80, Volleys: 74, Penalties: 72,
      Vision: 84, Crossing: 83, "FK Acc.": 72, "Short Pass": 83, "Long Pass": 78, Curve: 86,
      Agility: 91, Balance: 85, Reactions: 83, "Ball Control": 89, Dribbling: 91, Composure: 83,
      Interceptions: 26, "Heading Acc.": 42, "Def. Awareness": 28, "Stand Tackle": 26, "Slide Tackle": 22,
      Jumping: 60, Stamina: 78, Strength: 53, Aggression: 48,
    },
    playstylePlus: ["Technical"],
    playstyles: ["Finesse Shot", "Incisive Pass", "Flair", "Trickster", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-heung-min-son-88",
    name: "Heung Min Son",
    rarity: "Gold Rare",
    overall: 88,
    position: "LW",
    altPositions: ["ST", "LM"],
    club: "Tottenham Hotspur",
    league: "Premier League",
    nation: "Korea Republic",
    heightCm: 183,
    weightKg: 78,
    skillMoves: 4,
    weakFoot: 5,
    preferredFoot: "Right",
    faceStats: { pace: 87, shooting: 89, passing: 82, dribbling: 85, defending: 42, physical: 69 },
    attrs: {
      Acceleration: 86, "Sprint Speed": 88,
      "Att. Position": 90, Finishing: 91, "Shot Power": 89, "Long Shots": 89, Volleys: 83, Penalties: 84,
      Vision: 83, Crossing: 83, "FK Acc.": 76, "Short Pass": 84, "Long Pass": 75, Curve: 85,
      Agility: 84, Balance: 78, Reactions: 88, "Ball Control": 85, Dribbling: 86, Composure: 87,
      Interceptions: 39, "Heading Acc.": 68, "Def. Awareness": 46, "Stand Tackle": 34, "Slide Tackle": 33,
      Jumping: 64, Stamina: 84, Strength: 64, Aggression: 62,
    },
    playstylePlus: ["Finesse Shot"],
    playstyles: ["Rapid", "First Touch", "Quick Step"],
  }),
  buildSeedCard({
    id: "fc27-raphinha-87",
    name: "Raphinha",
    rarity: "Gold Rare",
    overall: 87,
    position: "LW",
    altPositions: ["RW", "CAM"],
    club: "FC Barcelona",
    league: "LALIGA EA SPORTS",
    nation: "Brazil",
    heightCm: 176,
    weightKg: 68,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Left",
    faceStats: { pace: 91, shooting: 83, passing: 82, dribbling: 87, defending: 53, physical: 73 },
    attrs: {
      Acceleration: 92, "Sprint Speed": 90,
      "Att. Position": 86, Finishing: 84, "Shot Power": 84, "Long Shots": 82, Volleys: 78, Penalties: 80,
      Vision: 83, Crossing: 84, "FK Acc.": 79, "Short Pass": 82, "Long Pass": 77, Curve: 85,
      Agility: 88, Balance: 84, Reactions: 85, "Ball Control": 87, Dribbling: 88, Composure: 82,
      Interceptions: 52, "Heading Acc.": 54, "Def. Awareness": 50, "Stand Tackle": 54, "Slide Tackle": 48,
      Jumping: 74, Stamina: 90, Strength: 66, Aggression: 76,
    },
    playstylePlus: ["Rapid"],
    playstyles: ["Finesse Shot", "Whipped Pass", "Relentless", "Trivela"],
  }),

  // ATTACKING & CENTRAL MIDFIELDERS (CAM / CM)
  buildSeedCard({
    id: "fc27-jude-bellingham-90",
    name: "Jude Bellingham",
    rarity: "Gold Rare",
    overall: 90,
    position: "CAM",
    altPositions: ["CM"],
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "England",
    heightCm: 186,
    weightKg: 75,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 81, shooting: 87, passing: 83, dribbling: 88, defending: 78, physical: 83 },
    attrs: {
      Acceleration: 82, "Sprint Speed": 80,
      "Att. Position": 91, Finishing: 90, "Shot Power": 85, "Long Shots": 84, Volleys: 79, Penalties: 78,
      Vision: 88, Crossing: 68, "FK Acc.": 68, "Short Pass": 89, "Long Pass": 87, Curve: 75,
      Agility: 84, Balance: 83, Reactions: 91, "Ball Control": 89, Dribbling: 88, Composure: 89,
      Interceptions: 82, "Heading Acc.": 76, "Def. Awareness": 77, "Stand Tackle": 79, "Slide Tackle": 77,
      Jumping: 84, Stamina: 93, Strength: 79, Aggression: 85,
    },
    playstylePlus: ["Relentless"],
    playstyles: ["Incisive Pass", "Technical", "Flair", "Slide Tackle", "Intercept"],
  }),
  buildSeedCard({
    id: "fc27-cole-palmer-87",
    name: "Cole Palmer",
    rarity: "Gold Rare",
    overall: 87,
    position: "CAM",
    altPositions: ["RW", "RM"],
    club: "Chelsea",
    league: "Premier League",
    nation: "England",
    heightCm: 189,
    weightKg: 76,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Left",
    faceStats: { pace: 78, shooting: 84, passing: 85, dribbling: 87, defending: 50, physical: 68 },
    attrs: {
      Acceleration: 79, "Sprint Speed": 77,
      "Att. Position": 86, Finishing: 85, "Shot Power": 82, "Long Shots": 83, Volleys: 78, Penalties: 92,
      Vision: 88, Crossing: 81, "FK Acc.": 80, "Short Pass": 87, "Long Pass": 83, Curve: 85,
      Agility: 84, Balance: 79, Reactions: 86, "Ball Control": 88, Dribbling: 88, Composure: 90,
      Interceptions: 48, "Heading Acc.": 55, "Def. Awareness": 48, "Stand Tackle": 52, "Slide Tackle": 46,
      Jumping: 66, Stamina: 82, Strength: 65, Aggression: 58,
    },
    playstylePlus: ["Incisive Pass"],
    playstyles: ["Finesse Shot", "Technical", "First Touch", "Flair", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-florian-wirtz-89",
    name: "Florian Wirtz",
    rarity: "Gold Rare",
    overall: 89,
    position: "CAM",
    altPositions: ["LW"],
    club: "Bayer 04 Leverkusen",
    league: "Bundesliga",
    nation: "Germany",
    heightCm: 177,
    weightKg: 71,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 82, shooting: 81, passing: 88, dribbling: 91, defending: 50, physical: 65 },
    attrs: {
      Acceleration: 85, "Sprint Speed": 79,
      "Att. Position": 86, Finishing: 82, "Shot Power": 78, "Long Shots": 81, Volleys: 76, Penalties: 76,
      Vision: 91, Crossing: 82, "FK Acc.": 76, "Short Pass": 91, "Long Pass": 87, Curve: 85,
      Agility: 92, Balance: 90, Reactions: 88, "Ball Control": 92, Dribbling: 92, Composure: 88,
      Interceptions: 50, "Heading Acc.": 48, "Def. Awareness": 48, "Stand Tackle": 52, "Slide Tackle": 44,
      Jumping: 62, Stamina: 84, Strength: 58, Aggression: 58,
    },
    playstylePlus: ["Incisive Pass"],
    playstyles: ["Finesse Shot", "Pinged Pass", "Technical", "First Touch", "Flair"],
  }),
  buildSeedCard({
    id: "fc27-jamal-musiala-88",
    name: "Jamal Musiala",
    rarity: "Gold Rare",
    overall: 88,
    position: "CAM",
    altPositions: ["LM", "CM"],
    club: "FC Bayern München",
    league: "Bundesliga",
    nation: "Germany",
    heightCm: 184,
    weightKg: 72,
    skillMoves: 5,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 84, shooting: 80, passing: 81, dribbling: 91, defending: 55, physical: 64 },
    attrs: {
      Acceleration: 87, "Sprint Speed": 81,
      "Att. Position": 85, Finishing: 82, "Shot Power": 76, "Long Shots": 78, Volleys: 75, Penalties: 70,
      Vision: 85, Crossing: 72, "FK Acc.": 64, "Short Pass": 86, "Long Pass": 79, Curve: 78,
      Agility: 94, Balance: 91, Reactions: 86, "Ball Control": 91, Dribbling: 93, Composure: 86,
      Interceptions: 56, "Heading Acc.": 50, "Def. Awareness": 54, "Stand Tackle": 58, "Slide Tackle": 50,
      Jumping: 64, Stamina: 80, Strength: 58, Aggression: 56,
    },
    playstylePlus: ["Technical"],
    playstyles: ["Incisive Pass", "Flair", "First Touch", "Trickster"],
  }),
  buildSeedCard({
    id: "fc27-alexia-putellas-90",
    name: "Alexia Putellas",
    rarity: "Gold Rare",
    overall: 90,
    position: "CM",
    altPositions: ["CAM", "LW"],
    club: "FC Barcelona",
    league: "Liga F",
    nation: "Spain",
    heightCm: 173,
    weightKg: 67,
    skillMoves: 5,
    weakFoot: 5,
    preferredFoot: "Left",
    faceStats: { pace: 82, shooting: 89, passing: 90, dribbling: 91, defending: 72, physical: 78 },
    attrs: {
      Acceleration: 83, "Sprint Speed": 81,
      "Att. Position": 90, Finishing: 91, "Shot Power": 86, "Long Shots": 88, Volleys: 86, Penalties: 90,
      Vision: 92, Crossing: 87, "FK Acc.": 88, "Short Pass": 92, "Long Pass": 89, Curve: 89,
      Agility: 90, Balance: 89, Reactions: 91, "Ball Control": 92, Dribbling: 91, Composure: 92,
      Interceptions: 74, "Heading Acc.": 72, "Def. Awareness": 70, "Stand Tackle": 74, "Slide Tackle": 68,
      Jumping: 76, Stamina: 86, Strength: 75, Aggression: 76,
    },
    playstylePlus: ["First Touch"],
    playstyles: ["Finesse Shot", "Incisive Pass", "Pinged Pass", "Technical", "Flair", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-aitana-bonmati-91",
    name: "Aitana Bonmatí",
    rarity: "Gold Rare",
    overall: 91,
    position: "CM",
    altPositions: ["CAM"],
    club: "FC Barcelona",
    league: "Liga F",
    nation: "Spain",
    heightCm: 162,
    weightKg: 53,
    skillMoves: 4,
    weakFoot: 5,
    preferredFoot: "Right",
    faceStats: { pace: 85, shooting: 86, passing: 87, dribbling: 92, defending: 77, physical: 75 },
    attrs: {
      Acceleration: 87, "Sprint Speed": 83,
      "Att. Position": 90, Finishing: 88, "Shot Power": 82, "Long Shots": 85, Volleys: 82, Penalties: 80,
      Vision: 90, Crossing: 80, "FK Acc.": 74, "Short Pass": 91, "Long Pass": 87, Curve: 83,
      Agility: 94, Balance: 93, Reactions: 92, "Ball Control": 92, Dribbling: 92, Composure: 91,
      Interceptions: 80, "Heading Acc.": 62, "Def. Awareness": 77, "Stand Tackle": 79, "Slide Tackle": 73,
      Jumping: 72, Stamina: 92, Strength: 66, Aggression: 76,
    },
    playstylePlus: ["Technical"],
    playstyles: ["Finesse Shot", "Incisive Pass", "First Touch", "Relentless", "Trivela"],
  }),
  buildSeedCard({
    id: "fc27-federico-valverde-89",
    name: "Federico Valverde",
    rarity: "Gold Rare",
    overall: 89,
    position: "CM",
    altPositions: ["RW", "CDM"],
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "Uruguay",
    heightCm: 182,
    weightKg: 78,
    skillMoves: 3,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 88, shooting: 83, passing: 85, dribbling: 84, defending: 81, physical: 85 },
    attrs: {
      Acceleration: 86, "Sprint Speed": 90,
      "Att. Position": 84, Finishing: 80, "Shot Power": 91, "Long Shots": 88, Volleys: 78, Penalties: 68,
      Vision: 86, Crossing: 81, "FK Acc.": 74, "Short Pass": 88, "Long Pass": 88, Curve: 78,
      Agility: 80, Balance: 79, Reactions: 88, "Ball Control": 86, Dribbling: 84, Composure: 85,
      Interceptions: 83, "Heading Acc.": 66, "Def. Awareness": 80, "Stand Tackle": 83, "Slide Tackle": 80,
      Jumping: 80, Stamina: 94, Strength: 81, Aggression: 84,
    },
    playstylePlus: ["Power Shot"],
    playstyles: ["Long Ball Pass", "Rapid", "Relentless", "Trivela", "Intercept"],
  }),
  buildSeedCard({
    id: "fc27-pedri-88",
    name: "Pedri",
    rarity: "Gold Rare",
    overall: 88,
    position: "CM",
    altPositions: ["CAM", "LW"],
    club: "FC Barcelona",
    league: "LALIGA EA SPORTS",
    nation: "Spain",
    heightCm: 174,
    weightKg: 60,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 79, shooting: 72, passing: 86, dribbling: 90, defending: 72, physical: 66 },
    attrs: {
      Acceleration: 82, "Sprint Speed": 76,
      "Att. Position": 80, Finishing: 71, "Shot Power": 70, "Long Shots": 73, Volleys: 68, Penalties: 64,
      Vision: 90, Crossing: 78, "FK Acc.": 72, "Short Pass": 90, "Long Pass": 87, Curve: 82,
      Agility: 91, Balance: 90, Reactions: 88, "Ball Control": 91, Dribbling: 90, Composure: 89,
      Interceptions: 74, "Heading Acc.": 52, "Def. Awareness": 72, "Stand Tackle": 74, "Slide Tackle": 68,
      Jumping: 64, Stamina: 88, Strength: 56, Aggression: 62,
    },
    playstylePlus: ["Incisive Pass"],
    playstyles: ["Pinged Pass", "Technical", "First Touch", "Press Proven", "Relentless"],
  }),
  buildSeedCard({
    id: "fc27-vitinha-87",
    name: "Vitinha",
    rarity: "Gold Rare",
    overall: 87,
    position: "CM",
    altPositions: ["CDM", "CAM"],
    club: "Paris SG",
    league: "Ligue 1 McDonald's",
    nation: "Portugal",
    heightCm: 172,
    weightKg: 64,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 78, shooting: 77, passing: 86, dribbling: 89, defending: 74, physical: 68 },
    attrs: {
      Acceleration: 81, "Sprint Speed": 75,
      "Att. Position": 80, Finishing: 75, "Shot Power": 78, "Long Shots": 81, Volleys: 72, Penalties: 76,
      Vision: 88, Crossing: 79, "FK Acc.": 76, "Short Pass": 89, "Long Pass": 87, Curve: 82,
      Agility: 90, Balance: 91, Reactions: 86, "Ball Control": 89, Dribbling: 89, Composure: 88,
      Interceptions: 76, "Heading Acc.": 54, "Def. Awareness": 74, "Stand Tackle": 76, "Slide Tackle": 70,
      Jumping: 64, Stamina: 88, Strength: 60, Aggression: 66,
    },
    playstylePlus: ["Press Proven"],
    playstyles: ["Incisive Pass", "Long Ball Pass", "Technical", "First Touch", "Relentless"],
  }),

  // DEFENSIVE MIDFIELDERS (CDM)
  buildSeedCard({
    id: "fc27-rodri-91",
    name: "Rodri",
    rarity: "Gold Rare",
    overall: 91,
    position: "CDM",
    altPositions: ["CM"],
    club: "Manchester City",
    league: "Premier League",
    nation: "Spain",
    heightCm: 191,
    weightKg: 82,
    skillMoves: 3,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 66, shooting: 80, passing: 86, dribbling: 84, defending: 87, physical: 85 },
    attrs: {
      Acceleration: 65, "Sprint Speed": 67,
      "Att. Position": 82, Finishing: 76, "Shot Power": 90, "Long Shots": 86, Volleys: 74, Penalties: 74,
      Vision: 87, Crossing: 76, "FK Acc.": 68, "Short Pass": 92, "Long Pass": 91, Curve: 78,
      Agility: 68, Balance: 70, Reactions: 92, "Ball Control": 89, Dribbling: 82, Composure: 93,
      Interceptions: 88, "Heading Acc.": 84, "Def. Awareness": 88, "Stand Tackle": 88, "Slide Tackle": 82,
      Jumping: 83, Stamina: 90, Strength: 85, Aggression: 84,
    },
    playstylePlus: ["Tiki Taka"],
    playstyles: ["Power Shot", "Long Ball Pass", "Bruiser", "Aerial", "Intercept"],
  }),
  buildSeedCard({
    id: "fc27-declan-rice-88",
    name: "Declan Rice",
    rarity: "Gold Rare",
    overall: 88,
    position: "CDM",
    altPositions: ["CM"],
    club: "Arsenal",
    league: "Premier League",
    nation: "England",
    heightCm: 188,
    weightKg: 80,
    skillMoves: 3,
    weakFoot: 3,
    preferredFoot: "Right",
    faceStats: { pace: 74, shooting: 71, passing: 83, dribbling: 81, defending: 85, physical: 84 },
    attrs: {
      Acceleration: 73, "Sprint Speed": 75,
      "Att. Position": 75, Finishing: 68, "Shot Power": 79, "Long Shots": 74, Volleys: 64, Penalties: 66,
      Vision: 83, Crossing: 78, "FK Acc.": 74, "Short Pass": 87, "Long Pass": 86, Curve: 76,
      Agility: 75, Balance: 76, Reactions: 86, "Ball Control": 84, Dribbling: 80, Composure: 85,
      Interceptions: 86, "Heading Acc.": 78, "Def. Awareness": 85, "Stand Tackle": 87, "Slide Tackle": 83,
      Jumping: 80, Stamina: 92, Strength: 82, Aggression: 82,
    },
    playstylePlus: ["Intercept"],
    playstyles: ["Long Ball Pass", "Dead Ball", "Anticipate", "Bruiser", "Relentless"],
  }),
  buildSeedCard({
    id: "fc27-moises-caicedo-86",
    name: "Moisés Caicedo",
    rarity: "Gold Rare",
    overall: 86,
    position: "CDM",
    altPositions: ["CM"],
    club: "Chelsea",
    league: "Premier League",
    nation: "Ecuador",
    heightCm: 178,
    weightKg: 73,
    skillMoves: 3,
    weakFoot: 3,
    preferredFoot: "Right",
    faceStats: { pace: 76, shooting: 68, passing: 80, dribbling: 81, defending: 84, physical: 83 },
    attrs: {
      Acceleration: 77, "Sprint Speed": 75,
      "Att. Position": 72, Finishing: 64, "Shot Power": 76, "Long Shots": 72, Volleys: 62, Penalties: 64,
      Vision: 80, Crossing: 72, "FK Acc.": 60, "Short Pass": 85, "Long Pass": 83, Curve: 70,
      Agility: 80, Balance: 82, Reactions: 84, "Ball Control": 82, Dribbling: 80, Composure: 82,
      Interceptions: 85, "Heading Acc.": 72, "Def. Awareness": 83, "Stand Tackle": 86, "Slide Tackle": 84,
      Jumping: 78, Stamina: 90, Strength: 79, Aggression: 86,
    },
    playstylePlus: ["Intercept"],
    playstyles: ["Pinged Pass", "Anticipate", "Slide Tackle", "Relentless", "Press Proven"],
  }),

  // FULLBACKS & CENTER BACKS (LB / RB / CB)
  buildSeedCard({
    id: "fc27-theo-hernandez-88",
    name: "Theo Hernández",
    rarity: "Gold Rare",
    overall: 88,
    position: "LB",
    altPositions: ["LM"],
    club: "Milan",
    league: "Serie A Enilive",
    nation: "France",
    heightCm: 184,
    weightKg: 81,
    skillMoves: 3,
    weakFoot: 3,
    preferredFoot: "Left",
    faceStats: { pace: 95, shooting: 76, passing: 79, dribbling: 83, defending: 81, physical: 87 },
    attrs: {
      Acceleration: 94, "Sprint Speed": 96,
      "Att. Position": 81, Finishing: 73, "Shot Power": 86, "Long Shots": 78, Volleys: 68, Penalties: 74,
      Vision: 76, Crossing: 84, "FK Acc.": 70, "Short Pass": 81, "Long Pass": 75, Curve: 78,
      Agility: 81, Balance: 79, Reactions: 85, "Ball Control": 83, Dribbling: 84, Composure: 81,
      Interceptions: 81, "Heading Acc.": 77, "Def. Awareness": 79, "Stand Tackle": 83, "Slide Tackle": 83,
      Jumping: 83, Stamina: 91, Strength: 86, Aggression: 86,
    },
    playstylePlus: ["Bruiser"],
    playstyles: ["Whipped Pass", "Quick Step", "Rapid", "Relentless"],
  }),
  buildSeedCard({
    id: "fc27-achraf-hakimi-86",
    name: "Achraf Hakimi",
    rarity: "Gold Rare",
    overall: 86,
    position: "RB",
    altPositions: ["RM"],
    club: "Paris SG",
    league: "Ligue 1 McDonald's",
    nation: "Morocco",
    heightCm: 181,
    weightKg: 73,
    skillMoves: 4,
    weakFoot: 4,
    preferredFoot: "Right",
    faceStats: { pace: 93, shooting: 75, passing: 80, dribbling: 81, defending: 77, physical: 79 },
    attrs: {
      Acceleration: 92, "Sprint Speed": 94,
      "Att. Position": 82, Finishing: 75, "Shot Power": 79, "Long Shots": 74, Volleys: 68, Penalties: 70,
      Vision: 78, Crossing: 83, "FK Acc.": 72, "Short Pass": 82, "Long Pass": 76, Curve: 79,
      Agility: 82, Balance: 80, Reactions: 84, "Ball Control": 81, Dribbling: 81, Composure: 80,
      Interceptions: 78, "Heading Acc.": 68, "Def. Awareness": 75, "Stand Tackle": 79, "Slide Tackle": 77,
      Jumping: 78, Stamina: 91, Strength: 74, Aggression: 78,
    },
    playstylePlus: ["Rapid"],
    playstyles: ["Whipped Pass", "Quick Step", "Relentless", "Jockey"],
  }),
  buildSeedCard({
    id: "fc27-alejandro-grimaldo-87",
    name: "Alejandro Grimaldo",
    rarity: "Gold Rare",
    overall: 87,
    position: "LB",
    altPositions: ["LM"],
    club: "Bayer 04 Leverkusen",
    league: "Bundesliga",
    nation: "Spain",
    heightCm: 171,
    weightKg: 67,
    skillMoves: 4,
    weakFoot: 3,
    preferredFoot: "Left",
    faceStats: { pace: 84, shooting: 76, passing: 86, dribbling: 85, defending: 79, physical: 71 },
    attrs: {
      Acceleration: 85, "Sprint Speed": 83,
      "Att. Position": 81, Finishing: 74, "Shot Power": 79, "Long Shots": 80, Volleys: 70, Penalties: 72,
      Vision: 85, Crossing: 89, "FK Acc.": 86, "Short Pass": 86, "Long Pass": 82, Curve: 88,
      Agility: 86, Balance: 86, Reactions: 85, "Ball Control": 85, Dribbling: 85, Composure: 83,
      Interceptions: 80, "Heading Acc.": 64, "Def. Awareness": 78, "Stand Tackle": 81, "Slide Tackle": 79,
      Jumping: 72, Stamina: 88, Strength: 64, Aggression: 70,
    },
    playstylePlus: ["Whipped Pass"],
    playstyles: ["Dead Ball", "Incisive Pass", "Technical", "Relentless"],
  }),
  buildSeedCard({
    id: "fc27-virgil-van-dijk-90",
    name: "Virgil van Dijk",
    rarity: "Gold Rare",
    overall: 90,
    position: "CB",
    club: "Liverpool",
    league: "Premier League",
    nation: "Netherlands",
    heightCm: 193,
    weightKg: 92,
    skillMoves: 2,
    weakFoot: 3,
    preferredFoot: "Right",
    faceStats: { pace: 78, shooting: 60, passing: 72, dribbling: 72, defending: 90, physical: 86 },
    attrs: {
      Acceleration: 68, "Sprint Speed": 86,
      "Att. Position": 47, Finishing: 52, "Shot Power": 81, "Long Shots": 64, Volleys: 45, Penalties: 62,
      Vision: 68, Crossing: 53, "FK Acc.": 70, "Short Pass": 79, "Long Pass": 84, Curve: 60,
      Agility: 57, Balance: 53, Reactions: 89, "Ball Control": 76, Dribbling: 70, Composure: 90,
      Interceptions: 90, "Heading Acc.": 89, "Def. Awareness": 91, "Stand Tackle": 91, "Slide Tackle": 86,
      Jumping: 89, Stamina: 75, Strength: 93, Aggression: 85,
    },
    playstylePlus: ["Aerial"],
    playstyles: ["Long Ball Pass", "Jockey", "Block", "Intercept", "Anticipate", "Bruiser"],
  }),
  buildSeedCard({
    id: "fc27-william-saliba-88",
    name: "William Saliba",
    rarity: "Gold Rare",
    overall: 88,
    position: "CB",
    club: "Arsenal",
    league: "Premier League",
    nation: "France",
    heightCm: 192,
    weightKg: 92,
    skillMoves: 2,
    weakFoot: 3,
    preferredFoot: "Right",
    faceStats: { pace: 82, shooting: 45, passing: 70, dribbling: 74, defending: 88, physical: 84 },
    attrs: {
      Acceleration: 78, "Sprint Speed": 85,
      "Att. Position": 42, Finishing: 42, "Shot Power": 58, "Long Shots": 40, Volleys: 38, Penalties: 48,
      Vision: 66, Crossing: 52, "FK Acc.": 42, "Short Pass": 80, "Long Pass": 76, Curve: 48,
      Agility: 68, Balance: 64, Reactions: 87, "Ball Control": 78, Dribbling: 72, Composure: 88,
      Interceptions: 87, "Heading Acc.": 84, "Def. Awareness": 89, "Stand Tackle": 89, "Slide Tackle": 84,
      Jumping: 84, Stamina: 78, Strength: 88, Aggression: 80,
    },
    playstylePlus: ["Anticipate"],
    playstyles: ["Jockey", "Intercept", "Bruiser", "Aerial"],
  }),
  buildSeedCard({
    id: "fc27-antonio-rudiger-88",
    name: "Antonio Rüdiger",
    rarity: "Gold Rare",
    overall: 88,
    position: "CB",
    club: "Real Madrid",
    league: "LALIGA EA SPORTS",
    nation: "Germany",
    heightCm: 190,
    weightKg: 85,
    skillMoves: 2,
    weakFoot: 3,
    preferredFoot: "Right",
    faceStats: { pace: 82, shooting: 55, passing: 71, dribbling: 70, defending: 87, physical: 86 },
    attrs: {
      Acceleration: 76, "Sprint Speed": 87,
      "Att. Position": 46, Finishing: 44, "Shot Power": 82, "Long Shots": 66, Volleys: 42, Penalties: 52,
      Vision: 62, Crossing: 58, "FK Acc.": 56, "Short Pass": 78, "Long Pass": 77, Curve: 50,
      Agility: 62, Balance: 58, Reactions: 86, "Ball Control": 74, Dribbling: 66, Composure: 83,
      Interceptions: 85, "Heading Acc.": 86, "Def. Awareness": 87, "Stand Tackle": 88, "Slide Tackle": 85,
      Jumping: 88, Stamina: 78, Strength: 88, Aggression: 91,
    },
    playstylePlus: ["Bruiser"],
    playstyles: ["Jockey", "Block", "Aerial", "Acrobatic"],
  }),
  buildSeedCard({
    id: "fc27-alessandro-bastoni-88",
    name: "Alessandro Bastoni",
    rarity: "Gold Rare",
    overall: 88,
    position: "CB",
    club: "Inter",
    league: "Serie A Enilive",
    nation: "Italy",
    heightCm: 190,
    weightKg: 75,
    skillMoves: 3,
    weakFoot: 3,
    preferredFoot: "Left",
    faceStats: { pace: 76, shooting: 52, passing: 79, dribbling: 76, defending: 88, physical: 83 },
    attrs: {
      Acceleration: 73, "Sprint Speed": 78,
      "Att. Position": 54, Finishing: 48, "Shot Power": 66, "Long Shots": 52, Volleys: 46, Penalties: 52,
      Vision: 78, Crossing: 76, "FK Acc.": 58, "Short Pass": 85, "Long Pass": 86, Curve: 70,
      Agility: 70, Balance: 68, Reactions: 87, "Ball Control": 80, Dribbling: 75, Composure: 86,
      Interceptions: 88, "Heading Acc.": 84, "Def. Awareness": 89, "Stand Tackle": 89, "Slide Tackle": 85,
      Jumping: 82, Stamina: 80, Strength: 84, Aggression: 82,
    },
    playstylePlus: ["Intercept"],
    playstyles: ["Long Ball Pass", "Pinged Pass", "Jockey", "Anticipate"],
  }),
];

/**
 * Ensures the built-in star & meta catalog is always present, and attempts an
 * optional non-blocking refresh from EA's public ratings feed.
 */
export async function syncFutCards(): Promise<{ synced: number }> {
  await ensureFutCardsSchema();

  // 1. Always guarantee the built-in FC 27 catalog is seeded first
  const seededCount = await upsertFutCards(BUILTIN_FC27_CARDS);

  // 2. Try syncing additional upstream cards silently (never crashes if CDN blocks)
  const upstream = await fetchUpstreamCards();
  const upstreamCount = upstream.length > 0 ? await upsertFutCards(upstream) : 0;

  return { synced: seededCount + upstreamCount };
}

export async function searchFutCards(params: {
  query?: string;
  position?: string;
  rarity?: string;
  limit?: number;
}): Promise<FutCard[]> {
  await ensureFutCardsSchema();

  // Auto-seed built-in catalog on first query if table is still empty
  const countRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM fut_cards`);
  const existingCount = Number((countRes.rows?.[0] as any)?.cnt ?? 0);
  if (existingCount === 0) {
    await upsertFutCards(BUILTIN_FC27_CARDS);
  }

  const limit = Math.min(50, Math.max(1, params.limit ?? 25));
  const conditions: any[] = [sql`position <> 'GK'`];

  if (params.query && params.query.trim()) {
    const q = `%${params.query.trim().toLowerCase()}%`;
    conditions.push(sql`(LOWER(name) LIKE ${q} OR LOWER(COALESCE(common_name, '')) LIKE ${q})`);
  }
  if (params.position && params.position !== "ALL") {
    const pos = params.position.toUpperCase();
    conditions.push(sql`(position = ${pos} OR alt_positions @> ${JSON.stringify([pos])}::jsonb)`);
  }
  if (params.rarity && params.rarity !== "ALL") {
    conditions.push(sql`rarity = ${params.rarity}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  let result = await db.execute(sql`
    SELECT * FROM fut_cards
    WHERE ${whereClause}
    ORDER BY overall DESC, name ASC
    LIMIT ${limit}
  `);

  // On-demand live EA search if user typed a player not yet in our local catalog
  if ((result.rows ?? []).length === 0 && params.query && params.query.trim().length >= 3) {
    const liveHits = await fetchUpstreamCards(params.query.trim());
    if (liveHits.length > 0) {
      await upsertFutCards(liveHits);
      result = await db.execute(sql`
        SELECT * FROM fut_cards
        WHERE ${whereClause}
        ORDER BY overall DESC, name ASC
        LIMIT ${limit}
      `);
    }
  }

  return (result.rows ?? []).map(rowToFutCard);
}

export async function getFutCardById(id: string): Promise<FutCard | null> {
  await ensureFutCardsSchema();
  const res = await db.execute(sql`SELECT * FROM fut_cards WHERE id = ${id} LIMIT 1`);
  const row = res.rows?.[0];
  return row ? rowToFutCard(row) : null;
}

export async function getDistinctRarities(): Promise<string[]> {
  await ensureFutCardsSchema();
  const res = await db.execute(sql`
    SELECT DISTINCT rarity FROM fut_cards WHERE position <> 'GK' ORDER BY rarity ASC
  `);
  return (res.rows ?? []).map((r: any) => String(r.rarity));
}
