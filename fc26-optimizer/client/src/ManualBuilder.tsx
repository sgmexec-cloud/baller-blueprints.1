import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from "@/lib/trpc"; 
import { ARCHETYPE_ATTRIBUTE_CAPS } from '../../server/data27/archetypeCaps';
import { UPGRADE_COSTS } from '../../server/data27/upgradeCosts';

const STAT_GROUPS: Record<string, string[]> = {
  "Pace": ["Acceleration", "Sprint Speed"],
  "Shooting": ["Attack Positioning", "Finishing", "Shot Power", "Long Shots", "Volleys", "Penalties"],
  "Passing": ["Vision", "Crossing", "FK Accuracy", "Short Passing", "Long Passing", "Curve"],
  "Dribbling": ["Agility", "Balance", "Reactions", "Ball Control", "Dribbling", "Composure"],
  "Defending": ["Interceptions", "Heading Accuracy", "Def Awareness", "Standing Tackle", "Sliding Tackle"],
  "Physical": ["Jumping", "Stamina", "Strength", "Aggression"]
};

// Maps TRPC readable names to the camelCase keys used in the caps configuration
const STAT_KEY_MAP: Record<string, string> = {
  "Acceleration": "acceleration",
  "Sprint Speed": "sprintSpeed",
  "Attack Positioning": "attPosition",
  "Finishing": "finishing",
  "Shot Power": "shotPower",
  "Long Shots": "longShots",
  "Volleys": "volleys",
  "Penalties": "penalties",
  "Vision": "vision",
  "Crossing": "crossing",
  "FK Accuracy": "fkAccuracy",
  "Short Passing": "shortPassing",
  "Long Passing": "longPassing",
  "Curve": "curve",
  "Agility": "agility",
  "Balance": "balance",
  "Reactions": "reactions",
  "Ball Control": "ballControl",
  "Dribbling": "dribbling",
  "Composure": "composure",
  "Interceptions": "interceptions",
  "Heading Accuracy": "headingAcc",
  "Def Awareness": "defAware",
  "Standing Tackle": "standingTackle",
  "Sliding Tackle": "slidingTackle",
  "Jumping": "jumping",
  "Stamina": "stamina",
  "Strength": "strength",
  "Aggression": "aggression"
};

const CSV_STAT_MAP: Record<string, string> = {
  "Acceleration": "Acceleration",
  "Sprint Speed": "Sprint Speed",
  "Attack Positioning": "Att. Position",
  "Finishing": "Finishing",
  "Shot Power": "Shot Power",
  "Long Shots": "Long Shots",
  "Volleys": "Volleys",
  "Penalties": "Penalties",
  "Vision": "Vision",
  "Crossing": "Crossing",
  "FK Accuracy": "FK Acc.",
  "Short Passing": "Short Pass",
  "Long Passing": "Long Pass",
  "Curve": "Curve",
  "Agility": "Agility",
  "Balance": "Balance",
  "Reactions": "Reactions",
  "Ball Control": "Ball Control",
  "Dribbling": "Dribbling",
  "Composure": "Composure",
  "Interceptions": "Interceptions",
  "Heading Accuracy": "Heading Acc.",
  "Def Awareness": "Def. Aware",
  "Standing Tackle": "Stand Tackle",
  "Sliding Tackle": "Slide Tackle",
  "Jumping": "Jumping",
  "Stamina": "Stamina",
  "Strength": "Strength",
  "Aggression": "Aggression"
};

