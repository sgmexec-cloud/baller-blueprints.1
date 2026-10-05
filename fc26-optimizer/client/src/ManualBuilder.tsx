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
  'Performance Lab': { stats: ['Vision', 'Short Passing'], boosts: [2, 5, 5], cost: [200000, 600000, 1200000], playstyle: 'Tiki Taka' },
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

const getCustomColor = (val: number) => {
  if (val >= 90) return "oklch(84.1% 0.238 128.85)";
  if (val >= 80) return "oklch(53.2% 0.157 131.589)";
  if (val >= 70) return "oklch(90.5% 0.182 98.111)";
  if (val >= 50) return "oklch(75% 0.183 55.934)";
  return "oklch(63.7% 0.237 25.331)";
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
  
  // Dashboard Overlays State
  const [activeModal, setActiveModal] = useState<'facilities' | 'masteries' | 'playstyles' | 'specializations' | 'edit_category' | null>(null);
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
  const masteryProgressPct = Math.round((activeMasteriesCount / totalMasteriesCount) * 100);
  
  const activeFacilitiesCount = Object.keys(equippedFacilities).length;
  const activePlaystylesCount = equippedPlaystyles.filter(ps => ps !== '').length;
  
  const isPsPlusUnlocked = level >= 20;
  const basePsPlus = FIXED_PLAYSTYLE_PLUS[archetype] || 'None';
  
  const activePsPlus = equippedSpecialization 
     ? SPECIALIZATIONS_DATA[archetype]?.find(s => s.name === equippedSpecialization)?.perk || basePsPlus
     : basePsPlus;
  
  const unlockedSlotIndexes = [0, 1, 2].filter(i => level >= [5, 15, 40][i]);
  const hasEmptySlot = unlockedSlotIndexes.some(i => equippedPlaystyles[i] === '');

  // --- REUSABLE CATEGORY CARD ---
  const CategoryCard = ({ category, stats }: { category: string, stats: string[] }) => {
    if (!currentStats) return null;
    const catTotal = stats.reduce((sum, stat) => sum + (currentStats[stat] || 70), 0);
    const catAvg = Math.round(catTotal / stats.length);
    const avgColor = getCustomColor(catAvg);

    return (
      <button
        onClick={() => openCategoryModal(category)}
        className="w-full bg-[#0D1220] border border-[#26334A] rounded-xl p-3 text-left hover:bg-[#131A2A] hover:border-[#4D8DFF]/40 transition-all shadow-sm group"
      >
        <div className="flex justify-between items-start mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#F4F7FB]" style={{ fontFamily: "'Orbitron', sans-serif" }}>{category}</span>
          <HalfCircleGauge value={catAvg} color={avgColor} />
        </div>
        <div className="space-y-2">
          {stats.map(stat => {
            const value = currentStats[stat] || 70;
            const color = getCustomColor(value);
            const displayName = CSV_STAT_MAP[stat] || stat;
            return (
              <div key={stat}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[9px] font-bold text-[#8E9AAF] tracking-wider uppercase group-hover:text-[#F4F7FB] transition-colors">{displayName}</span>
                  <span className="text-[10px] font-black" style={{ color }}>{value}</span>
                </div>
                <div className="h-[2px] w-full bg-[#131A2A] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${value}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          {category === 'Pace' && (
             <div className="mt-2.5 pt-2.5 border-t border-[#26334A]/50">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-[#8E9AAF] tracking-wider uppercase">AccelerATE</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                     accelerate === 'Lengthy' ? 'text-[#8B5CF6]' : accelerate === 'Explosive' ? 'text-[#4D8DFF]' : 'text-[#F4F7FB]'
                  }`}>{accelerate}</span>
                </div>
             </div>
          )}
        </div>
      </button>
    );
  };

  if (isArchLoading || isProgLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080B14]">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#4D8DFF] border-[#131A2A] animate-spin mb-4"></div>
        <p className="text-[#4D8DFF] font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Loading Engine Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] relative overflow-x-clip pt-6 pb-16 px-4">
      <div className="max-w-lg mx-auto relative">
        
        {/* Header Branding */}
        <div className="flex justify-center mb-6 pt-2">
          <img 
            src="/clubs-dna-logo.png"
            alt="ClubsDNA" 
            className="w-full max-w-[280px] h-auto object-contain drop-shadow-[0_0_15px_rgba(77,141,255,0.15)]" 
          />
        </div>

        {/* STICKY TOP DASHBOARD (5-SQUARE GRID) */}
        <div className="sticky top-0 z-40 bg-[#080B14]/95 backdrop-blur-md py-3 -mx-4 px-4 sm:mx-0 sm:px-4 sm:rounded-2xl border-b sm:border border-[#26334A]/60 shadow-[0_10px_30px_rgba(0,0,0,0.5)] mb-6">
          <div className="grid grid-cols-5 gap-2">
            
            {/* Square 1: Logo */}
            <div className="flex items-center justify-center h-14 relative overflow-hidden">
              <img 
                src="/app-icon.png" 
                alt="ClubsDNA" 
                className="w-7 h-7 object-contain drop-shadow-[0_0_10px_rgba(56,130,255,0.2)]"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>';
                }}
              />
            </div>

            {/* Square 2: Blank */}
            <div className="flex items-center justify-center h-14">
            </div>

            {/* Square 3: Archetype Icon (No Name) */}
            <div className="flex items-center justify-center h-14 p-2.5 relative">
               <img 
                  src={`/archetypes/${archetype ? archetype.replace(/\s+/g, '-').toLowerCase() : ''}.png`} 
                  alt={archetype} 
                  className="w-full h-full object-contain opacity-90 drop-shadow-md"
                  onError={(e) => {
                    e.currentTarget.onerror = null; 
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238E9AAF"><circle cx="12" cy="12" r="10" /></svg>';
                  }}
               />
            </div>

            {/* Square 4: Level Dropdown */}
            <div className="flex flex-col items-center justify-center h-14 relative group">
              <span className="text-[8px] font-bold text-[#F7F8FA] uppercase tracking-widest absolute top-1">Lvl</span>
              <select 
                value={level} 
                onChange={(e) => { setLevel(Number(e.target.value)); setAddedPoints({}); }}
                className="bg-transparent text-lg font-black text-[#3882FF] outline-none appearance-none cursor-pointer mt-3 w-full text-center"
              >
                {Array.from({ length: 40 }, (_, i) => i + 1).map(l => (
                  <option key={l} value={l} className="bg-[#131A2A] text-[#3882FF] text-sm">
                    {l}
                  </option>
                ))}
              </select>
              <div className="absolute right-1 top-[55%] pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                <svg className="w-2.5 h-2.5 text-[#3882FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            {/* Square 5: Available AP */}
            <div className="flex flex-col items-center justify-center h-14 relative">
              <span className="text-[8px] font-bold text-[#F7F8FA] uppercase tracking-widest absolute top-1">AP</span>
              <span className="text-xl font-black text-[#3882FF] mt-2.5 leading-none" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                {availableAp}
              </span>
            </div>

          </div>
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

          {/* Archetype Selector (12-Column Staggered Pyramid Layout) */}
          <div>
            <div className="flex items-center gap-2 mb-3 pl-1">
              <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Archetypes
              </span>
            </div>
            
            <div className="grid grid-cols-12 gap-2 pb-4">
              {/* Top Row (5 items, spanning 2 columns each, offset by 1 column: cols 2, 4, 6, 8, 10) */}
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
                  <button
                    key={item.name}
                    onClick={() => handleArchetypeChange(item.name)}
                    className={`${item.col} flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border-2 ${
                      isSelected 
                        ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_15px_rgba(77,141,255,0.2)] scale-[1.02]' 
                        : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="w-7 h-7 mb-1.5 flex items-center justify-center">
                      <img 
                         src={`/archetypes/${iconFilename}`} 
                         alt={item.name} 
                         className="w-full h-full object-contain drop-shadow-md"
                         onError={(e) => {
                           e.currentTarget.onerror = null; 
                           e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>';
                         }}
                      />
                    </div>
                    <div className={`font-black text-[7.5px] sm:text-[8.5px] text-center uppercase tracking-wider leading-tight ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                      {item.name}
                    </div>
                  </button>
                );
              })}

              {/* Bottom Row (6 items, spanning 2 columns each: cols 1, 3, 5, 7, 9, 11) */}
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
                  <button
                    key={item.name}
                    onClick={() => handleArchetypeChange(item.name)}
                    className={`${item.col} flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border-2 ${
                      isSelected 
                        ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_15px_rgba(77,141,255,0.2)] scale-[1.02]' 
                        : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="w-7 h-7 mb-1.5 flex items-center justify-center">
                      <img 
                         src={`/archetypes/${iconFilename}`} 
                         alt={item.name} 
                         className="w-full h-full object-contain drop-shadow-md"
                         onError={(e) => {
                           e.currentTarget.onerror = null; 
                           e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>';
                         }}
                      />
                    </div>
                    <div className={`font-black text-[7.5px] sm:text-[8.5px] text-center uppercase tracking-wider leading-tight ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                      {item.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specialization Launch Card */}
          {SPECIALIZATIONS_DATA[archetype] && (
            <div className="animate-fade-up border-b border-[#26334A]/50 pb-4">
              {equippedSpecialization ? (
                <div 
                  className="bg-gradient-to-r from-[#192235] to-[#131A2A] border border-[#facc15]/40 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(250,204,21,0.1)] cursor-pointer hover:border-[#facc15]/70 transition-all group"
                  onClick={() => setActiveModal('specializations')}
                >
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-[#facc15]/10 flex items-center justify-center border border-[#facc15]/30 group-hover:scale-110 transition-transform">
                        <div className="w-4 h-4 border-2 border-[#facc15] rotate-45 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-[#facc15] -rotate-45" /></div>
                     </div>
                     <div>
                       <div className="text-[11px] font-black tracking-widest uppercase text-[#facc15]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                          {equippedSpecialization}
                       </div>
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

          {/* Physicals Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
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
        </section>

        {/* --- SIGNATURE PERKS --- */}
        {SIGNATURE_PERKS_DATA[archetype] && (
          <section className="animate-fade-up border-t border-[#26334A]/50 pt-6 mt-6">
            <div className="flex items-center gap-2 mb-4 pl-1">
              <div className="w-1 h-3 rounded-full bg-[#21E6A4]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Signature Perks
              </span>
            </div>
            
            <div className="space-y-3">
              {SIGNATURE_PERKS_DATA[archetype].map((perk, index) => {
                const isUnlocked = level >= perk.level;
                
                return (
                  <div 
                    key={index}
                    className={`p-4 rounded-xl border transition-all ${
                      isUnlocked 
                        ? 'bg-[#131A2A] border-[#26334A] shadow-sm' 
                        : 'bg-[#0D1220]/60 border-[#26334A]/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[12px] font-black uppercase tracking-wider ${isUnlocked ? 'text-[#F4F7FB]' : 'text-[#59657A]'}`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
                          {perk.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isUnlocked ? 'text-[#21E6A4]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                          LVL {perk.level}
                        </span>
                        {isUnlocked ? (
                          <svg className="w-3.5 h-3.5 text-[#21E6A4]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-[#59657A]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 17a2 2 0 002-2v-1h-4v1a2 2 0 002 2zm3-6V9a3 3 0 00-6 0v2H8v8h8v-8h-1zm-5-2a2 2 0 014 0v2h-4V9z" /></svg>
                        )}
                      </div>
                    </div>
                    
                    <p className={`text-[10px] leading-relaxed font-medium ${isUnlocked ? 'text-[#8E9AAF]' : 'text-[#59657A]'}`}>
                      <span className={`font-bold ${isUnlocked ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>Effect:</span> {perk.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* --- MAIN FUT CARD GRID --- */}
        {currentStats && serverArchetypes && (
          <section className="animate-fade-up border-t border-[#26334A]/50 pt-6 mt-6">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-[#59657A]" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Player Attributes
                </span>
              </div>
              <span className="text-[9px] text-[#59657A] font-bold tracking-widest uppercase">Tap to Edit</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <CategoryCard category="Pace" stats={STAT_GROUPS["Pace"]} />
                <CategoryCard category="Passing" stats={STAT_GROUPS["Passing"]} />
                <CategoryCard category="Defending" stats={STAT_GROUPS["Defending"]} />
              </div>
              <div className="space-y-3">
                <CategoryCard category="Shooting" stats={STAT_GROUPS["Shooting"]} />
                <CategoryCard category="Dribbling" stats={STAT_GROUPS["Dribbling"]} />
                <CategoryCard category="Physical" stats={STAT_GROUPS["Physical"]} />
              </div>
            </div>
          </section>
        )}

        {/* --- APP DASHBOARD CARDS --- */}
        <section className="mt-8 border-t border-[#26334A]/50 pt-6">
          <div className="flex items-center gap-2 mb-3 pl-1">
            <div className="w-1 h-3 rounded-full bg-[#8B5CF6]" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              Club Enhancements
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            
            <button onClick={() => setActiveModal('masteries')} className="bg-[#131A2A] border border-[#26334A] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-[#192235] hover:border-[#8B5CF6]/40 transition-all group">
               <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center group-hover:scale-110 transition-transform p-1.5 overflow-hidden">
                   <img 
                     src="/icons/masteries.png" 
                     alt="Masteries" 
                     className="w-full h-full object-contain"
                     onError={(e) => {
                       e.currentTarget.onerror = null;
                       e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238B5CF6"><path d="M12 2L2 9l10 7 10-7-10-7z"/></svg>';
                     }}
                   />
               </div>
               <div className="text-center">
                   <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Masteries</div>
                   <div className="text-[9px] text-[#8E9AAF] font-bold uppercase mt-1 tracking-wider">{activeMasteriesCount} Active</div>
               </div>
            </button>
            
            <button onClick={openFacilitiesModal} className="bg-[#131A2A] border border-[#26334A] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-[#192235] hover:border-[#4D8DFF]/40 transition-all group">
               <div className="w-10 h-10 rounded-full bg-[#4D8DFF]/10 flex items-center justify-center group-hover:scale-110 transition-transform p-2 overflow-hidden">
                   <img 
                     src="/icons/facilities.png" 
                     alt="Facilities" 
                     className="w-full h-full object-contain"
                     onError={(e) => {
                       e.currentTarget.onerror = null;
                       e.currentTarget.outerHTML = '<div class="w-3 h-3 rounded-full bg-[#4D8DFF]"></div>';
                     }}
                   />
               </div>
               <div className="text-center">
                   <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Facilities</div>
                   <div className="text-[9px] text-[#8E9AAF] font-bold uppercase mt-1 tracking-wider">{activeFacilitiesCount} Equipped</div>
               </div>
            </button>
            
            <button onClick={() => setActiveModal('playstyles')} className="col-span-2 bg-[#131A2A] border border-[#26334A] p-4 rounded-2xl flex items-center justify-between hover:bg-[#192235] hover:border-[#F4F7FB]/40 transition-all group">
               <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4D8DFF] to-[#8B5CF6] opacity-90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(77,141,255,0.2)]">
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

      </div>

      {/* =========================================
          MODALS / OVERLAYS
      ========================================= */}

      {/* EDIT CATEGORY MODAL */}
      {activeModal === 'edit_category' && editingCategory && currentStats && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg mx-auto bg-[#080B14] rounded-t-3xl border-t border-[#4D8DFF]/50 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up overflow-hidden flex flex-col max-h-[85vh]">
             
             <div className="flex items-center justify-between p-5 bg-[#0D1220] border-b border-[#26334A]">
               <div>
                  <h2 className="text-lg font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Edit {editingCategory}</h2>
                  <div className="text-[10px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1">AP Remaining: {availableAp}</div>
               </div>
               <button onClick={() => { setActiveModal(null); setEditingCategory(null); }} className="w-8 h-8 rounded-full bg-[#131A2A] text-[#8E9AAF] flex items-center justify-center hover:bg-[#192235] hover:text-[#F4F7FB] transition-colors">✕</button>
             </div>
             
             <div className="p-4 overflow-y-auto space-y-2 hide-scrollbar pb-12">
                {STAT_GROUPS[editingCategory].map(stat => {
                  const value = currentStats[stat] || 70;
                  const caps = getStatCaps(archetype, stat);
                  const physMod = physicalModifiers[stat] || 0;
                  const facMod = facilityModifiers[stat] || 0;
                  const mastMod = masteryModifiers[stat] || 0;
                  const baseVal = Math.max(1, (caps.min || serverArchetypes?.[archetype]?.base?.[stat] || 70) + physMod + facMod + mastMod);
                  const invested = addedPoints[stat] || 0;
                  const statApSpent = getCostForPoints(archetype, stat, baseVal, invested);
                  
                  return (
                    <div key={stat} className="flex flex-col py-3 border-b border-[#26334A]/50 last:border-0">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <div className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
                            {stat}
                          </div>
                          <div className="text-[9px] text-[#59657A] font-medium tracking-widest uppercase mt-0.5">
                            CAP: {caps.max || 99} <span className="mx-1">•</span> {statApSpent} AP Spent
                          </div>
                        </div>
                        <span className="text-2xl font-black tabular-nums tracking-tight" style={{ color: getCustomColor(value) }}>{value}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1">
                        <button 
                          onClick={() => handleSliderChange(stat, value - 1)}
                          disabled={invested <= 0}
                          className="w-8 h-8 rounded-lg border border-[#26334A] bg-[#0D1220] text-[#8E9AAF] font-bold disabled:opacity-30 hover:text-[#F4F7FB] hover:border-[#4D8DFF] flex items-center justify-center transition-all"
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
                          className="w-8 h-8 rounded-lg border border-[#26334A] bg-[#0D1220] text-[#8E9AAF] font-bold disabled:opacity-30 hover:text-[#F4F7FB] hover:border-[#4D8DFF] flex items-center justify-center transition-all"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      )}

      {/* FACILITIES MODAL */}
      {activeModal === 'facilities' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Club Facilities</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            
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
                  const iconPath = `/icons/facilities/${facName.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')}.png`;
                  
                  return (
                    <button key={facName} onClick={() => handleSelectFacilityView(facName)} className={`w-full p-3 flex items-center gap-3 text-left border-b border-[#26334A]/30 transition-colors ${isSelected ? 'bg-[#192235]' : 'hover:bg-[#131A2A]'}`}>
                      <div className="w-8 h-8 shrink-0 rounded-full bg-[#080B14] border border-[#26334A] flex items-center justify-center p-1.5 overflow-hidden">
                         <img 
                             src={iconPath}
                             alt={facName}
                             className="w-full h-full object-contain"
                             onError={(e) => {
                                 e.currentTarget.onerror = null;
                                 e.currentTarget.outerHTML = '<div class="w-2 h-2 rounded-full bg-[#4D8DFF]"></div>';
                             }}
                         />
                      </div>
                      <div>
                        <div className={`text-[11px] font-bold leading-snug tracking-wide ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>{facName}</div>
                        {equippedTier && <div className="text-[9px] text-[#21E6A4] uppercase mt-1 tracking-wider font-bold">★ Tier {equippedTier}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="w-[55%] p-4 flex flex-col items-center bg-[#080B14] overflow-y-auto">
                {selectedFacView && FACILITIES[selectedFacView] && (
                  <>
                    <div className="w-full text-center mb-6 pt-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-[#131A2A] border border-[#26334A] flex items-center justify-center mb-3 overflow-hidden p-2">
                        <img 
                            src={`/icons/facilities/${selectedFacView.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')}.png`} 
                            alt={selectedFacView}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.outerHTML = '<div class="w-4 h-4 rounded-full bg-[#4D8DFF]"></div>';
                            }}
                        />
                      </div>
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
                      <div className="text-xs font-bold text-[#21E6A4] tracking-wide">
                        +{FACILITIES[selectedFacView].boosts[viewingFacTier - 1]} <br/> {FACILITIES[selectedFacView].stats.join(' & ')}
                      </div>
                      
                      {viewingFacTier === 3 && FACILITIES[selectedFacView].playstyle && (
                        <div className="mt-4 pt-3 border-t border-[#26334A]/50 animate-fade-in">
                           <div className="text-[9px] text-[#facc15] uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                             <div className="w-1 h-1 rounded-full bg-[#facc15]" />
                             Tier 3 Team PlayStyle
                             <div className="w-1 h-1 rounded-full bg-[#facc15]" />
                           </div>
                           <div className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider flex items-center justify-center gap-2">
                             <img 
                               src={getPlaystyleIconPath(FACILITIES[selectedFacView].playstyle, false)} 
                               alt="" 
                               className="w-4 h-4 object-contain"
                               onError={(e) => { e.currentTarget.style.display = 'none'; }}
                             />
                             {FACILITIES[selectedFacView].playstyle}
                           </div>
                        </div>
                      )}
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
                    <svg className={`w-4 h-4 ${masteryProgressPct >= 50 ? 'text-[#8B5CF6]' : masteryProgressPct > 0 ? 'text-[#4D8DFF]' : 'text-[#59657A]'}`} fill="currentColor" viewBox="0 0 24 24">
                       <path d="M12 2L2 9l10 7 10-7-10-7zm0 10l-10-7v4l10 7 10-7v-4l-10 7z" />
                    </svg>
                 </div>
                 <div className="flex-1 h-2 bg-[#080B14] rounded-full overflow-hidden border border-[#26334A]">
                    <div 
                      className="h-full bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] transition-all duration-500 ease-out"
                      style={{ width: `${masteryProgressPct}%` }}
                    />
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
                          <img 
                             src={`/archetypes/${iconFilename}`} 
                             alt={arch} 
                             className="w-full h-full object-contain drop-shadow-md"
                             onError={(e) => {
                               e.currentTarget.onerror = null; 
                               e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>';
                             }}
                          />
                       </div>
                       <span className="text-[9px] font-black uppercase tracking-wider text-[#F4F7FB] text-center leading-tight">{arch}</span>
                    </div>
                    
                    <button 
                      onClick={() => toggleMasteryUnlock(arch, 'l10')}
                      className={`w-1/3 p-2 flex flex-col items-center justify-center border-r border-[#26334A] transition-all duration-200 group ${status.l10 ? 'bg-[#4D8DFF]/20' : 'bg-[#0D1220] hover:bg-[#131A2A]'}`}
                    >
                       {Object.entries(masteryDef.l10).map(([stat, val]) => (
                          <div key={stat} className={`text-[10px] font-black tracking-widest uppercase transition-colors ${status.l10 ? 'text-[#4D8DFF]' : 'text-[#8E9AAF] group-hover:text-[#F4F7FB]'}`}>
                             {STAT_ABBR[stat]} <span className="opacity-80 ml-0.5">+{val}</span>
                          </div>
                       ))}
                    </button>

                    <button 
                      onClick={() => toggleMasteryUnlock(arch, 'l30')}
                      className={`w-1/3 p-2 flex flex-col items-center justify-center transition-all duration-200 group ${status.l30 ? 'bg-[#8B5CF6]/20' : 'bg-[#0D1220] hover:bg-[#131A2A]'}`}
                    >
                       {Object.entries(masteryDef.l30).map(([stat, val]) => (
                          <div key={stat} className={`text-[10px] font-black tracking-widest uppercase transition-colors ${status.l30 ? 'text-[#8B5CF6]' : 'text-[#8E9AAF] group-hover:text-[#F4F7FB]'}`}>
                             {STAT_ABBR[stat]} <span className="opacity-80 ml-0.5">+{val}</span>
                          </div>
                       ))}
                    </button>
                    
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-0 left-0 w-full p-4 bg-[#0D1220]/90 backdrop-blur-md border-t border-[#26334A] flex gap-3 z-20">
               <button 
                 onClick={() => setActiveModal(null)}
                 className="flex-1 py-3 rounded-xl bg-[#131A2A] border border-[#26334A] text-[#8E9AAF] font-bold uppercase tracking-widest text-[10px] hover:bg-[#192235] hover:text-[#F4F7FB] transition-all"
               >
                 Cancel
               </button>
               <button 
                 onClick={() => setActiveModal(null)}
                 className="flex-[2] py-3 rounded-xl bg-[#4D8DFF] text-[#080B14] font-black uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(77,141,255,0.3)] hover:bg-[#4D8DFF]/90 transition-all"
               >
                 Save to this Build Only
               </button>
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

            <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${selectedPsView ? 'pb-64' : 'pb-8'} hide-scrollbar`}>
              
              <div>
                <div className="flex items-center gap-2 mb-3 border-b border-[#26334A] pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#facc15]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle+ (Gold)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-[#131A2A] border border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.15)] rounded-xl p-3.5 flex flex-row items-center gap-3 relative overflow-hidden group text-left">
                     <div className="absolute top-0 right-0 w-12 h-12 bg-[#facc15]/10 rounded-full blur-xl" />
                     {/* 50% width left container for icon */}
                     <div className="w-1/2 flex items-center justify-center">
                       <img 
                         src={getPlaystyleIconPath(activePsPlus, true)} 
                         alt={activePsPlus} 
                         className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                         onError={(e) => {
                           e.currentTarget.style.display = 'none';
                         }}
                       />
                     </div>
                     {/* 50% width right container for name/status */}
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
                          
                          return (
                            <button 
                              key={ps.name}
                              onClick={() => setSelectedPsView(ps.name)}
                              className={`rounded-xl p-3 flex flex-row items-center gap-2.5 relative overflow-hidden text-left transition-all duration-200 border ${
                                isSelected 
                                  ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_12px_rgba(77,141,255,0.2)] ring-1 ring-[#4D8DFF]/50' 
                                  : isEquipped 
                                    ? 'bg-[#131A2A] border-[#21E6A4]/60' 
                                    : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]'
                              }`}
                            >
                              {/* Left 50% for Icon */}
                              <div className="w-1/2 flex items-center justify-center">
                                 <img 
                                   src={getPlaystyleIconPath(ps.name, isEquipped)} 
                                   alt={ps.name} 
                                   className="w-8 h-8 object-contain drop-shadow-sm"
                                   onError={(e) => {
                                     e.currentTarget.style.display = 'none';
                                   }}
                                 />
                              </div>
                              {/* Right 50% for Name and Equipped status */}
                              <div className="w-1/2 flex flex-col justify-center">
                                {isEquipped && <span className="text-[7px] bg-[#21E6A4]/20 text-[#21E6A4] border border-[#21E6A4]/40 px-1 py-0.5 rounded font-black tracking-widest uppercase mb-0.5 w-fit">Equipped</span>}
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
                          <div className="w-10 h-10 flex items-center justify-center">
                            <img 
                              src={getPlaystyleIconPath(ps.name, isEquipped)} 
                              alt={ps.name} 
                              className="w-full h-full object-contain drop-shadow-md"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
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
                                    const currentVal = currentStats?.[req.stat] || 70;
                                    const targetVal = req.min;
                                    const isMet = currentVal >= targetVal;
                                    const isImpossible = targetVal > (getStatCaps(archetype, req.stat).max || 99);
                                    
                                    return (
                                       <div key={req.stat}>
                                          <div className="flex justify-between items-end mb-1">
                                             <span className="text-[9px] font-bold uppercase tracking-wide text-[#8E9AAF] leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>
                                               {STAT_ABBR[req.stat]}
                                             </span>
                                             <span className={`text-[10px] font-black leading-none ${isMet ? 'text-[#21E6A4]' : isImpossible ? 'text-[#ff4d4d]' : 'text-[#F4F7FB]'}`}>
                                               {currentVal}<span className="text-[#59657A] font-medium text-[8px] mx-0.5">/</span>{targetVal}
                                             </span>
                                          </div>
                                       </div>
                                    )
                                 })}
                               </div>
                             </div>
                          </div>

                          <button 
                            onClick={() => handleActionSpecialization(spec.name, upgrades, isEquipped)}
                            disabled={!isEquipped && !canEquip}
                            className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 ${
                              isEquipped 
                                ? 'bg-[#131A2A] text-[#facc15] border border-[#facc15]/30 hover:bg-[#192235]'
                                : !canEquip
                                  ? 'bg-[#131A2A] text-[#59657A] border border-[#26334A] cursor-not-allowed'
                                  : 'bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] hover:bg-[#4D8DFF] hover:text-[#080B14] shadow-[0_0_15px_rgba(77,141,255,0.15)]'
                            }`}
                          >
                            {isEquipped 
                              ? '✔ Equipped' 
                              : !canEquip 
                                ? reason 
                                : cost > 0 
                                  ? `Unlock (${cost} AP)` 
                                  : 'Equip Path'}
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
