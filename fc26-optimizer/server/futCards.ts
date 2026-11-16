import * as dbModule from "./db";
import { sql } from "drizzle-orm";

async function getDatabase() {
  const mod = dbModule as any;
  if (mod.db) return mod.db;
  if (typeof mod.getDb === "function") {
    const inst = await mod.getDb();
    if (inst) return inst;
  }
  throw new Error("Database connection unavailable");
}

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
  const db = await getDatabase();
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
  const db = await getDatabase();
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

type SeedTuple = [
  string, string, string, number, string, string[], string, string, string,
  number, number, number, number, "Right" | "Left",
  [number, number, number, number, number, number],
  string[], string[], Record<string, number>?
];

const SEED_DATA: SeedTuple[] = [
  ["fc27-kane-90", "Harry Kane", "Gold Rare", 90, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 3, 5, "Right", [67, 93, 85, 83, 49, 83], ["Finesse Shot"], ["Power Shot", "Incisive Pass", "Long Ball Pass", "First Touch", "Aerial", "Trivela"], { Acceleration: 65, "Sprint Speed": 69, "Att. Position": 94, Finishing: 95, "Shot Power": 93, "Long Shots": 89, Penalties: 93, Vision: 88, "Short Pass": 88, "Long Pass": 87, Agility: 72, Balance: 73, Reactions: 93, "Ball Control": 87, Composure: 92, "Heading Acc.": 90, Strength: 85 }],
  ["fc27-kane-92", "Harry Kane", "Team of the Week", 92, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 3, 5, "Right", [72, 95, 87, 85, 51, 85], ["Finesse Shot", "Incisive Pass"], ["Power Shot", "Long Ball Pass", "First Touch", "Aerial", "Trivela"], { Acceleration: 70, "Sprint Speed": 74, "Att. Position": 96, Finishing: 97, "Shot Power": 95, "Long Shots": 91, Penalties: 95, Vision: 90, "Short Pass": 90, "Long Pass": 89, Agility: 75, Balance: 76, Reactions: 95, "Ball Control": 89, Composure: 94, "Heading Acc.": 92, Strength: 87 }],
  ["fc27-kane-95", "Harry Kane", "Team of the Season", 95, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 4, 5, "Right", [84, 98, 91, 90, 55, 90], ["Finesse Shot", "Power Shot"], ["Incisive Pass", "Long Ball Pass", "First Touch", "Aerial", "Technical", "Trivela"], { Acceleration: 82, "Sprint Speed": 86, "Att. Position": 99, Finishing: 99, "Shot Power": 98, "Long Shots": 95, Vision: 94, "Short Pass": 94, "Long Pass": 93, Agility: 82, Balance: 82, Reactions: 97, "Ball Control": 94, Composure: 97, "Heading Acc.": 95, Strength: 92 }],
  ["fc27-mbappe-91", "Kylian Mbappé", "Gold Rare", 91, "ST", ["LW"], "Real Madrid", "LALIGA EA SPORTS", "France", 182, 75, 5, 4, "Right", [97, 90, 80, 92, 36, 78], ["Quick Step"], ["Finesse Shot", "Rapid", "Flair", "Trivela", "Acrobatic"], { Acceleration: 97, "Sprint Speed": 97, "Att. Position": 93, Finishing: 94, "Shot Power": 90, "Short Pass": 86, Agility: 93, Balance: 82, Reactions: 93, "Ball Control": 92, Dribbling: 93, Composure: 88, Strength: 77 }],
  ["fc27-haaland-91", "Erling Haaland", "Gold Rare", 91, "ST", [], "Manchester City", "Premier League", "Norway", 195, 94, 3, 3, "Left", [88, 92, 70, 81, 45, 88], ["Acrobatic"], ["Power Shot", "Power Header", "Quick Step", "Bruiser"], { Acceleration: 81, "Sprint Speed": 94, "Att. Position": 95, Finishing: 96, "Shot Power": 94, Agility: 76, Balance: 72, Reactions: 94, Strength: 93, Jumping: 92 }],
  ["fc27-isak-87", "Alexander Isak", "Gold Rare", 87, "ST", [], "Newcastle United", "Premier League", "Sweden", 192, 77, 4, 5, "Right", [86, 86, 75, 86, 39, 76], ["Finesse Shot"], ["Technical", "Rapid", "First Touch", "Flair"], { Acceleration: 85, "Sprint Speed": 87, Finishing: 88, Dribbling: 88, "Ball Control": 87 }],
  ["fc27-gyokeres-87", "Viktor Gyökeres", "Gold Rare", 87, "ST", [], "Sporting CP", "Liga Portugal", "Sweden", 187, 90, 3, 4, "Right", [89, 86, 74, 83, 40, 90], ["Power Shot"], ["Quick Step", "Rapid", "Bruiser", "Relentless"], { Acceleration: 87, "Sprint Speed": 91, Finishing: 88, Strength: 92, Stamina: 90 }],
  ["fc27-lautaro-89", "Lautaro Martínez", "Gold Rare", 89, "ST", [], "Inter", "Serie A Enilive", "Argentina", 174, 72, 4, 4, "Right", [83, 88, 76, 86, 48, 85], ["Finesse Shot"], ["Power Header", "Relentless", "Technical", "Trivela"], { "Att. Position": 91, Finishing: 91, Reactions: 90, Jumping: 90 }],
  ["fc27-griezmann-88", "Antoine Griezmann", "Gold Rare", 88, "ST", ["CAM"], "Atlético de Madrid", "LALIGA EA SPORTS", "France", 176, 73, 4, 4, "Left", [80, 88, 87, 89, 59, 75], ["Finesse Shot"], ["Incisive Pass", "Technical", "Flair", "Relentless", "Trivela"], { "Att. Position": 91, Finishing: 89, Vision: 90, "Short Pass": 88, Reactions: 91 }],
  ["fc27-vini-91", "Vinícius Jr.", "Gold Rare", 91, "LW", ["ST"], "Real Madrid", "LALIGA EA SPORTS", "Brazil", 176, 73, 5, 4, "Right", [95, 85, 81, 92, 29, 69], ["Quick Step"], ["Finesse Shot", "Rapid", "Flair", "First Touch", "Trickster"], { Acceleration: 95, "Sprint Speed": 95, Finishing: 88, Agility: 94, Dribbling: 94, "Ball Control": 91 }],
  ["fc27-salah-90", "Mohamed Salah", "Gold Rare", 90, "RW", ["RM"], "Liverpool", "Premier League", "Egypt", 175, 71, 4, 3, "Left", [89, 88, 83, 89, 45, 75], ["Finesse Shot"], ["Chip Shot", "Rapid", "First Touch", "Trivela"], { "Att. Position": 92, Finishing: 92, Balance: 91, Reactions: 92, Composure: 91 }],
  ["fc27-saka-88", "Bukayo Saka", "Gold Rare", 88, "RW", ["RM"], "Arsenal", "Premier League", "England", 178, 72, 4, 4, "Left", [86, 83, 84, 88, 60, 72], ["Whipped Pass"], ["Finesse Shot", "Technical", "Flair", "Relentless"], { Crossing: 86, "Short Pass": 86, Agility: 89, Balance: 88, Stamina: 88 }],
  ["fc27-yamal-86", "Lamine Yamal", "Gold Rare", 86, "RW", ["RM"], "FC Barcelona", "LALIGA EA SPORTS", "Spain", 180, 72, 5, 3, "Left", [86, 79, 82, 89, 28, 58], ["Technical"], ["Finesse Shot", "Incisive Pass", "Flair", "Trickster", "Trivela"], { Acceleration: 88, Agility: 91, Dribbling: 91, "Ball Control": 89 }],
  ["fc27-son-88", "Heung Min Son", "Gold Rare", 88, "LW", ["ST", "LM"], "Tottenham Hotspur", "Premier League", "Korea Republic", 183, 78, 4, 5, "Right", [87, 89, 82, 85, 42, 69], ["Finesse Shot"], ["Rapid", "First Touch", "Quick Step"], { "Att. Position": 90, Finishing: 91, "Shot Power": 89, "Long Shots": 89, Composure: 87 }],
  ["fc27-raphinha-87", "Raphinha", "Gold Rare", 87, "LW", ["RW", "CAM"], "FC Barcelona", "LALIGA EA SPORTS", "Brazil", 176, 68, 4, 4, "Left", [91, 83, 82, 87, 53, 73], ["Rapid"], ["Finesse Shot", "Whipped Pass", "Relentless", "Trivela"], { Acceleration: 92, "Sprint Speed": 90, Stamina: 90 }],
  ["fc27-bellingham-90", "Jude Bellingham", "Gold Rare", 90, "CAM", ["CM"], "Real Madrid", "LALIGA EA SPORTS", "England", 186, 75, 4, 4, "Right", [81, 87, 83, 88, 78, 83], ["Relentless"], ["Incisive Pass", "Technical", "Flair", "Slide Tackle", "Intercept"], { "Att. Position": 91, Finishing: 90, Vision: 88, "Short Pass": 89, Reactions: 91, "Ball Control": 89, Interceptions: 82, Stamina: 93 }],
  ["fc27-palmer-87", "Cole Palmer", "Gold Rare", 87, "CAM", ["RW"], "Chelsea", "Premier League", "England", 189, 76, 4, 4, "Left", [78, 84, 85, 87, 50, 68], ["Incisive Pass"], ["Finesse Shot", "Technical", "First Touch", "Flair", "Trivela"], { Vision: 88, "Short Pass": 87, Penalties: 92, Composure: 90 }],
  ["fc27-wirtz-89", "Florian Wirtz", "Gold Rare", 89, "CAM", ["LW"], "Bayer 04 Leverkusen", "Bundesliga", "Germany", 177, 71, 4, 4, "Right", [82, 81, 88, 91, 50, 65], ["Incisive Pass"], ["Finesse Shot", "Pinged Pass", "Technical", "First Touch", "Flair"], { Vision: 91, "Short Pass": 91, Agility: 92, "Ball Control": 92, Dribbling: 92 }],
  ["fc27-musiala-88", "Jamal Musiala", "Gold Rare", 88, "CAM", ["LM", "CM"], "FC Bayern München", "Bundesliga", "Germany", 184, 72, 5, 4, "Right", [84, 80, 81, 91, 55, 64], ["Technical"], ["Incisive Pass", "Flair", "First Touch", "Trickster"], { Agility: 94, Balance: 91, Dribbling: 93, "Ball Control": 91 }],
  ["fc27-putellas-90", "Alexia Putellas", "Gold Rare", 90, "CM", ["CAM", "LW"], "FC Barcelona", "Liga F", "Spain", 173, 67, 5, 5, "Left", [82, 89, 90, 91, 72, 78], ["First Touch"], ["Finesse Shot", "Incisive Pass", "Pinged Pass", "Technical", "Flair", "Trivela"], { Finishing: 91, Vision: 92, "Short Pass": 92, "Ball Control": 92, Composure: 92 }],
  ["fc27-bonmati-91", "Aitana Bonmatí", "Gold Rare", 91, "CM", ["CAM"], "FC Barcelona", "Liga F", "Spain", 162, 53, 4, 5, "Right", [85, 86, 87, 92, 77, 75], ["Technical"], ["Finesse Shot", "Incisive Pass", "First Touch", "Relentless", "Trivela"], { Agility: 94, Balance: 93, Reactions: 92, "Ball Control": 92, Dribbling: 92, Stamina: 92 }],
  ["fc27-valverde-89", "Federico Valverde", "Gold Rare", 89, "CM", ["RW", "CDM"], "Real Madrid", "LALIGA EA SPORTS", "Uruguay", 182, 78, 3, 4, "Right", [88, 83, 85, 84, 81, 85], ["Power Shot"], ["Long Ball Pass", "Rapid", "Relentless", "Trivela", "Intercept"], { "Sprint Speed": 90, "Shot Power": 91, "Short Pass": 88, "Long Pass": 88, Stamina: 94 }],
  ["fc27-pedri-88", "Pedri", "Gold Rare", 88, "CM", ["CAM", "LW"], "FC Barcelona", "LALIGA EA SPORTS", "Spain", 174, 60, 4, 4, "Right", [79, 72, 86, 90, 72, 66], ["Incisive Pass"], ["Pinged Pass", "Technical", "First Touch", "Press Proven", "Relentless"], { Vision: 90, "Short Pass": 90, Agility: 91, "Ball Control": 91, Dribbling: 90 }],
  ["fc27-rodri-91", "Rodri", "Gold Rare", 91, "CDM", ["CM"], "Manchester City", "Premier League", "Spain", 191, 82, 3, 4, "Right", [66, 80, 86, 84, 87, 85], ["Tiki Taka"], ["Power Shot", "Long Ball Pass", "Bruiser", "Aerial", "Intercept"], { "Short Pass": 92, "Long Pass": 91, Reactions: 92, Composure: 93, Interceptions: 88, "Def. Awareness": 88, "Stand Tackle": 88 }],
  ["fc27-rice-88", "Declan Rice", "Gold Rare", 88, "CDM", ["CM"], "Arsenal", "Premier League", "England", 188, 80, 3, 3, "Right", [74, 71, 83, 81, 85, 84], ["Intercept"], ["Long Ball Pass", "Dead Ball", "Anticipate", "Bruiser", "Relentless"], { "Short Pass": 87, Interceptions: 86, "Stand Tackle": 87, Stamina: 92 }],
  ["fc27-theo-88", "Theo Hernández", "Gold Rare", 88, "LB", ["LM"], "Milan", "Serie A Enilive", "France", 184, 81, 3, 3, "Left", [95, 76, 79, 83, 81, 87], ["Bruiser"], ["Whipped Pass", "Quick Step", "Rapid", "Relentless"], { Acceleration: 94, "Sprint Speed": 96, Stamina: 91, Strength: 86 }],
  ["fc27-hakimi-86", "Achraf Hakimi", "Gold Rare", 86, "RB", ["RM"], "Paris SG", "Ligue 1 McDonald's", "Morocco", 181, 73, 4, 4, "Right", [93, 75, 80, 81, 77, 79], ["Rapid"], ["Whipped Pass", "Quick Step", "Relentless", "Jockey"], { Acceleration: 92, "Sprint Speed": 94, Stamina: 91 }],
  ["fc27-vandijk-90", "Virgil van Dijk", "Gold Rare", 90, "CB", [], "Liverpool", "Premier League", "Netherlands", 193, 92, 2, 3, "Right", [78, 60, 72, 72, 90, 86], ["Aerial"], ["Long Ball Pass", "Jockey", "Block", "Intercept", "Anticipate", "Bruiser"], { "Sprint Speed": 86, Reactions: 89, Composure: 90, Interceptions: 90, "Heading Acc.": 89, "Def. Awareness": 91, "Stand Tackle": 91, Strength: 93 }],
  ["fc27-saliba-88", "William Saliba", "Gold Rare", 88, "CB", [], "Arsenal", "Premier League", "France", 192, 92, 2, 3, "Right", [82, 45, 70, 74, 88, 84], ["Anticipate"], ["Jockey", "Intercept", "Bruiser", "Aerial"], { "Sprint Speed": 85, Interceptions: 87, "Def. Awareness": 89, "Stand Tackle": 89, Strength: 88 }],
  ["fc27-rudiger-88", "Antonio Rüdiger", "Gold Rare", 88, "CB", [], "Real Madrid", "LALIGA EA SPORTS", "Germany", 190, 85, 2, 3, "Right", [82, 55, 71, 70, 87, 86], ["Bruiser"], ["Jockey", "Block", "Aerial", "Acrobatic"], { "Sprint Speed": 87, "Def. Awareness": 87, "Stand Tackle": 88, Strength: 88, Aggression: 91 }],
];

