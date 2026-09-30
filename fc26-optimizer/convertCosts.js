import fs from 'fs';

// Read your CSV
const csv = fs.readFileSync('./server/data27/FC27_UPGRADE_COSTS.csv', 'utf8');
const lines = csv.split('\n').slice(1); // Skip header

const costs = {};

lines.forEach(line => {
  if (!line.trim()) return;
  const [archetype, attribute, level, cost] = line.split(',');
  
  const archKey = archetype.trim().split(' ')[0].toLowerCase();
  const attrKey = attribute.trim();
  
  if (!costs[archKey]) costs[archKey] = {};
  if (!costs[archKey][attrKey]) costs[archKey][attrKey] = {};
  
  costs[archKey][attrKey][parseInt(level)] = parseInt(cost);
});

// Write to a TypeScript file
const tsContent = `export const UPGRADE_COSTS: Record<string, Record<string, Record<number, number>>> = ${JSON.stringify(costs, null, 2)};\n`;
fs.writeFileSync('./server/data27/upgradeCosts.ts', tsContent);
console.log('Successfully generated upgradeCosts.ts from CSV!');
