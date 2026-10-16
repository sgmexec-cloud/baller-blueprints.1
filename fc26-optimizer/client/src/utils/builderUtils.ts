import { ARCHETYPE_ATTRIBUTE_CAPS } from '../../../server/data27/archetypeCaps';
import { UPGRADE_COSTS } from '../../../server/data27/upgradeCosts';
import { CSV_STAT_MAP, STAT_KEY_MAP } from '@/constants/builderData';
import { STAR_UPGRADE_COSTS } from '@/constants/archetypeData';

export const getArchetypeDisplayPosition = (archetype: string, fallbackType: string): string => {
  const defArchetypes = ['Progressor', 'Boss', 'Marauder'];
  const midArchetypes = ['Disruptor', 'Recycler', 'Maestro', 'Creator'];
  const attArchetypes = ['Spark', 'Magician', 'Finisher', 'Target', 'Target Forward'];

  if (defArchetypes.includes(archetype)) return 'DEF';
  if (midArchetypes.includes(archetype)) return 'MID';
  if (attArchetypes.includes(archetype)) return 'ATT';
  if (archetype.includes('Keeper') || archetype.includes('Stopper')) return 'GK';
  return fallbackType === 'GK' ? 'GK' : 'ATT';
};

export const getPlaystyleIconPath = (name: string, isPlus: boolean = false) => {
  if (!name) return '';
  
  // Clean the string and replace spaces with hyphens
  let formatted = name.trim().toLowerCase().replace(/\s+/g, '-');

  // 👉 NEW: Map the strict CSV names directly to your specific file names
  const overrides: Record<string, string> = {
    'dead-ball': 'deadball',
    'aerial': 'aerial-fortress',
  };

  if (overrides[formatted]) {
    formatted = overrides[formatted];
  }

  const suffix = isPlus ? '-plus' : '';
  return `/icons/playstyles/${formatted}${suffix}.png`;
};

export const formatHeight = (cm: number) => {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${cm}cm (${feet}'${inches}")`;
};

export const formatWeight = (kg: number) => {
  const lbs = Math.round(kg * 2.20462);
  return `${kg}kg (${lbs} lbs)`;
};

export const getApCost = (archName: string, statName: string, targetLevel: number): number => {
  const normalizedArch = archName.split(' ')[0].toLowerCase();
  const csvStatName = CSV_STAT_MAP[statName];
  try {
    // @ts-ignore
    const cost = UPGRADE_COSTS[normalizedArch]?.[csvStatName]?.[targetLevel];
    return cost !== undefined ? cost : 1; 
  } catch { return 1; }
};

export const getCostForPoints = (archName: string, statName: string, startValue: number, pointsToAdd: number): number => {
  let totalCost = 0;
  for(let i = 1; i <= pointsToAdd; i++) totalCost += getApCost(archName, statName, startValue + i);
  return totalCost;
};

export const getTotalStarCost = (tier: string, minLevel: number, currentLevel: number): number => {
  let total = 0;
  const costs = STAR_UPGRADE_COSTS[tier];
  if (!costs) return 0;
  for (let i = minLevel + 1; i <= currentLevel; i++) total += costs[i];
  return total;
};

export const getModifier = (current: number, base: number, step: number): number => {
  const diff = current - base;
  if (Math.abs(diff) === 0) return 0;
  const magnitude = 1 + Math.floor((Math.abs(diff) - 1) / step);
  return diff > 0 ? magnitude : -magnitude;
};

export const getStatCaps = (archName: string, statName: string) => {
  const normalizedArch = archName.split(' ')[0].toLowerCase();
  // @ts-ignore
  const capData = ARCHETYPE_ATTRIBUTE_CAPS[normalizedArch];
  if (!capData) return { min: 70, max: 99 }; 
  const camelStat = STAT_KEY_MAP[statName];
  if (!camelStat || !capData[camelStat]) return { min: 70, max: 99 };
  return capData[camelStat];
};

export const isPlaystyleConflict = (targetStyle: string, equippedPlusStyles: string[]): boolean => {
  const normalize = (s: string) => s.replace(/\+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const targetBase = normalize(targetStyle);
  
  return equippedPlusStyles.some(plusStyle => normalize(plusStyle) === targetBase);
};
