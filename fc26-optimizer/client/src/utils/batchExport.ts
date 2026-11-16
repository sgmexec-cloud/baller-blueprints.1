/**
 * The CSV for Canva Bulk Create: titles and post text, one row per selected, finished player, the same columns
 * every time. (The player card, facilities and scout report are images, see batchImages.ts.)
 *
 * Plain headers (lower case, underscores), UTF-8, comma separated, CRLF line ends, fields quoted when they hold a
 * comma, a quote or a line break. Player images are not in the file: Canva needs those uploaded separately, so
 * `player_name` comes first to match each row to its image.
 */
import { factsFromItem, composeSocial, templateCopy, type BuildFacts, type SocialRecord } from '@/utils/socialCopy';

export interface ExportItem {
  playerName: string;
  note?: string | null;
  status: string;
  selected: boolean;
  blueprint?: any;
  build?: any;
  social?: any;
}

export const TITLES_COLUMNS = [
  'player_name', 'tiktok_title', 'archetype', 'position', 'ovr',
  'pac', 'sho', 'pas', 'dri', 'def', 'phy',
  'highlight_1_name', 'highlight_1_value', 'highlight_2_name', 'highlight_2_value', 'highlight_3_name', 'highlight_3_value',
  'hashtags', 'caption',
];

type Cell = string | number;

/** One CSV field. Text that Excel or Sheets would read as a formula gets a leading apostrophe. */
export function csvEscape(v: Cell | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function slugify(name: string): string {
  const s = String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 40) || 'batch';
}

/** The copy used for a player: what is saved, or the template wording if none was written yet */
function copyFor(item: ExportItem, facts: BuildFacts): { social: SocialRecord; usedTemplate: boolean } {
  if (item.social && typeof item.social.title === 'string') return { social: item.social as SocialRecord, usedTemplate: false };
  return { social: composeSocial(facts, templateCopy(facts), 'template'), usedTemplate: true };
}

function titlesRow(facts: BuildFacts, social: SocialRecord): Cell[] {
  const highlights = (social.highlights?.length ? social.highlights : facts.highlights).slice(0, 3);
  const h = (i: number) => highlights[i] ?? { attribute: '', value: '' as Cell };
  return [
    facts.playerName, social.title, facts.archetype, facts.position, facts.ovr,
    facts.pac, facts.sho, facts.pas, facts.dri, facts.def, facts.phy,
    h(0).attribute, h(0).value, h(1).attribute, h(1).value, h(2).attribute, h(2).value,
    (social.hashtags ?? []).join(' '), social.caption,
  ];
}

export interface ExportResult {
  filename: string;
  csv: string;
  rowCount: number;
  /** Players whose copy was written from the template because none had been saved */
  usedTemplate: string[];
  /** Selected players left out because their build record is incomplete */
  skipped: string[];
}

/** Which players an export would include (selected and finished) */
export const exportable = (items: ExportItem[]) => items.filter(i => i.selected && i.status === 'done');

export function buildTitlesCsv(items: ExportItem[], batchName: string): ExportResult {
  const rows: Cell[][] = [];
  const usedTemplate: string[] = [];
  const skipped: string[] = [];

  for (const item of exportable(items)) {
    const facts = factsFromItem(item);
    if (!facts) { skipped.push(item.playerName); continue; }
    const { social, usedTemplate: tpl } = copyFor(item, facts);
    if (tpl) usedTemplate.push(item.playerName);
    rows.push(titlesRow(facts, social));
  }

  return {
    filename: `${slugify(batchName)}-titles.csv`,
    csv: toCsv(TITLES_COLUMNS, rows),
    rowCount: rows.length,
    usedTemplate,
    skipped,
  };
}

/** Download a text file in the browser (works in Chrome on Android) */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
