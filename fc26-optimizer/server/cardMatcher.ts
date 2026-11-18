import {
  getAllArchetypes,
  getArchetypeProfiles,
  getPlaystyles,
  getSpecialisations,
  getCostDict,
} from "./csvLoader";
import {
  ScoutingBlueprint,
  AttributePriorities,
  MathEngineResult,
  StatResult,
  ATTR_CATEGORIES,
  STANDARD_ATTRS,
  resolveSignaturePlaystyles,
  pickSpecialisationSwap,
  buildPlaystyleFit,
} from "./mathEngine27";
import { rolesToPositions } from "./positionMap";
import { FutCard } from "./futCards";

function normAttr(s: string): string {
  if (!s) return "";
  let n = s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (n.startsWith("att") && n.includes("pos")) return "attackpositioning";
  if (n.includes("fk") && n.includes("acc")) return "fkaccuracy";
  if (n.startsWith("def") && n.includes("awar")) return "defawareness";
  if (n.includes("stand") && n.includes("tack")) return "standingtackle";
  if (n.includes("slid") && n.includes("tack")) return "slidingtackle";
  if (n.startsWith("short") && n.includes("pass")) return "shortpassing";
  if (n.startsWith("long") && n.includes("pass")) return "longpassing";
  if (n.includes("head") && n.includes("acc")) return "headingaccuracy";
  if (n.includes("sprint")) return "sprintspeed";
  return n;
}

const stripPlus = (s: string) => normAttr(String(s || "").replace(/\+/g, ""));

