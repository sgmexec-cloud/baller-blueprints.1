import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { 
  getScoutingContext, 
  getArchetypeProfiles, 
  getPlaystyles, 
  getSpecialisations, 
  getAllArchetypes 
} from "../csvLoader";
import { runMathEngine, ScoutingBlueprint, resolveSignaturePlaystyles } from "../mathEngine27";
import { rolesToPositions } from "../positionMap"; 
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import fs from "fs/promises";
import path from "path";
import { eq, sql } from "drizzle-orm";

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
  specialisation: z.string().nullable().optional(),
  specialisationPlaystylePlus: z.string().nullable().optional(),
  specialisationMinAttrs: z.array(PlaystyleReqSchema).optional(),
  specialisationReason: z.string().nullable().optional(),
  coreAttributes: z.array(z.string()),
  secondaryAttributes: z.array(z.string()),
  tertiaryAttributes: z.array(z.string()),
  reasoning: z.string().optional(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

function normAttr(s: string): string { 
  if (!s) return "";
  let n = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); 
  if (n.startsWith('att') && n.includes('pos')) return 'attackpositioning';
  if (n.includes('fk') && n.includes('acc')) return 'fkaccuracy';
  if (n.startsWith('def') && n.includes('awar')) return 'defawareness';
  if (n.includes('stand') && n.includes('tack')) return 'standingtackle';
  if (n.includes('slid') && n.includes('tack')) return 'slidingtackle';
  if (n.startsWith('short') && n.includes('pass')) return 'shortpassing';
  if (n.startsWith('long') && n.includes('pass')) return 'longpassing';
  if (n.includes('head') && n.includes('acc')) return 'headingaccuracy';
  if (n.includes('sprint')) return 'sprintspeed';
  return n;
}

const CHIEF_SCOUT_PROMPT = `You are an elite professional football scout. Produce an objective, evidence-based scouting report based strictly on the player's ABSOLUTE PEAK/PRIME era. 
If a player changed positions during their career, you MUST evaluate them based solely on their most famous, highest-performing role. 
CRITICAL: You must explicitly define their 'Tactical Role' (e.g. Inverted Winger, Ball-Winning Midfielder, Target Man) to anchor the evaluation. 
Describe observable football qualities (First Touch, Scanning, Decision Making, etc). Highlight stylistic limitations and weaknesses—what are they notoriously bad at? 
Explicitly identify the player's 'Signature Weapon'—their most iconic, trademark footballing action or trait. Do NOT mention EA FC, FIFA, or specific attribute values. Describe behaviours so an AI can infer accurate attributes.`;

const ARCHETYPE_SELECTION_POLICY = `
ARCHETYPE SELECTION — MANDATORY DECISION PROCESS
Use ONLY archetype data provided in the FC27 context and the Stage 1 scouting report.

1. COMPARE ALL CANDIDATE ARCHETYPES: Do not choose the first plausible archetype. Compare all available archetypes in the context before selecting.
2. SCORE WEIGHTING:
   - 35%: Signature weapon and tactical-role alignment.
   - 30%: Alignment with the archetype's Key_Attributes.
   - 25%: Alignment with Signature_PlayStyles.
   - 10%: Recommended_Positions compatibility.
3. PRIORITISE PRIMARY IDENTITY: Distinguish primary playing identity from secondary abilities (e.g., a striker who drops deep to pass is still primarily a goalscorer/Finisher, unless their defining signature weapon is chance creation).
4. BREAK TIES CONSISTENTLY: Prioritise Signature Weapon > Tactical Role > Key Attributes > Signature PlayStyles > Position.
5. FINAL OUTPUT: Return exactly one valid archetype name from the supplied context.
`;

