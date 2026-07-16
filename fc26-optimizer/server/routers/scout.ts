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
      
      // 👉 THE ULTIMATE FC 26 SCOUT PROMPT (Restored to your exact specifications)
      const systemPrompt = `You are the ultimate FC 26 Scout and Attribute Optimizer.
Your job is to create a Phase 1 Scouting Blueprint based STRICTLY on this JSON context data:
${context}

=== THE SCOUTING REPORT RULES (The Blueprint) ===
1. Chosen Archetype: Read the provided context to pick the perfect Archetype. DO NOT invent archetypes.
2. Physical Profile: Recommend a Height and Weight within the Min/Max bounds for that Archetype.
3. Playstyle+: Choose EXACTLY 3 Playstyle+. Read the Base_Playstyle_Plus for the archetype. 
4. Specialisation (Optional): ONLY choose a Specialisation path if it improves realism. If you choose a Specialisation, its bonus Playstyle+ MUST replace one of the 3 Base Playstyle+ (Result = 2 Base + 1 Specialisation). Note its minimum stat targets exactly.
5. Standard Playstyles: Select EXACTLY 8 standard Playstyles from the context.
   CRITICAL: For each of the 8 Playstyles, you MUST list the exact Attribute minimums required next to their name exactly as they appear in the context. DO NOT HALLUCINATE ATTRIBUTE REQUIREMENTS.
6. Attribute Pillars: Sort outfield attributes into three realistic tiers:
   - Core (6 to 8 stats): What the player is known for (Elite traits).
   - Secondary (10 to 12 stats): Well-rounded areas.
   - Tertiary (The rest): Areas of weakness or average ability to add realism.

You must return this Blueprint STRICTLY as JSON matching the requested schema. DO NOT invent archetypes, playstyles, or attribute points. ONLY use the exact names and numbers provided in the context.`;

      const response = await invokeLLM({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Player Identity: ${input.playerIdentity}` }],
        response_format: { type: "json_schema", json_schema: { name: "scouting_blueprint", strict: true, schema: { type: "object", properties: { archetype: { type: "string" }, heightRange: { type: "string" }, weightRange: { type: "string" }, position: { type: "string" }, playstylePlus: { type: "array", items: { type: "string" } }, playstyles: { type: "array", items: { type: "object", properties: { name: { type: "string" }, requirements: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } } }, required: ["name", "requirements"], additionalProperties: false } }, specialisation: { type: "string" }, specialisationPlaystylePlus: { type: "string" }, specialisationMinAttrs: { type: "array", items: { type: "object", properties: { attr: { type: "string" }, val: { type: "number" } }, required: ["attr", "val"], additionalProperties: false } }, coreAttributes: { type: "array", items: { type: "string" } }, secondaryAttributes: { type: "array", items: { type: "string" } }, tertiaryAttributes: { type: "array", items: { type: "string" } }, reasoning: { type: "string" } }, required: ["archetype", "position", "heightRange", "weightRange", "playstylePlus", "playstyles", "coreAttributes", "secondaryAttributes", "tertiaryAttributes"], additionalProperties: false } } }
      } as any);

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
