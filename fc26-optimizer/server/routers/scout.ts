import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getScoutingContext } from "../csvLoader";
import { runMathEngine, ScoutingBlueprint } from "../mathEngine";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, guestUsage } from "../../drizzle/schema";
// 👉 NEW IMPORTS
import fs from "fs/promises";
import path from "path";
import { calculateEligiblePlayStyles } from "../playstyles";

// ── Zod schemas ───────────────────────────────────────────────────────────────

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

// ── Scout router ──────────────────────────────────────────────────────────────

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
      // (System prompt omitted for brevity - keep your existing one here!)
      // ... 

      const response = await invokeLLM({ /* ... your existing LLM call ... */ } as any);
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
    .input(
      z.object({
        blueprint: BlueprintSchema,
        apBudget: z.number().int().min(1).max(999999),
      })
    )
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

      const progPath = path.join(process.cwd(), "server", "data", "progression.csv");
      const progContent = await fs.readFile(progPath, "utf-8");
      const progLines = progContent.trim().split("\n");

      let customSlots = 0;
      let signatureUpgrades = 0;

      for (let i = 1; i < progLines.length; i++) {
        const parts = progLines[i].split(",");
        const ap = Number(parts[1]);
        const sig = Number(parts[2]);
        const custom = Number(parts[3]);
        
        if (input.apBudget >= ap) {
          customSlots = custom;
          signatureUpgrades = sig;
        }
      }

      const eligiblePlaystyles = await calculateEligiblePlayStyles(
        result.finalStats,
        customSlots,
        signatureUpgrades,
        input.blueprint.archetype
      );

      return {
        ...result,
        playstyles: eligiblePlaystyles,
      };
    }),
});
