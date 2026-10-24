import { useState, useEffect, useMemo, useRef } from 'react';
import { trpc } from "@/lib/trpc"; 

import { STAT_GROUPS, CLUB_BUDGETS } from '@/constants/builderData';
import { ARCH_PHYSICALS, ARCHETYPE_STAR_CAPS, STAR_UPGRADE_COSTS } from '@/constants/archetypeData';
import { MASTERIES, SPECIALIZATIONS_DATA, FACILITIES } from '@/constants/playstylesData';
import type { StatReq } from '@/types/builder';
import { getModifier, getStatCaps, getTotalStarCost, getCostForPoints, getApCost } from '@/utils/builderUtils';
import { getMaxLevel, getSlotUnlockLevels, getSignatureUnlockLevels, getSignatureUpgradesAt, samePlaystyle, FALLBACK_SLOT_LEVELS } from '@/utils/gameRules';
import { useAccount } from '@/hooks/useAccount';
import type { BuildSnapshot, ProfileSnapshot } from '@/types/buildSnapshot';
import { masteryFromLevel, mergeMasteries } from '@/utils/masteryFromLevel';

// One empty string per playstyle slot (4 since level 55)
const emptySlots = (): string[] => FALLBACK_SLOT_LEVELS.map(() => '');

export function useBuilderLogic() {
  const [level, setLevel] = useState<number>(25);
  const [archetype, setArchetype] = useState<string>('');
  const [height, setHeight] = useState<number>(175);
  const [weight, setWeight] = useState<number>(75);
  
  const [addedPoints, setAddedPoints] = useState<Record<string, number>>({});
  const [smLevel, setSmLevel] = useState<number>(3);
  const [wfLevel, setWfLevel] = useState<number>(3);
  const [gameVersion, setGameVersion] = useState<"FC26" | "FC27">("FC27");

  const [clubLevel, setClubLevel] = useState<number>(10);
  const [equippedFacilities, setEquippedFacilities] = useState<Record<string, number>>({}); 
  const [unlockedMasteries, setUnlockedMasteries] = useState<Record<string, { l10: boolean, l30: boolean, l55?: boolean }>>({});
  
  // Equip States
  const [equippedPlaystyles, setEquippedPlaystyles] = useState<string[]>(emptySlots());
  const [equippedSpecialization, setEquippedSpecialization] = useState<string | null>(null);
  const [expandedPerk, setExpandedPerk] = useState<string | null>(null);
  
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'info' | 'archetype' | 'foundation' | 'attributes' | 'playstyles'>('info');
  const [activeModal, setActiveModal] = useState<'facilities' | 'masteries' | 'playstyles' | 'specializations' | 'physicals' | 'skills_wf' | null>(null);
  const [selectedFacView, setSelectedFacView] = useState<string>('');
  const [viewingFacTier, setViewingFacTier] = useState<number>(1);
  const [selectedPsView, setSelectedPsView] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'boosted' | 'raw'>('raw'); 
  
  // Carousel Touch State
  const [facTouchStart, setFacTouchStart] = useState<number | null>(null);
  const [facTouchEnd, setFacTouchEnd] = useState<number | null>(null);

  // AI Feature State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiArchetypeLock, setAiArchetypeLock] = useState<string>("AUTO");
  const [aiTargetLevel, setAiTargetLevel] = useState<number>(25);
  const [aiBlueprint, setAiBlueprint] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // tRPC Queries
  const { data: progressionData, isLoading: isProgLoading } = trpc.build.getProgression.useQuery({ gameVersion } as any);
  const { data: serverArchetypes, isLoading: isArchLoading } = trpc.scout.getArchetypeBaseStats.useQuery({ gameVersion } as any);
  const utils = trpc.useUtils();

  const generateReportMutation = trpc.scout.generateReport.useMutation();
  const calculateStatsMutation = trpc.scout.calculateStats.useMutation();

  const { user: accountUser, isAuthenticated } = useAccount();
  const profileQuery = trpc.scout.builds.profileGet.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const profileApplied = useRef(false);
  const levelSynced = useRef(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [archetypeLevels, setArchetypeLevels] = useState<Record<string, number>>({});

  useEffect(() => {
    const profile = profileQuery.data as Partial<ProfileSnapshot> | null | undefined;
    if (!profile || profileApplied.current) return;
    profileApplied.current = true;
    const levels = profile.archetypeLevels || {};
    setClubLevel(profile.clubLevel ?? 10);
    setEquippedFacilities(profile.equippedFacilities || {});
    setArchetypeLevels(levels);
    setUnlockedMasteries(mergeMasteries(profile.unlockedMasteries || {}, levels));
    setProfileLoaded(true);
  }, [profileQuery.data]);

  useEffect(() => {
    if (!profileLoaded || levelSynced.current || !archetype) return;
    levelSynced.current = true;
    const saved = archetypeLevels[archetype];
    if (saved) setLevel(saved);
  }, [profileLoaded, archetype]);

  const maxAp = progressionData?.[level]?.apAvailable ?? (Math.floor(level * 1.5) + 10);
  const maxLevel = getMaxLevel(progressionData);
  const slotUnlockLevels = getSlotUnlockLevels(progressionData);
  const unlockedSlotsAt = (lvl: number) => slotUnlockLevels.map((_, i) => i).filter(i => lvl >= slotUnlockLevels[i]);
  const activeBounds = ARCH_PHYSICALS[archetype] || ARCH_PHYSICALS['Finisher'];
  const activeStarCaps = ARCHETYPE_STAR_CAPS[archetype] || ARCHETYPE_STAR_CAPS['Finisher'];

  useEffect(() => {
    if (serverArchetypes && Object.keys(serverArchetypes).length > 0) {
      const targetArch = serverArchetypes[archetype] ? archetype : Object.keys(serverArchetypes)[0];
      setArchetype(targetArch);
      const bounds = ARCH_PHYSICALS[targetArch] || ARCH_PHYSICALS['Finisher'];
      setHeight(bounds.baseH);
      setWeight(bounds.baseW);
      setAddedPoints({});
      
      const starCaps = ARCHETYPE_STAR_CAPS[targetArch] || ARCHETYPE_STAR_CAPS['Finisher'];
      setSmLevel(starCaps.sm.min);
      setWfLevel(starCaps.wf.min);
      setEquippedPlaystyles(emptySlots());
      setSelectedPsView(null);
      setEquippedSpecialization(null);
      setExpandedPerk(null);
    }
  }, [serverArchetypes, gameVersion]);

  const handleArchetypeChange = (newArch: string) => {
    setArchetype(newArch);
    const bounds = ARCH_PHYSICALS[newArch] || ARCH_PHYSICALS['Finisher'];
    setHeight(bounds.baseH);
    setWeight(bounds.baseW);
    setAddedPoints({});
    const starCaps = ARCHETYPE_STAR_CAPS[newArch] || ARCHETYPE_STAR_CAPS['Finisher'];
    setSmLevel(starCaps.sm.min);
    setWfLevel(starCaps.wf.min);
    setEquippedPlaystyles(emptySlots());
    setSelectedPsView(null);
    setEquippedSpecialization(null);
    setExpandedPerk(null);
    if (archetypeLevels[newArch]) setLevel(archetypeLevels[newArch]);
  };

  const setArchetypeLevel = (arch: string, lvl: number | null) => {
    if (lvl === null) {
      setArchetypeLevels(prev => {
        const next = { ...prev };
        delete next[arch];
        return next;
      });
      return;
    }
    const clean = Math.max(1, Math.min(maxLevel, Math.round(lvl)));
    setArchetypeLevels(prev => ({ ...prev, [arch]: clean }));
    setUnlockedMasteries(prev => ({ ...prev, [arch]: masteryFromLevel(clean) }));
  };

  const handleGenerateBlueprint = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError(null);
    
    const canPickArchetype = !!accountUser && accountUser.tier !== "free";
    const forcedArchetype = canPickArchetype && aiArchetypeLock !== "AUTO" ? aiArchetypeLock : undefined;

    try {
      const blueprint = await generateReportMutation.mutateAsync({
        playerIdentity: aiPrompt,
        forcedArchetype,
        gameVersion: gameVersion
      });
      setAiBlueprint(blueprint);
    } catch (error: any) {
      console.error("AI Generation failed:", error);
      if (error?.data?.code === 'UNAUTHORIZED') setAiError('Please log in to use AI Auto-Build.');
      else if (error?.message === 'PAID_FEATURE') setAiError('Choosing the archetype yourself is included in the paid plans. Set it back to "Let AI Decide" to continue.');
      else if (error?.message === 'LIMIT_REACHED') setAiError("You've used all of your AI builds for this month.");
      else setAiError('Something went wrong generating the blueprint. Your build was not counted, so please try again.');
    } finally {
      setIsGeneratingAi(false);
      utils.scout.getQuota.invalidate();
    }
  };

  const handleFinalizeBuild = async () => {
    if (!aiBlueprint) return;
    setIsGeneratingAi(true);

    try {
      const targetArch = aiBlueprint.archetype && serverArchetypes?.[aiBlueprint.archetype] ? aiBlueprint.archetype : archetype;
      const starCaps = ARCHETYPE_STAR_CAPS[targetArch] || ARCHETYPE_STAR_CAPS['Finisher'];
      const targetSm = Math.max(starCaps.sm.min, Math.min(starCaps.sm.max, aiBlueprint.skillMoves || starCaps.sm.min));
      const targetWf = Math.max(starCaps.wf.min, Math.min(starCaps.wf.max, aiBlueprint.weakFoot || starCaps.wf.min));
      const smCost = getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, targetSm);
      const wfCost = getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, targetWf);
      
      const maxApForAi = progressionData?.[aiTargetLevel]?.apAvailable ?? (Math.floor(aiTargetLevel * 1.5) + 10);
      const availableApForMath = Math.max(0, maxApForAi - smCost - wfCost);
      const unlockedSlotIndexes = unlockedSlotsAt(aiTargetLevel);
      const standardSlotsCount = unlockedSlotIndexes.length;

      const foundationBoosts: Record<string, number> = {};
      const activeBounds = ARCH_PHYSICALS[targetArch] || ARCH_PHYSICALS['Finisher'];
      const newHeight = aiBlueprint.heightRange ? parseInt(aiBlueprint.heightRange) : height;
      const newWeight = aiBlueprint.weightRange ? parseInt(aiBlueprint.weightRange) : weight;
      const safeHeight = isNaN(newHeight) ? height : newHeight;
      const safeWeight = isNaN(newWeight) ? weight : newWeight;

      const hModRaw = getModifier(safeHeight, activeBounds.baseH, 4);
      const wModRaw = getModifier(safeWeight, activeBounds.baseW, 8);
      
      if (activeBounds.type === 'GK') {
        foundationBoosts["Sprint Speed"] = hModRaw - wModRaw;
        foundationBoosts["Strength"] = hModRaw + wModRaw;
        foundationBoosts["Acceleration"] = -hModRaw - wModRaw;
      } else {
        foundationBoosts["Jumping"] = hModRaw + wModRaw;
        foundationBoosts["Sprint Speed"] = hModRaw - wModRaw;
        foundationBoosts["Strength"] = hModRaw + wModRaw;
        foundationBoosts["Acceleration"] = -hModRaw - wModRaw;
        foundationBoosts["Agility"] = -hModRaw - wModRaw;
        foundationBoosts["Balance"] = -hModRaw + wModRaw;
      }

      Object.entries(equippedFacilities).forEach(([name, tier]) => {
        const facility = FACILITIES[name];
        if (facility) {
          const boostAmount = facility.boosts[tier - 1];
          facility.stats.forEach(stat => { foundationBoosts[stat] = (foundationBoosts[stat] || 0) + boostAmount; });
        }
      });

      const archMastery = MASTERIES[targetArch];
      const masteryStatus = unlockedMasteries[targetArch];
      if (archMastery && masteryStatus) {
        if (masteryStatus.l10 && archMastery.l10) Object.entries(archMastery.l10).forEach(([s, v]) => { foundationBoosts[s] = (foundationBoosts[s] || 0) + v; }); 
        if (masteryStatus.l30 && archMastery.l30) Object.entries(archMastery.l30).forEach(([s, v]) => { foundationBoosts[s] = (foundationBoosts[s] || 0) + v; }); 
        if (masteryStatus.l55 && archMastery.l55) Object.entries(archMastery.l55).forEach(([s, v]) => { foundationBoosts[s] = (foundationBoosts[s] || 0) + v; }); 
      }

      const mathResult = await calculateStatsMutation.mutateAsync({
        blueprint: aiBlueprint,
        apBudget: availableApForMath,
        gameVersion: gameVersion,
        standardSlots: standardSlotsCount,
        foundationBoosts: foundationBoosts,
        starsPrepaid: true 
      });

      setLevel(aiTargetLevel);
      setArchetype(targetArch);
      setHeight(safeHeight);
      setWeight(safeWeight);
      setSmLevel(targetSm);
      setWfLevel(targetWf);

      if (mathResult && (mathResult as any).investedPoints) setAddedPoints((mathResult as any).investedPoints);
      else setAddedPoints({});

      if (mathResult && mathResult.playstyles) {
        const signatureNames: string[] = serverArchetypes?.[targetArch]?.signatures ?? [];
        const standardList = (mathResult.playstyles.standard || []).filter((n: string) => !signatureNames.some(sn => samePlaystyle(sn, n)));
        const newEquipped = emptySlots();
        
        unlockedSlotIndexes.forEach((slotIdx, arrayIdx) => {
          if (standardList[arrayIdx]) newEquipped[slotIdx] = standardList[arrayIdx];
        });
        setEquippedPlaystyles(newEquipped);

        if (mathResult.playstyles.specialisation) {
          const specUpper = mathResult.playstyles.specialisation.toUpperCase();
          const archSpecs = SPECIALIZATIONS_DATA[targetArch] || [];
          const matchedSpec = archSpecs.find(s => s.name.toUpperCase() === specUpper);
          setEquippedSpecialization(matchedSpec ? matchedSpec.name : null);
        } else {
          setEquippedSpecialization(null);
        }
      }

      setIsAiModalOpen(false);
      setAiPrompt("");
      setAiBlueprint(null);
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to finalize build. Check your connection.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const getSnapshot = (): BuildSnapshot => ({
    v: 1,
    archetype,
    level,
    height,
    weight,
    addedPoints: { ...addedPoints },
    smLevel,
    wfLevel,
    equippedPlaystyles: equippedPlaystyles.slice(0, FALLBACK_SLOT_LEVELS.length),
    equippedSpecialization,
    clubLevel,
    equippedFacilities: { ...equippedFacilities },
    unlockedMasteries: { ...unlockedMasteries },
  });

  const getProfileSnapshot = (): ProfileSnapshot => ({
    clubLevel,
    equippedFacilities: { ...equippedFacilities },
    unlockedMasteries: { ...unlockedMasteries },
    archetypeLevels: { ...archetypeLevels },
  });

  const applySnapshot = (snap: BuildSnapshot): { ok: boolean; message?: string } => {
    const archData = serverArchetypes?.[snap.archetype];
    if (!archData) return { ok: false, message: 'This build uses an archetype that is no longer available.' };
    const validStats = new Set(Object.keys(archData.base));
    const cleanPoints: Record<string, number> = {};
    for (const [stat, pts] of Object.entries(snap.addedPoints || {})) {
      if (validStats.has(stat) && pts > 0) cleanPoints[stat] = pts;
    }
    const starCaps = ARCHETYPE_STAR_CAPS[snap.archetype] || ARCHETYPE_STAR_CAPS['Finisher'];
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const signatureNames: string[] = archData.signatures ?? [];
    const slots = emptySlots();
    (snap.equippedPlaystyles || []).slice(0, slots.length).forEach((p, i) => {
      slots[i] = p && !signatureNames.some(sn => samePlaystyle(sn, p)) ? p : '';
    });

    setArchetype(snap.archetype);
    setLevel(snap.level);
    setHeight(snap.height);
    setWeight(snap.weight);
    setAddedPoints(cleanPoints);
    setSmLevel(clamp(snap.smLevel, starCaps.sm.min, starCaps.sm.max));
    setWfLevel(clamp(snap.wfLevel, starCaps.wf.min, starCaps.wf.max));
    setEquippedPlaystyles(slots);
    setEquippedSpecialization(snap.equippedSpecialization ?? null);
    
    setClubLevel(snap.clubLevel);
    setEquippedFacilities(snap.equippedFacilities || {});
    setUnlockedMasteries(snap.unlockedMasteries || {});
    setSelectedPsView(null);
    setExpandedPerk(null);
    return { ok: true };
  };

  const openFacilitiesModal = () => {
    const firstFac = Object.keys(FACILITIES)[0];
    setSelectedFacView(firstFac);
    setViewingFacTier(equippedFacilities[firstFac] || 1);
    setActiveModal('facilities');
  };

  const handleSelectFacilityView = (facName: string) => {
    setSelectedFacView(facName);
    setViewingFacTier(equippedFacilities[facName] || 1);
  };

  const handleEquipFacilityTier = (facName: string, tier: number) => {
    setEquippedFacilities(prev => ({ ...prev, [facName]: tier }));
  };

  const handleRemoveFacility = (facName: string) => {
    setEquippedFacilities(prev => {
      const next = { ...prev };
      delete next[facName];
      return next;
    });
  };

  const handleFacTouchStart = (e: React.TouchEvent) => {
    setFacTouchEnd(null);
    setFacTouchStart(e.targetTouches[0].clientX);
  };
  const handleFacTouchMove = (e: React.TouchEvent) => setFacTouchEnd(e.targetTouches[0].clientX);
  const handleFacTouchEnd = () => {
    if (!facTouchStart || !facTouchEnd) return;
    const distance = facTouchStart - facTouchEnd;
    if (distance > 40) setViewingFacTier(Math.min(3, viewingFacTier + 1));
    if (distance < -40) setViewingFacTier(Math.max(1, viewingFacTier - 1));
  };

  const toggleMasteryUnlock = (archName: string, tier: 'l10' | 'l30' | 'l55') => {
    setArchetypeLevels(prev => {
      if (!(archName in prev)) return prev;
      const next = { ...prev };
      delete next[archName];
      return next;
    });
    setUnlockedMasteries(prev => {
      const cur = prev[archName] || { l10: false, l30: false, l55: false };
      const state = { l10: !!cur.l10, l30: !!cur.l30, l55: !!cur.l55 };
      if (tier === 'l10') {
        const on = !state.l10;
        return { ...prev, [archName]: { l10: on, l30: on ? state.l30 : false, l55: on ? state.l55 : false } };
      }
      if (tier === 'l30') {
        const on = !state.l30;
        return { ...prev, [archName]: { l10: on ? true : state.l10, l30: on, l55: on ? state.l55 : false } };
      }
      const on = !state.l55;
      return { ...prev, [archName]: { l10: on ? true : state.l10, l30: on ? true : state.l30, l55: on } };
    });
  };

  const physicalModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    const hModRaw = getModifier(height, activeBounds.baseH, 4);
    const wModRaw = getModifier(weight, activeBounds.baseW, 8);
    if (activeBounds.type === 'GK') {
      mods["Sprint Speed"] = (mods["Sprint Speed"] || 0) + hModRaw - wModRaw;
      mods["Strength"] = (mods["Strength"] || 0) + hModRaw + wModRaw;
      mods["Acceleration"] = (mods["Acceleration"] || 0) - hModRaw - wModRaw;
    } else {
      mods["Jumping"] = (mods["Jumping"] || 0) + hModRaw + wModRaw;
      mods["Sprint Speed"] = (mods["Sprint Speed"] || 0) + hModRaw - wModRaw;
      mods["Strength"] = (mods["Strength"] || 0) + hModRaw + wModRaw;
      mods["Acceleration"] = (mods["Acceleration"] || 0) - hModRaw - wModRaw;
      mods["Agility"] = (mods["Agility"] || 0) - hModRaw - wModRaw;
      mods["Balance"] = (mods["Balance"] || 0) - hModRaw + wModRaw;
    }
    return mods;
  }, [height, weight, activeBounds]);

  const totalFacilityCost = useMemo(() => {
    return Object.entries(equippedFacilities).reduce((total, [name, tier]) => {
      return total + (FACILITIES[name]?.cost[tier - 1] || 0);
    }, 0);
  }, [equippedFacilities]);

  const totalClubBudget = CLUB_BUDGETS[clubLevel] || 1000000;
  const remainingBudget = totalClubBudget - totalFacilityCost;

  const facilityModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    Object.entries(equippedFacilities).forEach(([name, tier]) => {
      const facility = FACILITIES[name];
      if (facility) {
        const boostAmount = facility.boosts[tier - 1];
        facility.stats.forEach(stat => { mods[stat] = (mods[stat] || 0) + boostAmount; });
      }
    });
    return mods;
  }, [equippedFacilities]);

  const masteryModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    Object.entries(unlockedMasteries).forEach(([arch, status]) => {
      const archMastery = MASTERIES[arch];
      if (!archMastery) return;
      if (status.l10 && archMastery.l10) Object.entries(archMastery.l10).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; }); 
      if (status.l30 && archMastery.l30) Object.entries(archMastery.l30).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; }); 
      if (status.l55 && archMastery.l55) Object.entries(archMastery.l55).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; }); 
    });
    return mods;
  }, [unlockedMasteries]);

  const currentStats = useMemo(() => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return null;
    const computed: Record<string, number> = {};
    const baseObj = serverArchetypes[archetype].base;

    for (const statKey in baseObj) {
      const caps = getStatCaps(archetype, statKey);
      const physMod = physicalModifiers[statKey] || 0;
      const facMod = facilityModifiers[statKey] || 0;
      const mastMod = masteryModifiers[statKey] || 0;
      const rawBase = caps.min || baseObj[statKey] || 70;

      const invested = addedPoints[statKey] || 0;
      const totalBeforeCap = rawBase + physMod + facMod + mastMod + invested;
      computed[statKey] = Math.max(rawBase, Math.min(caps.max || 99, totalBeforeCap));
    }
    return computed;
  }, [serverArchetypes, archetype, physicalModifiers, facilityModifiers, masteryModifiers, addedPoints]);

  const spentAp = useMemo(() => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return 0;
    let total = 0;
    for (const statKey in addedPoints) {
      const caps = getStatCaps(archetype, statKey);
      const rawBase = caps.min || serverArchetypes[archetype].base[statKey] || 70;
      const pointsAdded = addedPoints[statKey] || 0;
      total += getCostForPoints(archetype, statKey, rawBase, pointsAdded);
    }
    const starCaps = ARCHETYPE_STAR_CAPS[archetype] || ARCHETYPE_STAR_CAPS['Finisher'];
    total += getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, smLevel);
    total += getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, wfLevel);
    return total;
  }, [addedPoints, serverArchetypes, archetype, smLevel, wfLevel]);

  const availableAp = maxAp - spentAp;

  const faceStats = useMemo(() => {
    if (!currentStats) return { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, ovr: 70 };
    const calc = (group: string[]) => Math.round(group.reduce((sum, stat) => sum + (currentStats[stat] || 70), 0) / group.length);
    const pac = calc(STAT_GROUPS["Pace"]);
    const sho = calc(STAT_GROUPS["Shooting"]);
    const pas = calc(STAT_GROUPS["Passing"]);
    const dri = calc(STAT_GROUPS["Dribbling"]);
    const def = calc(STAT_GROUPS["Defending"]);
    const phy = calc(STAT_GROUPS["Physical"]);
    const ovr = Math.round((pac + sho + pas + dri + def + phy) / 6) + 4;
    return { pac, sho, pas, dri, def, phy, ovr };
  }, [currentStats]);

  const getUpgradeData = (reqs: StatReq[]) => {
    if (!reqs || reqs.length === 0) return { canEquip: true, cost: 0, upgrades: {} };
    let totalCost = 0, isPossible = true, reason = '', allMet = true;
    const upgrades: Record<string, number> = {};

    for (const req of reqs) {
      const statName = req.stat;
      const targetVal = req.min;
      const caps = getStatCaps(archetype, statName);
      const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[statName] || 70;
      const currentInvested = addedPoints[statName] || 0;
      const userStatWithoutMods = rawBase + currentInvested;

      if (userStatWithoutMods < targetVal) {
        allMet = false;
        if (targetVal > (caps.max || 99)) {
          isPossible = false;
          reason = 'CAP EXCEEDED';
          break;
        }
        const targetInvested = targetVal - rawBase;
        if (targetInvested > currentInvested) {
            const costCurrent = getCostForPoints(archetype, statName, rawBase, currentInvested);
            const costTarget = getCostForPoints(archetype, statName, rawBase, targetInvested);
            totalCost += (costTarget - costCurrent);
            upgrades[statName] = targetInvested;
        }
      }
    }
    if (allMet) return { canEquip: true, cost: 0, upgrades: {} };
    if (!isPossible) return { canEquip: false, reason, cost: 0, upgrades: {} };
    if (totalCost > availableAp) return { canEquip: false, reason: 'INSUFFICIENT AP', cost: totalCost, upgrades: {} };
    return { canEquip: true, cost: totalCost, upgrades };
  };

  const handleActionPlaystyle = (psName: string, upgrades: Record<string, number>, isEquipped: boolean) => {
    if (isEquipped) {
      setEquippedPlaystyles(prev => prev.map(p => p === psName ? '' : p));
    } else {
      const unlockedSlotIndexes = unlockedSlotsAt(level);
      const emptyIndex = unlockedSlotIndexes.find(i => equippedPlaystyles[i] === '');
      if (emptyIndex !== undefined) {
        if (Object.keys(upgrades).length > 0) {
          setAddedPoints(prev => {
            const next = { ...prev };
            for (const stat in upgrades) next[stat] = Math.max(next[stat] || 0, upgrades[stat]);
            return next;
          });
        }
        setEquippedPlaystyles(prev => {
          const next = [...prev];
          next[emptyIndex] = psName;
          return next;
        });
      }
    }
  };

  const handleActionSpecialization = (specName: string, upgrades: Record<string, number>, isEquipped: boolean) => {
    if (isEquipped) {
      setEquippedSpecialization(null);
    } else {
      if (Object.keys(upgrades).length > 0) {
        setAddedPoints(prev => {
          const next = { ...prev };
          for (const stat in upgrades) next[stat] = Math.max(next[stat] || 0, upgrades[stat]);
          return next;
        });
      }
      setEquippedSpecialization(specName);
    }
  };

  const handleUnlockPlaystyle = (upgrades: Record<string, number>) => {
    if (!upgrades || Object.keys(upgrades).length === 0) return;
    setAddedPoints(prev => {
      const next = { ...prev };
      for (const stat in upgrades) next[stat] = Math.max(next[stat] || 0, upgrades[stat]);
      return next;
    });
  };

  const handleStarChange = (type: 'sm' | 'wf', targetValue: number) => {
    const caps = activeStarCaps[type];
    let safeTarget = Math.max(caps.min, Math.min(caps.max, targetValue));
    const currentLevel = type === 'sm' ? smLevel : wfLevel;
    const currentCost = getTotalStarCost(caps.tier, caps.min, currentLevel);
    const targetCost = getTotalStarCost(caps.tier, caps.min, safeTarget);
    
    if (targetCost - currentCost > availableAp) {
       let affordableLevel = currentLevel;
       let costAccumulator = currentCost;
       const costs = STAR_UPGRADE_COSTS[caps.tier];
       for (let i = currentLevel + 1; i <= safeTarget; i++) {
         let stepCost = costs[i];
         if (costAccumulator + stepCost <= currentCost + availableAp) { affordableLevel++; costAccumulator += stepCost; } 
         else break;
       }
       safeTarget = affordableLevel;
    }
    if (type === 'sm') setSmLevel(safeTarget);
    else setWfLevel(safeTarget);
  };

  const handleSliderChange = (statKey: string, targetValue: number) => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return;
    const caps = getStatCaps(archetype, statKey);
    const rawBase = caps.min || serverArchetypes[archetype].base[statKey] || 70;
    
    const physMod = physicalModifiers[statKey] || 0;
    const facMod = facilityModifiers[statKey] || 0;
    const mastMod = masteryModifiers[statKey] || 0;
    const totalMods = physMod + facMod + mastMod;
    
    const currentInvestedPts = addedPoints[statKey] || 0;
    const maxPossiblePoints = (caps.max || 99) - rawBase;
    
    let targetInvested = viewMode === 'raw' 
      ? targetValue - rawBase 
      : targetValue - rawBase - totalMods;
      
    targetInvested = Math.max(0, Math.min(maxPossiblePoints, targetInvested));
    
    const currentCost = getCostForPoints(archetype, statKey, rawBase, currentInvestedPts);
    const targetCost = getCostForPoints(archetype, statKey, rawBase, targetInvested);

    if (targetCost - currentCost > availableAp) {
      let affordablePoints = currentInvestedPts;
      let costAccumulator = currentCost;
      if (targetInvested > currentInvestedPts) {
        for (let i = currentInvestedPts; i < targetInvested; i++) {
          let stepCost = getApCost(archetype, statKey, rawBase + affordablePoints + 1);
          if (costAccumulator + stepCost <= currentCost + availableAp) { 
            affordablePoints++; 
            costAccumulator += stepCost; 
          } else break;
        }
        targetInvested = affordablePoints;
      }
    }

    setAddedPoints(prev => {
      const next = { ...prev };
      if (targetInvested <= 0) delete next[statKey]; 
      else next[statKey] = targetInvested;
      return next;
    });
  };

  let accelerate = 'Controlled';
  if (currentStats) {
    const acc = currentStats["Acceleration"] || 70;
    const agi = currentStats["Agility"] || 70;
    const str = currentStats["Strength"] || 70;
    if (height >= 185 && str >= 65 && (str - agi) >= 4 && acc >= 40) accelerate = 'Lengthy';
    else if (height <= 184 && agi >= 65 && (agi - str) >= 10 && acc >= 80) accelerate = 'Explosive';
  }

  const activeMasteriesCount = Object.values(unlockedMasteries).reduce((count, status) => count + (status.l10 ? 1 : 0) + (status.l30 ? 1 : 0) + (status.l55 ? 1 : 0), 0);
  const masteryProgressPct = Math.round((activeMasteriesCount / (Object.keys(MASTERIES).length * 3)) * 100);
  const activeFacilitiesCount = Object.keys(equippedFacilities).length;
  const isPsPlusUnlocked = getSignatureUpgradesAt(progressionData, level) > 0;
  
  const specPerk = equippedSpecialization
    ? SPECIALIZATIONS_DATA[archetype]?.find(s => s.name === equippedSpecialization)?.perk ?? null
    : null;

  // Dual Signature Logic
  const signatureNames: string[] = serverArchetypes?.[archetype]?.signatures ?? [];
  const sigUpgrades = getSignatureUpgradesAt(progressionData, level);

  const sig1 = {
    name: specPerk || signatureNames[0] || '',
    type: (specPerk || sigUpgrades > 0) ? 'gold' : 'silver'
  };

  const sig2 = {
    name: signatureNames[1] || '',
    type: sigUpgrades > 1 ? 'gold' : 'silver'
  };

  const unlockedSlotIndexes = unlockedSlotsAt(level);
  const hasEmptySlot = unlockedSlotIndexes.some(i => equippedPlaystyles[i] === '');

  const facilityPlaystyles = useMemo(() => {
     return Object.entries(equippedFacilities)
       .filter(([_, tier]) => tier === 3)
       .map(([name, _]) => FACILITIES[name]?.playstyle)
       .filter(Boolean);
  }, [equippedFacilities]);
  const fac1 = facilityPlaystyles[0] || null;
  const fac2 = facilityPlaystyles[1] || null;
  const specPlaystyle = equippedSpecialization ? SPECIALIZATIONS_DATA[archetype]?.find(s => s.name === equippedSpecialization)?.perk : null;

  return {
    level, setLevel,
    archetype, handleArchetypeChange,
    height, setHeight,
    weight, setWeight,
    addedPoints, setAddedPoints,
    smLevel, wfLevel,
    gameVersion, setGameVersion,
    clubLevel, setClubLevel,
    equippedFacilities,
    unlockedMasteries,
    equippedPlaystyles, setEquippedPlaystyles,
    equippedSpecialization, setEquippedSpecialization,
    expandedPerk, setExpandedPerk,
    activeTab, setActiveTab,
    activeModal, setActiveModal,
    selectedFacView, setSelectedFacView,
    viewingFacTier, setViewingFacTier,
    selectedPsView, setSelectedPsView,
    viewMode, setViewMode,
    isAiModalOpen, setIsAiModalOpen,
    aiPrompt, setAiPrompt,
    isGeneratingAi,
    aiArchetypeLock, setAiArchetypeLock,
    aiTargetLevel, setAiTargetLevel,
    aiBlueprint, setAiBlueprint,
    aiError,
    serverArchetypes,
    progressionData,
    isArchLoading, isProgLoading,
    maxAp, activeBounds, activeStarCaps,
    physicalModifiers, facilityModifiers, masteryModifiers,
    currentStats, availableAp, faceStats, accelerate,
    masteryProgressPct, activeMasteriesCount, activeFacilitiesCount,
    isPsPlusUnlocked, specPlaystyle, sig1, sig2,
    activePsPlus: sig1.name, basePsPlus: signatureNames[0] || 'None',
    psPlusChoice: 'signature' as any, setPsPlusMode: (() => {}) as any,
    getSnapshot, applySnapshot, getProfileSnapshot,
    archetypeLevels, setArchetypeLevel,
    fac1, fac2, hasEmptySlot, remainingBudget,
    handleGenerateBlueprint, handleFinalizeBuild, openFacilitiesModal, handleSelectFacilityView,
    handleEquipFacilityTier, handleRemoveFacility, handleFacTouchStart,
    handleFacTouchMove, handleFacTouchEnd, toggleMasteryUnlock,
    getUpgradeData, handleActionPlaystyle, handleActionSpecialization, handleUnlockPlaystyle,
    handleStarChange, handleSliderChange
  };
}
