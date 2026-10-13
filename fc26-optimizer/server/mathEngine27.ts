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

export const MASTERIES_MAP: Record<string, string[]> = {
  "Shot Stopper": ["GKPositioning", "GKReflexes"],
  "Sweeper Keeper": ["GKHandling", "GKDiving"],
  "Progressor": ["LongPassing", "StandingTackle"],
  "Boss": ["Aggression", "Strength"],
  "Marauder": ["SlidingTackle", "SprintSpeed"],
  "Disruptor": ["Stamina", "Interceptions"],
  "Recycler": ["DefAwareness", "ShortPassing"],
  "Maestro": ["Reactions", "BallControl"],
  "Creator": ["FKAccuracy", "Vision"],
  "Spark": ["Crossing", "Dribbling"],
  "Magician": ["Curve", "Acceleration"],
  "Finisher": ["Composure", "Finishing"],
  "Target": ["Balance", "Jumping"],
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
  investedPoints: Record<string, number>;
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

function normAttr(s: string): string { return s.replace(/\s+/g, '').toLowerCase(); }

function matchAttr(attrName: string, availableAttrs: string[]): string | null {
  const norm = normAttr(attrName);
  for (const a of availableAttrs) { if (normAttr(a) === norm) return a; }
  return null;
}

function getUpgradeCost(archKey: string, attrKey: string, fromLevel: number): number {
  return COST_DICT[archKey]?.[attrKey]?.[fromLevel + 1] ?? 999999;
}

export function runMathEngine(
  blueprint: ScoutingBlueprint, 
  apBudget: number, 
  customSlots: number = 0,
  preferredAttributes: string[] = [], 
  foundationBoosts: Record<string, number> = {} // 👉 NEW: Receives aggregated boosts from client
): MathEngineResult {
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

  function getHardCap(attrName: string, defaultCap: number): number {
    const isPreferred = preferredAttributes.some(p => normAttr(p) === normAttr(attrName));
    return isPreferred ? 99 : defaultCap;
  }
  
  // 👉 NEW: Calculates net target after deducting free foundation boosts
  function getEffectiveCap(attrName: string, absoluteCap: number): number {
    const boost = foundationBoosts[normAttr(attrName)] || 0;
    return Math.max(0, absoluteCap - boost);
  }

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

  function upgradeToMin(attr: string, absoluteTarget: number): void {
    const matched = matchAttr(attr, attrNames);
    if (!matched) return;
    const effectiveTarget = getEffectiveCap(matched, absoluteTarget);
    while (stats[matched].current < effectiveTarget && remainingAP > 0) {
      if (!upgradeOne(matched, 99)) break;
    }
  }

  // 1. Initial Tax (Playstyles & Skill Moves)
  const activePlaystyles = blueprint.playstyles.slice(0, customSlots);
  for (const ps of activePlaystyles) {
    const realReqs = PLAYSTYLES.find((p) => p.Playstyle.toLowerCase() === ps.name.toLowerCase());
    if (realReqs) {
      if (realReqs.Attr1 && realReqs.Val1) upgradeToMin(realReqs.Attr1, parseInt(realReqs.Val1, 10));
      if (realReqs.Attr2 && realReqs.Val2) upgradeToMin(realReqs.Attr2, parseInt(realReqs.Val2, 10));
      if (realReqs.Attr3 && realReqs.Val3) upgradeToMin(realReqs.Attr3, parseInt(realReqs.Val3, 10));
    }
  }
  
  if (blueprint.specialisationMinAttrs) {
    blueprint.specialisationMinAttrs.forEach(req => upgradeToMin(req.attr, req.val));
  }
  
  upgradeToMin("SkillMoves", blueprint.skillMoves ?? 5);
  upgradeToMin("WeakFoot", blueprint.weakFoot ?? 5);

  // 1.5 Focus Attributes VIP Pass
  if (preferredAttributes.length > 0) {
    const focusBudget = remainingAP * 0.25;
    let focusSpent = 0;
    let focusProgress = true;
    
    while (focusProgress && focusSpent < focusBudget) {
      focusProgress = false;
      
      const candidates = preferredAttributes
        .map(a => matchAttr(a, attrNames))
        .filter(m => m !== null && stats[m!].current < Math.min(getEffectiveCap(m!, 99), stats[m!].max))
        .sort((a, b) => stats[a!].current - stats[b!].current);
        
      for (const matched of candidates) {
        const cost = getUpgradeCost(archKey, normAttr(matched!), stats[matched!].current);
        if (focusSpent + cost <= focusBudget && remainingAP >= cost) {
          const success = upgradeOne(matched!, getEffectiveCap(matched!, 99));
          if (success) {
            focusSpent += cost;
            focusProgress = true;
            break;
          }
        }
      }
    }
  }

  // 2. The 55/30/15 Bucket Logic
  const postTaxAP = remainingAP;
  const primaryBudget = postTaxAP * 0.55;
  const secondaryBudget = postTaxAP * 0.30;
  
  function fillBucket(attrs: string[], budgetLimit: number, baseHardCap: number) {
    let bucketSpent = 0;
    let progress = true;
    while (progress && bucketSpent < budgetLimit) {
      progress = false;
      
      const candidates = attrs
        .map(a => matchAttr(a, attrNames))
        .filter(m => {
          if (!m) return false;
          const dynamicCap = getHardCap(m, baseHardCap);
          const effectiveCap = getEffectiveCap(m, dynamicCap);
          return stats[m].current < Math.min(effectiveCap, stats[m].max);
        })
        .sort((a, b) => stats[a!].current - stats[b!].current);
      
      for (const matched of candidates) {
        const dynamicCap = getHardCap(matched!, baseHardCap);
        const effectiveCap = getEffectiveCap(matched!, dynamicCap);
        const cost = getUpgradeCost(archKey, normAttr(matched!), stats[matched!].current);
        
        if (bucketSpent + cost <= budgetLimit && remainingAP >= cost) {
          const success = upgradeOne(matched!, effectiveCap);
          if (success) {
            bucketSpent += cost;
            progress = true;
            break;
          }
        }
      }
    }
  }

  fillBucket(blueprint.coreAttributes, primaryBudget, 95);
  fillBucket(blueprint.secondaryAttributes, secondaryBudget, 90);
  fillBucket(blueprint.tertiaryAttributes, remainingAP, 85); 

  // 3. 👉 NEW: Greedy Round-Robin Residual AP Spending
  // Cycles through all attributes to consume 100% of remaining AP, focusing heavily on secondary traits
  let progressRoundRobin = true;
  while (progressRoundRobin && remainingAP > 0) {
    progressRoundRobin = false;
    
    const roundRobinPool = [
      ...preferredAttributes.map(a => ({ attr: a, cap: 99 })), 
      ...blueprint.secondaryAttributes.map(a => ({ attr: a, cap: getHardCap(a, 99) })),
      ...blueprint.coreAttributes.map(a => ({ attr: a, cap: getHardCap(a, 99) })),
      ...blueprint.tertiaryAttributes.map(a => ({ attr: a, cap: getHardCap(a, 99) }))
    ];

    for (const c of roundRobinPool) {
       if (remainingAP <= 0) break;
       const matched = matchAttr(c.attr, attrNames);
       if (!matched) continue;
       
       const effectiveCap = getEffectiveCap(matched, c.cap);
       const cost = getUpgradeCost(archKey, normAttr(matched), stats[matched].current);
       
       if (cost <= remainingAP && stats[matched].current < Math.min(effectiveCap, stats[matched].max)) {
          const success = upgradeOne(matched, effectiveCap);
          if (success) progressRoundRobin = true;
       }
    }
  }

  const statResults: StatResult[] = attrNames.map((attr) => {
    const s = stats[attr];
    const cat = Object.entries(ATTR_CATEGORIES).find(([_, list]) => list.some(a => normAttr(a) === normAttr(attr)))?.[0] ?? "Other";
    return { attribute: attr, base: s.base, final: s.current, max: s.max, apSpent: s.apSpent, category: cat };
  });

  const investedPoints: Record<string, number> = {};
  attrNames.forEach(attr => {
    const s = stats[attr];
    if (s.current > s.base) {
      investedPoints[attr] = s.current - s.base;
    }
  });

  return {
    stats: statResults,
    totalApSpent: statResults.reduce((sum, s) => sum + s.apSpent, 0),
    byCategory: statResults.reduce((acc, stat) => {
      acc[stat.category] = acc[stat.category] || [];
      acc[stat.category].push(stat);
      return acc;
    }, {} as Record<string, StatResult[]>),
    investedPoints
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
