import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { 
  getScoutingContext, 
  getArchetypeProfiles, 
  getSpecialisations, 
  getAllArchetypes 
} from "../csvLoader";
import { runMathEngine, ScoutingBlueprint, resolveSignaturePlaystyles } from "../mathEngine27";
import { rolesToPositions } from "../positionMap";
import { reserveBuild, refundBuild, getQuota, resetBuilds } from "../buildQuota";
import { PREVIEW_COOKIE } from "../tierPreview";
import { buildsRouter } from "../builds";
import { TRPCError } from "@trpc/server";
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

// Logs the real token usage of every AI call so you can measure the true cost per build:
// cost = in_tokens x input_price + out_tokens x output_price (add stage1 + stage2 for one build).
function logUsage(stage: string, tier: string, model: string, resp: any) {
  const u = resp?.usage;
  console.log(
    `[AI usage] ${stage} tier=${tier} model=${model} in=${u?.prompt_tokens ?? u?.input_tokens ?? "?"} out=${u?.completion_tokens ?? u?.output_tokens ?? "?"}`
  );
}

const CHIEF_SCOUT_PROMPT = `You are an elite professional football scout. Produce an objective, evidence-based scouting report based strictly on the player's ABSOLUTE PEAK/PRIME era. 
If a player changed positions during their career, you MUST evaluate them based solely on their most famous, highest-performing role. 
CRITICAL: You must explicitly define their 'Tactical Role' (e.g. Inverted Winger, Ball-Winning Midfielder, Target Man) to anchor the evaluation. 
Describe observable football qualities (First Touch, Scanning, Decision Making, etc). Highlight stylistic limitations and weaknesses—what are they notoriously bad at? 
Explicitly identify the player's 'Signature Weapon'—their most iconic, trademark footballing action or trait. Do NOT mention EA FC, FIFA, or specific attribute values. Describe behaviours so an AI can infer accurate attributes.`;

