import { ALL_ARCHETYPES, ARCHETYPE_PROFILES, COST_DICT, PLAYSTYLES } from "./csvLoader";

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
  skillMoves?: number;
  weakFoot?: number;
}

function normAttr(s: string): string { return s.trim().toLowerCase(); }

function matchAttr(attrName: string, availableAttrs: string[]): string | null {
  const norm = normAttr(attrName);
  for (const a of availableAttrs) { if (normAttr(a) === norm) return a; }
  return null;
}

function getUpgradeCost(archKey: string, attrKey: string, fromLevel: number): number {
  return COST_DICT[archKey]?.[attrKey]?.[fromLevel + 1] ?? 999999;
}

export function runMathEngine(blueprint: ScoutingBlueprint, apBudget: number, customSlots: number = 0): MathEngineResult {
  const archKey = blueprint.archetype.toLowerCase();
  const archetypeRows = ALL_ARCHETYPES.filter((r) => r.Archetype.trim().toLowerCase() === archKey);

  if (archetypeRows.length === 0) throw new Error(`Archetype "${blueprint.archetype}" not found.`);

  const stats: Record<string, { base: number; max: number; current: number; apSpent: number }> = {};
  const attrNames: string[] = [];

  for (const row of archetypeRows) {
    const attr = row.Attribute.trim();
    stats[attr] = { base: parseInt(row["Base Value"], 10), max: parseInt(row["Max Value"], 10), current: parseInt(row["Base Value"], 10), apSpent: 0 };
    attrNames.push(attr);
  }

  let remainingAP = apBudget;

  function upgradeOne(attr: string, hardCap: number = 99): boolean {
    const matched = matchAttr(attr, attrNames);
    if (!matched) return false;
    const s = stats[matched];
    if (s.current >= Math.min(s.max, hardCap)) return false;
    const cost = getUpgradeCost(archKey, normAttr(matched), s.current);
    if (cost > remainingAP) return false;
    s.current += 1; s.apSpent += cost; remainingAP -= cost;
    return true;
  }

  function upgradeToMin(attr: string, target: number): void {
    const matched = matchAttr(attr, attrNames);
    if (!matched) return;
    while (stats[matched].current < target && remainingAP > 0) {
      if (!upgradeOne(matched, 99)) break;
    }
  }

  // 1. Initial Tax
  const activePlaystyles = blueprint.playstyles.slice(0, customSlots);
  for (const ps of activePlaystyles) {
    const realReqs = PLAYSTYLES.find((p) => p.Playstyle.toLowerCase() === ps.name.toLowerCase());
    if (realReqs) {
      if (realReqs.Attr1 && realReqs.Val1) upgradeToMin(realReqs.Attr1, parseInt(realReqs.Val1, 10));
      if (realReqs.Attr2 && realReqs.Val2) upgradeToMin(realReqs.Attr2, parseInt(realReqs.Val2, 10));
      if (realReqs.Attr3 && realReqs.Val3) upgradeToMin(realReqs.Attr3, parseInt(realReqs.Val3, 10));
    }
  }
  if (blueprint.specialisationMinAttrs) blueprint.specialisationMinAttrs.forEach(req => upgradeToMin(req.attr, req.val));
  upgradeToMin("SkillMoves", blueprint.skillMoves ?? 5);
  upgradeToMin("WeakFoot", blueprint.weakFoot ?? 5);

  // 2. The 55/30/15 Bucket Logic
  const postTaxAP = remainingAP;
  const primaryBudget = postTaxAP * 0.55;
  const secondaryBudget = postTaxAP * 0.30;
  
  function fillBucket(attrs: string[], budgetLimit: number, hardCap: number) {
    let bucketSpent = 0;
    let progress = true;
    while (progress && bucketSpent < budgetLimit) {
      progress = false;
      
      const candidates = attrs
        .map(a => matchAttr(a, attrNames))
        .filter(m => m !== null && stats[m!].current < Math.min(hardCap, stats[m!].max))
        .sort((a, b) => stats[a!].current - stats[b!].current);
      
      for (const matched of candidates) {
        const cost = getUpgradeCost(archKey, normAttr(matched!), stats[matched!].current);
        if (bucketSpent + cost <= budgetLimit && remainingAP >= cost) {
          const success = upgradeOne(matched!, hardCap);
          if (success) {
            bucketSpent += cost;
            progress = true;
            break;
          }
        }
      }
    }
  }

  // 👉 UPDATED CAPS: Let the strengths drain the AP budget!
  fillBucket(blueprint.coreAttributes, primaryBudget, 99);
  fillBucket(blueprint.secondaryAttributes, secondaryBudget, 95);
  fillBucket(blueprint.tertiaryAttributes, remainingAP, 90); 

  // 3. Efficiency Pass
  let progress = true;
  while (progress && remainingAP > 0) {
    progress = false;
    
    // 👉 NERFED LEFTOVER CAP: Weaknesses now stop at 75
    const allAttrNames = attrNames.filter(a => stats[a].current < 75 && stats[a].current < stats[a].max);
    
    const options = allAttrNames
      .map(matched => ({ matched, cost: getUpgradeCost(archKey, normAttr(matched), stats[matched].current) }))
      .filter(o => o.cost <= remainingAP)
      .sort((a, b) => a.cost - b.cost);

    if (options.length > 0) {
      const success = upgradeOne(options[0].matched, 75);
      if (success) {
        progress = true;
      }
    }
  }

  const statResults: StatResult[] = attrNames.map((attr) => {
    const s = stats[attr];
    const cat = Object.entries(ATTR_CATEGORIES).find(([_, list]) => list.some(a => normAttr(a) === normAttr(attr)))?.[0] ?? "Other";
    return { attribute: attr, base: s.base, final: s.current, max: s.max, apSpent: s.apSpent, category: cat };
  });

  return {
    stats: statResults,
    totalApSpent: statResults.reduce((sum, s) => sum + s.apSpent, 0),
    byCategory: statResults.reduce((acc, stat) => {
      acc[stat.category] = acc[stat.category] || [];
      acc[stat.category].push(stat);
      return acc;
    }, {} as Record<string, StatResult[]>)
  };
}

export function resolveSignaturePlaystyles(archetypeName: string, signatureUpgrades: number, specialisationBonusPlus?: string): string[] {
  const arch = ARCHETYPE_PROFILES.find((a) => a.Archetype.toLowerCase() === archetypeName.toLowerCase());
  if (!arch) return [];
  const baseSignatures = arch.Signature_PlayStyles.split(",").map((s) => s.trim());
  const upgradedSignatures = baseSignatures.map((ps, index) => index < signatureUpgrades ? `${ps}+` : ps);
  if (specialisationBonusPlus) upgradedSignatures[3] = specialisationBonusPlus.includes('+') ? specialisationBonusPlus : `${specialisationBonusPlus}+`;
  return upgradedSignatures.slice(0, 4);
}
