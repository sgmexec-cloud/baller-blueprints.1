import { invokeLLM } from "./_core/llm";
import { getArchetypeProfiles } from "./csvLoader";
import { rolesToPositions } from "./positionMap";

// How many times the AI is asked to score the archetypes. The scores are averaged, so one unlucky answer
// cannot flip a close call (for example Maestro vs Recycler for a deep-lying midfielder).
const SAMPLES = 3;

const key = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Picks the archetype that best fits a scouting report by having the AI score EVERY archetype from 0 to 100,
 * several times in parallel, and taking the highest average. Ties go to the alphabetically first name, so the
 * rule is always the same. Returns null if nothing usable came back (the caller then lets the AI choose freely).
 * `onUsage` is called with each raw AI response, for token logging.
 */
export async function pickArchetypeByScores(
  report: string,
  model: string,
  onUsage?: (resp: any) => void
): Promise<string | null> {
  try {
    const seen = new Set<string>();
    const archetypes: { name: string; line: string }[] = [];
    for (const row of getArchetypeProfiles("FC27") as any[]) {
      const name = String(row.Archetype ?? "").trim();
      if (!name || seen.has(key(name))) continue;
      seen.add(key(name));
      const positions = rolesToPositions(row.Recommended_Positions).join("/");
      const signatures = String(row.Signature_PlayStyles ?? "").trim();
      archetypes.push({ name, line: `- ${name}: plays ${positions || "n/a"}; Signature PlayStyles: ${signatures || "n/a"}` });
    }
    if (archetypes.length < 2) return null;
    const names = archetypes.map(a => a.name);

    const system = `You match a real footballer to the FC 27 Pro Clubs archetypes. Read the scouting report (peak-era role, position, strengths and weaknesses) and rate how well the footballer fits EACH archetype below, as an integer from 0 (no fit) to 100 (perfect fit). Use the archetype's positions and Signature PlayStyles as clues. Use the full range: when one archetype clearly fits best, it should clearly score highest.

Archetypes:
${archetypes.map(a => a.line).join("\n")}

Output ONLY raw JSON in exactly this shape and include every archetype: {"scores": {${names.map(n => `"${n}": 0`).join(", ")}}}`;

    const results = await Promise.allSettled(
      Array.from({ length: SAMPLES }, () =>
        invokeLLM({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Scouting report:\n\n${report}` },
          ],
        } as any)
      )
    );

    const totals: Record<string, number> = {};
    names.forEach(n => { totals[n] = 0; });
    let valid = 0;

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      onUsage?.(r.value);
      const raw = (r.value as any)?.choices?.[0]?.message?.content;
      if (typeof raw !== "string") continue;
      try {
        const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
        const scores = JSON.parse(cleaned)?.scores;
        if (!scores || typeof scores !== "object") continue;

        const sample: Record<string, number> = {};
        for (const n of names) {
          const k = Object.keys(scores).find(x => key(x) === key(n));
          const v = k !== undefined ? Number(scores[k]) : NaN;
          if (Number.isFinite(v)) sample[n] = Math.max(0, Math.min(100, v));
        }
        // An answer that skipped most archetypes is not trusted
        if (Object.keys(sample).length < Math.ceil(names.length * 0.6)) continue;
        names.forEach(n => { totals[n] += sample[n] ?? 0; });
        valid++;
      } catch {
        // malformed JSON: ignore this sample
      }
    }

    if (valid === 0) return null;
    const ranked = [...names].sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
    console.log(
      `[archetype scores] ${valid}/${SAMPLES} answers: ` +
        ranked.slice(0, 4).map(n => `${n}=${(totals[n] / valid).toFixed(0)}`).join(", ")
    );
    return ranked[0];
  } catch (err) {
    console.error("Archetype scoring failed:", err);
    return null;
  }
}