export const scoutRouter = router({
  // Saved builds + global profile (trpc.scout.builds.*)
  builds: buildsRouter,

  // ---------- PUBLIC: everything the Manual Builder needs (no account required) ----------
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

  // ---------- ACCOUNT REQUIRED: AI Auto-Build ----------

  /** Who is logged in (or null). Returns ONLY safe fields: the user row also holds the login code. */
  me: publicProcedure
    .query(({ ctx }) => {
      const u = (ctx as any).user;
      return u
        ? {
            id: u.id as number,
            name: (u.name ?? null) as string | null,
            email: (u.email ?? null) as string | null,
            tier: u.tier as string,
            // The owner can preview other plans: tier is the plan in effect, realTier is the stored one
            realTier: (u.realTier ?? u.tier) as string,
            previewing: Boolean(u.previewing),
            hasSubscription: Boolean(u.stripeSubscriptionId),
          }
        : null;
    }),

  /** OWNER ONLY: view the whole app as another plan. Use "owner" to switch back. */
  setPreviewTier: protectedProcedure
    .input(z.object({ tier: z.enum(["owner", "free", "premium", "premium_plus", "vip"]) }))
    .mutation(({ ctx, input }) => {
      if ((ctx.user as any).realTier !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only." });
      }
      const res = (ctx as any).res;
      if (input.tier === "owner") {
        res.clearCookie(PREVIEW_COOKIE, { path: "/" });
      } else {
        res.cookie(PREVIEW_COOKIE, input.tier, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 12 * 60 * 60 * 1000,
        });
      }
      return { tier: input.tier };
    }),

  /** OWNER ONLY: zero my AI build counter so a plan's limit can be tested again. */
  resetMyBuildCounter: protectedProcedure
    .mutation(async ({ ctx }) => {
      if ((ctx.user as any).realTier !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only." });
      }
      await resetBuilds(Number((ctx.user as any).id));
      return { success: true };
    }),

  /** How many AI builds the logged-in user has left this month (for the UI). */
  getQuota: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = Number((ctx.user as any).id);
      if (!Number.isFinite(userId)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in." });
      return getQuota(userId, (ctx.user as any).tier);
    }),

  generateReport: protectedProcedure
    .input(z.object({ 
      playerIdentity: z.string().min(1).max(1000), 
      forcedArchetype: z.string().optional(),
      customHeight: z.string().optional(),
      customWeight: z.string().optional(),
      customSkillMoves: z.number().int().min(1).max(5).optional(),
      customWeakFoot: z.number().int().min(1).max(5).optional(),
      customPlaystyles: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = Number((ctx.user as any).id);
      if (!Number.isFinite(userId)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to use AI builds." });
      }

      // Resolve the archetype preference (if any) to its exact name BEFORE reserving a build,
      // so a bad value never costs the user a build.
      let forcedArchetype: string | null = null;
      if (input.forcedArchetype) {
        // Archetype Select: Premium and above (checked here, before a build is reserved)
        if (((ctx.user as any).tier ?? "free") === "free") {
          throw new TRPCError({ code: "FORBIDDEN", message: "PAID_FEATURE" });
        }
        const validArchetypes = Array.from(
          new Set(getArchetypeProfiles("FC27").map((r: any) => String(r.Archetype).trim()))
        ).filter(Boolean) as string[];
        forcedArchetype = validArchetypes.find(a => normAttr(a) === normAttr(input.forcedArchetype!)) ?? null;
        if (!forcedArchetype) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown archetype." });
        }
      }

      // Reserve ONE build atomically BEFORE spending any AI money.
      // (Free: 5 per calendar month. Paid tiers: see buildQuota.ts. The limit can never be passed,
      //  even by parallel requests, and nothing here comes from the client.)
      const quota = await reserveBuild(userId, (ctx.user as any).tier);
      if (!quota.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "LIMIT_REACHED" });
      }

      try {
        const isProTier = quota.tier !== "free";
        const aiModel = isProTier ? "gpt-4o" : "gpt-4o-mini"; 

        const stage1Response = await invokeLLM({
          model: aiModel,
          messages: [
            { role: "system", content: CHIEF_SCOUT_PROMPT },
            { role: "user", content: `Player Identity: ${input.playerIdentity}` }
          ]
        } as any);

        logUsage("stage1", quota.tier, aiModel, stage1Response);
        const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
        if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

        const context = getScoutingContext("FC27");
        
        const filterRules: string[] = [];
        if (forcedArchetype) filterRules.push(`- ARCHETYPE: CRITICAL OVERRIDE: The "archetype" field MUST be exactly "${forcedArchetype}". Do NOT choose any other archetype. Pick the playstyles, attributes and specialisation that belong to "${forcedArchetype}".`);
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

        const stage2Response = await invokeLLM({
          model: aiModel,
          messages: [
            { role: "system", content: stage2SystemPrompt }, 
            { role: "user", content: `Translate this report into JSON:\n\n${hiddenScoutReport}` }
          ]
        } as any);

        logUsage("stage2", quota.tier, aiModel, stage2Response);
        const rawContent = stage2Response.choices[0]?.message?.content;
        if (!rawContent) throw new Error("Stage 2 LLM returned empty response");

        let cleanedJson = typeof rawContent === "string" ? rawContent.trim() : JSON.stringify(rawContent);
        cleanedJson = cleanedJson.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

        const parsed = JSON.parse(cleanedJson);

        // Guarantee: if the user picked an archetype, that is what they get, whatever the AI answered.
        // (The specialisation check below runs against this archetype, so a mismatched spec is dropped.)
        if (forcedArchetype) parsed.archetype = forcedArchetype;

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

        // The build was already reserved up front; if anything above throws, it is refunded below.
        return BlueprintSchema.parse(parsed);
      } catch (err) {
        if (quota.metered) await refundBuild(userId);
        throw err;
      }
    }),

  calculateStats: protectedProcedure
    .input(z.object({ 
      blueprint: BlueprintSchema, 
      apBudget: z.number().int().min(1).max(999999),
      signatureSlots: z.number().int().optional(),
      standardSlots: z.number().int().optional(),
      preferredAttributes: z.array(z.string()).optional(),
      foundationBoosts: z.record(z.string(), z.number()).optional().default({}),
      // true when the caller has already deducted the Skill Moves / Weak Foot cost from apBudget
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
        earnedSpecPlaystyle
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
