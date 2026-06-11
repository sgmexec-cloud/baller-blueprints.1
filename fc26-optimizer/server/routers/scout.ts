import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getScoutingContext } from "../csvLoader";
import { runMathEngine, ScoutingBlueprint } from "../mathEngine";

// ── Zod schemas ───────────────────────────────────────────────────────────────

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

// ── Scout router ──────────────────────────────────────────────────────────────

export const scoutRouter = router({
  generateReport: publicProcedure
    .input(z.object({ playerIdentity: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      // Validate blueprint after LLM response
      const context = getScoutingContext();

      const systemPrompt = `You are an elite FC 26 scout and attribute specialist. Your job is to analyse a player description and produce a precise, data-driven scouting blueprint using ONLY the data provided.

You have access to the following FC 26 game data:
${context}

RULES:
1. Extract the player's POSITION from the player description (e.g., CB, LW, ST, CDM, etc.). This is REQUIRED.
2. Pick the SINGLE best Archetype from the archetypes list that fits the player description.
3. Recommend a Height and Weight WITHIN the archetype's bounds (MinH-MaxH cm, MinW-MaxW kg).
4. Select EXACTLY 4 Playstyle+ from the archetype's Base_Playstyle_Plus list. If a Specialisation is chosen, one of the Base_Playstyle_Plus slots is REPLACED by the Specialisation's bonus Playstyle+.
5. Select exactly 9 standard Playstyles from the playstyleReqs list. Look up their exact minimum stat requirements and include them. 
   CRITICAL: A standard Playstyle MUST NOT duplicate any Playstyle+ already equipped by the player (either from the base archetype list or the specialisation). The lists must be entirely mutually exclusive.
6. Optionally pick ONE Specialisation from the specialisations list that matches the chosen Archetype. If chosen, its bonus Playstyle+ replaces one of the base Playstyle+.
7. Sort ALL attributes for the chosen archetype into:
   - Core: 8 most important attributes for this player's role
   - Secondary: next 12 most important attributes
   - Tertiary: all remaining attributes
8. Return ONLY valid JSON matching the schema. No extra text.

RESPONSE FORMAT (strict JSON):
{
  "archetype": "string — exact archetype name from data",
  "position": "string — e.g. 'CB', 'LW', 'ST', 'CDM' — extracted from player description (REQUIRED)",
  "heightRange": "string — e.g. '175-182 cm'",
  "weightRange": "string — e.g. '70-78 kg'",
  "playstylePlus": ["array of exactly 4 Playstyle+ names"],
  "playstyles": [
    {
      "name": "PlaystyleName",
      "requirements": [{"attr": "AttributeName", "val": 80}]
    }
  ],
  "specialisation": "SpecialisationName or omit if none",
  "specialisationPlaystylePlus": "BonusPlaystyle+ name or omit if none",
  "specialisationMinAttrs": [{"attr": "AttributeName", "val": 90}],
  "coreAttributes": ["array of 8 attribute names"],
  "secondaryAttributes": ["array of 12 attribute names"],
  "tertiaryAttributes": ["array of remaining attribute names"],
  "reasoning": "Brief explanation of choices"
}`;

      const userPrompt = `Player Identity & Position: ${input.playerIdentity}

Generate the scouting blueprint for this player.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "scouting_blueprint",
            strict: true,
            schema: {
              type: "object",
              properties: {
                archetype: { type: "string" },
                heightRange: { type: "string" },
                weightRange: { type: "string" },
                position: { type: "string" },
                playstylePlus: { type: "array", items: { type: "string" } },
                playstyles: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      requirements: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            attr: { type: "string" },
                            val: { type: "number" },
                          },
                          required: ["attr", "val"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["name", "requirements"],
                    additionalProperties: false,
                  },
                },
                specialisation: { type: "string" },
                specialisationPlaystylePlus: { type: "string" },
                specialisationMinAttrs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      attr: { type: "string" },
                      val: { type: "number" },
                    },
                    required: ["attr", "val"],
                    additionalProperties: false,
                  },
                },
                coreAttributes: { type: "array", items: { type: "string" } },
                secondaryAttributes: { type: "array", items: { type: "string" } },
                tertiaryAttributes: { type: "array", items: { type: "string" } },
                reasoning: { type: "string" },
              },
              required: [
                "archetype",
                "position",
                "heightRange",
                "weightRange",
                "playstylePlus",
                "playstyles",
                "coreAttributes",
                "secondaryAttributes",
                "tertiaryAttributes",
              ],
              additionalProperties: false,
            },
          },
        },
      } as Parameters<typeof invokeLLM>[0]);

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("LLM returned empty response");
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

      const parsed = JSON.parse(content);
      const blueprint = BlueprintSchema.parse(parsed);

      // ── Server-side validation of blueprint invariants ────────────────────
      if (blueprint.playstylePlus.length !== 4) {
        throw new Error(`Blueprint must have exactly 4 Playstyle+, got ${blueprint.playstylePlus.length}`);
      }
      if (blueprint.playstyles.length !== 9) {
        throw new Error(`Blueprint must have exactly 9 standard Playstyles, got ${blueprint.playstyles.length}`);
      }
      // Check for overlapping items between Playstyle+ and standard playstyles to protect database entry
      const pPlusNames = blueprint.playstylePlus.map(p => p.replace('+', '').toLowerCase());
      if (blueprint.specialisationPlaystylePlus) {
        pPlusNames.push(blueprint.specialisationPlaystylePlus.replace('+', '').toLowerCase());
      }
      
      const duplicates = blueprint.playstyles.filter(p => pPlusNames.includes(p.name.toLowerCase()));
      if (duplicates.length > 0) {
        throw new Error(`Blueprint contains standard playstyles that duplicate a Playstyle+: ${duplicates.map(d => d.name).join(", ")}`);
      }

      if (blueprint.coreAttributes.length !== 8) {
        throw new Error(`Blueprint must have exactly 8 Core attributes, got ${blueprint.coreAttributes.length}`);
      }
      if (blueprint.secondaryAttributes.length !== 12) {
        throw new Error(`Blueprint must have exactly 12 Secondary attributes, got ${blueprint.secondaryAttributes.length}`);
      }

      return blueprint;
    }),

  calculateStats: publicProcedure
    .input(
      z.object({
        blueprint: BlueprintSchema,
        apBudget: z.number().int().min(1).max(999999),
      })
    )
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
      return result;
    }),
});
