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
import { users } from "../../drizzle/schema"; 

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
      forcedArchetype: z.string().optional(),
      customHeight: z.string().optional(),
      customWeight: z.string().optional(),
      customSkillMoves: z.number().int().min(1).max(5).optional(),
      customWeakFoot: z.number().int().min(1).max(5).optional(),
      customPlaystyles: z.array(z.string()).optional(), 
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      
      // 👉 Catch the ID from wherever the token hid it
      const rawUserId = (ctx as any).user?.id || (ctx as any).userId || (ctx as any).user?.openId;
      const userId = rawUserId ? String(rawUserId) : null;
      
      let buildLimit = 2; // Guest fallback
      let currentUser = null;

      if (userId) {
        try {
          // 👉 The Double-Net: Check BOTH id and openId to guarantee a match
          const [dbUser] = await db
            .select({
              id: users.id,
              tier: users.tier,
              monthlyBuilds: users.monthlyBuilds
            })
            .from(users)
            .where(sql`${users.id} = ${userId} OR ${users.openId} = ${userId}`)
            .limit(1);

          currentUser = dbUser;
        } catch (dbError) {
          console.error("Database fetch bypassed:", dbError);
        }

        if (currentUser) {
          if (currentUser.tier === "owner") buildLimit = Infinity; 
          else if (currentUser.tier === "vip") buildLimit = 500;   
          else if (currentUser.tier === "premium_plus") buildLimit = 250;
          else if (currentUser.tier === "premium") buildLimit = 100;
          else buildLimit = 5; 
        } else {
          // Safety net
          currentUser = { id: userId, tier: "free", monthlyBuilds: 0 };
          buildLimit = 5;
        }
      }

      const currentBuilds = currentUser?.monthlyBuilds || 0;

      // Gatekeeper block
      if (currentUser && currentBuilds >= buildLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "LIMIT_REACHED",
        });
      }

      const isProTier = currentUser?.tier === "owner" || currentUser?.tier === "vip" || currentUser?.tier === "premium_plus" || currentUser?.tier === "premium";
      const aiModel = isProTier ? "gpt-4o" : "gpt-4o-mini"; 

      const stage1Response = await invokeLLM({
        model: aiModel,
        messages: [
          { role: "system", content: CHIEF_SCOUT_PROMPT },
          { role: "user", content: `Player Identity: ${input.playerIdentity}` }
        ]
      } as any);

      const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
      if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

      const context = getScoutingContext();
      
      const filterRules: string[] = [];
      if (input.forcedArchetype) filterRules.push(`- ARCHETYPE: CRITICAL OVERRIDE: You MUST use the exact archetype "${input.forcedArchetype}".`);
      else filterRules.push(`- ARCHETYPE: Choose the most accurate archetype from the context.`);
      
      if (input.customHeight) filterRules.push(`- HEIGHT: You MUST use the exact height "${input.customHeight}".`);
      if (input.customWeight) filterRules.push(`- WEIGHT: You MUST use the exact weight "${input.customWeight}".`);
      if (input.customSkillMoves) filterRules.push(`- SKILL MOVES: You MUST set "skillMoves" exactly to ${input.customSkillMoves}.`);
      if (input.customWeakFoot) filterRules.push(`- WEAK FOOT: You MUST set "weakFoot" exactly to ${input.customWeakFoot}.`);
      if (input.customPlaystyles && input.customPlaystyles.length > 0) {
        filterRules.push(`- PLAYSTYLES: The 'playstylePlus' array MUST include: ${input.customPlaystyles.join(", ")}.`);
      }

      const stage2SystemPrompt = `You are the ultimate FC 26 Data Analyst. Translate the scout report into strict FC 26 JSON using ONLY this context:
${context}

Your output MUST be a single raw JSON object that strictly matches this exact structure:
{
  "scoutSummary": "...",
  "archetype": "...",
  "position": "...",
  "heightRange": "178cm",
  "weightRange": "72kg",
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
${filterRules.join("\n")}
- HEIGHT & WEIGHT: (Unless overridden above) You MUST provide an EXACT, definitive height (e.g., "178cm" or "5'10\"") and an EXACT weight (e.g., "72kg" or "158 lbs"). DO NOT provide ranges.
- PLAYSTYLES & PRIORITY: You MUST generate EXACTLY 4 items in 'playstylePlus' and EXACTLY 16 items in 'playstyles'. You MUST order the 16 'playstyles' strictly by relevance and priority. Standard playstyles CANNOT duplicate the Archetype's Signature Playstyles.
- 'specialisationMinAttrs' MUST be an array of objects. Example: [{"attr": "Finishing", "val": 85}]. NEVER output strings inside this array.
- ATTRIBUTES: Select ONLY the attributes that genuinely define this player. 4-6 core, 5-7 secondary, and 4-6 tertiary attributes. 
- Output ONLY raw JSON.`;

      const stage2Response = await invokeLLM({
        model: aiModel,
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

      // 👉 Clean standard update, targeting the true exact internal ID we just found
      if (currentUser && currentUser.tier !== "owner" && currentUser.tier !== "vip") {
        try {
          await db
            .update(users)
            .set({ monthlyBuilds: currentBuilds + 1 })
            .where(eq(users.id, currentUser.id));
        } catch (updateErr) {
          console.error("Failed to track monthly build:", updateErr);
        }
      }

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
