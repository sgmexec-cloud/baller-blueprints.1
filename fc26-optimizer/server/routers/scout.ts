import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getScoutingContext } from "../csvLoader";
import { runMathEngine, ScoutingBlueprint, resolveSignaturePlaystyles } from "../mathEngine";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, guestUsage } from "../../drizzle/schema";
import fs from "fs/promises";
import path from "path";

const PlaystyleReqSchema = z.object({
  attr: z.string(),
  val: z.number(),
});

const PlaystyleSchema = z.object({
  name: z.string(),
  requirements: z.array(PlaystyleReqSchema),
});

const BlueprintSchema = z.object({
  scoutSummary: z.string(),
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

const CHIEF_SCOUT_PROMPT = `You are an elite professional football scout. Produce an objective, evidence-based scouting report. Describe observable football qualities (First Touch, Scanning, Decision Making, etc). Do NOT mention EA FC, FIFA, or specific attribute values. Describe behaviours so an AI can infer attributes and PlayStyles.`;

export const scoutRouter = router({
  generateReport: publicProcedure
    .input(z.object({ playerIdentity: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      
      // ... (Auth/Guest Limit logic remains unchanged) ...

      // STAGE 1: Use the heavy model for high-quality scouting prose
      const stage1Response = await invokeLLM({
        messages: [
          { role: "system", content: CHIEF_SCOUT_PROMPT },
          { role: "user", content: `Player Identity: ${input.playerIdentity}` }
        ],
        modelOverride: "llama-3.3-70b-versatile"
      } as any);

      const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
      if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

      // STAGE 2: Use the fast model for strict JSON translation
      const context = getScoutingContext();
      const stage2SystemPrompt = `You are the ultimate FC 26 Data Analyst. Translate the scout report into strict FC 26 JSON using ONLY this context:\n${context}\n\nRULES: 4 Playstyle+, 9 Standard Playstyles, define Attribute Pillars.`;

      const stage2Response = await invokeLLM({
        messages: [
          { role: "system", content: stage2SystemPrompt }, 
          { role: "user", content: `Translate this report into JSON:\n\n${hiddenScoutReport}` }
        ],
        modelOverride: "llama-3.1-8b-instant"
      } as any);

      const rawContent = stage2Response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Stage 2 LLM returned empty response");
      const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));
      return BlueprintSchema.parse(parsed);
    }),

  calculateStats: publicProcedure
    .input(z.object({ blueprint: BlueprintSchema, apBudget: z.number().int().min(1).max(999999) }))
    .mutation(async ({ input }) => {
      let customSlots = 0;
      let signatureUpgrades = 0;

      try {
        const progPath = path.join(process.cwd(), "server", "data", "progression.csv");
        const progContent = await fs.readFile(progPath, "utf-8");
        const lines = progContent.trim().split("\n");
        for (let i = 1; i < lines.length; i++) {
          const p = lines[i].split(",");
          if (input.apBudget >= Number(p[1])) {
            signatureUpgrades = Number(p[2]);
            customSlots = Number(p[3]);      
          }
        }
      } catch (e) { console.error("Progression error:", e); }

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

      const result = runMathEngine(engineBlueprint, input.apBudget, customSlots);

      const resolvedSignatures = resolveSignaturePlaystyles(
        input.blueprint.archetype,
        signatureUpgrades,
        input.blueprint.specialisationPlaystylePlus
      );

      const standardPlaystyles = input.blueprint.playstyles
        .slice(0, customSlots)
        .map(ps => ps.name);
      
      return {
        ...result,
        scoutSummary: input.blueprint.scoutSummary,
        playstyles: {
          signatures: resolvedSignatures,
          standard: standardPlaystyles,
          specialisation: input.blueprint.specialisation || null
        }
      };
    }),
});
