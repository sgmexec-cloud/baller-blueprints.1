import { 
  getAllArchetypes, 
  getCostDict, 
  getPlaystyles, 
  getArchetypeProfiles 
} from "./csvLoader";

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

export const STANDARD_ATTRS = [
  "Acceleration", "Sprint Speed", "Attack Positioning", "Finishing", "Shot Power",
  "Long Shots", "Volleys", "Penalties", "Vision", "Crossing", "FK Accuracy",
  "Short Passing", "Long Passing", "Curve", "Agility", "Balance", "Reactions",
  "Ball Control", "Dribbling", "Composure", "Interceptions", "Heading Accuracy",
  "Def Awareness", "Standing Tackle", "Sliding Tackle", "Jumping", "Stamina",
  "Strength", "Aggression"
];

// Skill Moves / Weak Foot are paid for separately (stars-first) and are never part of the attribute pool
const STAR_KEYS = new Set(['skillmoves', 'weakfoot']);

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
  equippedPlaystyles?: string[];
  skippedPlaystyles?: string[];
  /** Star levels after the engine's own purchase (equal to the archetype minimum when starsPrepaid is true) */
  skillMovesLevel?: number;
  weakFootLevel?: number;
  /** AP the engine itself spent on Skill Moves / Weak Foot (0 when starsPrepaid is true) */
  starApSpent?: number;
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

function getUpgradeCost(costDict: any, archKey: string, attrKey: string, rawBase: number, currentPointsAdded: number): number {
  const dictArchKey = Object.keys(costDict).find(k => normAttr(k) === normAttr(archKey));
  if (!dictArchKey) return 999999;
  
  const archDict = costDict[dictArchKey];
  const dictAttrKey = Object.keys(archDict).find(k => normAttr(k) === normAttr(attrKey));
  if (!dictAttrKey) return 999999;

  const nextLevel = rawBase + currentPointsAdded + 1;
  return archDict[dictAttrKey]?.[nextLevel] ?? 999999;
}

