const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const RAW_ROLE_MAP: Record<string, string[]> = {
  // Defenders
  "Defender":              ["CB"],
  "Stopper":               ["CB"],
  "Centre-Half":           ["CB"],
  "Ball-Playing Defender": ["CB"],
  "Fullback":              ["LB"],
  "Falseback":             ["LB", "CDM"],
  "Wingback":              ["LB", "LM"],
  "Attacking Wingback":    ["LM", "LB"],

  // Midfield
  "Holding":               ["CDM"],
  "Deep-Lying Playmaker":  ["CDM", "CM"],
  "Box-to-Box":            ["CM"],
  "Playmaker":             ["CM", "CAM"],
  "Half-Winger":           ["LM", "CM"],
  "Wide Half":             ["CM", "LM"],
  "Wide Midfielder":       ["LM"],
  "Wide Playmaker":        ["LM", "CAM"],
  "Classic 10":            ["CAM"],

  // Attack
  "Winger":                ["LW"],
  "Inside Forward":        ["LW"],
  "Shadow Striker":        ["CAM", "ST"],
  "False 9":               ["ST", "CAM"],
  "Advanced Forward":      ["ST"],
  "Poacher":               ["ST"],
  "Target Forward":        ["ST"],
};

const ROLE_MAP: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_ROLE_MAP).map(([k, v]) => [norm(k), v])
);

// Left-sided code -> right-sided mirror (same OVR formula)
const MIRROR: Record<string, string> = { LB: "RB", LM: "RM", LW: "RW", LF: "RF" };

const VALID_POSITIONS = new Set([
  "GK","SW","LS","ST","RS","LW","LF","RF","RW","LAM","CAM","RAM",
  "LM","LCM","CM","RCM","RM","LDM","CDM","RDM","LB","LCB","CB","RCB","RB",
]);

export function rolesToPositions(csvValue: string | undefined | null): string[] {
  const out: string[] = [];
  const add = (c: string) => { if (!out.includes(c)) out.push(c); };

  for (const raw of (csvValue ?? "").split(",")) {
    const token = raw.trim();
    if (!token) continue;
    const codes = ROLE_MAP[norm(token)] ?? (VALID_POSITIONS.has(token.toUpperCase()) ? [token.toUpperCase()] : []);
    for (const c of codes) {
      add(c);
      if (MIRROR[c]) add(MIRROR[c]);
    }
  }
  return out.length ? out : ["ST"];
}