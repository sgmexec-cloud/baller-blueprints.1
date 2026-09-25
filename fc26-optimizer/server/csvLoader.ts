import fs from "fs";
import path from "path";

// Use process.cwd() to force the server to look in the root source folders
const DATA_DIR_26 = path.join(process.cwd(), "server", "data");
const DATA_DIR_27 = path.join(process.cwd(), "server", "data27");

function parseCSV(dir: string, filename: string): Record<string, string>[] {
  try {
    const fullPath = path.join(dir, filename);
    if (!fs.existsSync(fullPath)) {
      console.error(`🚨 ERROR: File not found -> ${fullPath}`);
      return [];
    }

    let content = fs.readFileSync(fullPath, "utf-8");
    content = content.replace(/^\uFEFF/, ""); // Strip invisible Excel characters
    
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0]);
    
    if (dir.includes("data27")) {
       console.log(`[FC27 DATA] ${filename} Headers:`, headers);
    }

    return lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        // Map everything to lowercase for bulletproof lookups
        row[h.trim().toLowerCase()] = (values[i] ?? "").trim();
      });
      return row;
    });
  } catch (e) {
    console.error(`🚨 FAILED to parse ${filename}:`, e);
    return [];
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Typed interfaces ──────────────────────────────────────────────────────────

export interface ArchetypeProfile {
  Archetype: string;
  MinH: string;
  MaxH: string;
  MinW: string;
  MaxW: string;
  Signature_PlayStyles: string;
  Recommended_Positions: string;
  Key_Attributes: string;
  Specialisations: string;
}

export interface PlaystyleInfo {
  Name: string;
  Info: string;
  Playstyle: string;
  "Playstyle+": string;
}

export interface PlaystyleReq {
  Playstyle: string;
  Attr1: string;
  Val1: string;
  Attr2: string;
  Val2: string;
  Attr3: string;
  Val3: string;
}

export interface Specialisation {
  Archetype: string;
  Specialisation: string;
  "Playstyle+": string;
  Attr1: string;
  Val1: string;
  Attr2: string;
  Val2: string;
  Attr3: string;
  Val3: string;
}

export interface ArchetypeAttribute {
  Archetype: string;
  Attribute: string;
  "Base Value": string;
  "Max Value": string;
}

export interface CostRow {
  Archetype: string;
  Attribute: string;
  Level: string;
  Cost: string;
}

export type CostDict = Record<string, Record<string, Record<number, number>>>;

function buildCostDict(data: CostRow[]): CostDict {
  const dict: CostDict = {};
  for (const row of data) {
    if (!row.Archetype || !row.Attribute || !row.Level || !row.Cost) continue;
    const arch = row.Archetype.trim().toLowerCase();
    const attr = row.Attribute.trim().toLowerCase().replace(/\s+/g, "");
    const level = parseInt(row.Level, 10);
    const cost = parseInt(row.Cost, 10);
    if (isNaN(level) || isNaN(cost)) continue;
    if (!dict[arch]) dict[arch] = {};
    if (!dict[arch][attr]) dict[arch][attr] = {};
    dict[arch][attr][level] = cost;
  }
  return dict;
}

// ── Load FC26 Data (Static) ───────────────────────────────────────────────────

const rawArch26 = parseCSV(DATA_DIR_26, "ARCHETYPE_PROFILE.csv");
export const ARCHETYPE_PROFILES_26: ArchetypeProfile[] = rawArch26.map(r => ({
  Archetype: r.archetype || "",
  MinH: r.minh || "",
  MaxH: r.maxh || "",
  MinW: r.minw || "",
  MaxW: r.maxw || "",
  Signature_PlayStyles: r.signature_playstyles || "",
  Recommended_Positions: r.recommended_positions || "",
  Key_Attributes: r.key_attributes || "",
  Specialisations: r.specialisations || "",
}));

const rawInfo26 = parseCSV(DATA_DIR_26, "PLAYSTYLE_INFO.csv");
export const PLAYSTYLE_INFO_26: PlaystyleInfo[] = rawInfo26.map(r => ({
  Name: r.name || "",
  Info: r.info || "",
  Playstyle: r.playstyle || "",
  "Playstyle+": r["playstyle+"] || ""
}));

const rawPlaystyles26 = parseCSV(DATA_DIR_26, "PLAYSTYLES.csv");
export const PLAYSTYLES_26: PlaystyleReq[] = rawPlaystyles26.map(r => ({
  Playstyle: r.playstyle || "",
  Attr1: r.attr1 || "",
  Val1: r.val1 || "",
  Attr2: r.attr2 || "",
  Val2: r.val2 || "",
  Attr3: r.attr3 || "",
  Val3: r.val3 || "",
}));

const rawSpec26 = parseCSV(DATA_DIR_26, "SPECIALISATIONS.csv");
export const SPECIALISATIONS_26: Specialisation[] = rawSpec26.map(r => ({
  Archetype: r.archetype || "",
  Specialisation: r.specialisation || "",
  "Playstyle+": r["playstyle+"] || "",
  Attr1: r.attr1 || "",
  Val1: r.val1 || "",
  Attr2: r.attr2 || "",
  Val2: r.val2 || "",
  Attr3: r.attr3 || "",
  Val3: r.val3 || "",
}));

const rawBase26 = parseCSV(DATA_DIR_26, "ALL_ARCHETYPES.csv");
export const ALL_ARCHETYPES_26: ArchetypeAttribute[] = rawBase26.map(r => ({
  Archetype: r.archetype || "",
  Attribute: r.attribute || "",
  "Base Value": r["base value"] || "0",
  "Max Value": r["max value"] || "99",
}));

const rawCosts26 = parseCSV(DATA_DIR_26, "MASTER_COST_DATA.csv");
export const MASTER_COST_DATA_26: CostRow[] = rawCosts26.map(r => ({
  Archetype: r.archetype || "",
  Attribute: r.attribute || "",
  Level: r.level || "0",
  Cost: r.cost || "0",
}));

export const COST_DICT_26: CostDict = buildCostDict(MASTER_COST_DATA_26);

// ── FC27 Dynamic (JIT) Loader ─────────────────────────────────────────────────

let FC27_CACHE: {
  profiles: ArchetypeProfile[];
  specialisations: Specialisation[];
  playstyles: PlaystyleReq[];
  playstyleInfo: PlaystyleInfo[];
  baseStats: ArchetypeAttribute[];
  costs: CostRow[];
  costDict: CostDict;
} | null = null;

function loadFC27Data() {
  if (FC27_CACHE) return FC27_CACHE;
  
  const rawArch27 = parseCSV(DATA_DIR_27, "FC27_ARCHETYPES.csv");
  const profiles: ArchetypeProfile[] = rawArch27.map(r => ({
    Archetype: r.archetype || r.build || r.name || "",
    MinH: r.minheight || r.minh || "",
    MaxH: r.maxheight || r.maxh || "",
    MinW: r.minweight || r.minw || "",
    MaxW: r.maxweight || r.maxw || "",
    Signature_PlayStyles: r["signature playstyles"] || r.signature_playstyles || r.signatureplaystyles || r.signatures || "",
    Recommended_Positions: r["recommended positions"] || r.recommended_positions || r.recommendedpositions || r.positions || "",
    Key_Attributes: r["key attributes"] || r.key_attributes || r.keyattributes || "",
    Specialisations: r["specialisation name"] || r.specialisation_name || r.specialisations || "",
  }));

  const specialisations: Specialisation[] = rawArch27.map(r => ({
    Archetype: r.archetype || r.build || r.name || "",
    Specialisation: r["specialisation name"] || r.specialisation_name || r.specialisation || "",
    "Playstyle+": r["spec bonus playstyleplus"] || r.spec_bonus_playstyleplus || r["playstyle+"] || "",
    Attr1: r["spec req attr1"] || r.spec_req_attr1 || r.attr1 || "",
    Val1: r["spec req val1"] || r.spec_req_val1 || r.val1 || "",
    Attr2: r["spec req attr2"] || r.spec_req_attr2 || r.attr2 || "",
    Val2: r["spec req val2"] || r.spec_req_val2 || r.val2 || "",
    Attr3: r["spec req attr3"] || r.spec_req_attr3 || r.attr3 || "",
    Val3: r["spec req val3"] || r.spec_req_val3 || r.val3 || "",
  })).filter(s => s.Specialisation);

  const rawPlaystyles27 = parseCSV(DATA_DIR_27, "FC27_PLAYSTYLES.csv");
  const playstyles: PlaystyleReq[] = rawPlaystyles27.map(r => ({
    Playstyle: r.playstyle || "",
    Attr1: r.req_attr1 || r["req attr1"] || r.attr1 || "",
    Val1: r.req_val1 || r["req val1"] || r.val1 || "",
    Attr2: r.req_attr2 || r["req attr2"] || r.attr2 || "",
    Val2: r.req_val2 || r["req val2"] || r.val2 || "",
    Attr3: r.req_attr3 || r["req attr3"] || r.attr3 || "",
    Val3: r.req_val3 || r["req val3"] || r.val3 || "",
  }));

  const playstyleInfo: PlaystyleInfo[] = rawPlaystyles27.map(r => ({
    Name: r.playstyle || r.name || "",
    Info: r.description || r.info || "",
    Playstyle: r.playstyle || "",
    "Playstyle+": r.playstyleplus_name || r["playstyleplus name"] || r["playstyle+"] || ""
  }));

  const rawBase27 = parseCSV(DATA_DIR_27, "FC27_BASE_STATS.csv");
  const baseStats: ArchetypeAttribute[] = rawBase27.map(r => ({
    Archetype: r.archetype || r.build || r.name || "",
    Attribute: r.attribute || r.stat || "",
    "Base Value": r["base value"] || r.basevalue || r.base || "0",
    "Max Value": r["max value"] || r.maxvalue || r.max || "99",
  }));

  const rawCosts27 = parseCSV(DATA_DIR_27, "FC27_UPGRADE_COSTS.csv");
  const costs: CostRow[] = rawCosts27.map(r => ({
    Archetype: r.archetype || r.build || r.name || "",
    Attribute: r.attribute || r.stat || "",
    Level: r.level || r.lvl || "0",
    Cost: r.cost || r.ap || "0",
  }));

  const costDict = buildCostDict(costs);

  FC27_CACHE = { profiles, specialisations, playstyles, playstyleInfo, baseStats, costs, costDict };  
  return FC27_CACHE;
}

// ── Dynamic Getters for the Math Engine ───────────────────────────────────────

export function getArchetypeProfiles(version: "FC26" | "FC27" = "FC26"): ArchetypeProfile[] {
  return version === "FC27" ? loadFC27Data().profiles : ARCHETYPE_PROFILES_26;
}

export function getPlaystyles(version: "FC26" | "FC27" = "FC26"): PlaystyleReq[] {
  return version === "FC27" ? loadFC27Data().playstyles : PLAYSTYLES_26;
}

export function getSpecialisations(version: "FC26" | "FC27" = "FC26"): Specialisation[] {
  return version === "FC27" ? loadFC27Data().specialisations : SPECIALISATIONS_26;
}

export function getAllArchetypes(version: "FC26" | "FC27" = "FC26"): ArchetypeAttribute[] {
  return version === "FC27" ? loadFC27Data().baseStats : ALL_ARCHETYPES_26;
}

export function getCostDict(version: "FC26" | "FC27" = "FC26"): CostDict {
  return version === "FC27" ? loadFC27Data().costDict : COST_DICT_26;
}

export function getPlaystyleInfo(version: "FC26" | "FC27" = "FC26"): PlaystyleInfo[] {
  return version === "FC27" ? loadFC27Data().playstyleInfo : PLAYSTYLE_INFO_26;
}

export function normAttr(attr: string): string {
  return attr.trim().toLowerCase().replace(/\s+/g, "");
}

// ── Legacy Exports ────────────────────────────────────────────────────────────
export const ARCHETYPE_PROFILES = ARCHETYPE_PROFILES_26;
export const PLAYSTYLE_INFO = PLAYSTYLE_INFO_26;
export const PLAYSTYLES = PLAYSTYLES_26;
export const SPECIALISATIONS = SPECIALISATIONS_26;
export const ALL_ARCHETYPES = ALL_ARCHETYPES_26;
export const MASTER_COST_DATA = MASTER_COST_DATA_26;
export const COST_DICT = COST_DICT_26;

export function getScoutingContext(version: "FC26" | "FC27" = "FC26"): string {
  const archetypes = getArchetypeProfiles(version).map((a) => ({
    archetype: a.Archetype,
    heightRange: `${a.MinH}–${a.MaxH} cm`,
    weightRange: `${a.MinW}–${a.MaxW} kg`,
    signaturePlaystyles: a.Signature_PlayStyles,
    recommendedPositions: a.Recommended_Positions,
    keyAttributes: a.Key_Attributes,
    specialisations: a.Specialisations,
  }));

  const playstyleReqs = getPlaystyles(version).map((p) => {
    const reqs: string[] = [];
    if (p.Attr1 && p.Val1) reqs.push(`${p.Attr1} ≥ ${p.Val1}`);
    if (p.Attr2 && p.Val2) reqs.push(`${p.Attr2} ≥ ${p.Val2}`);
    if (p.Attr3 && p.Val3) reqs.push(`${p.Attr3} ≥ ${p.Val3}`);
    return { playstyle: p.Playstyle, requirements: reqs };
  });

  const specialisations = getSpecialisations(version).map((s) => ({
    archetype: s.Archetype,
    specialisation: s.Specialisation,
    bonusPlaystylePlus: s["Playstyle+"],
    minimumAttributes: [
      s.Attr1 && s.Val1 ? `${s.Attr1} ≥ ${s.Val1}` : null,
      s.Attr2 && s.Val2 ? `${s.Attr2} ≥ ${s.Val2}` : null,
      s.Attr3 && s.Val3 ? `${s.Attr3} ≥ ${s.Val3}` : null,
    ].filter(Boolean),
  }));

  const playstyleInfo = getPlaystyleInfo(version).map((p) => ({
    name: p.Name,
    description: p.Info,
  }));

  return JSON.stringify({ archetypes, playstyleReqs, specialisations, playstyleInfo }, null, 2);
}
