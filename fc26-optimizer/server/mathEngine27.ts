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

// 👉 FIX: The exact UI keys the client expects to render AP badges
export const STANDARD_ATTRS = [
  "Acceleration", "Sprint Speed", "Attack Positioning", "Finishing", "Shot Power",
  "Long Shots", "Volleys", "Penalties", "Vision", "Crossing", "FK Accuracy",
  "Short Passing", "Long Passing", "Curve", "Agility", "Balance", "Reactions",
  "Ball Control", "Dribbling", "Composure", "Interceptions", "Heading Accuracy",
  "Def Awareness", "Standing Tackle", "Sliding Tackle", "Jumping", "Stamina",
  "Strength", "Aggression"
];

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

function normAttr(s: string): string { 
  let n = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); 
  if (n.startsWith('att') && n.includes('pos')) return 'attackpositioning';
  if (n.includes('fk') && n.includes('acc')) return 'fkaccuracy';
  if (n.startsWith('def') && n.includes('awar')) return 'defawareness';
  if (n.includes('stand') && n.includes('tack')) return 'standingtackle';
  if (n.includes('slid') && n.includes('tack')) return 'slidingtackle';
  if (n.startsWith('short') && n.includes('pass')) return 'shortpassing';
  if (n.startsWith('long') && n.includes('pass')) return 'longpassing';
  if (n.includes('head') && n.includes('acc')) return 'headingaccuracy';
  if (n.includes('sprint')) return 'sprintspeed';
  return n;
}

function matchAttr(attrName: string, availableAttrs: string[]): string | null {
  const norm = normAttr(attrName);
  for (const a of availableAttrs) { if (normAttr(a) === norm) return a; }
  return null;
}

function getUpgradeCost(archKeyLower: string, attrKeyNorm: string, fromLevel: number): number {
  return COST_DICT[archKeyLower]?.[attrKeyNorm]?.[fromLevel + 1] ?? 999999;
}

export function runMathEngine(
  blueprint: ScoutingBlueprint, 
  apBudget: number, 
  customSlots: number = 0,
  preferredAttributes: string[] = [], 
  foundationBoosts: Record<string, number> = {} 
): MathEngineResult {
  const archKey = blueprint.archetype;
  const archKeyLower = archKey.toLowerCase();
  
  const archetypeRows = ALL_ARCHETYPES.filter((r) => normAttr(r.Archetype) === normAttr(archKey));

  if (archetypeRows.length === 0) throw new Error(`Archetype "${blueprint.archetype}" not found.`);

  const stats: Record<string, { base: number; max: number; current: number; apSpent: number }> = {};
  const attrNames: string[] = [];

  for (const row of archetypeRows) {
    const attr = row.Attribute.trim();
    stats[attr] = { base: parseInt(row["Base Value"], 10), max: parseInt(row["Max Value"], 10), current: parseInt(row["Base Value"], 10), apSpent: 0 };
    attrNames.push(attr);
  }

  let remainingAP = apBudget;

  const normalizedBoosts: Record<string, number> = {};
  for (const [key, val] of Object.entries(foundationBoosts)) {
    normalizedBoosts[normAttr(key)] = val;
  }

  function getHardCap(attrName: string, defaultCap: number): number {
    const isPreferred = preferredAttributes.some(p => normAttr(p) === normAttr(attrName));
    return isPreferred ? 99 : defaultCap;
  }
  
  function getEffectiveCap(attrName: string, absoluteCap: number): number {
    const boost = normalizedBoosts[normAttr(attrName)] || 0;
    return Math.max(0, absoluteCap - boost);
  }

  function upgradeOne(attr: string, hardCap: number = 99): boolean {
    const matched = matchAttr(attr, attrNames);
    if (!matched) return false;
    const s = stats[matched];
    if (s.current >= Math.min(s.max, hardCap)) return false;
    
    const cost = getUpgradeCost(archKeyLower, normAttr(matched), s.current);
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
    const realReqs = PLAYSTYLES.find((p) => normAttr(p.Playstyle) === normAttr(ps.name));
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
        const cost = getUpgradeCost(archKeyLower, normAttr(matched!), stats[matched!].current);
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
        const cost = getUpgradeCost(archKeyLower, normAttr(matched!), stats[matched!].current);
        
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

  // 3. FULL AP UTILIZATION SPILLOVER (Aggressively loops until AP hits 0)
  let progressRoundRobin = true;
  const spilloverPool: { attr: string; cap: number }[] = [];
  
  const sortedAttrs = [...attrNames].sort((a, b) => {
    const costA = getUpgradeCost(archKeyLower, normAttr(a), stats[a].current);
    const costB = getUpgradeCost(archKeyLower, normAttr(b), stats[b].current);
    return costA - costB;
  });

  sortedAttrs.forEach(a => {
    spilloverPool.push({ attr: a, cap: 99 });
  });

  while (progressRoundRobin && remainingAP > 0) {
    progressRoundRobin = false;
    for (const c of spilloverPool) {
       if (remainingAP <= 0) break;
       
       const s = stats[c.attr];
       if (!s) continue;
       
       const effectiveCap = getEffectiveCap(c.attr, c.cap);
       const cost = getUpgradeCost(archKeyLower, normAttr(c.attr), s.current);
       
       if (cost <= remainingAP && s.current < Math.min(effectiveCap, s.max)) {
          const success = upgradeOne(c.attr, effectiveCap);
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
      // 👉 FIX: Map the internal engine key back to the UI's exact expected spacing!
      const uiFriendlyName = STANDARD_ATTRS.find(std => normAttr(std) === normAttr(attr)) || attr;
      investedPoints[uiFriendlyName] = s.current - s.base;
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
  const arch = ARCHETYPE_PROFILES.find((a) => normAttr(a.Archetype) === normAttr(archetypeName));
  if (!arch) return [];
  const baseSignatures = arch.Signature_PlayStyles.split(",").map((s) => s.trim());
  const upgradedSignatures = baseSignatures.map((ps, index) => index < signatureUpgrades ? `${ps}+` : ps);
  if (specialisationBonusPlus) upgradedSignatures[3] = specialisationBonusPlus.includes('+') ? specialisationBonusPlus : `${specialisationBonusPlus}+`;
  return upgradedSignatures.slice(0, 4);
}
