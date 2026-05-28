import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// Minimal mock context for public procedures
function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const VALID_BLUEPRINT = {
  archetype: "Magician",
  heightRange: "175-182 cm",
  weightRange: "68-75 kg",
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

describe("scout.calculateStats", () => {
  it("should return stats with correct structure", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.scout.calculateStats({
      blueprint: VALID_BLUEPRINT,
      apBudget: 5000,
    });
    expect(result).toHaveProperty("stats");
    expect(result).toHaveProperty("totalApSpent");
    expect(result).toHaveProperty("byCategory");
    expect(result.stats.length).toBeGreaterThan(0);
  });

  it("should never exceed the AP budget", async () => {
    const caller = appRouter.createCaller(createCtx());
    const budget = 3000;
    const result = await caller.scout.calculateStats({
      blueprint: VALID_BLUEPRINT,
      apBudget: budget,
    });
    expect(result.totalApSpent).toBeLessThanOrEqual(budget);
  });

  it("should reject invalid AP budget (zero)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.scout.calculateStats({ blueprint: VALID_BLUEPRINT, apBudget: 0 })
    ).rejects.toThrow();
  });

  it("should reject invalid AP budget (negative)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.scout.calculateStats({ blueprint: VALID_BLUEPRINT, apBudget: -100 })
    ).rejects.toThrow();
  });

  it("should return byCategory with all expected groups", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.scout.calculateStats({
      blueprint: VALID_BLUEPRINT,
      apBudget: 5000,
    });
    const expectedCats = ["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physicality"];
    for (const cat of expectedCats) {
      expect(result.byCategory[cat]).toBeDefined();
      expect(result.byCategory[cat].length).toBeGreaterThan(0);
    }
  });

  it("should handle unknown archetype with an error", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.scout.calculateStats({
        blueprint: { ...VALID_BLUEPRINT, archetype: "FakeArchetype" },
        apBudget: 1000,
      })
    ).rejects.toThrow();
  });

  it("should include apSpent on each stat result", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.scout.calculateStats({
      blueprint: VALID_BLUEPRINT,
      apBudget: 5000,
    });
    for (const stat of result.stats) {
      expect(typeof stat.apSpent).toBe("number");
      expect(stat.apSpent).toBeGreaterThanOrEqual(0);
    }
  });
});
