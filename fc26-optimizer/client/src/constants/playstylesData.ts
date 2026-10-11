import type { StatReq } from '@/types/builder';

export const MASTERIES: Record<string, { l10: Record<string, number>, l30: Record<string, number> }> = {
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

export const SIGNATURE_PERKS_DATA: Record<string, { name: string; level: number; desc: string }[]> = {
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

export const SPECIALIZATIONS_DATA: Record<string, { name: string; perk: string; inspiredBy: string; desc: string; reqs: StatReq[] }[]> = {
  "Boss": [
    { name: "BOSS+", perk: "Slide Tackle+", inspiredBy: "Inspired by Nemanja Vidić", desc: "Gain defensive dominance with a massive boost to tackling.", reqs: [ { stat: "Strength", min: 90 }, { stat: "Aggression", min: 90 }, { stat: "Sliding Tackle", min: 92 } ] },
    { name: "ENFORCER", perk: "Press Proven+", inspiredBy: "Inspired by Patrick Vieira", desc: "Control the defensive transition with extreme ball retention.", reqs: [ { stat: "Composure", min: 92 }, { stat: "Vision", min: 90 }, { stat: "Ball Control", min: 90 } ] },
    { name: "CAPITANO", perk: "Block+", inspiredBy: "Inspired by Paolo Maldini", desc: "Read the game flawlessly and block critical passes.", reqs: [ { stat: "Def Awareness", min: 92 }, { stat: "Reactions", min: 90 }, { stat: "Agility", min: 90 } ] }
  ],
  "Progressor": [
    { name: "PROGRESSOR+", perk: "Jockey+", inspiredBy: "Inspired by Fernando Hierro", desc: "Signature Perk: Wall Bounce", reqs: [ { stat: "Long Passing", min: 90 }, { stat: "Def Awareness", min: 90 }, { stat: "Standing Tackle", min: 92 } ] },
    { name: "PIONEER", perk: "Pinged Pass+", inspiredBy: "Inspired by Franco Baresi", desc: "Signature Perk: Unexpected Forward", reqs: [ { stat: "Dribbling", min: 92 }, { stat: "Long Passing", min: 90 }, { stat: "Short Passing", min: 90 } ] },
    { name: "JANITOR", perk: "Quick Step+", inspiredBy: "Inspired by Rio Ferdinand", desc: "Signature Perk: Last Player Back", reqs: [ { stat: "Acceleration", min: 92 }, { stat: "Sprint Speed", min: 90 }, { stat: "Sliding Tackle", min: 90 } ] }
  ],
  "Marauder": [
    { name: "MARAUDER+", perk: "Slide Tackle+", inspiredBy: "Inspired by Cafu", desc: "Signature Perk: On the Move", reqs: [ { stat: "Sprint Speed", min: 92 }, { stat: "Aggression", min: 90 }, { stat: "Sliding Tackle", min: 90 } ] },
    { name: "SPEEDSTER", perk: "Rapid+", inspiredBy: "Inspired by Roberto Carlos", desc: "Signature Perk: Wing Burner", reqs: [ { stat: "Dribbling", min: 92 }, { stat: "Sprint Speed", min: 92 }, { stat: "Acceleration", min: 90 } ] },
    { name: "ATHLETE", perk: "Bruiser+", inspiredBy: "Inspired by Lilian Thuram", desc: "Signature Perk: Wide Recovery", reqs: [ { stat: "Strength", min: 92 }, { stat: "Aggression", min: 90 }, { stat: "Def Awareness", min: 90 } ] }
  ],
  "Disruptor": [
    { name: "DISRUPTOR+", perk: "Intercept+", inspiredBy: "Inspired by Roy Keane", desc: "Signature Perk: Wide Recovery", reqs: [ { stat: "Balance", min: 90 }, { stat: "Reactions", min: 90 }, { stat: "Interceptions", min: 92 } ] },
    { name: "DESTROYER", perk: "Slide Tackle+", inspiredBy: "Inspired by Gennaro Gattuso", desc: "Signature Perk: Give and GOOO", reqs: [ { stat: "Sprint Speed", min: 90 }, { stat: "Strength", min: 92 }, { stat: "Sliding Tackle", min: 90 } ] },
    { name: "ANCHOR", perk: "Bruiser+", inspiredBy: "Inspired by Frank Rijkaard", desc: "Signature Perk: Workhorse", reqs: [ { stat: "Ball Control", min: 90 }, { stat: "Dribbling", min: 90 }, { stat: "Short Passing", min: 90 } ] }
  ],
  "Finisher": [
    { name: "FINISHER+", perk: "Chip Shot+", inspiredBy: "Inspired by Alex Morgan", desc: "Signature Perk: 6th Sense", reqs: [ { stat: "Ball Control", min: 90 }, { stat: "Composure", min: 92 }, { stat: "Reactions", min: 90 } ] },
    { name: "PRESSER", perk: "Relentless+", inspiredBy: "Inspired by Carlos Tévez", desc: "Signature Perk: Turnover Finisher", reqs: [ { stat: "Agility", min: 90 }, { stat: "Stamina", min: 92 }, { stat: "Aggression", min: 90 } ] },
    { name: "HUNTER", perk: "Gamechanger+", inspiredBy: "Inspired by Birgit Prinz", desc: "Signature Perk: First Time Finisher", reqs: [ { stat: "Attack Positioning", min: 90 }, { stat: "Finishing", min: 90 }, { stat: "Curve", min: 92 } ] }
  ],
  "Target": [
    { name: "TARGET+", perk: "Acrobatic+", inspiredBy: "Inspired by Zlatan Ibrahimović", desc: "Signature Perk: Line Breaker", reqs: [ { stat: "Agility", min: 90 }, { stat: "Jumping", min: 92 }, { stat: "Volleys", min: 90 } ] },
    { name: "ROAMER", perk: "Incisive Pass+", inspiredBy: "Inspired by Dennis Bergkamp", desc: "Signature Perk: Blind Passer", reqs: [ { stat: "Vision", min: 90 }, { stat: "Long Passing", min: 90 }, { stat: "Short Passing", min: 92 } ] },
    { name: "RUNNER", perk: "Enforcer+", inspiredBy: "Inspired by Ronaldo", desc: "Signature Perk: High Speed Shooter", reqs: [ { stat: "Sprint Speed", min: 92 }, { stat: "Strength", min: 90 }, { stat: "Attack Positioning", min: 90 } ] }
  ],
  "Magician": [
    { name: "MAGICIAN+", perk: "First Touch+", inspiredBy: "Inspired by Ronaldinho", desc: "Signature Perk: One, Two", reqs: [ { stat: "Acceleration", min: 90 }, { stat: "Composure", min: 90 }, { stat: "Ball Control", min: 92 } ] },
    { name: "HOTSHOT", perk: "Power Shot+", inspiredBy: "Inspired by Thierry Henry", desc: "Signature Perk: Cut and Shoot", reqs: [ { stat: "Finishing", min: 90 }, { stat: "Shot Power", min: 92 }, { stat: "Long Shots", min: 90 } ] },
    { name: "INVADER", perk: "Incisive Pass+", inspiredBy: "Inspired by Mia Hamm", desc: "Signature Perk: Silver Platter", reqs: [ { stat: "Attack Positioning", min: 90 }, { stat: "Vision", min: 92 }, { stat: "Long Passing", min: 90 } ] }
  ],
  "Maestro": [
    { name: "MAESTRO+", perk: "Technical+", inspiredBy: "Inspired by Toni Kroos", desc: "Signature Perk: Give and GOOO", reqs: [ { stat: "Balance", min: 90 }, { stat: "Vision", min: 92 }, { stat: "Dribbling", min: 90 } ] },
    { name: "CRASHER", perk: "First Touch+", inspiredBy: "Inspired by Frank Lampard", desc: "Signature Perk: Raider", reqs: [ { stat: "Finishing", min: 90 }, { stat: "Ball Control", min: 90 }, { stat: "Composure", min: 92 } ] },
    { name: "HEARTBEAT", perk: "Relentless+", inspiredBy: "Inspired by Pavel Nedvěd", desc: "Signature Perk: Foot in and Run", reqs: [ { stat: "Agility", min: 92 }, { stat: "Stamina", min: 90 }, { stat: "Aggression", min: 90 } ] }
  ],
  "Creator": [
    { name: "CREATOR+", perk: "Whipped Pass+", inspiredBy: "Inspired by Andrés Iniesta", desc: "Signature Perk: Assistant", reqs: [ { stat: "Vision", min: 92 }, { stat: "Crossing", min: 90 }, { stat: "Long Passing", min: 90 } ] },
    { name: "ARCHITECT", perk: "Dead Ball+", inspiredBy: "Inspired by David Beckham", desc: "Signature Perk: Air Mail", reqs: [ { stat: "Crossing", min: 92 }, { stat: "FK Accuracy", min: 90 }, { stat: "Shot Power", min: 90 } ] },
    { name: "SNIPER", perk: "Power Shot+", inspiredBy: "Inspired by Zinedine Zidane", desc: "Signature Perk: Stunning Shooter", reqs: [ { stat: "Finishing", min: 90 }, { stat: "Shot Power", min: 92 }, { stat: "Long Shots", min: 90 } ] }
  ],
  "Recycler": [
    { name: "RECYCLER+", perk: "Pinged Pass+", inspiredBy: "Inspired by Claude Makélélé", desc: "Signature Perk: Hard and Fast", reqs: [ { stat: "Strength", min: 90 }, { stat: "Long Passing", min: 90 }, { stat: "Short Passing", min: 92 } ] },
    { name: "DRIVER", perk: "Enforcer+", inspiredBy: "Inspired by Yaya Touré", desc: "Signature Perk: Heart", reqs: [ { stat: "Sprint Speed", min: 90 }, { stat: "Balance", min: 92 }, { stat: "Strength", min: 90 } ] },
    { name: "THIEF", perk: "Anticipate+", inspiredBy: "Inspired by Michaël Essien", desc: "Signature Perk: Quick Fix", reqs: [ { stat: "Interceptions", min: 90 }, { stat: "Def Awareness", min: 90 }, { stat: "Standing Tackle", min: 92 } ] }
  ],
  "Spark": [
    { name: "SPARK+", perk: "Quick Step+", inspiredBy: "Inspired by Luís Figo", desc: "Signature Perk: Twinkle Toes", reqs: [ { stat: "Agility", min: 92 }, { stat: "Sprint Speed", min: 90 }, { stat: "Acceleration", min: 90 } ] },
    { name: "JOKER", perk: "Whipped Pass+", inspiredBy: "Inspired by Eden Hazard", desc: "Signature Perk: Selfless", reqs: [ { stat: "Attack Positioning", min: 90 }, { stat: "Crossing", min: 92 }, { stat: "Long Passing", min: 90 } ] },
    { name: "ACE", perk: "Chip Shot+", inspiredBy: "Inspired by Jay-Jay Okocha", desc: "Signature Perk: Stunning Shooter", reqs: [ { stat: "Reactions", min: 90 }, { stat: "Ball Control", min: 90 }, { stat: "Finishing", min: 92 } ] }
  ]
};

export const FACILITIES: Record<string, { stats: string[], boosts: number[], cost: number[], playstyle: string }> = {
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

export const FIXED_PLAYSTYLE_PLUS: Record<string, string> = {
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

export const PLAYSTYLES_DATA: { name: string; category: string; reqs: StatReq[] }[] = [
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

export const PLAYSTYLE_CATEGORIES = [
  { id: 'scoring', label: 'Scoring' },
  { id: 'passing', label: 'Passing' },
  { id: 'ball_control', label: 'Ball Control' },
  { id: 'defending', label: 'Defending' },
  { id: 'physical', label: 'Physical' },
  { id: 'goalkeeping', label: 'Goalkeeping' }
];
