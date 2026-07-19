import { ALL_ARCHETYPES, ARCHETYPE_PROFILES, COST_DICT, PLAYSTYLES } from "./csvLoader";

// ── Attribute category groupings ──────────────────────────────────────────────

export const ATTR_CATEGORIES: Record<string, string[]> = {
  Pace: ["Acceleration", "SprintSpeed"],
  Shooting: ["AttackPositioning", "Finishing", "ShotPower", "LongShots", "Volleys", "Penalties"],
  Passing: ["Vision", "Crossing", "FKAccuracy", "ShortPassing", "LongPassing", "Curve"],
  Dribbling: ["Agility", "Balance", "Reactions", "BallControl", "Dribbling", "Composure"],
  Defending: ["Interceptions", "HeadingAccuracy", "DefAwareness", "StandingTackle", "SlidingTackle"],
  Physicality: ["Jumping", "Stamina", "Strength", "Aggression"],
  "Skill Moves": ["SkillMoves"],
  "Weak Foot": ["WeakFoot"],
};

export interface StatResult {
  attribute: string;
  base: number;
  final: number;
  max: number;
  apSpent: number;
  category: string;
}

export interface MathEngineResult {
  stats: StatResult[];
  totalApSpent: number;
  byCategory: Record<string, StatResult[]>;
}

export interface ScoutingBlueprint {
  archetype: string;
  position?: string;
  playstylePlus: string[];
  playstyles: Array<{ name: string; requirements: Array<{ attr: string; val: number }> }>;
  specialisation?: string;
  specialisationPlaystylePlus?: string;
  specialisationMinAttrs?: Array<{ attr: string; val: number }>;
  coreAttributes: string[];
  secondaryAttributes: string[];
  tertiaryAttributes: string[];
  // 👇 Added to pass the AI ratings from Stage 2
  skillMoves?: number;
  weakFoot?: number;
}

// ── Normalise attribute name to match ALL_ARCHETYPES keys ────────────────────

function normAttr(s: string): string {
  return s.trim().toLowerCase();
}

function matchAttr(attrName: string, availableAttrs: string[]): string | null {
  const norm = normAttr(attrName);
  for (const a of availableAttrs) {
    if (normAttr(a) === norm) return a;
  }
  return null;
}

// ── Get cost to upgrade one point ─────────────────────────────────────────────

function getUpgradeCost(
  archKey: string,
  attrKey: string,
  fromLevel: number
): number {
  const nextLevel = fromLevel + 1;
  return COST_DICT[archKey]?.[attrKey]?.[nextLevel] ?? 999999;
}

// ── Helper: check if position is a defender/CDM ────────────────────────────────

function isDefenderOrCDM(position?: string): boolean {
  if (!position) return false;
  const pos = position.toUpperCase();
  return ["CB", "LB", "RB", "CDM"].includes(pos);
}

// ── Helper: check if position is CB or ST ────────────────────────────────────

function isCBOrST(position?: string): boolean {
  if (!position) return false;
  const pos = position.toUpperCase();
  return ["CB", "ST"].includes(pos);
}

// ── Main math engine ──────────────────────────────────────────────────────────

