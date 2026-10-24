/**
 * The archetype CSVs store signature playstyles without spaces ("LowDrivenShot", "AerialFortress").
 * The app (and its icon file names) use readable names ("Low Driven Shot", "Aerial Fortress").
 */
const ALIASES: Record<string, string> = {
  gamechanger: "Game Changer",
};

export function prettyPlaystyleName(raw: string): string {
  const t = (raw ?? "").replace(/\+/g, "").trim();
  if (!t) return "";
  const alias = ALIASES[t.toLowerCase().replace(/[^a-z]/g, "")];
  if (alias) return alias;
  if (/\s/.test(t)) return t; // already readable
  return t
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")   // LowDrivenShot -> Low Driven Shot
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"); // GKFarReach -> GK Far Reach
}

/** The signature playstyles of an archetype, in order. FC27 gives every archetype 2. */
export function parseSignatures(csvValue: string | undefined | null, count = 2): string[] {
  return (csvValue ?? "")
    .split(",")
    .map(prettyPlaystyleName)
    .filter(Boolean)
    .slice(0, count);
}
