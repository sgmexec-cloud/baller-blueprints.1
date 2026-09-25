import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR_26 = path.join(__dirname, "data");
const DATA_DIR_27 = path.join(__dirname, "data27");

function parseCSV(dir: string, filename: string): Record<string, string>[] {
  try {
    const content = fs.readFileSync(path.join(dir, filename), "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h.trim()] = (values[i] ?? "").trim();
      });
      return row;
    });
  } catch (e) {
    console.error(`Failed to load ${filename} from ${dir}`);
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

// ── Load FC26 Data ────────────────────────────────────────────────────────────

export const ARCHETYPE_PROFILES_26 = parseCSV(DATA_DIR_26, "ARCHETYPE_PROFILE.csv") as unknown as ArchetypeProfile[];
export const PLAYSTYLE_INFO_26 = parseCSV(DATA_DIR_26, "PLAYSTYLE_INFO.csv") as unknown as PlaystyleInfo[];
export const PLAYSTYLES_26 = parseCSV(DATA_DIR_26, "PLAYSTYLES.csv") as unknown as PlaystyleReq[];
export const SPECIALISATIONS_26 = parseCSV(DATA_DIR_26, "SPECIALISATIONS.csv") as unknown as Specialisation[];
export const ALL_ARCHETYPES_26 = parseCSV(DATA_DIR_26, "ALL_ARCHETYPES.csv") as unknown as ArchetypeAttribute[];
export const MASTER_COST_DATA_26 = parseCSV(DATA_DIR_26, "MASTER_COST_DATA.csv") as unknown as CostRow[];

// ── Load FC27 Data with Flexible Header Mapping ────────────────────────────────

const rawArch27 = parseCSV(DATA_DIR_27, "FC27_ARCHETYPES.csv");
export const ARCHETYPE_PROFILES_27: ArchetypeProfile[] = rawArch27.map(r => ({
  Archetype: r.Archetype || r.archetype || "",
  MinH: r.MinHeight || r.MinH || "",
  MaxH: r.MaxHeight || r.MaxH || "",
  MinW: r.MinWeight || r.MinW || "",
  MaxW: r.MaxWeight || r.MaxW || "",
  Signature_PlayStyles: r.Signature_PlayStyles || r.SignaturePlaystyles || r.Signatures || "",
  Recommended_Positions: r.Recommended_Positions || r.RecommendedPositions || "",
  Key_Attributes: r.Key_Attributes || r.KeyAttributes || "",
  Specialisations: r.Specialisation_Name || r.Specialisations || "",
}));

export const SPECIALISATIONS_27: Specialisation[] = rawArch27.map(r => ({
  Archetype: r.Archetype || r.archetype || "",
  Specialisation: r.Specialisation_Name || r.Specialisation || "",
  "Playstyle+": r.Spec_Bonus_PlaystylePlus || r["Playstyle+"] || "",
  Attr1: r.Spec_Req_Attr1 || r.Attr1 || "",
  Val1: r.Spec_Req_Val1 || r.Val1 || "",
  Attr2: r.Spec_Req_Attr2 || r.Attr2 || "",
  Val2: r.Spec_Req_Val2 || r.Val2 || "",
  Attr3: r.Spec_Req_Attr3 || r.Attr3 || "",
  Val3: r.Spec_Req_Val3 || r.Val3 || "",
})).filter(s => s.Specialisation);

const rawPlaystyles27 = parseCSV(DATA_DIR_27, "FC27_PLAYSTYLES.csv");
export const PLAYSTYLES_27: PlaystyleReq[] = rawPlaystyles27.map(r => ({
  Playstyle: r.Playstyle || r.playstyle || "",
  Attr1: r.Req_Attr1 || r.Attr1 || "",
  Val1: r.Req_Val1 || r.Val1 || "",
  Attr2: r.Req_Attr2 || r.Attr2 || "",
  Val2: r.Req_Val2 || r.Val2 || "",
  Attr3: r.Req_Attr3 || r.Attr3 || "",
  Val3: r.Req_Val3 || r.Val3 || "",
}));

export const PLAYSTYLE_INFO_27: PlaystyleInfo[] = rawPlaystyles27.map(r => ({
  Name: r.Playstyle || r.Name || "",
  Info: r.Description || r.Info || "",
  Playstyle: r.Playstyle || "",
  "Playstyle+": r.PlaystylePlus_Name || r["Playstyle+"] || ""
}));

const rawBase27 = parseCSV(DATA_DIR_27, "FC27_BASE_STATS.csv");
export const ALL_ARCHETYPES_27: ArchetypeAttribute[] = rawBase27.map(r => ({
  Archetype: r.Archetype || r.archetype || "",
  Attribute: r.Attribute || r.attribute || "",
  "Base Value": r["Base Value"] || r.BaseValue || r.Base || r.base || "0",
  "Max Value": r["Max Value"] || r.MaxValue || r.Max || r.max || "99",
}));

const rawCosts27 = parseCSV(DATA_DIR_27, "FC27_UPGRADE_COSTS.csv");
export const MASTER_COST_DATA_27: CostRow[] = rawCosts27.map(r => ({
  Archetype: r.Archetype || r.archetype || "",
  Attribute: r.Attribute || r.attribute || "",
  Level: r.Level || r.level || r.Lvl || "0",
  Cost: r.Cost || r.cost || r.AP || r.ap || "0",
}));

// ── Dynamic Getters for the Math Engine ───────────────────────────────────────

export function getArchetypeProfiles(version: "FC26" | "FC27" = "FC26"): ArchetypeProfile[] {
  return version === "FC27" ? ARCHETYPE_PROFILES_27 : ARCHETYPE_PROFILES_26;
}

export function getPlaystyles(version: "FC26" | "FC27" = "FC26"): PlaystyleReq[] {
  return version === "FC27" ? PLAYSTYLES_27 : PLAYSTYLES_26;
}

export function getSpecialisations(version: "FC26" | "FC27" = "FC26"): Specialisation[] {
  return version === "FC27" ? SPECIALISATIONS_27 : SPECIALISATIONS_26;
}

export function getAllArchetypes(version: "FC26" | "FC27" = "FC26"): ArchetypeAttribute[] {
  return version === "FC27" ? ALL_ARCHETYPES_27 : ALL_ARCHETYPES_26;
}

// ── Pre-built cost dictionaries ───────────────────────────────────────────────

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

export const COST_DICT_26: CostDict = buildCostDict(MASTER_COST_DATA_26);
export const COST_DICT_27: CostDict = buildCostDict(MASTER_COST_DATA_27);

export function getCostDict(version: "FC26" | "FC27" = "FC26"): CostDict {
  return version === "FC27" ? COST_DICT_27 : COST_DICT_26;
}

// ── Helper: normalise attribute name for lookup ───────────────────────────────
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

export function getScoutingContext(): string {
  const archetypes = ARCHETYPE_PROFILES_26.map((a) => ({
    archetype: a.Archetype,
    heightRange: `${a.MinH}–${a.MaxH} cm`,
    weightRange: `${a.MinW}–${a.MaxW} kg`,
    signaturePlaystyles: a.Signature_PlayStyles,
    recommendedPositions: a.Recommended_Positions,
    keyAttributes: a.Key_Attributes,
    specialisations: a.Specialisations,
  }));

  const playstyleReqs = PLAYSTYLES_26.map((p) => {
    const reqs: string[] = [];
    if (p.Attr1 && p.Val1) reqs.push(`${p.Attr1} ≥ ${p.Val1}`);
    if (p.Attr2 && p.Val2) reqs.push(`${p.Attr2} ≥ ${p.Val2}`);
    if (p.Attr3 && p.Val3) reqs.push(`${p.Attr3} ≥ ${p.Val3}`);
    return { playstyle: p.Playstyle, requirements: reqs };
  });

  const specialisations = SPECIALISATIONS_26.map((s) => ({
    archetype: s.Archetype,
    specialisation: s.Specialisation,
    bonusPlaystylePlus: s["Playstyle+"],
    minimumAttributes: [
      s.Attr1 && s.Val1 ? `${s.Attr1} ≥ ${s.Val1}` : null,
      s.Attr2 && s.Val2 ? `${s.Attr2} ≥ ${s.Val2}` : null,
      s.Attr3 && s.Val3 ? `${s.Attr3} ≥ ${s.Val3}` : null,
    ].filter(Boolean),
  }));

  const playstyleInfo = PLAYSTYLE_INFO_26.map((p) => ({
    name: p.Name,
    description: p.Info,
  }));

  return JSON.stringify({ archetypes, playstyleReqs, specialisations, playstyleInfo }, null, 2);
}