const ARCH_PHYSICALS: Record<string, { baseH: number, minH: number, maxH: number, baseW: number, minW: number, maxW: number, type: 'DEF' | 'MID_ATT' | 'GK' }> = {
  'Shot Stopper': { baseH: 188, minH: 179, maxH: 197, baseW: 90, minW: 80, maxW: 100, type: 'GK' },
  'Sweeper Keeper': { baseH: 192, minH: 184, maxH: 200, baseW: 90, minW: 80, maxW: 100, type: 'GK' },
  'Progressor': { baseH: 186, minH: 177, maxH: 195, baseW: 85, minW: 75, maxW: 95, type: 'DEF' },
  'Boss': { baseH: 188, minH: 180, maxH: 196, baseW: 90, minW: 80, maxW: 100, type: 'DEF' },
  'Disruptor': { baseH: 178, minH: 168, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'DEF' },
  'Marauder': { baseH: 178, minH: 168, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'DEF' },
  'Recycler': { baseH: 182, minH: 172, maxH: 192, baseW: 75, minW: 65, maxW: 85, type: 'MID_ATT' },
  'Maestro': { baseH: 175, minH: 162, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'MID_ATT' },
  'Creator': { baseH: 175, minH: 162, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'MID_ATT' },
  'Spark': { baseH: 175, minH: 162, maxH: 188, baseW: 70, minW: 60, maxW: 80, type: 'MID_ATT' },
  'Magician': { baseH: 175, minH: 162, maxH: 188, baseW: 70, minW: 60, maxW: 80, type: 'MID_ATT' },
  'Finisher': { baseH: 177, minH: 164, maxH: 190, baseW: 80, minW: 70, maxW: 90, type: 'MID_ATT' },
  'Target': { baseH: 186, minH: 177, maxH: 195, baseW: 90, minW: 80, maxW: 100, type: 'MID_ATT' },
  'Target Forward': { baseH: 186, minH: 177, maxH: 195, baseW: 90, minW: 80, maxW: 100, type: 'MID_ATT' } 
};

// --- Star Ratings Config ---
const STAR_UPGRADE_COSTS: Record<string, number[]> = {
  star0: [0, 0, 5, 10, 25, 40],
  star1: [0, 0, 8, 15, 25, 40],
  star2: [0, 0, 10, 10, 20, 35],
  star3: [0, 0, 10, 20, 35, 50],
  star4: [0, 0, 10, 8, 15, 25],
};

const ARCHETYPE_STAR_CAPS: Record<string, { sm: { min: number, max: number, tier: string }, wf: { min: number, max: number, tier: string } }> = {
  'Shot Stopper': { sm: { min: 1, max: 2, tier: 'star0' }, wf: { min: 1, max: 3, tier: 'star3' } },
  'Sweeper Keeper': { sm: { min: 1, max: 3, tier: 'star0' }, wf: { min: 1, max: 4, tier: 'star1' } },
  'Progressor': { sm: { min: 2, max: 4, tier: 'star2' }, wf: { min: 3, max: 4, tier: 'star1' } },
  'Boss': { sm: { min: 2, max: 3, tier: 'star0' }, wf: { min: 2, max: 4, tier: 'star3' } },
  'Disruptor': { sm: { min: 2, max: 4, tier: 'star2' }, wf: { min: 3, max: 5, tier: 'star3' } },
  'Marauder': { sm: { min: 2, max: 5, tier: 'star2' }, wf: { min: 3, max: 5, tier: 'star1' } },
  'Recycler': { sm: { min: 2, max: 4, tier: 'star4' }, wf: { min: 3, max: 5, tier: 'star1' } },
  'Maestro': { sm: { min: 2, max: 5, tier: 'star2' }, wf: { min: 3, max: 5, tier: 'star1' } },
  'Creator': { sm: { min: 2, max: 5, tier: 'star2' }, wf: { min: 3, max: 5, tier: 'star1' } },
  'Spark': { sm: { min: 3, max: 5, tier: 'star4' }, wf: { min: 3, max: 5, tier: 'star1' } },
  'Magician': { sm: { min: 3, max: 5, tier: 'star2' }, wf: { min: 3, max: 5, tier: 'star1' } },
  'Finisher': { sm: { min: 3, max: 5, tier: 'star4' }, wf: { min: 3, max: 5, tier: 'star3' } },
  'Target': { sm: { min: 2, max: 5, tier: 'star4' }, wf: { min: 2, max: 5, tier: 'star3' } },
  'Target Forward': { sm: { min: 2, max: 5, tier: 'star4' }, wf: { min: 2, max: 5, tier: 'star3' } }
};

// --- Facilities & Masteries Config ---
const CLUB_BUDGETS: Record<number, number> = {
  1: 1000000, 2: 1100000, 3: 1200000, 4: 1300000, 5: 1500000,
  6: 1700000, 7: 1900000, 8: 2100000, 9: 2300000, 10: 2500000
};

