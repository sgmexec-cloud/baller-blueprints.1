/**
 * Social content for a finished build (TikTok title, description, caption, hashtags, highlights).
 *
 * Everything is built from the REAL build: the facts below come straight from the saved build, the hashtags and
 * the caption are templates, and the AI (see server/socialAI.ts) only words the title and description from those
 * facts. Any number it writes must be one of the build's own numbers, or its answer is thrown away and a
 * template is used instead. No imports, so the server and the browser can both use this file.
 */

export interface BuildFacts {
  playerName: string;
  note: string | null;
  archetype: string;
  position: string;
  positions: string[];
  ovr: number;
  height: number;
  weight: number;
  pac: number; sho: number; pas: number; dri: number; def: number; phy: number;
  highlights: { attribute: string; value: number }[];
  playstyles: string[];
  signatures: string[];
  specialisation: string | null;
  facilities: string[];
  skillMoves: number;
  weakFoot: number;
  scoutSummary: string;
}

export interface SocialRecord {
  v: 1;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  highlights: { attribute: string; value: number }[];
  scoutReport: string;
  source: 'ai' | 'template';
  generatedAt: string;
  edited: boolean;
}

export const LIMITS = { titleMin: 10, titleMax: 90, descMin: 20, descMax: 240, hashtags: 5, scoutReport: 320 };

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Cut text to at most `max` characters, at the end of a sentence when possible, otherwise at a word */
export function trimToSentence(text: string, max: number): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastEnd >= max * 0.5) return cut.slice(0, lastEnd + 1).trim();
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, '') + '…';
}

/** The facts for one finished player, or null if the build record is incomplete */
export function factsFromItem(item: { playerName: string; note?: string | null; blueprint?: any; build?: any }): BuildFacts | null {
  const b = item.build;
  const v = b?.view;
  const snap = b?.snapshot;
  const f = v?.faceStats;
  if (!b || !v || !snap || !f || !b.archetype || !isNum(v.ovr) || !isNum(snap.height) || !isNum(snap.weight)) return null;
  if (![f.pac, f.sho, f.pas, f.dri, f.def, f.phy].every(isNum)) return null;

  return {
    playerName: String(item.playerName).trim(),
    note: item.note ? String(item.note).trim() : null,
    archetype: String(b.archetype),
    position: String(v.primaryPosition ?? ''),
    positions: Array.isArray(v.positionRatings) ? v.positionRatings.map((p: any) => String(p.pos)) : [],
    ovr: v.ovr,
    height: snap.height,
    weight: snap.weight,
    pac: f.pac, sho: f.sho, pas: f.pas, dri: f.dri, def: f.def, phy: f.phy,
    highlights: (Array.isArray(b.highlights) ? b.highlights : [])
      .filter((h: any) => h && typeof h.attribute === 'string' && isNum(h.value))
      .slice(0, 3)
      .map((h: any) => ({ attribute: h.attribute, value: h.value })),
    playstyles: (Array.isArray(snap.equippedPlaystyles) ? snap.equippedPlaystyles : []).filter(Boolean).map(String),
    signatures: (Array.isArray(b.signatures) ? b.signatures : []).map(String),
    specialisation: snap.equippedSpecialization ? String(snap.equippedSpecialization) : null,
    facilities: Object.entries(snap.equippedFacilities ?? {}).map(([n, t]) => `${n} (tier ${t})`),
    skillMoves: isNum(snap.smLevel) ? snap.smLevel : 0,
    weakFoot: isNum(snap.wfLevel) ? snap.wfLevel : 0,
    scoutSummary: trimToSentence(item.blueprint?.scoutSummary ?? '', 400),
  };
}

const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** "Sergio Busquets" -> "SergioBusquets", "N'Golo Kanté" -> "NGoloKante" */
const pascal = (s: string) =>
  ascii(s).split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');

/** Up to five hashtags, the same set of five every time: #FC27 #ProClubs #<Archetype> #<Player> #ClubsDNA */
export function makeHashtags(facts: Pick<BuildFacts, 'archetype' | 'playerName'>): string[] {
  const tags = ['#FC27', '#ProClubs', `#${pascal(facts.archetype)}`, `#${pascal(facts.playerName)}`, '#ClubsDNA'];
  return normaliseHashtags(tags);
}

/** Clean a list of hashtags: one '#', letters and numbers only, no repeats, at most five */
export function normaliseHashtags(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const word = ascii(String(raw)).replace(/[^A-Za-z0-9]/g, '');
    if (!word) continue;
    const tag = `#${word}`;
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= LIMITS.hashtags) break;
  }
  return out;
}

/** "#a #b, #c" or "a b c" -> clean list (what the editor's hashtag box holds) */
export function parseHashtagInput(text: string): string[] {
  return normaliseHashtags(String(text ?? '').split(/[\s,]+/));
}

/** The caption: title, description, a pointer to the site and the hashtags. Same shape for every post. */
export function buildCaption(title: string, description: string, hashtags: string[]): string {
  return [title.trim(), description.trim(), 'Full build and stats on clubsdna.co.uk', hashtags.join(' ')].filter(Boolean).join('\n\n');
}

