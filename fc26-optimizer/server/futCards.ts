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

const FUTMIND_BASE_URL = "https://futmind.com/api/beta/players";

const STAT_KEY_MAP: Record<string, string> = {
  acceleration: "Acceleration",
  movementacceleration: "Acceleration",
  sprintspeed: "Sprint Speed",
  movementsprintspeed: "Sprint Speed",
  positioning: "Attack Positioning",
  attposition: "Attack Positioning",
  attackpositioning: "Attack Positioning",
  mentalitypositioning: "Attack Positioning",
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
  freekickaccuracy: "FK Accuracy",
  freekick: "FK Accuracy",
  fkacc: "FK Accuracy",
  skillfkaccuracy: "FK Accuracy",
  shortpassing: "Short Passing",
  shortpass: "Short Passing",
  attackingshortpassing: "Short Passing",
  longpassing: "Long Passing",
  longpass: "Long Passing",
  skilllongpassing: "Long Passing",
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
  headingaccuracy: "Heading Accuracy",
  heading: "Heading Accuracy",
  headingacc: "Heading Accuracy",
  attackingheadingaccuracy: "Heading Accuracy",
  defensiveawareness: "Def Awareness",
  defawareness: "Def Awareness",
  defawerness: "Def Awareness", // FUTMind's actual (misspelled) key
  marking: "Def Awareness",
  defendingmarkingawareness: "Def Awareness",
  standingtackle: "Standing Tackle",
  standtackle: "Standing Tackle",
  defendingstandingtackle: "Standing Tackle",
  slidingtackle: "Sliding Tackle",
  slidetackle: "Sliding Tackle",
  defendingslidingtackle: "Sliding Tackle",
  jumping: "Jumping",
  powerjumping: "Jumping",
  stamina: "Stamina",
  powerstamina: "Stamina",
  strength: "Strength",
  powerstrength: "Strength",
  aggression: "Aggression",
  mentalityaggression: "Aggression",
};


// ── FUTMind id -> name lookups (taken from FUTMind's own locale data) ───────
// baseTraits = PlayStyle ids, iconTraits = PlayStyle+ ids.
const PLAYSTYLE_NAMES: Record<number, string> = {
  0: "Finesse Shot", 1: "Chip Shot", 2: "Power Shot", 3: "Dead Ball",
  4: "Precision Header", 5: "Acrobatic", 6: "Low Driven Shot", 7: "Gamechanger",
  8: "Incisive Pass", 9: "Pinged Pass", 10: "Long Ball Pass", 11: "Tiki Taka",
  12: "Whipped Pass", 13: "Inventive", 14: "Jockey", 15: "Block",
  16: "Intercept", 17: "Anticipate", 18: "Slide Tackle", 19: "Aerial Fortress",
  20: "Technical", 21: "Rapid", 22: "First Touch", 23: "Trickster",
  24: "Press Proven", 25: "Quick Step", 26: "Relentless", 27: "Long Throw",
  28: "Bruiser", 29: "Enforcer",
};

