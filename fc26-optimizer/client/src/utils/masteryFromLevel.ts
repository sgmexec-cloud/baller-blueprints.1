import type { MasteryState } from '@/types/buildSnapshot';

/** Masteries complete at archetype level 10 and level 30. */
export function masteryFromLevel(level: number): MasteryState {
  return { l10: level >= 10, l30: level >= 30 };
}

/**
 * Combine hand-set masteries with the ones implied by each archetype's level.
 * An archetype that has a level in the profile is driven by that level; any other archetype keeps its
 * manually chosen value.
 */
export function mergeMasteries(
  manual: Record<string, MasteryState>,
  archetypeLevels: Record<string, number>
): Record<string, MasteryState> {
  const merged: Record<string, MasteryState> = { ...manual };
  for (const [archetype, level] of Object.entries(archetypeLevels)) {
    merged[archetype] = masteryFromLevel(level);
  }
  return merged;
}
