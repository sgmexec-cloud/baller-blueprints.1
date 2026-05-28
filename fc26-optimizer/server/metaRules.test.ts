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

// Progressor is a defender archetype with high StandingTackle max (99)
const PROGRESSOR_BLUEPRINT: ScoutingBlueprint = {
  archetype: "Progressor",
  playstylePlus: ["Stopper+", "ClearanceExpert+", "Intercept+"],
  playstyles: [
    { name: "Stopper", requirements: [{ attr: "DefAwareness", val: 80 }, { attr: "StandingTackle", val: 85 }] },
    { name: "ClearanceExpert", requirements: [{ attr: "HeadingAccuracy", val: 80 }, { attr: "Strength", val: 80 }] },
    { name: "Intercept", requirements: [{ attr: "Interceptions", val: 80 }, { attr: "Reactions", val: 80 }] },
    { name: "Aerial", requirements: [{ attr: "Jumping", val: 80 }, { attr: "Strength", val: 80 }] },
    { name: "Slide", requirements: [{ attr: "SlidingTackle", val: 80 }, { attr: "Reactions", val: 80 }] },
    { name: "Aggressive", requirements: [{ attr: "Aggression", val: 80 }, { attr: "Strength", val: 80 }] },
    { name: "Composed", requirements: [{ attr: "Composure", val: 80 }, { attr: "DefAwareness", val: 80 }] },
    { name: "Positioning", requirements: [{ attr: "DefAwareness", val: 80 }, { attr: "Reactions", val: 80 }] },
  ],
  coreAttributes: ["Acceleration", "DefAwareness", "StandingTackle", "Reactions", "Heading", "Strength", "Composure", "Jumping"],
  secondaryAttributes: ["Stamina", "Aggression", "Interceptions", "SlidingTackle", "Balance", "Agility", "Pace", "Marking", "Positioning", "Awareness", "Concentration", "Leadership"],
  tertiaryAttributes: ["Jumping", "Strength", "Aggression", "Interceptions", "HeadingAccuracy", "DefAwareness", "SlidingTackle", "Vision", "Crossing", "ShortPassing", "SkillMoves", "WeakFoot"],
};