// rareflag -> rarity name (FUTMind item_raretypeN)
const RARITY_NAMES: Record<number, string> = {
  0: "Common", 1: "Rare", 2: "Locked Items", 3: "Team of the Week", 4: "ICON Swaps",
  5: "Team of the Year", 6: "On This Day Hero", 7: "On This Day Icon", 8: "Star Performer",
  9: "Base Hall of FUT", 10: "Hall of FUT: Unleashed", 11: "Team of the Season", 12: "Base Icon",
  13: "Complete Founder Evolution", 14: "Knockout Royalty Hero", 15: "Knockout Royalty ICON",
  16: "FUTTIES", 17: "FC Pro Champs Evo", 18: "Festival of Football ICON", 19: "FUT Champions",
  20: "FoF: Answer the Call", 21: "Prime Hero", 22: "Destined for Glory", 23: "Future Stars Hero",
  24: "Squad Building Challenge", 25: "End Of An Era", 26: "UCL Primetime Hero",
  27: "UWCL Primetime Hero", 28: "Festival of Football: Captains", 30: "FUT Birthday",
  31: "UEFA Women's Champions League Primetime", 32: "UEFA Women's Champions League Road to the Final",
  33: "Thunderstruck", 34: "FC Pro Live", 35: "Winter Wildcards ICON", 36: "Journey of Nations",
  37: "Special Item", 38: "FC Pro Leagues Live", 39: "Special Item", 40: "Special Item",
  41: "Special Item", 42: "POTM Bundesliga", 43: "POTM Premier League", 44: "VBL Power Item",
  45: "Gallery Excellence", 46: "UEFA Europa League Primetime", 47: "UEFA Champions League Common",
  48: "UEFA Champions League Rare", 49: "Winter Wildcards Hero", 50: "UEFA Champions League Primetime",
  51: "Flashback", 52: "Winter Wildcards Seasonal Excellence", 53: "Winter Wildcards ICON Red",
  54: "Winter Wildcards Hero Red", 55: "Knockout Royalty", 56: "Limited Edition Noble",
  57: "Showdown Upgrade", 58: "Showdown", 59: "CONMEBOL Sudamericana MOTM",
  60: "In-Progress Evolution", 61: "Evolutions I", 62: "Festival of Football Showdown",
  63: "Festival of Football Showdown Upgrade", 64: "TOTY Honourable Mentions",
  65: "TOTS Honourable Mentions", 66: "Future Stars Evolution", 67: "Future Stars Academy",
  68: "Premium World Tour", 69: "Ads & Sponsorships", 70: "World Tour EVO", 71: "Future Stars",
  72: "Base Hero", 73: "Special Item", 74: "Special Item", 75: "Special Item",
  76: "Trophy Titans ICON", 77: "Trophy Titans Hero", 78: "Summer Stars Tournament Winners",
  79: "POTM Ligue 1", 80: "Team of the Year Honourable Mentions Hero", 81: "Classic XI Hero",
  82: "Unbreakables", 83: "Unbreakables Hero", 84: "Special Item", 85: "Unbreakables ICON",
  86: "POTM LALIGA EA SPORTS", 87: "Squad Foundations", 88: "Unbreakables Evolution",
  89: "ICON SWAPS 1", 90: "Moments", 91: "World Tour", 92: "Special Item", 93: "Special Item",
  94: "Festival of Football: Star Performer", 95: "Festival of Football: Summer Stars Red",
  96: "Joga Bonito", 97: "Joga Bonito Hero", 98: "Festival of Football: National Pride",
  99: "Epic", 100: "Vintage", 101: "Limited Edition Epic", 102: "Limited Edition Legendary",
  103: "Festival of Football: National Pride Red", 104: "Festival of Football: Glory Hunters Red",
  105: "UEFA Conference League Primetime", 106: "Festival of Football: Phenoms Red",
  107: "Festival of Football: Path to Glory", 108: "Time Warp", 109: "Festival of Football: Glory Hunters",
  110: "Season Ladder Excellence", 111: "Fantasy FC", 112: "Time Warp ICON", 113: "Fantasy FC Live",
  114: "POTM Serie A", 115: "POTM Eredevisie", 116: "Festival of Football: Captains ICON",
  117: "Winter Wildcards", 118: "WINTER WILDCARDS", 119: "FUTTIES Evolution", 120: "TOTS Breakthrough",
  121: "Standard", 122: "Legendary", 124: "UEFA Champions League Road to the Final",
  125: "UEFA Europa League Road to the Final", 126: "UEFA Conference League Road to the Final",
  127: "Team of the Season Champions", 128: "Champions Mastery", 129: "Ones to Watch Retro 18",
  130: "Ones to Watch Retro 19", 131: "Ones to Watch Retro 20", 132: "TOTY HM Evolution",
  133: "TOTS Evolution", 134: "Fantasy FUT ON", 135: "Fantasy FC Hero", 136: "TOTS Breakthrough Evolution",
  137: "Festival of Football: Phenoms", 138: "Festival of Football: Summer Stars", 139: "FUTTIES ICON",
  140: "FUT Birthday Retro 18", 141: "FUT Birthday Retro 19", 142: "FUT Birthday Retro 20",
  145: "World Cup Stories", 146: "World Cup Phenoms", 147: "FUT Birthday EVO", 148: "FUT Birthday Hero",
  149: "FUT Birthday ICON", 150: "Ones to Watch", 151: "Ultimate Scream", 152: "FUT Birthday Icon",
  153: "Alternate Reality ICON", 154: "FUTTIES Hero", 155: "Team of the Year ICON", 156: "HISTORY MAKERS",
  157: "Thunderstruck ICON", 158: "FIFA WORLD CUP", 160: "Debut International Icon",
  161: "Champion International Icon", 162: "FC Pro Open Champion ICON", 163: "eCL Champion ICON",
  164: "FC Pro World Champion ICON", 168: "Ultimate Scream Hero", 170: "Future Stars ICON",
  171: "UEFA Heroes (Mens)", 172: "UEFA Heroes (Womens)", 177: "POTM LIGA F",
  180: "UEFA Euro Path to Glory", 181: "UEFA Euro Road to the Cup", 182: "Nike Mad Ready",
};

