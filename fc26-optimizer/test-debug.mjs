import { runMathEngine } from "./server/mathEngine.ts";

const blueprint = {
  archetype: "Magician",
  position: "CB",
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

console.log("Position:", blueprint.position);
console.log("Is CB?", blueprint.position === "CB");

const result = runMathEngine(blueprint, 5000);
const st = result.stats.find(s => s.attribute.toLowerCase() === "standingtackle");
console.log("StandingTackle:", st);