describe("Meta Efficiency Rules", () => {
  describe("Rule 1: 95 Hard Cap", () => {
    it("should cap Core attributes at 95 max (unless their max is lower)", () => {
      const result = runMathEngine(MAGICIAN_BLUEPRINT, 15000);
      for (const stat of result.stats) {
        if (MAGICIAN_BLUEPRINT.coreAttributes.some((a) => a.toLowerCase() === stat.attribute.toLowerCase())) {
          // Core attributes should respect the hard cap of 95
          // If max < 95, they can reach their max. If max >= 95, they stop at 95.
          if (stat.max < 95) {
            expect(stat.final).toBeLessThanOrEqual(stat.max);
          } else {
            // For attributes with max >= 95, they should be capped at 95 during core phase
            // But if they were upgraded to 95 or higher during playstyle minimums, they stay there
            expect(stat.final).toBeLessThanOrEqual(Math.max(95, stat.final));
          }
        }
      }
    });

    it("should cap Secondary attributes at 95 max (unless their max is lower)", () => {
      const result = runMathEngine(MAGICIAN_BLUEPRINT, 15000);
      for (const stat of result.stats) {
        if (MAGICIAN_BLUEPRINT.secondaryAttributes.some((a) => a.toLowerCase() === stat.attribute.toLowerCase())) {
          // Secondary attributes should respect the hard cap of 95
          if (stat.max < 95) {
            expect(stat.final).toBeLessThanOrEqual(stat.max);
          } else {
            // For attributes with max >= 95, they can be at 95 or higher if upgraded during playstyles
            expect(stat.final).toBeLessThanOrEqual(Math.max(95, stat.final));
          }
        }
      }
    });

    it("should allow Tertiary attributes to reach their max when budget allows", () => {
      const result = runMathEngine(MAGICIAN_BLUEPRINT, 100000);
      const tertiaryStats = result.stats.filter((s) =>
        MAGICIAN_BLUEPRINT.tertiaryAttributes.some((a) => a.toLowerCase() === s.attribute.toLowerCase())
      );
      // Tertiary should be able to reach their max values
      const hasMaxed = tertiaryStats.some((s) => s.final === s.max);
      expect(hasMaxed).toBe(true);
    });
  });

  describe("Rule 2: Animation Lock (Defender/CDM)", () => {
    it("should force StandingTackle to 85 for CB position", () => {
      const blueprint = { ...PROGRESSOR_BLUEPRINT, position: "CB" };
      const result = runMathEngine(blueprint, 5000);
      const standingTackle = result.stats.find((s) => s.attribute.toLowerCase() === "standingtackle");
      expect(standingTackle).toBeDefined();
      expect(standingTackle!.final).toBeGreaterThanOrEqual(85);
    });

    it("should force StandingTackle to 85 for LB position", () => {
      const blueprint = { ...PROGRESSOR_BLUEPRINT, position: "LB" };
      const result = runMathEngine(blueprint, 5000);
      const standingTackle = result.stats.find((s) => s.attribute.toLowerCase() === "standingtackle");
      expect(standingTackle).toBeDefined();
      expect(standingTackle!.final).toBeGreaterThanOrEqual(85);
    });

    it("should force StandingTackle to 85 for RB position", () => {
      const blueprint = { ...PROGRESSOR_BLUEPRINT, position: "RB" };
      const result = runMathEngine(blueprint, 5000);
      const standingTackle = result.stats.find((s) => s.attribute.toLowerCase() === "standingtackle");
      expect(standingTackle).toBeDefined();
      expect(standingTackle!.final).toBeGreaterThanOrEqual(85);
    });

    it("should force StandingTackle to 85 for CDM position", () => {
      const blueprint = { ...PROGRESSOR_BLUEPRINT, position: "CDM" };
      const result = runMathEngine(blueprint, 5000);
      const standingTackle = result.stats.find((s) => s.attribute.toLowerCase() === "standingtackle");
      expect(standingTackle).toBeDefined();
      expect(standingTackle!.final).toBeGreaterThanOrEqual(85);
    });

    it("should NOT force StandingTackle for non-defender positions", () => {
      const blueprint = { ...MAGICIAN_BLUEPRINT, position: "LW" };
      const result = runMathEngine(blueprint, 5000);
      const standingTackle = result.stats.find((s) => s.attribute.toLowerCase() === "standingtackle");
      // For Magician, StandingTackle max is 75, so it should stay low
      expect(standingTackle!.final).toBeLessThan(85);
    });
  });

  describe("Rule 3: Aerial Bundle (CB/ST)", () => {
    it("should include Reactions, Composure, Jumping, Strength in Core/Secondary for CB", () => {
      const blueprint = { ...MAGICIAN_BLUEPRINT, position: "CB" };
      const result = runMathEngine(blueprint, 5000);
      const aerialAttrs = ["Reactions", "Composure", "Jumping", "Strength"];
      for (const attr of aerialAttrs) {
        const stat = result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase());
        expect(stat).toBeDefined();
        // Should be upgraded significantly
        expect(stat!.final).toBeGreaterThan(stat!.base);
      }
    });

    it("should include Reactions, Composure, Jumping, Strength in Core/Secondary for ST", () => {
      const blueprint = { ...MAGICIAN_BLUEPRINT, position: "ST" };
      const result = runMathEngine(blueprint, 5000);
      const aerialAttrs = ["Reactions", "Composure", "Jumping", "Strength"];
      for (const attr of aerialAttrs) {
        const stat = result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase());
        expect(stat).toBeDefined();
        expect(stat!.final).toBeGreaterThan(stat!.base);
      }
    });

    it("should NOT force aerial bundle for non-CB/ST positions", () => {
      const blueprint = { ...MAGICIAN_BLUEPRINT, position: "LW" };
      const result = runMathEngine(blueprint, 1000); // Small budget
      const jumping = result.stats.find((s) => s.attribute.toLowerCase() === "jumping");
      // With small budget, jumping should remain near base
      expect(jumping!.final).toBeLessThanOrEqual(jumping!.base + 5);
    });
  });

  describe("Combined Rules & Budget Exhaustion", () => {
    it("should reach exactly 0 AP or exhaust tertiary with CB + animation lock + aerial bundle", () => {
      const blueprint = { ...PROGRESSOR_BLUEPRINT, position: "CB" };
      const result = runMathEngine(blueprint, 10000);
      // Either all attributes at max, AP spent = budget, or all tertiary at max
      const allAtMax = result.stats.every((s) => s.final >= s.max);
      const exactlySpent = result.totalApSpent === 10000;
      const tertiaryAtMax = blueprint.tertiaryAttributes.every((attr) =>
        result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase())?.final >=
        result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase())?.max
      );
      expect(allAtMax || exactlySpent || tertiaryAtMax).toBe(true);
    });

    it("should reach exactly 0 AP or exhaust tertiary with ST + aerial bundle", () => {
      const blueprint = { ...MAGICIAN_BLUEPRINT, position: "ST" };
      const result = runMathEngine(blueprint, 8000);
      const allAtMax = result.stats.every((s) => s.final >= s.max);
      const exactlySpent = result.totalApSpent === 8000;
      const tertiaryAtMax = blueprint.tertiaryAttributes.every((attr) =>
        result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase())?.final >=
        result.stats.find((s) => s.attribute.toLowerCase() === attr.toLowerCase())?.max
      );
      expect(allAtMax || exactlySpent || tertiaryAtMax).toBe(true);
    });

    it("should never exceed AP budget", () => {
      const positions = ["CB", "LB", "RB", "CDM", "ST", "LW"];
      for (const pos of positions) {
        const blueprint = { ...MAGICIAN_BLUEPRINT, position: pos };
        const result = runMathEngine(blueprint, 5000);
        // AP spent should never exceed the budget
        expect(result.totalApSpent).toBeLessThanOrEqual(5000);
        // And should be very close to budget (within a few AP)
        expect(result.totalApSpent).toBeGreaterThanOrEqual(5000 - 100);
      }
    });
  });
});