function normalizeStatKey(raw: string): string | null {
  return STAT_KEY_MAP[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

function inferDefaultRarity(overall: number): string {
  if (overall >= 75) return "Gold Rare";
  if (overall >= 65) return "Silver";
  return "Bronze";
}

function parseNumberOrNull(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  if (typeof raw === "object" && raw !== null && "value" in (raw as any)) {
    return parseNumberOrNull((raw as any).value);
  }
  const m = String(raw).match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]));
  return Number.isFinite(n) ? n : null;
}

function extractLabel(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.trim() || null;
  if (Array.isArray(val)) return extractLabel(val[0]);
  if (typeof val === "object") {
    const obj = val as Record<string, any>;
    const candidate =
      obj.name ?? obj.label ?? obj.title ?? obj.shortLabel ?? obj.short ?? obj.code ?? obj.displayName;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ── Parse FUTMind / EA / Generic Card JSON Object ───────────────────────────
function parseCardObject(item: Record<string, any>): FutCard | null {
  if (!item || typeof item !== "object") return null;

  const first = item.firstName ?? item.firstname;
  const last = item.lastName ?? item.lastname;
  const joinedName = [first, last].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();

  const fullName =
    extractLabel(item.commonName) ||
    extractLabel(item.common_name) ||
    joinedName ||
    extractLabel(item.name) ||
    extractLabel(item.cardName) ||
    extractLabel(item.displayName) ||
    extractLabel(item.fullName) ||
    extractLabel(item.playerName) ||
    (extractLabel(item.fullnameClean) ? titleCase(extractLabel(item.fullnameClean)!) : null) ||
    (extractLabel(item.nameClean) ? titleCase(extractLabel(item.nameClean)!) : null);

  const overall = parseNumberOrNull(
    item.overall ?? item.overallRating ?? item.overall_rating ?? item.rating ?? item.cardRating ?? item.ovr
  );
  if (!fullName || !overall || overall < 40 || overall > 99) return null;

  const rawPos =
    extractLabel(item.position) ||
    extractLabel(item.mainPosition) ||
    extractLabel(item.preferredPosition) ||
    extractLabel(item.pos) ||
    "";
  const posTokens = rawPos
    .split(/[,/|;\s]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const position = posTokens[0] || "ST";
  if (position === "GK") return null;

  const rawAlt =
    item.altPositions ??
    item.alt_positions ??
    item.alternativePositions ??
    item.alternatePositions ??
    item.possiblePositions ??
    [];
  const extraAlts = Array.isArray(rawAlt)
    ? rawAlt.map((p) => (extractLabel(p) || "").toUpperCase()).filter(Boolean)
    : typeof rawAlt === "string"
      ? rawAlt.split(/[,/|;\s]+/).map((p) => p.trim().toUpperCase()).filter(Boolean)
      : [];
  const altPositions = Array.from(new Set([...posTokens.slice(1), ...extraAlts])).filter(
    (p) => p !== position && p !== "GK"
  );

  // FUTMind only gives a numeric cardType (no label). Keep it as an honest
  // placeholder until a real id -> name lookup is available.
  const cardTypeNum = parseNumberOrNull(item.cardType);
  const rareFlagNum = parseNumberOrNull(item.rareflag);
  const rarity =
    extractLabel(item.rarity) ||
    extractLabel(item.rarityName) ||
    (rareFlagNum != null ? RARITY_NAMES[rareFlagNum] : null) ||
    (typeof item.cardType === "string" ? extractLabel(item.cardType) : null) ||
    (typeof item.version === "string" ? extractLabel(item.version) : null) ||
    (cardTypeNum != null ? `Card Type ${cardTypeNum}` : inferDefaultRarity(overall));

  // FUTMind: `id`/`assetId` are the PLAYER (shared by every version of that player),
  // `resourceId` is the individual CARD. Using the player id made all versions overwrite
  // each other in the DB, so the wrong version came back when a card was picked.
  const rawId = String(
    item.resourceId ?? item.resource_id ?? item.cardId ?? item.id ?? item.playerId ?? item.assetId ?? item.eaId ?? ""
  ).trim();
  const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const raritySlug = rarity.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const id = rawId ? `fm27-${rawId}` : `fm27-${slug}-${overall}-${raritySlug}`;

  // FUTMind face stats: attributeArray = [PAC, SHO, PAS, DRI, DEF, PHY]
  const faceArr: any[] = Array.isArray(item.attributeArray) ? item.attributeArray : [];
  const faceObj = item.faceStats ?? item.stats ?? item;
  const pace = parseNumberOrNull(faceObj.pace ?? faceObj.pac ?? faceArr[0]) ?? 70;
  const shooting = parseNumberOrNull(faceObj.shooting ?? faceObj.sho ?? faceArr[1]) ?? 70;
  const passing = parseNumberOrNull(faceObj.passing ?? faceObj.pas ?? faceArr[2]) ?? 70;
  const dribbling = parseNumberOrNull(faceObj.dribbling ?? faceObj.dri ?? faceArr[3]) ?? 70;
  const defending = parseNumberOrNull(faceObj.defending ?? faceObj.def ?? faceArr[4]) ?? 50;
  const physical = parseNumberOrNull(faceObj.physical ?? faceObj.physicality ?? faceObj.phy ?? faceArr[5]) ?? 70;

  const attributes: Record<string, number> = {};
  const statSources = [
    item.attributes,
    item.inGameStats,
    item.ingameStats,
    item.stats,
    item.detailedStats,
    item,
  ].filter((src) => src && typeof src === "object");

  for (const src of statSources) {
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === "object" && !Array.isArray(v) && !("value" in (v as any))) {
        for (const [subK, subV] of Object.entries(v as Record<string, any>)) {
          const mappedSub = normalizeStatKey(subK);
          const numSub = parseNumberOrNull(subV);
          if (mappedSub && numSub !== null && numSub >= 1 && numSub <= 99) {
            attributes[mappedSub] = numSub;
          }
        }
        continue;
      }
      const mapped = normalizeStatKey(k);
      const num = parseNumberOrNull(v);
      if (mapped && num !== null && num >= 1 && num <= 99) {
        attributes[mapped] = num;
      }
    }
  }

  const playstylePlus: string[] = [];
  const playstyles: string[] = [];

  const pushStyle = (rawName: string, isPlus = false) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (isPlus || trimmed.endsWith("+")) {
      const clean = trimmed.replace(/\+$/, "").trim();
      if (clean && !playstylePlus.includes(clean)) playstylePlus.push(clean);
    } else if (!playstyles.includes(trimmed)) {
      playstyles.push(trimmed);
    }
  };

  // FUTMind trait ids -> names (baseTraits = PlayStyles, iconTraits = PlayStyles+)
  if (Array.isArray(item.baseTraits)) {
    for (const t of item.baseTraits) {
      const nm = PLAYSTYLE_NAMES[Number(t)];
      if (nm) pushStyle(nm, false);
    }
  }
  if (Array.isArray(item.iconTraits)) {
    for (const t of item.iconTraits) {
      const nm = PLAYSTYLE_NAMES[Number(t)];
      if (nm) pushStyle(nm, true);
    }
  }

  for (const field of [item.playstylePlus, item.playStylePlus, item.playstylesPlus, item.playStylesPlus]) {
    if (Array.isArray(field)) {
      for (const ps of field) {
        const label = extractLabel(ps);
        if (label) pushStyle(label, true);
      }
    }
  }

  for (const field of [item.playstyles, item.playStyles, item.playerAbilities, item.abilities]) {
    if (Array.isArray(field)) {
      for (const ps of field) {
        if (typeof ps === "string") {
          pushStyle(ps);
        } else if (ps && typeof ps === "object") {
          const label = extractLabel(ps);
          const isPlus = Boolean(
            ps.plus || ps.isPlus || ps.is_plus || ps.type?.id === "playStylePlus" || ps.tier === "plus"
          );
          if (label) pushStyle(label, isPlus);
        }
      }
    } else if (typeof field === "string") {
      for (const token of field.split(/[,|;]+/)) pushStyle(token);
    }
  }

  const footRaw = String(item.preferredFoot ?? item.preferred_foot ?? item.preferredfoot ?? item.foot ?? "Right");
  const preferredFoot =
    footRaw === "2" || footRaw.toLowerCase().startsWith("l") ? "Left" : "Right";

  const avatarUrl =
    extractLabel(item.avatarUrl) ||
    extractLabel(item.avatar_url) ||
    extractLabel(item.imageUrl) ||
    extractLabel(item.image) ||
    extractLabel(item.headshotUrl) ||
    extractLabel(item.playerImage) ||
    null;

  return {
    id,
    eaAssetId: String(item.assetId ?? item.eaAssetId ?? rawId ?? "") || null,
    name: fullName,
    commonName: extractLabel(item.commonName ?? item.common_name),
    rarity,
    overall,
    position,
    altPositions,
    club: extractLabel(item.club ?? item.team ?? item.clubName),
    league: extractLabel(item.league ?? item.leagueName),
    nation: extractLabel(item.nation ?? item.nationality ?? item.nationName),
    heightCm: parseNumberOrNull(item.heightCm ?? item.height_cm ?? item.height),
    weightKg: parseNumberOrNull(item.weightKg ?? item.weight_kg ?? item.weight),
    skillMoves: Math.min(
      5,
      Math.max(1, parseNumberOrNull(item.skillMoves ?? item.skill_moves ?? item.skillmoves ?? item.skills) ?? 3)
    ),
    weakFoot: Math.min(
      5,
      Math.max(
        1,
        parseNumberOrNull(item.weakFoot ?? item.weak_foot ?? item.weakFootAbility ?? item.weakfootabilitytypecode) ?? 3
      )
    ),
    preferredFoot,
    faceStats: { pace, shooting, passing, dribbling, defending, physical },
    attributes,
    playstylePlus,
    playstyles,
    avatarUrl,
  };
}

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

