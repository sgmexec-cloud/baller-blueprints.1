import { describe, it, expect } from "vitest";
import { runMathEngine } from "./mathEngine";
import type { ScoutingBlueprint } from "./mathEngine";

const MAGICIAN_BLUEPRINT: ScoutingBlueprint = {
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

describe("Math Engine", () => {
  it("should return results with correct structure", () => {
    const result = runMathEngine(MAGICIAN_BLUEPRINT, 1000);
    expect(result).toHaveProperty("stats");
    expect(result).toHaveProperty("totalApSpent");
    expect(result).toHaveProperty("byCategory");
    expect(result.stats.length).toBeGreaterThan(0);
  });

  it("should never exceed the AP budget", () => {
    const budget = 5000;
    const result = runMathEngine(MAGICIAN_BLUEPRINT, budget);
    expect(result.totalApSpent).toBeLessThanOrEqual(budget);
  });

  it("should spend exactly the budget when possible", () => {
    const budget = 10000;
    const result = runMathEngine(MAGICIAN_BLUEPRINT, budget);
    // Either all spent, all attributes at max, or all tertiary at max
    const allAtMax = result.stats.every((s) => s.final >= s.max);
    const exactlySpent = result.totalApSpent === budget;
    const tertiaryAtMax = MAGICIAN_BLUEPRINT.tertiaryAttributes.every((attr) =>
      result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase())?.final >=
      result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase())?.max
    );
    expect(allAtMax || exactlySpent || tertiaryAtMax).toBe(true);
  });

  it("should never exceed max values for any attribute", () => {
    const result = runMathEngine(MAGICIAN_BLUEPRINT, 50000);
    for (const stat of result.stats) {
      expect(stat.final).toBeLessThanOrEqual(stat.max);
    }
  });

  it("should set base values correctly", () => {
    const result = runMathEngine(MAGICIAN_BLUEPRINT, 0);
    const accel = result.stats.find((s) => s.attribute === "Acceleration");
    expect(accel).toBeDefined();
    expect(accel!.base).toBe(75);
    expect(accel!.final).toBe(75);
    expect(accel!.apSpent).toBe(0);
  });

  it("should meet playstyle minimum requirements when budget allows", () => {
    const result = runMathEngine(MAGICIAN_BLUEPRINT, 20000);
    const curve = result.stats.find((s) => s.attribute === "Curve");
    expect(curve).toBeDefined();
    // Curve needs ≥ 80 for FinesseShot
    expect(curve!.final).toBeGreaterThanOrEqual(80);
  });

  it("should group stats by category correctly", () => {
    const result = runMathEngine(MAGICIAN_BLUEPRINT, 5000);
    expect(result.byCategory["Pace"]).toBeDefined();
    expect(result.byCategory["Shooting"]).toBeDefined();
    expect(result.byCategory["Dribbling"]).toBeDefined();
    const paceAttrs = result.byCategory["Pace"].map((s) => s.attribute);
    expect(paceAttrs).toContain("Acceleration");
    expect(paceAttrs).toContain("SprintSpeed");
  });

  it("should handle zero budget gracefully", () => {
    const result = runMathEngine(MAGICIAN_BLUEPRINT, 0);
    expect(result.totalApSpent).toBe(0);
    for (const stat of result.stats) {
      expect(stat.apSpent).toBe(0);
      expect(stat.final).toBe(stat.base);
    }
  });

  it("should handle unknown archetype gracefully", () => {
    const badBlueprint = { ...MAGICIAN_BLUEPRINT, archetype: "NonExistent" };
    expect(() => runMathEngine(badBlueprint, 1000)).toThrow();
  });
});
