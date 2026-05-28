import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

function parseCSV(filename: string): Record<string, string>[] {
  const content = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
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
  Base_Playstyle_Plus: string;
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

// ── Loaded data ───────────────────────────────────────────────────────────────

export const ARCHETYPE_PROFILES = parseCSV("ARCHETYPE_PROFILE.csv") as unknown as ArchetypeProfile[];
export const PLAYSTYLE_INFO = parseCSV("PLAYSTYLE_INFO.csv") as unknown as PlaystyleInfo[];
export const PLAYSTYLES = parseCSV("PLAYSTYLES.csv") as unknown as PlaystyleReq[];
export const SPECIALISATIONS = parseCSV("SPECIALISATIONS.csv") as unknown as Specialisation[];
export const ALL_ARCHETYPES = parseCSV("ALL_ARCHETYPES.csv") as unknown as ArchetypeAttribute[];
export const MASTER_COST_DATA = parseCSV("MASTER_COST_DATA.csv") as unknown as CostRow[];

// ── Pre-built cost dictionary: cost_dict[ARCHETYPE][attribute][level] = cost ──

export type CostDict = Record<string, Record<string, Record<number, number>>>;

function buildCostDict(): CostDict {
  const dict: CostDict = {};
  for (const row of MASTER_COST_DATA) {
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

export const COST_DICT: CostDict = buildCostDict();

// ── Helper: normalise attribute name for lookup ───────────────────────────────
export function normAttr(attr: string): string {
  return attr.trim().toLowerCase().replace(/\s+/g, "");
}

// ── Serialisable summaries for LLM context ────────────────────────────────────

export function getScoutingContext(): string {
  const archetypes = ARCHETYPE_PROFILES.map((a) => ({
    archetype: a.Archetype,
    heightRange: `${a.MinH}–${a.MaxH} cm`,
    weightRange: `${a.MinW}–${a.MaxW} kg`,
    basePlaystylePlus: a.Base_Playstyle_Plus,
    recommendedPositions: a.Recommended_Positions,
    keyAttributes: a.Key_Attributes,
    specialisations: a.Specialisations,
  }));

  const playstyleReqs = PLAYSTYLES.map((p) => {
    const reqs: string[] = [];
    if (p.Attr1 && p.Val1) reqs.push(`${p.Attr1} ≥ ${p.Val1}`);
    if (p.Attr2 && p.Val2) reqs.push(`${p.Attr2} ≥ ${p.Val2}`);
    if (p.Attr3 && p.Val3) reqs.push(`${p.Attr3} ≥ ${p.Val3}`);
    return { playstyle: p.Playstyle, requirements: reqs };
  });

  const specialisations = SPECIALISATIONS.map((s) => ({
    archetype: s.Archetype,
    specialisation: s.Specialisation,
    bonusPlaystylePlus: s["Playstyle+"],
    minimumAttributes: [
      s.Attr1 && s.Val1 ? `${s.Attr1} ≥ ${s.Val1}` : null,
      s.Attr2 && s.Val2 ? `${s.Attr2} ≥ ${s.Val2}` : null,
      s.Attr3 && s.Val3 ? `${s.Attr3} ≥ ${s.Val3}` : null,
    ].filter(Boolean),
  }));

  const playstyleInfo = PLAYSTYLE_INFO.map((p) => ({
    name: p.Name,
    description: p.Info,
  }));

  return JSON.stringify({ archetypes, playstyleReqs, specialisations, playstyleInfo }, null, 2);
}
