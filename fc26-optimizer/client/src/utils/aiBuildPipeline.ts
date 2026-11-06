/**
 * The "Optimize & Finalize" step of an AI build as a plain function (no React, no screen).
 *
 * It does exactly what the builder's Finalize button does: star costs, height/weight boosts, mastery boosts,
 * facility planning (two engine passes), then the real server maths engine (`calculateStats`), and returns the
 * finished build as a snapshot. The Batch Build Generator calls it once per player.
 *
 * Nothing here talks to the network itself: the caller passes `calculateStats` in (the tRPC mutation).
 */
import { ARCH_PHYSICALS, ARCHETYPE_STAR_CAPS } from '@/constants/archetypeData';
import { CLUB_BUDGETS } from '@/constants/builderData';
import { MASTERIES, SPECIALIZATIONS_DATA, FACILITIES } from '@/constants/playstylesData';
import { getModifier, getTotalStarCost, getApCost } from '@/utils/builderUtils';
import { optimiseFacilities, normStat, type FacilityPlan } from '@/utils/facilityOptimizer';
import { getSlotUnlockLevels, getSignatureUpgradesAt, samePlaystyle, FALLBACK_SLOT_LEVELS, type ProgressionMap } from '@/utils/gameRules';

export type MasteryFlags = { l10: boolean; l30: boolean; l55?: boolean };
export type MasterySet = Record<string, MasteryFlags>;

export interface ServerArchetype {
  pos?: string;
  recommended?: string[];
  signatures?: string[];
  base: Record<string, number>;
}

export interface BatchBuildSettings {
  /** Archetype level the build is made for (the batch uses 55) */
  level: number;
  /** 'ai' = pick the best facilities within the Club level budget, 'keep' = use `keptFacilities` */
  facilityMode: 'ai' | 'keep';
  clubLevel: number;
  keptFacilities: Record<string, number>;
  masteries: MasterySet;
  buildStyle: 'balanced' | 'authentic';
}

export interface PipelineContext {
  serverArchetypes: Record<string, ServerArchetype>;
  progressionData: ProgressionMap;
  /** The trpc.scout.calculateStats mutation (or anything with the same input and output) */
  calculateStats: (input: Record<string, unknown>) => Promise<any>;
  gameVersion?: string;
}

export interface PipelineResult {
  snapshot: {
    v: 1;
    archetype: string;
    level: number;
    height: number;
    weight: number;
    addedPoints: Record<string, number>;
    smLevel: number;
    wfLevel: number;
    equippedPlaystyles: string[];
    equippedSpecialization: string | null;
    psPlusMode: 'auto';
    clubLevel: number;
    equippedFacilities: Record<string, number>;
    unlockedMasteries: MasterySet;
  };
  archetype: string;
  /** AP the engine was given (level AP minus Skill Moves / Weak Foot) */
  availableAp: number;
  starCost: number;
  /** The engine's answer for the final pass (stats, reports, playstyles ...) */
  engine: any;
  facilityPlan: FacilityPlan | null;
  boosts: {
    physical: Record<string, number>;
    masteries: Record<string, number>;
    facilities: Record<string, number>;
  };
  /** Signatures as they appear on the build (a specialisation PlayStyle+ may replace one) */
  signatures: string[];
  /** 0 or 1 = the Signature the specialisation's PlayStyle+ replaced, -1 = none, null = no specialisation */
  specSwapIndex: number | null;
  /** Things that were adjusted on the way (for example a height outside the archetype's range) */
  notes: string[];
}

// ───────────────────────── small shared helpers (same rules as the builder screen) ─────────────────────────

/** Every archetype fully unlocked: levels 10, 30 and 55 */
export function allMasteriesUnlocked(archetypes: string[] = Object.keys(MASTERIES)): MasterySet {
  return Object.fromEntries(archetypes.map(a => [a, { l10: true, l30: true, l55: true }]));
}

/** Total attribute boost from masteries (they are permanent and apply to every build) */
export function sumMasteryBoosts(unlocked: MasterySet): Record<string, number> {
  const mods: Record<string, number> = {};
  Object.entries(unlocked).forEach(([arch, status]) => {
    const def = MASTERIES[arch];
    if (!def) return;
    if (status.l10 && def.l10) Object.entries(def.l10).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; });
    if (status.l30 && def.l30) Object.entries(def.l30).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; });
    if (status.l55 && def.l55) Object.entries(def.l55).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; });
  });
  return mods;
}

/** Attribute modifiers from height and weight (goalkeepers differ) */
export function physicalBoosts(archetype: string, height: number, weight: number): Record<string, number> {
  const bounds = ARCH_PHYSICALS[archetype] || ARCH_PHYSICALS['Finisher'];
  const h = getModifier(height, bounds.baseH, 4);
  const w = getModifier(weight, bounds.baseW, 8);
  const mods: Record<string, number> = {};
  if (bounds.type === 'GK') {
    mods['Sprint Speed'] = h - w;
    mods['Strength'] = h + w;
    mods['Acceleration'] = -h - w;
  } else {
    mods['Jumping'] = h + w;
    mods['Sprint Speed'] = h - w;
    mods['Strength'] = h + w;
    mods['Acceleration'] = -h - w;
    mods['Agility'] = -h - w;
    mods['Balance'] = -h + w;
  }
  return mods;
}

