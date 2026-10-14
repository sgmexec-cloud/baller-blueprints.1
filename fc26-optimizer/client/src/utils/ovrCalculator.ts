export function calculateOVR(stats: Record<string, number>, position: string): number {
  const v = (key: string) => stats[key] || 10; 
  
  const pos = position?.toUpperCase() || "";
  let a = 0;

  if (["GK"].includes(pos)) {
    a = v('Reactions')*0.11 + v('GK Diving')*0.21 + v('GK Handling')*0.21 + v('GK Kicking')*0.05 + v('GK Positioning')*0.21 + v('GK Reflexes')*0.21;
  } else if (["SW"].includes(pos)) {
    a = v('Jumping')*0.04 + v('Strength')*0.10 + v('Reactions')*0.05 + v('Aggression')*0.08 + v('Interceptions')*0.08 + v('Ball Control')*0.05 + v('Heading Accuracy')*0.10 + v('Short Passing')*0.05 + v('Def Awareness')*0.15 + v('Standing Tackle')*0.15 + v('Sliding Tackle')*0.15;
  } else if (["RWB", "LWB"].includes(pos)) {
    a = v('Acceleration')*0.04 + v('Sprint Speed')*0.06 + v('Stamina')*0.10 + v('Reactions')*0.08 + v('Interceptions')*0.12 + v('Ball Control')*0.08 + v('Crossing')*0.12 + v('Dribbling')*0.04 + v('Short Passing')*0.10 + v('Def Awareness')*0.07 + v('Standing Tackle')*0.08 + v('Sliding Tackle')*0.11;
  } else if (["RB", "LB"].includes(pos)) {
    a = v('Acceleration')*0.05 + v('Sprint Speed')*0.11 + v('Stamina')*0.08 + v('Reactions')*0.08 + v('Interceptions')*0.12 + v('Ball Control')*0.07 + v('Crossing')*0.09 + v('Heading Accuracy')*0.04 + v('Short Passing')*0.03 + v('Def Awareness')*0.08 + v('Standing Tackle')*0.11 + v('Sliding Tackle')*0.14;
  } else if (["CB", "RCB", "LCB"].includes(pos)) {
    a = v('Sprint Speed')*0.02 + v('Jumping')*0.03 + v('Strength')*0.10 + v('Reactions')*0.05 + v('Aggression')*0.07 + v('Interceptions')*0.13 + v('Ball Control')*0.04 + v('Heading Accuracy')*0.10 + v('Short Passing')*0.05 + v('Def Awareness')*0.14 + v('Standing Tackle')*0.17 + v('Sliding Tackle')*0.10;
  } else if (["CDM", "RDM", "LDM"].includes(pos)) {
    a = v('Stamina')*0.06 + v('Strength')*0.04 + v('Reactions')*0.07 + v('Aggression')*0.05 + v('Interceptions')*0.14 + v('Vision')*0.08 + v('Ball Control')*0.10 + v('Long Passing')*0.10 + v('Short Passing')*0.10 + v('Def Awareness')*0.09 + v('Standing Tackle')*0.12 + v('Sliding Tackle')*0.05;
  } else if (["RM", "LM"].includes(pos)) {
    a = v('Acceleration')*0.07 + v('Sprint Speed')*0.06 + v('Stamina')*0.05 + v('Reactions')*0.07 + v('Attack Positioning')*0.08 + v('Vision')*0.07 + v('Ball Control')*0.13 + v('Crossing')*0.10 + v('Dribbling')*0.15 + v('Finishing')*0.06 + v('Long Passing')*0.05 + v('Short Passing')*0.11;
  } else if (["CM", "RCM", "LCM"].includes(pos)) {
    a = v('Stamina')*0.06 + v('Reactions')*0.08 + v('Interceptions')*0.05 + v('Attack Positioning')*0.06 + v('Vision')*0.13 + v('Ball Control')*0.14 + v('Dribbling')*0.07 + v('Finishing')*0.02 + v('Long Passing')*0.13 + v('Short Passing')*0.17 + v('Long Shots')*0.04 + v('Standing Tackle')*0.05;
  } else if (["CAM", "RAM", "LAM"].includes(pos)) {
    a = v('Acceleration')*0.04 + v('Sprint Speed')*0.03 + v('Agility')*0.03 + v('Reactions')*0.07 + v('Attack Positioning')*0.09 + v('Vision')*0.14 + v('Ball Control')*0.15 + v('Dribbling')*0.13 + v('Finishing')*0.07 + v('Long Passing')*0.04 + v('Short Passing')*0.16 + v('Long Shots')*0.05;
  } else if (["CF", "RF", "LF"].includes(pos)) {
    a = v('Acceleration')*0.05 + v('Sprint Speed')*0.05 + v('Reactions')*0.09 + v('Attack Positioning')*0.13 + v('Vision')*0.08 + v('Ball Control')*0.15 + v('Dribbling')*0.14 + v('Finishing')*0.11 + v('Heading Accuracy')*0.02 + v('Short Passing')*0.09 + v('Shot Power')*0.05 + v('Long Shots')*0.04;
  } else if (["RW", "LW"].includes(pos)) {
    a = v('Acceleration')*0.07 + v('Sprint Speed')*0.06 + v('Agility')*0.03 + v('Reactions')*0.07 + v('Attack Positioning')*0.09 + v('Vision')*0.06 + v('Ball Control')*0.14 + v('Crossing')*0.09 + v('Dribbling')*0.16 + v('Finishing')*0.10 + v('Short Passing')*0.09 + v('Long Shots')*0.04;
  } else if (["ST", "RS", "LS"].includes(pos)) {
    a = v('Acceleration')*0.04 + v('Sprint Speed')*0.05 + v('Strength')*0.05 + v('Reactions')*0.08 + v('Attack Positioning')*0.15 + v('Ball Control')*0.10 + v('Dribbling')*0.07 + v('Finishing')*0.18 + v('Heading Accuracy')*0.10 + v('Short Passing')*0.05 + v('Shot Power')*0.08 + v('Long Shots')*0.03 + v('Volleys')*0.02;
  }
  
  if (a === 0) return 0;
  
  return Math.round(a);
}
