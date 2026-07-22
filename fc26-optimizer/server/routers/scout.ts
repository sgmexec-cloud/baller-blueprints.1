import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getScoutingContext, ALL_ARCHETYPES } from "../csvLoader";
import { runMathEngine, ScoutingBlueprint, resolveSignaturePlaystyles } from "../mathEngine";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import fs from "fs/promises";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { users } from "../drizzle/schema"; // Ensure this path matches your schema location

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

const CHIEF_SCOUT_PROMPT = `You are an elite professional football scout. Produce an objective, evidence-based scouting report based strictly on the player's ABSOLUTE PEAK/PRIME era. 
If a player changed positions during their career, you MUST evaluate them based solely on their most famous, highest-performing role. 
CRITICAL: You must explicitly define their 'Tactical Role' (e.g. Inverted Winger, Ball-Winning Midfielder, Target Man) to anchor the evaluation. 
Describe observable football qualities (First Touch, Scanning, Decision Making, etc). Highlight stylistic limitations and weaknesses—what are they notoriously bad at? 
Explicitly identify the player's 'Signature Weapon'—their most iconic, trademark footballing action or trait. Do NOT mention EA FC, FIFA, or specific attribute values. Describe behaviours so an AI can infer accurate attributes.`;

export const scoutRouter = router({
  // 👉 Added endpoint to supply unique archetypes directly to the frontend dropdown
  getArchetypes: publicProcedure.query(async () => {
    try {
      const uniqueArchetypes = Array.from(new Set(ALL_ARCHETYPES.map(row => row.Archetype.trim())));
      return uniqueArchetypes.sort();
    } catch (e) {
      console.error("Failed to load archetypes:", e);
      return [];
    }
  }),

  generateReport: publicProcedure
    .input(z.object({ 
      playerIdentity: z.string().min(1).max(500),
      forcedArchetype: z.string().optional() // 👉 Added to support forced archetype selection
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      
      // --- GATEKEEPER / RATE LIMITING LOGIC START ---
      const userId = ctx.user?.id;
      let buildLimit = 2; // Guest default
      let currentUser = null;

      if (userId) {
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        currentUser = dbUser;

        if (currentUser) {
          if (currentUser.tier === "vip") buildLimit = Infinity;
          else if (currentUser.tier === "premium") buildLimit = 100;
          else buildLimit = 5; // Free Member
        }
      }

      const currentBuilds = currentUser?.monthlyBuilds || 0;

      if (currentBuilds >= buildLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "LIMIT_REACHED",
        });
      }
      // --- GATEKEEPER / RATE LIMITING LOGIC END ---

      const stage1Response = await invokeLLM({
        messages: [
          { role: "system", content: CHIEF_SCOUT_PROMPT },
          { role: "user", content: `Player Identity: ${input.playerIdentity}` }
        ]
      } as any);

      const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
      if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

      const context = getScoutingContext();
      
      // 👉 Dynamic constraint rule for the forced archetype
      const archetypeRule = input.forcedArchetype 
        ? `CRITICAL OVERRIDE: You MUST use the exact archetype "${input.forcedArchetype}". Do NOT choose or invent a different archetype.`
        : `Choose the most accurate archetype from the context.`;

      const stage2SystemPrompt = `You are the ultimate FC 26 Data Analyst. Translate the scout report into strict FC 26 JSON using ONLY this context:
${context}

Your output MUST be a single raw JSON object that strictly matches this exact structure:
{
  "scoutSummary": "...",
  "archetype": "...",
  "position": "...",
  "heightRange": "...",
  "weightRange": "...",
  "skillMoves": 3,
  "weakFoot": 4,
  "playstylePlus": ["Style1", "Style2", "Style3", "Style4"],
  "playstyles": [{"name": "StyleName", "requirements": [{"attr": "AttributeName", "val": 80}]}],
  "specialisation": "",
  "specialisationPlaystylePlus": "",
  "specialisationMinAttrs": [{"attr": "AttributeName", "val": 85}],
  "coreAttributes": ["Attr1"],
  "secondaryAttributes": ["Attr2"],
  "tertiaryAttributes": ["Attr3"],
  "reasoning": "..."
}

RULES:
- ARCHETYPE: ${archetypeRule}
- PLAYSTYLES & PRIORITY: You MUST generate EXACTLY 4 items in 'playstylePlus' and EXACTLY 16 items in 'playstyles'. You MUST order the 16 'playstyles' strictly by relevance and priority. The MOST iconic and essential playstyles for this specific player MUST be placed at the very beginning of the array. The engine slices this list based on level progression, so the first items are the most critical. Standard playstyles CANNOT duplicate the Archetype's Signature Playstyles.
- 'specialisationMinAttrs' MUST be an array of objects. Example: [{"attr": "Finishing", "val": 85}]. NEVER output strings inside this array.
- ATTRIBUTES: Select ONLY the attributes that genuinely define this player. 4-6 core, 5-7 secondary, and 4-6 tertiary attributes. DO NOT include attributes that contradict the player's real-life weaknesses (e.g., omit tackling/interceptions for pure attackers). Unlisted stats will remain at their base values.
- Output ONLY raw JSON.`;

      const stage2Response = await invokeLLM({
        messages: [
          { role: "system", content: stage2SystemPrompt }, 
          { role: "user", content: `Translate this report into JSON:\n\n${hiddenScoutReport}` }
        ]
      } as any);

      const rawContent = stage2Response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Stage 2 LLM returned empty response");

      let cleanedJson = typeof rawContent === "string" ? rawContent.trim() : JSON.stringify(rawContent);
      cleanedJson = cleanedJson.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

      const parsed = JSON.parse(cleanedJson);

      if (parsed.specialisationMinAttrs && Array.isArray(parsed.specialisationMinAttrs)) {
        parsed.specialisationMinAttrs = parsed.specialisationMinAttrs.map((item: any) => {
          if (typeof item === 'string') {
             const parts = item.split(/[:\s]+/);
             return { attr: parts[0], val: parseInt(parts[1] || "0", 10) };
          }
          return item;
        });
      } else {
        parsed.specialisationMinAttrs = [];
      }

      // --- INCREMENT BUILD COUNT START ---
      if (currentUser && currentUser.tier !== "vip") {
        await db
          .update(users)
          .set({
            monthlyBuilds: sql`${users.monthlyBuilds} + 1`,
          })
          .where(eq(users.id, currentUser.id));
      }
      // --- INCREMENT BUILD COUNT END ---

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