const BUILTIN_FC27_CARDS: FutCard[] = SEED_DATA.map(
  ([id, name, rarity, overall, position, altPositions, club, league, nation, heightCm, weightKg, skillMoves, weakFoot, preferredFoot, [pace, shooting, passing, dribbling, defending, physical], playstylePlus, playstyles, overrides]) => ({
    id,
    eaAssetId: id,
    name,
    commonName: name,
    rarity,
    overall,
    position,
    altPositions,
    club,
    league,
    nation,
    heightCm,
    weightKg,
    skillMoves,
    weakFoot,
    preferredFoot,
    faceStats: { pace, shooting, passing, dribbling, defending, physical },
    attributes: {
      Acceleration: pace, "Sprint Speed": pace,
      "Att. Position": shooting, Finishing: shooting, "Shot Power": shooting, "Long Shots": shooting, Volleys: Math.max(40, shooting - 2), Penalties: Math.max(40, shooting - 2),
      Vision: passing, Crossing: Math.max(40, passing - 2), "FK Acc.": Math.max(40, passing - 4), "Short Pass": passing, "Long Pass": Math.max(40, passing - 1), Curve: Math.max(40, passing - 2),
      Agility: dribbling, Balance: Math.max(40, dribbling - 2), Reactions: dribbling, "Ball Control": dribbling, Dribbling: dribbling, Composure: dribbling,
      Interceptions: defending, "Heading Acc.": defending, "Def. Awareness": defending, "Stand Tackle": defending, "Slide Tackle": Math.max(40, defending - 2),
      Jumping: physical, Stamina: physical, Strength: physical, Aggression: Math.max(40, physical - 2),
      ...(overrides ?? {}),
    },
    playstylePlus,
    playstyles,
    avatarUrl: null,
  })
);