const MASTERIES: Record<string, { l10: Record<string, number>, l30: Record<string, number> }> = {
  'Progressor': { l10: { 'Long Passing': 1, 'Standing Tackle': 1 }, l30: { 'Standing Tackle': 1 } },
  'Boss': { l10: { 'Aggression': 1, 'Strength': 1 }, l30: { 'Strength': 1 } },
  'Disruptor': { l10: { 'Stamina': 1, 'Interceptions': 1 }, l30: { 'Interceptions': 1 } },
  'Marauder': { l10: { 'Sliding Tackle': 1, 'Sprint Speed': 1 }, l30: { 'Sprint Speed': 1 } },
  'Recycler': { l10: { 'Def Awareness': 1, 'Short Passing': 1 }, l30: { 'Short Passing': 1 } },
  'Maestro': { l10: { 'Reactions': 1, 'Ball Control': 1 }, l30: { 'Ball Control': 1 } },
  'Creator': { l10: { 'FK Accuracy': 1, 'Vision': 1 }, l30: { 'Vision': 1 } },
  'Spark': { l10: { 'Crossing': 1, 'Dribbling': 1 }, l30: { 'Dribbling': 1 } },
  'Magician': { l10: { 'Curve': 1, 'Acceleration': 1 }, l30: { 'Acceleration': 1 } },
  'Finisher': { l10: { 'Finishing': 1, 'Composure': 1 }, l30: { 'Finishing': 2 } }, 
  'Target': { l10: { 'Balance': 1, 'Jumping': 1 }, l30: { 'Jumping': 1 } },
  'Target Forward': { l10: { 'Balance': 1, 'Jumping': 1 }, l30: { 'Jumping': 1 } }
};

