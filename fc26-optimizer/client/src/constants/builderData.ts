export const STAT_GROUPS: Record<string, string[]> = {
  "Pace": ["Acceleration", "Sprint Speed"],
  "Shooting": ["Attack Positioning", "Finishing", "Shot Power", "Long Shots", "Volleys", "Penalties"],
  "Passing": ["Vision", "Crossing", "FK Accuracy", "Short Passing", "Long Passing", "Curve"],
  "Dribbling": ["Agility", "Balance", "Reactions", "Ball Control", "Dribbling", "Composure"],
  "Defending": ["Interceptions", "Heading Accuracy", "Def Awareness", "Standing Tackle", "Sliding Tackle"],
  "Physical": ["Jumping", "Stamina", "Strength", "Aggression"]
};

export const STAT_KEY_MAP: Record<string, string> = {
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

export const CSV_STAT_MAP: Record<string, string> = {
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

export const STAT_ABBR: Record<string, string> = {
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

export const CLUB_BUDGETS: Record<number, number> = {
  1: 1000000, 2: 1100000, 3: 1200000, 4: 1300000, 5: 1500000,
  6: 1700000, 7: 1900000, 8: 2100000, 9: 2300000, 10: 2500000
};

