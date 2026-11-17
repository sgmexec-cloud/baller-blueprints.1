import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { 
  getScoutingContext, 
  getArchetypeProfiles, 
  getSpecialisations, 
  getAllArchetypes 
} from "../csvLoader";
import { runMathEngine, ScoutingBlueprint, resolveSignaturePlaystyles, pickSpecialisationSwap, buildPlaystyleFit, USABILITY_FLOORS } from "../mathEngine27";
import { rolesToPositions } from "../positionMap";
import { reserveBuild, refundBuild, getQuota, resetBuilds, reserveCardMatch, refundCardMatch, getCardMatchQuota } from "../buildQuota";
import { PREVIEW_COOKIE } from "../tierPreview";
import { buildsRouter } from "../builds";
import { batchesRouter } from "../batches";
import { makeScoutCacheKey, getCachedBlueprint, saveCachedBlueprint } from "../scoutCache";
import { pickArchetypeByScores } from "../archetypePick";
import { searchFutCards, getFutCardById, getAvailableRarities, upsertFutCards, FutCard } from "../futCards";
import { matchFutCardToPro, previewArchetypeForCard } from "../cardMatcher";
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

const attrMap = (lo: number, hi: number) =>
  z.record(z.string().max(40), z.number().int().min(lo).max(hi))
    .refine(o => Object.keys(o).length <= 29, "Too many attributes");

const AttributePrioritiesSchema = z.object({
  weights: attrMap(1, 5).optional(),
  min: attrMap(1, 99).optional(),
  max: attrMap(1, 99).optional(),
  exclude: z.array(z.string().max(40)).max(29).optional(),
});

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

const cardsRouter = router({
  /** Public card browser & search (no quota used to browse/preview cards) */
  search: publicProcedure
    .input(z.object({
      query: z.string().max(80).optional(),
      rarity: z.string().max(60).optional(),
      position: z.string().max(10).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }))
    .query(({ input }) => searchFutCards(input)),

  getRarities: publicProcedure
    .query(() => getAvailableRarities()),

  getMatchQuota: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = Number((ctx.user as any).id);
      if (!Number.isFinite(userId)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in." });
      return getCardMatchQuota(userId, (ctx.user as any).tier);
    }),

  /** Free preview: which archetype Automatic will pick for this card (no quota used) */
  previewArchetype: publicProcedure
    .input(z.object({ cardId: z.string().min(1).max(120) }))
    .query(async ({ input }) => {
      const card = await getFutCardById(input.cardId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
      return previewArchetypeForCard(card);
    }),

  /** Metered (10 Free / 40 Premium / 100 Premium+ / Unlimited VIP & Owner): convert FUT card to Pro Clubs build */
  matchCard: protectedProcedure
    .input(z.object({
      cardId: z.string().min(1).max(120),
      forcedArchetype: z.string().optional(),
      apBudget: z.number().int().min(1).max(999999),
      signatureSlots: z.number().int().min(0).max(4).default(2),
      standardSlots: z.number().int().min(0).max(6).default(4),
      foundationBoosts: z.record(z.string(), z.number()).optional().default({}),
      starsPrepaid: z.boolean().optional(),
      facilityPlaystyles: z.array(z.string().max(60)).max(8).optional().default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = Number((ctx.user as any).id);
      if (!Number.isFinite(userId)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to use Card Matcher." });
      }

      // Resolve optional locked archetype BEFORE reserving quota (Paid feature)
      let forcedArchetype: string | null = null;
      if (input.forcedArchetype) {
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

      const card = await getFutCardById(input.cardId);
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
      }

      const quota = await reserveCardMatch(userId, (ctx.user as any).tier);
      if (!quota.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "CARD_MATCH_LIMIT_REACHED" });
      }

      try {
        return matchFutCardToPro({
          card,
          forcedArchetype,
          apBudget: input.apBudget,
          signatureSlots: input.signatureSlots,
          standardSlots: input.standardSlots,
          foundationBoosts: input.foundationBoosts,
          starsPrepaid: input.starsPrepaid,
          facilityPlaystyles: input.facilityPlaystyles,
        });
      } catch (err) {
        if (quota.metered) await refundCardMatch(userId);
        throw err;
      }
    }),

  /** OWNER ONLY: bulk-import promo / Icon / Hero cards into Postgres cache */
  upsertCards: protectedProcedure
    .input(z.object({ cards: z.array(z.any()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).realTier !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only." });
      }
      const count = await upsertFutCards(input.cards as FutCard[]);
      return { saved: count };
    }),
});

