/**
 * The numbers the builder screen shows for a build, as plain functions: boosted and raw attributes,
 * PAC/SHO/PAS/DRI/DEF/PHY, overall per position, and the attributes worth highlighting.
 * Used by the Batch Build Generator (and its CSV export). The builder screen keeps its own copy for now.
 */
import { ARCHETYPE_STAR_CAPS } from '@/constants/archetypeData';
import { STAT_GROUPS } from '@/constants/builderData';
import { getStatCaps, getCostForPoints, getTotalStarCost } from '@/utils/builderUtils';
import { calculateOVR } from '@/utils/ovrCalculator';
import { normStat } from '@/utils/facilityOptimizer';
import { physicalBoosts, facilityBoosts, sumMasteryBoosts, type MasterySet, type ServerArchetype } from '@/utils/aiBuildPipeline';

export interface BuildViewInput {
  archetype: string;
  height: number;
  weight: number;
  addedPoints: Record<string, number>;
  smLevel: number;
  wfLevel: number;
  equippedFacilities: Record<string, number>;
  unlockedMasteries: MasterySet;
}

export interface FaceStats { pac: number; sho: number; pas: number; dri: number; def: number; phy: number; ovr: number }

export interface BuildView {
  /** Base + the build's own points only (what PlayStyle and specialisation requirements use) */
  rawStats: Record<string, number>;
  /** Everything counted: points + height/weight + facilities + masteries (what the game shows) */
  boostedStats: Record<string, number>;
  /** Boost per attribute from all sources, only attributes that have one */
  boostTotals: Record<string, number>;
  physical: Record<string, number>;
  facilities: Record<string, number>;
  masteries: Record<string, number>;
  faceStats: FaceStats;
  positionRatings: { pos: string; ovr: number }[];
  primaryPosition: string;
  /** Overall at the first recommended position (falls back to the face-stat average) */
  ovr: number;
  spentAp: number;
}

export function computeBuildView(s: BuildViewInput, serverArchetypes: Record<string, ServerArchetype>): BuildView {
  const arch = serverArchetypes[s.archetype];
  if (!arch) throw new Error(`Unknown archetype "${s.archetype}".`);

  const physical = physicalBoosts(s.archetype, s.height, s.weight);
  const facilities = facilityBoosts(s.equippedFacilities || {});
  const masteries = sumMasteryBoosts(s.unlockedMasteries || {});

  const rawStats: Record<string, number> = {};
  const boostedStats: Record<string, number> = {};
  const boostTotals: Record<string, number> = {};
  let spent = 0;

  for (const stat in arch.base) {
    const caps = getStatCaps(s.archetype, stat);
    const rawBase = caps.min || arch.base[stat] || 70;
    const invested = s.addedPoints?.[stat] || 0;
    const boost = (physical[stat] || 0) + (facilities[stat] || 0) + (masteries[stat] || 0);
    rawStats[stat] = Math.min(caps.max || 99, rawBase + invested);
    boostedStats[stat] = Math.max(rawBase, Math.min(caps.max || 99, rawBase + boost + invested));
    if (boost !== 0) boostTotals[stat] = boost;
    if (invested > 0) spent += getCostForPoints(s.archetype, stat, rawBase, invested);
  }
  const starCaps = ARCHETYPE_STAR_CAPS[s.archetype] || ARCHETYPE_STAR_CAPS['Finisher'];
  spent += getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, s.smLevel);
  spent += getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, s.wfLevel);

  const calc = (group: string[]) => Math.round(group.reduce((sum, st) => sum + (boostedStats[st] || 70), 0) / group.length);
  const pac = calc(STAT_GROUPS['Pace']);
  const sho = calc(STAT_GROUPS['Shooting']);
  const pas = calc(STAT_GROUPS['Passing']);
  const dri = calc(STAT_GROUPS['Dribbling']);
  const def = calc(STAT_GROUPS['Defending']);
  const phy = calc(STAT_GROUPS['Physical']);
  const faceOvr = Math.round((pac + sho + pas + dri + def + phy) / 6) + 4;

  const positions = arch.recommended && arch.recommended.length > 0 ? arch.recommended : ['ST'];
  const positionRatings = positions.map(pos => ({ pos, ovr: calculateOVR(boostedStats, pos) }));
  const primary = positionRatings[0];

  return {
    rawStats,
    boostedStats,
    boostTotals,
    physical,
    facilities,
    masteries,
    faceStats: { pac, sho, pas, dri, def, phy, ovr: faceOvr },
    positionRatings,
    primaryPosition: primary.pos,
    ovr: primary.ovr > 0 ? primary.ovr : faceOvr,
    spentAp: spent,
  };
}

/**
 * The attributes to show off: the highest in-game values among the AI's core attributes first, then its
 * secondary ones (ties: core before secondary, then A-Z). Falls back to the highest values overall.
 */
export function pickHighlights(
  blueprint: { coreAttributes?: string[]; secondaryAttributes?: string[]; tertiaryAttributes?: string[] },
  boostedStats: Record<string, number>,
  count = 3
): { attribute: string; value: number; role: 'core' | 'secondary' | 'other' }[] {
  const byNorm = new Map<string, string>();
  Object.keys(boostedStats).forEach(k => byNorm.set(normStat(k), k));

  const seen = new Set<string>();
  const pool: { attribute: string; value: number; role: 'core' | 'secondary' | 'other'; rank: number }[] = [];
  const add = (list: string[] | undefined, role: 'core' | 'secondary', rank: number) => {
    (list ?? []).forEach(name => {
      const key = byNorm.get(normStat(name));
      if (!key || seen.has(key)) return;
      seen.add(key);
      pool.push({ attribute: key, value: boostedStats[key], role, rank });
    });
  };
  add(blueprint.coreAttributes, 'core', 0);
  add(blueprint.secondaryAttributes, 'secondary', 1);

  const sortPool = (a: typeof pool[number], b: typeof pool[number]) =>
    b.value - a.value || a.rank - b.rank || a.attribute.localeCompare(b.attribute);
  const picked = pool.sort(sortPool).slice(0, count);

  if (picked.length < count) {
    Object.keys(boostedStats)
      .filter(k => !picked.some(p => p.attribute === k))
      .sort((a, b) => boostedStats[b] - boostedStats[a] || a.localeCompare(b))
      .slice(0, count - picked.length)
      .forEach(k => picked.push({ attribute: k, value: boostedStats[k], role: 'other', rank: 2 }));
  }
  return picked.map(({ attribute, value, role }) => ({ attribute, value, role }));
}