/** Attribute boosts from equipped facilities (facility name -> tier) */
export function facilityBoosts(equipped: Record<string, number>): Record<string, number> {
  const mods: Record<string, number> = {};
  Object.entries(equipped).forEach(([name, tier]) => {
    const facility = FACILITIES[name];
    if (!facility) return;
    const amount = facility.boosts[tier - 1];
    if (amount === undefined) return;
    facility.stats.forEach(stat => { mods[stat] = (mods[stat] || 0) + amount; });
  });
  return mods;
}

const addInto = (target: Record<string, number>, extra: Record<string, number>) => {
  Object.entries(extra).forEach(([k, v]) => { target[k] = (target[k] || 0) + v; });
};

/** "178cm", 5'10", 1.78m, "6ft 2", 178 -> centimetres (fallback when nothing can be read) */
export function parseHeightCm(raw: unknown, fallback: number): number {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return fallback;
  let m = s.match(/(\d+(?:\.\d+)?)\s*cm/);
  if (m) return Math.round(parseFloat(m[1]));
  m = s.match(/(\d+(?:\.\d+)?)\s*m\b/);
  if (m && parseFloat(m[1]) < 3) return Math.round(parseFloat(m[1]) * 100);
  m = s.match(/(\d)\s*(?:'|ft|feet|foot)\s*(\d{1,2})?/);
  if (m) return Math.round((parseInt(m[1], 10) * 12 + (m[2] ? parseInt(m[2], 10) : 0)) * 2.54);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) {
    const n = parseFloat(m[1]);
    if (n >= 100 && n <= 250) return Math.round(n);
    if (n >= 1 && n < 3) return Math.round(n * 100);
  }
  return fallback;
}

/** "72kg", "158 lbs", 72 -> kilograms (fallback when nothing can be read) */
export function parseWeightKg(raw: unknown, fallback: number): number {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return fallback;
  let m = s.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (m) return Math.round(parseFloat(m[1]));
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/);
  if (m) return Math.round(parseFloat(m[1]) / 2.20462);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) {
    const n = parseFloat(m[1]);
    if (n >= 40 && n <= 160) return Math.round(n);
  }
  return fallback;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ───────────────────────── the pipeline ─────────────────────────

