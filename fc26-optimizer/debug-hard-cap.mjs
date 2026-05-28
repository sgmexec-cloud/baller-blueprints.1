import { runMathEngine } from "./server/mathEngine.ts";

const blueprint = {
  archetype: "Magician",
  playstylePlus: ["Technical+", "FinesseShot+", "ChipShot+"],
  playstyles: [
    { name: "FinesseShot", requirements: [{ attr: "Finishing", val: 75 }, { attr: "Vision", val: 80 }, { attr: "Curve", val: 80 }] },
    { name: "Technical", requirements: [{ attr: "Balance", val: 80 }, { attr: "BallControl", val: 75 }, { attr: "Dribbling", val: 80 }] },
    { name: "Rapid", requirements: [{ attr: "Acceleration", val: 75 }, { attr: "SprintSpeed", val: 80 }, { attr: "Dribbling", val: 80 }] },
    { name: "TikiTaka", requirements: [{ attr: "ShortPassing", val: 75 }, { attr: "Reactions", val: 80 }, { attr: "BallControl", val: 80 }] },
    { name: "FirstTouch", requirements: [{ attr: "BallControl", val: 75 }, { attr: "Composure", val: 80 }] },
    { name: "Trickster", requirements: [{ attr: "Acceleration", val: 80 }, { attr: "Agility", val: 75 }, { attr: "Dribbling", val: 80 }] },
    { name: "Gamechanger", requirements: [{ attr: "Finishing", val: 75 }, { attr: "Curve", val: 80 }, { attr: "Composure", val: 80 }] },
    { name: "Inventive", requirements: [{ attr: "LongPassing", val: 75 }, { attr: "Curve", val: 80 }, { attr: "Composure", val: 80 }] },
  ],
  coreAttributes: ["Acceleration", "SprintSpeed", "Finishing", "Dribbling", "BallControl", "Agility", "Curve", "Reactions"],
  secondaryAttributes: ["Balance", "Composure", "Vision", "ShortPassing", "AttackPositioning", "Volleys", "LongShots", "FKAccuracy", "Stamina", "Strength", "Jumping", "Penalties"],
  tertiaryAttributes: ["ShotPower", "Crossing", "LongPassing", "Interceptions", "HeadingAccuracy", "DefAwareness", "StandingTackle", "SlidingTackle", "Aggression", "SkillMoves", "WeakFoot"],
};

const result = runMathEngine(blueprint, 15000);
const core = ["Acceleration", "SprintSpeed", "Finishing", "Dribbling", "BallControl", "Agility", "Curve", "Reactions"];
const secondary = ["Balance", "Composure", "Vision", "ShortPassing", "AttackPositioning", "Volleys", "LongShots", "FKAccuracy", "Stamina", "Strength", "Jumping", "Penalties"];

console.log("Core attributes:");
for (const stat of result.stats) {
  if (core.some(a => a.toLowerCase() === stat.attribute.toLowerCase())) {
    console.log(`  ${stat.attribute}: ${stat.final} (max: ${stat.max})`);
  }
}

console.log("\nSecondary attributes:");
for (const stat of result.stats) {
  if (secondary.some(a => a.toLowerCase() === stat.attribute.toLowerCase())) {
    console.log(`  ${stat.attribute}: ${stat.final} (max: ${stat.max})`);
  }
}
