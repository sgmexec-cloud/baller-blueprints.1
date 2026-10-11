// ==========================================
// Base & Utility Types
// ==========================================

export type StatReq = { 
  stat: string; 
  min: number; 
};

export type GameVersion = "FC26" | "FC27";
export type ViewMode = "boosted" | "raw";

export type ActiveTab = "info" | "archetype" | "foundation" | "attributes" | "playstyles";
export type ActiveModal = "facilities" | "masteries" | "playstyles" | "specializations" | "physicals" | "skills_wf" | null;

export type ArchetypeBounds = {
  baseH: number;
  minH: number;
  maxH: number;
  baseW: number;
  minW: number;
  maxW: number;
  type: 'DEF' | 'MID_ATT' | 'GK';
};

export type StarCaps = {
  sm: { min: number; max: number; tier: string };
  wf: { min: number; max: number; tier: string };
};

// ==========================================
// Component Prop Interfaces - UI Elements
// ==========================================

export interface PlaystyleSlotsRowProps {
  interactive?: boolean;
  basePsPlus: string;
  specPlaystyle: string | null;
  equippedSpecialization: string | null;
  equippedPlaystyles: string[];
  level: number;
  fac1: string | null;
  fac2: string | null;
  setActiveModal: (modal: ActiveModal) => void;
}

export interface GridSlotProps {
  slot: {
    id: string;
    type: 'gold' | 'silver';
    name: string | null;
    unlocked: boolean;
    unlockText: string;
  };
  interactive?: boolean;
  onClick?: () => void;
}

// ==========================================
// Component Prop Interfaces - Tabs
// ==========================================

export interface InfoTabProps {
  archetype: string;
  height: number;
  weight: number;
  accelerate: string;
  masteryProgressPct: number;
  smLevel: number;
  wfLevel: number;
}

export interface ArchetypeTabProps {
  archetype: string;
  handleArchetypeChange: (newArch: string) => void;
  equippedSpecialization: string | null;
  setActiveModal: (modal: ActiveModal) => void;
  level: number;
  expandedPerk: string | null;
  setExpandedPerk: (perk: string | null) => void;
}

export interface FoundationTabProps {
  height: number;
  weight: number;
  accelerate: string;
  activeMasteriesCount: number;
  activeFacilitiesCount: number;
  setActiveModal: (modal: ActiveModal) => void;
}

export interface AttributesTabProps {
  archetype: string;
  serverArchetypes: any; // Type as needed based on your tRPC router
  currentStats: Record<string, number> | null;
  addedPoints: Record<string, number>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  smLevel: number;
  wfLevel: number;
  setActiveModal: (modal: ActiveModal) => void;
  physicalModifiers: Record<string, number>;
  facilityModifiers: Record<string, number>;
  masteryModifiers: Record<string, number>;
  handleSliderChange: (statKey: string, targetValue: number) => void;
  availableAp: number;
}

export interface PlaystylesTabProps {
  level: number;
  basePsPlus: string;
  specPlaystyle: string | null;
  equippedSpecialization: string | null;
  equippedPlaystyles: string[];
  fac1: string | null;
  fac2: string | null;
  setActiveModal: (modal: ActiveModal) => void;
}

// ==========================================
// Component Prop Interfaces - Modals
// ==========================================

export interface AiGeneratorModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  isGeneratingAi: boolean;
  handleRunAiBuild: () => void;
  aiArchetypeLock: string;
  setAiArchetypeLock: (lock: string) => void;
  aiTargetLevel: number;
  setAiTargetLevel: (lvl: number) => void;
  serverArchetypes: any;
}

export interface PhysicalsModalProps {
  isOpen: boolean;
  setIsOpen: (modal: ActiveModal) => void;
  activeBounds: ArchetypeBounds;
  height: number;
  setHeight: (h: number) => void;
  weight: number;
  setWeight: (w: number) => void;
  physicalModifiers: Record<string, number>;
  currentStats: Record<string, number>;
}

export interface SkillsWfModalProps {
  isOpen: boolean;
  setIsOpen: (modal: ActiveModal) => void;
  activeStarCaps: StarCaps;
  smLevel: number;
  wfLevel: number;
  handleStarChange: (type: 'sm' | 'wf', targetValue: number) => void;
  availableAp: number;
}

export interface FacilitiesModalProps {
  isOpen: boolean;
  setIsOpen: (modal: ActiveModal) => void;
  clubLevel: number;
  setClubLevel: (lvl: number) => void;
  remainingBudget: number;
  equippedFacilities: Record<string, number>;
  selectedFacView: string;
  handleSelectFacilityView: (facName: string) => void;
  viewingFacTier: number;
  setViewingFacTier: (tier: number) => void;
  handleFacTouchStart: (e: React.TouchEvent) => void;
  handleFacTouchMove: (e: React.TouchEvent) => void;
  handleFacTouchEnd: () => void;
  handleRemoveFacility: (facName: string) => void;
  handleEquipFacilityTier: (facName: string, tier: number) => void;
}

export interface MasteriesModalProps {
  isOpen: boolean;
  setIsOpen: (modal: ActiveModal) => void;
  masteryProgressPct: number;
  serverArchetypes: any;
  unlockedMasteries: Record<string, { l10: boolean, l30: boolean }>;
  toggleMasteryUnlock: (archName: string, tier: 'l10' | 'l30') => void;
}

export interface SpecializationsModalProps {
  isOpen: boolean;
  setIsOpen: (modal: ActiveModal) => void;
  archetype: string;
  availableAp: number;
  equippedSpecialization: string | null;
  getUpgradeData: (reqs: StatReq[]) => { canEquip: boolean; cost: number; upgrades: Record<string, number>; reason?: string };
  handleActionSpecialization: (specName: string, upgrades: Record<string, number>, isEquipped: boolean) => void;
  serverArchetypes: any;
  addedPoints: Record<string, number>;
}

export interface PlaystyleHubModalProps {
  isOpen: boolean;
  setIsOpen: (modal: ActiveModal) => void;
  level: number;
  availableAp: number;
  activePsPlus: string;
  isPsPlusUnlocked: boolean;
  equippedSpecialization: string | null;
  equippedPlaystyles: string[];
  selectedPsView: string | null;
  setSelectedPsView: (view: string | null) => void;
  getUpgradeData: (reqs: StatReq[]) => { canEquip: boolean; cost: number; upgrades: Record<string, number>; reason?: string };
  handleActionPlaystyle: (psName: string, upgrades: Record<string, number>, isEquipped: boolean) => void;
  hasEmptySlot: boolean;
  archetype: string;
  serverArchetypes: any;
  addedPoints: Record<string, number>;
}

