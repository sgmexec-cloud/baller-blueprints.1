import {
  composeSocial,
  copyPrompt,
  parseCopyJson,
  templateCopy,
  validateCopy,
  type BuildFacts,
  type SocialRecord,
} from "../client/src/utils/socialCopy";

/** Anything shaped like invokeLLM */
export type Invoke = (params: { messages: { role: "system" | "user"; content: string }[] }) => Promise<any>;

/**
 * Writes the social copy for one finished build.
 *  - The AI words the title and description from the build's own facts (nothing else to draw on).
 *  - Its answer is checked (length, one line, no hashtags, and every number must be one of the build's numbers).
 *    One rejected answer gets one second try with the reason; after that, or if the AI fails, a template is used.
 *  - Hashtags, caption, highlights and the scout report never come from the AI.
 * Pass `invoke = null` to use the template only.
 */
export async function generateSocialRecord(
  facts: BuildFacts,
  invoke: Invoke | null,
  onUsage?: (resp: any) => void
): Promise<SocialRecord> {
  if (invoke) {
    let hint: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { system, user } = copyPrompt(facts, hint);
        const resp = await invoke({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });
        onUsage?.(resp);
        const copy = parseCopyJson(resp?.choices?.[0]?.message?.content);
        if (!copy) {
          hint = 'it was not valid JSON with a "title" and a "description"';
          continue;
        }
        const check = validateCopy(copy, facts);
        if (check.ok) return composeSocial(facts, copy, "ai");
        hint = check.problems.join("; ");
      } catch (err) {
        console.error("Social copy AI call failed, using the template:", err);
        break;
      }
    }
  }
  return composeSocial(facts, templateCopy(facts), "template");
}