export const scoutRouter = router({
  // Saved builds + global profile (trpc.scout.builds.*)
  builds: buildsRouter,

  // Batch Build Generator: saved batches of AI builds (owner only) (trpc.scout.batches.*)
  batches: batchesRouter,

  // FUT Card Matcher (trpc.scout.cards.*)
  cards: cardsRouter,

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

        const builderData: Record<string, { pos: string, recommended: string[], signatures: string[], base: Record<string, number> }> = {};
        
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
          
          const rawSignatures = row.Signature_PlayStyles || '';
          const signatures = rawSignatures.split('/').map((s: string) => s.trim()).filter(Boolean);

          builderData[archName] = {
            pos: recPositions[0], 
            recommended: recPositions, 
            signatures: signatures,
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
      customPlaystyles: z.array(z.string()).optional(),
      rescout: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = Number((ctx.user as any).id);
      if (!Number.isFinite(userId)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to use AI builds." });
      }

      let forcedArchetype: string | null = null;
      if (input.forcedArchetype) {
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

      const cacheKey = makeScoutCacheKey({
        playerIdentity: input.playerIdentity,
        forcedArchetype,
        customHeight: input.customHeight,
        customWeight: input.customWeight,
        customSkillMoves: input.customSkillMoves,
        customWeakFoot: input.customWeakFoot,
        customPlaystyles: input.customPlaystyles,
      });
      if (!input.rescout) {
        const cached = BlueprintSchema.safeParse(await getCachedBlueprint(cacheKey));
        if (cached.success) return { ...cached.data, fromCache: true as const };
      }

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

        const scoredArchetype = forcedArchetype
          ? null
          : await pickArchetypeByScores(hiddenScoutReport, aiModel, (resp) => logUsage("archetype", quota.tier, aiModel, resp));
        const lockedArchetype = forcedArchetype ?? scoredArchetype;
        
        const filterRules: string[] = [];
        if (lockedArchetype) filterRules.push(`- ARCHETYPE: CRITICAL OVERRIDE: The "archetype" field MUST be exactly "${lockedArchetype}". Do NOT choose any other archetype. Pick the playstyles, attributes and specialisation that belong to "${lockedArchetype}".`);
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
- ATTRIBUTES: Quality over quantity. Select ONLY the defining attributes for Level 55 builds:
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

        if (lockedArchetype) parsed.archetype = lockedArchetype;

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

        const finalBlueprint = BlueprintSchema.parse(parsed);
        await saveCachedBlueprint(cacheKey, finalBlueprint);
        return finalBlueprint;
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
      starsPrepaid: z.boolean().optional(),
      attributePriorities: AttributePrioritiesSchema.optional(),
      buildStyle: z.enum(["balanced", "authentic"]).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const prio = input.attributePriorities;
      const hasW = !!prio?.weights && Object.keys(prio.weights).length > 0;
      const hasMinMax = (!!prio?.min && Object.keys(prio.min).length > 0) || (!!prio?.max && Object.keys(prio.max).length > 0);
      const hasEx = (prio?.exclude?.length ?? 0) > 0;
      const needRank = hasEx ? 3 : hasMinMax ? 2 : hasW ? 1 : 0;
      const tierRank = ({ free: 0, premium: 1, premium_plus: 2, vip: 3, owner: 3 } as Record<string, number>)[String((ctx.user as any).tier ?? "free")] ?? 0;
      if (tierRank < needRank) {
        throw new TRPCError({ code: "FORBIDDEN", message: "PAID_FEATURE" });
      }
      const priorities = needRank > 0 ? prio : undefined;

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
        { starsPrepaid: input.starsPrepaid, priorities, signatureUpgrades, floors: input.buildStyle === "authentic" ? undefined : USABILITY_FLOORS }
      );

      let earnedSpecPlaystyle: string | undefined = undefined;
      let earnedSpecName: string | undefined = undefined;

      const specReqs = input.blueprint.specialisationMinAttrs ?? [];
      if (input.blueprint.specialisationPlaystylePlus && specReqs.length > 0) {
        const earned = specReqs.every(req => {
          const stat = result.stats.find(s => normAttr(s.attribute) === normAttr(req.attr));
          return (stat?.final ?? 0) >= req.val;
        });
        
        if (earned) {
          earnedSpecPlaystyle = input.blueprint.specialisationPlaystylePlus;
          earnedSpecName = input.blueprint.specialisation ?? undefined;
        }
      }

      const playstyleFit = buildPlaystyleFit(input.blueprint);

      const specSwapIndex = earnedSpecPlaystyle
        ? pickSpecialisationSwap(input.blueprint.archetype, signatureUpgrades, earnedSpecPlaystyle, playstyleFit)
        : -1;

      const resolvedSignatures = resolveSignaturePlaystyles(
        input.blueprint.archetype,
        signatureUpgrades,
        earnedSpecPlaystyle,
        specSwapIndex
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
          specialisation: earnedSpecName || null,
          specSwapIndex
        }
      };
    }),
});
