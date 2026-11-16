import fs from "fs";
import path from "path";
import * as dbModule from "./db";
import { sql } from "drizzle-orm";

async function getDatabase() {
  const mod = dbModule as any;
  if (mod.db) return mod.db;
  if (typeof mod.getDb === "function") {
    const inst = await mod.getDb();
    if (inst) return inst;
  }
  return null;
}

function extractRows(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.rows)) return res.rows;
  return [];
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
  movementacceleration: "Acceleration",
  sprintspeed: "Sprint Speed",
  movementsprintspeed: "Sprint Speed",
  positioning: "Att. Position",
  attposition: "Att. Position",
  mentalitypositioning: "Att. Position",
  finishing: "Finishing",
  attackingfinishing: "Finishing",
  shotpower: "Shot Power",
  powershotpower: "Shot Power",
  longshots: "Long Shots",
  powerlongshots: "Long Shots",
  volleys: "Volleys",
  attackingvolleys: "Volleys",
  penalties: "Penalties",
  mentalitypenalties: "Penalties",
  vision: "Vision",
  mentalityvision: "Vision",
  crossing: "Crossing",
  attackingcrossing: "Crossing",
  freekickaccuracy: "FK Acc.",
  fkacc: "FK Acc.",
  skillfkaccuracy: "FK Acc.",
  shortpassing: "Short Pass",
  shortpass: "Short Pass",
  attackingshortpassing: "Short Pass",
  longpassing: "Long Pass",
  longpass: "Long Pass",
  skilllongpassing: "Long Pass",
  curve: "Curve",
  skillcurve: "Curve",
  agility: "Agility",
  movementagility: "Agility",
  balance: "Balance",
  movementbalance: "Balance",
  reactions: "Reactions",
  movementreactions: "Reactions",
  ballcontrol: "Ball Control",
  skillballcontrol: "Ball Control",
  dribbling: "Dribbling",
  skilldribbling: "Dribbling",
  composure: "Composure",
  mentalitycomposure: "Composure",
  interceptions: "Interceptions",
  mentalityinterceptions: "Interceptions",
  headingaccuracy: "Heading Acc.",
  headingacc: "Heading Acc.",
  attackingheadingaccuracy: "Heading Acc.",
  defensiveawareness: "Def. Awareness",
  defawareness: "Def. Awareness",
  marking: "Def. Awareness",
  defendingmarkingawareness: "Def. Awareness",
  standingtackle: "Stand Tackle",
  standtackle: "Stand Tackle",
  defendingstandingtackle: "Stand Tackle",
  slidingtackle: "Slide Tackle",
  slidetackle: "Slide Tackle",
  defendingslidingtackle: "Slide Tackle",
  jumping: "Jumping",
  powerjumping: "Jumping",
  stamina: "Stamina",
  powerstamina: "Stamina",
  strength: "Strength",
  powerstrength: "Strength",
  aggression: "Aggression",
  mentalityaggression: "Aggression",
};

