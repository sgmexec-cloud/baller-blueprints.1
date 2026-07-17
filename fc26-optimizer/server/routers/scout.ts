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
  scoutSummary: z.string(), // NEW: The user-facing summary
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

// 👉 THE USER'S CHIEF SCOUT PROMPT (Stage 1)
const CHIEF_SCOUT_PROMPT = `You are an elite professional football scout with extensive experience working for Premier League and Champions League clubs.
Your task is to produce an objective, evidence-based scouting report on the player provided.
The report is NOT intended for human scouting only. It will be analysed by a mathematical engine that converts football language into EA SPORTS FC26 attributes and PlayStyles.
Therefore, every sentence should describe observable football qualities rather than giving numerical ratings or vague opinions.
Do NOT mention EA FC, FIFA, game ratings or attribute values.

Judge the player using the following professional scouting framework.
----------------------------------
1. PLAYER PROFILE
- Name, Age, Preferred Foot, Height (approximate), Primary Position, Secondary Positions.
Provide a brief overview (50-100 words) describing the player's identity, playing style and tactical role.
----------------------------------
2. TECHNICAL PROFILE
Describe: First Touch, Ball Control, Dribbling, Passing Range, Short Passing, Long Passing, Vision, Crossing, Finishing, Long Shooting, Volleys, Heading, Set Pieces, Weak Foot, Skill Ability. Focus on HOW the player executes these actions. Avoid statistics.
----------------------------------
3. TACTICAL PROFILE
Describe: Positioning, Movement, Scanning, Decision Making, Build-up Play, Combination Play, Defensive Positioning, Pressing Intelligence, Transition Behaviour, Spatial Awareness. Explain how the player interprets the game.
----------------------------------
4. PHYSICAL PROFILE
Describe: Acceleration, Sprint Speed, Agility, Balance, Strength, Stamina, Jumping, Aggression. Explain how these qualities affect performance.
----------------------------------
5. MENTAL PROFILE
Describe: Composure, Reactions, Consistency, Competitiveness, Work Rate, Leadership, Decision Making, Resilience, Concentration. Only describe observable football behaviours.
----------------------------------
6. PLAYSTYLE ANALYSIS
Identify which football behaviours naturally define the player based on real football style (e.g. bends finishes, blocks shots, etc).
----------------------------------
7. ROLE SUITABILITY
Identify Best Position and Best Tactical Role. Explain WHY.
----------------------------------
8. STRENGTHS
List the player's five biggest strengths. Explain each in one sentence.
----------------------------------
9. WEAKNESSES
List the player's five biggest weaknesses or limitations. Be objective.
----------------------------------
10. OVERALL SCOUT VERDICT
Summarise: Current Level, Playing Style, Tactical Fit, Ideal Team Style, Ceiling. The conclusion should sound like a genuine professional scout's recommendation.
----------------------------------
WRITING RULES
- Be objective, avoid hype, avoid fan opinions, avoid statistics unless essential.
- Describe observable football actions. Never assign numerical ratings.
- Never mention EA FC attributes or PlayStyles by name.
- The report should contain enough behavioural detail that another AI can accurately infer all FC26 attributes and PlayStyles from the text alone.`;

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

      // ====================================================================
      // STAGE 1: GENERATE THE HIDDEN 10-SECTION REPORT
      // ====================================================================
      const stage1Response = await invokeLLM({
        messages: [
          { role: "system", content: CHIEF_SCOUT_PROMPT },
          { role: "user", content: `Player Identity: ${input.playerIdentity}` }
        ]
      } as any);

      const hiddenScoutReport = stage1Response.choices[0]?.message?.content;
      if (!hiddenScoutReport) throw new Error("Stage 1 LLM returned empty response");

      // ====================================================================
      // STAGE 2: TRANSLATE TO JSON & CREATE SUMMARY
      // ====================================================================
      const context = getScoutingContext();
      const stage2SystemPrompt = `You are the ultimate FC 26 Data Analyst.
Read the Chief Scout's detailed report provided by the user. Your job is to translate their real-world observations into strict FC 26 JSON data using ONLY this context:
${context}

=== RULES ===
1. scoutSummary: Write a 100-word executive summary of the scout report for the user to read.
2. Archetype: Pick the ONE perfect Archetype from the context based on the report. DO NOT invent archetypes.
3. Playstyle+: Choose EXACTLY 4 Playstyle+. (If you pick a Specialisation, its bonus Playstyle+ replaces 1 Base, resulting in 3 Base + 1 Specialisation).
4. Playstyles: Choose EXACTLY 9 standard Playstyles. CRITICAL: List the exact Attribute minimums required next to their name exactly as they appear in the context. DO NOT hallucinate attributes.
5. Attribute Pillars: Sort outfield attributes into Core (6-8), Secondary (10-12), and Tertiary based on the scout's findings.

Return strictly valid JSON matching the requested schema.`;

      const stage2Response = await invokeLLM({
        messages: [
          { role: "system", content: stage2SystemPrompt }, 
          { role: "user", content: `Chief Scout Report:\n\n${hiddenScoutReport}` }
        ],
        response_format: { type: "json_schema", json_schema: { name: "scouting_blueprint", strict: true, schema: { type: "object", properties: { scoutSummary: { type: "string" }, archetype: { type: "string" }, heightRange: { type: "string" }, weightRange: { type: "string" }, position: { type: "string" }, playstylePlus: { type: "array", items: { type: "string" } }, playstyles: { type: "array", items: { type: "object", properties: { name: { type: "string" }, requirements: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } } }, required: ["name", "requirements"], additionalProperties: false } }, specialisation: { type: "string" }, specialisationPlaystylePlus: { type: "string" }, specialisationMinAttrs: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } }, coreAttributes: { type: "array", items: { type: "string" } }, secondaryAttributes: { type: "array", items: { type: "string" } }, tertiaryAttributes: { type: "array", items: { type: "string" } }, reasoning: { type: "string" } }, required: ["scoutSummary", "archetype", "position", "heightRange", "weightRange", "playstylePlus", "playstyles", "coreAttributes", "secondaryAttributes", "tertiaryAttributes"], additionalProperties: false } } }
      } as any);

      const rawContent = stage2Response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Stage 2 LLM returned empty response");
      const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));
      const blueprint = BlueprintSchema.parse(parsed);

      // ====================================================================
      // LOG USAGE TO DATABASE
      // ====================================================================
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
          if (input.apBudget >= Number(p[1])) {
            customSlots = Number(p[3]);
            signatureUpgrades = Number(p[2]);
          }
        }
      } catch (e) { console.error("Progression error:", e); }

      const eligiblePlaystyles = await calculateEligiblePlayStyles(result.finalStats, customSlots, signatureUpgrades, input.blueprint.archetype);
      return {
        ...result,
        scoutSummary: input.blueprint.scoutSummary, // Pass it down to the final response
        playstyles: {
          signatures: eligiblePlaystyles?.signatures || [],
          standard: eligiblePlaystyles?.standard || [],
          specialisation: eligiblePlaystyles?.specialisation || null
        }
      };
    }),
});
