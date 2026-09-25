import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR_26 = path.join(__dirname, "data");
const DATA_DIR_27 = path.join(__dirname, "data27");

function parseCSV(dir: string, filename: string): Record<string, string>[] {
  try {
    const fullPath = path.join(dir, filename);
    let content = fs.readFileSync(fullPath, "utf-8");
    
    // 👉 FIX 1: Automatically strip invisible BOM characters added by Excel
    content = content.replace(/^\uFEFF/, "");
    
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        // Lowercase the header so we don't miss "Archetype" vs "archetype"
        row[h.trim().toLowerCase()] = (values[i] ?? "").trim();
      });
      return row;
    });
  } catch (e) {
    // 👉 FIX 2: Loudly log exact missing filenames to your terminal
    console.error(`\n🚨 DATA ERROR: Failed to load "${filename}" from the "${dir}" folder.`);
    console.error(`🚨 Make sure the file exists and is spelled exactly as shown above!\n`);
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

// ── Load FC27 Data & Map Headers to Match FC26 Structure ──────────────────────

const rawArch27 = parseCSV(DATA_DIR_27, "FC27_ARCHETYPES.csv");
export const ARCHETYPE_PROFILES_27: ArchetypeProfile[] = rawArch27.map(r => ({
  Archetype: r.archetype || "",
  MinH: r.minheight || r.minh || "",
  MaxH: r.maxheight || r.maxh || "",
  MinW: r.minweight || r.minw || "",
  MaxW: r.maxweight || r.maxw || "",
  Signature_PlayStyles: r.signature_playstyles || r.signatureplaystyles || "",
  Recommended_Positions: r.recommended_positions || r.recommendedpositions || "",
  Key_Attributes: r.key_attributes || r.keyattributes || "",
  Specialisations: r.specialisation_name || r.specialisations || "",
}));

export const SPECIALISATIONS_27: Specialisation[] = rawArch27.map(r => ({
  Archetype: r.archetype || "",
  Specialisation: r.specialisation_name || r.specialisation || "",
  "Playstyle+": r.spec_bonus_playstyleplus || r["playstyle+"] || "",
  Attr1: r.spec_req_attr1 || r.attr1 || "",
  Val1: r.spec_req_val1 || r.val1 || "",
  Attr2: r.spec_req_attr2 || r.attr2 || "",
  Val2: r.spec_req_val2 || r.val2 || "",
  Attr3: r.spec_req_attr3 || r.attr3 || "",
  Val3: r.spec_req_val3 || r.val3 || "",
})).filter(s => s.Specialisation);

const rawPlaystyles27 = parseCSV(DATA_DIR_27, "FC27_PLAYSTYLES.csv");
export const PLAYSTYLES_27: PlaystyleReq[] = rawPlaystyles27.map(r => ({
  Playstyle: r.playstyle || "",
  Attr1: r.req_attr1 || r.attr1 || "",
  Val1: r.req_val1 || r.val1 || "",
  Attr2: r.req_attr2 || r.attr2 || "",
  Val2: r.req_val2 || r.val2 || "",
  Attr3: r.req_attr3 || r.attr3 || "",
  Val3: r.req_val3 || r.val3 || "",
}));

export const PLAYSTYLE_INFO_27: PlaystyleInfo[] = rawPlaystyles27.map(r => ({
  Name: r.playstyle || r.name || "",
  Info: r.description || r.info || "",
  Playstyle: r.playstyle || "",
  "Playstyle+": r.playstyleplus_name || r["playstyle+"] || ""
}));

const rawBase27 = parseCSV(DATA_DIR_27, "FC27_BASE_STATS.csv");
export const ALL_ARCHETYPES_27: ArchetypeAttribute[] = rawBase27.map(r => ({
  Archetype: r.archetype || "",
  Attribute: r.attribute || "",
  "Base Value": r["base value"] || r.basevalue || r.base || "0",
  "Max Value": r["max value"] || r.maxvalue || r.max || "99",
}));

const rawCosts27 = parseCSV(DATA_DIR_27, "FC27_UPGRADE_COSTS.csv");
export const MASTER_COST_DATA_27: CostRow[] = rawCosts27.map(r => ({
  Archetype: r.archetype || "",
  Attribute: r.attribute || "",
  Level: r.level || r.lvl || "0",
  Cost: r.cost || r.ap || "0",
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

// ── Legacy Exports (To prevent breaking old code) ────────────────────────────
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
