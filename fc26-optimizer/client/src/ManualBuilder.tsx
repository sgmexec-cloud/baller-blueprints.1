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

const PLAYSTYLE_CATEGORIES = [
  { id: 'scoring', label: 'Scoring' },
  { id: 'passing', label: 'Passing' },
  { id: 'ball_control', label: 'Ball Control' },
  { id: 'defending', label: 'Defending' },
  { id: 'physical', label: 'Physical' },
  { id: 'goalkeeping', label: 'Goalkeeping' }
];

// --- Helper Utilities ---
const getApCost = (archName: string, statName: string, targetLevel: number): number => {
  const normalizedArch = archName.split(' ')[0].toLowerCase();
  const csvStatName = CSV_STAT_MAP[statName];
  try {
    const cost = UPGRADE_COSTS[normalizedArch]?.[csvStatName]?.[targetLevel];
    return cost !== undefined ? cost : 1; 
  } catch { return 1; }
};

const getCostForPoints = (archName: string, statName: string, startValue: number, pointsToAdd: number): number => {
  let totalCost = 0;
  for(let i = 1; i <= pointsToAdd; i++) totalCost += getApCost(archName, statName, startValue + i);
  return totalCost;
};

const getTotalStarCost = (tier: string, minLevel: number, currentLevel: number): number => {
  let total = 0;
  const costs = STAR_UPGRADE_COSTS[tier];
  if (!costs) return 0;
  for (let i = minLevel + 1; i <= currentLevel; i++) total += costs[i];
  return total;
};

