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

const CLUB_BUDGETS: Record<number, number> = {
  1: 1000000, 2: 1100000, 3: 1200000, 4: 1300000, 5: 1500000,
  6: 1700000, 7: 1900000, 8: 2100000, 9: 2300000, 10: 2500000
};

const MASTERIES: Record<string, { l10: Record<string, number>, l30: Record<string, number> }> = {
  'Shot Stopper': { l10: { 'GK Positioning': 1, 'GK Reflexes': 1 }, l30: { 'GK Reflexes': 1 } },
  'Sweeper Keeper': { l10: { 'GK Handling': 1, 'GK Diving': 1 }, l30: { 'GK Diving': 1 } },
  'Progressor': { l10: { 'Long Passing': 1, 'Standing Tackle': 1 }, l30: { 'Standing Tackle': 1 } },
  'Boss': { l10: { 'Aggression': 1, 'Strength': 1 }, l30: { 'Strength': 1 } },
  'Disruptor': { l10: { 'Stamina': 1, 'Interceptions': 1 }, l30: { 'Interceptions': 1 } },
  'Marauder': { l10: { 'Sliding Tackle': 1, 'Sprint Speed': 1 }, l30: { 'Sprint Speed': 1 } },
  'Recycler': { l10: { 'Def Awareness': 1, 'Short Passing': 1 }, l30: { 'Short Passing': 1 } },
  'Maestro': { l10: { 'Reactions': 1, 'Ball Control': 1 }, l30: { 'Ball Control': 1 } },
  'Creator': { l10: { 'FK Accuracy': 1, 'Vision': 1 }, l30: { 'Vision': 1 } },
  'Spark': { l10: { 'Crossing': 1, 'Dribbling': 1 }, l30: { 'Dribbling': 1 } },
  'Magician': { l10: { 'Curve': 1, 'Acceleration': 1 }, l30: { 'Acceleration': 1 } },
  'Finisher': { l10: { 'Finishing': 1, 'Composure': 1 }, l30: { 'Finishing': 1 } }, 
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

// --- PlayStyles Config ---
const FIXED_PLAYSTYLE_PLUS: Record<string, string> = {
  'Shot Stopper': 'GK Far Reach',
  'Sweeper Keeper': 'GK Footwork',
  'Progressor': 'Long Ball Pass',
  'Boss': 'Bruiser',
  'Disruptor': 'Jockey',
  'Marauder': 'Quick Step',
  'Recycler': 'Intercept',
  'Maestro': 'Pinged Pass',
  'Creator': 'Incisive Pass',
  'Spark': 'Trickster',
  'Magician': 'Technical',
  'Finisher': 'Low Driven Shot',
  'Target': 'Precision Header',
  'Target Forward': 'Precision Header'
};

type StatReq = { stat: string; min: number };
const PLAYSTYLES_DATA: { name: string; category: string; reqs: StatReq[] }[] = [
  { name: 'Finesse Shot', category: 'scoring', reqs: [{ stat: 'Vision', min: 80 }, { stat: 'Finishing', min: 75 }, { stat: 'Curve', min: 80 }] },
  { name: 'Chip Shot', category: 'scoring', reqs: [{ stat: 'Reactions', min: 75 }, { stat: 'Composure', min: 80 }, { stat: 'Ball Control', min: 80 }] },
  { name: 'Power Shot', category: 'scoring', reqs: [{ stat: 'Finishing', min: 80 }, { stat: 'Shot Power', min: 75 }, { stat: 'Long Shots', min: 80 }] },
  { name: 'Dead Ball', category: 'scoring', reqs: [{ stat: 'Crossing', min: 80 }, { stat: 'FK Accuracy', min: 75 }, { stat: 'Shot Power', min: 80 }] },
  { name: 'Precision Header', category: 'scoring', reqs: [{ stat: 'Jumping', min: 80 }, { stat: 'Strength', min: 80 }, { stat: 'Heading Accuracy', min: 75 }] },
  { name: 'Acrobatic', category: 'scoring', reqs: [{ stat: 'Agility', min: 80 }, { stat: 'Reactions', min: 80 }, { stat: 'Volleys', min: 75 }] },
  { name: 'Low Driven Shot', category: 'scoring', reqs: [{ stat: 'Composure', min: 80 }, { stat: 'Finishing', min: 75 }, { stat: 'Shot Power', min: 80 }] },
  { name: 'Game Changer', category: 'scoring', reqs: [{ stat: 'Composure', min: 80 }, { stat: 'Finishing', min: 75 }, { stat: 'Curve', min: 80 }] },
  { name: 'Incisive Pass', category: 'passing', reqs: [{ stat: 'Vision', min: 75 }, { stat: 'Long Passing', min: 80 }, { stat: 'Curve', min: 80 }] },
  { name: 'Pinged Pass', category: 'passing', reqs: [{ stat: 'Long Passing', min: 85 }, { stat: 'Short Passing', min: 80 }] },
  { name: 'Long Ball Pass', category: 'passing', reqs: [{ stat: 'Vision', min: 85 }, { stat: 'Long Passing', min: 80 }] },
  { name: 'Tiki Taka', category: 'passing', reqs: [{ stat: 'Reactions', min: 80 }, { stat: 'Ball Control', min: 80 }, { stat: 'Short Passing', min: 75 }] },
  { name: 'Whipped Pass', category: 'passing', reqs: [{ stat: 'Crossing', min: 80 }, { stat: 'Long Passing', min: 75 }] },
  { name: 'Inventive', category: 'passing', reqs: [{ stat: 'Composure', min: 80 }, { stat: 'Long Passing', min: 75 }, { stat: 'Curve', min: 80 }] },
  { name: 'Technical', category: 'ball_control', reqs: [{ stat: 'Balance', min: 80 }, { stat: 'Ball Control', min: 75 }, { stat: 'Dribbling', min: 80 }] },
  { name: 'Rapid', category: 'ball_control', reqs: [{ stat: 'Acceleration', min: 75 }, { stat: 'Sprint Speed', min: 80 }, { stat: 'Dribbling', min: 80 }] },
  { name: 'First Touch', category: 'ball_control', reqs: [{ stat: 'Composure', min: 80 }, { stat: 'Ball Control', min: 75 }] },
  { name: 'Trickster', category: 'ball_control', reqs: [{ stat: 'Acceleration', min: 80 }, { stat: 'Agility', min: 75 }, { stat: 'Dribbling', min: 80 }] },
  { name: 'Press Proven', category: 'ball_control', reqs: [{ stat: 'Strength', min: 75 }, { stat: 'Composure', min: 80 }, { stat: 'Ball Control', min: 80 }] },
  { name: 'Jockey', category: 'defending', reqs: [{ stat: 'Agility', min: 75 }, { stat: 'Def Awareness', min: 80 }, { stat: 'Standing Tackle', min: 80 }] },
  { name: 'Block', category: 'defending', reqs: [{ stat: 'Agility', min: 80 }, { stat: 'Strength', min: 75 }, { stat: 'Reactions', min: 80 }] },
  { name: 'Intercept', category: 'defending', reqs: [{ stat: 'Aggression', min: 80 }, { stat: 'Interceptions', min: 80 }] },
  { name: 'Anticipate', category: 'defending', reqs: [{ stat: 'Balance', min: 80 }, { stat: 'Def Awareness', min: 75 }, { stat: 'Standing Tackle', min: 80 }] },
  { name: 'Slide Tackle', category: 'defending', reqs: [{ stat: 'Aggression', min: 80 }, { stat: 'Sliding Tackle', min: 75 }] },
  { name: 'Aerial', category: 'defending', reqs: [{ stat: 'Jumping', min: 75 }, { stat: 'Heading Accuracy', min: 75 }] },
  { name: 'Quick Step', category: 'physical', reqs: [{ stat: 'Acceleration', min: 75 }, { stat: 'Sprint Speed', min: 80 }, { stat: 'Stamina', min: 80 }] },
  { name: 'Relentless', category: 'physical', reqs: [{ stat: 'Agility', min: 80 }, { stat: 'Stamina', min: 80 }] },
  { name: 'Long Throw', category: 'physical', reqs: [{ stat: 'Strength', min: 80 }, { stat: 'Stamina', min: 75 }] },
  { name: 'Bruiser', category: 'physical', reqs: [{ stat: 'Strength', min: 75 }, { stat: 'Aggression', min: 80 }, { stat: 'Def Awareness', min: 80 }] },
  { name: 'Enforcer', category: 'physical', reqs: [{ stat: 'Balance', min: 80 }, { stat: 'Strength', min: 75 }, { stat: 'Ball Control', min: 80 }] },
  { name: 'GK Far Throw', category: 'goalkeeping', reqs: [{ stat: 'Vision', min: 75 }, { stat: 'Long Passing', min: 75 }, { stat: 'GK Kicking', min: 80 }] },
  { name: 'GK Footwork', category: 'goalkeeping', reqs: [{ stat: 'Agility', min: 80 }, { stat: 'Balance', min: 80 }, { stat: 'GK Reflexes', min: 75 }] },
  { name: 'GK Cross Claimer', category: 'goalkeeping', reqs: [{ stat: 'Jumping', min: 80 }, { stat: 'Strength', min: 80 }, { stat: 'GK Positioning', min: 75 }] },
  { name: 'GK Rush Out', category: 'goalkeeping', reqs: [{ stat: 'Acceleration', min: 80 }, { stat: 'Agility', min: 75 }, { stat: 'Aggression', min: 80 }] },
  { name: 'GK Far Reach', category: 'goalkeeping', reqs: [{ stat: 'Agility', min: 80 }, { stat: 'Reactions', min: 80 }, { stat: 'GK Diving', min: 75 }] },
  { name: 'GK Deflector', category: 'goalkeeping', reqs: [{ stat: 'Strength', min: 75 }, { stat: 'GK Diving', min: 80 }, { stat: 'GK Reflexes', min: 75 }] }
];

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

const getCustomColor = (val: number) => {
  if (val >= 90) return "oklch(84.1% 0.238 128.85)";
  if (val >= 80) return "oklch(53.2% 0.157 131.589)";
  if (val >= 70) return "oklch(90.5% 0.182 98.111)";
  if (val >= 50) return "oklch(75% 0.183 55.934)";
  return "oklch(63.7% 0.237 25.331)";
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
  const [equippedFacilities, setEquippedFacilities] = useState<Record<string, number>>({}); 

  const [unlockedMasteries, setUnlockedMasteries] = useState<Record<string, { l10: boolean, l30: boolean }>>({});
  
  // PlayStyles State
  const [equippedPlaystyles, setEquippedPlaystyles] = useState<string[]>(['', '', '']);
  const [isPlaystylesOpen, setIsPlaystylesOpen] = useState<boolean>(false);
  const [isMasteriesOpen, setIsMasteriesOpen] = useState<boolean>(false);
  const [isFacilitiesOpen, setIsFacilitiesOpen] = useState<boolean>(false);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    "Pace": false,
    "Shooting": false,
    "Passing": false,
    "Dribbling": false,
    "Defending": false,
    "Physical": false
  });

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
      setEquippedPlaystyles(['', '', '']); // Reset on change
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
    setEquippedPlaystyles(['', '', '']); // Reset playstyles when changing archetypes
  };

  const handleAddFacility = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fac = e.target.value;
    if (!fac) return;
    setEquippedFacilities(prev => ({ ...prev, [fac]: 1 }));
    e.target.value = ""; 
  };

  const handleTierChange = (fac: string, tier: number) => {
    setEquippedFacilities(prev => ({ ...prev, [fac]: tier }));
  };

  const handleRemoveFacility = (fac: string) => {
    setEquippedFacilities(prev => {
      const next = { ...prev };
      delete next[fac];
      return next;
    });
  };

  const toggleMasteryUnlock = (archName: string, tier: 'l10' | 'l30') => {
    setUnlockedMasteries(prev => {
      const current = prev[archName] || { l10: false, l30: false };
      if (tier === 'l30') {
        const nextL30 = !current.l30;
        return {
          ...prev,
          [archName]: { l10: nextL30 ? true : current.l10, l30: nextL30 }
        };
      } else {
        const nextL10 = !current.l10;
        return {
          ...prev,
          [archName]: { l10: nextL10, l30: nextL10 ? current.l30 : false }
        };
      }
    });
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handlePlaystyleChange = (index: number, value: string) => {
    setEquippedPlaystyles(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
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
    
    Object.entries(unlockedMasteries).forEach(([arch, status]) => {
      const archMastery = MASTERIES[arch];
      if (!archMastery) return;

      if (status.l10 && archMastery.l10) {
        Object.entries(archMastery.l10).forEach(([stat, val]) => {
          mods[stat] = (mods[stat] || 0) + val;
        });
      }
      if (status.l30 && archMastery.l30) {
        Object.entries(archMastery.l30).forEach(([stat, val]) => {
          mods[stat] = (mods[stat] || 0) + val;
        });
      }
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

  const activeMasteriesCount = useMemo(() => {
    return Object.values(unlockedMasteries).reduce((count, status) => {
      let active = 0;
      if (status.l10) active++;
      if (status.l30) active++;
      return count + active;
    }, 0);
  }, [unlockedMasteries]);

  const activeFacilitiesCount = Object.keys(equippedFacilities).length;
  
  const activePlaystylesCount = equippedPlaystyles.filter(ps => ps !== '').length;
  const isPsPlusUnlocked = level >= 20;
  const fixedPsPlus = FIXED_PLAYSTYLE_PLUS[archetype] || 'None';

  if (isArchLoading || isProgLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080B14]">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#4D8DFF] border-[#131A2A] animate-spin mb-4"></div>
        <p className="text-[#4D8DFF] font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Loading Engine Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] relative overflow-hidden pt-8 pb-16 px-4">
      <div className="max-w-lg mx-auto">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-[#F4F7FB] uppercase tracking-widest drop-shadow-lg" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Manual Builder
          </h1>
          <p className="text-xs mt-2 font-medium tracking-wide" style={{ color: "#8E9AAF", fontFamily: "'Inter', sans-serif" }}>
            Powered by live engine parameters.
          </p>
        </div>

        {/* Global Dataset Toggles */}
        <div className="flex bg-[#0D1220] border border-[#26334A] p-1 rounded-xl mb-6 shadow-sm">
          <button
            onClick={() => { setGameVersion("FC26"); setAddedPoints({}); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${
              gameVersion === "FC26" 
                ? "bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]" 
                : "text-[#59657A] hover:text-[#8E9AAF]"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 26 DATA
          </button>
          <button
            onClick={() => { setGameVersion("FC27"); setAddedPoints({}); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${
              gameVersion === "FC27" 
                ? "bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]" 
                : "text-[#59657A] hover:text-[#8E9AAF]"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 27 DATA
          </button>
        </div>

        <section className="mb-8 animate-fade-in space-y-4">
          {leagueWarning && (
            <div className="bg-[#080B14] border border-yellow-500/30 text-yellow-400/90 py-2 px-3 rounded-lg text-center text-[10px] font-bold uppercase tracking-widest">
              ⚠️ League Warning: {leagueWarning}
            </div>
          )}

          {/* Premium Top Dashboard (AP & Level) */}
          <div className="flex gap-4">
            <div className="flex-1 bg-[#131A2A] border border-[#26334A] p-5 rounded-2xl flex flex-col justify-center">
              <label className="block text-[10px] font-bold mb-3 uppercase tracking-[0.2em] text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Player Level <span className="text-[#F4F7FB] text-sm ml-1">{level}</span>
              </label>
              <input 
                type="range" min="1" max="40" value={level} 
                onChange={(e) => { setLevel(Number(e.target.value)); setAddedPoints({}); }}
                className="w-full accent-[#4D8DFF] cursor-pointer"
              />
            </div>
            
            <div className="flex-1 bg-gradient-to-b from-[#192235] to-[#131A2A] border border-[#4D8DFF]/40 p-5 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden shadow-[0_0_20px_rgba(77,141,255,0.1)]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#4D8DFF]/10 rounded-full blur-2xl pointer-events-none" />
              <label className="block text-[10px] font-bold mb-1 uppercase tracking-[0.2em] text-[#4D8DFF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Available AP
              </label>
              <div className="text-4xl font-black text-[#F4F7FB] tracking-tight drop-shadow-md z-10" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                {availableAp}
              </div>
            </div>
          </div>

          {/* Archetype Selector */}
          <div>
            <div className="flex items-center gap-2 mb-3 pl-1">
              <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Archetype Foundation
              </span>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
              {serverArchetypes && Object.keys(serverArchetypes).map(arch => {
                const isSelected = archetype === arch;
                return (
                  <button
                    key={arch}
                    onClick={() => handleArchetypeChange(arch)}
                    className={`flex-shrink-0 text-left p-3 rounded-xl transition-all duration-300 snap-center border ${
                      isSelected 
                        ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_12px_rgba(77,141,255,0.2)]' 
                        : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF] hover:bg-[#192235]'
                    }`}
                    style={{ minWidth: '130px' }}
                  >
                    <div className={`font-bold text-sm tracking-wide ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                      {arch}
                    </div>
                    <div className="text-[10px] mt-1 font-medium text-[#59657A] tracking-wider uppercase">
                      {serverArchetypes[arch].pos}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Physicals & Stars Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Height */}
            <div className="bg-[#131A2A] border border-[#26334A] p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                <span className="text-sm font-bold text-[#F4F7FB]">{height} cm</span>
              </div>
              <input 
                type="range" min={activeBounds.minH} max={activeBounds.maxH} value={height} 
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full accent-[#4D8DFF] cursor-pointer"
              />
            </div>
            
            {/* Weight */}
            <div className="bg-[#131A2A] border border-[#26334A] p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                <span className="text-sm font-bold text-[#F4F7FB]">{weight} kg</span>
              </div>
              <input 
                type="range" min={activeBounds.minW} max={activeBounds.maxW} value={weight} 
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-[#4D8DFF] cursor-pointer"
              />
            </div>

            {/* Skill Moves */}
            <div className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] w-1/3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Skills</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleStarChange('sm', smLevel - 1)}
                  disabled={smLevel <= activeStarCaps.sm.min}
                  className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5"
                >-</button>
                <span className="text-[#4D8DFF] font-black text-sm w-8 text-center">{smLevel} <span className="opacity-70 text-[10px]">★</span></span>
                <button 
                  onClick={() => handleStarChange('sm', smLevel + 1)}
                  disabled={smLevel >= activeStarCaps.sm.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.sm.tier][smLevel + 1]}
                  className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5"
                >+</button>
              </div>
            </div>

            {/* Weak Foot */}
            <div className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] w-1/3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>W.Foot</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleStarChange('wf', wfLevel - 1)}
                  disabled={wfLevel <= activeStarCaps.wf.min}
                  className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5"
                >-</button>
                <span className="text-[#4D8DFF] font-black text-sm w-8 text-center">{wfLevel} <span className="opacity-70 text-[10px]">★</span></span>
                <button 
                  onClick={() => handleStarChange('wf', wfLevel + 1)}
                  disabled={wfLevel >= activeStarCaps.wf.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.wf.tier][wfLevel + 1]}
                  className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5"
                >+</button>
              </div>
            </div>
          </div>

          {/* AccelerATE */}
          <div className="bg-[#131A2A] p-4 rounded-xl border border-[#26334A] flex justify-between items-center shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              AccelerATE Style
            </span>
            <span className={`text-sm font-black uppercase tracking-widest ${
              accelerate === 'Lengthy' ? 'text-[#8B5CF6]' : accelerate === 'Explosive' ? 'text-[#4D8DFF]' : 'text-[#F4F7FB]'
            }`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {accelerate}
            </span>
          </div>
        </section>

        {/* --- EXPANDABLE PANELS --- */}
        <div className="space-y-3 mb-8">
          
          {/* Club Facilities */}
          <div className="rounded-xl border border-[#26334A] bg-[#131A2A] overflow-hidden">
            <button 
              onClick={() => setIsFacilitiesOpen(!isFacilitiesOpen)}
              className="w-full py-3 px-4 flex items-center justify-between hover:bg-[#192235] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4D8DFF]" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Club Facilities
                </span>
                {activeFacilitiesCount > 0 && (
                  <span className="text-[9px] bg-[#4D8DFF]/10 text-[#4D8DFF] border border-[#4D8DFF]/20 px-2 py-0.5 rounded-full font-bold">
                    {activeFacilitiesCount} Equipped
                  </span>
                )}
              </div>
              <span className="text-[#8E9AAF] text-[10px] transform transition-transform duration-200" style={{ transform: isFacilitiesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>

            {isFacilitiesOpen && (
              <div className="p-4 border-t border-[#26334A] bg-[#080B14] flex flex-col gap-4">
                <div className="bg-[#131A2A] border border-[#26334A] p-4 rounded-xl">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Club Level</label>
                      <div className="text-[#F4F7FB] font-bold text-sm">{clubLevel}</div>
                    </div>
                    <div className="text-right">
                      <label className="block text-[10px] font-bold mb-1 uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Budget</label>
                      <div className={`text-base font-black ${CLUB_BUDGETS[clubLevel] - totalFacilityCost < 0 ? 'text-[#ff4d4d]' : 'text-[#4D8DFF]'}`}>
                        {(CLUB_BUDGETS[clubLevel] - totalFacilityCost).toLocaleString()} 
                        <span className="text-[10px] text-[#59657A] font-medium ml-1">/ {CLUB_BUDGETS[clubLevel].toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <input type="range" min="1" max="10" value={clubLevel} onChange={(e) => setClubLevel(Number(e.target.value))} className="w-full accent-[#4D8DFF] cursor-pointer" />
                </div>

                {Object.entries(equippedFacilities).length > 0 && (
                  <div className="flex flex-col gap-2">
                    {Object.entries(equippedFacilities).map(([facName, tier]) => {
                      const facData = FACILITIES[facName];
                      return (
                        <div key={facName} className="bg-[#0D1220] border border-[#26334A] p-3 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div>
                            <div className="text-xs font-bold text-[#F4F7FB]">{facName}</div>
                            <div className="text-[9px] text-[#21E6A4] font-bold uppercase tracking-widest mt-0.5">+{facData.boosts[tier - 1]} {facData.stats.join(' & ')}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <select value={tier} onChange={(e) => handleTierChange(facName, Number(e.target.value))} className="bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] rounded p-1 text-[10px] focus:outline-none focus:border-[#4D8DFF] cursor-pointer">
                              <option value={1}>Tier 1</option>
                              <option value={2}>Tier 2</option>
                              <option value={3}>Tier 3</option>
                            </select>
                            <button onClick={() => handleRemoveFacility(facName)} className="w-6 h-6 rounded bg-[#ff4d4d]/10 text-[#ff4d4d] hover:bg-[#ff4d4d]/20 flex items-center justify-center transition-colors text-[10px]">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <select onChange={handleAddFacility} className="w-full bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] rounded-lg p-2.5 text-xs focus:outline-none focus:border-[#4D8DFF] transition-colors cursor-pointer appearance-none">
                  <option value="">+ Equip Facility...</option>
                  {Object.keys(FACILITIES).filter(f => !equippedFacilities[f]).map(f => (<option key={f} value={f}>{f}</option>))}
                </select>
              </div>
            )}
          </div>

          {/* Account Masteries */}
          <div className="rounded-xl border border-[#26334A] bg-[#131A2A] overflow-hidden">
            <button 
              onClick={() => setIsMasteriesOpen(!isMasteriesOpen)}
              className="w-full py-3 px-4 flex items-center justify-between hover:bg-[#192235] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Unlocked Masteries
                </span>
                {activeMasteriesCount > 0 && (
                  <span className="text-[9px] bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 px-2 py-0.5 rounded-full font-bold">
                    {activeMasteriesCount} Active
                  </span>
                )}
              </div>
              <span className="text-[#8E9AAF] text-[10px] transform transition-transform duration-200" style={{ transform: isMasteriesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>

            {isMasteriesOpen && (
              <div className="p-4 border-t border-[#26334A] bg-[#080B14] grid grid-cols-1 sm:grid-cols-2 gap-2">
                {serverArchetypes && Object.keys(serverArchetypes).map(arch => {
                  const status = unlockedMasteries[arch] || { l10: false, l30: false };
                  const masteryDef = MASTERIES[arch];
                  if (!masteryDef) return null;
                  return (
                    <div key={arch} className="bg-[#0D1220] border border-[#26334A] p-2.5 rounded-lg flex justify-between items-center gap-2">
                      <span className="text-[10px] font-bold text-[#F4F7FB] uppercase tracking-wider">{arch}</span>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={status.l10} onChange={() => toggleMasteryUnlock(arch, 'l10')} className="accent-[#4D8DFF] w-3 h-3 cursor-pointer" />
                          <span className={`text-[9px] font-bold ${status.l10 ? 'text-[#4D8DFF]' : 'text-[#59657A]'}`}>L10</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={status.l30} onChange={() => toggleMasteryUnlock(arch, 'l30')} className="accent-[#8B5CF6] w-3 h-3 cursor-pointer" />
                          <span className={`text-[9px] font-bold ${status.l30 ? 'text-[#8B5CF6]' : 'text-[#59657A]'}`}>L30</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PlayStyles */}
          {currentStats && (
            <div className="rounded-xl border border-[#26334A] bg-[#131A2A] overflow-hidden">
              <button 
                onClick={() => setIsPlaystylesOpen(!isPlaystylesOpen)}
                className="w-full py-3 px-4 flex items-center justify-between hover:bg-[#192235] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F4F7FB]" />
                  <span className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    PlayStyles
                  </span>
                  {activePlaystylesCount > 0 && (
                    <span className="text-[9px] bg-[#F4F7FB]/10 text-[#F4F7FB] border border-[#F4F7FB]/20 px-2 py-0.5 rounded-full font-bold">
                      {activePlaystylesCount} Silver
                    </span>
                  )}
                </div>
                <span className="text-[#8E9AAF] text-[10px] transform transition-transform duration-200" style={{ transform: isPlaystylesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>

              {isPlaystylesOpen && (
                <div className="p-4 border-t border-[#26334A] bg-[#080B14] flex flex-col gap-3">
                  {/* Gold Slot */}
                  <div className={`p-3 rounded-xl border ${isPsPlusUnlocked ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_10px_rgba(77,141,255,0.15)]' : 'bg-[#0D1220] border-[#26334A] opacity-60'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#4D8DFF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle+ (Fixed)</span>
                      {!isPsPlusUnlocked && <span className="text-[9px] text-[#59657A] font-bold">Unlocks @ Lvl 20</span>}
                    </div>
                    <div className={`text-sm font-black uppercase tracking-wider ${isPsPlusUnlocked ? 'text-[#F4F7FB]' : 'text-[#59657A]'}`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      {fixedPsPlus}
                    </div>
                  </div>

                  {/* Silver Slots */}
                  <div className="grid grid-cols-1 gap-2">
                    {[5, 15, 40].map((unlockLevel, index) => {
                      const isUnlocked = level >= unlockLevel;
                      return (
                        <div key={`ps-slot-${index}`} className="flex items-center gap-3 bg-[#0D1220] border border-[#26334A] p-2.5 rounded-lg">
                          <span className="text-[10px] font-bold uppercase text-[#59657A] w-12 text-center border-r border-[#26334A] pr-3">SLOT {index + 1}</span>
                          <select
                            disabled={!isUnlocked}
                            value={equippedPlaystyles[index]}
                            onChange={(e) => handlePlaystyleChange(index, e.target.value)}
                            className="flex-1 bg-transparent text-[#F4F7FB] text-xs focus:outline-none disabled:opacity-50 appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-[#131A2A]">{isUnlocked ? 'Select...' : `Locked until Lvl ${unlockLevel}`}</option>
                            {PLAYSTYLES_DATA.map(ps => {
                              if (ps.name === fixedPsPlus) return null;
                              if (equippedPlaystyles.includes(ps.name) && equippedPlaystyles[index] !== ps.name) return null;
                              let meetsReqs = true;
                              let reqString = '';
                              if (ps.reqs.length > 0) {
                                reqString = ' (Req: ' + ps.reqs.map(r => `${r.min} ${r.stat}`).join(', ') + ')';
                                for (const req of ps.reqs) {
                                  if ((currentStats[req.stat] || 70) < req.min) { meetsReqs = false; break; }
                                }
                              }
                              return <option key={ps.name} value={ps.name} disabled={!meetsReqs} className="bg-[#131A2A]">{ps.name} {!meetsReqs ? reqString : ''}</option>;
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- ATTRIBUTES SECTION --- */}
        {currentStats && serverArchetypes && (
          <section className="space-y-3 animate-fade-up">
            {Object.entries(STAT_GROUPS).map(([category, attributes]) => {
              const catTotal = attributes.reduce((sum, stat) => sum + (currentStats[stat] || 70), 0);
              const catAvg = Math.round(catTotal / attributes.length);
              const isOpen = openCategories[category];

              return (
                <div key={category} className="rounded-xl border border-[#26334A] bg-[#0D1220] overflow-hidden shadow-sm transition-all">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="w-full py-3 px-5 flex items-center justify-between hover:bg-[#131A2A] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                        {category}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Slimmer AVG Pill */}
                      <div className="flex items-center gap-1.5 px-2 py-0.5 border border-[#26334A] rounded bg-[#080B14]">
                        <span className="text-[9px] text-[#59657A] font-bold tracking-widest">AVG</span>
                        <span className="text-xs font-black" style={{ color: getCustomColor(catAvg) }}>{catAvg}</span>
                      </div>
                      <span className="text-[#59657A] text-[10px] transform transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 border-t border-[#26334A] bg-[#080B14] grid grid-cols-1 gap-1 animate-fade-in">
                      {attributes.map(stat => {
                        const value = currentStats[stat] || 70;
                        const caps = getStatCaps(archetype, stat);
                        const physMod = physicalModifiers[stat] || 0;
                        const facMod = facilityModifiers[stat] || 0;
                        const mastMod = masteryModifiers[stat] || 0;
                        const baseVal = Math.max(1, (caps.min || serverArchetypes[archetype]?.base?.[stat] || 70) + physMod + facMod + mastMod);
                        const invested = addedPoints[stat] || 0;
                        const statApSpent = getCostForPoints(archetype, stat, baseVal, invested);
                        
                        return (
                          <div key={stat} className="flex flex-col py-2 border-b border-[#26334A]/50 last:border-0">
                            <div className="flex justify-between items-end mb-1">
                              <div>
                                <div className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
                                  {stat}
                                </div>
                                <div className="text-[9px] text-[#59657A] font-medium tracking-widest uppercase mt-0.5">
                                  CAP: {caps.max || 99} <span className="mx-1">•</span> {statApSpent} AP
                                </div>
                              </div>
                              <span className="text-2xl font-black tabular-nums tracking-tight" style={{ color: getCustomColor(value) }}>{value}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-1">
                              <button 
                                onClick={() => handleSliderChange(stat, value - 1)}
                                disabled={invested <= 0}
                                className="w-7 h-7 rounded border border-[#26334A] bg-[#0D1220] text-[#8E9AAF] font-bold disabled:opacity-30 hover:text-[#F4F7FB] hover:border-[#4D8DFF] flex items-center justify-center transition-all pb-0.5"
                              >-</button>
                              
                              <input 
                                type="range" min="0" max="99" value={value} 
                                onChange={(e) => handleSliderChange(stat, parseInt(e.target.value))}
                                className="flex-1 cursor-pointer bg-[#0D1220] rounded-lg h-1.5"
                                style={{ accentColor: getCustomColor(value) }}
                              />
                              
                              <button 
                                onClick={() => handleSliderChange(stat, value + 1)}
                                disabled={value >= (caps.max || 99) || availableAp < getApCost(archetype, stat, value + 1)}
                                className="w-7 h-7 rounded border border-[#26334A] bg-[#0D1220] text-[#8E9AAF] font-bold disabled:opacity-30 hover:text-[#F4F7FB] hover:border-[#4D8DFF] flex items-center justify-center transition-all pb-0.5"
                              >+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
