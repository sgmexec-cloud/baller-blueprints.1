import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getScoutingContext } from "../csvLoader";
import { runMathEngine, ScoutingBlueprint } from "../mathEngine";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, guestUsage } from "../../drizzle/schema";
import fs from "fs/promises";
import path from "path";
import { calculateEligiblePlayStyles } from "../playstyles";

const PlaystyleReqSchema = z.object({
  attr: z.string(),
  val: z.number(),
});

const PlaystyleSchema = z.object({
  name: z.string(),
  requirements: z.array(PlaystyleReqSchema),
});

const BlueprintSchema = z.object({
  archetype: z.string(),
  position: z.string().optional(),
  heightRange: z.string(),
  weightRange: z.string(),
  playstylePlus: z.array(z.string()),
  playstyles: z.array(PlaystyleSchema),
  specialisation: z.string().optional(),
  specialisationPlaystylePlus: z.string().optional(),
  specialisationMinAttrs: z.array(PlaystyleReqSchema).optional(),
  coreAttributes: z.array(z.string()),
  secondaryAttributes: z.array(z.string()),
  tertiaryAttributes: z.array(z.string()),
  reasoning: z.string().optional(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

export const scoutRouter = router({
  generateReport: publicProcedure
    .input(z.object({ playerIdentity: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      const ctxUser = (ctx as any).user;
      const fallbackUserId = (ctx as any).userId;
      let dbUser = null;
      if (ctxUser && ctxUser.id) {
        const freshUserResult = await db.select().from(users).where(eq(users.id, ctxUser.id)).limit(1);
        if (freshUserResult.length > 0) dbUser = freshUserResult[0];
      } else if (fallbackUserId) {
        const freshUserResult = await db.select().from(users).where(eq(users.openId, String(fallbackUserId))).limit(1);
        if (freshUserResult.length > 0) dbUser = freshUserResult[0];
      }
      const headers = (ctx as any).req?.headers || (ctx as any).headers || {};
      const forwarded = headers['x-forwarded-for'] || headers['x-real-ip'];
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ((ctx as any).req?.socket?.remoteAddress || "unknown-guest");
      if (dbUser) {
        if (dbUser.tier !== "premium") {
          const now = new Date();
          const lastBuild = dbUser.lastBuildDate ? new Date(dbUser.lastBuildDate) : new Date(0);
          const isNewMonth = lastBuild.getMonth() !== now.getMonth() || lastBuild.getFullYear() !== now.getFullYear();
          const currentBuilds = isNewMonth ? 0 : (dbUser.monthlyBuilds || 0);
          if (currentBuilds >= 5) throw new TRPCError({ code: "FORBIDDEN", message: "LIMIT_REACHED_FREE" });
        }
      } else {
        const existingGuest = await db.select().from(guestUsage).where(eq(guestUsage.ip, ip)).limit(1);
        if (existingGuest.length > 0 && existingGuest[0].builds >= 1) throw new TRPCError({ code: "FORBIDDEN", message: "LIMIT_REACHED_GUEST" });
      }
      const context = getScoutingContext();
      const response = await invokeLLM({
        messages: [{ role: "system", content: "You are an elite FC 26 scout..." }, { role: "user", content: `Player Identity: ${input.playerIdentity}` }],
        response_format: { type: "json_schema", json_schema: { name: "scouting_blueprint", strict: true, schema: { type: "object", properties: { archetype: { type: "string" }, heightRange: { type: "string" }, weightRange: { type: "string" }, position: { type: "string" }, playstylePlus: { type: "array", items: { type: "string" } }, playstyles: { type: "array", items: { type: "object", properties: { name: { type: "string" }, requirements: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } } }, required: ["name", "requirements"], additionalProperties: false } }, specialisation: { type: "string" }, specialisationPlaystylePlus: { type: "string" }, specialisationMinAttrs: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } }, coreAttributes: { type: "array", items: { type: "string" } }, secondaryAttributes: { type: "array", items: { type: "string" } }, tertiaryAttributes: { type: "array", items: { type: "string" } }, reasoning: { type: "string" } }, required: ["archetype", "position", "heightRange", "weightRange", "playstylePlus", "playstyles", "coreAttributes", "secondaryAttributes", "tertiaryAttributes"], additionalProperties: false } } }
      } as any);
      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("LLM returned empty response");
      const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));
      const blueprint = BlueprintSchema.parse(parsed);
      if (dbUser) {
         if (dbUser.tier !== "premium") {
            const now = new Date();
            const lastBuild = dbUser.lastBuildDate ? new Date(dbUser.lastBuildDate) : new Date(0);
            const isNewMonth = lastBuild.getMonth() !== now.getMonth() || lastBuild.getFullYear() !== now.getFullYear();
            const newCount = isNewMonth ? 1 : ((dbUser.monthlyBuilds || 0) + 1);
            await db.update(users).set({ monthlyBuilds: newCount, lastBuildDate: now }).where(eq(users.id, dbUser.id));
         }
      } else {
         const existingGuest = await db.select().from(guestUsage).where(eq(guestUsage.ip, ip)).limit(1);
         if (existingGuest.length > 0) {
            await db.update(guestUsage).set({ builds: existingGuest[0].builds + 1, updatedAt: new Date() }).where(eq(guestUsage.ip, ip));
         } else {
            await db.insert(guestUsage).values({ ip, builds: 1 });
         }
      }
      return blueprint;
    }),

  calculateStats: publicProcedure
    .input(z.object({ blueprint: BlueprintSchema, apBudget: z.number().int().min(1).max(999999) }))
    .mutation(async ({ input }) => {
      const engineBlueprint: ScoutingBlueprint = {
        archetype: input.blueprint.archetype,
        position: input.blueprint.position,
        playstylePlus: input.blueprint.playstylePlus,
        playstyles: input.blueprint.playstyles,
        specialisation: input.blueprint.specialisation,
        specialisationPlaystylePlus: input.blueprint.specialisationPlaystylePlus,
        specialisationMinAttrs: input.blueprint.specialisationMinAttrs,
        coreAttributes: input.blueprint.coreAttributes,
        secondaryAttributes: input.blueprint.secondaryAttributes,
        tertiaryAttributes: input.blueprint.tertiaryAttributes,
      };
      const result = runMathEngine(engineBlueprint, input.apBudget);
      let customSlots = 0;
      let signatureUpgrades = 0;
      try {
        const progPath = path.join(process.cwd(), "server", "data", "progression.csv");
        const progContent = await fs.readFile(progPath, "utf-8");
        const lines = progContent.trim().split("\n");
        for (let i = 1; i < lines.length; i++) {
          const p = lines[i].split(",");
          if (input.apBudget >= Number(p[1])) { customSlots = Number(p[3]); signatureUpgrades = Number(p[2]); }
        }
      } catch (e) { console.error("Progression error:", e); }
      const eligiblePlaystyles = await calculateEligiblePlayStyles(result.finalStats, customSlots, signatureUpgrades, input.blueprint.archetype);
      return {
        ...result,
        playstyles: {
          signatures: eligiblePlaystyles?.signatures || [],
          standard: eligiblePlaystyles?.standard || [],
          specialisation: eligiblePlaystyles?.specialisation || null
        }
      };
    }),
});
