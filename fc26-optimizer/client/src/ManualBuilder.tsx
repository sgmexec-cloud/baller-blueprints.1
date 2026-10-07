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

const STAT_ABBR: Record<string, string> = {
  "Acceleration": "ACC", "Sprint Speed": "SPD", "Attack Positioning": "ATT",
  "Finishing": "FIN", "Shot Power": "SHT", "Long Shots": "LNG", "Volleys": "VOL",
  "Penalties": "PEN", "Vision": "VIS", "Crossing": "CRO", "FK Accuracy": "FKA",
  "Short Passing": "SPA", "Long Passing": "LPA", "Curve": "CRV", "Agility": "AGI",
  "Balance": "BAL", "Reactions": "REA", "Ball Control": "BAC", "Dribbling": "DRI",
  "Composure": "COM", "Interceptions": "INT", "Heading Accuracy": "HEA",
  "Def Awareness": "DFA", "Standing Tackle": "STT", "Sliding Tackle": "SLT",
  "Jumping": "JMP", "Stamina": "STA", "Strength": "STR", "Aggression": "AGG",
  "GK Diving": "GKD", "GK Handling": "GKH", "GK Kicking": "GKK", 
  "GK Reflexes": "GKR", "GK Positioning": "GKP"
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

// Position mapping logic based on user prompt requirements
const getArchetypeDisplayPosition = (archetype: string, fallbackType: string): string => {
  const defArchetypes = ['Progressor', 'Boss', 'Marauder'];
  const midArchetypes = ['Disruptor', 'Recycler', 'Maestro', 'Creator'];
  const attArchetypes = ['Spark', 'Magician', 'Finisher', 'Target', 'Target Forward'];

  if (defArchetypes.includes(archetype)) return 'DEF';
  if (midArchetypes.includes(archetype)) return 'MID';
  if (attArchetypes.includes(archetype)) return 'ATT';
  if (archetype.includes('Keeper') || archetype.includes('Stopper')) return 'GK';
  return fallbackType === 'GK' ? 'GK' : 'ATT';
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

type StatReq = { stat: string; min: number };

const SIGNATURE_PERKS_DATA: Record<string, { name: string; level: number; desc: string }[]> = {
  "Target": [
    { name: "No Look Finisher", level: 10, desc: "Shoot with your back to the goal in the box to gain a short boost to Shot Power, Finishing, and Balance." },
    { name: "Physical Shooter", level: 45, desc: "Shield off an opponent, then shoot in the box for a short boost to Strength, Shot Power, and Balance." }
  ],
  "Target Forward": [ 
    { name: "No Look Finisher", level: 10, desc: "Shoot with your back to the goal in the box to gain a short boost to Shot Power, Finishing, and Balance." },
    { name: "Physical Shooter", level: 45, desc: "Shield off an opponent, then shoot in the box for a short boost to Strength, Shot Power, and Balance." }
  ],
  "Finisher": [
    { name: "Fake-to-Real", level: 10, desc: "Fake shot in the box to gain a short boost to Shot Power, Finishing, and Composure." },
    { name: "1v1 Master", level: 45, desc: "When 1vs1 with the goalkeeper, gain a short boost to Ball Control, Agility, and Balance." }
  ],
  "Magician": [
    { name: "Getaway Driver", level: 10, desc: "Dribble at full sprint in the opponent's half for a short boost to Agility, Balance, and Reactions." },
    { name: "Ankle Breaker", level: 45, desc: "Fake shot to beat an opponent in the attacking third for a boost to Balance, Ball Control, and Dribbling." }
  ],
  "Spark": [
    { name: "Bail Out", level: 10, desc: "Knock-on past an opponent on the attacking wing for a boost to Acceleration, Agility, and Ball Control." },
    { name: "Cut Back Specialist", level: 45, desc: "Passes after entering the box from the wing receive a boost to Short Passing, Crossing, and Vision." }
  ],
  "Creator": [
    { name: "Grasshopper Passer", level: 10, desc: "Dinked passes in the opponent's half receive a boost to Ball Control, Short Passing, and Curve." },
    { name: "Bullseye Passer", level: 45, desc: "Precision passes in the middle third receive a boost to Curve, Long Passing, and Short Passing." }
  ],
  "Maestro": [
    { name: "Fly Trap", level: 10, desc: "Shield after an interception in the middle third for a boost to Strength, Balance, and Ball Control." },
    { name: "Eagle Eyes", level: 45, desc: "Receive a pass in the defensive half for a short boost to Long Passing, Vision, and Ball Control." }
  ],
  "Recycler": [
    { name: "Press and Pass", level: 10, desc: "Win the ball in the defensive half to gain a short boost to Short Passing, Reactions, and Vision." },
    { name: "Physical Passer", level: 45, desc: "Shield the ball from an opponent in the defensive half to boost Balance, Short Passing, and Aggression." }
  ],
  "Disruptor": [
    { name: "Tracker", level: 10, desc: "Jockey near a dribbler in the defensive half for a boost to Interceptions, Reactions, and Ball Control." },
    { name: "Presser", level: 45, desc: "Win the ball in the defensive half to gain a short boost to Short Passing, Vision, and Balance." }
  ],
  "Marauder": [
    { name: "High Speed Crosser", level: 10, desc: "Crosses while at full sprint on the attacking wing receive a boost to Agility, Crossing, and Curve." },
    { name: "Tackle and Run", level: 45, desc: "Successful stand tackle on the defensive wing for a boost to Acceleration, Agility, and Sprint Speed." }
  ],
  "Boss": [
    { name: "Shuffler", level: 10, desc: "Jockey near a dribbler in the defensive half for a boost to Aggression, Balance, and Reactions." },
    { name: "Box Controller", level: 45, desc: "Clear the ball from the defensive box for a short boost to Heading, Jumping, and Reactions." }
  ],
  "Progressor": [
    { name: "Restarter", level: 10, desc: "Successful stand tackle in the defensive half for a boost to Long Passing, Short Passing, and Vision." },
    { name: "Goalkeepers Favourite", level: 45, desc: "Receive a pass from the GK in the defensive third for a boost to Long Passing, Short Passing, and Vision." }
  ],
  "Sweeper Keeper": [
    { name: "Back Option", level: 10, desc: "Receive a ground pass in the defensive half for a short boost to Short Passing, Ball Control, and Vision." },
    { name: "Rush Specialist", level: 45, desc: "Rush the dribbler in the box for a short boost to Acceleration, Aggression, and Reactions." }
  ],
  "Shot Stopper": [
    { name: "Low Shot Saver", level: 10, desc: "Stop a low shot for a short boost to Agility, Handling, and Reflexes." },
    { name: "Ready to Act", level: 45, desc: "Jockey when the dribbler is in the attacking third for a short boost to Diving, Balance, and Reflexes." }
  ]
};

const SPECIALIZATIONS_DATA: Record<string, { name: string; perk: string; inspiredBy: string; desc: string; reqs: StatReq[] }[]> = {
  "Boss": [
    { name: "BOSS+", perk: "Slide Tackle+", inspiredBy: "Inspired by Nemanja Vidić", desc: "Gain defensive dominance with a massive boost to tackling.", reqs: [ { stat: "Strength", min: 90 }, { stat: "Aggression", min: 90 }, { stat: "Sliding Tackle", min: 92 } ] },
    { name: "ENFORCER", perk: "Press Proven+", inspiredBy: "Inspired by Roy Keane", desc: "Control the defensive transition with extreme ball retention.", reqs: [ { stat: "Composure", min: 92 }, { stat: "Vision", min: 90 }, { stat: "Ball Control", min: 90 } ] },
    { name: "CAPITANO", perk: "Block+", inspiredBy: "Inspired by Paolo Maldini", desc: "Read the game flawlessly and block critical passes.", reqs: [ { stat: "Def Awareness", min: 92 }, { stat: "Reactions", min: 90 }, { stat: "Agility", min: 90 } ] }
  ],
  "Progressor": [
    { name: "PROGRESSOR+", perk: "Jockey+", inspiredBy: "Inspired by Philipp Lahm", desc: "Dominate your flank with elite defensive awareness.", reqs: [ { stat: "Long Passing", min: 90 }, { stat: "Def Awareness", min: 90 }, { stat: "Standing Tackle", min: 92 } ] },
    { name: "PIONEER", perk: "Pinged Pass+", inspiredBy: "Inspired by Trent Alexander-Arnold", desc: "Transform defense into instant offense.", reqs: [ { stat: "Dribbling", min: 92 }, { stat: "Long Passing", min: 90 }, { stat: "Short Passing", min: 90 } ] },
    { name: "JANITOR", perk: "Quick Step+", inspiredBy: "Inspired by N'Golo Kanté", desc: "Sweep up every loose ball with relentless pace.", reqs: [ { stat: "Acceleration", min: 92 }, { stat: "Sprint Speed", min: 90 }, { stat: "Sliding Tackle", min: 90 } ] }
  ],
  "Marauder": [
    { name: "MARAUDER+", perk: "Slide Tackle+", inspiredBy: "Inspired by Roberto Carlos", desc: "Aggressive defending meets explosive overlap.", reqs: [ { stat: "Sprint Speed", min: 92 }, { stat: "Aggression", min: 90 }, { stat: "Sliding Tackle", min: 90 } ] },
    { name: "SPEEDSTER", perk: "Rapid+", inspiredBy: "Inspired by Alphonso Davies", desc: "Burn past the opposition with blistering pace.", reqs: [ { stat: "Dribbling", min: 92 }, { stat: "Sprint Speed", min: 92 }, { stat: "Acceleration", min: 90 } ] },
    { name: "ATHLETE", perk: "Bruiser+", inspiredBy: "Inspired by Kyle Walker", desc: "Physically dominate any winger on the pitch.", reqs: [ { stat: "Strength", min: 92 }, { stat: "Aggression", min: 90 }, { stat: "Def Awareness", min: 90 } ] }
  ],
  "Maestro": [
    { name: "MAESTRO+", perk: "Technical+", inspiredBy: "Inspired by Andrés Iniesta", desc: "Dictate the tempo with elite dribbling and vision.", reqs: [ { stat: "Balance", min: 90 }, { stat: "Vision", min: 92 }, { stat: "Dribbling", min: 90 } ] },
    { name: "CRASHER", perk: "First Touch+", inspiredBy: "Inspired by Zinedine Zidane", desc: "Control impossible passes in the final third.", reqs: [ { stat: "Finishing", min: 90 }, { stat: "Ball Control", min: 90 }, { stat: "Composure", min: 92 } ] },
    { name: "HEARTBEAT", perk: "Relentless+", inspiredBy: "Inspired by Luka Modrić", desc: "The engine of the team that never stops running.", reqs: [ { stat: "Agility", min: 92 }, { stat: "Stamina", min: 90 }, { stat: "Aggression", min: 90 } ] }
  ],
  "Creator": [
    { name: "CREATOR+", perk: "Whipped Pass+", inspiredBy: "Inspired by Kevin De Bruyne", desc: "Deliver devastating crosses from anywhere.", reqs: [ { stat: "Vision", min: 92 }, { stat: "Crossing", min: 90 }, { stat: "Long Passing", min: 90 } ] },
    { name: "ARCHITECT", perk: "Dead Ball+", inspiredBy: "Inspired by David Beckham", desc: "Turn every set piece into a guaranteed chance.", reqs: [ { stat: "Crossing", min: 92 }, { stat: "FK Accuracy", min: 90 }, { stat: "Shot Power", min: 90 } ] },
    { name: "SNIPER", perk: "Power Shot+", inspiredBy: "Inspired by Steven Gerrard", desc: "Lethal strikes from outside the box.", reqs: [ { stat: "Finishing", min: 90 }, { stat: "Shot Power", min: 92 }, { stat: "Long Shots", min: 90 } ] }
  ],
  "Recycler": [
    { name: "RECYCLER+", perk: "Pinged Pass+", inspiredBy: "Inspired by Sergio Busquets", desc: "Break lines effortlessly with drilled passes.", reqs: [ { stat: "Strength", min: 90 }, { stat: "Long Passing", min: 90 }, { stat: "Short Passing", min: 92 } ] },
    { name: "DRIVER", perk: "Enforcer+", inspiredBy: "Inspired by Yaya Touré", desc: "Carry the ball through the midfield with pure power.", reqs: [ { stat: "Sprint Speed", min: 90 }, { stat: "Balance", min: 92 }, { stat: "Strength", min: 90 } ] },
    { name: "THIEF", perk: "Anticipate+", inspiredBy: "Inspired by Claude Makélélé", desc: "Win the ball before the opponent even realizes.", reqs: [ { stat: "Interceptions", min: 90 }, { stat: "Def Awareness", min: 90 }, { stat: "Standing Tackle", min: 92 } ] }
  ],
  "Disruptor": [
    { name: "DISRUPTOR+", perk: "Intercept+", inspiredBy: "Inspired by Patrick Vieira", desc: "Shut down passing lanes permanently.", reqs: [ { stat: "Balance", min: 90 }, { stat: "Reactions", min: 90 }, { stat: "Interceptions", min: 92 } ] },
    { name: "DESTROYER", perk: "Slide Tackle+", inspiredBy: "Inspired by Gennaro Gattuso", desc: "Fearless tackling to stop any counter-attack.", reqs: [ { stat: "Sprint Speed", min: 90 }, { stat: "Strength", min: 92 }, { stat: "Sliding Tackle", min: 90 } ] },
    { name: "ANCHOR", perk: "Bruiser+", inspiredBy: "Inspired by Casemiro", desc: "The ultimate physical presence in front of the defense.", reqs: [ { stat: "Ball Control", min: 90 }, { stat: "Dribbling", min: 90 }, { stat: "Short Passing", min: 90 } ] }
  ],
  "Magician": [
    { name: "MAGICIAN+", perk: "First Touch+", inspiredBy: "Inspired by Ronaldinho", desc: "One, Two: Do a pass and go in the opponent's half for a short boost to Acceleration, Ball Control, and Balance.", reqs: [ { stat: "Acceleration", min: 90 }, { stat: "Composure", min: 90 }, { stat: "Ball Control", min: 92 } ] },
    { name: "HOTSHOT", perk: "Power Shot+", inspiredBy: "Inspired by Thierry Henry", desc: "Cut and Shoot: Shoot after entering the box from the wing for a short boost to Finishing, Curve, and Shot Power.", reqs: [ { stat: "Finishing", min: 90 }, { stat: "Shot Power", min: 92 }, { stat: "Long Shots", min: 90 } ] },
    { name: "INVADER", perk: "Incisive Pass+", inspiredBy: "Inspired by Mia Hamm", desc: "Silver Platter: Your through pass gives receiver boosts to composure, finishing and ball control in the box.", reqs: [ { stat: "Attack Positioning", min: 90 }, { stat: "Vision", min: 92 }, { stat: "Long Passing", min: 90 } ] }
  ],
  "Finisher": [
    { name: "FINISHER+", perk: "Chip Shot+", inspiredBy: "Inspired by Lionel Messi", desc: "Ultimate composure in 1v1 situations.", reqs: [ { stat: "Ball Control", min: 90 }, { stat: "Composure", min: 92 }, { stat: "Reactions", min: 90 } ] },
    { name: "PRESSER", perk: "Relentless+", inspiredBy: "Inspired by Wayne Rooney", desc: "Lead the press from the front with endless energy.", reqs: [ { stat: "Agility", min: 90 }, { stat: "Stamina", min: 92 }, { stat: "Aggression", min: 90 } ] },
    { name: "HUNTER", perk: "Gamechanger+", inspiredBy: "Inspired by Gerd Müller", desc: "Elite positioning to finish every half-chance.", reqs: [ { stat: "Attack Positioning", min: 90 }, { stat: "Finishing", min: 90 }, { stat: "Curve", min: 92 } ] }
  ],
  "Spark": [
    { name: "SPARK+", perk: "Quick Step+", inspiredBy: "Inspired by Neymar Jr.", desc: "Explosive acceleration to beat the first man instantly.", reqs: [ { stat: "Agility", min: 92 }, { stat: "Sprint Speed", min: 90 }, { stat: "Acceleration", min: 90 } ] },
    { name: "JOKER", perk: "Whipped Pass+", inspiredBy: "Inspired by Luis Figo", desc: "Pinpoint delivery from wide areas.", reqs: [ { stat: "Attack Positioning", min: 90 }, { stat: "Crossing", min: 92 }, { stat: "Long Passing", min: 90 } ] },
    { name: "ACE", perk: "Chip Shot+", inspiredBy: "Inspired by Eden Hazard", desc: "Unpredictable flair and lethal finishing.", reqs: [ { stat: "Reactions", min: 90 }, { stat: "Ball Control", min: 90 }, { stat: "Finishing", min: 92 } ] }
  ],
  "Target": [
    { name: "TARGET+", perk: "Acrobatic+", inspiredBy: "Inspired by Zlatan Ibrahimović", desc: "Convert impossible crosses into spectacular goals.", reqs: [ { stat: "Agility", min: 90 }, { stat: "Jumping", min: 92 }, { stat: "Volleys", min: 90 } ] },
    { name: "ROAMER", perk: "Incisive Pass+", inspiredBy: "Inspired by Harry Kane", desc: "Drop deep and orchestrate the attack.", reqs: [ { stat: "Vision", min: 90 }, { stat: "Long Passing", min: 90 }, { stat: "Short Passing", min: 92 } ] },
    { name: "RUNNER", perk: "Enforcer+", inspiredBy: "Inspired by Erling Haaland", desc: "Unstoppable power and pace in behind.", reqs: [ { stat: "Sprint Speed", min: 92 }, { stat: "Strength", min: 90 }, { stat: "Attack Positioning", min: 90 } ] }
  ]
};

const FACILITIES: Record<string, { stats: string[], boosts: number[], cost: number[], playstyle: string }> = {
  'Equipment Manager': { stats: ['Jumping', 'Stamina'], boosts: [2, 3, 4], cost: [200000, 600000, 1200000], playstyle: 'Acrobatic' },
  'Head Groundskeeper': { stats: ['Balance', 'Ball Control'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Press Proven' },
  'Performance Analyst': { stats: ['Vision', 'Short Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Tiki Taka' },
  'Scout': { stats: ['Attack Positioning', 'Def Awareness'], boosts: [2, 5, 7], cost: [100000, 400000, 1100000], playstyle: 'Anticipate' },
  'Sports Psychologist': { stats: ['Aggression', 'Composure'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000], playstyle: 'Jockey' },
  'Sports Scientist': { stats: ['Acceleration', 'Reactions'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Quick Step' },
  'Att. Tactical Coach': { stats: ['Attack Positioning', 'Vision'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000], playstyle: 'Incisive Pass' },
  'Def. Tactical Coach': { stats: ['Interceptions', 'Def Awareness'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000], playstyle: 'Intercept' },
  'Fitness Coach': { stats: ['Jumping', 'Stamina'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Relentless' },
  'Passing Coach': { stats: ['Long Passing', 'Short Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Pinged Pass' },
  'Shooting Coach': { stats: ['Finishing', 'Long Shots'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000], playstyle: 'Chip Shot' },
  'Tackling Coach': { stats: ['Standing Tackle', 'Sliding Tackle'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000], playstyle: 'Slide Tackle' },
  'Technical Coach': { stats: ['Ball Control', 'Dribbling'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000], playstyle: 'Technical' },
  'Agility Poles': { stats: ['Agility', 'Dribbling'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000], playstyle: 'Trickster' },
  'Finishing Net': { stats: ['Finishing', 'Curve'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000], playstyle: 'Finesse Shot' },
  'Football Tennis Net': { stats: ['Heading Accuracy', 'Volleys'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000], playstyle: 'Aerial' },
  'GPS Vests': { stats: ['Stamina', 'Attack Positioning'], boosts: [2, 5, 7], cost: [200000, 600000, 1200000], playstyle: 'Relentless' },
  'Mini Goals': { stats: ['Finishing', 'Short Passing'], boosts: [2, 5, 5], cost: [300000, 800000, 1400000], playstyle: 'Game Changer' },
  'Rebounders': { stats: ['Reactions', 'Volleys'], boosts: [2, 5, 5], cost: [100000, 400000, 1100000], playstyle: 'Acrobatic' },
  'Set Piece Mannequins': { stats: ['FK Accuracy', 'Penalties'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Dead Ball' },
  'Speed Parachute': { stats: ['Acceleration', 'Sprint Speed'], boosts: [1, 2, 3], cost: [300000, 800000, 1400000], playstyle: 'Rapid' },
  'Compression Boots': { stats: ['Strength', 'Shot Power'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Power Shot' },
  'Running Track': { stats: ['Sprint Speed', 'Stamina'], boosts: [1, 2, 3], cost: [300000, 800000, 1400000], playstyle: 'Quick Step' },
  'Training Pitch': { stats: ['Crossing', 'Long Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Whipped Pass' },
  'Weight Room': { stats: ['Jumping', 'Strength'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Bruiser' },
  'Yoga Instructor': { stats: ['Composure', 'Balance'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'First Touch' },
  'VR Room': { stats: ['Finishing', 'Short Passing'], boosts: [2, 4, 4], cost: [200000, 600000, 1200000], playstyle: 'Low Driven Shot' },
  'Passing Drill': { stats: ['Interceptions', 'Long Passing'], boosts: [3, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Long Ball Pass' },
  'Low Driven Drill': { stats: ['Balance', 'Vision'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Inventive' },
  'Strength Drill': { stats: ['Strength', 'Standing Tackle'], boosts: [2, 4, 4], cost: [300000, 800000, 1400000], playstyle: 'Block' },
  'Agility Drill': { stats: ['Agility', 'Ball Control'], boosts: [2, 3, 3], cost: [300000, 800000, 1400000], playstyle: 'Technical' },
  'Quick Finishing Drill': { stats: ['Sprint Speed', 'Finishing'], boosts: [2, 3, 3], cost: [300000, 800000, 1400000], playstyle: 'Precision Header' }
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
const getPlaystyleIconPath = (name: string, isPlus: boolean = false) => {
  if (!name) return '';
  const formatted = name.toLowerCase().replace(/\s+/g, '-');
  const suffix = isPlus ? '-plus' : '';
  return `/icons/playstyles/${formatted}${suffix}.png`;
};

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

const getGradientColor = (value: number, max: number = 99) => {
  const boundedValue = Math.max(0, Math.min(value, max));
  const percentage = boundedValue / max;
  const hue = percentage * 120;
  return `hsl(${hue}, 80%, 50%)`;
};

const HalfCircleGauge = ({ value, color }: { value: number; color: string }) => {
  const radius = 14;
  const circumference = Math.PI * radius; 
  const totalCircumference = 2 * Math.PI * radius; 
  const pct = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-end w-9 h-5 overflow-hidden">
      <svg className="absolute top-0 w-9 h-9 transform -rotate-180 origin-center" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#26334A" strokeWidth="3.5" strokeDasharray={`${circumference} ${totalCircumference}`} strokeDashoffset="0" strokeLinecap="round" />
        <circle cx="18" cy="18" r={radius} fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={`${circumference} ${totalCircumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-500 ease-out" />
      </svg>
      <span className="text-[11px] font-black z-10 leading-none" style={{ color }}>{value}</span>
    </div>
  );
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
  
  // Equip States
  const [equippedPlaystyles, setEquippedPlaystyles] = useState<string[]>(['', '', '']);
  const [equippedSpecialization, setEquippedSpecialization] = useState<string | null>(null);
  
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'info' | 'archetype' | 'foundation' | 'attributes' | 'playstyles'>('attributes');
  const [activeModal, setActiveModal] = useState<'facilities' | 'masteries' | 'playstyles' | 'specializations' | 'edit_category' | 'physicals' | 'skills_wf' | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [selectedFacView, setSelectedFacView] = useState<string>('');
  const [viewingFacTier, setViewingFacTier] = useState<number>(1);
  const [selectedPsView, setSelectedPsView] = useState<string | null>(null);

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
      setEquippedSpecialization(null);
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

  const openCategoryModal = (category: string) => {
    setEditingCategory(category);
    setActiveModal('edit_category');
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
      setEquippedPlaystyles(prev => prev.map(p => p === psName ? '' : p));
    } else {
      const unlockedSlotIndexes = [0, 1, 2].filter(i => level >= [5, 15, 40][i]);
      const emptyIndex = unlockedSlotIndexes.find(i => equippedPlaystyles[i] === '');
      
      if (emptyIndex !== undefined) {
        if (Object.keys(upgrades).length > 0) {
          setAddedPoints(prev => {
            const next = { ...prev };
            for (const stat in upgrades) next[stat] = upgrades[stat];
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
          for (const stat in upgrades) next[stat] = upgrades[stat];
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

  const activeMasteriesCount = Object.values(unlockedMasteries).reduce((count, status) => count + (status.l10 ? 1 : 0) + (status.l30 ? 1 : 0), 0);
  const totalMasteriesCount = 28; 
  const masteryProgressPct = Math.round((activeMasteries