// Facility/CSV names can differ slightly from FUT card names ("Aerial" vs "Aerial Fortress")
function canonPlaystyle(name: string): string {
  const k = normAttr(String(name || "").replace(/\+/g, ""));
  if (k === "aerial") return "aerialfortress";
  if (k === "gamechanger") return "gamechanger";
  return k;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Synced with client/src/constants/archetypeData.ts
const ARCH_PHYSICALS: Record<
  string,
  { baseH: number; minH: number; maxH: number; baseW: number; minW: number; maxW: number; type: "DEF" | "MID_ATT" | "GK" }
> = {
  "Progressor":     { baseH: 186, minH: 177, maxH: 195, baseW: 85, minW: 75, maxW: 95,  type: "DEF" },
  "Boss":           { baseH: 188, minH: 180, maxH: 196, baseW: 90, minW: 80, maxW: 100, type: "DEF" },
  "Disruptor":      { baseH: 178, minH: 168, maxH: 188, baseW: 75, minW: 65, maxW: 85,  type: "DEF" },
  "Marauder":       { baseH: 178, minH: 168, maxH: 188, baseW: 75, minW: 65, maxW: 85,  type: "DEF" },
  "Recycler":       { baseH: 182, minH: 172, maxH: 192, baseW: 75, minW: 65, maxW: 85,  type: "MID_ATT" },
  "Maestro":        { baseH: 175, minH: 162, maxH: 188, baseW: 75, minW: 65, maxW: 85,  type: "MID_ATT" },
  "Creator":        { baseH: 175, minH: 162, maxH: 188, baseW: 75, minW: 65, maxW: 85,  type: "MID_ATT" },
  "Spark":          { baseH: 175, minH: 162, maxH: 188, baseW: 70, minW: 60, maxW: 80,  type: "MID_ATT" },
  "Magician":       { baseH: 175, minH: 162, maxH: 188, baseW: 70, minW: 60, maxW: 80,  type: "MID_ATT" },
  "Finisher":       { baseH: 177, minH: 164, maxH: 190, baseW: 80, minW: 70, maxW: 90,  type: "MID_ATT" },
  "Target":         { baseH: 186, minH: 177, maxH: 195, baseW: 90, minW: 80, maxW: 100, type: "MID_ATT" },
  "Target Forward": { baseH: 186, minH: 177, maxH: 195, baseW: 90, minW: 80, maxW: 100, type: "MID_ATT" },
};

// Matches getModifier in client/src/utils/builderUtils.ts
function getBodyStepModifier(current: number, base: number, step: number): number {
  const diff = current - base;
  if (Math.abs(diff) === 0) return 0;
  const magnitude = 1 + Math.floor((Math.abs(diff) - 1) / step);
  return diff > 0 ? magnitude : -magnitude;
}

function computePhysicalBoostsFor(archetype: string, heightCm: number, weightKg: number): Record<string, number> {
  const bounds = ARCH_PHYSICALS[archetype] ?? ARCH_PHYSICALS["Maestro"];
  const hMod = getBodyStepModifier(heightCm, bounds.baseH, 4);
  const wMod = getBodyStepModifier(weightKg, bounds.baseW, 8);
  return {
    jumping: hMod + wMod,
    sprintspeed: hMod - wMod,
    strength: hMod + wMod,
    acceleration: -hMod - wMod,
    agility: -hMod - wMod,
    balance: -hMod + wMod,
  };
}

// ── Skill Moves / Weak Foot AP pricing ──────────────────────────────────────
const STAR_UPGRADE_COSTS: Record<string, number[]> = {
  star0: [0, 0, 5, 10, 25, 40],
  star1: [0, 0, 8, 15, 25, 40],
  star2: [0, 0, 10, 10, 20, 35],
  star3: [0, 0, 10, 20, 35, 50],
  star4: [0, 0, 10, 8, 15, 25],
};

type StarCap = { min: number; max: number; tier: string };
const ARCHETYPE_STAR_CAPS: Record<string, { sm: StarCap; wf: StarCap }> = {
  "Progressor":     { sm: { min: 2, max: 4, tier: "star2" }, wf: { min: 3, max: 4, tier: "star1" } },
  "Boss":           { sm: { min: 2, max: 3, tier: "star0" }, wf: { min: 2, max: 4, tier: "star3" } },
  "Disruptor":      { sm: { min: 2, max: 4, tier: "star2" }, wf: { min: 3, max: 5, tier: "star3" } },
  "Marauder":       { sm: { min: 2, max: 5, tier: "star2" }, wf: { min: 3, max: 5, tier: "star1" } },
  "Recycler":       { sm: { min: 2, max: 4, tier: "star4" }, wf: { min: 3, max: 5, tier: "star1" } },
  "Maestro":        { sm: { min: 2, max: 5, tier: "star2" }, wf: { min: 3, max: 5, tier: "star1" } },
  "Creator":        { sm: { min: 2, max: 5, tier: "star2" }, wf: { min: 3, max: 5, tier: "star1" } },
  "Spark":          { sm: { min: 3, max: 5, tier: "star4" }, wf: { min: 3, max: 5, tier: "star1" } },
  "Magician":       { sm: { min: 3, max: 5, tier: "star2" }, wf: { min: 3, max: 5, tier: "star1" } },
  "Finisher":       { sm: { min: 3, max: 5, tier: "star4" }, wf: { min: 3, max: 5, tier: "star3" } },
  "Target":         { sm: { min: 2, max: 5, tier: "star4" }, wf: { min: 2, max: 5, tier: "star3" } },
  "Target Forward": { sm: { min: 2, max: 5, tier: "star4" }, wf: { min: 2, max: 5, tier: "star3" } },
};

function starCostBetween(tier: string, minLevel: number, targetLevel: number): number {
  const costs = STAR_UPGRADE_COSTS[tier];
  if (!costs) return 0;
  let total = 0;
  for (let i = minLevel + 1; i <= targetLevel; i++) total += costs[i] ?? 0;
  return total;
}

export function resolveCardStars(
  card: FutCard,
  archetype: string
): { skillMoves: number; weakFoot: number; skillMovesCost: number; weakFootCost: number; totalCost: number } | null {
  const key = Object.keys(ARCHETYPE_STAR_CAPS).find((k) => normAttr(k) === normAttr(archetype));
  if (!key) return null;
  const caps = ARCHETYPE_STAR_CAPS[key];
  const skillMoves = clamp(card.skillMoves, caps.sm.min, caps.sm.max);
  const weakFoot = clamp(card.weakFoot, caps.wf.min, caps.wf.max);
  const skillMovesCost = starCostBetween(caps.sm.tier, caps.sm.min, skillMoves);
  const weakFootCost = starCostBetween(caps.wf.tier, caps.wf.min, weakFoot);
  return { skillMoves, weakFoot, skillMovesCost, weakFootCost, totalCost: skillMovesCost + weakFootCost };
}

// ── Positional Attribute & PlayStyle Priority Weights ───────────────────────
const POSITION_OVR_WEIGHTS: Record<string, Record<string, number>> = {
  ST:  { finishing: 0.18, shotpower: 0.10, dribbling: 0.10, ballcontrol: 0.10, sprintspeed: 0.08, acceleration: 0.08, reactions: 0.08, headingaccuracy: 0.08, shortpassing: 0.05, strength: 0.05 },
  CF:  { finishing: 0.14, ballcontrol: 0.14, dribbling: 0.14, shortpassing: 0.10, vision: 0.08, shotpower: 0.08, acceleration: 0.07, sprintspeed: 0.07, reactions: 0.08 },
  LW:  { dribbling: 0.16, ballcontrol: 0.14, acceleration: 0.12, sprintspeed: 0.12, crossing: 0.10, shortpassing: 0.08, finishing: 0.08, agility: 0.06, vision: 0.06 },
  RW:  { dribbling: 0.16, ballcontrol: 0.14, acceleration: 0.12, sprintspeed: 0.12, crossing: 0.10, shortpassing: 0.08, finishing: 0.08, agility: 0.06, vision: 0.06 },
  CAM: { shortpassing: 0.16, vision: 0.15, ballcontrol: 0.15, dribbling: 0.14, longpassing: 0.08, finishing: 0.07, reactions: 0.07, agility: 0.06, longshots: 0.05 },
  CM:  { shortpassing: 0.16, longpassing: 0.13, ballcontrol: 0.13, vision: 0.12, dribbling: 0.09, stamina: 0.08, standingtackle: 0.07, interceptions: 0.07, reactions: 0.07 },
  CDM: { interceptions: 0.15, standingtackle: 0.15, defawareness: 0.14, shortpassing: 0.13, longpassing: 0.10, stamina: 0.08, strength: 0.07, ballcontrol: 0.07, aggression: 0.05 },
  LM:  { dribbling: 0.15, crossing: 0.13, ballcontrol: 0.13, shortpassing: 0.11, acceleration: 0.10, sprintspeed: 0.10, stamina: 0.08, vision: 0.07, finishing: 0.06 },
  RM:  { dribbling: 0.15, crossing: 0.13, ballcontrol: 0.13, shortpassing: 0.11, acceleration: 0.10, sprintspeed: 0.10, stamina: 0.08, vision: 0.07, finishing: 0.06 },
  LB:  { slidingtackle: 0.13, standingtackle: 0.13, interceptions: 0.12, defawareness: 0.11, sprintspeed: 0.10, acceleration: 0.09, crossing: 0.09, stamina: 0.08, ballcontrol: 0.07 },
  RB:  { slidingtackle: 0.13, standingtackle: 0.13, interceptions: 0.12, defawareness: 0.11, sprintspeed: 0.10, acceleration: 0.09, crossing: 0.09, stamina: 0.08, ballcontrol: 0.07 },
  CB:  { defawareness: 0.17, standingtackle: 0.17, slidingtackle: 0.13, interceptions: 0.13, headingaccuracy: 0.10, strength: 0.10, jumping: 0.06, aggression: 0.06, shortpassing: 0.04 },
};

const DEFENDING_PLAYSTYLES = new Set([
  "jockey", "block", "intercept", "anticipate", "slidetackle", "aerialfortress",
]);

const SCORING_PLAYSTYLES = new Set([
  "finesseshot", "chipshot", "powershot", "deadball", "precisionheader",
  "acrobatic", "lowdrivenshot", "gamechanger",
]);

function getCardPositionalPriorities(position: string) {
  const pos = (position || "CM").toUpperCase();
  if (pos === "ST" || pos === "CF") {
    return {
      ignoredAttrs: new Set([
        "attackpositioning", "penalties", "interceptions",
        "defawareness", "standingtackle", "slidingtackle",
      ]),
      isStylePriority: (styleCanon: string) =>
        !DEFENDING_PLAYSTYLES.has(styleCanon) || styleCanon === "aerialfortress",
    };
  }
  if (pos === "CB") {
    return {
      ignoredAttrs: new Set([
        "attackpositioning", "finishing", "shotpower",
        "longshots", "volleys", "penalties",
      ]),
      isStylePriority: (styleCanon: string) =>
        !SCORING_PLAYSTYLES.has(styleCanon) || styleCanon === "precisionheader",
    };
  }
  return {
    ignoredAttrs: new Set(["attackpositioning", "penalties"]),
    isStylePriority: (_styleCanon: string) => true,
  };
}

function getAttributeWeight(position: string, normStatKey: string): number {
  const pos = (position || "CM").toUpperCase();
  const { ignoredAttrs } = getCardPositionalPriorities(pos);
  if (ignoredAttrs.has(normStatKey)) return 0;
  const posTable = POSITION_OVR_WEIGHTS[pos] ?? POSITION_OVR_WEIGHTS["CM"];
  return 1 + (posTable[normStatKey] ?? 0) * 10;
}

/** Which archetype "Automatic" will pick for this card (same ranking the match uses). */
export function previewArchetypeForCard(
  card: FutCard,
  opts?: ArchetypePickOptions
): { archetype: string; ranking?: ArchetypeRanking[] } {
  if (opts) {
    const ranking = rankArchetypesForCard(card, opts);
    if (ranking.length) return { archetype: ranking[0].archetype, ranking: ranking.slice(0, 5) };
  }
  const best = scoreArchetypesForCard(card)[0];
  return { archetype: best?.archetype ?? "Maestro" };
}

/**
 * Fallback static scorer for all 11 outfield archetypes against a FUT card.
 */
export function scoreArchetypesForCard(card: FutCard): Array<{ archetype: string; score: number }> {
  const profiles = getArchetypeProfiles("FC27");
  const allArch = getAllArchetypes("FC27");
  const cardPlusSet = new Set(card.playstylePlus.map(canonPlaystyle));
  const cardAllSet = new Set([...card.playstylePlus, ...card.playstyles].map(canonPlaystyle));
  const cardPositions = new Set([card.position, ...card.altPositions].map((p) => p.toUpperCase()));

  const topAttrs = Object.entries(card.attributes)
    .filter(([attr]) => getAttributeWeight(card.position, normAttr(attr)) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const results: Array<{ archetype: string; score: number }> = [];

  for (const row of profiles) {
    const archName = String(row.Archetype || "").trim();
    if (!archName) continue;
    const normA = normAttr(archName);
    if (normA === "shotstopper" || normA === "sweeperkeeper") continue;

    let score = 0;

    const sigs = String(row.Signature_PlayStyles || "")
      .split(/[\/,]/)
      .map((s) => canonPlaystyle(s))
      .filter(Boolean);
    for (const sig of sigs) {
      if (cardPlusSet.has(sig)) score += 25;
      else if (cardAllSet.has(sig)) score += 12;
    }

    const recPos = rolesToPositions(row.Recommended_Positions).map((p) => p.toUpperCase());
    if (recPos[0] === card.position.toUpperCase()) score += 25;
    else if (recPos.some((p) => cardPositions.has(p))) score += 15;

    const archRows = allArch.filter((r: any) => normAttr(r.Archetype) === normA);
    const maxMap: Record<string, number> = {};
    for (const r of archRows) {
      maxMap[normAttr(r.Attribute)] = parseInt(r["Max Value"], 10) || 95;
    }

    let capPenalty = 0;
    for (const [attr, cardVal] of topAttrs) {
      const cap = maxMap[normAttr(attr)] ?? 90;
      if (cardVal > cap) {
        capPenalty += (cardVal - cap) * 1.5;
      }
    }
    score += Math.max(0, 30 - capPenalty);

    results.push({ archetype: archName, score: Math.round(score * 10) / 10 });
  }

  return results.sort((a, b) => b.score - a.score || a.archetype.localeCompare(b.archetype));
}

/**
 * Picks optimal height & weight inside the archetype's allowed bounds.
 * When FUT weight is missing (null), evaluates each weight modifier band (step = 8kg)
 * and chooses the weight band that minimizes weighted squared error on physical/agility/pace targets.
 */
export function resolveCardPhysicals(card: FutCard, archetype: string): { heightCm: number; weightKg: number } {
  const bounds = ARCH_PHYSICALS[archetype] ?? {
    baseH: 175,
    minH: 162,
    maxH: 188,
    baseW: 75,
    minW: 65,
    maxW: 85,
    type: "MID_ATT" as const,
  };
  const heightCm = clamp(card.heightCm ?? bounds.baseH, bounds.minH, bounds.maxH);

  if (card.weightKg !== null && Number.isFinite(card.weightKg)) {
    return { heightCm, weightKg: clamp(Math.round(card.weightKg), bounds.minW, bounds.maxW) };
  }

  // Group weights by their 8kg modifier band and test which band best fits the card's body-affected stats
  const bandReps = new Map<number, number>();
  for (let w = bounds.minW; w <= bounds.maxW; w++) {
    const mod = getBodyStepModifier(w, bounds.baseW, 8);
    if (!bandReps.has(mod) || Math.abs(w - bounds.baseW) < Math.abs(bandReps.get(mod)! - bounds.baseW)) {
      bandReps.set(mod, w);
    }
  }

  const allArch = getAllArchetypes("FC27");
  const archRows = allArch.filter((r: any) => normAttr(r.Archetype) === normAttr(archetype));
  const baseByAttr: Record<string, number> = {};
  for (const r of archRows) {
    baseByAttr[normAttr(r.Attribute)] = parseInt(r["Base Value"], 10) || 70;
  }

  const cardTargets: Record<string, number> = {};
  for (const [k, v] of Object.entries(card.attributes || {})) {
    if (Number.isFinite(v)) cardTargets[normAttr(k)] = v;
  }

  const affectedAttrs = ["jumping", "sprintspeed", "strength", "acceleration", "agility", "balance"];
  let bestWeight = bounds.baseW;
  let bestBandLoss = Infinity;

  for (const candidateW of bandReps.values()) {
    const boosts = computePhysicalBoostsFor(archetype, heightCm, candidateW);
    let loss = 0;
    for (const a of affectedAttrs) {
      const target = cardTargets[a];
      if (!Number.isFinite(target)) continue;
      const w = getAttributeWeight(card.position, a);
      if (w <= 0) continue;
      const boostedBase = (baseByAttr[a] ?? 70) + (boosts[a] ?? 0);
      const deficit = Math.max(0, target - boostedBase);
      loss += w * deficit * deficit;
    }
    if (loss < bestBandLoss || (loss === bestBandLoss && Math.abs(candidateW - bounds.baseW) < Math.abs(bestWeight - bounds.baseW))) {
      bestBandLoss = loss;
      bestWeight = candidateW;
    }
  }

  return { heightCm, weightKg: bestWeight };
}

/**
 * Builds the ScoutingBlueprint metadata object for display and snapshot compatibility.
 */
export function buildBlueprintFromCard(card: FutCard, archetype: string): {
  blueprint: ScoutingBlueprint;
  priorities: AttributePriorities;
  physicals: { heightCm: number; weightKg: number };
} {
  const physicals = resolveCardPhysicals(card, archetype);

  const sortedAttrs = STANDARD_ATTRS
    .map((attr) => ({
      attr,
      val: card.attributes[attr] ?? 65,
      weight: getAttributeWeight(card.position, normAttr(attr)),
    }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.val * b.weight - a.val * a.weight);

  const coreAttributes = sortedAttrs.slice(0, 3).map((x) => x.attr);
  const secondaryAttributes = sortedAttrs.slice(3, 7).map((x) => x.attr);
  const tertiaryAttributes = sortedAttrs.slice(7, 11).map((x) => x.attr);

  const weights: Record<string, number> = {};
  const max: Record<string, number> = {};
  const exclude: string[] = [];

  for (const attr of STANDARD_ATTRS) {
    const val = card.attributes[attr] ?? 65;
    const posW = getAttributeWeight(card.position, normAttr(attr));
    if (posW <= 0) {
      exclude.push(attr);
    } else if (val >= 86) {
      weights[attr] = 5;
    } else if (val >= 80) {
      weights[attr] = 4;
    } else if (val >= 74) {
      weights[attr] = 3;
    } else if (val >= 68) {
      weights[attr] = 2;
    } else {
      weights[attr] = 1;
    }
    max[attr] = Math.min(99, Math.max(55, val));
  }

  const blueprint: ScoutingBlueprint = {
    archetype,
    position: card.position,
    playstylePlus: card.playstylePlus.slice(0, 4),
    playstyles: card.playstyles.map((name) => ({ name, requirements: [] })),
    coreAttributes,
    secondaryAttributes,
    tertiaryAttributes,
    skillMoves: card.skillMoves,
    weakFoot: card.weakFoot,
  };

  return {
    blueprint,
    priorities: { weights, max, exclude },
    physicals,
  };
}

export interface CardStatComparisonRow {
  attribute: string;
  cardValue: number;
  proValue: number;
  diff: number;
}

export interface CardMatchOutput {
  card: FutCard;
  chosenArchetype: string;
  archetypeScores: Array<{ archetype: string; score: number }>;
  physicals: { heightCm: number; weightKg: number };
  blueprint: ScoutingBlueprint;
  engineResult: MathEngineResult;
  stars: {
    skillMoves: number;
    weakFoot: number;
    skillMovesCost: number;
    weakFootCost: number;
    totalCost: number;
    attributeBudget: number;
  };
  playstyles: {
    signatures: string[];
    standard: string[];
    specialisation: string | null;
    specSwapIndex: number;
  };
  recommendedPositions: string[];
  comparison: CardStatComparisonRow[];
  similarityScore: number;
  surplusPoints: number;
}

interface AttemptParams {
  apBudget: number;
  signatureSlots: number;
  standardSlots: number;
  foundationBoosts: Record<string, number>;
  starsPrepaid?: boolean;
  facilityPlaystyles?: string[];
  /** When true, computes this archetype's own physical modifiers instead of reusing another archetype's boosts */
  useArchetypeOwnPhysicals?: boolean;
}

export interface ArchetypePickOptions {
  apBudget: number;
  signatureSlots: number;
  standardSlots: number;
}

export interface ArchetypeRanking {
  archetype: string;
  score: number;
  similarity: number;
  signatureBonus: number;
  playstylesUnlocked: number;
  penalties: number;
}

/**
 * Deterministic weighted squared-error solver for matching a FUT card to a Pro Clubs archetype:
 * 1. Reserves star AP upfront
 * 2. Evaluates optional archetype Specializations if their PlayStyle+ matches the card
 * 3. Equips priority card PlayStyles cheapest-first (checking raw points against CSV thresholds)
 * 4. Allocates remaining AP greedily by marginal weighted squared-error reduction per AP:
 *    gain / cost = w * ((target - now)^2 - (target - next)^2) / stepCost
 *    so stats stop upgrading as soon as they reach the FUT card's value.
 */
function runArchetypeAttempt(card: FutCard, archetype: string, params: AttemptParams) {
  const { blueprint, priorities, physicals } = buildBlueprintFromCard(card, archetype);

  const starInfo = resolveCardStars(card, archetype);
  const starCost = params.starsPrepaid ? 0 : starInfo?.totalCost ?? 0;
  const attributeBudget = Math.max(0, params.apBudget - starCost);

  if (starInfo) {
    blueprint.skillMoves = starInfo.skillMoves;
    blueprint.weakFoot = starInfo.weakFoot;
  }

  const ALL_ARCHETYPES = getAllArchetypes("FC27");
  const COST_DICT = getCostDict("FC27");
  const PLAYSTYLES = getPlaystyles("FC27");
  const SPECIALISATIONS = getSpecialisations("FC27");

  const archRows = ALL_ARCHETYPES.filter((r: any) => normAttr(r.Archetype) === normAttr(archetype));
  if (archRows.length === 0) {
    throw new Error(`Archetype "${archetype}" not found in FC27 data.`);
  }

  const dictArchKey = Object.keys(COST_DICT).find((k) => normAttr(k) === normAttr(archetype));
  const archCostDict = dictArchKey ? COST_DICT[dictArchKey] : {};

  // Build normalized boosts map
  const activeBoosts: Record<string, number> = {};
  if (params.useArchetypeOwnPhysicals) {
    const ownPhys = computePhysicalBoostsFor(archetype, physicals.heightCm, physicals.weightKg);
    for (const [k, v] of Object.entries(ownPhys)) activeBoosts[k] = v;
  } else {
    for (const [k, v] of Object.entries(params.foundationBoosts || {})) {
      activeBoosts[normAttr(k)] = (activeBoosts[normAttr(k)] || 0) + v;
    }
  }

  // Build normalized card attribute targets
  const cardTargets: Record<string, number> = {};
  for (const [rawKey, val] of Object.entries(card.attributes || {})) {
    if (Number.isFinite(val)) cardTargets[normAttr(rawKey)] = val;
  }

  const posPriority = getCardPositionalPriorities(card.position);

  interface SolverRow {
    attr: string;
    norm: string;
    base: number;
    max: number;
    prices: number[]; // prices[lvl] = AP cost to step from lvl-1 -> lvl
    cumulative: number[]; // cumulative[lvl] = AP cost from base -> lvl
    target: number;
    weight: number;
    boost: number;
  }

  const rows: SolverRow[] = [];
  const rowByNorm = new Map<string, SolverRow>();

  for (const r of archRows) {
    const attr = String(r.Attribute).trim();
    const norm = normAttr(attr);
    if (norm === "skillmoves" || norm === "weakfoot" || norm.startsWith("gk")) continue;

    const base = parseInt(r["Base Value"], 10) || 70;
    const max = parseInt(r["Max Value"], 10) || 99;
    const dictAttrKey = Object.keys(archCostDict).find((k) => normAttr(k) === norm);
    const levelCosts = dictAttrKey ? archCostDict[dictAttrKey] : {};

    const prices: number[] = [];
    const cumulative: number[] = [];
    let sum = 0;
    for (let v = base; v <= max; v++) {
      const stepCost = v === base ? 0 : levelCosts?.[v] ?? 1;
      prices[v] = stepCost;
      sum += stepCost;
      cumulative[v] = sum;
    }

    const target = Number.isFinite(cardTargets[norm]) ? cardTargets[norm] : 70;
    const weight = getAttributeWeight(card.position, norm);
    const boost = activeBoosts[norm] || 0;

    const row: SolverRow = { attr, norm, base, max, prices, cumulative, target, weight, boost };
    rows.push(row);
    rowByNorm.set(norm, row);
  }

  // Desired PlayStyles from the FUT card (PlayStyle+ first, then base PlayStyles)
  const desiredMap = new Map<string, { name: string; canon: string; plus: boolean }>();
  for (const ps of card.playstylePlus || []) {
    const clean = String(ps).replace(/\+/g, "").trim();
    const canon = canonPlaystyle(clean);
    if (canon) desiredMap.set(canon, { name: clean, canon, plus: true });
  }
  for (const ps of card.playstyles || []) {
    const clean = String(ps).replace(/\+/g, "").trim();
    const canon = canonPlaystyle(clean);
    if (canon && !desiredMap.has(canon)) {
      desiredMap.set(canon, { name: clean, canon, plus: false });
    }
  }
  const desiredList = Array.from(desiredMap.values());
  const priorityDesired = desiredList.filter((d) => posPriority.isStylePriority(d.canon));

  // Resolve CSV PlayStyle definitions & attribute requirements
  const parsedPlaystyleDefs = priorityDesired
    .map((d) => {
      const def: any = PLAYSTYLES.find((p: any) => canonPlaystyle(p.Playstyle || "") === d.canon);
      if (!def) return null;
      const reqs = [
        [def.Req_Attr1 || def.Attr1, def.Req_Val1 || def.Val1],
        [def.Req_Attr2 || def.Attr2, def.Req_Val2 || def.Val2],
        [def.Req_Attr3 || def.Attr3, def.Req_Val3 || def.Val3],
      ]
        .filter(([a, v]) => a && v)
        .map(([a, v]) => ({ norm: normAttr(String(a)), val: parseInt(String(v), 10) }));

      return { ...d, csvName: String(def.Playstyle).trim(), reqs };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Candidate Specializations for this archetype (baseline null + any spec whose PS+ matches the card)
  const archSpecs = SPECIALISATIONS.filter((s: any) => normAttr(s.Archetype) === normAttr(archetype))
    .map((s: any) => {
      const reqs = [
        [s.Attr1, s.Val1],
        [s.Attr2, s.Val2],
        [s.Attr3, s.Val3],
      ]
        .filter(([a, v]) => a && v)
        .map(([a, v]) => ({ norm: normAttr(String(a)), val: parseInt(String(v), 10) }));
      return {
        name: String(s.Specialisation).trim(),
        psPlus: String(s["Playstyle+"] || "").replace(/\+/g, "").trim(),
        reqs,
      };
    })
    .filter((s) => s.name && s.psPlus && s.reqs.length > 0 && desiredMap.has(canonPlaystyle(s.psPlus)));

  const sigNames = String(
    getArchetypeProfiles("FC27").find((a: any) => normAttr(a.Archetype) === normAttr(archetype))?.Signature_PlayStyles || ""
  )
    .split(/[\/,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const facilityKeys = new Set((params.facilityPlaystyles ?? []).map(canonPlaystyle));

  function evaluateBranch(spec: (typeof archSpecs)[number] | null, replaceIdx: number) {
    const rawValues: Record<string, number> = {};
    for (const r of rows) rawValues[r.norm] = r.base;
    let apSpent = 0;

    const activeStyles = new Map<string, boolean>(); // canon -> isPlus
    const addStyle = (name: string, isPlus: boolean) => {
      const c = canonPlaystyle(name);
      if (c) activeStyles.set(c, isPlus || Boolean(activeStyles.get(c)));
    };

    // 1. Signatures & Specialization PS+
    sigNames.forEach((sig, i) => {
      if (spec && replaceIdx === i) addStyle(spec.psPlus, true);
      else addStyle(sig, i < params.signatureSlots);
    });

    // 2. Facility-granted PlayStyles
    for (const fk of facilityKeys) addStyle(fk, false);

    const reqCost = (reqs: Array<{ norm: string; val: number }>): number => {
      let cost = 0;
      for (const req of reqs) {
        const r = rowByNorm.get(req.norm);
        if (!r || req.val > r.max) return Infinity;
        if (r.weight <= 0 && req.val > rawValues[r.norm]) return Infinity;
        if (req.val > rawValues[r.norm]) {
          const step = r.cumulative[req.val] - r.cumulative[rawValues[r.norm]];
          if (!Number.isFinite(step) || step >= 999999) return Infinity;
          cost += step;
        }
      }
      return cost;
    };

    const purchaseReqs = (reqs: Array<{ norm: string; val: number }>): boolean => {
      const cost = reqCost(reqs);
      if (apSpent + cost > attributeBudget) return false;
      for (const req of reqs) {
        rawValues[req.norm] = Math.max(rawValues[req.norm], req.val);
      }
      apSpent += cost;
      return true;
    };

    // 3. Unlock Specialization requirements if chosen
    if (spec && !purchaseReqs(spec.reqs)) return null;

    // 4. Fill custom PlayStyle slots cheapest-first
    const equippedCustom: string[] = [];
    const skippedCustom: string[] = [];
    const pool = parsedPlaystyleDefs.filter((p) => !activeStyles.has(p.canon));

    while (equippedCustom.length < params.standardSlots && pool.length > 0) {
      pool.sort((a, b) => reqCost(a.reqs) - reqCost(b.reqs) || Number(b.plus) - Number(a.plus));
      const candidate = pool.shift()!;
      if (purchaseReqs(candidate.reqs)) {
        equippedCustom.push(candidate.csvName);
        addStyle(candidate.csvName, false);
      } else {
        skippedCustom.push(candidate.csvName);
      }
    }
    for (const rest of pool) skippedCustom.push(rest.csvName);

    const inGame = (r: SolverRow) => Math.min(99, rawValues[r.norm] + r.boost);

    // 5. Greedy marginal weighted squared-error reduction per AP
    for (let iter = 0; iter < 2000; iter++) {
      let bestRow: SolverRow | null = null;
      let bestEfficiency = 0;

      for (const r of rows) {
        if (r.weight <= 0) continue;
        const curRaw = rawValues[r.norm];
        if (curRaw >= r.max) continue;
        const stepPrice = r.prices[curRaw + 1];
        if (!Number.isFinite(stepPrice) || apSpent + stepPrice > attributeBudget) continue;

        const now = inGame(r);
        const next = Math.min(99, now + 1);
        const sqGain = r.weight * ((r.target - now) ** 2 - (r.target - next) ** 2);
        if (sqGain > 0) {
          const eff = sqGain / Math.max(stepPrice, 1);
          if (eff > bestEfficiency) {
            bestEfficiency = eff;
            bestRow = r;
          }
        }
      }

      if (!bestRow) break;
      rawValues[bestRow.norm]++;
      apSpent += bestRow.prices[rawValues[bestRow.norm]];
    }

    // 6. Compute total weighted squared error + missing PlayStyle penalties
    let totalError = 0;
    for (const r of rows) {
      if (r.weight <= 0) continue;
      const diff = r.target - inGame(r);
      totalError += r.weight * diff * diff;
    }

    for (const d of priorityDesired) {
      const hasBase = activeStyles.has(d.canon);
      const hasPlus = Boolean(activeStyles.get(d.canon));
      if (!hasBase) totalError += 170;
      if (d.plus && !hasPlus) totalError += 400;
    }

    return {
      spec,
      replaceIdx,
      rawValues,
      apSpent,
      equippedCustom,
      skippedCustom,
      activeStyles,
      totalError,
    };
  }

  const branches: NonNullable<ReturnType<typeof evaluateBranch>>[] = [];
  const baseBranch = evaluateBranch(null, -1);
  if (baseBranch) branches.push(baseBranch);

  for (const spec of archSpecs) {
    const swapSlots = params.signatureSlots >= 2 ? [0, 1] : [0];
    for (const idx of swapSlots) {
      const b = evaluateBranch(spec, idx);
      if (b) branches.push(b);
    }
  }

  branches.sort((a, b) => a.totalError - b.totalError || a.apSpent - b.apSpent);
  const bestBranch = branches[0] ?? baseBranch!;

  // Package into MathEngineResult so downstream UI and snapshots work without changes
  const stats: StatResult[] = rows.map((r) => {
    const rawFinal = bestBranch.rawValues[r.norm];
    const pointsAdded = rawFinal - r.base;
    const spent = r.cumulative[rawFinal] ?? 0;
    const cat =
      Object.entries(ATTR_CATEGORIES).find(([, list]) => list.some((a) => normAttr(a) === r.norm))?.[0] ?? "Other";
    return {
      attribute: r.attr,
      base: r.base,
      final: rawFinal,
      max: r.max,
      apSpent: spent,
      category: cat,
    };
  });

  const investedPoints: Record<string, number> = {};
  for (const r of rows) {
    const added = bestBranch.rawValues[r.norm] - r.base;
    if (added > 0) {
      const uiName = STANDARD_ATTRS.find((std) => normAttr(std) === r.norm) || r.attr;
      investedPoints[uiName] = added;
    }
  }

  const byCategory: Record<string, StatResult[]> = {};
  for (const st of stats) {
    byCategory[st.category] = byCategory[st.category] || [];
    byCategory[st.category].push(st);
  }

  if (bestBranch.spec) {
    blueprint.specialisation = bestBranch.spec.name;
    blueprint.specialisationPlaystylePlus = bestBranch.spec.psPlus;
    blueprint.specialisationMinAttrs = bestBranch.spec.reqs.map((req) => ({
      attr: STANDARD_ATTRS.find((s) => normAttr(s) === req.norm) || req.norm,
      val: req.val,
    }));
  }

  const engineResult: MathEngineResult = {
    stats,
    totalApSpent: bestBranch.apSpent + starCost,
    byCategory,
    investedPoints,
    equippedPlaystyles: bestBranch.equippedCustom,
    skippedPlaystyles: bestBranch.skippedCustom,
    skillMovesLevel: starInfo?.skillMoves ?? card.skillMoves,
    weakFootLevel: starInfo?.weakFoot ?? card.weakFoot,
    starApSpent: starCost,
  };

  return {
    blueprint,
    priorities,
    physicals,
    starInfo,
    starCost,
    attributeBudget,
    engineResult,
    activeStyles: bestBranch.activeStyles,
    chosenSpec: bestBranch.spec,
    chosenSpecSwapIdx: bestBranch.spec ? bestBranch.replaceIdx : -1,
    totalError: bestBranch.totalError,
  };
}

function similarityOf(
  card: FutCard,
  engineResult: MathEngineResult,
  boosts: Record<string, number>
): number {
  let weightedShortfall = 0;
  let totalWeight = 0;
  for (const attr of STANDARD_ATTRS) {
    const norm = normAttr(attr);
    const w = getAttributeWeight(card.position, norm);
    if (w <= 0) continue;
    const cardValue = card.attributes[attr] ?? 70;
    const statRow = engineResult.stats.find((st) => normAttr(st.attribute) === norm);
    const boost = Object.entries(boosts).find(([k]) => normAttr(k) === norm)?.[1] ?? 0;
    const shortfall = Math.max(0, cardValue - Math.min(99, (statRow?.final ?? 70) + boost));
    weightedShortfall += shortfall * w;
    totalWeight += w;
  }
  const avgWeightedShortfall = weightedShortfall / Math.max(totalWeight, 1);
  return Math.max(0, Math.min(100, 100 - avgWeightedShortfall * 4));
}

/**
 * Evaluates all 11 outfield archetypes with the weighted solver and ranks them.
 */
export function rankArchetypesForCard(card: FutCard, opts: ArchetypePickOptions): ArchetypeRanking[] {
  const profiles = getArchetypeProfiles("FC27");
  const cardPlus = new Set(card.playstylePlus.map(canonPlaystyle));
  const cardAll = new Set([...card.playstylePlus, ...card.playstyles].map(canonPlaystyle));
  const cardPositions = new Set([card.position, ...card.altPositions].map((pos) => pos.toUpperCase()));

  const seen = new Set<string>();
  const out: ArchetypeRanking[] = [];

  for (const row of profiles) {
    const name = String(row.Archetype || "").trim();
    const key = normAttr(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    if (key === "shotstopper" || key === "sweeperkeeper") continue;

    try {
      const attempt = runArchetypeAttempt(card, name, {
        apBudget: opts.apBudget,
        signatureSlots: opts.signatureSlots,
        standardSlots: opts.standardSlots,
        foundationBoosts: {},
        starsPrepaid: false,
        facilityPlaystyles: [],
        useArchetypeOwnPhysicals: true,
      });

      const ownBoosts = computePhysicalBoostsFor(name, attempt.physicals.heightCm, attempt.physicals.weightKg);
      const similarity = similarityOf(card, attempt.engineResult, ownBoosts);

      let signatureBonus = 0;
      for (const sig of String(row.Signature_PlayStyles || "")
        .split(/[\/,]/)
        .map(canonPlaystyle)
        .filter(Boolean)) {
        if (cardPlus.has(sig)) signatureBonus += 4.5;
        else if (cardAll.has(sig)) signatureBonus += 2;
      }
      if (attempt.chosenSpec && cardPlus.has(canonPlaystyle(attempt.chosenSpec.psPlus))) {
        signatureBonus += 3.5;
      }

      const playstylesUnlocked = attempt.engineResult.equippedPlaystyles?.length ?? 0;

      let positionBonus = 0;
      const rec = rolesToPositions(row.Recommended_Positions).map((pos: string) => pos.toUpperCase());
      if (rec[0] && cardPositions.has(rec[0])) positionBonus = 1.5;
      else if (rec.some((pos: string) => cardPositions.has(pos))) positionBonus = 0.75;

      let penalties = 0;
      const bounds = ARCH_PHYSICALS[name];
      if (bounds && card.heightCm != null) {
        penalties += Math.max(0, bounds.minH - card.heightCm, card.heightCm - bounds.maxH) * 0.5;
      }
      const stars = resolveCardStars(card, name);
      if (stars) {
        penalties += (Math.abs(card.skillMoves - stars.skillMoves) + Math.abs(card.weakFoot - stars.weakFoot)) * 3;
      }

      const score = similarity + signatureBonus + playstylesUnlocked * 1.5 + positionBonus - penalties;
      out.push({
        archetype: name,
        score: Math.round(score * 10) / 10,
        similarity: Math.round(similarity * 10) / 10,
        signatureBonus,
        playstylesUnlocked,
        penalties: Math.round(penalties * 10) / 10,
      });
    } catch {
      // Skip invalid or missing archetype rows
    }
  }

  return out.sort((a, b) => b.score - a.score || a.archetype.localeCompare(b.archetype));
}

export function matchFutCardToPro(params: {
  card: FutCard;
  forcedArchetype?: string | null;
  apBudget: number;
  signatureSlots: number;
  standardSlots: number;
  foundationBoosts: Record<string, number>;
  starsPrepaid?: boolean;
  facilityPlaystyles?: string[];
}): CardMatchOutput {
  const ranking = rankArchetypesForCard(params.card, {
    apBudget: params.apBudget,
    signatureSlots: params.signatureSlots,
    standardSlots: params.standardSlots,
  });
  const legacyScores = ranking.length ? [] : scoreArchetypesForCard(params.card);
  const chosenArchetype = params.forcedArchetype || ranking[0]?.archetype || legacyScores[0]?.archetype || "Maestro";
  const scores = ranking.length ? ranking.map((r) => ({ archetype: r.archetype, score: r.score })) : legacyScores;

  const attempt = runArchetypeAttempt(params.card, chosenArchetype, {
    apBudget: params.apBudget,
    signatureSlots: params.signatureSlots,
    standardSlots: params.standardSlots,
    foundationBoosts: params.foundationBoosts,
    starsPrepaid: params.starsPrepaid,
    facilityPlaystyles: params.facilityPlaystyles,
    useArchetypeOwnPhysicals: Object.keys(params.foundationBoosts || {}).length === 0,
  });

  const {
    blueprint,
    physicals,
    starInfo,
    starCost,
    attributeBudget,
    engineResult,
    chosenSpec,
    chosenSpecSwapIdx,
  } = attempt;

  const playstyleFit = buildPlaystyleFit(blueprint);
  const specSwapIndex = chosenSpec
    ? chosenSpecSwapIdx >= 0
      ? chosenSpecSwapIdx
      : pickSpecialisationSwap(chosenArchetype, params.signatureSlots, chosenSpec.psPlus, playstyleFit)
    : -1;

  const resolvedSignatures = resolveSignaturePlaystyles(
    chosenArchetype,
    params.signatureSlots,
    chosenSpec?.psPlus,
    specSwapIndex
  );

  const standardPlaystyles = engineResult.equippedPlaystyles?.slice(0, params.standardSlots) ?? [];

  const effectiveBoosts =
    Object.keys(params.foundationBoosts || {}).length > 0
      ? params.foundationBoosts
      : computePhysicalBoostsFor(chosenArchetype, physicals.heightCm, physicals.weightKg);

  let surplusPoints = 0;
  const comparison: CardStatComparisonRow[] = STANDARD_ATTRS.map((attr) => {
    const cardValue = params.card.attributes[attr] ?? 70;
    const statRow = engineResult.stats.find((s) => normAttr(s.attribute) === normAttr(attr));
    const boost = Object.entries(effectiveBoosts).find(([k]) => normAttr(k) === normAttr(attr))?.[1] ?? 0;
    const proValue = Math.min(99, (statRow?.final ?? 70) + boost);
    const diff = proValue - cardValue;
    if (diff > 0) surplusPoints += diff;
    return { attribute: attr, cardValue, proValue, diff };
  });

  const similarityScore = Math.round(similarityOf(params.card, engineResult, effectiveBoosts));

  const profiles = getArchetypeProfiles("FC27");
  const archProfile = profiles.find((a: any) => normAttr(a.Archetype) === normAttr(chosenArchetype));
  const recommendedPositions = rolesToPositions(archProfile?.Recommended_Positions);

  return {
    card: params.card,
    chosenArchetype,
    archetypeScores: scores,
    physicals,
    blueprint,
    engineResult,
    stars: {
      skillMoves: starInfo?.skillMoves ?? params.card.skillMoves,
      weakFoot: starInfo?.weakFoot ?? params.card.weakFoot,
      skillMovesCost: starInfo?.skillMovesCost ?? 0,
      weakFootCost: starInfo?.weakFootCost ?? 0,
      totalCost: starCost,
      attributeBudget,
    },
    playstyles: {
      signatures: resolvedSignatures,
      standard: standardPlaystyles,
      specialisation: chosenSpec?.name ?? null,
      specSwapIndex,
    },
    recommendedPositions,
    comparison,
    similarityScore,
    surplusPoints,
  };
}
