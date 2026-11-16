import { getAllArchetypes, getArchetypeProfiles } from "./csvLoader";
import {
  runMathEngine,
  ScoutingBlueprint,
  AttributePriorities,
  resolveSignaturePlaystyles,
  pickSpecialisationSwap,
  buildPlaystyleFit,
  STANDARD_ATTRS,
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

// Outfield archetype physical min/max ranges (cm / kg)
const ARCH_PHYSICALS: Record<string, { minH: number; maxH: number; minW: number; maxW: number }> = {
  "Progressor": { minH: 170, maxH: 196, minW: 65, maxW: 95 },
  "Boss":       { minH: 178, maxH: 201, minW: 72, maxW: 102 },
  "Marauder":   { minH: 168, maxH: 191, minW: 62, maxW: 88 },
  "Disruptor":  { minH: 170, maxH: 196, minW: 65, maxW: 94 },
  "Recycler":   { minH: 165, maxH: 191, minW: 60, maxW: 88 },
  "Maestro":    { minH: 162, maxH: 188, minW: 58, maxW: 84 },
  "Creator":    { minH: 162, maxH: 191, minW: 58, maxW: 86 },
  "Spark":      { minH: 160, maxH: 185, minW: 55, maxW: 80 },
  "Magician":   { minH: 160, maxH: 185, minW: 55, maxW: 80 },
  "Finisher":   { minH: 168, maxH: 193, minW: 64, maxW: 90 },
  "Target":     { minH: 180, maxH: 203, minW: 75, maxW: 105 },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Scores all 11 outfield archetypes against a FUT card:
 * 1. Signature PlayStyle overlap with the card's PlayStyle+ and PlayStyles
 * 2. Recommended position match with the card's primary/alt positions
 * 3. How well the archetype's stat caps can accommodate the card's top 10 attributes
 */
export function scoreArchetypesForCard(card: FutCard): Array<{ archetype: string; score: number }> {
  const profiles = getArchetypeProfiles("FC27");
  const allArch = getAllArchetypes("FC27");
  const cardPlusSet = new Set(card.playstylePlus.map(stripPlus));
  const cardAllSet = new Set([...card.playstylePlus, ...card.playstyles].map(stripPlus));
  const cardPositions = new Set([card.position, ...card.altPositions].map(p => p.toUpperCase()));

  // Top 10 attributes on the FUT card
  const topAttrs = Object.entries(card.attributes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const results: Array<{ archetype: string; score: number }> = [];

  for (const row of profiles) {
    const archName = String(row.Archetype || "").trim();
    if (!archName) continue;
    const normA = normAttr(archName);
    if (normA === "shotstopper" || normA === "sweeperkeeper") continue; // skip GK archetypes

    let score = 0;

    // 1. Signature PlayStyle synergy (up to +45 pts)
    const sigs = String(row.Signature_PlayStyles || "")
      .split(/[\/,]/)
      .map(s => stripPlus(s))
      .filter(Boolean);
    for (const sig of sigs) {
      if (cardPlusSet.has(sig)) score += 25;
      else if (cardAllSet.has(sig)) score += 12;
    }

    // 2. Position compatibility (up to +25 pts)
    const recPos = rolesToPositions(row.Recommended_Positions).map(p => p.toUpperCase());
    if (recPos[0] === card.position.toUpperCase()) score += 25;
    else if (recPos.some(p => cardPositions.has(p))) score += 15;

    // 3. Attribute cap headroom on the card's top 10 stats (up to +30 pts)
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
 * When FUT weight is missing ("Unavailable"), chooses a lighter weight for high Pace/Agility cards
 * and a heavier weight for high Strength/Heading cards.
 */
export function resolveCardPhysicals(card: FutCard, archetype: string): { heightCm: number; weightKg: number } {
  const bounds = ARCH_PHYSICALS[archetype] ?? { minH: 165, maxH: 195, minW: 60, maxW: 92 };
  const heightCm = clamp(card.heightCm ?? Math.round((bounds.minH + bounds.maxH) / 2), bounds.minH, bounds.maxH);

  if (card.weightKg !== null) {
    return { heightCm, weightKg: clamp(card.weightKg, bounds.minW, bounds.maxW) };
  }

  // Fit weight to stats when card weight is unavailable
  const paceAgility = ((card.attributes["Acceleration"] ?? 75) + (card.attributes["Sprint Speed"] ?? 75) + (card.attributes["Agility"] ?? 75)) / 3;
  const strengthDef = ((card.attributes["Strength"] ?? 70) + (card.attributes["Aggression"] ?? 70) + (card.attributes["Heading Accuracy"] ?? 70)) / 3;
  const ratio = clamp(0.5 + (strengthDef - paceAgility) / 80, 0, 1);
  const weightKg = Math.round(bounds.minW + ratio * (bounds.maxW - bounds.minW));
  return { heightCm, weightKg };
}

/**
 * Converts a FUT card into a ClubsDNA ScoutingBlueprint + AttributePriorities
 * so mathEngine27 replicates the card's exact stat shape as closely as possible.
 */
export function buildBlueprintFromCard(card: FutCard, archetype: string): {
  blueprint: ScoutingBlueprint;
  priorities: AttributePriorities;
  physicals: { heightCm: number; weightKg: number };
} {
  const physicals = resolveCardPhysicals(card, archetype);

  // Rank all 29 attributes by their value on the FUT card
  const sortedAttrs = STANDARD_ATTRS
    .map(attr => ({ attr, val: card.attributes[attr] ?? 65 }))
    .sort((a, b) => b.val - a.val);

  const coreAttributes = sortedAttrs.slice(0, 3).map(x => x.attr);
  const secondaryAttributes = sortedAttrs.slice(3, 7).map(x => x.attr);
  const tertiaryAttributes = sortedAttrs.slice(7, 11).map(x => x.attr);

  // Build weighted priorities + soft ceilings matching the card's exact stat curve
  const weights: Record<string, number> = {};
  const max: Record<string, number> = {};
  const exclude: string[] = [];

  for (const { attr, val } of sortedAttrs) {
    if (val >= 88) weights[attr] = 5;
    else if (val >= 82) weights[attr] = 4;
    else if (val >= 76) weights[attr] = 3;
    else if (val >= 70) weights[attr] = 2;
    else if (val >= 62) weights[attr] = 1;
    else exclude.push(attr);

    // Prevent overshooting a stat higher than the FUT card while higher-priority stats still need AP
    max[attr] = Math.min(99, Math.max(55, val));
  }

  const blueprint: ScoutingBlueprint = {
    archetype,
    position: card.position,
    playstylePlus: card.playstylePlus.slice(0, 4),
    playstyles: card.playstyles.map(name => ({ name, requirements: [] })),
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
  engineResult: ReturnType<typeof runMathEngine>;
  playstyles: {
    signatures: string[];
    standard: string[];
    specialisation: string | null;
    specSwapIndex: number;
  };
  recommendedPositions: string[];
  comparison: CardStatComparisonRow[];
  similarityScore: number; // 0-100% how closely the Pro replicates the FUT card
}

export function matchFutCardToPro(params: {
  card: FutCard;
  forcedArchetype?: string | null;
  apBudget: number;
  signatureSlots: number;
  standardSlots: number;
  foundationBoosts: Record<string, number>;
  starsPrepaid?: boolean;
}): CardMatchOutput {
  const scores = scoreArchetypesForCard(params.card);
  const chosenArchetype = params.forcedArchetype || scores[0]?.archetype || "Maestro";

  const { blueprint, priorities, physicals } = buildBlueprintFromCard(params.card, chosenArchetype);

  const engineResult = runMathEngine(
    blueprint,
    params.apBudget,
    params.standardSlots,
    blueprint.coreAttributes,
    params.foundationBoosts,
    {
      starsPrepaid: params.starsPrepaid,
      priorities,
      signatureUpgrades: params.signatureSlots,
    }
  );

  const playstyleFit = buildPlaystyleFit(blueprint);
  const specSwapIndex = blueprint.specialisationPlaystylePlus
    ? pickSpecialisationSwap(chosenArchetype, params.signatureSlots, blueprint.specialisationPlaystylePlus, playstyleFit)
    : -1;

  const resolvedSignatures = resolveSignaturePlaystyles(
    chosenArchetype,
    params.signatureSlots,
    blueprint.specialisationPlaystylePlus,
    specSwapIndex
  );

  const standardPlaystyles = engineResult.equippedPlaystyles?.slice(0, params.standardSlots) ?? [];

  // Compare FUT card stats vs. Pro in-game stats (base + AP + boosts)
  let totalAbsDiff = 0;
  const comparison: CardStatComparisonRow[] = STANDARD_ATTRS.map(attr => {
    const cardValue = params.card.attributes[attr] ?? 70;
    const statRow = engineResult.stats.find(s => normAttr(s.attribute) === normAttr(attr));
    const boost = Object.entries(params.foundationBoosts).find(([k]) => normAttr(k) === normAttr(attr))?.[1] ?? 0;
    const proValue = Math.min(99, (statRow?.final ?? 70) + boost);
    const diff = proValue - cardValue;
    totalAbsDiff += Math.abs(diff);
    return { attribute: attr, cardValue, proValue, diff };
  });

  // 100% = exact match across all 29 stats; every 1-point average gap deducts ~4%
  const avgGap = totalAbsDiff / STANDARD_ATTRS.length;
  const similarityScore = Math.max(0, Math.min(100, Math.round(100 - avgGap * 4)));

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
    playstyles: {
      signatures: resolvedSignatures,
      standard: standardPlaystyles,
      specialisation: null,
      specSwapIndex,
    },
    recommendedPositions,
    comparison,
    similarityScore,
  };
}