export async function runAiBuildPipeline(
  blueprint: any,
  settings: BatchBuildSettings,
  ctx: PipelineContext
): Promise<PipelineResult> {
  const { serverArchetypes, progressionData } = ctx;
  const targetArch: string = blueprint?.archetype;
  if (!targetArch || !serverArchetypes[targetArch]) {
    throw new Error(`The AI chose an archetype that isn't available: "${targetArch}".`);
  }
  const level = settings.level;
  const notes: string[] = [];

  // Skill Moves / Weak Foot are paid first, inside the archetype's limits
  const starCaps = ARCHETYPE_STAR_CAPS[targetArch] || ARCHETYPE_STAR_CAPS['Finisher'];
  const targetSm = Math.max(starCaps.sm.min, Math.min(starCaps.sm.max, blueprint.skillMoves || starCaps.sm.min));
  const targetWf = Math.max(starCaps.wf.min, Math.min(starCaps.wf.max, blueprint.weakFoot || starCaps.wf.min));
  const smCost = getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, targetSm);
  const wfCost = getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, targetWf);
  const starCost = smCost + wfCost;

  const maxAp = progressionData?.[level]?.apAvailable ?? (Math.floor(level * 1.5) + 10);
  const availableApForMath = Math.max(0, maxAp - starCost);

  const slotUnlockLevels = getSlotUnlockLevels(progressionData);
  const unlockedSlotIndexes = slotUnlockLevels.map((_, i) => i).filter(i => level >= slotUnlockLevels[i]);
  const standardSlotsCount = unlockedSlotIndexes.length;
  const signatureSlotsCount = getSignatureUpgradesAt(progressionData, level);

  // Height and weight: read the AI's answer in any unit, and keep it inside what the archetype allows
  const bounds = ARCH_PHYSICALS[targetArch] || ARCH_PHYSICALS['Finisher'];
  let height = parseHeightCm(blueprint.heightRange, bounds.baseH);
  let weight = parseWeightKg(blueprint.weightRange, bounds.baseW);
  const hClamped = clamp(height, bounds.minH, bounds.maxH);
  if (hClamped !== height) { notes.push(`Height ${height}cm is outside ${targetArch}'s range, set to ${hClamped}cm.`); height = hClamped; }
  const wClamped = clamp(weight, bounds.minW, bounds.maxW);
  if (wClamped !== weight) { notes.push(`Weight ${weight}kg is outside ${targetArch}'s range, set to ${wClamped}kg.`); weight = wClamped; }

  const physical = physicalBoosts(targetArch, height, weight);
  const masteryBoosts = sumMasteryBoosts(settings.masteries);
  const foundationBoosts: Record<string, number> = {};
  addInto(foundationBoosts, physical);
  addInto(foundationBoosts, masteryBoosts);

  // At this point foundationBoosts holds height/weight + masteries only. Facilities are added below.
  const baseBoosts: Record<string, number> = { ...foundationBoosts };

  const callEngine = (boosts: Record<string, number>) =>
    ctx.calculateStats({
      blueprint,
      apBudget: availableApForMath,
      gameVersion: ctx.gameVersion ?? 'FC27',
      standardSlots: standardSlotsCount,
      foundationBoosts: boosts,
      signatureSlots: signatureSlotsCount,
      attributePriorities: undefined,
      buildStyle: settings.buildStyle,
      starsPrepaid: true,
    });

  let facilitiesForBuild: Record<string, number> = settings.keptFacilities;
  let facilityPlan: FacilityPlan | null = null;

  if (settings.facilityMode === 'ai') {
    // Pass 1: build WITHOUT facilities to see where every attribute lands
    const baseline: any = await callEngine(baseBoosts);

    const boostFor = (stat: string) =>
      Object.entries(baseBoosts).reduce((sum, [k, v]) => (normStat(k) === normStat(stat) ? sum + v : sum), 0);
    const landing: Record<string, number> = {};
    for (const st of (baseline.stats ?? []) as { attribute: string; final: number }[]) {
      landing[st.attribute] = st.final + boostFor(st.attribute);
    }

    // How much the build cares about each attribute
    const bought = new Set<string>(
      Object.entries(baseline.investedPoints ?? {}).filter(([, v]) => (v as number) > 0).map(([k]) => normStat(k))
    );
    const role = new Map<string, number>();
    const mark = (list: string[] | undefined, w: number) =>
      (list ?? []).forEach(a => { if (!role.has(normStat(a))) role.set(normStat(a), w); });
    mark(blueprint.coreAttributes, 0.8);
    mark(blueprint.secondaryAttributes, 0.6);
    mark(blueprint.tertiaryAttributes, 0.4);
    const relevance = (stat: string) => (bought.has(normStat(stat)) ? 1 : role.get(normStat(stat)) ?? 0.15);

    // A tier-3 facility's free PlayStyle is worth more the higher the AI ranked it. Signatures are already free.
    const signatureNames: string[] = serverArchetypes[targetArch]?.signatures ?? [];
    const ranked: string[] = (blueprint.playstyles ?? []).map((p: any) => p.name);

    facilityPlan = optimiseFacilities({
      facilities: FACILITIES,
      budget: CLUB_BUDGETS[settings.clubLevel] || 0,
      currentStats: landing,
      pointValue: (stat, lvl) => getApCost(targetArch, stat, lvl) * relevance(stat),
      playstyleBonus: (ps) => {
        if (signatureNames.some(sn => samePlaystyle(sn, ps))) return 0;
        const rank = ranked.findIndex(r => samePlaystyle(r, ps));
        return rank < 0 ? 0 : Math.max(0, 120 - 6 * rank);
      },
    });
    facilitiesForBuild = facilityPlan.equipped;
  }

  const facilityMods = facilityBoosts(facilitiesForBuild);
  addInto(foundationBoosts, facilityMods);

  // The final pass: the real maths engine, with every boost counted
  const engine: any = await callEngine(foundationBoosts);
  if (!engine) throw new Error('The maths engine returned nothing.');

  // Turn the engine's answer into the build (the same way the builder does)
  const signatureNames: string[] = serverArchetypes[targetArch]?.signatures ?? [];
  const standardList: string[] = (engine.playstyles?.standard || []).filter(
    (n: string) => !signatureNames.some(sn => samePlaystyle(sn, n))
  );
  const slots: string[] = FALLBACK_SLOT_LEVELS.map(() => '');
  unlockedSlotIndexes.forEach((slotIdx, arrayIdx) => {
    if (standardList[arrayIdx]) slots[slotIdx] = standardList[arrayIdx];
  });

  let specialisation: string | null = null;
  if (engine.playstyles?.specialisation) {
    const upper = String(engine.playstyles.specialisation).toUpperCase();
    const match = (SPECIALIZATIONS_DATA[targetArch] || []).find(s => s.name.toUpperCase() === upper);
    specialisation = match ? match.name : null;
  }

  return {
    snapshot: {
      v: 1,
      archetype: targetArch,
      level,
      height,
      weight,
      addedPoints: engine.investedPoints ?? {},
      smLevel: targetSm,
      wfLevel: targetWf,
      equippedPlaystyles: slots,
      equippedSpecialization: specialisation,
      psPlusMode: 'auto',
      clubLevel: settings.clubLevel,
      equippedFacilities: { ...facilitiesForBuild },
      unlockedMasteries: settings.masteries,
    },
    archetype: targetArch,
    availableAp: availableApForMath,
    starCost,
    engine,
    facilityPlan,
    boosts: { physical, masteries: masteryBoosts, facilities: facilityMods },
    signatures: engine.playstyles?.signatures ?? [],
    specSwapIndex: specialisation && typeof engine.playstyles?.specSwapIndex === 'number' ? engine.playstyles.specSwapIndex : null,
    notes,
  };
}