export function runMathEngine(
  blueprint: ScoutingBlueprint, 
  apBudget: number, 
  customSlots: number = blueprint.playstyles.length,
  preferredAttributes: string[] = [], 
  foundationBoosts: Record<string, number> = {},
  options: { starsPrepaid?: boolean } = {}
): MathEngineResult {
  const ALL_ARCHETYPES = getAllArchetypes("FC27");
  const COST_DICT = getCostDict("FC27");
  const PLAYSTYLES = getPlaystyles("FC27");

  const archKey = blueprint.archetype;
  const archetypeRows = ALL_ARCHETYPES.filter((r: any) => normAttr(r.Archetype) === normAttr(archKey));

  if (archetypeRows.length === 0) throw new Error(`Archetype "${blueprint.archetype}" not found.`);

  const stats: Record<string, { base: number; max: number; current: number; pointsAdded: number; apSpent: number }> = {};
  const attrNames: string[] = [];   // real attributes only (the pool used for allocation)
  const starNames: string[] = [];   // Skill Moves / Weak Foot

  for (const row of archetypeRows) {
    const attr = row.Attribute.trim();
    const b = parseInt(row["Base Value"], 10);
    const baseVal = Number.isNaN(b) ? 70 : b;
    const m = parseInt(row["Max Value"], 10);
    const maxVal = Number.isNaN(m) ? 99 : m;
    
    stats[attr] = { base: baseVal, max: maxVal, current: baseVal, pointsAdded: 0, apSpent: 0 };
    if (STAR_KEYS.has(normAttr(attr))) starNames.push(attr);
    else attrNames.push(attr);
  }
  const allNames = [...attrNames, ...starNames];

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
    const matched = matchAttr(attr, allNames);
    if (!matched) return false;
    const s = stats[matched];
    
    if (s.current >= Math.min(s.max, hardCap)) return false;
    
    const cost = getUpgradeCost(COST_DICT, archKey, matched, s.base, s.pointsAdded);
    if (cost > remainingAP) return false;
    
    s.current += 1;
    s.pointsAdded += 1;
    s.apSpent += cost;
    remainingAP -= cost;
    return true;
  }

  function upgradeToMin(attr: string, absoluteTarget: number): void {
    const matched = matchAttr(attr, allNames);
    if (!matched) return;
    const effectiveTarget = getEffectiveCap(matched, absoluteTarget);
    while (stats[matched].current < effectiveTarget && remainingAP > 0) {
      if (!upgradeOne(matched, 99)) break;
    }
  }

  function costToReach(attr: string, target: number): number {
    const m = matchAttr(attr, allNames);
    if (!m) return Infinity;
    const s = stats[m];
    const t = getEffectiveCap(m, target);
    if (t > s.max) return Infinity;
    
    let total = 0;
    for (let lvl = s.current; lvl < t; lvl++) {
      const c = getUpgradeCost(COST_DICT, archKey, m, s.base, lvl - s.base);
      if (c >= 999999) return Infinity;
      total += c;
    }
    return total;
  }

  function findPlaystyle(name: string) {
    const n = name.trim().toLowerCase();
    return PLAYSTYLES.find((p: any) => p.Playstyle?.trim().toLowerCase() === n)
        ?? PLAYSTYLES.find((p: any) => normAttr(p.Playstyle || "") === normAttr(name));
  }

  // ---- STARS FIRST ----
  // Skill Moves / Weak Foot are paid for BEFORE any attribute allocation (playstyle requirements,
  // specialisation, focus attributes and the 55/30/15 buckets), so attributes can never use up the AP
  // the stars need. If the caller already deducted the star cost from apBudget (starsPrepaid), skip it here.
  const apBeforeStars = remainingAP;
  if (!options.starsPrepaid) {
    if (blueprint.skillMoves !== undefined) upgradeToMin("SkillMoves", blueprint.skillMoves);
    if (blueprint.weakFoot !== undefined) upgradeToMin("WeakFoot", blueprint.weakFoot);
  }
  const starApSpent = apBeforeStars - remainingAP;

  const equippedPlaystyles: string[] = [];
  const skippedPlaystyles: string[] = [];
  const activePlaystyles = blueprint.playstyles.slice(0, customSlots);
  
  for (const ps of activePlaystyles) {
    const def = findPlaystyle(ps.name);
    if (!def) { 
      skippedPlaystyles.push(ps.name); 
      continue; 
    }
    
    const reqs = [[def.Req_Attr1 || def.Attr1, def.Req_Val1 || def.Val1], 
                  [def.Req_Attr2 || def.Attr2, def.Req_Val2 || def.Val2], 
                  [def.Req_Attr3 || def.Attr3, def.Req_Val3 || def.Val3]]
      .filter(([a, v]) => a && v)
      .map(([a, v]) => ({ attr: a as string, val: parseInt(v as string, 10) }));
      
    const totalCost = reqs.reduce((sum, r) => sum + costToReach(r.attr, r.val), 0);
    
    if (totalCost <= remainingAP) {
      reqs.forEach(r => upgradeToMin(r.attr, r.val));
      equippedPlaystyles.push(ps.name);
    } else {
      skippedPlaystyles.push(ps.name);
    }
  }

  if (blueprint.specialisationMinAttrs) {
    const totalSpecCost = blueprint.specialisationMinAttrs.reduce((sum, r) => sum + costToReach(r.attr, r.val), 0);
    if (totalSpecCost <= remainingAP) {
       blueprint.specialisationMinAttrs.forEach(req => upgradeToMin(req.attr, req.val));
    }
  }
  

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
        const cost = getUpgradeCost(COST_DICT, archKey, matched!, stats[matched!].base, stats[matched!].pointsAdded);
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
        const cost = getUpgradeCost(COST_DICT, archKey, matched!, stats[matched!].base, stats[matched!].pointsAdded);
        
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

  let progressRoundRobin = true;
  const spilloverPool: { attr: string; cap: number }[] = [];
  
  const sortedAttrs = [...attrNames].sort((a, b) => {
    const costA = getUpgradeCost(COST_DICT, archKey, a, stats[a].base, stats[a].pointsAdded);
    const costB = getUpgradeCost(COST_DICT, archKey, b, stats[b].base, stats[b].pointsAdded);
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
       const cost = getUpgradeCost(COST_DICT, archKey, c.attr, s.base, s.pointsAdded);
       
       if (cost <= remainingAP && s.current < Math.min(effectiveCap, s.max)) {
          const success = upgradeOne(c.attr, effectiveCap);
          if (success) progressRoundRobin = true;
       }
    }
  }

  let microProgress = true;
  while (microProgress && remainingAP > 0) {
    microProgress = false;
    let cheapestAttr: string | null = null;
    let lowestCost = Infinity;

    for (const attr of attrNames) {
      const s = stats[attr];
      if (s.current >= s.max) continue;
      
      const cost = getUpgradeCost(COST_DICT, archKey, attr, s.base, s.pointsAdded);
      if (cost <= remainingAP && cost < lowestCost) {
        lowestCost = cost;
        cheapestAttr = attr;
      }
    }

    if (cheapestAttr) {
      const effectiveCap = getEffectiveCap(cheapestAttr, 99);
      const success = upgradeOne(cheapestAttr, effectiveCap);
      if (success) microProgress = true;
    }
  }
  
  if (remainingAP > 0) {
     const blocked = attrNames
       .filter(a => stats[a].current < stats[a].max)
       .map(a => `${a}@${stats[a].current}: ${getUpgradeCost(COST_DICT, archKey, a, stats[a].base, stats[a].pointsAdded)}`);
     console.warn(`Unspent AP: ${remainingAP}`, blocked);
  }

  const statResults: StatResult[] = attrNames.map((attr) => {
    const s = stats[attr];
    const cat = Object.entries(ATTR_CATEGORIES).find(([_, list]) => list.some(a => normAttr(a) === normAttr(attr)))?.[0] ?? "Other";
    return { attribute: attr, base: s.base, final: s.current, max: s.max, apSpent: s.apSpent, category: cat };
  });

  const starLevel = (key: string): number | undefined => {
    const n = starNames.find(a => normAttr(a) === key);
    return n ? stats[n].current : undefined;
  };

  const investedPoints: Record<string, number> = {};
  
  attrNames.forEach(attr => {
    const s = stats[attr];
    if (s.pointsAdded > 0) {
      const uiFriendlyName = STANDARD_ATTRS.find(std => normAttr(std) === normAttr(attr)) || attr;
      investedPoints[uiFriendlyName] = s.pointsAdded;
    }
  });

  return {
    stats: statResults,
    totalApSpent: statResults.reduce((sum, s) => sum + s.apSpent, 0) + starApSpent,
    byCategory: statResults.reduce((acc, stat) => {
      acc[stat.category] = acc[stat.category] || [];
      acc[stat.category].push(stat);
      return acc;
    }, {} as Record<string, StatResult[]>),
    investedPoints,
    equippedPlaystyles,
    skippedPlaystyles,
    skillMovesLevel: starLevel('skillmoves'),
    weakFootLevel: starLevel('weakfoot'),
    starApSpent
  };
}

export function resolveSignaturePlaystyles(archetypeName: string, signatureUpgrades: number, specialisationBonusPlus?: string): string[] {
  const ALL_PROFILES = getArchetypeProfiles("FC27");
  const arch = ALL_PROFILES.find((a: any) => normAttr(a.Archetype) === normAttr(archetypeName));
  if (!arch) return [];
  const baseSignatures = arch.Signature_PlayStyles.split(",").map((s: string) => s.trim());
  const upgradedSignatures = baseSignatures.map((ps: string, index: number) => index < signatureUpgrades ? `${ps}+` : ps);
  if (specialisationBonusPlus) upgradedSignatures[3] = specialisationBonusPlus.includes('+') ? specialisationBonusPlus : `${specialisationBonusPlus}+`;
  return upgradedSignatures.slice(0, 4);
}
