import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from "@/lib/trpc"; 

// PHASE 1 IMPORTS
import { STAT_GROUPS, STAT_KEY_MAP, CSV_STAT_MAP, STAT_ABBR, CLUB_BUDGETS } from '@/constants/builderData';
import { ARCH_PHYSICALS, ARCHETYPE_STAR_CAPS, STAR_UPGRADE_COSTS } from '@/constants/archetypeData';
import { MASTERIES, SIGNATURE_PERKS_DATA, SPECIALIZATIONS_DATA, FACILITIES, FIXED_PLAYSTYLE_PLUS, PLAYSTYLES_DATA, PLAYSTYLE_CATEGORIES } from '@/constants/playstylesData';
import type { StatReq } from '@/types/builder';

// PHASE 2 IMPORTS - Helper Utilities
import { 
  getArchetypeDisplayPosition, 
  getPlaystyleIconPath, 
  formatHeight, 
  formatWeight, 
  getApCost, 
  getCostForPoints, 
  getTotalStarCost, 
  getModifier, 
  getStatCaps 
} from '@/utils/builderUtils';

export default function ManualBuilder() {
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

  // ------------------------------------------
  // AI INTEGRATION LOGIC
  // ------------------------------------------

  const handleRunAiBuild = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    
    // Inject the archetype lock instruction into the prompt if manual is selected
    const finalPrompt = aiArchetypeLock !== "AUTO" 
      ? `[CRITICAL REQUIREMENT: YOU MUST SELECT THE '${aiArchetypeLock}' ARCHETYPE FOR THIS BUILD] ${aiPrompt}`
      : aiPrompt;

    try {
      const blueprint = await generateReportMutation.mutateAsync({
        playerIdentity: finalPrompt,
        gameVersion: gameVersion
      });

      // If user locked an archetype, enforce it, otherwise let AI decide
      const targetArch = aiArchetypeLock !== "AUTO" && serverArchetypes?.[aiArchetypeLock]
        ? aiArchetypeLock
        : (blueprint.archetype && serverArchetypes?.[blueprint.archetype] ? blueprint.archetype : archetype);
      
      const starCaps = ARCHETYPE_STAR_CAPS[targetArch] || ARCHETYPE_STAR_CAPS['Finisher'];
      const targetSm = blueprint.skillMoves || starCaps.sm.min;
      const targetWf = blueprint.weakFoot || starCaps.wf.min;

      const smCost = getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, targetSm);
      const wfCost = getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, targetWf);
      
      // Calculate max AP based on the Target Level selected in the modal
      const maxApForAi = progressionData?.[aiTargetLevel]?.apAvailable ?? (Math.floor(aiTargetLevel * 1.5) + 10);
      const availableApForMath = Math.max(0, maxApForAi - smCost - wfCost);

      const mathResult = await calculateStatsMutation.mutateAsync({
        blueprint,
        apBudget: availableApForMath,
        gameVersion: gameVersion,
        unlockedMasteries: {} 
      });

      // Apply the target level globally so the UI matches the math
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
      const wModRaw = getModifier(newWeight, activeBounds.baseW, 8);
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

  // ------------------------------------------
  // MODAL LOGIC & ACTIONS
  // ------------------------------------------
  
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

  // ------------------------------------------
  // CALCULATORS
  // ------------------------------------------
  
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

  const remainingBudget = CLUB_BUDGETS[clubLevel] - totalFacilityCost;

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

  // ------------------------------------------
  // QUICK EQUIP ENGINE
  // ------------------------------------------
  
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
      
      // Calculate tracking against Raw Stats to match game logic precisely
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
  const totalMasteriesCount = 28; 
  const masteryProgressPct = Math.round((activeMasteriesCount / totalMasteriesCount) * 100);
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

  // ------------------------------------------
  // REUSABLE COMPONENTS
  // ------------------------------------------

  const PlaystyleSlotsRow = ({ interactive = false }: { interactive?: boolean }) => {
    const slotsData = [
       { id: 'base', type: 'gold', name: basePsPlus, unlocked: true, unlockText: '' },
       { id: 'spec', type: 'gold', name: specPlaystyle, unlocked: !!equippedSpecialization, unlockText: 'SPEC' },
       { id: 'lvl5', type: 'silver', name: equippedPlaystyles[0], unlocked: level >= 5, unlockText: 'LVL 5' },
       { id: 'lvl15', type: 'silver', name: equippedPlaystyles[1], unlocked: level >= 15, unlockText: 'LVL 15' },
       { id: 'lvl40', type: 'silver', name: equippedPlaystyles[2], unlocked: level >= 40, unlockText: 'LVL 40' },
       { id: 'facil1', type: 'silver', name: fac1, unlocked: !!fac1, unlockText: 'FAC 1' },
       { id: 'facil2', type: 'silver', name: fac2, unlocked: !!fac2, unlockText: 'FAC 2' }
    ];

    return (
       <div className="flex justify-center gap-[4px] sm:gap-1.5 w-full">
          {slotsData.map(slot => {
             const handleSlotClick = () => {
                if (interactive && slot.unlocked) {
                   if (slot.id === 'spec') setActiveModal('specializations');
                   else if (slot.id.startsWith('lvl')) setActiveModal('playstyles');
                }
             };

             return (
               <button 
                 key={slot.id} 
                 onClick={handleSlotClick}
                 disabled={!interactive || !slot.unlocked || (!slot.id.startsWith('lvl') && slot.id !== 'spec')}
                 className={`w-[2.3rem] h-[2.3rem] md:w-10 md:h-10 rounded bg-[#131A2A] border ${slot.name && slot.type === 'gold' ? 'border-[#facc15]/50 shadow-[0_0_8px_rgba(250,204,21,0.2)]' : 'border-[#26334A]'} flex items-center justify-center relative overflow-hidden transition-all ${interactive && slot.unlocked && (slot.id.startsWith('lvl') || slot.id === 'spec') ? 'hover:bg-[#192235] cursor-pointer' : 'cursor-default'}`}
               >
                  {!slot.unlocked ? (
                     <div className="flex flex-col items-center justify-center opacity-40">
                        <svg className="w-3.5 h-3.5 mb-0.5 text-[#F4F7FB]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                        <span className="text-[6px] font-bold text-[#F4F7FB] uppercase leading-none">{slot.unlockText}</span>
                     </div>
                  ) : slot.name ? (
                     <img src={getPlaystyleIconPath(slot.name, slot.type === 'gold')} className="w-5 h-5 md:w-6 md:h-6 object-contain" alt={slot.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                     <div className="flex items-center justify-center w-full h-full opacity-50">
                        <span className="text-[12px] text-[#59657A] font-bold">+</span>
                     </div>
                  )}
               </button>
             )
          })}
       </div>
    )
  }

  const GridSlot = ({ slot, interactive, onClick }: any) => (
     <button 
       onClick={() => { if (interactive && slot.unlocked && onClick) onClick(); }}
       disabled={!interactive || !slot.unlocked}
       className={`h-[70px] rounded-xl bg-[#0D1220] border ${slot.name && slot.type === 'gold' ? 'border-[#facc15]/50 shadow-[0_0_8px_rgba(250,204,21,0.15)]' : 'border-[#26334A]'} flex items-center justify-center relative overflow-hidden transition-all ${interactive && slot.unlocked ? 'hover:bg-[#192235] hover:border-[#4D8DFF]/50 cursor-pointer ring-1 ring-transparent hover:ring-[#4D8DFF]/20' : 'cursor-default'}`}
     >
        {!slot.unlocked ? (
           <div className="flex flex-col items-center justify-center opacity-40">
              <svg className="w-6 h-6 mb-1 text-[#F4F7FB]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
              <span className="text-[9px] font-bold text-[#F4F7FB] uppercase tracking-widest">{slot.unlockText}</span>
           </div>
        ) : slot.name ? (
           <img src={getPlaystyleIconPath(slot.name, slot.type === 'gold')} className="w-10 h-10 object-contain drop-shadow-md" alt={slot.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
           <div className="flex items-center justify-center w-full h-full opacity-50">
              <span className="text-[18px] text-[#59657A] font-bold">+</span>
           </div>
        )}
     </button>
  );

  if (isArchLoading || isProgLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080B14]">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#4D8DFF] border-[#131A2A] animate-spin mb-4"></div>
        <p className="text-[#4D8DFF] font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Loading Engine Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] relative overflow-x-clip pt-4 pb-16 px-4">
      <div className="max-w-lg mx-auto relative">
        
        {/* COMPANION APP STYLE TOP BAR */}
        <div className="flex justify-between items-center mb-4 px-1 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[#8E9AAF] text-lg leading-none font-bold cursor-pointer">〈</span>
            <span className="text-[#F4F7FB] font-black tracking-wide text-[15px]">Player Details</span>
          </div>
          
          <div className="flex items-center gap-4">
            
            <button 
              onClick={() => {
                setAiTargetLevel(level); // Sync current level into modal
                setAiArchetypeLock("AUTO"); // Reset to auto
                setIsAiModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(77,141,255,0.3)] hover:opacity-90 transition-all"
            >
              <span>✨ AI Auto-Build</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-[#F4F7FB] font-bold text-[13px]">{availableAp.toLocaleString()}</span>
              <div className="w-3.5 h-3.5 rounded-full bg-[#facc15] flex items-center justify-center border border-[#eab308]">
                <span className="text-[#080B14] font-black text-[6px]">AP</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 relative group">
              <select 
                value={level} 
                onChange={(e) => { setLevel(Number(e.target.value)); setAddedPoints({}); }}
                className="bg-transparent font-bold text-[#21E6A4] text-[13px] outline-none appearance-none cursor-pointer z-10 w-4 text-center"
              >
                {Array.from({ length: 40 }, (_, i) => i + 1).map(l => (
                  <option key={l} value={l} className="bg-[#131A2A] text-[#21E6A4]">{l}</option>
                ))}
              </select>
              <div className="w-3.5 h-3.5 rounded-full bg-[#21E6A4] flex items-center justify-center border border-[#10b981]">
                 <svg className="w-2 h-2 text-[#080B14]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>
              </div>
            </div>

          </div>
        </div>

        {/* STICKY HEADER CARD */}
        <div className="sticky top-0 z-40 bg-[#080B14]/95 backdrop-blur-md pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 border-b border-[#26334A]/60 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
           
           <div className="text-center mb-3">
              <span className="text-[#F4F7FB] font-bold text-[15px]">Player Bio</span>
           </div>

           <div className="bg-[#192235] rounded-xl p-4 flex gap-5 shadow-sm items-center">
              
              <div 
                 className={`w-[96px] h-[135px] rounded-lg relative overflow-hidden shrink-0 bg-cover bg-center transition-all duration-300 ${
                   faceStats.ovr >= 75 
                     ? 'shadow-[0_0_15px_rgba(250,204,21,0.2)]' 
                     : 'shadow-[0_0_15px_rgba(192,192,192,0.25)]'
                 }`}
                 style={{ backgroundImage: `url('/cards/${faceStats.ovr >= 75 ? 'gold' : 'silver'}-card.png')` }}
              >
                 <div className="absolute z-20 flex flex-col items-center justify-center" style={{ left: '12%', top: '15%', width: '15%' }}>
                    <span className="text-[#080B14] text-[15px] font-bold leading-none tracking-tighter" style={{ fontFamily: "'Montserrat', sans-serif" }}>{faceStats.ovr}</span>
                 </div>
                 
                 <div className="absolute z-10" style={{ left: '26.9%', top: '13.4%', width: '49.8%', height: '49.8%' }}>
                    <img 
                      src="/default-avatar.png" 
                      alt="Pro" 
                      className="w-full h-full object-cover object-bottom drop-shadow-md" 
                      onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23080B14" opacity="0.4"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'; }} 
                    />
                 </div>
                 
                 <div className="absolute z-20 flex justify-center" style={{ left: '38.9%', top: '65.8%', width: '22.1%', height: '22.1%' }}>
                    <img 
                       src={`/archetypes/${archetype.replace(/\s+/g, '-').toLowerCase()}.png`}
                       alt={archetype}
                       className="w-full h-full object-contain brightness-0 opacity-90 drop-shadow-sm"
                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                 </div>
              </div>

              <div className="flex-1 flex flex-col justify-center py-1">
                 <div className="text-xl font-bold text-[#F4F7FB] mb-2">{archetype || "Your Pro"}</div>
                 
                 <div className="grid grid-cols-6 gap-1 w-full max-w-[220px]">
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">PAC</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.pac}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">SHO</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.sho}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">PAS</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.pas}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">DRI</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.dri}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">DEF</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.def}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">PHY</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.phy}</span></div>
                 </div>
                 
                 <div className="mt-3">
                    <span className="bg-[#4caf50] text-white px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase">{getArchetypeDisplayPosition(archetype, activeBounds.type)}</span>
                 </div>
              </div>
           </div>

           <div className="mt-4 px-2">
              <PlaystyleSlotsRow interactive={true} />
           </div>

           <div className="flex gap-2.5 mt-5 overflow-x-auto hide-scrollbar pb-1 px-1">
              {[
                { id: 'info', label: 'Info' }, 
                { id: 'archetype', label: 'Archetype' }, 
                { id: 'foundation', label: 'Foundation' }, 
                { id: 'attributes', label: 'Attributes' }, 
                { id: 'playstyles', label: 'PlayStyles' }
              ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${activeTab === tab.id ? 'bg-[#192235] text-[#21E6A4] border-[#21E6A4]/50 shadow-[0_0_10px_rgba(33,230,164,0.1)]' : 'bg-[#131A2A] text-[#8E9AAF] border-transparent hover:bg-[#192235]'}`}
                 >
                   {tab.label}
                 </button>
              ))}
           </div>
        </div>

        <div className="flex bg-[#0D1220] border border-[#26334A] p-1 rounded-xl mb-6 shadow-sm">
          <button
            onClick={() => { setGameVersion("FC26"); setAddedPoints({}); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${gameVersion === "FC26" ? "bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]" : "text-[#59657A] hover:text-[#8E9AAF]"}`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >FC 26 DATA</button>
          <button
            onClick={() => { setGameVersion("FC27"); setAddedPoints({}); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${gameVersion === "FC27" ? "bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]" : "text-[#59657A] hover:text-[#8E9AAF]"}`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >FC 27 DATA</button>
        </div>

        {/* TAB 1: INFO */}
        {activeTab === 'info' && (
          <section className="animate-fade-up space-y-4">
             <div className="bg-[#131A2A] border border-[#26334A] rounded-xl p-4">
                <div className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF] mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Build Summary</div>
                <div className="space-y-3">
                   <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                      <span className="text-xs text-[#59657A] font-bold uppercase">Archetype</span>
                      <span className="text-sm text-[#F4F7FB] font-black">{archetype}</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                      <span className="text-xs text-[#59657A] font-bold uppercase">Height & Weight</span>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-sm text-[#F4F7FB] font-black">{formatHeight(height)}</span>
                        <span className="text-xs text-[#8E9AAF] font-bold">{formatWeight(weight)}</span>
                      </div>
                   </div>
                   <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                      <span className="text-xs text-[#59657A] font-bold uppercase">AcceleRATE</span>
                      <span className="text-sm text-[#F4F7FB] font-black">{accelerate}</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                      <span className="text-xs text-[#59657A] font-bold uppercase">Mastery Progress</span>
                      <span className="text-sm text-[#4D8DFF] font-black">{masteryProgressPct}%</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs text-[#59657A] font-bold uppercase">Skills / W.Foot</span>
                      <span className="text-sm text-[#facc15] font-black">{smLevel}★ / {wfLevel}★</span>
                   </div>
                </div>
             </div>
          </section>
        )}

        {/* TAB 2: ARCHETYPE & SPECIALIZATIONS */}
        {activeTab === 'archetype' && (
          <section className="animate-fade-up space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3 pl-1">
                <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Select Archetype
                </span>
              </div>
              <div className="grid grid-cols-12 gap-2 pb-4">
                {[
                  { name: 'Progressor', col: 'col-start-2 col-span-2' },
                  { name: 'Disruptor', col: 'col-start-4 col-span-2' },
                  { name: 'Maestro', col: 'col-start-6 col-span-2' },
                  { name: 'Spark', col: 'col-start-8 col-span-2' },
                  { name: 'Finisher', col: 'col-start-10 col-span-2' }
                ].map(item => {
                  const isSelected = archetype === item.name;
                  const iconFilename = item.name.replace(/\s+/g, '-').toLowerCase() + '.png';
                  return (
                    <button key={item.name} onClick={() => handleArchetypeChange(item.name)} className={`${item.col} flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border-2 ${isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_15px_rgba(77,141,255,0.2)] scale-[1.02]' : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/40 opacity-70 hover:opacity-100'}`}>
                      <div className="w-7 h-7 mb-1.5 flex items-center justify-center">
                        <img src={`/archetypes/${iconFilename}`} alt={item.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                      </div>
                      <div className={`font-black text-[7.5px] sm:text-[8.5px] text-center uppercase tracking-wider leading-tight ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>{item.name}</div>
                    </button>
                  );
                })}
                {[
                  { name: 'Boss', col: 'col-start-1 col-span-2' },
                  { name: 'Marauder', col: 'col-start-3 col-span-2' },
                  { name: 'Recycler', col: 'col-start-5 col-span-2' },
                  { name: 'Creator', col: 'col-start-7 col-span-2' },
                  { name: 'Magician', col: 'col-start-9 col-span-2' },
                  { name: 'Target', col: 'col-start-11 col-span-2' }
                ].map(item => {
                  const isSelected = archetype === item.name;
                  const iconFilename = item.name.replace(/\s+/g, '-').toLowerCase() + '.png';
                  return (
                    <button key={item.name} onClick={() => handleArchetypeChange(item.name)} className={`${item.col} flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border-2 ${isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_15px_rgba(77,141,255,0.2)] scale-[1.02]' : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/40 opacity-70 hover:opacity-100'}`}>
                      <div className="w-7 h-7 mb-1.5 flex items-center justify-center">
                        <img src={`/archetypes/${iconFilename}`} alt={item.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                      </div>
                      <div className={`font-black text-[7.5px] sm:text-[8.5px] text-center uppercase tracking-wider leading-tight ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>{item.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {SPECIALIZATIONS_DATA[archetype] && (
              <div className="border-t border-[#26334A]/50 pt-6">
                <div className="flex items-center gap-2 mb-4 pl-1">
                  <div className="w-1 h-3 rounded-full bg-[#facc15]" />
                  <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    Specialization
                  </span>
                </div>
                {equippedSpecialization ? (
                  <div onClick={() => setActiveModal('specializations')} className="bg-gradient-to-r from-[#192235] to-[#131A2A] border border-[#facc15]/40 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(250,204,21,0.1)] cursor-pointer hover:border-[#facc15]/70 transition-all group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-[#facc15]/10 flex items-center justify-center border border-[#facc15]/30 group-hover:scale-110 transition-transform">
                          <div className="w-4 h-4 border-2 border-[#facc15] rotate-45 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-[#facc15] -rotate-45" /></div>
                       </div>
                       <div>
                         <div className="text-[11px] font-black tracking-widest uppercase text-[#facc15]" style={{ fontFamily: "'Orbitron', sans-serif" }}>{equippedSpecialization}</div>
                         <div className="text-[9px] text-[#F4F7FB] font-bold tracking-wider mt-1 uppercase">Active Specialization</div>
                       </div>
                    </div>
                    <span className="text-[#facc15] text-xs font-black">➔</span>
                  </div>
                ) : (
                  <div className="bg-[#131A2A] border border-[#26334A] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Choose a Specialization</div>
                      <div className="text-[9px] text-[#8E9AAF] font-medium tracking-wide mt-1">Boost key attributes and unlock unique playstyle perks.</div>
                    </div>
                    <button onClick={() => setActiveModal('specializations')} className="flex items-center gap-2 bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4D8DFF]/20 transition-colors shadow-[0_0_10px_rgba(77,141,255,0.1)]">
                      <span className="w-3 h-3 flex items-center justify-center border border-[#4D8DFF] rounded-full text-[8px] leading-none">+</span>
                      Browse
                    </button>
                  </div>
                )}
              </div>
            )}

            {SIGNATURE_PERKS_DATA[archetype] && (
              <div className="border-t border-[#26334A]/50 pt-6">
                <div className="flex items-center gap-2 mb-4 pl-1">
                  <div className="w-1 h-3 rounded-full bg-[#21E6A4]" />
                  <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    Signature Perks
                  </span>
                </div>
                <div className="space-y-2">
                  {SIGNATURE_PERKS_DATA[archetype].map((perk, index) => {
                    const isUnlocked = level >= perk.level;
                    const isExpanded = expandedPerk === perk.name;
                    return (
                      <div key={index} onClick={() => setExpandedPerk(isExpanded ? null : perk.name)} className={`px-4 py-3 rounded-xl border transition-all cursor-pointer ${isUnlocked ? 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]' : 'bg-[#0D1220]/60 border-[#26334A]/50 opacity-70'} ${isExpanded && isUnlocked ? 'shadow-sm ring-1 ring-[#21E6A4]/30' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-black uppercase tracking-wider ${isUnlocked ? 'text-[#F4F7FB]' : 'text-[#59657A]'}`} style={{ fontFamily: "'Orbitron', sans-serif" }}>{perk.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase tracking-widest ${isUnlocked ? 'text-[#21E6A4]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Rajdhani', sans-serif" }}>LVL {perk.level}</span>
                            <span className={`text-[#8E9AAF] text-[10px] transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>
                          </div>
                        </div>
                        {isExpanded && (
                           <div className="mt-3 pt-3 border-t border-[#26334A]/50 animate-fade-in">
                              <p className={`text-[10px] leading-relaxed font-medium ${isUnlocked ? 'text-[#8E9AAF]' : 'text-[#59657A]'}`}><span className={`font-bold ${isUnlocked ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>Effect:</span> {perk.desc}</p>
                           </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: FOUNDATION */}
        {activeTab === 'foundation' && (
          <section className="animate-fade-up space-y-4">
            <div className="flex items-center gap-2 mb-3 pl-1">
              <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Physicals & Base Setup
              </span>
            </div>
            
            <button 
              onClick={() => setActiveModal('physicals')} 
              className="w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3 flex items-center justify-between hover:bg-[#192235] hover:border-[#4D8DFF]/40 transition-all shadow-sm group mb-3"
            >
               <div className="flex items-center gap-5">
                  <div className="flex flex-col items-center">
                     <img src="/icons/height.png" alt="Height" className="w-4 h-4 mb-1 object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238E9AAF"><path d="M12 2L8 6h3v12H8l4 4 4-4h-3V6h3l-4-4z"/></svg>'; }} />
                     <span className="text-xs font-bold text-[#F4F7FB]">{formatHeight(height)}</span>
                  </div>
                  <div className="w-px h-6 bg-[#26334A]" />
                  <div className="flex flex-col items-center">
                     <img src="/icons/weight.png" alt="Weight" className="w-4 h-4 mb-1 object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238E9AAF"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'; }} />
                     <span className="text-xs font-bold text-[#F4F7FB]">{formatWeight(weight)}</span>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${accelerate === 'Lengthy' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30' : accelerate === 'Explosive' ? 'bg-[#4D8DFF]/20 text-[#4D8DFF] border border-[#4D8DFF]/30' : 'bg-[#26334A]/50 text-[#F4F7FB] border border-[#26334A]'}`}>
                    {accelerate}
                  </div>
                  <div className="text-[#8E9AAF] group-hover:text-[#F4F7FB] transition-colors text-xs">▼</div>
               </div>
            </button>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={() => setActiveModal('masteries')} className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center gap-3 hover:bg-[#192235] hover:border-[#8B5CF6]/40 transition-all group">
                 <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex shrink-0 items-center justify-center group-hover:scale-110 transition-transform p-1.5 overflow-hidden border border-[#8B5CF6]/20">
                     <img src="/icons/masteries.png" alt="Masteries" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238B5CF6"><path d="M12 2L2 9l10 7 10-7-10-7z"/></svg>'; }} />
                 </div>
                 <div className="text-left">
                     <div className="text-[10px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Masteries</div>
                     <div className="text-[8px] text-[#8E9AAF] font-bold uppercase mt-0.5 tracking-wider">{activeMasteriesCount} Active</div>
                 </div>
              </button>
              
              <button onClick={openFacilitiesModal} className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center gap-3 hover:bg-[#192235] hover:border-[#4D8DFF]/40 transition-all group">
                 <div className="w-8 h-8 shrink-0 rounded-full bg-[#080B14] border border-[#26334A] flex items-center justify-center p-1.5 overflow-hidden group-hover:scale-110 transition-transform">
                     <img src="/icons/facilities/default.png" alt="Facilities" className="w-full h-full object-contain opacity-80" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                 </div>
                 <div className="text-left">
                     <div className="text-[10px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Facilities</div>
                     <div className="text-[8px] text-[#8E9AAF] font-bold uppercase mt-0.5 tracking-wider">{activeFacilitiesCount} Equipped</div>
                 </div>
              </button>
            </div>
          </section>
        )}

        {/* TAB 4: ATTRIBUTES */}
        {activeTab === 'attributes' && currentStats && serverArchetypes && (
          <section className="animate-fade-up">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-[#4caf50]" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Player Attributes
                </span>
              </div>
              
              {/* RAW VS BOOSTED TOGGLE */}
              <div className="flex bg-[#131A2A] border border-[#26334A] rounded-lg p-0.5">
                <button 
                  onClick={() => setViewMode('raw')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors ${viewMode === 'raw' ? 'bg-[#192235] text-[#21E6A4]' : 'text-[#59657A] hover:text-[#8E9AAF]'}`}
                >
                  Raw Stats
                </button>
                <button 
                  onClick={() => setViewMode('boosted')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors ${viewMode === 'boosted' ? 'bg-[#192235] text-[#4D8DFF]' : 'text-[#59657A] hover:text-[#8E9AAF]'}`}
                >
                  Boosted
                </button>
              </div>
            </div>

            {/* MOVED SKILLS & WEAK FOOT TO TOP */}
            <div className="mb-4 shadow-sm animate-fade-in">
               <div className="bg-[#192235] rounded-t-lg px-4 py-2.5 flex justify-between items-center border-b border-[#26334A]/80">
                  <span className="text-[14px] font-bold text-[#F4F7FB]">Skills & W.Foot</span>
                  <span className="text-[10px] text-[#facc15] font-bold tracking-widest uppercase">Budget Priority</span>
               </div>
               <div className="bg-[#0D1220] rounded-b-lg overflow-hidden border border-[#26334A] border-t-0 p-4 flex justify-between items-center">
                  <div className="flex flex-col gap-2">
                     <span className="text-[12px] text-[#F4F7FB]">Skill Moves</span>
                     <span className="text-[12px] text-[#F4F7FB]">Weak Foot</span>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                     <button onClick={() => setActiveModal('skills_wf')} className="text-[13px] font-black text-[#facc15] hover:text-white transition-colors">{smLevel} ★</button>
                     <button onClick={() => setActiveModal('skills_wf')} className="text-[13px] font-black text-[#facc15] hover:text-white transition-colors">{wfLevel} ★</button>
                  </div>
               </div>
            </div>
            
            <div className="space-y-4 pb-20">
              {Object.entries(STAT_GROUPS).map(([category, stats]) => {
                // Calculate category average based on the view mode selected
                const catTotal = stats.reduce((sum, stat) => {
                  const caps = getStatCaps(archetype, stat);
                  const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[stat] || 70;
                  const invested = addedPoints[stat] || 0;
                  const rawVal = rawBase + invested;
                  return sum + (viewMode === 'raw' ? rawVal : (currentStats[stat] || 70));
                }, 0);
                const catAvg = Math.round(catTotal / stats.length);
                
                return (
                  <div key={category} className="mb-4 shadow-sm animate-fade-in">
                     <div className="bg-[#192235] rounded-t-lg px-4 py-2.5 flex justify-between items-center border-b border-[#26334A]/80">
                        <span className="text-[14px] font-bold text-[#F4F7FB]">{category}</span>
                        <span className="text-[14px] font-black text-[#4caf50] drop-shadow-[0_0_5px_rgba(76,175,80,0.3)]">{catAvg}</span>
                     </div>
                     <div className="bg-[#0D1220] rounded-b-lg overflow-hidden border border-[#26334A] border-t-0">
                        {stats.map(stat => {
                          const val = currentStats[stat] || 70; // Fully boosted stat
                          const displayName = CSV_STAT_MAP[stat] || stat;
                          const caps = getStatCaps(archetype, stat);
                          const physMod = physicalModifiers[stat] || 0;
                          const facMod = facilityModifiers[stat] || 0;
                          const mastMod = masteryModifiers[stat] || 0;
                          
                          const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[stat] || 70;
                          const invested = addedPoints[stat] || 0;
                          const rawVal = rawBase + invested;
                          
                          // Conditional display based on toggle
                          const displayVal = viewMode === 'raw' ? rawVal : val;
                          const showModifiers = viewMode === 'boosted';
                          
                          return (
                            <div key={stat} className="px-4 py-2.5 border-b border-[#26334A]/40 last:border-0 hover:bg-[#131A2A] transition-colors flex flex-col">
                               <div className="flex justify-between items-center mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] text-[#F4F7FB]">{displayName}</span>
                                    <div className="flex items-center gap-1">
                                       {showModifiers && physMod !== 0 && (
                                         <div className={`flex items-center gap-0.5 px-1 py-[1px] rounded border ${physMod > 0 ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30' : 'bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/30'}`}>
                                           <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>
                                           <span className="text-[8.5px] font-black">{physMod > 0 ? '+' : ''}{physMod}</span>
                                         </div>
                                       )}
                                       {showModifiers && facMod !== 0 && (
                                         <div className={`flex items-center gap-0.5 px-1 py-[1px] rounded border ${facMod > 0 ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30' : 'bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/30'}`}>
                                           <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 11V3H7v4H3v14h18V11h-4zm-8-6h4v14H9V5zm-4 6h2v10H5v-10zm14 10h-2v-8h2v8z"/></svg>
                                           <span className="text-[8.5px] font-black">{facMod > 0 ? '+' : ''}{facMod}</span>
                                         </div>
                                       )}
                                       {showModifiers && mastMod !== 0 && (
                                         <div className={`flex items-center gap-0.5 px-1 py-[1px] rounded border ${mastMod > 0 ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30' : 'bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/30'}`}>
                                           <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                           <span className="text-[8.5px] font-black">{mastMod > 0 ? '+' : ''}{mastMod}</span>
                                         </div>
                                       )}
                                    </div>
                                  </div>
                                  <span className="text-[13px] font-bold text-[#F4F7FB]">{displayVal}</span>
                               </div>
                               <div className="flex items-center gap-3 w-full group">
                                  <button onClick={() => handleSliderChange(stat, displayVal - 1)} disabled={invested <= 0} className="w-5 h-5 flex items-center justify-center text-[#8E9AAF] bg-[#192235] rounded border border-[#26334A] hover:bg-[#26334A] hover:text-[#F4F7FB] disabled:opacity-30 transition-all text-xs font-black shrink-0">-</button>
                                  <div className="flex-1 h-2 bg-[#192235] rounded-full relative overflow-hidden group-hover:ring-1 ring-[#4D8DFF]/30 transition-all cursor-pointer">
                                     <div className="absolute top-0 left-0 h-full bg-[#4caf50] rounded-full transition-all" style={{ width: `${displayVal}%` }} />
                                     <input type="range" min="0" max="99" value={displayVal} onChange={(e) => handleSliderChange(stat, parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                  </div>
                                  <button onClick={() => handleSliderChange(stat, displayVal + 1)} disabled={displayVal >= (caps.max || 99) || availableAp < getApCost(archetype, stat, rawBase + invested + 1)} className="w-5 h-5 flex items-center justify-center text-[#8E9AAF] bg-[#192235] rounded border border-[#26334A] hover:bg-[#26334A] hover:text-[#F4F7FB] disabled:opacity-30 transition-all text-xs font-black shrink-0">+</button>
                               </div>
                            </div>
                          );
                        })}
                     </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 5: PLAYSTYLES */}
        {activeTab === 'playstyles' && (
          <section className="animate-fade-up">
            <div className="flex items-center gap-2 mb-3 pl-1">
              <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                PlayStyle Assignments
              </span>
            </div>
            
            <div className="bg-[#131A2A] border border-[#26334A] rounded-xl p-4 space-y-5">
               <div>
                  <div className="text-[10px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-2 flex justify-between">
                     <span>PlayStyle+</span>
                     <span className="text-[8px] text-[#59657A]">SIGNATURE & SPEC</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <GridSlot slot={{ id: 'base', type: 'gold', name: basePsPlus, unlocked: true, unlockText: 'SIG' }} interactive={false} />
                     <GridSlot slot={{ id: 'spec', type: 'gold', name: specPlaystyle, unlocked: !!equippedSpecialization, unlockText: 'SPEC' }} interactive={true} onClick={() => setActiveModal('specializations')} />
                  </div>
               </div>

               <div>
                  <div className="text-[10px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-2 flex justify-between">
                     <span>Pro Level Unlocks</span>
                     <span className="text-[8px] text-[#21E6A4]">TAP TO EDIT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     {[0, 1, 2].map(idx => (
                        <GridSlot 
                           key={idx}
                           slot={{ id: `lvl${idx}`, type: 'silver', name: equippedPlaystyles[idx], unlocked: level >= [5, 15, 40][idx], unlockText: `LVL ${[5, 15, 40][idx]}` }} 
                           interactive={true} 
                           onClick={() => setActiveModal('playstyles')} 
                        />
                     ))}
                  </div>
               </div>

               <div>
                  <div className="text-[10px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-2 flex justify-between">
                     <span>Facility Unlocks</span>
                     <span className="text-[8px] text-[#59657A]">VIA BUDGET</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <GridSlot slot={{ id: 'facil1', type: 'silver', name: fac1, unlocked: !!fac1, unlockText: 'FAC 1' }} interactive={false} />
                     <GridSlot slot={{ id: 'facil2', type: 'silver', name: fac2, unlocked: !!fac2, unlockText: 'FAC 2' }} interactive={false} />
                  </div>
               </div>
            </div>
          </section>
        )}

      </div>

      {/* =========================================
          MODALS / OVERLAYS
      ========================================= */}

      {/* AI GENERATOR MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#080B14] border border-[#4D8DFF]/40 rounded-2xl p-5 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>AI Player Creator</h3>
              <button 
                onClick={() => !isGeneratingAi && setIsAiModalOpen(false)} 
                disabled={isGeneratingAi}
                className="text-[#8E9AAF] hover:text-white transition-colors"
              >✕</button>
            </div>
            
            <p className="text-[11px] text-[#8E9AAF] mb-4 leading-relaxed">
              Type a player name, era, or description (e.g., <span className="text-[#F4F7FB] font-semibold">"Prime Gareth Bale 2013"</span> or <span className="text-[#F4F7FB] font-semibold">"A fast, physical box-to-box midfielder"</span>). Our AI scout and math engine will configure everything for you based on your current available AP.
            </p>

            {/* NEW: Archetype & Level Overrides */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">Archetype Preference</label>
                <select 
                  value={aiArchetypeLock}
                  onChange={(e) => setAiArchetypeLock(e.target.value)}
                  disabled={isGeneratingAi}
                  className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#F4F7FB] font-bold outline-none focus:border-[#4D8DFF] transition-colors disabled:opacity-50 appearance-none"
                >
                  <option value="AUTO">✨ Let AI Decide</option>
                  {serverArchetypes && Object.keys(serverArchetypes).map(arch => (
                     <option key={arch} value={arch}>{arch}</option>
                  ))}
                </select>
              </div>
              <div className="w-[110px] shrink-0">
                <label className="block text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">Target Level</label>
                <select
                  value={aiTargetLevel}
                  onChange={(e) => setAiTargetLevel(Number(e.target.value))}
                  disabled={isGeneratingAi}
                  className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#21E6A4] font-black outline-none focus:border-[#4D8DFF] transition-colors disabled:opacity-50 appearance-none"
                >
                  {Array.from({ length: 40 }, (_, i) => i + 1).map(l => (
                     <option key={l} value={l}>Lvl {l}</option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Enter player description..."
              disabled={isGeneratingAi}
              className="w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3 text-xs text-[#F4F7FB] focus:outline-none focus:border-[#4D8DFF] h-28 resize-none mb-4 disabled:opacity-50 transition-colors"
            />

            <button
              onClick={handleRunAiBuild}
              disabled={isGeneratingAi || !aiPrompt.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(77,141,255,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isGeneratingAi ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin" />
                  <span>Scouting & Optimizing Math...</span>
                </>
              ) : (
                <span>Generate Build ✨</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PHYSICALS MODAL */}
      {activeModal === 'physicals' && currentStats && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg mx-auto bg-[#080B14] rounded-t-3xl border-t border-[#4D8DFF]/50 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up overflow-hidden flex flex-col max-h-[85vh]">
             
             <div className="flex items-center justify-between p-5 bg-[#0D1220] border-b border-[#26334A]">
               <div>
                  <h2 className="text-lg font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Physical Attributes</h2>
                  <div className="text-[10px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1">Adjust Height & Weight</div>
               </div>
               <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-[#131A2A] text-[#8E9AAF] flex items-center justify-center hover:bg-[#192235] hover:text-[#F4F7FB] transition-colors">✕</button>
             </div>
             
             <div className="p-4 overflow-y-auto hide-scrollbar pb-12 flex gap-4">
                
                <div className="w-1/2 flex flex-col gap-6 pt-2">
                   <div>
                     <div className="flex justify-between items-end mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                        <span className="text-sm font-black text-[#F4F7FB]">{formatHeight(height)}</span>
                     </div>
                     <input type="range" min={activeBounds.minH} max={activeBounds.maxH} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full cursor-pointer accent-[#4D8DFF] h-1.5 bg-[#131A2A] rounded-lg appearance-none" />
                     <div className="flex justify-between mt-2">
                        <span className="text-[9px] font-bold text-[#59657A] tracking-wider uppercase">{formatHeight(activeBounds.minH)}<br/>MIN</span>
                        <span className="text-[9px] font-bold text-[#59657A] tracking-wider uppercase text-right">{formatHeight(activeBounds.maxH)}<br/>MAX</span>
                     </div>
                   </div>

                   <div className="mt-2">
                     <div className="flex justify-between items-end mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                        <span className="text-sm font-black text-[#F4F7FB]">{formatWeight(weight)}</span>
                     </div>
                     <input type="range" min={activeBounds.minW} max={activeBounds.maxW} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full cursor-pointer accent-[#4D8DFF] h-1.5 bg-[#131A2A] rounded-lg appearance-none" />
                     <div className="flex justify-between mt-2">
                        <span className="text-[9px] font-bold text-[#59657A] tracking-wider uppercase">{formatWeight(activeBounds.minW)}<br/>MIN</span>
                        <span className="text-[9px] font-bold text-[#59657A] tracking-wider uppercase text-right">{formatWeight(activeBounds.maxW)}<br/>MAX</span>
                     </div>
                   </div>
                </div>

                <div className="w-1/2 flex flex-col gap-2">
                   <div className="text-[9px] font-bold text-[#59657A] tracking-wider uppercase text-center mb-1">Affected Attributes</div>
                   <div className="bg-[#0D1220] border border-[#26334A] rounded-xl p-3 space-y-3">
                      {["Acceleration", "Agility", "Balance", "Jumping", "Sprint Speed", "Strength"].map(stat => {
                         const mod = physicalModifiers[stat] || 0;
                         const val = currentStats[stat] || 70;
                         
                         let colorClass = "text-[#59657A]";
                         let badgeClass = "bg-[#131A2A] text-[#8E9AAF]";
                         let sign = "+/-";
                         let modDisplay = "0";

                         if (mod > 0) {
                           colorClass = "text-[#21E6A4]";
                           badgeClass = "bg-[#21E6A4]/10 text-[#21E6A4] border border-[#21E6A4]/30";
                           sign = "+";
                           modDisplay = mod.toString();
                         } else if (mod < 0) {
                           colorClass = "text-[#ff4d4d]";
                           badgeClass = "bg-[#ff4d4d]/10 text-[#ff4d4d] border border-[#ff4d4d]/30";
                           sign = "";
                           modDisplay = mod.toString();
                         }

                         return (
                           <div key={stat} className="flex items-center justify-between">
                              <span className="text-[10px] font-bold tracking-wide uppercase text-[#8E9AAF]">{stat}</span>
                              <div className="flex items-center gap-2">
                                 <span className={`w-6 text-center text-[9px] font-black rounded ${badgeClass}`}>{sign}{modDisplay}</span>
                                 <span className={`text-[11px] font-black w-4 text-right ${colorClass}`}>{val}</span>
                              </div>
                           </div>
                         );
                      })}
                   </div>
                </div>

             </div>
          </div>
        </div>
      )}

      {/* SKILLS & WEAK FOOT MODAL */}
      {activeModal === 'skills_wf' && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
           <div className="w-full max-w-lg mx-auto bg-[#080B14] rounded-t-3xl border-t border-[#4D8DFF]/50 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-5 bg-[#0D1220] border-b border-[#26334A]">
                 <div>
                    <h2 className="text-lg font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Skills & Weak Foot</h2>
                    <div className="text-[10px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1">AP Remaining: {availableAp}</div>
                 </div>
                 <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-[#131A2A] text-[#8E9AAF] flex items-center justify-center hover:bg-[#192235] hover:text-[#F4F7FB] transition-colors">✕</button>
              </div>
              <div className="p-5 space-y-4 pb-12">
                  <div className="flex items-center justify-between bg-[#131A2A] p-4 rounded-xl border border-[#26334A]">
                     <div>
                        <div className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wide">Skill Moves</div>
                        <div className="text-[9px] text-[#59657A] font-medium tracking-widest uppercase mt-0.5">Min: {activeStarCaps.sm.min} <span className="mx-1">•</span> Max: {activeStarCaps.sm.max}</div>
                     </div>
                     <div className="flex items-center gap-4">
                        <button onClick={() => handleStarChange('sm', smLevel - 1)} disabled={smLevel <= activeStarCaps.sm.min} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">-</button>
                        <span className="text-[#4D8DFF] font-black text-xl w-10 text-center">{smLevel} <span className="opacity-70 text-[12px]">★</span></span>
                        <button onClick={() => handleStarChange('sm', smLevel + 1)} disabled={smLevel >= activeStarCaps.sm.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.sm.tier][smLevel + 1]} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">+</button>
                     </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#131A2A] p-4 rounded-xl border border-[#26334A]">
                     <div>
                        <div className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wide">Weak Foot</div>
                        <div className="text-[9px] text-[#59657A] font-medium tracking-widest uppercase mt-0.5">Min: {activeStarCaps.wf.min} <span className="mx-1">•</span> Max: {activeStarCaps.wf.max}</div>
                     </div>
                     <div className="flex items-center gap-4">
                        <button onClick={() => handleStarChange('wf', wfLevel - 1)} disabled={wfLevel <= activeStarCaps.wf.min} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">-</button>
                        <span className="text-[#4D8DFF] font-black text-xl w-10 text-center">{wfLevel} <span className="opacity-70 text-[12px]">★</span></span>
                        <button onClick={() => handleStarChange('wf', wfLevel + 1)} disabled={wfLevel >= activeStarCaps.wf.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.wf.tier][wfLevel + 1]} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">+</button>
                     </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* FACILITIES MODAL */}
      {activeModal === 'facilities' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A] z-40">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Club Facilities</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            
            <div className="p-4 bg-[#131A2A] border-b border-[#26334A] shadow-md z-40">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mb-0.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Club Level</div>
                  <div className="text-lg font-black text-[#F4F7FB]">{clubLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mb-0.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Remaining Budget</div>
                  <div className={`text-xl font-black ${remainingBudget < 0 ? 'text-[#ff4d4d]' : 'text-[#4D8DFF]'}`}>
                    {remainingBudget.toLocaleString()} <span className="text-[9px] text-[#59657A] ml-1">/ {CLUB_BUDGETS[clubLevel].toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <input type="range" min="1" max="10" value={clubLevel} onChange={(e) => setClubLevel(Number(e.target.value))} className="w-full accent-[#4D8DFF] cursor-pointer" />
            </div>

            <div className="flex flex-col h-full overflow-hidden bg-[#080B14]">
               <div className="w-full bg-[#0D1220] border-b border-[#26334A] max-h-[140px] overflow-y-auto hide-scrollbar z-30">
                  {Object.keys(FACILITIES).map(facName => {
                    const isSelected = selectedFacView === facName;
                    const equippedTier = equippedFacilities[facName];
                    const iconSlug = facName.toLowerCase().replace(/\s+/g, '-');
                    const iconPath = `/icons/facilities/${iconSlug}.png`;
                    
                    return (
                      <button key={facName} onClick={() => handleSelectFacilityView(facName)} className={`w-full px-4 py-2.5 flex items-center gap-3 text-left border-b border-[#26334A]/30 transition-colors ${isSelected ? 'bg-[#192235]' : 'hover:bg-[#131A2A]'}`}>
                        <div className="w-7 h-7 shrink-0 rounded bg-[#080B14] border border-[#26334A] flex items-center justify-center p-1 overflow-hidden">
                           <img src={iconPath} alt={facName} className="w-full h-full object-contain opacity-80" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                          <div className={`text-[11px] font-bold leading-snug tracking-wide ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>{facName}</div>
                          {equippedTier && <div className="text-[9px] text-[#21E6A4] uppercase tracking-wider font-bold">★ Tier {equippedTier}</div>}
                        </div>
                      </button>
                    );
                  })}
               </div>

               <div 
                 className="flex-1 relative flex flex-col items-center justify-center p-4 pt-8 perspective-[1000px] overflow-hidden"
                 onTouchStart={handleFacTouchStart}
                 onTouchMove={handleFacTouchMove}
                 onTouchEnd={handleFacTouchEnd}
               >
                  <div className="w-full flex justify-center items-center relative h-[340px]">
                     {[1, 2, 3].map(tier => {
                        const facility = FACILITIES[selectedFacView];
                        if (!facility) return null;
                        
                        const isActive = viewingFacTier === tier;
                        let transformStyle = 'translateX(0) scale(1)';
                        let zIndexStyle = 30;
                        let opacityStyle = 1;
                        
                        if (tier < viewingFacTier) {
                           transformStyle = 'translateX(-80px) scale(0.85) translateZ(-100px) rotateY(15deg)';
                           zIndexStyle = 20;
                           opacityStyle = 0.5;
                        } else if (tier > viewingFacTier) {
                           transformStyle = 'translateX(80px) scale(0.85) translateZ(-100px) rotateY(-15deg)';
                           zIndexStyle = 20;
                           opacityStyle = 0.5;
                        }

                        if (Math.abs(tier - viewingFacTier) > 1) {
                           opacityStyle = 0;
                           zIndexStyle = 10;
                        }

                        return (
                           <div 
                             key={tier} 
                             onClick={() => setViewingFacTier(tier)}
                             className="absolute transition-all duration-500 ease-out cursor-pointer"
                             style={{ transform: transformStyle, zIndex: zIndexStyle, opacity: opacityStyle }}
                           >
                              <div className={`w-[220px] h-[320px] rounded-xl flex flex-col bg-gradient-to-b from-[#192235] to-[#0D1220] border ${isActive ? 'border-[#4D8DFF]/60 shadow-[0_15px_40px_rgba(0,0,0,0.8)]' : 'border-[#26334A] shadow-xl'} overflow-hidden`}>
                                 <div className="pt-5 pb-3 px-3 text-center border-b border-[#26334A]/50 bg-[#131A2A]">
                                    <h3 className="text-[12px] font-black text-[#F4F7FB] uppercase tracking-widest leading-tight">{selectedFacView}</h3>
                                    <div className="flex justify-center gap-1 mt-2">
                                       {[1, 2, 3].map(star => (
                                          <svg key={star} className={`w-3.5 h-3.5 ${star <= tier ? 'text-[#F4F7FB]' : 'text-[#26334A]'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                       ))}
                                    </div>
                                 </div>
                                 <div className="flex-1 p-4 flex flex-col justify-center items-center">
                                    <div className="text-[10px] text-[#4D8DFF] uppercase tracking-widest mb-3 font-bold" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Attribute Boosts</div>
                                    <div className="flex flex-col gap-2 w-full">
                                       {facility.stats.map(stat => (
                                         <div key={stat} className="bg-[#080B14] rounded p-2 flex justify-between items-center border border-[#26334A]/50">
                                            <span className="text-[10px] font-bold text-[#F4F7FB] tracking-wider">{CSV_STAT_MAP[stat] || stat}</span>
                                            <span className="text-[11px] font-black text-[#21E6A4] drop-shadow-[0_0_5px_rgba(33,230,164,0.3)]">+{facility.boosts[tier - 1]}</span>
                                         </div>
                                       ))}
                                    </div>
                                    {tier === 3 && facility.playstyle && (
                                       <div className="mt-4 w-full text-center">
                                          <div className="text-[9px] text-[#facc15] uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Unlocks PlayStyle</div>
                                          <div className="bg-[#192235] border border-[#facc15]/30 rounded p-2 flex items-center justify-center gap-2">
                                             <img src={getPlaystyleIconPath(facility.playstyle, false)} className="w-4 h-4 object-contain" alt="" onError={e => {e.currentTarget.style.display = 'none'}}/>
                                             <span className="text-[10px] font-black text-[#F4F7FB] uppercase tracking-wider">{facility.playstyle}</span>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                                 <div className="py-4 bg-[#080B14] text-center border-t border-[#26334A]">
                                    <div className="text-[9px] text-[#8E9AAF] uppercase tracking-widest mb-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Purchase Cost</div>
                                    <div className="text-xl font-black text-[#4D8DFF] drop-shadow-[0_0_8px_rgba(77,141,255,0.4)]">{facility.cost[tier - 1].toLocaleString()}</div>
                                 </div>
                              </div>
                           </div>
                        )
                     })}
                  </div>

                  <div className="w-full px-6 mt-4 z-40">
                     <div className="flex justify-center gap-10 mb-4">
                        <button onClick={() => setViewingFacTier(Math.max(1, viewingFacTier - 1))} className="p-2 text-[#8E9AAF] hover:text-white transition-colors bg-[#131A2A] rounded-full border border-[#26334A] w-10 h-10 flex items-center justify-center font-bold">◄</button>
                        <button onClick={() => setViewingFacTier(Math.min(3, viewingFacTier + 1))} className="p-2 text-[#8E9AAF] hover:text-white transition-colors bg-[#131A2A] rounded-full border border-[#26334A] w-10 h-10 flex items-center justify-center font-bold">►</button>
                     </div>
                     {(() => {
                        const currentEquippedTier = equippedFacilities[selectedFacView];
                        if (currentEquippedTier === viewingFacTier) {
                           return <button onClick={() => handleRemoveFacility(selectedFacView)} className="w-full py-3.5 rounded-xl bg-[#080B14] text-[#ff4d4d] font-black uppercase tracking-widest text-[11px] border border-red-500/30 hover:bg-red-500/10 transition-all">Unequip</button>;
                        } else {
                           const costToRefund = currentEquippedTier ? FACILITIES[selectedFacView].cost[currentEquippedTier - 1] : 0;
                           const targetCost = FACILITIES[selectedFacView].cost[viewingFacTier - 1];
                           const canAfford = remainingBudget + costToRefund >= targetCost;
                           return (
                             <button onClick={() => handleEquipFacilityTier(selectedFacView, viewingFacTier)} disabled={!canAfford} className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg ${canAfford ? 'bg-white text-[#080B14] hover:bg-[#F4F7FB] shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#192235] text-[#59657A] cursor-not-allowed border border-[#26334A]'}`}>
                               {canAfford ? (currentEquippedTier ? 'Upgrade to Tier ' + viewingFacTier : 'Buy') : 'Insufficient Budget'}
                             </button>
                           );
                        }
                     })()}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MASTERIES MODAL */}
      {activeModal === 'masteries' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Masteries</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            
            <div className="p-4 bg-[#131A2A] border-b border-[#26334A] shadow-md z-10 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                 <div className="text-[11px] font-bold text-[#F4F7FB] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Mastery Progress</div>
                 <div className="text-sm font-black text-[#F4F7FB]">{masteryProgressPct}%</div>
              </div>
              <div className="flex items-center gap-4">
                 <div className={`w-8 h-8 rounded border-2 flex flex-col items-center justify-center gap-0.5 ${masteryProgressPct >= 50 ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' : masteryProgressPct > 0 ? 'border-[#4D8DFF] bg-[#4D8DFF]/10' : 'border-[#59657A] bg-[#0D1220]'}`}>
                    <svg className={`w-4 h-4 ${masteryProgressPct >= 50 ? 'text-[#8B5CF6]' : masteryProgressPct > 0 ? 'text-[#4D8DFF]' : 'text-[#59657A]'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 9l10 7 10-7-10-7zm0 10l-10-7v4l10 7 10-7v-4l-10 7z" /></svg>
                 </div>
                 <div className="flex-1 h-2 bg-[#080B14] rounded-full overflow-hidden border border-[#26334A]">
                    <div className="h-full bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] transition-all duration-500 ease-out" style={{ width: `${masteryProgressPct}%` }} />
                 </div>
              </div>
            </div>

            <div className="flex items-center px-4 py-2 bg-[#080B14] text-[9px] uppercase tracking-widest font-bold text-[#8E9AAF] border-b border-[#26334A]/50 sticky top-0 z-0">
               <div className="w-1/3 pl-2">Archetype</div>
               <div className="w-1/3 text-center">Lvl 10</div>
               <div className="w-1/3 text-center">Lvl 30</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 hide-scrollbar bg-[#080B14]">
              {serverArchetypes && Object.keys(serverArchetypes).map(arch => {
                const status = unlockedMasteries[arch] || { l10: false, l30: false };
                const masteryDef = MASTERIES[arch];
                if (!masteryDef) return null;
                const iconFilename = arch.replace(/\s+/g, '-').toLowerCase() + '.png';
                return (
                  <div key={arch} className="flex bg-[#0D1220] rounded-xl border border-[#26334A] overflow-hidden hover:border-[#4D8DFF]/40 transition-colors">
                    <div className="w-1/3 bg-[#131A2A] p-3 flex flex-col items-center justify-center border-r border-[#26334A]">
                       <div className="w-6 h-6 mb-1.5 flex items-center justify-center">
                          <img src={`/archetypes/${iconFilename}`} alt={arch} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                       </div>
                       <span className="text-[9px] font-black uppercase tracking-wider text-[#F4F7FB] text-center leading-tight">{arch}</span>
                    </div>
                    <button onClick={() => toggleMasteryUnlock(arch, 'l10')} className={`w-1/3 p-2 flex flex-col items-center justify-center border-r border-[#26334A] transition-all duration-200 group ${status.l10 ? 'bg-[#4D8DFF]/20' : 'bg-[#0D1220] hover:bg-[#131A2A]'}`}>
                       {Object.entries(masteryDef.l10).map(([stat, val]) => (
                          <div key={stat} className={`text-[10px] font-black tracking-widest uppercase transition-colors ${status.l10 ? 'text-[#4D8DFF]' : 'text-[#8E9AAF] group-hover:text-[#F4F7FB]'}`}>{STAT_ABBR[stat]} <span className="opacity-80 ml-0.5">+{val}</span></div>
                       ))}
                    </button>
                    <button onClick={() => toggleMasteryUnlock(arch, 'l30')} className={`w-1/3 p-2 flex flex-col items-center justify-center transition-all duration-200 group ${status.l30 ? 'bg-[#8B5CF6]/20' : 'bg-[#0D1220] hover:bg-[#131A2A]'}`}>
                       {Object.entries(masteryDef.l30).map(([stat, val]) => (
                          <div key={stat} className={`text-[10px] font-black tracking-widest uppercase transition-colors ${status.l30 ? 'text-[#8B5CF6]' : 'text-[#8E9AAF] group-hover:text-[#F4F7FB]'}`}>{STAT_ABBR[stat]} <span className="opacity-80 ml-0.5">+{val}</span></div>
                       ))}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-0 left-0 w-full p-4 bg-[#0D1220]/90 backdrop-blur-md border-t border-[#26334A] flex gap-3 z-20">
               <button onClick={() => setActiveModal(null)} className="flex-1 py-3 rounded-xl bg-[#131A2A] border border-[#26334A] text-[#8E9AAF] font-bold uppercase tracking-widest text-[10px] hover:bg-[#192235] hover:text-[#F4F7FB] transition-all">Cancel</button>
               <button onClick={() => setActiveModal(null)} className="flex-[2] py-3 rounded-xl bg-[#4D8DFF] text-[#080B14] font-black uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(77,141,255,0.3)] hover:bg-[#4D8DFF]/90 transition-all">Save to this Build Only</button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYSTYLE HUB MODAL */}
      {activeModal === 'playstyles' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>PlayStyle Hub</h2>
              <button onClick={() => { setActiveModal(null); setSelectedPsView(null); }} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#131A2A] border-b border-[#26334A] shadow-md z-10">
               <div className="flex gap-2">
                 <div className="text-[9px] font-bold text-[#59657A] uppercase tracking-widest">Slots</div>
                 <div className="flex gap-1.5">
                   {[0, 1, 2].map((slotIndex) => {
                     const isUnlocked = level >= [5, 15, 40][slotIndex];
                     const isFilled = equippedPlaystyles[slotIndex] !== '';
                     return <div key={slotIndex} className={`w-3 h-3 rounded-[3px] border ${!isUnlocked ? 'border-red-500/30 bg-red-500/10' : isFilled ? 'border-[#21E6A4] bg-[#21E6A4]/20' : 'border-[#4D8DFF]/40 bg-[#080B14]'}`} />
                   })}
                 </div>
               </div>
               <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mr-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>AP Remaining</span>
                  <span className="text-base font-black text-[#4D8DFF]">{availableAp}</span>
               </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${selectedPsView ? 'pb-64' : 'pb-8'} hide-scrollbar`}>
              <div>
                <div className="flex items-center gap-2 mb-3 border-b border-[#26334A] pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#facc15]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle+ (Gold)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-[#131A2A] border border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.15)] rounded-xl p-3.5 flex flex-row items-center gap-3 relative overflow-hidden group text-left">
                     <div className="absolute top-0 right-0 w-12 h-12 bg-[#facc15]/10 rounded-full blur-xl" />
                     <div className="w-1/2 flex items-center justify-center">
                       <img src={getPlaystyleIconPath(activePsPlus, true)} alt={activePsPlus} className="w-14 h-14 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                     </div>
                     <div className="w-1/2 flex flex-col justify-center">
                       <div className="text-[11px] font-black text-[#F4F7FB] uppercase tracking-wider leading-tight">{activePsPlus}</div>
                       <div className="text-[8px] text-[#facc15] font-bold uppercase mt-1 tracking-widest">{isPsPlusUnlocked ? (equippedSpecialization ? 'From Spec.' : 'Active') : 'Locked'}</div>
                     </div>
                  </button>
                </div>
              </div>

              {PLAYSTYLE_CATEGORIES.map(category => {
                 const categoryStyles = PLAYSTYLES_DATA.filter(ps => ps.category === category.id && ps.name !== activePsPlus);
                 if (categoryStyles.length === 0) return null;
                 return (
                   <div key={category.id}>
                     <div className="flex items-center gap-2 mb-3 border-b border-[#26334A] pb-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#8E9AAF]" />
                       <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{category.label}</span>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {categoryStyles.map(ps => {
                          const isEquipped = equippedPlaystyles.includes(ps.name);
                          const isSelected = selectedPsView === ps.name;
                          const { canEquip } = getUpgradeData(ps.reqs);
                          const isUnavailable = !canEquip && !isEquipped;

                          return (
                            <button 
                              key={ps.name} 
                              onClick={() => setSelectedPsView(ps.name)} 
                              disabled={isUnavailable}
                              className={`rounded-xl p-3 flex flex-row items-center gap-2.5 relative overflow-hidden text-left transition-all duration-200 border ${isUnavailable ? 'opacity-30 grayscale cursor-not-allowed bg-[#0D1220] border-[#26334A]' : isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_12px_rgba(77,141,255,0.2)] ring-1 ring-[#4D8DFF]/50' : isEquipped ? 'bg-[#131A2A] border-[#21E6A4]/60' : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]'}`}
                            >
                              <div className="w-1/2 flex items-center justify-center">
                                 <img src={getPlaystyleIconPath(ps.name, false)} alt={ps.name} className="w-12 h-12 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              </div>
                              <div className="w-1/2 flex flex-col justify-center">
                                {isEquipped && <span className="text-[7px] bg-[#21E6A4]/20 text-[#21E6A4] border border-[#21E6A4]/40 px-1 py-0.5 rounded font-black tracking-widest uppercase mb-0.5 w-fit">Equipped</span>}
                                {isUnavailable && <span className="text-[7px] bg-red-500/20 text-red-400 border border-red-500/40 px-1 py-0.5 rounded font-black tracking-widest uppercase mb-0.5 w-fit">Locked</span>}
                                <div className={`text-[10px] font-black uppercase tracking-wider leading-tight ${isEquipped ? 'text-[#21E6A4]' : 'text-[#F4F7FB]'}`}>{ps.name}</div>
                              </div>
                            </button>
                          )
                        })}
                     </div>
                   </div>
                 );
              })}
            </div>

            {selectedPsView && (
              <div className="absolute bottom-0 left-0 w-full bg-[#0D1220] border-t border-[#4D8DFF]/50 rounded-t-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up z-20">
                {(() => {
                  const ps = PLAYSTYLES_DATA.find(p => p.name === selectedPsView);
                  if (!ps) return null;
                  const { canEquip, cost, upgrades, reason } = getUpgradeData(ps.reqs);
                  const isEquipped = equippedPlaystyles.includes(ps.name);
                  return (
                    <div className="p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 flex items-center justify-center">
                            <img src={getPlaystyleIconPath(ps.name, false)} alt={ps.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          </div>
                          <div className="ml-1">
                             <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider">{ps.name}</h3>
                             <p className="text-[9px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{PLAYSTYLE_CATEGORIES.find(c => c.id === ps.category)?.label}</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedPsView(null)} className="text-[#59657A] hover:text-[#F4F7FB] font-bold p-1">✕</button>
                      </div>

                      <div className="bg-[#080B14] rounded-xl border border-[#26334A] p-4">
                        <div className="text-[9px] text-[#8E9AAF] uppercase tracking-widest mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Attribute Dependencies</div>
                        <div className="space-y-3">
                          {ps.reqs.map(req => {
                            const caps = getStatCaps(archetype, req.stat);
                            const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[req.stat] || 70;
                            const currentInvested = addedPoints[req.stat] || 0;
                            
                            // Visual tracking using Raw Base + User Added points ONLY
                            const userStatWithoutMods = rawBase + currentInvested;
                            const targetVal = req.min;
                            const isMet = userStatWithoutMods >= targetVal;
                            const capMax = caps.max || 99;
                            const isImpossible = targetVal > capMax;
                            const fillPct = Math.min(100, (userStatWithoutMods / targetVal) * 100);
                            
                            return (
                              <div key={req.stat}>
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                  <span className={isMet ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}>{req.stat}</span>
                                  <span className={isMet ? 'text-[#21E6A4]' : isImpossible ? 'text-[#ff4d4d]' : 'text-[#8E9AAF]'}>{userStatWithoutMods} <span className="text-[#59657A] mx-0.5">/</span> {targetVal}</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#131A2A] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fillPct}%`, backgroundColor: isMet ? '#21E6A4' : '#59657A' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <button onClick={() => handleActionPlaystyle(ps.name, upgrades, isEquipped)} disabled={!isEquipped && (!canEquip || (!hasEmptySlot && Object.keys(upgrades).length === 0 && cost === 0))} className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 ${isEquipped ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20' : !canEquip ? 'bg-[#131A2A] text-[#59657A] border border-[#26334A] cursor-not-allowed' : !hasEmptySlot ? 'bg-[#131A2A] text-[#ff4d4d] border border-red-500/30 cursor-not-allowed' : 'bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white shadow-[0_0_20px_rgba(77,141,255,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]'}`}>
                        {isEquipped ? 'Deselect Element' : !canEquip ? reason : !hasEmptySlot ? 'Slots Full' : cost > 0 ? `Quick Equip [ ${cost} AP ]` : 'Equip PlayStyle'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPECIALIZATIONS MODAL */}
      {activeModal === 'specializations' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Browse Specializations</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#131A2A] border-b border-[#26334A] shadow-md z-10">
               <div className="text-[10px] text-[#8E9AAF] tracking-wide font-medium">Select a path for <span className="font-bold text-[#F4F7FB] uppercase tracking-widest">{archetype}</span></div>
               <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mr-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>AP Remaining</span>
                  <span className="text-base font-black text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">{availableAp}</span>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8 hide-scrollbar">
              {(!SPECIALIZATIONS_DATA[archetype] || SPECIALIZATIONS_DATA[archetype].length === 0) ? (
                 <div className="text-center text-[#8E9AAF] text-xs font-bold uppercase tracking-widest mt-10">No Specializations available for this archetype.</div>
              ) : (
                SPECIALIZATIONS_DATA[archetype].map((spec) => {
                  const isEquipped = equippedSpecialization === spec.name;
                  const { canEquip, cost, upgrades, reason } = getUpgradeData(spec.reqs);
                  return (
                    <div key={spec.name} className={`bg-[#0D1220] rounded-2xl overflow-hidden transition-all duration-300 border ${isEquipped ? 'border-[#facc15] shadow-[0_0_20px_rgba(250,204,21,0.15)] ring-1 ring-[#facc15]/30' : 'border-[#26334A]'}`}>
                       <div className="p-4 flex flex-col gap-4">
                          <div className="flex justify-between items-start gap-4">
                             <div className="flex-1">
                               <div className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider">{spec.name}</div>
                               <div className="text-[9px] text-[#8E9AAF] font-bold tracking-widest uppercase mt-0.5 mb-2">{spec.inspiredBy}</div>
                               <div className="text-[10px] text-[#8E9AAF] font-medium leading-relaxed bg-[#080B14] p-2.5 rounded-lg border border-[#26334A]/50">
                                 <span className="font-bold text-[#facc15] block mb-1">{spec.perk}</span>
                                 {spec.desc}
                               </div>
                             </div>
                             <div className="w-[120px] shrink-0 bg-[#080B14] rounded-xl border border-[#26334A] p-3 shadow-inner">
                               <div className="space-y-2.5">
                                 {spec.reqs.map(req => {
                                    const caps = getStatCaps(archetype, req.stat);
                                    const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[req.stat] || 70;
                                    const currentInvested = addedPoints[req.stat] || 0;
                                    
                                    // Visual tracking using Raw Base + User Added points ONLY
                                    const userStatWithoutMods = rawBase + currentInvested;
                                    const targetVal = req.min;
                                    const isMet = userStatWithoutMods >= targetVal;
                                    const isImpossible = targetVal > (caps.max || 99);
                                    
                                    return (
                                       <div key={req.stat}>
                                          <div className="flex justify-between items-end mb-1">
                                             <span className="text-[9px] font-bold uppercase tracking-wide text-[#8E9AAF] leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>{STAT_ABBR[req.stat]}</span>
                                             <span className={`text-[10px] font-black leading-none ${isMet ? 'text-[#21E6A4]' : isImpossible ? 'text-[#ff4d4d]' : 'text-[#F4F7FB]'}`}>{userStatWithoutMods}<span className="text-[#59657A] font-medium text-[8px] mx-0.5">/</span>{targetVal}</span>
                                          </div>
                                       </div>
                                    )
                                 })}
                               </div>
                             </div>
                          </div>
                          <button onClick={() => handleActionSpecialization(spec.name, upgrades, isEquipped)} disabled={!isEquipped && !canEquip} className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 ${isEquipped ? 'bg-[#131A2A] text-[#facc15] border border-[#facc15]/30 hover:bg-[#192235]' : !canEquip ? 'bg-[#131A2A] text-[#59657A] border border-[#26334A] cursor-not-allowed' : 'bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] hover:bg-[#4D8DFF] hover:text-[#080B14] shadow-[0_0_15px_rgba(77,141,255,0.15)]'}`}>
                            {isEquipped ? '✔ Equipped' : !canEquip ? reason : cost > 0 ? `Unlock (${cost} AP)` : 'Equip Path'}
                          </button>
                       </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