export const scoutRouter = router({
  getArchetypes: publicProcedure
    .query(async () => {
      try {
        const profiles = getArchetypeProfiles("FC27");
        const uniqueArchetypes = Array.from(new Set(profiles.map((row: any) => row.Archetype.trim()))).filter(Boolean);
        return uniqueArchetypes.sort();
      } catch (e) {
        console.error("Failed to load archetypes:", e);
        return [];
      }
    }),

  getArchetypeBaseStats: publicProcedure
    .query(async () => {
      try {
        const profiles = getArchetypeProfiles("FC27"); 
        const allArchData = getAllArchetypes("FC27"); 
        
        const ALL_ATTRS = [
          "Acceleration", "Sprint Speed", "Attack Positioning", "Finishing", "Shot Power",
          "Long Shots", "Volleys", "Penalties", "Vision", "Crossing", "FK Accuracy",
          "Short Passing", "Long Passing", "Curve", "Agility", "Balance", "Reactions",
          "Ball Control", "Dribbling", "Composure", "Interceptions", "Heading Accuracy",
          "Def Awareness", "Standing Tackle", "Sliding Tackle", "Jumping", "Stamina",
          "Strength", "Aggression"
        ];

        const builderData: Record<string, { pos: string, recommended: string[], base: Record<string, number> }> = {};
        
        for (const row of profiles) {
          if (!row.Archetype) continue;
          const archName = row.Archetype.trim();
          
          const baseStats: Record<string, number> = {};
          for (const attr of ALL_ATTRS) {
             baseStats[attr] = 70;
          }

          const archAttrRows = allArchData.filter((r: any) => normAttr(r.Archetype) === normAttr(archName));
          for (const attrRow of archAttrRows) {
            const attrName = attrRow.Attribute?.trim();
            if (!attrName) continue;
            
            const matchedUIAttr = ALL_ATTRS.find(a => normAttr(a) === normAttr(attrName)) || attrName;
            const bVal = parseInt(attrRow["Base Value"], 10);
            baseStats[matchedUIAttr] = isNaN(bVal) ? 70 : bVal;
          }

          const recPositions = rolesToPositions(row.Recommended_Positions);

          builderData[archName] = {
            pos: recPositions[0], 
            recommended: recPositions, 
            base: baseStats
          };
        }
        return builderData;
      } catch (e) {
        console.error("Failed to load archetype base stats:", e);
        return {};
      }
    }),

  generateReport: publicProcedure
    .input(z.object({ 
      playerIdentity: z.string().min(1).max(1000), 
      forcedArchetype: z.string().optional(),
      customHeight: z.string().optional(),
      customWeight: z.string().optional(),
      customSkillMoves: z.number().int().min(1).max(5).optional(),
      customWeakFoot: z.number().int().min(1).max(5).optional(),
      customPlaystyles: z.array(z.string()).optional(), 
      isDevMode: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      
      const rawUserId = (ctx as any).user?.id || (ctx as any).userId || (ctx as any).user?.openId;
      const userId = rawUserId ? String(rawUserId) : null;
      
      let buildLimit = input.isDevMode ? Infinity : 2; 
      let currentUser = null;

      if (userId) {
        const userQuery = await db.execute(
          sql`SELECT id, tier, "monthlyBuilds" FROM users WHERE id::text = ${userId} OR "openId"::text = ${userId} LIMIT 1`
        );
        const dbUser = (userQuery as any)?.rows?.[0] || (Array.isArray(userQuery) ? userQuery[0] : null);

        if (dbUser) {
          currentUser = {
            id: dbUser.id,
            tier: dbUser.tier || "free",
            monthlyBuilds: dbUser.monthlyBuilds ?? dbUser.monthly_builds ?? 0
          };
        }

        if (currentUser) {
          if (input.isDevMode || currentUser.tier === "owner") buildLimit = Infinity; 
          else if (currentUser.tier === "vip") buildLimit = 500;   
          else if (currentUser.tier === "premium_plus") buildLimit = 250;
          else if (currentUser.tier === "premium") buildLimit = 100;
          else buildLimit = 5; 
        } else {
          currentUser = { id: userId, tier: "free", monthlyBuilds: 0 };
          buildLimit = input.isDevMode ? Infinity : 5;
        }
      }

      const currentBuilds = currentUser?.monthlyBuilds || 0;

      if (!input.isDevMode && currentUser && currentBuilds >= buildLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "LIMIT_REACHED",
        });
      }

      const isProTier = input.isDevMode || currentUser?.tier === "owner" || currentUser?.tier === "vip" || currentUser?.tier === "premium_plus" || currentUser?.tier === "premium";
      const aiModel = isProTier ? "gpt-4o" : "gpt-4o-mini"; 

      // 👉 STAGE 1 LLM CALL
      const stage1Response = await invokeLLM({
        model: aiModel,
        messages: [
          { role: "system", content: CHIEF_SCOUT_PROMPT },
          { role: "user", content: `Player Identity: ${input.playerIdentity}` }
        ]
      } as any);

      // Extract usage for Stage 1
      const stage1Usage = (stage1Response as any).usage || { prompt_tokens: 0, completion_tokens: 0 };

      const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
      if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

      const context = getScoutingContext("FC27");
      
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

      const stage2SystemPrompt = `You are the ultimate FC 27 Data Analyst. Translate the scout report into strict FC 27 JSON using ONLY this context:
${context}

${ARCHETYPE_SELECTION_POLICY}

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
  "specialisation": null,
  "specialisationPlaystylePlus": null,
  "specialisationMinAttrs": [],
  "specialisationReason": null,
  "coreAttributes": ["Attr1"],
  "secondaryAttributes": ["Attr2"],
  "tertiaryAttributes": ["Attr3"],
  "reasoning": "..."
}

RULES:
${filterRules.join("\n")}
- HEIGHT & WEIGHT: (Unless overridden above) You MUST provide an EXACT, definitive height (e.g., "178cm" or "5'10\"") and an EXACT weight (e.g., "72kg" or "158 lbs"). DO NOT provide ranges.
- PLAYSTYLES & PRIORITY: You MUST generate EXACTLY 4 items in 'playstylePlus' and EXACTLY 16 items in 'playstyles'. You MUST order the 16 'playstyles' strictly by relevance and priority. Standard playstyles CANNOT duplicate the Archetype's Signature Playstyles.
- SPECIALISATION (OPTIONAL, default is NONE): Find the specialisation listed for your chosen archetype in the context. Select it ONLY if BOTH are true:
  (a) its bonusPlaystylePlus appears in your 'playstylePlus' or your top 6 'playstyles', or matches the player's Signature Weapon; AND
  (b) at least 2/3 of its minimumAttributes are in your coreAttributes or secondaryAttributes.
  If either fails, output specialisation: null, specialisationPlaystylePlus: null, specialisationMinAttrs: [], specialisationReason: null. Leaving it empty is correct whenever the fit isn't clear.
  If you do select it, copy the name, Playstyle+ and thresholds EXACTLY from the context as objects like {"attr": "Finishing", "val": 85}, and state which of (a)/(b) it satisfies in specialisationReason.
- ATTRIBUTES: Quality over quantity. Select ONLY the defining attributes for Level 40 builds:
  - coreAttributes: EXACTLY 2-3 signature attributes (their absolute peak strengths).
  - secondaryAttributes: 3-4 strong supporting attributes.
  - tertiaryAttributes: 3-4 rounded attributes.
- Output ONLY raw JSON.`;

      // 👉 STAGE 2 LLM CALL
      const stage2Response = await invokeLLM({
        model: aiModel,
        messages: [
          { role: "system", content: stage2SystemPrompt }, 
          { role: "user", content: `Translate this report into JSON:\n\n${hiddenScoutReport}` }
        ]
      } as any);

      // Extract usage for Stage 2
      const stage2Usage = (stage2Response as any).usage || { prompt_tokens: 0, completion_tokens: 0 };

      // 👉 LOG THE TOKENS AND COST TO RENDER
      const totalInputTokens = (stage1Usage.prompt_tokens || 0) + (stage2Usage.prompt_tokens || 0);
      const totalOutputTokens = (stage1Usage.completion_tokens || 0) + (stage2Usage.completion_tokens || 0);
      
      // Gemini 3.8 Flash Pricing: $0.75 / 1M input, $3.75 / 1M output
      const inputCostUSD = (totalInputTokens / 1_000_000) * 0.75;
      const outputCostUSD = (totalOutputTokens / 1_000_000) * 3.75;
      const totalCostUSD = inputCostUSD + outputCostUSD;

      console.log(`
==================================================
📊 BUILD TOKEN USAGE REPORT [${input.playerIdentity}]
==================================================
Stage 1 In: ${stage1Usage.prompt_tokens} | Out: ${stage1Usage.completion_tokens}
Stage 2 In: ${stage2Usage.prompt_tokens} | Out: ${stage2Usage.completion_tokens}
--------------------------------------------------
TOTAL INPUT TOKENS  : ${totalInputTokens}
TOTAL OUTPUT TOKENS : ${totalOutputTokens}
ESTIMATED BUILD COST: $${totalCostUSD.toFixed(6)} USD
==================================================
      `);

      const rawContent = stage2Response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Stage 2 LLM returned empty response");

      let cleanedJson = typeof rawContent === "string" ? rawContent.trim() : JSON.stringify(rawContent);
      cleanedJson = cleanedJson.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

      const parsed = JSON.parse(cleanedJson);

      const validArchetypes = new Set(
        getArchetypeProfiles("FC27")
          .map((row: any) => row.Archetype?.trim())
          .filter(Boolean)
      );

      if (parsed.archetype && !validArchetypes.has(parsed.archetype.trim())) {
        const matched = Array.from(validArchetypes).find(a => normAttr(a as string) === normAttr(parsed.archetype));
        if (matched) {
          parsed.archetype = matched;
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid archetype "${parsed.archetype}" generated by AI.`
          });
        }
      }

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

      const stripPlus = (s: string) => normAttr(s.replace(/\+/g, ""));
      const clearSpec = () => {
        parsed.specialisation = null;
        parsed.specialisationPlaystylePlus = null;
        parsed.specialisationMinAttrs = [];
        parsed.specialisationReason = null;
      };

      if (!parsed.specialisation || !String(parsed.specialisation).trim()) {
        clearSpec();
      } else {
        const real = getSpecialisations("FC27").find((s: any) =>
          normAttr(s.Archetype) === normAttr(parsed.archetype) && normAttr(s.Specialisation || "") === normAttr(parsed.specialisation)
        );
        
        if (!real) {
          clearSpec();
        } else {
          const reqs = [
            [real.Attr1, real.Val1], 
            [real.Attr2, real.Val2], 
            [real.Attr3, real.Val3]
          ].filter(([a, v]) => a && v).map(([a, v]) => ({ attr: a as string, val: parseInt(v as string, 10) }));

          if (reqs.length === 0) {
            clearSpec();
          } else {
            const buildAttrs = new Set([...(parsed.coreAttributes ?? []), ...(parsed.secondaryAttributes ?? [])].map(normAttr));
            const styles = new Set(
              [...(parsed.playstylePlus ?? []), ...(parsed.playstyles ?? []).slice(0, 6).map((x: any) => x.name)]
                .map((x: string) => stripPlus(String(x)))
            );
            const synergy = !!real["Playstyle+"] && styles.has(stripPlus(real["Playstyle+"]));
            const aligned = reqs.filter(r => buildAttrs.has(normAttr(r.attr))).length >= Math.ceil(reqs.length * 0.66);
            
            if (!synergy && !aligned) {
              clearSpec();
            } else {
              parsed.specialisationPlaystylePlus = real["Playstyle+"];
              parsed.specialisationMinAttrs = reqs;
            }
          }
        }
      }

      const blueprint = BlueprintSchema.parse(parsed);

      if (!input.isDevMode && currentUser && currentUser.tier !== "owner" && currentUser.tier !== "vip") {
        const nextBuilds = currentBuilds + 1;
        await db.execute(
          sql`UPDATE users SET "monthlyBuilds" = ${nextBuilds} WHERE id::text = ${userId} OR "openId"::text = ${userId}`
        );
      }

      return blueprint;
    }),

  calculateStats: publicProcedure
    .input(z.object({ 
      blueprint: BlueprintSchema, 
      apBudget: z.number().int().min(1).max(999999),
      signatureSlots: z.number().int().optional(),
      standardSlots: z.number().int().optional(),
      preferredAttributes: z.array(z.string()).optional(),
      foundationBoosts: z.record(z.string(), z.number()).optional().default({}),
      starsPrepaid: z.boolean().optional()
    }))
    .mutation(async ({ input }) => {
      let customSlots = input.standardSlots;
      let signatureUpgrades = input.signatureSlots;

      if (customSlots == null || signatureUpgrades == null) {
        try {
          const progPath = path.join(process.cwd(), "server", "data27", "FC27_PROGRESSION.csv");
          const progContent = await fs.readFile(progPath, "utf-8");
          const lines = progContent.trim().split("\n");
          for (let i = 1; i < lines.length; i++) {
            const p = lines[i].split(",");
            if (input.apBudget >= Number(p[1])) {
              if (signatureUpgrades == null) signatureUpgrades = Number(p[2]);
              if (customSlots == null) customSlots = Number(p[3]);      
            }
          }
        } catch (e) { console.error("Progression error:", e); }
      }
      
      customSlots ??= 0;
      signatureUpgrades ??= 0;

      const engineBlueprint: ScoutingBlueprint = {
        archetype: input.blueprint.archetype,
        position: input.blueprint.position,
        playstylePlus: input.blueprint.playstylePlus,
        playstyles: input.blueprint.playstyles,
        specialisation: input.blueprint.specialisation ?? undefined,
        specialisationPlaystylePlus: input.blueprint.specialisationPlaystylePlus ?? undefined,
        specialisationMinAttrs: input.blueprint.specialisationMinAttrs,
        coreAttributes: input.blueprint.coreAttributes,
        secondaryAttributes: input.blueprint.secondaryAttributes,
        tertiaryAttributes: input.blueprint.tertiaryAttributes,
        skillMoves: input.blueprint.skillMoves,
        weakFoot: input.blueprint.weakFoot,
      };

      const result = runMathEngine(
        engineBlueprint, 
        input.apBudget, 
        customSlots, 
        input.preferredAttributes || [], 
        input.foundationBoosts,
        { starsPrepaid: input.starsPrepaid }
      );

      let earnedSpecPlaystyle: string | undefined = undefined;
      let earnedSpecName: string | undefined = undefined;

      const specReqs = input.blueprint.specialisationMinAttrs ?? [];
      if (input.blueprint.specialisationPlaystylePlus && specReqs.length > 0) {
        const earned = specReqs.every(req => {
          const stat = result.stats.find(s => normAttr(s.attribute) === normAttr(req.attr));
          const boost = Object.entries(input.foundationBoosts)
            .find(([k]) => normAttr(k) === normAttr(req.attr))?.[1] ?? 0;
          return (stat?.final ?? 0) + boost >= req.val;
        });
        
        if (earned) {
          earnedSpecPlaystyle = input.blueprint.specialisationPlaystylePlus;
          earnedSpecName = input.blueprint.specialisation ?? undefined;
        }
      }

      const resolvedSignatures = resolveSignaturePlaystyles(
        input.blueprint.archetype,
        signatureUpgrades,
        earnedSpecPlaystyle,
        "FC27"
      );

      const standardPlaystyles = result.equippedPlaystyles?.slice(0, customSlots) || [];
      
      const ALL_PROFILES = getArchetypeProfiles("FC27");
      const archProfile = ALL_PROFILES.find((a: any) => normAttr(a.Archetype) === normAttr(input.blueprint.archetype));
      
      const recommendedPositions = rolesToPositions(archProfile?.Recommended_Positions);

      return {
        ...result,
        scoutSummary: input.blueprint.scoutSummary,
        suggestedSkillMoves: input.blueprint.skillMoves,
        suggestedWeakFoot: input.blueprint.weakFoot,
        recommendedPositions,
        playstyles: {
          signatures: resolvedSignatures,
          standard: standardPlaystyles,
          specialisation: earnedSpecName || null
        }
      };
    }),
});