const getModifier = (current: number, base: number, step: number): number => {
  const diff = current - base;
  if (Math.abs(diff) === 0) return 0;
  const magnitude = 1 + Math.floor((Math.abs(diff) - 1) / step);
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
  
  // Dashboard Overlays State
  const [activeModal, setActiveModal] = useState<'facilities' | 'masteries' | 'playstyles' | null>(null);
  const [selectedFacView, setSelectedFacView] = useState<string>('');
  const [viewingFacTier, setViewingFacTier] = useState<number>(1);
  const [selectedPsView, setSelectedPsView] = useState<string | null>(null); // New state for PS Hub

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
      setEquippedPlaystyles(['', '', '']);
      setSelectedPsView(null);
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

  const toggleCategory = (category: string) => setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));

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
      const invested = addedPoints[statKey] || 0;
      const dynamicBase = (caps.min || baseObj[statKey] || 70) + physMod + facMod + mastMod;
      computed[statKey] = Math.max(dynamicBase, Math.min(caps.max || 99, dynamicBase + invested));
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

  // ------------------------------------------
  // PLAYSTYLE HUB - "QUICK EQUIP" LOGIC
  // ------------------------------------------
  
  const getQuickEquipData = (psName: string) => {
    const ps = PLAYSTYLES_DATA.find(p => p.name === psName);
    if (!ps || ps.reqs.length === 0) return { canEquip: true, cost: 0, upgrades: {} };

    let totalCost = 0;
    let isPossible = true;
    let reason = '';
    const upgrades: Record<string, number> = {};
    let allMet = true;

    for (const req of ps.reqs) {
      const statName = req.stat;
      const currentVal = currentStats?.[statName] || 70;
      const targetVal = req.min;

      if (currentVal < targetVal) {
        allMet = false;
        const caps = getStatCaps(archetype, statName);
        const capMax = caps.max || 99;

        if (targetVal > capMax) {
          isPossible = false;
          reason = 'CAP EXCEEDED';
          break;
        }

        const physMod = physicalModifiers[statName] || 0;
        const facMod = facilityModifiers[statName] || 0;
        const mastMod = masteryModifiers[statName] || 0;
        const baseVal = Math.max(1, (caps.min || serverArchetypes?.[archetype]?.base?.[statName] || 70) + physMod + facMod + mastMod);
        
        const currentInvested = addedPoints[statName] || 0;
        const targetInvested = targetVal - baseVal;
        
        if (targetInvested > currentInvested) {
            const costCurrent = getCostForPoints(archetype, statName, baseVal, currentInvested);
            const costTarget = getCostForPoints(archetype, statName, baseVal, targetInvested);
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
      // Unequip
      setEquippedPlaystyles(prev => prev.map(p => p === psName ? '' : p));
    } else {
      // Find Empty Slot that is unlocked based on level
      const unlockedSlotIndexes = [0, 1, 2].filter(i => level >= [5, 15, 40][i]);
      const emptyIndex = unlockedSlotIndexes.find(i => equippedPlaystyles[i] === '');
      
      if (emptyIndex !== undefined) {
        // Apply AP Upgrades
        if (Object.keys(upgrades).length > 0) {
          setAddedPoints(prev => {
            const next = { ...prev };
            for (const stat in upgrades) next[stat] = upgrades[stat];
            return next;
          });
        }
        // Equip
        setEquippedPlaystyles(prev => {
          const next = [...prev];
          next[emptyIndex] = psName;
          return next;
        });
      }
    }
  };

  // ------------------------------------------

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
    const physMod = physicalModifiers[statKey] || 0;
    const facMod = facilityModifiers[statKey] || 0;
    const mastMod = masteryModifiers[statKey] || 0;
    const baseVal = Math.max(1, (caps.min || serverArchetypes[archetype].base[statKey] || 70) + physMod + facMod + mastMod);
    
    let safeTarget = Math.max(baseVal, Math.min(caps.max || 99, targetValue));
    let newPointsAdded = safeTarget - baseVal;
    
    const currentInvestedPts = addedPoints[statKey] || 0;
    const currentCost = getCostForPoints(archetype, statKey, baseVal, currentInvestedPts);
    const targetCost = getCostForPoints(archetype, statKey, baseVal, newPointsAdded);

    if (targetCost - currentCost > availableAp) {
      let affordablePoints = currentInvestedPts;
      let costAccumulator = currentCost;
      for (let i = currentInvestedPts; i < newPointsAdded; i++) {
        let stepCost = getApCost(archetype, statKey, baseVal + affordablePoints + 1);
        if (costAccumulator + stepCost <= currentCost + availableAp) { affordablePoints++; costAccumulator += stepCost; } 
        else break;
      }
      newPointsAdded = affordablePoints;
    }

    setAddedPoints(prev => {
      const next = { ...prev };
      if (newPointsAdded <= 0) delete next[statKey]; else next[statKey] = newPointsAdded;
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

  const activeMasteriesCount = Object.values(unlockedMasteries).reduce((count, status) => count + (status.l10 ? 1 : 0) + (status.l30 ? 1 : 0), 0);
  const activeFacilitiesCount = Object.keys(equippedFacilities).length;
  
  const activePlaystylesCount = equippedPlaystyles.filter(ps => ps !== '').length;
  const isPsPlusUnlocked = level >= 20;
  const fixedPsPlus = FIXED_PLAYSTYLE_PLUS[archetype] || 'None';
  
  const unlockedSlotIndexes = [0, 1, 2].filter(i => level >= [5, 15, 40][i]);
  const hasEmptySlot = unlockedSlotIndexes.some(i => equippedPlaystyles[i] === '');

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
          <p className="text-xs mt-2 font-medium tracking-wide text-[#8E9AAF]" style={{ fontFamily: "'Inter', sans-serif" }}>
            Powered by live engine parameters.
          </p>
        </div>

        {/* Global Dataset Toggles */}
        <div className="flex bg-[#0D1220] border border-[#26334A] p-1 rounded-xl mb-6 shadow-sm">
          <button
            onClick={() => { setGameVersion("FC26"); setAddedPoints({}); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${
              gameVersion === "FC26" ? "bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]" : "text-[#59657A] hover:text-[#8E9AAF]"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 26 DATA
          </button>
          <button
            onClick={() => { setGameVersion("FC27"); setAddedPoints({}); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${
              gameVersion === "FC27" ? "bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]" : "text-[#59657A] hover:text-[#8E9AAF]"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 27 DATA
          </button>
        </div>

        <section className="mb-6 animate-fade-in space-y-4">
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

          {/* Physicals Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#131A2A] border border-[#26334A] p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                <span className="text-sm font-bold text-[#F4F7FB]">{height} cm</span>
              </div>
              <input type="range" min={activeBounds.minH} max={activeBounds.maxH} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full accent-[#4D8DFF] cursor-pointer" />
            </div>
            
            <div className="bg-[#131A2A] border border-[#26334A] p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                <span className="text-sm font-bold text-[#F4F7FB]">{weight} kg</span>
              </div>
              <input type="range" min={activeBounds.minW} max={activeBounds.maxW} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full accent-[#4D8DFF] cursor-pointer" />
            </div>

            <div className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] w-1/3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Skills</label>
              <div className="flex items-center gap-3">
                <button onClick={() => handleStarChange('sm', smLevel - 1)} disabled={smLevel <= activeStarCaps.sm.min} className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5">-</button>
                <span className="text-[#4D8DFF] font-black text-sm w-8 text-center">{smLevel} <span className="opacity-70 text-[10px]">★</span></span>
                <button onClick={() => handleStarChange('sm', smLevel + 1)} disabled={smLevel >= activeStarCaps.sm.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.sm.tier][smLevel + 1]} className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5">+</button>
              </div>
            </div>

            <div className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] w-1/3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>W.Foot</label>
              <div className="flex items-center gap-3">
                <button onClick={() => handleStarChange('wf', wfLevel - 1)} disabled={wfLevel <= activeStarCaps.wf.min} className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5">-</button>
                <span className="text-[#4D8DFF] font-black text-sm w-8 text-center">{wfLevel} <span className="opacity-70 text-[10px]">★</span></span>
                <button onClick={() => handleStarChange('wf', wfLevel + 1)} disabled={wfLevel >= activeStarCaps.wf.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.wf.tier][wfLevel + 1]} className="w-6 h-6 rounded bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-0.5">+</button>
              </div>
            </div>
          </div>

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

        {/* --- APP DASHBOARD CARDS --- */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3 pl-1">
            <div className="w-1 h-3 rounded-full bg-[#8B5CF6]" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              Player Enhancements
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            
            {/* Masteries */}
            <button onClick={() => setActiveModal('masteries')} className="bg-[#131A2A] border border-[#26334A] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-[#192235] hover:border-[#8B5CF6]/40 transition-all group">
               <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <div className="w-3 h-3 rounded-[2px] bg-[#8B5CF6]" />
               </div>
               <div className="text-center">
                   <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Masteries</div>
                   <div className="text-[9px] text-[#8E9AAF] font-bold uppercase mt-1 tracking-wider">{activeMasteriesCount} Active</div>
               </div>
            </button>
            
            {/* Facilities */}
            <button onClick={openFacilitiesModal} className="bg-[#131A2A] border border-[#26334A] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-[#192235] hover:border-[#4D8DFF]/40 transition-all group">
               <div className="w-10 h-10 rounded-full bg-[#4D8DFF]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <div className="w-3 h-3 rounded-full bg-[#4D8DFF]" />
               </div>
               <div className="text-center">
                   <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Facilities</div>
                   <div className="text-[9px] text-[#8E9AAF] font-bold uppercase mt-1 tracking-wider">{activeFacilitiesCount} Equipped</div>
               </div>
            </button>
            
            {/* PlayStyles Hub Launch */}
            <button onClick={() => setActiveModal('playstyles')} className="col-span-2 bg-[#131A2A] border border-[#26334A] p-4 rounded-2xl flex items-center justify-between hover:bg-[#192235] hover:border-[#F4F7FB]/40 transition-all group">
               <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4D8DFF] to-[#8B5CF6] opacity-90 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <div className="w-3 h-3 rounded-sm bg-white rotate-45" />
                   </div>
                   <div className="text-left">
                       <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle Hub</div>
                       <div className="text-[9px] text-[#8E9AAF] font-bold uppercase mt-1 tracking-wider">{activePlaystylesCount} Silver <span className="mx-1">•</span> {isPsPlusUnlocked ? '1 Gold' : 'Gold Locked'}</div>
                   </div>
               </div>
               <div className="text-[#8E9AAF] text-xs font-black">➔</div>
            </button>

          </div>
        </section>

        {/* --- ATTRIBUTES ACCORDION SECTION --- */}
        {currentStats && serverArchetypes && (
          <section className="space-y-3 animate-fade-up">
            <div className="flex items-center gap-2 mb-3 pl-1">
              <div className="w-1 h-3 rounded-full bg-[#59657A]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Attribute Distribution
              </span>
            </div>
            
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

      {/* =========================================
          MODALS / OVERLAYS
      ========================================= */}

      {/* FACILITIES MODAL */}
      {activeModal === 'facilities' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Club Facilities</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            {/* ... (Existing Facilities Split View left mostly unchanged to keep response concise) ... */}
            <div className="p-4 bg-[#131A2A] border-b border-[#26334A] shadow-md z-10">
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
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[45%] overflow-y-auto border-r border-[#26334A] hide-scrollbar bg-[#0D1220]">
                {Object.keys(FACILITIES).map(facName => {
                  const isSelected = selectedFacView === facName;
                  const equippedTier = equippedFacilities[facName];
                  return (
                    <button key={facName} onClick={() => handleSelectFacilityView(facName)} className={`w-full p-3 text-left border-b border-[#26334A]/30 transition-colors ${isSelected ? 'bg-[#192235]' : 'hover:bg-[#131A2A]'}`}>
                      <div className={`text-[11px] font-bold leading-snug tracking-wide ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>{facName}</div>
                      {equippedTier && <div className="text-[9px] text-[#21E6A4] uppercase mt-1 tracking-wider font-bold">★ Tier {equippedTier}</div>}
                    </button>
                  );
                })}
              </div>
              <div className="w-[55%] p-4 flex flex-col items-center bg-[#080B14] overflow-y-auto">
                {selectedFacView && FACILITIES[selectedFacView] && (
                  <>
                    <div className="w-full text-center mb-6 pt-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-[#131A2A] border border-[#26334A] flex items-center justify-center mb-3"><div className="w-4 h-4 rounded-full bg-[#4D8DFF]" /></div>
                      <h3 className="text-sm font-black text-[#F4F7FB] mb-3 leading-tight">{selectedFacView}</h3>
                      <div className="flex items-center gap-4 justify-center">
                        <button onClick={() => setViewingFacTier(Math.max(1, viewingFacTier - 1))} className="text-[#8E9AAF] p-2 hover:text-[#F4F7FB] active:scale-95 transition-all">◄</button>
                        <div className="flex gap-2">{[1, 2, 3].map(t => (<div key={t} className={`w-2 h-2 rounded-full transition-colors ${viewingFacTier === t ? 'bg-[#4D8DFF]' : 'bg-[#26334A]'}`} />))}</div>
                        <button onClick={() => setViewingFacTier(Math.min(3, viewingFacTier + 1))} className="text-[#8E9AAF] p-2 hover:text-[#F4F7FB] active:scale-95 transition-all">►</button>
                      </div>
                      <div className="text-[10px] text-[#4D8DFF] font-bold mt-2 uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Tier {viewingFacTier}</div>
                    </div>
                    <div className="bg-[#0D1220] border border-[#26334A] p-4 rounded-xl w-full text-center mb-6 shadow-sm">
                      <div className="text-[9px] text-[#8E9AAF] uppercase tracking-widest mb-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Attribute Boosts</div>
                      <div className="text-xs font-bold text-[#21E6A4] tracking-wide">+{FACILITIES[selectedFacView].boosts[viewingFacTier - 1]} <br/> {FACILITIES[selectedFacView].stats.join(' & ')}</div>
                    </div>
                    <div className="w-full mt-auto mb-2">
                      <div className="text-center mb-3">
                        <div className="text-[9px] text-[#8E9AAF] uppercase tracking-widest mb-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Purchase Cost</div>
                        <div className="text-2xl font-black text-[#F4F7FB]">{FACILITIES[selectedFacView].cost[viewingFacTier - 1].toLocaleString()}</div>
                      </div>
                      {(() => {
                         const currentEquippedTier = equippedFacilities[selectedFacView];
                         if (currentEquippedTier === viewingFacTier) {
                           return <button onClick={() => handleRemoveFacility(selectedFacView)} className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-bold uppercase tracking-widest text-[10px] border border-red-500/30 hover:bg-red-500/20 transition-all">Unequip</button>;
                         } else {
                           const costToRefund = currentEquippedTier ? FACILITIES[selectedFacView].cost[currentEquippedTier - 1] : 0;
                           const targetCost = FACILITIES[selectedFacView].cost[viewingFacTier - 1];
                           const canAfford = remainingBudget + costToRefund >= targetCost;
                           return (
                             <button 
                               onClick={() => handleEquipFacilityTier(selectedFacView, viewingFacTier)} 
                               disabled={!canAfford}
                               className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${canAfford ? 'bg-[#4D8DFF] text-[#080B14] hover:bg-[#4D8DFF]/90 shadow-[0_0_15px_rgba(77,141,255,0.3)]' : 'bg-[#192235] text-[#59657A] cursor-not-allowed border border-[#26334A]'}`}
                             >
                               {canAfford ? (currentEquippedTier ? 'Upgrade' : 'Equip') : 'Insufficient Budget'}
                             </button>
                           );
                         }
                      })()}
                    </div>
                  </>
                )}
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
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Cross-Build Masteries</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            <div className="p-4 bg-[#131A2A] border-b border-[#26334A] text-[10px] text-[#8E9AAF] leading-relaxed">
              Check off milestones completed across all archetypes to stack permanent account-wide attribute bonuses. Level 30 automatically unlocks Level 10.
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 hide-scrollbar">
              {serverArchetypes && Object.keys(serverArchetypes).map(arch => {
                const status = unlockedMasteries[arch] || { l10: false, l30: false };
                const masteryDef = MASTERIES[arch];
                if (!masteryDef) return null;
                return (
                  <div key={arch} className="bg-[#0D1220] border border-[#26334A] p-3 rounded-xl flex justify-between items-center gap-2">
                    <span className="text-[11px] font-bold text-[#F4F7FB] uppercase tracking-wider">{arch}</span>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={status.l10} onChange={() => toggleMasteryUnlock(arch, 'l10')} className="accent-[#4D8DFF] w-3 h-3 cursor-pointer" />
                        <span className={`text-[9px] font-bold ${status.l10 ? 'text-[#4D8DFF]' : 'text-[#59657A]'}`}>L10</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={status.l30} onChange={() => toggleMasteryUnlock(arch, 'l30')} className="accent-[#8B5CF6] w-3 h-3 cursor-pointer" />
                        <span className={`text-[9px] font-bold ${status.l30 ? 'text-[#8B5CF6]' : 'text-[#59657A]'}`}>L30</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* NEW PLAYSTYLE HUB MODAL */}
      {activeModal === 'playstyles' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            
            {/* Header & AP Status */}
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
                     return (
                       <div key={slotIndex} className={`w-3 h-3 rounded-[3px] border ${!isUnlocked ? 'border-red-500/30 bg-red-500/10' : isFilled ? 'border-[#21E6A4] bg-[#21E6A4]/20' : 'border-[#4D8DFF]/40 bg-[#080B14]'}`} />
                     );
                   })}
                 </div>
               </div>
               <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mr-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>AP Remaining</span>
                  <span className="text-base font-black text-[#4D8DFF]">{availableAp}</span>
               </div>
            </div>

            {/* Scrollable Grid Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${selectedPsView ? 'pb-64' : 'pb-8'} hide-scrollbar`}>
              
              {/* PlayStyle+ Fixed Category */}
              <div>
                <div className="flex items-center gap-2 mb-3 border-b border-[#26334A] pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#facc15]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle+ (Gold)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-[#131A2A] border border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.15)] rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group text-left">
                     <div className="absolute top-0 right-0 w-12 h-12 bg-[#facc15]/10 rounded-full blur-xl" />
                     <div className="w-6 h-6 border-2 border-[#facc15] rotate-45 flex items-center justify-center mb-1">
                       <div className="w-2 h-2 bg-[#facc15] -rotate-45" />
                     </div>
                     <div>
                       <div className="text-[11px] font-black text-[#F4F7FB] uppercase tracking-wider">{fixedPsPlus}</div>
                       <div className="text-[8px] text-[#facc15] font-bold uppercase mt-1 tracking-widest">{isPsPlusUnlocked ? 'Active' : 'Unlocks Lvl 20'}</div>
                     </div>
                  </button>
                </div>
              </div>

              {/* Categorized Silver Playstyles */}
              {PLAYSTYLE_CATEGORIES.map(category => {
                 const categoryStyles = PLAYSTYLES_DATA.filter(ps => ps.category === category.id && ps.name !== fixedPsPlus);
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
                          
                          return (
                            <button 
                              key={ps.name}
                              onClick={() => setSelectedPsView(ps.name)}
                              className={`rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden text-left transition-all duration-200 border ${
                                isSelected 
                                  ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_12px_rgba(77,141,255,0.2)] ring-1 ring-[#4D8DFF]/50' 
                                  : isEquipped 
                                    ? 'bg-[#131A2A] border-[#21E6A4]/60' 
                                    : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className={`w-5 h-5 border-2 rotate-45 flex items-center justify-center mb-2 ${isEquipped ? 'border-[#21E6A4]' : 'border-[#59657A]'}`}>
                                   <div className={`w-1.5 h-1.5 -rotate-45 ${isEquipped ? 'bg-[#21E6A4]' : 'bg-[#59657A]'}`} />
                                </div>
                                {isEquipped && <span className="text-[8px] bg-[#21E6A4]/20 text-[#21E6A4] border border-[#21E6A4]/40 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Equipped</span>}
                              </div>
                              <div className={`text-[11px] font-black uppercase tracking-wider ${isEquipped ? 'text-[#21E6A4]' : 'text-[#F4F7FB]'}`}>{ps.name}</div>
                            </button>
                          )
                        })}
                     </div>
                   </div>
                 );
              })}
            </div>

            {/* Sticky Detail Panel */}
            {selectedPsView && (
              <div className="absolute bottom-0 left-0 w-full bg-[#0D1220] border-t border-[#4D8DFF]/50 rounded-t-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up z-20">
                {(() => {
                  const ps = PLAYSTYLES_DATA.find(p => p.name === selectedPsView);
                  if (!ps) return null;
                  
                  const { canEquip, cost, upgrades, reason } = getQuickEquipData(ps.name);
                  const isEquipped = equippedPlaystyles.includes(ps.name);

                  return (
                    <div className="p-5 flex flex-col gap-4">
                      
                      {/* Title & Close */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 border-2 border-[#F4F7FB] rotate-45 flex items-center justify-center"><div className="w-2 h-2 bg-[#F4F7FB] -rotate-45" /></div>
                          <div className="ml-2">
                             <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider">{ps.name}</h3>
                             <p className="text-[9px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{PLAYSTYLE_CATEGORIES.find(c => c.id === ps.category)?.label}</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedPsView(null)} className="text-[#59657A] hover:text-[#F4F7FB] font-bold p-1">✕</button>
                      </div>

                      {/* Attribute Dependencies */}
                      <div className="bg-[#080B14] rounded-xl border border-[#26334A] p-4">
                        <div className="text-[9px] text-[#8E9AAF] uppercase tracking-widest mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Attribute Dependencies</div>
                        <div className="space-y-3">
                          {ps.reqs.map(req => {
                            const currentVal = currentStats?.[req.stat] || 70;
                            const targetVal = req.min;
                            const isMet = currentVal >= targetVal;
                            const capMax = getStatCaps(archetype, req.stat).max || 99;
                            const isImpossible = targetVal > capMax;
                            const fillPct = Math.min(100, (currentVal / targetVal) * 100);

                            return (
                              <div key={req.stat}>
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                  <span className={isMet ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}>{req.stat}</span>
                                  <span className={isMet ? 'text-[#21E6A4]' : isImpossible ? 'text-[#ff4d4d]' : 'text-[#8E9AAF]'}>
                                    {currentVal} <span className="text-[#59657A] mx-0.5">/</span> {targetVal}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-[#131A2A] rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${isMet ? 'bg-[#21E6A4]' : isImpossible ? 'bg-[#ff4d4d]' : 'bg-[#4D8DFF]'}`} 
                                    style={{ width: `${fillPct}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button 
                        onClick={() => handleActionPlaystyle(ps.name, upgrades, isEquipped)}
                        disabled={!isEquipped && (!canEquip || (!hasEmptySlot && Object.keys(upgrades).length === 0 && cost === 0))}
                        className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 ${
                          isEquipped 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                            : !canEquip
                              ? 'bg-[#131A2A] text-[#59657A] border border-[#26334A] cursor-not-allowed'
                              : !hasEmptySlot
                                ? 'bg-[#131A2A] text-[#ff4d4d] border border-red-500/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white shadow-[0_0_20px_rgba(77,141,255,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]'
                        }`}
                      >
                        {isEquipped 
                          ? 'Deselect Element' 
                          : !canEquip 
                            ? reason 
                            : !hasEmptySlot
                              ? 'Slots Full'
                              : cost > 0 
                                ? `Quick Equip [ ${cost} AP ]` 
                                : 'Equip PlayStyle'}
                      </button>

                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
