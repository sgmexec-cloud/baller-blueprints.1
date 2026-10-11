import { useState, useEffect, useMemo } from 'react';
import { trpc } from "@/lib/trpc"; 

import { STAT_GROUPS } from '@/constants/builderData';
import { ARCH_PHYSICALS, ARCHETYPE_STAR_CAPS, STAR_UPGRADE_COSTS } from '@/constants/archetypeData';
import { MASTERIES, SPECIALIZATIONS_DATA, FACILITIES, FIXED_PLAYSTYLE_PLUS } from '@/constants/playstylesData';
import type { StatReq } from '@/types/builder';
import { getModifier, getStatCaps, getTotalStarCost, getCostForPoints, getApCost } from '@/utils/builderUtils';

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
  const [unlockedMasteries, setUnlockedMasteries] = useState<Record<string, { l10: boolean, l30: boolean }>>({});
  
  // Equip States
  const [equippedPlaystyles, setEquippedPlaystyles] = useState<string[]>(['', '', '']);
  const [equippedSpecialization, setEquippedSpecialization] = useState<string | null>(null);
  const [expandedPerk, setExpandedPerk] = useState<string | null>(null);
  
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'info' | 'archetype' | 'foundation' | 'attributes' | 'playstyles'>('attributes');
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

  // tRPC Queries
  const { data: progressionData, isLoading: isProgLoading } = trpc.build.getProgression.useQuery({ gameVersion } as any);
  const { data: serverArchetypes, isLoading: isArchLoading } = trpc.scout.getArchetypeBaseStats.useQuery({ gameVersion } as any);
  
  // AI Mutations
  const generateReportMutation = trpc.scout.generateReport.useMutation();
  const calculateStatsMutation = trpc.scout.calculateStats.useMutation();

  const maxAp = progressionData?.[level]?.apAvailable ?? (Math.floor(level * 1.5) + 10);
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
      setEquippedPlaystyles(['', '', '']);
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
    setEquippedPlaystyles(['', '', '']);
    setSelectedPsView(null);
    setEquippedSpecialization(null);
    setExpandedPerk(null);
  };

  const handleRunAiBuild = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    
    const finalPrompt = aiArchetypeLock !== "AUTO" 
      ? `[CRITICAL REQUIREMENT: YOU MUST SELECT THE '${aiArchetypeLock}' ARCHETYPE FOR THIS BUILD] ${aiPrompt}`
      : aiPrompt;

    try {
      const blueprint = await generateReportMutation.mutateAsync({
        playerIdentity: finalPrompt,
        gameVersion: gameVersion
      });

      const targetArch = aiArchetypeLock !== "AUTO" && serverArchetypes?.[aiArchetypeLock]
        ? aiArchetypeLock
        : (blueprint.archetype && serverArchetypes?.[blueprint.archetype] ? blueprint.archetype : archetype);
      
      const starCaps = ARCHETYPE_STAR_CAPS[targetArch] || ARCHETYPE_STAR_CAPS['Finisher'];
      const targetSm = blueprint.skillMoves || starCaps.sm.min;
      const targetWf = blueprint.weakFoot || starCaps.wf.min;

      const smCost = getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, targetSm);
      const wfCost = getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, targetWf);
      
      const maxApForAi = progressionData?.[aiTargetLevel]?.apAvailable ?? (Math.floor(aiTargetLevel * 1.5) + 10);
      const availableApForMath = Math.max(0, maxApForAi - smCost - wfCost);

      const mathResult = await calculateStatsMutation.mutateAsync({
        blueprint,
        apBudget: availableApForMath,
        gameVersion: gameVersion,
        unlockedMasteries: {} 
      });

      setLevel(aiTargetLevel);
      setArchetype(targetArch);
      
      const newHeight = blueprint.heightRange ? parseInt(blueprint.heightRange) : height;
      const newWeight = blueprint.weightRange ? parseInt(blueprint.weightRange) : weight;
      if (!isNaN(newHeight)) setHeight(newHeight);
      if (!isNaN(newWeight)) setWeight(newWeight);

      setSmLevel(targetSm);
      setWfLevel(targetWf);

      const activeBounds = ARCH_PHYSICALS[targetArch] || ARCH_PHYSICALS['Finisher'];
      const hModRaw = getModifier(newHeight, activeBounds.baseH, 4);
      const wModRaw = getModifier(weight, activeBounds.baseW, 8);
      const inlinePhysMods: Record<string, number> = {};
      
      if (activeBounds.type === 'GK') {
        inlinePhysMods["Sprint Speed"] = hModRaw - wModRaw;
        inlinePhysMods["Strength"] = hModRaw + wModRaw;
        inlinePhysMods["Acceleration"] = -hModRaw - wModRaw;
      } else {
        inlinePhysMods["Jumping"] = hModRaw + wModRaw;
        inlinePhysMods["Sprint Speed"] = hModRaw - wModRaw;
        inlinePhysMods["Strength"] = hModRaw + wModRaw;
        inlinePhysMods["Acceleration"] = -hModRaw - wModRaw;
        inlinePhysMods["Agility"] = -hModRaw - wModRaw;
        inlinePhysMods["Balance"] = -hModRaw + wModRaw;
      }

      if (mathResult && mathResult.stats) {
        const newAddedPoints: Record<string, number> = {};
        
        mathResult.stats.forEach((statObj: any) => {
          const statName = statObj.attribute;
          const finalVal = statObj.final;
          
          const caps = getStatCaps(targetArch, statName);
          const rawBase = caps.min || serverArchetypes?.[targetArch]?.base?.[statName] || 70;
          const physMod = inlinePhysMods[statName] || 0;
          
          const targetInvested = finalVal - (rawBase + physMod);
          
          if (targetInvested > 0) {
            newAddedPoints[statName] = targetInvested;
          }
        });
        
        setAddedPoints(newAddedPoints);
      }

      if (mathResult && mathResult.playstyles) {
        const standardList = mathResult.playstyles.standard || [];
        const newEquipped = ['', '', ''];
        standardList.slice(0, 3).forEach((psName: string, idx: number) => {
          newEquipped[idx] = psName;
        });
        setEquippedPlaystyles(newEquipped);

        if (mathResult.playstyles.specialisation) {
          const specUpper = mathResult.playstyles.specialisation.toUpperCase();
          const archSpecs = SPECIALIZATIONS_DATA[targetArch] || [];
          const matchedSpec = archSpecs.find(s => s.name.toUpperCase() === specUpper);
          
          if (matchedSpec) {
            setEquippedSpecialization(matchedSpec.name);
          } else {
            setEquippedSpecialization(null);
          }
        } else {
          setEquippedSpecialization(null);
        }
      }

      setIsAiModalOpen(false);
      setAiPrompt("");
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to generate build. Check your inputs or API key.");
    } finally {
      setIsGeneratingAi(false);
    }
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
  
  const handleFacTouchMove = (e: React.TouchEvent) => {
    setFacTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleFacTouchEnd = () => {
    if (!facTouchStart || !facTouchEnd) return;
    const distance = facTouchStart - facTouchEnd;
    if (distance > 40) setViewingFacTier(Math.min(3, viewingFacTier + 1));
    if (distance < -40) setViewingFacTier(Math.max(1, viewingFacTier - 1));
  };

  const toggleMasteryUnlock = (archName: string, tier: 'l10' | 'l30') => {
    setUnlockedMasteries(prev => {
      const current = prev[archName] || { l10: false, l30: false };
      if (tier === 'l30') {
        const nextL30 = !current.l30;
        return { ...prev, [archName]: { l10: nextL30 ? true : current.l10, l30: nextL30 } };
      } else {
        const nextL10 = !current.l10;
        return { ...prev, [archName]: { l10: nextL10, l30: nextL10 ? current.l30 : false } };
      }
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

  const remainingBudget = 100000 - totalFacilityCost; // Update with dynamic budget logic if needed

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
      if (status.l10 && archMastery.l10) { Object.entries(archMastery.l10).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; }); }
      if (status.l30 && archMastery.l30) { Object.entries(archMastery.l30).forEach(([s, v]) => { mods[s] = (mods[s] || 0) + v; }); }
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

    let totalCost = 0;
    let isPossible = true;
    let reason = '';
    const upgrades: Record<string, number> = {};
    let allMet = true;

    for (const req of reqs) {
      const statName = req.stat;
      const targetVal = req.min;
      
      const caps = getStatCaps(archetype, statName);
      const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[statName] || 70;
      const currentInvested = addedPoints[statName] || 0;
      
      const userStatWithoutMods = rawBase + currentInvested;

      if (userStatWithoutMods < targetVal) {
        allMet = false;
        const capMax = caps.max || 99;

        if (targetVal > capMax) {
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
      const unlockedSlotIndexes = [0, 1, 2].filter(i => level >= [5, 15, 40][i]);
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

  const activeMasteriesCount = Object.values(unlockedMasteries).reduce((count, status) => count + (status.l10 ? 1 : 0) + (status.l30 ? 1 : 0), 0);
  const masteryProgressPct = Math.round((activeMasteriesCount / 28) * 100);
  const activeFacilitiesCount = Object.keys(equippedFacilities).length;
  
  const isPsPlusUnlocked = level >= 20;
  const basePsPlus = FIXED_PLAYSTYLE_PLUS[archetype] || 'None';
  
  const activePsPlus = equippedSpecialization 
     ? SPECIALIZATIONS_DATA[archetype]?.find(s => s.name === equippedSpecialization)?.perk || basePsPlus
     : basePsPlus;
  
  const unlockedSlotIndexes = [0, 1, 2].filter(i => level >= [5, 15, 40][i]);
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
    serverArchetypes,
    isArchLoading, isProgLoading,
    maxAp, activeBounds, activeStarCaps,
    physicalModifiers, facilityModifiers, masteryModifiers,
    currentStats, availableAp, faceStats, accelerate,
    masteryProgressPct, activeMasteriesCount, activeFacilitiesCount,
    isPsPlusUnlocked, basePsPlus, activePsPlus, specPlaystyle,
    fac1, fac2, hasEmptySlot, remainingBudget,
    handleRunAiBuild, openFacilitiesModal, handleSelectFacilityView,
    handleEquipFacilityTier, handleRemoveFacility, handleFacTouchStart,
    handleFacTouchMove, handleFacTouchEnd, toggleMasteryUnlock,
    getUpgradeData, handleActionPlaystyle, handleActionSpecialization,
    handleStarChange, handleSliderChange
  };
}
