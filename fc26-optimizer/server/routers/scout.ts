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
  skillMoves: z.number().int().min(1).max(5),
  weakFoot: z.number().int().min(1).max(5),
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

// 👉 UPGRADED: Forced Peak Era evaluation and Signature Weapon rule
const CHIEF_SCOUT_PROMPT = `You are an elite professional football scout. Produce an objective, evidence-based scouting report based strictly on the player's ABSOLUTE PEAK/PRIME era. If a player changed positions during their career (e.g., starting as a defender but peaking as a winger), you MUST evaluate them based solely on their most famous, highest-performing attacking role. Describe observable football qualities (First Touch, Scanning, Decision Making, etc). Highlight stylistic limitations. Explicitly identify the player's 'Signature Weapon'—their most iconic, trademark footballing action or trait (e.g., cutting inside for long shots, bending free kicks). Do NOT mention EA FC, FIFA, or specific attribute values. Describe behaviours so an AI can infer accurate attributes.`;

export const scoutRouter = router({
  generateReport: publicProcedure
    .input(z.object({ playerIdentity: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      
      // STAGE 1: Chief Scout Prose
      const stage1Response = await invokeLLM({
        messages: [
          { role: "system", content: CHIEF_SCOUT_PROMPT },
          { role: "user", content: `Player Identity: ${input.playerIdentity}` }
        ]
      } as any);

      const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
      if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

      // STAGE 2: Data Analyst Translation
      const context = getScoutingContext();
      
      // 👉 UPGRADED: Added CRITICAL ARCHETYPE RULE to stop defender archetypes on attackers
      const stage2SystemPrompt = `You are the ultimate FC 26 Data Analyst. Translate the scout report into strict FC 26 JSON using ONLY this context:
${context}

Your output MUST be a single raw JSON object that strictly matches this exact structure:
{
  "scoutSummary": "Write a brief 2-3 sentence summary of the player's scouting report here.",
  "archetype": "The matched archetype name",
  "position": "The matched position",
  "heightRange": "e.g. 175cm - 185cm",
  "weightRange": "e.g. 70kg - 80kg",
  "skillMoves": 3,
  "weakFoot": 4,
  "playstylePlus": ["Style1", "Style2", "Style3", "Style4"],
  "playstyles": [
    {
      "name": "StyleName",
      "requirements": [
        {"attr": "AttributeName", "val": 80}
      ]
    }
  ],
  "specialisation": "",
  "specialisationPlaystylePlus": "",
  "specialisationMinAttrs": [
    {"attr": "AttributeName", "val": 85}
  ],
  "coreAttributes": ["Attr1", "Attr2"],
  "secondaryAttributes": ["Attr3", "Attr4"],
  "tertiaryAttributes": ["Attr5", "Attr6"],
  "reasoning": "Brief explanation of choices"
}

RULES: 4 Playstyle+, 9 Standard Playstyles, define Attribute Pillars. Rate 'skillMoves' and 'weakFoot' as integers between 1 and 5 based strictly on historical realism. Do NOT include 'SkillMoves' or 'WeakFoot' inside the attribute arrays. 
CRITICAL ARCHETYPE RULE: The chosen archetype MUST match the player's peak position. Do not assign defender archetypes to legendary attackers. 
CRITICAL EA RULE: Standard PlayStyles CANNOT duplicate the Signature PlayStyles of the chosen Archetype. Check the context for the Archetype's signatures and ensure none are in your standard 'playstyles' array. 
SIGNATURE WEAPON RULE: Identify the player's 'Signature Weapon' from the scout report (e.g., LongShots, FKAccuracy, HeadingAccuracy) and FORCE that specific attribute into the 'coreAttributes' array so it receives maximum points. Output ONLY raw JSON. You MUST include scoutSummary, heightRange, weightRange, skillMoves, and weakFoot. If no specialisation applies, leave specialisationMinAttrs as an empty array [].`;

      const stage2Response = await invokeLLM({
        messages: [
          { role: "system", content: stage2SystemPrompt }, 
          { role: "user", content: `Translate this report into JSON:\n\n${hiddenScoutReport}` }
        ]
      } as any);

      const rawContent = stage2Response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Stage 2 LLM returned empty response");

      // Defensive JSON Cleaning
      let cleanedJson = typeof rawContent === "string" ? rawContent.trim() : JSON.stringify(rawContent);
      if (cleanedJson.startsWith("```")) {
        cleanedJson = cleanedJson.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(cleanedJson);
      
      console.log("🤖 RAW GEMINI JSON OUTPUT:");
      console.log(JSON.stringify(parsed, null, 2));

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
        skillMoves: input.blueprint.skillMoves,
        weakFoot: input.blueprint.weakFoot,
      };

      const result = runMathEngine(engineBlueprint, input.apBudget, customSlots);

      const resolvedSignatures = resolveSignaturePlaystyles(
        input.blueprint.archetype,
        signatureUpgrades,
        input.blueprint.specialisationPlaystylePlus
      );

      const standardPlaystyles = input.blueprint.playstyles
        .map(ps => ps.name)
        .filter(ps => {
          return !resolvedSignatures.some(sig => sig.replace('+', '').toLowerCase() === ps.toLowerCase());
        })
        .slice(0, customSlots); 
      
      return {
        ...result,
        scoutSummary: input.blueprint.scoutSummary,
        suggestedSkillMoves: input.blueprint.skillMoves,
        suggestedWeakFoot: input.blueprint.weakFoot,
        playstyles: {
          signatures: resolvedSignatures,
          standard: standardPlaystyles,
          specialisation: input.blueprint.specialisation || null
        }
      };
    }),
});
