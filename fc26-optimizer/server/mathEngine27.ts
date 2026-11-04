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

/**
 * Attribute Priorities (tier-gated on the server).
 * All attribute values are IN-GAME values (they include height/weight, facility and mastery boosts).
 *  - weights: 1-5, how much the user wants an attribute (Premium and above)
 *  - min / max: target floor / hard ceiling (Premium+ and above)
 *  - exclude: skipped unless nothing else can use the AP (VIP, soft)
 */
export interface AttributePriorities {
  weights?: Record<string, number>;
  min?: Record<string, number>;
  max?: Record<string, number>;
  exclude?: string[];
}

export interface PriorityReportRow {
  attribute: string;
  weight: number | null;
  min: number | null;
  max: number | null;
  excluded: boolean;
  final: number;          // in-game value reached (points + boosts)
  minMet: boolean | null; // null when no minimum was set
  pointsAdded: number;
  apSpent: number;
}

/**
 * Usability floors: attributes that should not be left painfully low, whatever the player's real-life profile.
 * Values are IN-GAME values (height/weight, facility and mastery boosts count towards them).
 */
export const USABILITY_FLOORS: Record<string, number> = {
  'Stamina': 75,
  'Acceleration': 70,
  'Sprint Speed': 70,
};
// At most this share of the AP budget may be spent topping up floors
const FLOOR_BUDGET_SHARE = 0.15;

export interface FloorReportRow {
  attribute: string;
  floor: number;
  before: number; // in-game value before the top-up
  after: number;  // in-game value after the top-up
  apSpent: number;
  met: boolean;
}

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
  /** Only present when attribute priorities were used */
  priorityReport?: PriorityReportRow[];
  /** Only present when a usability floor had to be topped up */
  floorReport?: FloorReportRow[];
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

// The archetype's Signature PlayStyles (always equipped, they take no slot)
function getSignatureNames(archetypeName: string): string[] {
  const arch = getArchetypeProfiles("FC27").find((a: any) => normAttr(a.Archetype) === normAttr(archetypeName));
  if (!arch || !arch.Signature_PlayStyles) return [];
  return String(arch.Signature_PlayStyles).split(/[\/,]/).map((x: string) => x.trim()).filter(Boolean);
}

