/**
 * What gets saved. Kept in sync with SnapshotSchema / ProfileSchema in server/builds.ts.
 */
export interface MasteryState {
  l10: boolean;
  l30: boolean;
}

/** Account-wide settings, applied automatically to every new build. */
export interface ProfileSnapshot {
  clubLevel: number;
  equippedFacilities: Record<string, number>;
  /** Masteries set by hand (for archetypes without a level below) */
  unlockedMasteries: Record<string, MasteryState>;
  /** The level you've reached on each archetype, 1-40. Masteries complete at 10 and 30. */
  archetypeLevels: Record<string, number>;
}

/**
 * One saved build. Facilities / Masteries / Club level are stored INSIDE every build, so changing your
 * profile later never silently changes older builds.
 */
export interface BuildSnapshot {
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
  psPlusMode: 'auto' | 'signature' | 'spec';
  clubLevel: number;
  equippedFacilities: Record<string, number>;
  unlockedMasteries: Record<string, MasteryState>;
}
