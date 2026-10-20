/**
 * What a saved build contains. Kept in sync with SnapshotSchema / ProfileSchema in server/builds.ts.
 * Facilities, Masteries and Club level are stored INSIDE every build, so changing your profile later
 * never changes older builds.
 */
export interface MasteryState {
  l10: boolean;
  l30: boolean;
}

export interface ProfileSnapshot {
  clubLevel: number;
  equippedFacilities: Record<string, number>;
  unlockedMasteries: Record<string, MasteryState>;
}

export interface BuildSnapshot extends ProfileSnapshot {
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
}