function normalizeStatKey(raw: string): string | null {
  return STAT_KEY_MAP[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

const FULL_FC27_CSV_SOURCES = [
  "https://raw.githubusercontent.com/LakshmiKanth11/EA_FC_ANALYSIS/main/EA_FC_PLAYERS_DATASET_AND_DASHBOARD/data/players.csv",
  "https://raw.githubusercontent.com/LakshmiKanth11/EA_FC_ANALYSIS/main/data/players.csv",
];

// Authentic FC 27 starter cards (used immediately while full CSV catalog imports)
type SeedTuple = [
  string, string, string, number, string, string[], string, string, string,
  number, number, number, number, "Right" | "Left",
  [number, number, number, number, number, number],
  string[], string[], Record<string, number>?
];

const SEED_DATA: SeedTuple[] = [
  ["fc27-kane-90", "Harry Kane", "Gold Rare", 90, "ST", ["CAM"], "FC Bayern München", "Bundesliga", "England", 188, 86, 3, 4, "Right", [62, 94, 83, 82, 49, 83], ["Finesse Shot"], ["First Touch", "Gamechanger", "Long Ball Pass", "Low Driven Shot", "Precision Header", "Press Proven"], { Acceleration: 63, "Sprint Speed": 62, "Att. Position": 96, Finishing: 96, "Shot Power": 92, "Long Shots": 91, Volleys: 91, Penalties: 93, Vision: 86, "Short Pass": 86, "Long Pass": 82, Agility: 67, Balance: 72, Reactions: 94, "Ball Control": 87, Dribbling: 80, Composure: 92, "Heading Acc.": 89, Jumping: 87, Stamina: 76, Strength: 87, Aggression: 82 }],
  ["fc27-mbappe-91", "Kylian Mbappé", "Gold Rare", 91, "ST", ["LW"], "Real Madrid", "LALIGA EA SPORTS", "France", 182, 75, 5, 4, "Right", [97, 90, 80, 92, 36, 78], ["Quick Step"], ["Finesse Shot", "Rapid", "Flair", "Trivela", "Acrobatic"], { Acceleration: 97, "Sprint Speed": 97, "Att. Position": 93, Finishing: 94, "Shot Power": 90, "Short Pass": 86, Agility: 93, Balance: 82, Reactions: 93, "Ball Control": 92, Dribbling: 93, Composure: 88, Strength: 77 }],
  ["fc27-haaland-91", "Erling Haaland", "Gold Rare", 91, "ST", [], "Manchester City", "Premier League", "Norway", 195, 94, 3, 3, "Left", [88, 92, 70, 81, 45, 88], ["Acrobatic"], ["Power Shot", "Precision Header", "Quick Step", "Bruiser"], { Acceleration: 81, "Sprint Speed": 94, "Att. Position": 95, Finishing: 96, "Shot Power": 94, Agility: 76, Balance: 72, Reactions: 94, Strength: 93, Jumping: 92 }],
  ["fc27-vini-91", "Vinícius Jr.", "Gold Rare", 91, "LW", ["ST"], "Real Madrid", "LALIGA EA SPORTS", "Brazil", 176, 73, 5, 4, "Right", [95, 85, 81, 92, 29, 69], ["Quick Step"], ["Finesse Shot", "Rapid", "Flair", "First Touch", "Trickster"], { Acceleration: 95, "Sprint Speed": 95, Finishing: 88, Agility: 94, Dribbling: 94, "Ball Control": 91 }],
  ["fc27-salah-90", "Mohamed Salah", "Gold Rare", 90, "RW", ["RM"], "Liverpool", "Premier League", "Egypt", 175, 71, 4, 3, "Left", [89, 88, 83, 89, 45, 75], ["Finesse Shot"], ["Chip Shot", "Rapid", "First Touch", "Trivela"], { "Att. Position": 92, Finishing: 92, Balance: 91, Reactions: 92, Composure: 91 }],
  ["fc27-bellingham-90", "Jude Bellingham", "Gold Rare", 90, "CAM", ["CM"], "Real Madrid", "LALIGA EA SPORTS", "England", 186, 75, 4, 4, "Right", [81, 87, 83, 88, 78, 83], ["Relentless"], ["Incisive Pass", "Technical", "Flair", "Slide Tackle", "Intercept"], { "Att. Position": 91, Finishing: 90, Vision: 88, "Short Pass": 89, Reactions: 91, "Ball Control": 89, Interceptions: 82, Stamina: 93 }],
  ["fc27-bonmati-91", "Aitana Bonmatí", "Gold Rare", 91, "CM", ["CAM"], "FC Barcelona", "Liga F", "Spain", 162, 53, 4, 5, "Right", [85, 86, 87, 92, 77, 75], ["Technical"], ["Finesse Shot", "Incisive Pass", "First Touch", "Relentless", "Trivela"], { Agility: 94, Balance: 93, Reactions: 92, "Ball Control": 92, Dribbling: 92, Stamina: 92 }],
  ["fc27-rodri-91", "Rodri", "Gold Rare", 91, "CDM", ["CM"], "Manchester City", "Premier League", "Spain", 191, 82, 3, 4, "Right", [66, 80, 86, 84, 87, 85], ["Tiki Taka"], ["Power Shot", "Long Ball Pass", "Bruiser", "Aerial Fortress", "Intercept"], { "Short Pass": 92, "Long Pass": 91, Reactions: 92, Composure: 93, Interceptions: 88, "Def. Awareness": 88, "Stand Tackle": 88 }],
  ["fc27-vandijk-90", "Virgil van Dijk", "Gold Rare", 90, "CB", [], "Liverpool", "Premier League", "Netherlands", 193, 92, 2, 3, "Right", [78, 60, 72, 72, 90, 86], ["Aerial Fortress"], ["Long Ball Pass", "Jockey", "Block", "Intercept", "Anticipate", "Bruiser"], { "Sprint Speed": 86, Reactions: 89, Composure: 90, Interceptions: 90, "Heading Acc.": 89, "Def. Awareness": 91, "Stand Tackle": 91, Strength: 93 }],
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

// ── RFC-4180 Compliant CSV Parser ───────────────────────────────────────────
function parseCsvRows(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const vals = rows[r];
    if (!vals || vals.length < 3) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (vals[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

function inferDefaultRarity(overall: number): string {
  if (overall >= 75) return "Gold Rare";
  if (overall >= 65) return "Silver";
  return "Bronze";
}

function parseNumberOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]));
  return Number.isFinite(n) ? n : null;
}

function parseCsvRecordToCard(rec: Record<string, string>): FutCard | null {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      if (rec[k] !== undefined && rec[k] !== "") return rec[k];
      const lower = k.toLowerCase();
      for (const rk of Object.keys(rec)) {
        if (rk.toLowerCase() === lower && rec[rk] !== "") return rec[rk];
      }
    }
    return "";
  };

  const name = get("name", "long_name", "player_name", "full_name", "short_name");
  const commonName = get("common_name", "short_name") || null;
  const overall = parseNumberOrNull(get("overall", "overall_rating", "ovr", "rating"));
  if (!name || !overall || overall < 40 || overall > 99) return null;

  const rawPos = get("position", "player_positions", "preferred_position", "pos");
  const posTokens = rawPos
    .split(/[,/|;\s]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const position = posTokens[0] || "ST";
  if (position === "GK") return null;
  const altPositions = Array.from(new Set(posTokens.slice(1))).filter((p) => p !== position && p !== "GK");

  const rarity = get("rarity", "rarity_name", "card_type", "version") || inferDefaultRarity(overall);
  const rawId = get("id", "player_id", "asset_id", "ea_id", "sofifa_id");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const raritySlug = rarity.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const id = rawId ? `fc27-${rawId}-${raritySlug}` : `fc27-${slug}-${overall}-${raritySlug}`;

  const pace = parseNumberOrNull(get("pace", "pac")) ?? 70;
  const shooting = parseNumberOrNull(get("shooting", "sho")) ?? 70;
  const passing = parseNumberOrNull(get("passing", "pas")) ?? 70;
  const dribbling = parseNumberOrNull(get("dribbling", "dri")) ?? 70;
  const defending = parseNumberOrNull(get("defending", "def")) ?? 50;
  const physical = parseNumberOrNull(get("physicality", "physical", "phy")) ?? 70;

  const attributes: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) {
    const mapped = normalizeStatKey(k);
    if (!mapped) continue;
    const num = parseNumberOrNull(v);
    if (num !== null && num >= 1 && num <= 99) {
      attributes[mapped] = num;
    }
  }

  // Ensure every outfield attribute has a valid fallback from its face stat
  const defaults: Record<string, number> = {
    Acceleration: pace, "Sprint Speed": pace,
    "Att. Position": shooting, Finishing: shooting, "Shot Power": shooting, "Long Shots": shooting,
    Volleys: Math.max(35, shooting - 2), Penalties: Math.max(35, shooting - 2),
    Vision: passing, Crossing: Math.max(35, passing - 2), "FK Acc.": Math.max(35, passing - 4),
    "Short Pass": passing, "Long Pass": Math.max(35, passing - 1), Curve: Math.max(35, passing - 2),
    Agility: dribbling, Balance: Math.max(35, dribbling - 2), Reactions: dribbling,
    "Ball Control": dribbling, Dribbling: dribbling, Composure: dribbling,
    Interceptions: defending, "Heading Acc.": defending, "Def. Awareness": defending,
    "Stand Tackle": defending, "Slide Tackle": Math.max(35, defending - 2),
    Jumping: physical, Stamina: physical, Strength: physical, Aggression: Math.max(35, physical - 2),
  };
  for (const [stat, val] of Object.entries(defaults)) {
    if (attributes[stat] === undefined) attributes[stat] = val;
  }

  const playstylePlus: string[] = [];
  const playstyles: string[] = [];
  const rawPs = get("playstyles", "play_styles", "traits");
  if (rawPs) {
    for (const token of rawPs.split(/[,|;]+/)) {
      const clean = token.trim();
      if (!clean) continue;
      if (clean.endsWith("+")) {
        playstylePlus.push(clean.slice(0, -1).trim());
      } else {
        playstyles.push(clean);
      }
    }
  }
  const rawPsPlus = get("playstyles_plus", "playstyle_plus");
  if (rawPsPlus) {
    for (const token of rawPsPlus.split(/[,|;]+/)) {
      const clean = token.replace(/\+$/, "").trim();
      if (clean && !playstylePlus.includes(clean)) playstylePlus.push(clean);
    }
  }

  const footRaw = get("preferred_foot", "foot");
  const preferredFoot = footRaw.toLowerCase().startsWith("l") ? "Left" : "Right";

  return {
    id,
    eaAssetId: rawId || null,
    name,
    commonName,
    rarity,
    overall,
    position,
    altPositions,
    club: get("club", "club_name", "team") || null,
    league: get("league", "league_name") || null,
    nation: get("nation", "nationality", "nationality_name") || null,
    heightCm: parseNumberOrNull(get("height_cm", "height")),
    weightKg: parseNumberOrNull(get("weight_kg", "weight")),
    skillMoves: Math.min(5, Math.max(1, parseNumberOrNull(get("skill_moves", "skills")) ?? 3)),
    weakFoot: Math.min(5, Math.max(1, parseNumberOrNull(get("weak_foot", "weakfoot")) ?? 3)),
    preferredFoot,
    faceStats: { pace, shooting, passing, dribbling, defending, physical },
    attributes,
    playstylePlus,
    playstyles,
    avatarUrl: get("avatar_url", "player_face_url", "headshot_url", "image_url") || null,
  };
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
  if (position === "GK") return null;

  const assetId = String(item.id ?? item.assetId ?? `${fullName}-${item.overallRating}`);
  const rarity = item.rarity?.label || item.rarityName || inferDefaultRarity(Number(item.overallRating));

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

// ── Fast Multi-Row PostgreSQL Batch Upsert ──────────────────────────────────
async function upsertFutCardsBatch(db: any, cards: FutCard[], batchSize = 250): Promise<number> {
  if (!cards.length) return 0;

  // Deduplicate by id within the payload so ON CONFLICT never hits the same key twice in one batch
  const deduped = new Map<string, FutCard>();
  for (const c of cards) {
    if (c.position !== "GK") deduped.set(c.id, c);
  }
  const uniqueCards = Array.from(deduped.values());

  for (let i = 0; i < uniqueCards.length; i += batchSize) {
    const chunk = uniqueCards.slice(i, i + batchSize);
    const valuesSql = sql.join(
      chunk.map(
        (c) => sql`(
          ${c.id}, ${c.eaAssetId}, ${c.name}, ${c.commonName}, ${c.rarity}, ${c.overall}, ${c.position},
          ${JSON.stringify(c.altPositions)}::jsonb, ${c.club}, ${c.league}, ${c.nation}, ${c.heightCm}, ${c.weightKg},
          ${c.skillMoves}, ${c.weakFoot}, ${c.preferredFoot},
          ${JSON.stringify(c.faceStats)}::jsonb, ${JSON.stringify(c.attributes)}::jsonb,
          ${JSON.stringify(c.playstylePlus)}::jsonb, ${JSON.stringify(c.playstyles)}::jsonb, ${c.avatarUrl}, NOW()
        )`
      ),
      sql`, `
    );

    await db.execute(sql`
      INSERT INTO fut_cards (
        id, ea_asset_id, name, common_name, rarity, overall, position,
        alt_positions, club, league, nation, height_cm, weight_kg,
        skill_moves, weak_foot, preferred_foot, face_stats, attributes,
        playstyle_plus, playstyles, avatar_url, updated_at
      ) VALUES ${valuesSql}
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
        height_cm = COALESCE(EXCLUDED.height_cm, fut_cards.height_cm),
        weight_kg = COALESCE(EXCLUDED.weight_kg, fut_cards.weight_kg),
        skill_moves = EXCLUDED.skill_moves,
        weak_foot = EXCLUDED.weak_foot,
        preferred_foot = EXCLUDED.preferred_foot,
        face_stats = EXCLUDED.face_stats,
        attributes = EXCLUDED.attributes,
        playstyle_plus = EXCLUDED.playstyle_plus,
        playstyles = EXCLUDED.playstyles,
        avatar_url = COALESCE(EXCLUDED.avatar_url, fut_cards.avatar_url),
        updated_at = NOW()
    `);
  }

  return uniqueCards.length;
}

export async function importFutCardsFromCsv(csvText: string): Promise<{ imported: number }> {
  const records = parseCsvRows(csvText);
  const cards = records.map(parseCsvRecordToCard).filter((c): c is FutCard => c !== null);
  if (cards.length === 0) return { imported: 0 };

  await ensureFutCardsSchema();
  const db = await getDatabase();
  if (!db) return { imported: 0 };

  const imported = await upsertFutCardsBatch(db, cards);
  console.log(`[FC27 FUT IMPORTER] Imported ${imported} outfield cards from CSV.`);
  return { imported };
}

export async function importFutCardsFromJson(payload: any): Promise<{ imported: number }> {
  const rawItems = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.players)
      ? payload.players
      : Array.isArray(payload)
        ? payload
        : [];

  const cards = rawItems
    .map((item: any) => (item?.overallRating ? parseEaItem(item) : parseCsvRecordToCard(item)))
    .filter((c: FutCard | null): c is FutCard => c !== null);

  if (cards.length === 0) return { imported: 0 };

  await ensureFutCardsSchema();
  const db = await getDatabase();
  if (!db) return { imported: 0 };

  const imported = await upsertFutCardsBatch(db, cards);
  console.log(`[FC27 FUT IMPORTER] Imported ${imported} outfield cards from JSON.`);
  return { imported };
}

