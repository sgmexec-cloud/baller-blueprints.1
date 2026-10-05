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
    { name: "CAPITANO", perk: "Block+", inspiredBy: "Inspired by Paolo Maldini", desc: "Read the game flawlessly and
