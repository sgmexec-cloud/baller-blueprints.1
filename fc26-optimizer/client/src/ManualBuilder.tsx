import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from "@/lib/trpc"; 

// PHASE 1 IMPORTS
import { STAT_GROUPS, CSV_STAT_MAP, CLUB_BUDGETS } from '@/constants/builderData';
import { ARCH_PHYSICALS, ARCHETYPE_STAR_CAPS, STAR_UPGRADE_COSTS } from '@/constants/archetypeData';
import { MASTERIES, SPECIALIZATIONS_DATA, FACILITIES, FIXED_PLAYSTYLE_PLUS } from '@/constants/playstylesData';
import type { StatReq } from '@/types/builder';

// PHASE 2 IMPORTS - Helper Utilities
import { 
  getArchetypeDisplayPosition, 
  formatHeight, 
  formatWeight, 
  getApCost, 
  getCostForPoints, 
  getTotalStarCost, 
  getModifier, 
  getStatCaps 
} from '@/utils/builderUtils';

// PHASE 3 IMPORTS - Extracted Sub-Components & Modals
import { PlaystyleSlotsRow } from '@/components/builder/PlaystyleSlots';
import { InfoTab } from '@/components/builder/InfoTab';
import { ArchetypeTab } from '@/components/builder/ArchetypeTab';
import { FoundationTab } from '@/components/builder/FoundationTab';
import { AttributesTab } from '@/components/builder/AttributesTab';
import { PlaystylesTab } from '@/components/builder/PlaystylesTab';
import { AiGeneratorModal } from '@/components/builder/AiGeneratorModal';
import { PhysicalsModal } from '@/components/builder/PhysicalsModal';
import { SkillsModal } from '@/components/builder/SkillsModal';
import { FacilitiesModal } from '@/components/builder/FacilitiesModal';
import { MasteriesModal } from '@/components/builder/MasteriesModal';
import { PlaystyleHubModal } from '@/components/builder/PlaystyleHubModal';

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
                setAiTargetLevel(level);
                setAiArchetypeLock("AUTO");
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
              <PlaystyleSlotsRow 
                interactive={true}
                basePsPlus={basePsPlus}
                specPlaystyle={specPlaystyle}
                equippedSpecialization={equippedSpecialization}
                equippedPlaystyles={equippedPlaystyles}
                level={level}
                fac1={fac1}
                fac2={fac2}
                setActiveModal={setActiveModal}
              />
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

        {/* TAB RENDERING VIA EXTRACTED SUB-COMPONENTS */}
        {activeTab === 'info' && (
          <InfoTab 
            archetype={archetype}
            height={height}
            weight={weight}
            accelerate={accelerate}
            masteryProgressPct={masteryProgressPct}
            smLevel={smLevel}
            wfLevel={wfLevel}
          />
        )}

        {activeTab === 'archetype' && (
          <ArchetypeTab 
            archetype={archetype}
            handleArchetypeChange={handleArchetypeChange}
            equippedSpecialization={equippedSpecialization}
            setActiveModal={setActiveModal}
            level={level}
            expandedPerk={expandedPerk}
            setExpandedPerk={setExpandedPerk}
          />
        )}

        {activeTab === 'foundation' && (
          <FoundationTab 
            height={height}
            weight={weight}
            accelerate={accelerate}
            activeMasteriesCount={activeMasteriesCount}
            activeFacilitiesCount={activeFacilitiesCount}
            setActiveModal={setActiveModal}
          />
        )}

        {activeTab === 'attributes' && currentStats && serverArchetypes && (
          <AttributesTab 
            archetype={archetype}
            serverArchetypes={serverArchetypes}
            currentStats={currentStats}
            addedPoints={addedPoints}
            viewMode={viewMode}
            setViewMode={setViewMode}
            smLevel={smLevel}
            wfLevel={wfLevel}
            setActiveModal={setActiveModal}
            physicalModifiers={physicalModifiers}
            facilityModifiers={facilityModifiers}
            masteryModifiers={masteryModifiers}
            handleSliderChange={handleSliderChange}
            availableAp={availableAp}
          />
        )}

        {activeTab === 'playstyles' && (
          <PlaystylesTab 
            level={level}
            basePsPlus={basePsPlus}
            specPlaystyle={specPlaystyle}
            equippedSpecialization={equippedSpecialization}
            equippedPlaystyles={equippedPlaystyles}
            fac1={fac1}
            fac2={fac2}
            setActiveModal={setActiveModal}
          />
        )}

      </div>

      {/* MODALS RENDERING VIA EXTRACTED SUB-COMPONENTS */}
      <AiGeneratorModal 
        isOpen={isAiModalOpen}
        setIsOpen={setIsAiModalOpen}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        isGeneratingAi={isGeneratingAi}
        handleRunAiBuild={handleRunAiBuild}
        aiArchetypeLock={aiArchetypeLock}
        setAiArchetypeLock={setAiArchetypeLock}
        aiTargetLevel={aiTargetLevel}
        setAiTargetLevel={setAiTargetLevel}
        serverArchetypes={serverArchetypes}
      />

      <PhysicalsModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        activeBounds={activeBounds}
        height={height}
        setHeight={setHeight}
        weight={weight}
        setWeight={setWeight}
        physicalModifiers={physicalModifiers}
        currentStats={currentStats}
      />

      <SkillsModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        activeStarCaps={activeStarCaps}
        smLevel={smLevel}
        wfLevel={wfLevel}
        handleStarChange={handleStarChange}
        availableAp={availableAp}
      />

      <FacilitiesModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        clubLevel={clubLevel}
        setClubLevel={setClubLevel}
        remainingBudget={remainingBudget}
        equippedFacilities={equippedFacilities}
        selectedFacView={selectedFacView}
        handleSelectFacilityView={handleSelectFacilityView}
        viewingFacTier={viewingFacTier}
        setViewingFacTier={setViewingFacTier}
        handleFacTouchStart={handleFacTouchStart}
        handleFacTouchMove={handleFacTouchMove}
        handleFacTouchEnd={handleFacTouchEnd}
        handleRemoveFacility={handleRemoveFacility}
        handleEquipFacilityTier={handleEquipFacilityTier}
      />

      <MasteriesModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        masteryProgressPct={masteryProgressPct}
        serverArchetypes={serverArchetypes}
        unlockedMasteries={unlockedMasteries}
        toggleMasteryUnlock={toggleMasteryUnlock}
      />

      <PlaystyleHubModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        level={level}
        availableAp={availableAp}
        activePsPlus={activePsPlus}
        isPsPlusUnlocked={isPsPlusUnlocked}
        equippedSpecialization={equippedSpecialization}
        equippedPlaystyles={equippedPlaystyles}
        selectedPsView={selectedPsView}
        setSelectedPsView={setSelectedPsView}
        getUpgradeData={getUpgradeData}
        handleActionPlaystyle={handleActionPlaystyle}
        hasEmptySlot={hasEmptySlot}
        archetype={archetype}
        serverArchetypes={serverArchetypes}
        addedPoints={addedPoints}
      />

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
                                    
                                    const userStatWithoutMods = rawBase + currentInvested;
                                    const targetVal = req.min;
                                    const isMet = userStatWithoutMods >= targetVal;
                                    const isImpossible = targetVal > (caps.max || 99);
                                    
                                    return (
                                       <div key={req.stat}>
                                          <div className="flex justify-between items-end mb-1">
                                             <span className="text-[9px] font-bold uppercase tracking-wide text-[#8E9AAF] leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>{req.stat}</span>
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