// ── Fast Multi-Row PostgreSQL Batch Upsert ──────────────────────────────────
async function upsertFutCardsBatch(db: any, cards: FutCard[], batchSize = 250): Promise<number> {
  if (!cards.length) return 0;

  const deduped = new Map<string, FutCard>();
  for (const c of cards) {
    if (c.position !== "GK") deduped.set(c.id, c);
  }
  const uniqueCards = Array.from(deduped.values());

  try {
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
          attributes = CASE
            WHEN EXCLUDED.attributes <> '{}'::jsonb THEN EXCLUDED.attributes
            ELSE fut_cards.attributes
          END,
          playstyle_plus = EXCLUDED.playstyle_plus,
          playstyles = EXCLUDED.playstyles,
          avatar_url = COALESCE(EXCLUDED.avatar_url, fut_cards.avatar_url),
          updated_at = NOW()
      `);
    }
  } catch (err) {
    console.error("[futCards] upsertFutCardsBatch SQL error:", err);
  }

  return uniqueCards.length;
}

// ── Live FUTMind 2027 API Client ────────────────────────────────────────────
async function fetchFutMindPage(params: {
  page?: number;
  query?: string;
  position?: string;
  rarity?: string;
  timeoutMs?: number;
}): Promise<{ cards: FutCard[]; lastPage: number; total: number }> {
  const url = new URL(FUTMIND_BASE_URL);
  url.searchParams.set("year", "2027");
  url.searchParams.set("page", String(params.page ?? 1));
  if (params.query && params.query.trim()) {
    url.searchParams.set("q", params.query.trim());
  }
  if (params.position && params.position !== "ALL") {
    url.searchParams.set("position", params.position.toUpperCase());
  }
  if (params.rarity && params.rarity !== "ALL") {
    url.searchParams.set("rarity", params.rarity);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 6000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://futmind.com/",
        Origin: "https://futmind.com",
      },
    });
    if (!res.ok) {
      console.warn(`[FUTMind 2027] HTTP ${res.status} for ${url.toString()}`);
      return { cards: [], lastPage: 1, total: 0 };
    }
    const data = await res.json();
    const rawItems = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.players)
        ? data.players
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : [];

    const parsed = rawItems
      .map((item: any) => parseCardObject(item))
      .filter((c: FutCard | null): c is FutCard => c !== null);

    // FUTMind lists some cards twice (a normal and a "dynamic image" copy with identical stats)
    const seenCards = new Set<string>();
    const cards = parsed.filter((c: FutCard) => {
      const key = `${c.eaAssetId}|${c.rarity}|${c.overall}|${c.position}|${Object.values(c.attributes).join(",")}`;
      if (seenCards.has(key)) return false;
      seenCards.add(key);
      return true;
    });

    if (rawItems.length > 0 && cards.length === 0) {
      // Single-line so Render logs don't truncate it
      console.warn(
        "[FUTMind 2027] Unparsed item keys: " + JSON.stringify(Object.keys(rawItems[0] || {}))
      );
    }

    return {
      cards,
      lastPage: Number(data?.last_page ?? data?.lastPage ?? data?.meta?.last_page ?? 1),
      total: Number(data?.total ?? data?.meta?.total ?? cards.length),
    };
  } catch (err) {
    console.warn("[FUTMind 2027] Fetch warning:", (err as Error)?.message);
    return { cards: [], lastPage: 1, total: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function enrichCardDetailIfNeeded(card: FutCard): Promise<FutCard> {
  if (Object.keys(card.attributes).length >= 15 || !card.eaAssetId) return card;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(`${FUTMIND_BASE_URL}/${encodeURIComponent(card.eaAssetId)}?year=2027`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://futmind.com/",
      },
    });
    if (!res.ok) return card;
    const data = await res.json();
    const parsed = parseCardObject(data?.player ?? data?.item ?? data?.data ?? data);
    if (parsed && Object.keys(parsed.attributes).length >= 15) {
      return { ...card, ...parsed, id: card.id };
    }
  } catch {
    // ignore detail lookup failure
  } finally {
    clearTimeout(timer);
  }
  return card;
}

export async function importFutCardsFromCsv(csvText: string): Promise<{ imported: number }> {
  const records = parseCsvRows(csvText);
  const cards = records.map(parseCardObject).filter((c): c is FutCard => c !== null);
  if (cards.length === 0) return { imported: 0 };

  await ensureFutCardsSchema();
  const db = await getDatabase();
  if (!db) return { imported: 0 };

  const imported = await upsertFutCardsBatch(db, cards);
  console.log(`[FC27 FUT IMPORTER] Imported ${imported} cards from CSV.`);
  return { imported };
}

export async function importFutCardsFromJson(payload: any): Promise<{ imported: number }> {
  const rawItems = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.players)
      ? payload.players
      : Array.isArray(payload?.cards)
        ? payload.cards
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];

  const cards = rawItems
    .map((item: any) => parseCardObject(item))
    .filter((c: FutCard | null): c is FutCard => c !== null);

  if (cards.length === 0) return { imported: 0 };

  await ensureFutCardsSchema();
  const db = await getDatabase();
  if (!db) return { imported: 0 };

  const imported = await upsertFutCardsBatch(db, cards);
  console.log(`[FC27 FUT IMPORTER] Imported ${imported} cards from JSON.`);
  return { imported };
}

function findLocalDataFile(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "data", "FC27_FUT_CARDS.json"),
    path.resolve(process.cwd(), "data", "FC27_FUT_CARDS.csv"),
    path.resolve(process.cwd(), "dist", "data", "FC27_FUT_CARDS.json"),
    path.resolve(process.cwd(), "dist", "data", "FC27_FUT_CARDS.csv"),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

let dbReady = false;
let initialWarmupStarted = false;

async function warmTopPagesFromFutMind(db: any): Promise<void> {
  if (initialWarmupStarted) return;
  initialWarmupStarted = true;
  try {
    for (let page = 1; page <= 5; page++) {
      const { cards, lastPage } = await fetchFutMindPage({ page, timeoutMs: 7000 });
      if (cards.length > 0) {
        await upsertFutCardsBatch(db, cards);
      }
      if (page >= lastPage) break;
    }
  } catch (err) {
    console.warn("[FUTMind 2027] Warmup error:", (err as Error)?.message);
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

  await db.execute(sql`DELETE FROM fut_cards WHERE id LIKE 'fc27-%' OR rarity = 'Base Gold'`);
  dbReady = true;

  const localFile = findLocalDataFile();
  if (localFile) {
    const raw = fs.readFileSync(localFile, "utf-8");
    if (localFile.endsWith(".json")) {
      await importFutCardsFromJson(JSON.parse(raw));
    } else {
      await importFutCardsFromCsv(raw);
    }
  } else {
    void warmTopPagesFromFutMind(db);
  }
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

export async function syncFutCards(maxPages = 25): Promise<{ synced: number }> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (!db) return { synced: 0 };

    let totalSynced = 0;
    for (let page = 1; page <= maxPages; page++) {
      const { cards, lastPage } = await fetchFutMindPage({ page, timeoutMs: 8000 });
      if (cards.length > 0) {
        totalSynced += await upsertFutCardsBatch(db, cards);
      }
      if (page >= lastPage) break;
    }

    const countRows = extractRows(await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM fut_cards`));
    return { synced: Number(countRows[0]?.cnt ?? totalSynced) };
  } catch (err) {
    console.error("[futCards] sync error:", err);
    return { synced: 0 };
  }
}

