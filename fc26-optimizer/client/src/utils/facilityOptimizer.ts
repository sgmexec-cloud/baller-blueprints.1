/**
 * Facility optimiser.
 *
 * Picks which facilities (and which tier of each) to buy with the club budget so the build gets the most
 * out of them. It is pure and deterministic: no AI call, no network, same inputs -> same answer.
 *
 * How a choice is valued ("AP-equivalent" value)
 *  - A facility boost is a free attribute point. Its worth is what the same point would cost in AP.
 *  - A boost that would push an attribute past the cap (99) is worth nothing, so no budget is wasted there.
 *  - Boosts from different facilities on the same attribute stack, and each extra point is valued one level higher.
 *  - A tier-3 facility also grants a PlayStyle. Only the best `maxFacilityPlaystyles` distinct ones count
 *    (the builder has two facility PlayStyle slots), and a PlayStyle the build doesn't want is worth nothing.
 *
 * Why not a plain knapsack? The value is not additive: two facilities can boost the same attribute and the cap
 * cuts the total. So the answer comes from three steps: an exact knapsack on stand-alone values, a greedy
 * start, and a local search that improves either start using the TRUE value. (Tested against brute force.)
 */

export interface FacilityDef {
  stats: string[];
  boosts: number[];
  cost: number[];
  playstyle?: string;
}

export interface FacilityOptimiseInput {
  facilities: Record<string, FacilityDef>;
  budget: number;
  /** In-game value of each attribute BEFORE any facility (base + points + height/weight + masteries) */
  currentStats: Record<string, number>;
  /** AP-equivalent worth of the single point that takes `stat` up to `level` (e.g. its AP cost) */
  pointValue: (stat: string, level: number) => number;
  /** Worth of getting this PlayStyle free from a tier-3 facility (0 = not wanted) */
  playstyleBonus?: (playstyle: string) => number;
  maxFacilityPlaystyles?: number;
  cap?: number;
}

export interface FacilityChoice {
  name: string;
  tier: 1 | 2 | 3;
  cost: number;
  boosts: Record<string, number>;
  playstyle?: string;
  /** How much the plan loses if this choice is removed */
  contribution: number;
}

export interface FacilityPlan {
  choices: FacilityChoice[];
  /** facility name -> tier, the shape the builder stores as `equippedFacilities` */
  equipped: Record<string, number>;
  totalCost: number;
  budget: number;
  /** Boost each attribute really gets (after the cap) */
  statBoosts: Record<string, number>;
  /** Boost lost to the cap, per attribute (should normally be empty) */
  wastedBoosts: Record<string, number>;
  /** AP-equivalent value of the attribute boosts */
  apSaved: number;
  playstylesGained: string[];
  value: number;
  summary: string[];
}