// Playstyle conflict utility directly in the engine to filter AI hallucinations
function isPlaystyleConflict(targetStyle: string, equippedPlusStyles: string[]): boolean {
  const normalize = (s: string) => s.replace(/\+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const targetBase = normalize(targetStyle);
  return equippedPlusStyles.some(plusStyle => normalize(plusStyle) === targetBase);
}

// Cap used by the weighted allocator when the USER gave an attribute a weight
const WEIGHT_CAPS: Record<number, number> = { 1: 85, 2: 87, 3: 90, 4: 93, 5: 95 };

export function runMathEngine(
  blueprint: ScoutingBlueprint, 
  apBudget: number, 
  customSlots: number = blueprint.playstyles.length,
  preferredAttributes: string[] = [], 
  foundationBoosts: Record<string, number> = {},
  options: { starsPrepaid?: boolean; priorities?: AttributePriorities; signatureUpgrades?: number; floors?: Record<string, number> } = {}
): MathEngineResult {
  const ALL_ARCHETYPES = getAllArchetypes("FC27");
  const COST_DICT = getCostDict("FC27");
  const PLAYSTYLES = getPlaystyles("FC27");

  const archKey = blueprint.archetype;
  const archetypeRows = ALL_ARCHETYPES.filter((r: any) => normAttr(r.Archetype) === normAttr(archKey));

  if (archetypeRows.length === 0) throw new Error(`Archetype "${blueprint.archetype}" not found.`);

  const stats: Record<string, { base: number; max: number; current: number; pointsAdded: number; apSpent: number }> = {};
  const attrNames: string[] = [];   
  const starNames: string[] = [];   

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

  // ── ATTRIBUTE PRIORITIES (all optional; with none given the engine behaves exactly as before) ──
  const pr = options.priorities ?? {};
  const toMap = (rec?: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec ?? {})) {
      const m = matchAttr(k, attrNames);
      if (m && Number.isFinite(v)) out[m] = v;
    }
    return out;
  };
  const userWeights = toMap(pr.weights);
  const userMin = toMap(pr.min);
  const userMax = toMap(pr.max);
  const excluded = new Set<string>();
  for (const e of pr.exclude ?? []) {
    const m = matchAttr(e, attrNames);
    if (m) excluded.add(m);
  }
  // A minimum above its own maximum makes no sense: the ceiling wins
  for (const k of Object.keys(userMin)) {
    if (userMax[k] !== undefined && userMin[k] > userMax[k]) delete userMin[k];
  }
  const hasPriorities =
    Object.keys(userWeights).length > 0 || Object.keys(userMin).length > 0 ||
    Object.keys(userMax).length > 0 || excluded.size > 0;

  // The AI's own picks act as soft priors: core 3, secondary 2, tertiary 1
  const rolePrior = new Map<string, { w: number; cap: number }>();
  const setRole = (list: string[] | undefined, w: number, cap: number) => {
    (list ?? []).forEach(a => {
      const m = matchAttr(a, attrNames);
      if (m && !rolePrior.has(m)) rolePrior.set(m, { w, cap });
    });
  };
  setRole(blueprint.coreAttributes, 3, 95);
  setRole(blueprint.secondaryAttributes, 2, 90);
  setRole(blueprint.tertiaryAttributes, 1, 85);

  function getHardCap(attrName: string, defaultCap: number): number {
    const isPreferred = preferredAttributes.some(p => normAttr(p) === normAttr(attrName));
    return isPreferred ? 99 : defaultCap;
  }
  
  function getEffectiveCap(attrName: string, absoluteCap: number): number {
    const boost = normalizedBoosts[normAttr(attrName)] || 0;
    return Math.max(0, absoluteCap - boost);
  }

  // The user's hard ceiling, converted to a raw (pre-boost) value. 99+ means "no ceiling".
  function userCeiling(attr: string): number {
    const c = userMax[attr];
    return c === undefined ? 999 : getEffectiveCap(attr, c);
  }

  function upgradeOne(attr: string, hardCap: number = 99): boolean {
    const matched = matchAttr(attr, allNames);
    if (!matched) return false;
    const s = stats[matched];
    
    if (s.current >= Math.min(s.max, hardCap, userCeiling(matched))) return false;
    
    const cost = getUpgradeCost(COST_DICT, archKey, matched, s.base, s.pointsAdded);
    if (cost > remainingAP) return false;
    
    s.current += 1;
    s.pointsAdded += 1;
    s.apSpent += cost;
    remainingAP -= cost;
    return true;
  }

  // boosted = true: the target is an in-game value (height/weight, facility and mastery boosts count towards it).
  // boosted = false: the target must be reached with the build's OWN points (what PlayStyle and specialisation
  // requirements need: boosts do not count towards unlocking them).
  function upgradeToMin(attr: string, absoluteTarget: number, boosted: boolean = true): void {
    const matched = matchAttr(attr, allNames);
    if (!matched) return;
    const effectiveTarget = boosted ? getEffectiveCap(matched, absoluteTarget) : absoluteTarget;
    while (stats[matched].current < effectiveTarget && remainingAP > 0) {
      if (!upgradeOne(matched, 99)) break;
    }
  }

  function costToReach(attr: string, target: number, boosted: boolean = true): number {
    const m = matchAttr(attr, allNames);
    if (!m) return Infinity;
    const s = stats[m];
    const t = boosted ? getEffectiveCap(m, target) : target;
    if (t > s.max) return Infinity;
    if (t > userCeiling(m)) return Infinity; // the user's ceiling blocks this requirement
    
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

  const apBeforeStars = remainingAP;
  if (!options.starsPrepaid) {
    if (blueprint.skillMoves !== undefined) upgradeToMin("SkillMoves", blueprint.skillMoves);
    if (blueprint.weakFoot !== undefined) upgradeToMin("WeakFoot", blueprint.weakFoot);
  }
  const starApSpent = apBeforeStars - remainingAP;

  // A standard PlayStyle can't duplicate one that is already equipped: the Signatures, or the specialisation's PlayStyle+.
  // (The AI's own "playstylePlus" list is NOT used here: those styles are not equipped in the current system,
  //  so blocking them would only throw away the AI's top-ranked picks.)
  const allEquippedPlus = getSignatureNames(blueprint.archetype);
  if (blueprint.specialisationPlaystylePlus) {
    allEquippedPlus.push(blueprint.specialisationPlaystylePlus);
  }

  const equippedPlaystyles: string[] = [];
  const skippedPlaystyles: string[] = [];
  
  // Candidates in the AI's priority order, minus the ones that are already equipped as a Signature / specialisation PS+.
  // We keep going down the list until every unlocked slot is filled: a style that is unknown or too expensive is
  // skipped and the next one is tried (cutting the list to the slot count first used to leave slots empty).
  // The AI's 4 "playstylePlus" picks are its strongest matches for the player, so they go FIRST (they are not
  // equipped as PS+ in the current system; they compete for the regular slots like everything else).
  // Duplicates between that list and the ranked list are dropped.
  const seenStyles = new Set<string>();
  const orderedStyles = [
    ...(blueprint.playstylePlus ?? []).map(n => ({ name: String(n).replace(/\+/g, '').trim(), requirements: [] as Array<{ attr: string; val: number }> })),
    ...blueprint.playstyles,
  ].filter(ps => {
    const key = ps.name.replace(/\+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!key || seenStyles.has(key)) return false;
    seenStyles.add(key);
    return true;
  });
  const activePlaystyles = orderedStyles
    .filter(ps => !isPlaystyleConflict(ps.name, allEquippedPlus));
  
  for (const ps of activePlaystyles) {
    if (equippedPlaystyles.length >= customSlots) break;
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
      
    // Requirements are checked on the build's own points only (boosts don't count)
    const totalCost = reqs.reduce((sum, r) => sum + costToReach(r.attr, r.val, false), 0);
    
    if (totalCost <= remainingAP) {
      reqs.forEach(r => upgradeToMin(r.attr, r.val, false));
      equippedPlaystyles.push(ps.name);
    } else {
      skippedPlaystyles.push(ps.name);
    }
  }

  // Only go out of the way to unlock a specialisation when its PlayStyle+ would really be USED on this build
  // (the AI wants it for this player, and it beats the Signature it would replace). A specialisation that is
  // reached by chance, because the build's priority attributes happen to cover it, is still unlocked afterwards.
  const specWorthIt =
    !!blueprint.specialisationPlaystylePlus &&
    options.signatureUpgrades !== undefined &&
    pickSpecialisationSwap(blueprint.archetype, options.signatureUpgrades, blueprint.specialisationPlaystylePlus, buildPlaystyleFit(blueprint)) >= 0;

  if (blueprint.specialisationMinAttrs && specWorthIt) {
    // Specialisation requirements also need the build's own points (boosts don't count)
    const totalSpecCost = blueprint.specialisationMinAttrs.reduce((sum, r) => sum + costToReach(r.attr, r.val, false), 0);
    if (totalSpecCost <= remainingAP) {
       blueprint.specialisationMinAttrs.forEach(req => upgradeToMin(req.attr, req.val, false));
    }
  }

  // PRIORITIES, step 1: chase the user's minimum targets, cheapest first
  if (hasPriorities) {
    const mins = Object.entries(userMin)
      .map(([a, t]) => ({ a, t, cost: costToReach(a, t) }))
      .filter(x => Number.isFinite(x.cost))
      .sort((x, y) => x.cost - y.cost);
    for (const m of mins) upgradeToMin(m.a, m.t);
  }
  
  // USABILITY FLOORS: lift Stamina / pace (see USABILITY_FLOORS) to a playable level, after the PlayStyle and
  // specialisation requirements (which often raise the same attributes) and the user's own minimums.
  // Boosts count, the user's ceilings and "skip" choices are respected, goalkeepers are left alone, and at most
  // FLOOR_BUDGET_SHARE of the budget is spent: the attribute furthest below its floor is helped first.
  let floorReport: FloorReportRow[] | undefined;
  const isGoalkeeper = attrNames.some(a => normAttr(a).startsWith('gk'));
  const floorEntries = Object.entries(options.floors ?? {})
    .map(([name, target]) => ({ attr: matchAttr(name, attrNames), target }))
    .filter((e): e is { attr: string; target: number } => !!e.attr && !excluded.has(e.attr!));
  if (!isGoalkeeper && floorEntries.length > 0) {
    const inGame = (a: string) => stats[a].current + (normalizedBoosts[normAttr(a)] || 0);
    const before: Record<string, number> = {};
    const spentBefore: Record<string, number> = {};
    floorEntries.forEach(e => { before[e.attr] = inGame(e.attr); spentBefore[e.attr] = stats[e.attr].apSpent; });

    const floorBudget = Math.floor(apBudget * FLOOR_BUDGET_SHARE);
    let floorSpent = 0;
    while (floorSpent < floorBudget && remainingAP > 0) {
      let best: { attr: string; deficit: number; cost: number } | null = null;
      for (const e of floorEntries) {
        const st = stats[e.attr];
        const deficit = e.target - inGame(e.attr);
        if (deficit <= 0) continue;
        if (st.current >= Math.min(st.max, userCeiling(e.attr))) continue;
        const cost = getUpgradeCost(COST_DICT, archKey, e.attr, st.base, st.pointsAdded);
        if (cost >= 999999 || cost > remainingAP || floorSpent + cost > floorBudget) continue;
        if (!best || deficit > best.deficit) best = { attr: e.attr, deficit, cost };
      }
      if (!best || !upgradeOne(best.attr, 99)) break;
      floorSpent += best.cost;
    }

    const rows: FloorReportRow[] = floorEntries
      .filter(e => before[e.attr] < e.target)
      .map(e => ({
        attribute: STANDARD_ATTRS.find(std => normAttr(std) === normAttr(e.attr)) || e.attr,
        floor: e.target,
        before: before[e.attr],
        after: inGame(e.attr),
        apSpent: stats[e.attr].apSpent - spentBefore[e.attr],
        met: inGame(e.attr) >= e.target,
      }));
    if (rows.length > 0) floorReport = rows;
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

  // PRIORITIES, step 2: weighted greedy. Each step buys the point with the best weight^2 / cost.
  // Weight = the user's 1-5 if given, otherwise the AI's role (core 3 / secondary 2 / tertiary 1).
  function weightedFill() {
    let progress = true;
    while (progress && remainingAP > 0) {
      progress = false;
      let best: string | null = null;
      let bestScore = 0;
      for (const a of attrNames) {
        if (excluded.has(a)) continue;
        const uw = userWeights[a];
        const rp = rolePrior.get(a);
        const w = uw ?? rp?.w ?? 0;
        if (w <= 0) continue;
        const baseCap = uw !== undefined ? (WEIGHT_CAPS[Math.round(uw)] ?? 90) : (rp?.cap ?? 85);
        const s = stats[a];
        const limit = Math.min(s.max, getEffectiveCap(a, getHardCap(a, baseCap)), userCeiling(a));
        if (s.current >= limit) continue;
        const cost = getUpgradeCost(COST_DICT, archKey, a, s.base, s.pointsAdded);
        if (cost >= 999999 || cost > remainingAP) continue;
        const score = (w * w) / Math.max(cost, 1);
        if (score > bestScore) { bestScore = score; best = a; }
      }
      if (best && upgradeOne(best, 99)) progress = true;
    }
  }

  if (hasPriorities) {
    weightedFill();
  } else {
    fillBucket(blueprint.coreAttributes, primaryBudget, 95);
    fillBucket(blueprint.secondaryAttributes, secondaryBudget, 90);
    fillBucket(blueprint.tertiaryAttributes, remainingAP, 85); 
  }

  let progressRoundRobin = true;
  const spilloverPool: { attr: string; cap: number }[] = [];
  
  const sortedAttrs = [...attrNames]
    .filter(a => !(hasPriorities && excluded.has(a))) // excluded attributes wait for the last-resort sweep
    .sort((a, b) => {
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

  // Last-resort sweep so AP is fully spent (excluded attributes may be used here, ceilings never)
  let microProgress = true;
  while (microProgress && remainingAP > 0) {
    microProgress = false;
    let cheapestAttr: string | null = null;
    let lowestCost = Infinity;

    for (const attr of attrNames) {
      const s = stats[attr];
      if (s.current >= Math.min(s.max, userCeiling(attr))) continue;
      
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

  let priorityReport: PriorityReportRow[] | undefined;
  if (hasPriorities) {
    priorityReport = attrNames
      .filter(a => userWeights[a] !== undefined || userMin[a] !== undefined || userMax[a] !== undefined || excluded.has(a))
      .map(a => {
        const s = stats[a];
        const boost = normalizedBoosts[normAttr(a)] || 0;
        const inGame = s.current + boost;
        return {
          attribute: STANDARD_ATTRS.find(std => normAttr(std) === normAttr(a)) || a,
          weight: userWeights[a] ?? null,
          min: userMin[a] ?? null,
          max: userMax[a] ?? null,
          excluded: excluded.has(a),
          final: inGame,
          minMet: userMin[a] === undefined ? null : inGame >= userMin[a],
          pointsAdded: s.pointsAdded,
          apSpent: s.apSpent,
        };
      });
  }

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
    starApSpent,
    priorityReport,
    floorReport,
  };
}

/**
 * How well a PlayStyle matches this player (higher = better), from the AI's blueprint:
 * its own PlayStyle+ picks count most (in order), then its ranked list.
 */
export function buildPlaystyleFit(bp: { playstylePlus?: string[]; playstyles?: Array<{ name: string }> }): (name: string) => number {
  const key = (x: string) => String(x).replace(/\+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return (name: string): number => {
    const k = key(name);
    const plusIdx = (bp.playstylePlus ?? []).findIndex(p => key(p) === k);
    const rank = (bp.playstyles ?? []).findIndex(p => key(p.name) === k);
    const a = plusIdx >= 0 ? 200 - 25 * plusIdx : 0;
    const b = rank >= 0 ? Math.max(0, 120 - 6 * rank) : 0;
    return Math.max(a, b);
  };
}

const plainName = (x: string) => String(x).replace(/\+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

/**
 * Which Signature does the specialisation's PlayStyle+ replace? Returns its index, or -1 for "none".
 *  - Same PlayStyle as a Signature: that Signature simply becomes PlayStyle+ (nothing is replaced).
 *  - Some Signatures are not PlayStyle+ yet: the specialisation takes the place of one of THOSE. If several qualify,
 *    the one the player needs least goes (lowest `fit`; ties go to the second Signature).
 *  - Every Signature is already PlayStyle+: the weakest of the 3 (the Signatures + the specialisation) is left out.
 *    If that is the specialisation's PlayStyle+, nothing is replaced (-1). Ties never drop the specialisation.
 * `fit` scores how well a PlayStyle matches the player (higher = better). Without it every score is 0.
 */
export function pickSpecialisationSwap(
  archetypeName: string,
  signatureUpgrades: number,
  specialisationBonusPlus?: string,
  fit?: (name: string) => number
): number {
  const base = getSignatureNames(archetypeName).slice(0, 4);
  if (base.length === 0 || !specialisationBonusPlus) return -1;
  const score = (n: string) => (fit ? fit(n) : 0);

  const weakestOf = (indices: number[]): number =>
    indices.reduce((best, i) => (score(base[i]) < score(base[best]) || (score(base[i]) === score(base[best]) && i > best) ? i : best), indices[0]);

  const same = base.findIndex((ps: string) => plainName(ps) === plainName(specialisationBonusPlus));
  let chosen: number;
  if (same >= 0) {
    chosen = same;
  } else {
    const plain = base.map((_: string, i: number) => i).filter((i: number) => i >= signatureUpgrades);
    if (plain.length > 0) {
      chosen = weakestOf(plain);
    } else {
      const weakest = weakestOf(base.map((_: string, i: number) => i));
      chosen = score(specialisationBonusPlus) < score(base[weakest]) ? -1 : weakest;
    }
  }

  // Realism guard (only when the player's fit scores are known): the specialisation's PlayStyle+ is used only if the
  // AI actually wants it for this player, and at least as much as the Signature it would replace.
  if (fit && chosen >= 0) {
    if (score(specialisationBonusPlus) <= 0) return -1;
    if (same < 0 && score(specialisationBonusPlus) < score(base[chosen])) return -1;
  }
  return chosen;
}

/**
 * The archetype's Signature PlayStyles as they appear on the build.
 * Signatures upgrade to PlayStyle+ one by one (signatureUpgrades). A specialisation's PlayStyle+ does NOT add a new
 * entry: it replaces one Signature (see pickSpecialisationSwap). Pass `swapIndex` to use a decision already made.
 */
export function resolveSignaturePlaystyles(
  archetypeName: string,
  signatureUpgrades: number,
  specialisationBonusPlus?: string,
  swapIndex?: number
): string[] {
  const base = getSignatureNames(archetypeName).slice(0, 4);
  if (base.length === 0) return [];
  const signatures = base.map((ps: string, index: number) => index < signatureUpgrades ? `${ps}+` : ps);
  if (specialisationBonusPlus) {
    const swap = swapIndex ?? pickSpecialisationSwap(archetypeName, signatureUpgrades, specialisationBonusPlus);
    if (swap >= 0 && swap < signatures.length) signatures[swap] = `${specialisationBonusPlus.replace(/\+/g, '').trim()}+`;
  }
  return signatures;
}