export async function importFutCardsFromUrl(url: string, timeoutMs = 15000): Promise<{ imported: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClubsDNA-Importer/1.0)",
        Accept: "text/csv, application/json, text/plain, */*",
      },
    });
    if (!res.ok) return { imported: 0 };
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return { imported: 0 };
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return await importFutCardsFromJson(JSON.parse(trimmed));
    }
    return await importFutCardsFromCsv(trimmed);
  } catch (err) {
    console.warn(`[FC27 FUT IMPORTER] Fetch failed for ${url}:`, (err as Error)?.message);
    return { imported: 0 };
  } finally {
    clearTimeout(timer);
  }
}

let dbReady = false;
let fullCatalogStarted = false;

function findLocalPlayersCsv(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "data", "FC27_PLAYERS.csv"),
    path.resolve(process.cwd(), "data", "players.csv"),
    path.resolve(process.cwd(), "dist", "data", "FC27_PLAYERS.csv"),
    path.resolve(process.cwd(), "dist", "data", "players.csv"),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

async function runFullCatalogImportInBackground(db: any): Promise<void> {
  if (fullCatalogStarted) return;
  fullCatalogStarted = true;

  try {
    const countRows = extractRows(await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM fut_cards`));
    const currentCount = Number(countRows[0]?.cnt ?? 0);
    // Already have the full FC 27 catalog imported
    if (currentCount >= 1000) return;

    // 1. Check for a bundled local CSV first
    const localCsv = findLocalPlayersCsv();
    if (localCsv) {
      const csvText = fs.readFileSync(localCsv, "utf-8");
      const { imported } = await importFutCardsFromCsv(csvText);
      if (imported > 0) return;
    }

    // 2. Otherwise pull the full 19,789-player FC 27 dataset from GitHub
    for (const url of FULL_FC27_CSV_SOURCES) {
      const { imported } = await importFutCardsFromUrl(url, 20000);
      if (imported > 0) return;
    }
  } catch (err) {
    console.error("[FC27 FUT IMPORTER] Background catalog import error:", err);
  }
}

export async function ensureFutCardsSchema(): Promise<void> {
  if (dbReady) return;
  const db = await getDatabase();
  if (!db) return;

  const colCheck = extractRows(await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'fut_cards' AND column_name = 'common_name'
  `));
  const tableCheck = extractRows(await db.execute(sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'fut_cards'
  `));
  if (tableCheck.length > 0 && colCheck.length === 0) {
    await db.execute(sql`DROP TABLE fut_cards`);
  }

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

  // Clean out old placeholder rows & non-existent Kane promo cards
  await db.execute(sql`
    DELETE FROM fut_cards
    WHERE rarity = 'Base Gold'
       OR id IN ('fc27-kane-92', 'fc27-kane-95', 'fc27-ginola-89')
  `);

  // Ensure starter cards (with exact FC 27 Harry Kane 90 Gold Rare) are immediately present
  await upsertFutCardsBatch(db, BUILTIN_FC27_CARDS);
  dbReady = true;

  // Trigger the full ~17,585 outfield FC 27 catalog import asynchronously
  void runFullCatalogImportInBackground(db);
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
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (!db) return 0;
    return await upsertFutCardsBatch(db, cards);
  } catch (err) {
    console.error("[futCards] upsert error:", err);
    return 0;
  }
}

export async function syncFutCards(): Promise<{ synced: number }> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (db) {
      fullCatalogStarted = false;
      await runFullCatalogImportInBackground(db);
      const countRows = extractRows(await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM fut_cards`));
      return { synced: Number(countRows[0]?.cnt ?? BUILTIN_FC27_CARDS.length) };
    }
  } catch (err) {
    console.error("[futCards] sync error:", err);
  }
  return { synced: BUILTIN_FC27_CARDS.length };
}