/** Same attribute whatever the spelling ("Att. Position" === "Attack Positioning") */
export function normStat(s: string): string {
  const n = (s ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (n.startsWith('att') && n.includes('pos')) return 'attackpositioning';
  if (n.includes('fk') && n.includes('acc')) return 'fkaccuracy';
  if (n.startsWith('def') && n.includes('awar')) return 'defawareness';
  if (n.includes('stand') && n.includes('tack')) return 'standingtackle';
  if (n.includes('slid') && n.includes('tack')) return 'slidingtackle';
  if (n.startsWith('short') && n.includes('pass')) return 'shortpassing';
  if (n.startsWith('long') && n.includes('pass')) return 'longpassing';
  if (n.includes('head') && n.includes('acc')) return 'headingaccuracy';
  if (n.includes('sprint')) return 'sprintspeed';
  return n;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function optimiseFacilities(input: FacilityOptimiseInput): FacilityPlan {
  const { facilities, budget, pointValue } = input;
  const cap = input.cap ?? 99;
  const maxPs = input.maxFacilityPlaystyles ?? 2;
  const psBonus = input.playstyleBonus ?? (() => 0);

  // Deterministic order
  const names = Object.keys(facilities).sort();
  const n = names.length;

  // Current level and display name per attribute
  const level: Record<string, number> = {};
  const display: Record<string, string> = {};
  for (const [stat, v] of Object.entries(input.currentStats)) {
    level[normStat(stat)] = v;
    display[normStat(stat)] = stat;
  }
  for (const f of Object.values(facilities)) for (const s of f.stats) if (!display[normStat(s)]) display[normStat(s)] = s;

  // sel[i] = chosen tier for names[i]: 0 = none, 1..3
  type Sel = number[];

  const boostOf = (i: number, tier: number) => facilities[names[i]].boosts[tier - 1] ?? 0;
  const costOf = (i: number, tier: number) => facilities[names[i]].cost[tier - 1] ?? Infinity;
  const totalCostOf = (sel: Sel) => sel.reduce((sum, t, i) => sum + (t ? costOf(i, t) : 0), 0);

  interface Evaluation {
    value: number;
    apSaved: number;
    statBoosts: Record<string, number>;
    wasted: Record<string, number>;
    playstyles: string[];
  }

  const evaluate = (sel: Sel): Evaluation => {
    const raw: Record<string, number> = {};
    const psSeen = new Map<string, number>();
    sel.forEach((tier, i) => {
      if (!tier) return;
      const f = facilities[names[i]];
      for (const s of f.stats) raw[normStat(s)] = (raw[normStat(s)] ?? 0) + boostOf(i, tier);
      if (tier === 3 && f.playstyle) psSeen.set(f.playstyle, psBonus(f.playstyle));
    });

    let apSaved = 0;
    const statBoosts: Record<string, number> = {};
    const wasted: Record<string, number> = {};
    for (const [key, total] of Object.entries(raw)) {
      const start = level[key] ?? 0;
      const headroom = Math.max(0, cap - start);
      const eff = Math.min(total, headroom);
      for (let k = 1; k <= eff; k++) apSaved += pointValue(display[key], start + k);
      if (eff > 0) statBoosts[display[key]] = eff;
      if (total > eff) wasted[display[key]] = total - eff;
    }

    const best = [...psSeen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, maxPs).filter(([, v]) => v > 0);
    const psValue = best.reduce((sum, [, v]) => sum + v, 0);
    return { value: apSaved + psValue, apSaved, statBoosts, wasted, playstyles: best.map(([p]) => p) };
  };

  const empty: Sel = new Array(n).fill(0);
  const valueOf = (sel: Sel) => evaluate(sel).value;

  // ── Step 1: exact knapsack on stand-alone values (one tier per facility) ──
  let unit = budget > 0 ? budget : 1;
  for (let i = 0; i < n; i++) for (let t = 1; t <= 3; t++) if (Number.isFinite(costOf(i, t))) unit = gcd(unit, costOf(i, t));
  if (unit < 1000) unit = 1000;
  const B = Math.floor(budget / unit);

  const standalone = (i: number, t: number) => {
    const sel = [...empty];
    sel[i] = t;
    return valueOf(sel);
  };

  // Exact multiple-choice knapsack for ANY table of item values (value[i][t], t = 1..3)
  const knapsack = (value: (i: number, t: number) => number): Sel => {
    const dp: number[] = new Array(B + 1).fill(0);
    const pick: number[][] = [];
    for (let i = 0; i < n; i++) {
      const next = dp.slice();
      const choice: number[] = new Array(B + 1).fill(0);
      for (let t = 1; t <= 3; t++) {
        const c = Math.ceil(costOf(i, t) / unit);
        if (!Number.isFinite(c) || c > B) continue;
        const v = value(i, t);
        if (v <= 0) continue;
        for (let b = c; b <= B; b++) {
          if (dp[b - c] + v > next[b] + 1e-9) {
            next[b] = dp[b - c] + v;
            choice[b] = t;
          }
        }
      }
      pick.push(choice);
      for (let b = 0; b <= B; b++) dp[b] = next[b];
    }
    const out: Sel = new Array(n).fill(0);
    let b = B;
    for (let i = n - 1; i >= 0; i--) {
      const t = pick[i][b];
      out[i] = t;
      if (t) b -= Math.ceil(costOf(i, t) / unit);
    }
    return out;
  };

  // Stand-alone values: each facility judged as if it were the only one bought
  const standaloneTable: number[][] = [];
  for (let i = 0; i < n; i++) standaloneTable.push([0, standalone(i, 1), standalone(i, 2), standalone(i, 3)]);
  const dpSel = knapsack((i, t) => standaloneTable[i][t]);

  // ── Step 2: greedy start (best value per cost, one tier per facility) ──
  const greedySel: Sel = new Array(n).fill(0);
  {
    const items: { i: number; t: number; ratio: number }[] = [];
    for (let i = 0; i < n; i++)
      for (let t = 1; t <= 3; t++) items.push({ i, t, ratio: standalone(i, t) / costOf(i, t) });
    items.sort((a, b) => b.ratio - a.ratio || a.i - b.i || a.t - b.t);
    let spent = 0;
    for (const { i, t } of items) {
      if (greedySel[i]) continue;
      if (spent + costOf(i, t) <= budget && valueOf(greedySel.map((x, k) => (k === i ? t : x))) > valueOf(greedySel) + 1e-9) {
        greedySel[i] = t;
        spent += costOf(i, t);
      }
    }
  }

  // ── Step 3: local search with the TRUE (stacking, cap-aware) value ──
  const improve = (start: Sel): Sel => {
    let cur = start.slice();
    let curVal = valueOf(cur);
    for (let pass = 0; pass < 60; pass++) {
      let bestSel: Sel | null = null;
      let bestVal = curVal;
      const tryCandidate = (cand: Sel) => {
        if (totalCostOf(cand) > budget) return;
        const v = valueOf(cand);
        if (v > bestVal + 1e-9) {
          bestVal = v;
          bestSel = cand;
        }
      };
      for (let i = 0; i < n; i++) {
        for (let t = 0; t <= 3; t++) {
          if (t === cur[i]) continue;
          const one = cur.slice();
          one[i] = t;
          tryCandidate(one);
          for (let j = i + 1; j < n; j++) {
            for (let u = 0; u <= 3; u++) {
              if (u === cur[j]) continue;
              const two = one.slice();
              two[j] = u;
              tryCandidate(two);
            }
          }
        }
      }
      if (!bestSel) break;
      cur = bestSel;
      curVal = bestVal;
    }
    return cur;
  };

  // Re-value every item given what a plan already contains (stacking and the cap change what an item is worth),
  // solve the knapsack again with those values, then polish with the local search.
  const relinearise = (base: Sel): Sel => {
    const baseVal = (i: number) => {
      const without = base.slice();
      without[i] = 0;
      return valueOf(without);
    };
    const table = base.map((_, i) => {
      const w = baseVal(i);
      return [0, 1, 2, 3].map(t => {
        if (t === 0) return 0;
        const sel = base.slice();
        sel[i] = t;
        return valueOf(sel) - w;
      });
    });
    return knapsack((i, t) => table[i][t]);
  };

  const first = [improve(dpSel), improve(greedySel), improve(empty)];
  const seeds = first.sort((a, b) => valueOf(b) - valueOf(a));
  const polished = seeds.map(sd => improve(relinearise(sd)));
  const candidates = [...first, ...polished];
  const winner = candidates.sort((a, b) => valueOf(b) - valueOf(a) || totalCostOf(a) - totalCostOf(b))[0];
  const final = evaluate(winner);

  // ── Build the answer ──
  const choices: FacilityChoice[] = [];
  winner.forEach((tier, i) => {
    if (!tier) return;
    const f = facilities[names[i]];
    const without = winner.slice();
    without[i] = 0;
    choices.push({
      name: names[i],
      tier: tier as 1 | 2 | 3,
      cost: costOf(i, tier),
      boosts: Object.fromEntries(f.stats.map(s => [s, boostOf(i, tier)])),
      playstyle: tier === 3 ? f.playstyle : undefined,
      contribution: Math.round((final.value - valueOf(without)) * 10) / 10,
    });
  });
  choices.sort((a, b) => b.contribution - a.contribution || a.name.localeCompare(b.name));

  const m = (c: number) => `${(c / 1_000_000).toFixed(1)}M`;
  const summary = choices.map(c => {
    const gains = Object.entries(c.boosts).map(([s, b]) => `+${b} ${s}`).join(', ');
    return `${c.name} (tier ${c.tier}, ${m(c.cost)}): ${gains}${c.playstyle && final.playstyles.includes(c.playstyle) ? `, free ${c.playstyle}` : ''}`;
  });

  return {
    choices,
    equipped: Object.fromEntries(choices.map(c => [c.name, c.tier])),
    totalCost: totalCostOf(winner),
    budget,
    statBoosts: final.statBoosts,
    wastedBoosts: final.wasted,
    apSaved: Math.round(final.apSaved),
    playstylesGained: final.playstyles,
    value: Math.round(final.value * 10) / 10,
    summary,
  };
}
