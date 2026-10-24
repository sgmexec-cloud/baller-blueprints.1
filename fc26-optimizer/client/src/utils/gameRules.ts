/**
 * Game rules that come from FC27_PROGRESSION.csv (served by trpc.build.getProgression), so the app follows the
 * data instead of numbers typed into components. Fallbacks are used only until the data has loaded.
 *
 *   Level 20  first signature playstyle becomes Plus
 *   Level 55  second signature playstyle becomes Plus, 4th playstyle slot, Level-55 mastery
 */
export interface ProgressionRow {
  apAvailable: number;
  signatureUpgrades: number;
  customSlots: number;
  masteries?: number;
}
export type ProgressionMap = Record<number, ProgressionRow> | undefined | null;

export const FALLBACK_MAX_LEVEL = 55;
export const FALLBACK_SLOT_LEVELS = [5, 15, 40, 55];
export const FALLBACK_SIGNATURE_LEVELS = [20, 55];
export const MASTERY_LEVELS = { l10: 10, l30: 30, l55: 55 } as const;

const levelsOf = (p: ProgressionMap): number[] =>
  p ? Object.keys(p).map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];

export function getMaxLevel(p: ProgressionMap): number {
  const lv = levelsOf(p);
  return lv.length ? lv[lv.length - 1] : FALLBACK_MAX_LEVEL;
}

/** The first level at which `field` reaches 1, 2, 3 ... (e.g. slots -> [5, 15, 40, 55]) */
function unlockLevels(p: ProgressionMap, field: 'customSlots' | 'signatureUpgrades' | 'masteries', fallback: number[]): number[] {
  const lv = levelsOf(p);
  if (!p || lv.length === 0) return fallback;
  const max = Math.max(...lv.map(l => p[l]?.[field] ?? 0));
  if (max <= 0) return fallback;
  const out: number[] = [];
  for (let n = 1; n <= max; n++) {
    const first = lv.find(l => (p[l]?.[field] ?? 0) >= n);
    if (first === undefined) break;
    out.push(first);
  }
  return out.length ? out : fallback;
}

/** Level at which each playstyle slot unlocks, e.g. [5, 15, 40, 55] */
export const getSlotUnlockLevels = (p: ProgressionMap) => unlockLevels(p, 'customSlots', FALLBACK_SLOT_LEVELS);
/** Level at which each signature playstyle turns Plus, e.g. [20, 55] */
export const getSignatureUnlockLevels = (p: ProgressionMap) => unlockLevels(p, 'signatureUpgrades', FALLBACK_SIGNATURE_LEVELS);

/** How many signature playstyles are Plus at this level (0, 1 or 2) */
export function getSignatureUpgradesAt(p: ProgressionMap, level: number): number {
  const row = p?.[level];
  if (row) return row.signatureUpgrades ?? 0;
  return getSignatureUnlockLevels(p).filter(l => level >= l).length;
}

/** Same name regardless of spaces, case or a trailing "+" ("Low Driven Shot+" === "LowDrivenShot") */
export const samePlaystyle = (a: string, b: string) =>
  a.replace(/[^a-z0-9]/gi, '').toLowerCase() === b.replace(/[^a-z0-9]/gi, '').toLowerCase() && !!a && !!b;