function filterInMemoryCards(params: {
  query?: string;
  position?: string;
  rarity?: string;
  limit?: number;
}): FutCard[] {
  const limit = Math.min(50, Math.max(1, params.limit ?? 25));
  const q = params.query?.trim().toLowerCase() ?? "";
  const pos = params.position && params.position !== "ALL" ? params.position.toUpperCase() : "";
  const rar = params.rarity && params.rarity !== "ALL" ? params.rarity : "";

  return BUILTIN_FC27_CARDS.filter((c) => {
    if (c.position === "GK") return false;
    if (q && !c.name.toLowerCase().includes(q) && !(c.commonName ?? "").toLowerCase().includes(q)) return false;
    if (pos && c.position !== pos && !c.altPositions.includes(pos)) return false;
    if (rar && c.rarity !== rar) return false;
    return true;
  })
    .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function searchFutCards(params: {
  query?: string;
  position?: string;
  rarity?: string;
  limit?: number;
}): Promise<FutCard[]> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (db) {
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
      const rows = extractRows(await db.execute(sql`
        SELECT * FROM fut_cards WHERE ${whereClause} ORDER BY overall DESC, name ASC LIMIT ${limit}
      `));
      if (rows.length > 0) return rows.map(rowToFutCard);
    }
  } catch (err) {
    console.error("[futCards] search DB fallback:", err);
  }
  return filterInMemoryCards(params);
}

export async function getFutCardById(id: string): Promise<FutCard | null> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (db) {
      const rows = extractRows(await db.execute(sql`SELECT * FROM fut_cards WHERE id = ${id} LIMIT 1`));
      if (rows[0]) return rowToFutCard(rows[0]);
    }
  } catch (err) {
    console.error("[futCards] getById DB fallback:", err);
  }
  return BUILTIN_FC27_CARDS.find((c) => c.id === id) ?? null;
}

export async function getAvailableRarities(): Promise<string[]> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (db) {
      const rows = extractRows(await db.execute(sql`SELECT DISTINCT rarity FROM fut_cards WHERE position <> 'GK' ORDER BY rarity ASC`));
      if (rows.length > 0) return rows.map((r: any) => String(r.rarity));
    }
  } catch (err) {
    console.error("[futCards] getRarities DB fallback:", err);
  }
  return Array.from(new Set(BUILTIN_FC27_CARDS.map((c) => c.rarity))).sort();
}

export const getDistinctRarities = getAvailableRarities;
