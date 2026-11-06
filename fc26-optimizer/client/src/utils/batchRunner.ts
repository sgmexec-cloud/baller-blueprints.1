/**
 * The plain logic behind the Batch Build Generator: reading the pasted player list, running the queue with a
 * limit on how many builds run at once, turning one finished build into the record that is saved, and
 * friendly error text. No React and no network in here, so it can be tested on its own.
 */
import type { PipelineResult } from '@/utils/aiBuildPipeline';
import { pickHighlights, type BuildView } from '@/utils/buildView';

export type ItemStatus = 'queued' | 'running' | 'done' | 'failed';

export const MAX_PLAYERS = 100;

export interface ParsedPlayer {
  playerName: string;
  note?: string;
}

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * One player per line. "Name | note" adds an optional note (era, role ...). Blank lines, lines starting with #
 * and list bullets or numbers ("1.", "-", "•") are ignored. Repeated names (ignoring case) are dropped.
 */
export function parsePlayerList(text: string, max = MAX_PLAYERS): { items: ParsedPlayer[]; duplicates: number; overLimit: number } {
  const seen = new Set<string>();
  const items: ParsedPlayer[] = [];
  let duplicates = 0;
  let overLimit = 0;

  for (const raw of String(text ?? '').split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    line = line.replace(/^(?:[-•*]|\d+[.)])\s+/, '');
    const bar = line.indexOf('|');
    const name = (bar >= 0 ? line.slice(0, bar) : line).trim().slice(0, 120);
    const note = bar >= 0 ? line.slice(bar + 1).trim().slice(0, 300) : '';
    if (!name) continue;

    const key = normName(name);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    if (items.length >= max) { overLimit++; continue; }
    items.push(note ? { playerName: name, note } : { playerName: name });
  }
  return { items, duplicates, overLimit };
}

/** The text sent to the AI for a player */
export function playerIdentity(playerName: string, note?: string | null): string {
  return note && note.trim() ? `${playerName.trim()} (${note.trim()})` : playerName.trim();
}

/** Short, readable error text for a failed player */
export function friendlyError(err: unknown): string {
  const e = err as any;
  const msg = String(e?.message ?? err ?? 'Something went wrong').trim();
  if (e?.data?.code === 'UNAUTHORIZED') return 'Please log in again.';
  if (msg === 'LIMIT_REACHED') return 'The AI build limit has been reached.';
  if (msg === 'OWNER_ONLY') return 'Owner only.';
  if (msg.startsWith('LLM invoke failed')) {
    const status = msg.match(/failed:\s*(\d{3})/)?.[1];
    return `The AI service had a problem${status ? ` (${status})` : ''}. Try again.`;
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Connection problem. Check your signal and retry.';
  return msg.length > 200 ? msg.slice(0, 197) + '...' : msg;
}

export function summarise(items: { status: ItemStatus; selected?: boolean }[]) {
  const out = { total: items.length, done: 0, failed: 0, running: 0, queued: 0, selected: 0 };
  for (const i of items) {
    out[i.status]++;
    if (i.status === 'done' && i.selected) out.selected++;
  }
  return out;
}

/**
 * Runs `run` for every item with at most `concurrency` (1 to 3) at the same time, in list order.
 * One item failing never stops the others. When `isStopped()` turns true nothing new is started
 * (items already running finish).
 */
export async function runQueue<T>(
  items: T[],
  o: {
    concurrency: number;
    isStopped: () => boolean;
    run: (item: T) => Promise<void>;
    onStart?: (item: T) => void;
    onDone?: (item: T) => void;
    onFail?: (item: T, error: unknown) => void;
  }
): Promise<{ started: number; done: number; failed: number }> {
  const concurrency = Math.max(1, Math.min(3, Math.floor(o.concurrency) || 1));
  let next = 0;
  let started = 0;
  let done = 0;
  let failed = 0;
  const safe = (fn?: () => void) => { try { fn?.(); } catch { /* a screen update must never stop the queue */ } };

  const worker = async () => {
    for (;;) {
      if (o.isStopped()) return;
      const index = next++;
      if (index >= items.length) return;
      const item = items[index];
      started++;
      safe(() => o.onStart?.(item));
      try {
        await o.run(item);
        done++;
        safe(() => o.onDone?.(item));
      } catch (err) {
        failed++;
        safe(() => o.onFail?.(item, err));
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { started, done, failed };
}

/** Everything saved for one finished build (the `build` column), ready for the editor and the CSV export */
export function composeBuildRecord(result: PipelineResult, view: BuildView, blueprint: any): Record<string, unknown> {
  const plan = result.facilityPlan;
  return {
    v: 1,
    archetype: result.archetype,
    level: result.snapshot.level,
    snapshot: result.snapshot,
    view: {
      faceStats: view.faceStats,
      ovr: view.ovr,
      primaryPosition: view.primaryPosition,
      positionRatings: view.positionRatings,
      rawStats: view.rawStats,
      boostedStats: view.boostedStats,
      boostTotals: view.boostTotals,
      spentAp: view.spentAp,
    },
    highlights: pickHighlights(blueprint ?? {}, view.boostedStats, 3),
    signatures: result.signatures,
    specSwapIndex: result.specSwapIndex,
    boosts: result.boosts,
    facilityPlan: plan
      ? {
          equipped: plan.equipped,
          totalCost: plan.totalCost,
          budget: plan.budget,
          apSaved: plan.apSaved,
          playstylesGained: plan.playstylesGained,
          statBoosts: plan.statBoosts,
          summary: plan.summary,
        }
      : null,
    floorReport: result.engine?.floorReport ?? null,
    availableAp: result.availableAp,
    starCost: result.starCost,
    notes: result.notes,
  };
}