const FACILITIES: Record<string, { stats: string[], boosts: number[], cost: number[] }> = {
  'Equipment Manager': { stats: ['Jumping', 'Stamina'], boosts: [2, 3, 4], cost: [200000, 600000, 1200000] },
  'Head Groundskeeper': { stats: ['Balance', 'Ball Control'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Performance Lab': { stats: ['Vision', 'Short Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Scout': { stats: ['Attack Positioning', 'Def Awareness'], boosts: [2, 5, 7], cost: [100000, 400000, 1100000] },
  'Sports Psychologist': { stats: ['Aggression', 'Composure'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000] },
  'Sports Scientist': { stats: ['Acceleration', 'Reactions'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Att. Tactical Coach': { stats: ['Attack Positioning', 'Vision'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000] },
  'Def. Tactical Coach': { stats: ['Interceptions', 'Def Awareness'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000] },
  'Fitness Coach': { stats: ['Jumping', 'Stamina'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Passing Coach': { stats: ['Long Passing', 'Short Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Shooting Coach': { stats: ['Finishing', 'Long Shots'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000] },
  'Tackling Coach': { stats: ['Standing Tackle', 'Sliding Tackle'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000] },
  'Technical Coach': { stats: ['Ball Control', 'Dribbling'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000] },
  'Agility Poles': { stats: ['Agility', 'Dribbling'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000] },
  'Finishing Net': { stats: ['Finishing', 'Curve'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000] },
  'Football Tennis Net': { stats: ['Heading Accuracy', 'Volleys'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000] },
  'GPS Vests': { stats: ['Stamina', 'Attack Positioning'], boosts: [2, 5, 7], cost: [200000, 600000, 1200000] },
  'Mini Goals': { stats: ['Finishing', 'Short Passing'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000] },
  'Rebounders': { stats: ['Reactions', 'Volleys'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000] },
  'Set Piece Mannequins': { stats: ['FK Accuracy', 'Penalties'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Speed Parachute': { stats: ['Acceleration', 'Sprint Speed'], boosts: [1, 2, 3], cost: [300000, 800000, 1400000] },
  'Compression Boots': { stats: ['Strength', 'Shot Power'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Running Track': { stats: ['Sprint Speed', 'Stamina'], boosts: [1, 2, 3], cost: [300000, 800000, 1400000] }, 
  'Training Pitch': { stats: ['Crossing', 'Long Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Weight Room': { stats: ['Jumping', 'Strength'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Yoga Instructor': { stats: ['Composure', 'Balance'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'VR Room': { stats: ['Finishing', 'Short Passing'], boosts: [2, 4, 4], cost: [200000, 600000, 1200000] },
  'Passing Drill': { stats: ['Interceptions', 'Long Passing'], boosts: [3, 5, 5], cost: [200000, 600000, 1200000] },
  'Low Driven Drill': { stats: ['Balance', 'Vision'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000] },
  'Strength Drill': { stats: ['Strength', 'Standing Tackle'], boosts: [2, 4, 4], cost: [300000, 800000, 1400000] },
  'Agility Drill': { stats: ['Agility', 'Ball Control'], boosts: [2, 3, 3], cost: [300000, 800000, 1400000] },
  'Quick Finishing Drill': { stats: ['Sprint Speed', 'Finishing'], boosts: [2, 3, 3], cost: [300000, 800000, 1400000] }
};

// --- Helper Utilities ---
const getApCost = (archName: string, statName: string, targetLevel: number): number => {
  const normalizedArch = archName.split(' ')[0].toLowerCase();
  const csvStatName = CSV_STAT_MAP[statName];
  
  try {
    const cost = UPGRADE_COSTS[normalizedArch]?.[csvStatName]?.[targetLevel];
    return cost !== undefined ? cost : 1; 
  } catch (error) {
    return 1; 
  }
};

const getCostForPoints = (archName: string, statName: string, startValue: number, pointsToAdd: number): number => {
  let totalCost = 0;
  for(let i = 1; i <= pointsToAdd; i++) {
    const targetLvl = startValue + i;
    totalCost += getApCost(archName, statName, targetLvl);
  }
  return totalCost;
};

const getTotalStarCost = (tier: string, minLevel: number, currentLevel: number): number => {
  let total = 0;
  const costs = STAR_UPGRADE_COSTS[tier];
  if (!costs) return 0;
  for (let i = minLevel + 1; i <= currentLevel; i++) {
    total += costs[i];
  }
  return total;
};

const getModifier = (current: number, base: number, step: number): number => {
  const diff = current - base;
  const absDiff = Math.abs(diff);
  if (absDiff === 0) return 0;
  const magnitude = 1 + Math.floor((absDiff - 1) / step);
  return diff > 0 ? magnitude : -magnitude;
};

const getStatCaps = (archName: string, statName: string) => {
  const normalizedArch = archName.split(' ')[0].toLowerCase();
  
  // @ts-ignore
  const capData = ARCHETYPE_ATTRIBUTE_CAPS[normalizedArch];
  if (!capData) return { min: 70, max: 99 }; 

  const camelStat = STAT_KEY_MAP[statName];
  if (!camelStat || !capData[camelStat]) return { min: 70, max: 99 };

  return capData[camelStat];
};

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
  const [equippedFacilities, setEquippedFacilities] = useState<Record<string, number>>({}); // e.g. { 'Equipment Manager': 3 }

  const { data: progressionData, isLoading: isProgLoading } = trpc.build.getProgression.useQuery({ gameVersion } as any);
  const { data: serverArchetypes, isLoading: isArchLoading } = trpc.scout.getArchetypeBaseStats.useQuery({ gameVersion } as any);

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
  };

  const physicalModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    const hModRaw = getModifier(height, activeBounds.baseH, 4);
    const wModRaw = getModifier(weight, activeBounds.baseW, 8);
    const isGK = activeBounds.type === 'GK';

    if (isGK) {
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

  const facilityModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    Object.entries(equippedFacilities).forEach(([name, tier]) => {
      const facility = FACILITIES[name];
      if (facility) {
        const boostAmount = facility.boosts[tier - 1];
        facility.stats.forEach(stat => {
          mods[stat] = (mods[stat] || 0) + boostAmount;
        });
      }
    });
    return mods;
  }, [equippedFacilities]);

  const masteryModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    const archMastery = MASTERIES[archetype];
    
    if (archMastery && level >= 10) {
      Object.entries(archMastery.l10).forEach(([stat, val]) => {
        mods[stat] = (mods[stat] || 0) + val;
      });
      if (level >= 30) {
        Object.entries(archMastery.l30).forEach(([stat, val]) => {
          mods[stat] = (mods[stat] || 0) + val;
        });
      }
    }
    return mods;
  }, [level, archetype]);

  const currentStats = useMemo(() => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return null;
    const computed: Record<string, number> = {};
    const baseObj = serverArchetypes[archetype].base;
    
    for (const statKey in baseObj) {
      const caps = getStatCaps(archetype, statKey);
      
      const physMod = physicalModifiers[statKey] || 0;
      const facMod = facilityModifiers[statKey] || 0;
      const mastMod = masteryModifiers[statKey] || 0;
      const invested = addedPoints[statKey] || 0;
      
      const dynamicBase = (caps.min || baseObj[statKey] || 70) + physMod + facMod + mastMod;
      const capMax = caps.max || 99;
      
      computed[statKey] = Math.max(dynamicBase, Math.min(capMax, dynamicBase + invested));
    }
    return computed;
  }, [serverArchetypes, archetype, physicalModifiers, facilityModifiers, masteryModifiers, addedPoints]);

  const spentAp = useMemo(() => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return 0;
    let total = 0;
    
    for (const statKey in addedPoints) {
      const caps = getStatCaps(archetype, statKey);
      const physMod = physicalModifiers[statKey] || 0;
      const facMod = facilityModifiers[statKey] || 0;
      const mastMod = masteryModifiers[statKey] || 0;
      
      const base = (caps.min || serverArchetypes[archetype].base[statKey] || 70) + physMod + facMod + mastMod;
      total += getCostForPoints(archetype, statKey, base, addedPoints[statKey]);
    }

    const starCaps = ARCHETYPE_STAR_CAPS[archetype] || ARCHETYPE_STAR_CAPS['Finisher'];
    total += getTotalStarCost(starCaps.sm.tier, starCaps.sm.min, smLevel);
    total += getTotalStarCost(starCaps.wf.tier, starCaps.wf.min, wfLevel);

    return total;
  }, [addedPoints, serverArchetypes, archetype, physicalModifiers, facilityModifiers, masteryModifiers, smLevel, wfLevel]);

  const availableAp = maxAp - spentAp;

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
         if (costAccumulator + stepCost <= currentCost + availableAp) {
           affordableLevel++;
           costAccumulator += stepCost;
         } else {
           break;
         }
       }
       safeTarget = affordableLevel;
    }
    
    if (type === 'sm') setSmLevel(safeTarget);
    else setWfLevel(safeTarget);
  };

  const handleSliderChange = (statKey: string, targetValue: number) => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return;
    
    const caps = getStatCaps(archetype, statKey);
    const capMax = caps.max || 99;
    
    const physMod = physicalModifiers[statKey] || 0;
    const facMod = facilityModifiers[statKey] || 0;
    const mastMod = masteryModifiers[statKey] || 0;
    const baseVal = Math.max(1, (caps.min || serverArchetypes[archetype].base[statKey] || 70) + physMod + facMod + mastMod);
    
    let safeTarget = Math.max(baseVal, Math.min(capMax, targetValue));
    let newPointsAdded = safeTarget - baseVal;
    
    const currentInvestedPts = addedPoints[statKey] || 0;
    const currentCost = getCostForPoints(archetype, statKey, baseVal, currentInvestedPts);
    const targetCost = getCostForPoints(archetype, statKey, baseVal, newPointsAdded);

    if (targetCost - currentCost > availableAp) {
      let affordablePoints = currentInvestedPts;
      let costAccumulator = currentCost;
      for (let i = currentInvestedPts; i < newPointsAdded; i++) {
        let stepCost = getApCost(archetype, statKey, baseVal + affordablePoints + 1);
        if (costAccumulator + stepCost <= currentCost + availableAp) {
          affordablePoints++;
          costAccumulator += stepCost;
        } else {
          break;
        }
      }
      newPointsAdded = affordablePoints;
    }

    setAddedPoints(prev => {
      const next = { ...prev };
      if (newPointsAdded <= 0) delete next[statKey];
      else next[statKey] = newPointsAdded;
      return next;
    });
  };

  const getStatColor = (val: number) => {
    if (val >= 90) return "text-emerald-500";
    if (val >= 80) return "text-green-400";   
    if (val >= 65) return "text-yellow-400";  
    if (val >= 50) return "text-orange-500";  
    return "text-red-500";                    
  };

  const getAccentColor = (val: number) => {
    if (val >= 90) return "accent-emerald-500";
    if (val >= 80) return "accent-green-400";
    if (val >= 65) return "accent-yellow-400";
    if (val >= 50) return "accent-orange-500";
    return "accent-red-500";
  };

  let accelerate = 'Controlled';
  if (currentStats) {
    const acc = currentStats["Acceleration"] || 70;
    const agi = currentStats["Agility"] || 70;
    const str = currentStats["Strength"] || 70;
    
    if (height >= 185 && str >= 65 && (str - agi) >= 4 && acc >= 40) accelerate = 'Lengthy';
    else if (height <= 184 && agi >= 65 && (agi - str) >= 10 && acc >= 80) accelerate = 'Explosive';
  }

  const leagueWarning = useMemo(() => {
    if (activeBounds.type === 'DEF' && height > 187) return "Max DEF height is 187cm";
    if (activeBounds.type === 'MID_ATT' && height > 182) return "Max MID/ATT height is 182cm";
    return null;
  }, [height, activeBounds]);

  if (isArchLoading || isProgLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <div className="w-12 h-12 rounded-full border-4 border-t-green-500 border-green-900 animate-spin mb-4"></div>
        <p className="text-green-500 font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Loading Engine Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pt-8 pb-16 px-4">
      <div className="max-w-lg mx-auto">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-2xl" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Manual Builder
          </h1>
          <p className="text-sm mt-2" style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'Inter', sans-serif" }}>
            Powered by live engine parameters.
          </p>
        </div>

        <div className="flex bg-[#1a1d24] border border-white/5 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setGameVersion("FC26"); setAddedPoints({}); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all ${
              gameVersion === "FC26" ? "bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "text-gray-500 hover:text-white"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 26 DATA
          </button>
          <button
            onClick={() => { setGameVersion("FC27"); setAddedPoints({}); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all ${
              gameVersion === "FC27" ? "bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "text-gray-500 hover:text-white"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 27 DATA
          </button>
        </div>

        <section className="mb-6 animate-fade-in">
          <div className="rounded-xl p-4 border bg-[#1a1d24] border-white/5 shadow-2xl">
            {leagueWarning && (
              <div className="mb-4 bg-yellow-950/40 border border-yellow-500/50 text-yellow-400 p-3 rounded-xl text-center text-xs font-bold uppercase tracking-widest">
                ⚠️ League Warning: {leagueWarning}
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ background: "oklch(0.75 0.22 142)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "oklch(0.75 0.22 142)", fontFamily: "'Rajdhani', sans-serif" }}>
                Player Foundation
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-black/30 border border-white/5 p-4 rounded-xl">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>
                    PLAYER LEVEL
                  </label>
                  <input 
                    type="range" min="1" max="40" value={level} 
                    onChange={(e) => { setLevel(Number(e.target.value)); setAddedPoints({}); }}
                    className="w-full accent-green-500"
                  />
                  <div className="text-white font-bold text-lg mt-1">{level}</div>
                </div>
                <div className="flex-1 text-right border-l border-white/5 pl-4">
                  <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>
                    AVAILABLE AP
                  </label>
                  <div className="text-3xl font-black text-green-400 drop-shadow-md">{availableAp}</div>
                </div>
              </div>

              <div className="bg-black/30 border border-white/5 p-4 rounded-xl">
                <label className="block text-xs font-medium mb-2 uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>
                  Archetype Selection
                </label>
                <select 
                  className="w-full bg-black/60 border border-white/5 text-white rounded-lg p-3 text-sm focus:outline-none focus:border-green-500 transition-colors appearance-none"
                  value={archetype}
                  onChange={(e) => handleArchetypeChange(e.target.value)}
                >
                  {serverArchetypes && Object.keys(serverArchetypes).map(arch => (
                    <option key={arch} value={arch}>{arch} ({serverArchetypes[arch].pos})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 bg-black/30 border border-white/5 p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                    <span className="text-[10px] text-gray-500">{activeBounds.minH}-{activeBounds.maxH}cm</span>
                  </div>
                  <input 
                    type="range" min={activeBounds.minH} max={activeBounds.maxH} value={height} 
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-center mt-1 font-bold text-white">{height} cm</p>
                </div>
                <div className="flex-1 bg-black/30 border border-white/5 p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                    <span className="text-[10px] text-gray-500">{activeBounds.minW}-{activeBounds.maxW}kg</span>
                  </div>
                  <input 
                    type="range" min={activeBounds.minW} max={activeBounds.maxW} value={weight} 
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-center mt-1 font-bold text-white">{weight} kg</p>
                </div>
              </div>

              {/* Skill Moves & Weak Foot */}
              <div className="flex gap-4">
                <div className="flex-1 bg-black/30 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Skill Moves</label>
                    <span className="text-[10px] text-gray-500 font-bold">{activeStarCaps.sm.min}-{activeStarCaps.sm.max} ★</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 rounded-lg p-1 border border-white/5">
                    <button 
                      onClick={() => handleStarChange('sm', smLevel - 1)}
                      disabled={smLevel <= activeStarCaps.sm.min}
                      className="w-8 h-8 rounded bg-black/40 text-gray-400 font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-yellow-400 font-black text-lg px-2">
                      {smLevel} <span className="text-sm opacity-80">★</span>
                    </span>
                    <button 
                      onClick={() => handleStarChange('sm', smLevel + 1)}
                      disabled={smLevel >= activeStarCaps.sm.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.sm.tier][smLevel + 1]}
                      className="w-8 h-8 rounded bg-black/40 text-gray-400 font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-black/30 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Weak Foot</label>
                    <span className="text-[10px] text-gray-500 font-bold">{activeStarCaps.wf.min}-{activeStarCaps.wf.max} ★</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 rounded-lg p-1 border border-white/5">
                    <button 
                      onClick={() => handleStarChange('wf', wfLevel - 1)}
                      disabled={wfLevel <= activeStarCaps.wf.min}
                      className="w-8 h-8 rounded bg-black/40 text-gray-400 font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-yellow-400 font-black text-lg px-2">
                      {wfLevel} <span className="text-sm opacity-80">★</span>
                    </span>
                    <button 
                      onClick={() => handleStarChange('wf', wfLevel + 1)}
                      disabled={wfLevel >= activeStarCaps.wf.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.wf.tier][wfLevel + 1]}
                      className="w-8 h-8 rounded bg-black/40 text-gray-400 font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#111827] p-4 rounded-xl border border-white/5 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none bg-green-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-500" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  AccelerATE Style
                </span>
                <span className={`text-lg font-black uppercase tracking-wider z-10 ${
                  accelerate === 'Lengthy' ? 'text-orange-400' : accelerate === 'Explosive' ? 'text-yellow-400' : 'text-white'
                }`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  {accelerate}
                </span>
              </div>
            </div>
          </div>
        </section>

        {currentStats && serverArchetypes && (
          <section className="animate-fade-up">
            {Object.entries(STAT_GROUPS).map(([category, attributes]) => {
              const catTotal = attributes.reduce((sum, stat) => sum + (currentStats[stat] || 70), 0);
              const catAvg = Math.round(catTotal / attributes.length);

              return (
                <div key={category} className="mb-6 rounded-xl p-4 border bg-[#1a1d24] border-white/5 shadow-xl">
                  <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-gray-500" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-300" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                        {category}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 border border-white/10 rounded px-2 py-1 bg-black/30">
                      <span className="text-[10px] text-gray-500 font-bold tracking-widest">AVG</span>
                      <span className={`text-sm font-bold ${getStatColor(catAvg)}`}>{catAvg}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    {attributes.map(stat => {
                      const value = currentStats[stat] || 70;
                      
                      const caps = getStatCaps(archetype, stat);
                      const capMax = caps.max || 99;
                      
                      const physMod = physicalModifiers[stat] || 0;
                      const facMod = facilityModifiers[stat] || 0;
                      const mastMod = masteryModifiers[stat] || 0;
                      const baseVal = Math.max(1, (caps.min || serverArchetypes[archetype]?.base?.[stat] || 70) + physMod + facMod + mastMod);
                      
                      const invested = addedPoints[stat] || 0;
                      const statApSpent = getCostForPoints(archetype, stat, baseVal, invested);

                      return (
                        <div key={stat} className="flex flex-col">
                          <div className="flex justify-between items-end mb-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-bold text-gray-200" style={{ fontFamily: "'Inter', sans-serif" }}>{stat}</span>
                              <span className="text-[10px] text-gray-500 font-bold">({baseVal} - {capMax}) • {statApSpent} AP</span>
                            </div>
                            <span className={`text-xl font-black ${getStatColor(value)}`}>{value}</span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleSliderChange(stat, value - 1)}
                              disabled={invested <= 0}
                              className="w-7 h-7 rounded bg-black/40 border border-white/5 text-gray-400 font-bold disabled:opacity-30 active:bg-zinc-800 flex items-center justify-center transition-all pb-1"
                            >
                              -
                            </button>
                            
                            <input 
                              type="range" 
                              min={baseVal} 
                              max={capMax} 
                              value={value} 
                              onChange={(e) => handleSliderChange(stat, parseInt(e.target.value))}
                              className={`flex-1 h-1.5 rounded-lg appearance-none bg-black/60 cursor-pointer ${getAccentColor(value)}`}
                            />
                            
                            <button 
                              onClick={() => handleSliderChange(stat, value + 1)}
                              disabled={value >= capMax || availableAp < getApCost(archetype, stat, value + 1)}
                              className="w-7 h-7 rounded bg-black/40 border border-white/5 text-gray-400 font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center transition-all pb-1"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}

      </div>
    </div>
  );
}