export async function syncFutCards(): Promise<{ synced: number }> {
  await ensureFutCardsSchema();
  const seeded = await upsertFutCards(BUILTIN_FC27_CARDS);
  const upstream = await fetchUpstreamCards();
  const extra = upstream.length > 0 ? await upsertFutCards(upstream) : 0;
  return { synced: seeded + extra };
}

export async function searchFutCards(params: {
  query?: string;
  position?: string;
  rarity?: string;
  limit?: number;
}): Promise<FutCard[]> {
  await ensureFutCardsSchema();
  const db = await getDatabase();
  const countRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM fut_cards`);
  if (Number((countRes.rows?.[0] as any)?.cnt ?? 0) === 0) {
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
    SELECT * FROM fut_cards WHERE ${whereClause} ORDER BY overall DESC, name ASC LIMIT ${limit}
  `);

  if ((result.rows ?? []).length === 0 && params.query && params.query.trim().length >= 3) {
    const liveHits = await fetchUpstreamCards(params.query.trim());
    if (liveHits.length > 0) {
      await upsertFutCards(liveHits);
      result = await db.execute(sql`
        SELECT * FROM fut_cards WHERE ${whereClause} ORDER BY overall DESC, name ASC LIMIT ${limit}
      `);
    }
  }

  return (result.rows ?? []).map(rowToFutCard);
}

export async function getFutCardById(id: string): Promise<FutCard | null> {
  await ensureFutCardsSchema();
  const db = await getDatabase();
  const res = await db.execute(sql`SELECT * FROM fut_cards WHERE id = ${id} LIMIT 1`);
  const row = res.rows?.[0];
  return row ? rowToFutCard(row) : null;
}

export async function getAvailableRarities(): Promise<string[]> {
  await ensureFutCardsSchema();
  const db = await getDatabase();
  const res = await db.execute(sql`SELECT DISTINCT rarity FROM fut_cards WHERE position <> 'GK' ORDER BY rarity ASC`);
  return (res.rows ?? []).map((r: any) => String(r.rarity));
}

export const getDistinctRarities = getAvailableRarities;