/** Wording used when the AI is not used (or its answer was not acceptable) */
export function templateCopy(facts: BuildFacts): { title: string; description: string } {
  const [a, b, c] = facts.highlights;
  const stand = [a, b, c].filter(Boolean).map(h => `${h.attribute} ${h.value}`);
  const standText = stand.length === 3 ? `${stand[0]}, ${stand[1]} and ${stand[2]}` : stand.join(' and ');
  const title = trimToSentence(`${facts.playerName}: the FC27 Pro Clubs ${facts.archetype} build`, LIMITS.titleMax);
  const description = trimToSentence(
    `${facts.position ? facts.position + ' ' : ''}${facts.archetype} at ${facts.height}cm and ${facts.weight}kg, ${facts.ovr} OVR.` +
      (standText ? ` Standout attributes: ${standText}.` : ''),
    LIMITS.descMax
  );
  return { title, description };
}

/** Every number the AI is allowed to write: the build's own numbers (plus 55 and 27 for level and game) */
export function allowedNumbers(facts: BuildFacts): Set<number> {
  const s = new Set<number>([55, 27, facts.ovr, facts.height, facts.weight, facts.pac, facts.sho, facts.pas, facts.dri, facts.def, facts.phy]);
  facts.highlights.forEach(h => s.add(h.value));
  if (facts.skillMoves) s.add(facts.skillMoves);
  if (facts.weakFoot) s.add(facts.weakFoot);
  return s;
}

/** Numbers in `text` that are not in the build */
export function findBadNumbers(text: string, allowed: Set<number>): number[] {
  const found = String(text ?? '').match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.map(Number))].filter(n => !allowed.has(n));
}

export function validateCopy(copy: { title: unknown; description: unknown }, facts: BuildFacts): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const title = typeof copy.title === 'string' ? copy.title.trim() : '';
  const description = typeof copy.description === 'string' ? copy.description.trim() : '';
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) problems.push(`the title must be ${LIMITS.titleMin}-${LIMITS.titleMax} characters`);
  if (description.length < LIMITS.descMin || description.length > LIMITS.descMax) problems.push(`the description must be ${LIMITS.descMin}-${LIMITS.descMax} characters`);
  if (/[#@\n]/.test(title)) problems.push('the title must be one line with no # or @');
  if (/[#@]/.test(description)) problems.push('the description must not contain # or @');
  const bad = findBadNumbers(`${title} ${description}`, allowedNumbers(facts));
  if (bad.length) problems.push(`these numbers are not in the build: ${bad.join(', ')}`);
  return { ok: problems.length === 0, problems };
}

/** The AI's answer ({"title": "...", "description": "..."}, possibly inside a code fence) or null */
export function parseCopyJson(raw: unknown): { title: string; description: string } | null {
  if (typeof raw !== 'string') return null;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const o = JSON.parse(cleaned);
    if (typeof o?.title !== 'string' || typeof o?.description !== 'string') return null;
    return { title: o.title.trim(), description: o.description.trim() };
  } catch {
    return null;
  }
}

/** The prompt for the AI: the facts and the rules, nothing else to draw on */
export function copyPrompt(facts: BuildFacts, retryHint?: string): { system: string; user: string } {
  const system = `You write short, punchy TikTok copy for FC 27 Pro Clubs player builds. You are given the facts of ONE finished build. Use ONLY those facts: do not invent stats, clubs, trophies, transfers or anything else.

Return ONLY raw JSON: {"title": "...", "description": "..."}
- title: ${LIMITS.titleMin}-${LIMITS.titleMax} characters, one line, an engaging hook that names the player. At most one emoji. No hashtags.
- description: 1-2 sentences, ${LIMITS.descMin}-${LIMITS.descMax} characters, about what makes this build stand out. No hashtags.
- Any number you write must be one of the numbers in the facts. If unsure, leave numbers out.`;

  const lines = [
    `Player: ${facts.playerName}${facts.note ? ` (${facts.note})` : ''}`,
    `Archetype: ${facts.archetype}`,
    `Position: ${facts.position}${facts.positions.length > 1 ? ` (also ${facts.positions.slice(1).join(', ')})` : ''}`,
    `Overall: ${facts.ovr}`,
    `Height and weight: ${facts.height}cm, ${facts.weight}kg`,
    `Face stats: PAC ${facts.pac}, SHO ${facts.sho}, PAS ${facts.pas}, DRI ${facts.dri}, DEF ${facts.def}, PHY ${facts.phy}`,
    `Standout attributes: ${facts.highlights.map(h => `${h.attribute} ${h.value}`).join(', ') || 'none'}`,
    `Skill moves ${facts.skillMoves} star, weak foot ${facts.weakFoot} star`,
    `Signature PlayStyles: ${facts.signatures.join(', ') || 'none'}`,
    `PlayStyles equipped: ${facts.playstyles.join(', ') || 'none'}`,
    `Specialisation: ${facts.specialisation ?? 'none'}`,
    `Scout report: ${facts.scoutSummary || 'n/a'}`,
  ];
  const user = lines.join('\n') + (retryHint ? `\n\nYour last answer was rejected: ${retryHint}. Fix this and answer again.` : '');
  return { system, user };
}

/** The full record that is saved for a player */
export function composeSocial(
  facts: BuildFacts,
  copy: { title: string; description: string },
  source: 'ai' | 'template',
  now: Date = new Date()
): SocialRecord {
  const hashtags = makeHashtags(facts);
  return {
    v: 1,
    title: copy.title,
    description: copy.description,
    caption: buildCaption(copy.title, copy.description, hashtags),
    hashtags,
    highlights: facts.highlights,
    scoutReport: trimToSentence(facts.scoutSummary, LIMITS.scoutReport),
    source,
    generatedAt: now.toISOString(),
    edited: false,
  };
}
