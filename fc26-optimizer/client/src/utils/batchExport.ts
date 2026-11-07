/**
 * CSV exports for Canva Bulk Create. One row per selected, finished player, the same columns every time.
 *
 *  - titles   slide titles and post text
 *  - cards    the six face stats and all 29 attributes
 *  - reports  scout report, PlayStyles, specialisation, facilities and physicals
 *
 * Plain headers (lower case, underscores), UTF-8, comma separated, CRLF line ends, fields quoted when they hold a
 * comma, a quote or a line break. Player images are not in the file: Canva needs those uploaded separately, so
 * `player_name` comes first in every file to match each row to its image.
 */
import { STAT_GROUPS } from '@/constants/builderData';
import { factsFromItem, composeSocial, templateCopy, type BuildFacts, type SocialRecord } from '@/utils/socialCopy';

export type ExportKind = 'titles' | 'cards' | 'reports';

export interface ExportItem {
  playerName: string;
  note?: string | null;
  status: string;
  selected: boolean;
  blueprint?: any;
  build?: any;
  social?: any;
}

export const EXPORT_KINDS: { id: ExportKind; label: string; help: string }[] = [
  { id: 'titles', label: 'Titles', help: 'Title, archetype, position, OVR, face stats, 3 standout attributes, hashtags, caption' },
  { id: 'cards', label: 'Attribute cards', help: 'OVR, face stats and all 29 attributes' },
  { id: 'reports', label: 'Scout reports', help: 'Scout report, description, PlayStyles, specialisation, facilities, physicals' },
];

const ATTRIBUTES = Object.values(STAT_GROUPS).flat();
const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const COLUMNS: Record<ExportKind, string[]> = {
  titles: [
    'player_name', 'tiktok_title', 'archetype', 'position', 'ovr',
    'pac', 'sho', 'pas', 'dri', 'def', 'phy',
    'highlight_1_name', 'highlight_1_value', 'highlight_2_name', 'highlight_2_value', 'highlight_3_name', 'highlight_3_value',
    'hashtags', 'caption',
  ],
  cards: ['player_name', 'archetype', 'position', 'ovr', 'pac', 'sho', 'pas', 'dri', 'def', 'phy', ...ATTRIBUTES.map(snake)],
  reports: [
    'player_name', 'archetype', 'position', 'scout_report', 'description',
    'signature_1', 'signature_2', 'specialisation',
    'playstyle_1', 'playstyle_2', 'playstyle_3', 'playstyle_4',
    'skill_moves', 'weak_foot', 'height', 'weight', 'facilities',
  ],
};

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

function rowFor(kind: ExportKind, item: ExportItem, facts: BuildFacts, social: SocialRecord): Cell[] {
  const highlights = (social.highlights?.length ? social.highlights : facts.highlights).slice(0, 3);
  const h = (i: number) => highlights[i] ?? { attribute: '', value: '' as Cell };

  if (kind === 'titles') {
    return [
      facts.playerName, social.title, facts.archetype, facts.position, facts.ovr,
      facts.pac, facts.sho, facts.pas, facts.dri, facts.def, facts.phy,
      h(0).attribute, h(0).value, h(1).attribute, h(1).value, h(2).attribute, h(2).value,
      (social.hashtags ?? []).join(' '), social.caption,
    ];
  }

  if (kind === 'cards') {
    const stats: Record<string, number> = item.build?.view?.boostedStats ?? {};
    return [
      facts.playerName, facts.archetype, facts.position, facts.ovr,
      facts.pac, facts.sho, facts.pas, facts.dri, facts.def, facts.phy,
      ...ATTRIBUTES.map(a => (typeof stats[a] === 'number' ? stats[a] : '')),
    ];
  }

  const ps = (i: number) => facts.playstyles[i] ?? '';
  return [
    facts.playerName, facts.archetype, facts.position, social.scoutReport ?? '', social.description,
    facts.signatures[0] ?? '', facts.signatures[1] ?? '', facts.specialisation ?? '',
    ps(0), ps(1), ps(2), ps(3),
    facts.skillMoves, facts.weakFoot, `${facts.height}cm`, `${facts.weight}kg`,
    facts.facilities.map(f => f.replace(/ \(tier (\d)\)$/, ' T$1')).join('; '),
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

export function buildExport(kind: ExportKind, items: ExportItem[], batchName: string): ExportResult {
  const rows: Cell[][] = [];
  const usedTemplate: string[] = [];
  const skipped: string[] = [];

  for (const item of exportable(items)) {
    const facts = factsFromItem(item);
    if (!facts) { skipped.push(item.playerName); continue; }
    const { social, usedTemplate: tpl } = copyFor(item, facts);
    if (tpl) usedTemplate.push(item.playerName);
    rows.push(rowFor(kind, item, facts, social));
  }

  return {
    filename: `${slugify(batchName)}-${kind}.csv`,
    csv: toCsv(COLUMNS[kind], rows),
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