export function runMathEngine(
  blueprint: ScoutingBlueprint,
  apBudget: number,
  customSlots: number = 0
): MathEngineResult {
  const archKey = blueprint.archetype.toLowerCase();

  // 1. Load base/max values for this archetype
  const archetypeRows = ALL_ARCHETYPES.filter(
    (r) => r.Archetype.trim().toLowerCase() === archKey
  );

  if (archetypeRows.length === 0) {
    throw new Error(`Archetype "${blueprint.archetype}" not found in ALL_ARCHETYPES.csv`);
  }

  // Build stats map: attrName -> { base, max, current, apSpent }
  const stats: Record<string, { base: number; max: number; current: number; apSpent: number }> = {};
  const attrNames: string[] = [];

  for (const row of archetypeRows) {
    const attr = row.Attribute.trim();
    const base = parseInt(row["Base Value"], 10);
    const max = parseInt(row["Max Value"], 10);
    stats[attr] = { base, max, current: base, apSpent: 0 };
    attrNames.push(attr);
  }

  let remainingAP = apBudget;

  // ── Helper: upgrade a single attribute by one point ──────────────────────
  function upgradeOne(attr: string, hardCap?: number): boolean {
    const matched = matchAttr(attr, attrNames);
    if (!matched) return false;
    const s = stats[matched];
    if (!s) return false;
    // Apply hard cap if specified (e.g., 95 for Core/Secondary)
    const maxAllowed = hardCap ?? s.max;
    if (s.current >= maxAllowed || s.current >= s.max) return false;
    const attrKey = normAttr(matched);
    const cost = getUpgradeCost(archKey, attrKey, s.current);
    if (cost > remainingAP) return false;
    s.current += 1;
    s.apSpent += cost;
    remainingAP -= cost;
    return true;
  }

  // ── Helper: upgrade attribute to a target minimum ────────────────────────
  function upgradeToMin(attr: string, target: number, hardCap?: number): void {
    const matched = matchAttr(attr, attrNames);
    if (!matched) return;
    const s = stats[matched];
    if (!s) return;
    const maxAllowed = hardCap ?? s.max;
    const actualTarget = Math.min(target, maxAllowed);
    while (s.current < actualTarget && remainingAP > 0) {
      const attrKey = normAttr(matched);
      const cost = getUpgradeCost(archKey, attrKey, s.current);
      if (cost > remainingAP) break;
      s.current += 1;
      s.apSpent += cost;
      remainingAP -= cost;
    }
  }

  // ── RULE 3: Aerial Bundle ────────────────────────────────────────────────
  // If position is CB or ST, force Reactions, Composure, Jumping, Strength into Core/Secondary
  if (isCBOrST(blueprint.position)) {
    const aerialAttrs = ["Reactions", "Composure", "Jumping", "Strength"];
    for (const attr of aerialAttrs) {
      // Ensure it's in core or secondary (move from tertiary if needed)
      const inCore = blueprint.coreAttributes.some((a) => normAttr(a) === normAttr(attr));
      const inSecondary = blueprint.secondaryAttributes.some((a) => normAttr(a) === normAttr(attr));
      if (!inCore && !inSecondary) {
        // Remove from tertiary and add to secondary
        blueprint.secondaryAttributes.push(attr);
        blueprint.tertiaryAttributes = blueprint.tertiaryAttributes.filter(
          (a) => normAttr(a) !== normAttr(attr)
        );
      }
    }
  }

  // ── EA RULE: Custom Slots & CSV Lookup ───────────────────────────────────
  const activePlaystyles = blueprint.playstyles.slice(0, customSlots);
  
  for (const ps of activePlaystyles) {
    const realReqs = PLAYSTYLES.find((p) => p.Playstyle.toLowerCase() === ps.name.toLowerCase());
    
    if (realReqs) {
      if (realReqs.Attr1 && realReqs.Val1) upgradeToMin(realReqs.Attr1, parseInt(realReqs.Val1, 10));
      if (realReqs.Attr2 && realReqs.Val2) upgradeToMin(realReqs.Attr2, parseInt(realReqs.Val2, 10));
      if (realReqs.Attr3 && realReqs.Val3) upgradeToMin(realReqs.Attr3, parseInt(realReqs.Val3, 10));
    }
  }

  // 3. Upgrade Specialisation minimums
  if (blueprint.specialisationMinAttrs) {
    for (const req of blueprint.specialisationMinAttrs) {
      upgradeToMin(req.attr, req.val);
    }
  }

  // 4. Upgrade SkillMoves and WeakFoot to target (respect blueprint targets or fallback to 5)
  const targetSkillMoves = blueprint.skillMoves ?? 5;
  const targetWeakFoot = blueprint.weakFoot ?? 5;
  upgradeToMin("SkillMoves", targetSkillMoves);
  upgradeToMin("WeakFoot", targetWeakFoot);

  // ── RULE 2: Animation Lock ───────────────────────────────────────────────
  // If position is Defender/CDM, force StandingTackle to exactly 85 before Core loops
  if (isDefenderOrCDM(blueprint.position)) {
    upgradeToMin("StandingTackle", 85);
  }

  // ── RULE 1: 95 Hard Cap ──────────────────────────────────────────────────
  function upgradeGroupLowestFirstWithCap(attrs: string[], hardCap: number): void {
    let progress = true;
    while (progress && remainingAP > 0) {
      progress = false;
      const candidates = attrs
        .map((a) => ({ attr: a, matched: matchAttr(a, attrNames) }))
        .filter(({ matched }) => matched !== null)
        .map(({ attr, matched }) => ({
          attr,
          matched: matched!,
          current: stats[matched!]?.current ?? 0,
          max: stats[matched!]?.max ?? 0,
        }))
        .filter(({ current }) => current < hardCap) // Apply hard cap
        .sort((a, b) => a.current - b.current);

      for (const { matched } of candidates) {
        if (upgradeOne(matched, hardCap)) {
          progress = true;
          break; // restart loop to re-sort
        }
      }
    }
  }

  // 5. Core attributes with 95 hard cap
  upgradeGroupLowestFirstWithCap(blueprint.coreAttributes, 95);

  // 6. Secondary attributes with 95 hard cap
  upgradeGroupLowestFirstWithCap(blueprint.secondaryAttributes, 95);

  // 7. Tertiary — cheapest first until budget is exactly 0
  if (remainingAP > 0) {
    const tertiarySet = new Set(blueprint.tertiaryAttributes.map((a) => normAttr(a)));

    let progress = true;
    while (progress && remainingAP > 0) {
      progress = false;
      const options: Array<{ matched: string; cost: number }> = [];
      for (const matched of attrNames) {
        const s = stats[matched];
        if (!s || s.current >= s.max) continue;
        if (!tertiarySet.has(normAttr(matched))) continue;
        const attrKey = normAttr(matched);
        const cost = getUpgradeCost(archKey, attrKey, s.current);
        if (cost <= remainingAP) {
          options.push({ matched, cost });
        }
      }
      options.sort((a, b) => a.cost - b.cost);
      if (options.length > 0) {
        const { matched } = options[0];
        upgradeOne(matched);
        progress = true;
      }
    }
  }

  // 8. Build result
  const getCategoryForAttr = (attr: string): string => {
    const norm = normAttr(attr);
    for (const [cat, attrs] of Object.entries(ATTR_CATEGORIES)) {
      if (attrs.some((a) => normAttr(a) === norm)) return cat;
    }
    return "Other";
  };

  const statResults: StatResult[] = attrNames.map((attr) => {
    const s = stats[attr];
    return {
      attribute: attr,
      base: s.base,
      final: s.current,
      max: s.max,
      apSpent: s.apSpent,
      category: getCategoryForAttr(attr),
    };
  });

  const byCategory: Record<string, StatResult[]> = {};
  for (const stat of statResults) {
    if (!byCategory[stat.category]) {
      byCategory[stat.category] = [];
    }
    byCategory[stat.category].push(stat);
  }

  const totalApSpent = statResults.reduce((sum, s) => sum + s.apSpent, 0);

  return {
    stats: statResults,
    totalApSpent,
    byCategory,
  };
}

// ── EA FC 26 Signature PlayStyle Resolver ────────────────────────────────────
export function resolveSignaturePlaystyles(
  archetypeName: string,
  signatureUpgrades: number,
  specialisationBonusPlus?: string
): string[] {
  const arch = ARCHETYPE_PROFILES.find((a) => a.Archetype.toLowerCase() === archetypeName.toLowerCase());
  if (!arch) return [];

  const baseSignatures = arch.Signature_PlayStyles.split(",").map((s) => s.trim());

  const upgradedSignatures = baseSignatures.map((ps, index) => {
    return index < signatureUpgrades ? `${ps}+` : ps;
  });

  if (specialisationBonusPlus) {
    const formattedBonus = specialisationBonusPlus.includes('+') ? specialisationBonusPlus : `${specialisationBonusPlus}+`;
    upgradedSignatures[3] = formattedBonus;
  }

  return upgradedSignatures.slice(0, 4);
}
