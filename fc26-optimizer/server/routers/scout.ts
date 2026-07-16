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
      
      const context = getScoutingContext();
      const systemPrompt = `You are an elite FC 26 scout. CRITICAL: You MUST ONLY use the archetypes, playstyles, and attributes provided in this context: ${context}. IF A PLAYER DESCRIPTION DOES NOT MATCH ANY ARCHETYPE, PICK THE CLOSEST ONE. NEVER INVENT ARCHETYPES. Return ONLY valid JSON matching the required schema.`;

      const response = await invokeLLM({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Player Identity: ${input.playerIdentity}` }],
        response_format: { type: "json_schema", json_schema: { name: "scouting_blueprint", strict: true, schema: { type: "object", properties: { archetype: { type: "string" }, heightRange: { type: "string" }, weightRange: { type: "string" }, position: { type: "string" }, playstylePlus: { type: "array", items: { type: "string" } }, playstyles: { type: "array", items: { type: "object", properties: { name: { type: "string" }, requirements: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } } }, required: ["name", "requirements"], additionalProperties: false } }, specialisation: { type: "string" }, specialisationPlaystylePlus: { type: "string" }, specialisationMinAttrs: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } }, coreAttributes: { type: "array", items: { type: "string" } }, secondaryAttributes: { type: "array", items: { type: "string" } }, tertiaryAttributes: { type: "array", items: { type: "string" } }, reasoning: { type: "string" } }, required: ["archetype", "position", "heightRange", "weightRange", "playstylePlus", "playstyles", "coreAttributes", "secondaryAttributes", "tertiaryAttributes"], additionalProperties: false } } }
      } as any);

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("LLM returned empty response");
      return BlueprintSchema.parse(JSON.parse(rawContent));
    }),

  calculateStats: publicProcedure
    .input(z.object({ blueprint: BlueprintSchema, apBudget: z.number().int().min(1).max(999999) }))
    .mutation(async ({ input }) => {
      const result = runMathEngine(input.blueprint as any, input.apBudget);
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