export async function searchFutCards(params: {
  query?: string;
  position?: string;
  rarity?: string;
  limit?: number;
}): Promise<FutCard[]> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 25));

  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();

    if (params.query && params.query.trim().length >= 2) {
      const live = await fetchFutMindPage({
        page: 1,
        query: params.query.trim(),
        position: params.position,
        rarity: params.rarity,
        timeoutMs: 5500,
      });
      if (live.cards.length > 0) {
        if (db) await upsertFutCardsBatch(db, live.cards);
        return live.cards.slice(0, limit);
      }
    }

    if (!db) return [];

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
    let rows = extractRows(await db.execute(sql`
      SELECT * FROM fut_cards WHERE ${whereClause} ORDER BY overall DESC, name ASC LIMIT ${limit}
    `));

    if (rows.length === 0) {
      const liveBrowse = await fetchFutMindPage({
        page: 1,
        query: params.query,
        position: params.position,
        rarity: params.rarity,
        timeoutMs: 5500,
      });
      if (liveBrowse.cards.length > 0) {
        await upsertFutCardsBatch(db, liveBrowse.cards);
        return liveBrowse.cards.slice(0, limit);
      }
    }

    return rows.map(rowToFutCard);
  } catch (err) {
    console.error("[futCards] search error:", err);
    return [];
  }
}

export async function getFutCardById(id: string): Promise<FutCard | null> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (!db) return null;

    const rows = extractRows(await db.execute(sql`SELECT * FROM fut_cards WHERE id = ${id} LIMIT 1`));
    if (!rows[0]) return null;

    const card = rowToFutCard(rows[0]);
    const enriched = await enrichCardDetailIfNeeded(card);
    if (enriched !== card) {
      await upsertFutCardsBatch(db, [enriched]);
    }
    return enriched;
  } catch (err) {
    console.error("[futCards] getById error:", err);
    return null;
  }
}

export async function getAvailableRarities(): Promise<string[]> {
  try {
    await ensureFutCardsSchema();
    const db = await getDatabase();
    if (!db) return [];
    const rows = extractRows(await db.execute(sql`SELECT DISTINCT rarity FROM fut_cards WHERE position <> 'GK' ORDER BY rarity ASC`));
    return rows.map((r: any) => String(r.rarity));
  } catch (err) {
    console.error("[futCards] getRarities error:", err);
    return [];
  }
}

export const getDistinctRarities = getAvailableRarities;
