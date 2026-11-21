import React, { useState } from 'react';
import { STAT_GROUPS, CSV_STAT_MAP } from '@/constants/builderData';
import { getStatCaps, getCostForPoints } from '@/utils/builderUtils';

/* ------------------------------------------------------------------
   Compact attribute allocator
   - sticky points bar + selected-attribute inspector (stepper + numeric input)
   - 2-column grid, all categories visible
   - OTHER section with star ratings (Skill Moves / Weak Foot)

   Conventions kept from the previous tab:
   - handleSliderChange(stat, value) receives the value AS DISPLAYED
     (raw in Raw mode, boosted in Boosted mode)
   - per-step AP cost comes from getCostForPoints
------------------------------------------------------------------- */

// Rename categories to the wording you want (keys = names used in STAT_GROUPS).
const CATEGORY_LABELS: Record<string, string> = {
  Pace: 'PACE',
  Shooting: 'SCORING',
  Passing: 'PASSING',
  Dribbling: 'BALL CONTROL',
  Defending: 'DEFENDING',
  Physical: 'PHYSICAL',
};

// Column order (left column first, then right).
const LEFT_LABELS = ['BALL CONTROL', 'PASSING', 'PACE'];
const RIGHT_LABELS = ['SCORING', 'DEFENDING', 'PHYSICAL'];

const getStatColor = (value: number): string => {
  if (value <= 50) return '#b00303';
  if (value <= 60) return '#e87c22';
  if (value <= 70) return '#fdca41';
  if (value <= 80) return '#9cbe33';
  return '#439346';
};

const SM = '__sm';
const WF = '__wf';

interface Props {
  archetype: string;
  serverArchetypes: any;
  currentStats: Record<string, number>;
  addedPoints: Record<string, number>;
  viewMode: string;
  setViewMode: (m: any) => void;
  smLevel: number;
  wfLevel: number;
  starMax?: { sm: number; wf: number };
  availableAp: number;
  maxAp: number;
  physicalModifiers: Record<string, number>;
  facilityModifiers: Record<string, number>;
  masteryModifiers: Record<string, number>;
  handleSliderChange: (stat: string, value: number) => void;
  onChangeStar: (which: 'sm' | 'wf', value: number) => void;
  onReset: () => void;
}

const Star = ({ filled }: { filled: boolean }) => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true"
    fill={filled ? '#facc15' : 'none'} stroke={filled ? '#facc15' : '#59657A'}
    strokeWidth="1.75" strokeLinejoin="round">
    <polygon points="12 2 15.1 8.6 22 9.3 16.8 14 18.2 21 12 17.5 5.8 21 7.2 14 2 9.3 8.9 8.6 12 2" />
  </svg>
);

export const AttributesTab: React.FC<Props> = ({
  archetype, serverArchetypes, currentStats, addedPoints,
  viewMode, setViewMode, smLevel, wfLevel, starMax = { sm: 5, wf: 5 },
  availableAp, maxAp, physicalModifiers, facilityModifiers, masteryModifiers,
  handleSliderChange, onChangeStar, onReset,
}) => {
  const groups = Object.entries(STAT_GROUPS as Record<string, readonly string[]>).map(([cat, stats]) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat.toUpperCase(),
    stats: [...stats],
  }));

  const rank = (label: string, order: string[]) => {
    const i = order.indexOf(label);
    return i === -1 ? 99 : i;
  };
  let left = groups.filter((g) => LEFT_LABELS.includes(g.label)).sort((a, b) => rank(a.label, LEFT_LABELS) - rank(b.label, LEFT_LABELS));
  let right = groups.filter((g) => !LEFT_LABELS.includes(g.label)).sort((a, b) => rank(a.label, RIGHT_LABELS) - rank(b.label, RIGHT_LABELS));
  if (!left.length || !right.length) {
    const half = Math.ceil(groups.length / 2);
    left = groups.slice(0, half);
    right = groups.slice(half);
  }

  const [selected, setSelected] = useState<string>(() => groups[0]?.stats[0] ?? '');
  const [compare, setCompare] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const showBoosts = viewMode !== 'raw';
  const used = Math.max(0, maxAp - availableAp);

  const info = (stat: string) => {
    const caps = getStatCaps(archetype, stat);
    const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[stat] || 70;
    const max = caps.max || 99;
    const invested = addedPoints[stat] || 0;
    const rawVal = rawBase + invested;
    const displayVal = showBoosts ? (currentStats?.[stat] || 70) : rawVal;
    const mods = (physicalModifiers?.[stat] || 0) + (facilityModifiers?.[stat] || 0) + (masteryModifiers?.[stat] || 0);
    return { rawBase, max, invested, displayVal, min: displayVal - invested, mods };
  };

  const stepCost = (stat: string): number | null => {
    const i = info(stat);
    const next = getCostForPoints(archetype, stat, i.rawBase, i.invested + 1) - getCostForPoints(archetype, stat, i.rawBase, i.invested);
    return Number.isFinite(next) && next > 0 ? next : null;
  };

  // ---- selected item (stat or star) -> one inspector model
  const isStar = selected === SM || selected === WF;
  const starKey: 'sm' | 'wf' = selected === SM ? 'sm' : 'wf';
  let sel: { name: string; min: number; max: number; value: number; mods: number };
  if (isStar) {
    sel = { name: starKey === 'sm' ? 'Skill Moves' : 'Weak Foot', min: 1, max: starMax[starKey], value: starKey === 'sm' ? smLevel : wfLevel, mods: 0 };
  } else {
    const i = info(selected);
    sel = { name: CSV_STAT_MAP[selected] || selected, min: i.min, max: i.max, value: i.displayVal, mods: i.mods };
  }

  const atMax = sel.value >= sel.max;
  const cost = !isStar && !atMax ? stepCost(selected) : null;
  const minusDisabled = sel.value <= sel.min || (!isStar && (addedPoints[selected] || 0) <= 0);
  const plusDisabled = atMax || (!isStar && (availableAp < 1 || (cost != null && availableAp < cost)));

  const commit = (v: number) => {
    if (Number.isNaN(v)) return;
    const next = Math.round(Math.min(sel.max, Math.max(sel.min, v)));
    if (next === sel.value) return;
    if (isStar) onChangeStar(starKey, next);
    else handleSliderChange(selected, next);
  };

  const select = (id: string) => { setDraft(null); setSelected(id); };

  const StatRow = ({ stat }: { stat: string }) => {
    const i = info(stat);
    const isSel = selected === stat;
    return (
      <button
        onClick={() => select(stat)}
        aria-pressed={isSel}
        className={`w-full text-left rounded-md px-1.5 py-1 transition-colors ${isSel ? 'bg-[#4D8DFF]/15 ring-1 ring-[#4D8DFF]/40' : 'active:bg-[#131A2A]'}`}
      >
        <div className="flex items-baseline justify-between gap-1 leading-none">
          <span className={`truncate text-[11px] ${isSel ? 'text-[#F4F7FB] font-semibold' : 'text-[#8E9AAF]'}`}>{CSV_STAT_MAP[stat] || stat}</span>
          <span className="flex items-baseline gap-1 shrink-0">
            {compare && i.invested > 0 && <span className="text-[9px] font-bold text-[#21E6A4]">+{i.invested}</span>}
            <span className="text-[12px] font-black" style={{ color: getStatColor(i.displayVal) }}>{i.displayVal}</span>
          </span>
        </div>
        <div className="mt-1 h-[3px] w-full rounded-full bg-[#26334A]">
          <div className="h-full rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, i.displayVal)}%`, backgroundColor: getStatColor(i.displayVal) }} />
        </div>
      </button>
    );
  };

  const GroupBlock = ({ g }: { g: { label: string; stats: string[] } }) => {
    const total = g.stats.reduce((sum, s) => sum + info(s).displayVal, 0);
    const avg = Math.round(total / g.stats.length);
    return (
      <div className="mb-2.5">
        <div className="flex items-center justify-between px-1.5 pb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#4D8DFF]">{g.label}</span>
          <span className="text-[11px] font-black" style={{ color: getStatColor(avg) }}>{avg}</span>
        </div>
        <div className="space-y-0.5">{g.stats.map((s) => <StatRow key={s} stat={s} />)}</div>
      </div>
    );
  };

  const StarRow = ({ id, label, value }: { id: string; label: string; value: number }) => {
    const isSel = selected === id;
    return (
      <button
        onClick={() => select(id)}
        aria-pressed={isSel}
        className={`flex items-center justify-between gap-1 rounded-md px-1.5 py-1.5 transition-colors ${isSel ? 'bg-[#4D8DFF]/15 ring-1 ring-[#4D8DFF]/40' : 'active:bg-[#131A2A]'}`}
      >
        <span className={`text-[11px] ${isSel ? 'text-[#F4F7FB] font-semibold' : 'text-[#8E9AAF]'}`}>{label}</span>
        <span className="flex gap-px">{[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= value} />)}</span>
      </button>
    );
  };

  const btn = 'px-2 py-1.5 rounded-md border text-[10px] font-bold leading-none whitespace-nowrap transition-colors';

  return (
    <section className="animate-fade-up">
      {/* STICKY: points bar + inspector */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-2 bg-[#080B14]/95 backdrop-blur-md border-b border-[#26334A]/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-3xl font-black leading-none text-[#facc15]">{availableAp.toLocaleString()}</span>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold text-[#F4F7FB]">Skill points left</div>
              <div className="text-[10px] text-[#8E9AAF]">{used.toLocaleString()} used</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode(showBoosts ? 'raw' : 'boosted')}
              aria-pressed={showBoosts}
              className={`${btn} ${showBoosts ? 'border-[#facc15]/60 bg-[#facc15]/10 text-[#facc15]' : 'border-[#26334A] bg-[#131A2A] text-[#8E9AAF]'}`}
            >Show boosts</button>
            <button
              onClick={() => setCompare((c) => !c)}
              aria-pressed={compare}
              className={`${btn} ${compare ? 'border-[#21E6A4]/60 bg-[#21E6A4]/10 text-[#21E6A4]' : 'border-[#26334A] bg-[#131A2A] text-[#8E9AAF]'}`}
            >Compare</button>
            <button
              onClick={() => { setDraft(null); onReset(); }}
              className={`${btn} flex items-center gap-1 border-[#26334A] bg-[#131A2A] text-[#8E9AAF] active:text-[#F4F7FB]`}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#26334A] bg-[#0D1220] px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-[#F4F7FB]">{sel.name}</div>
            <div className={`text-[10px] font-semibold ${atMax ? 'text-[#facc15]' : 'text-[#8E9AAF]'}`}>
              {atMax ? 'Max purchased' : cost != null ? `${cost} AP per step` : 'Use − / + or type a value'}
              {showBoosts && sel.mods !== 0 && (
                <span className={`ml-1.5 ${sel.mods > 0 ? 'text-[#21E6A4]' : 'text-[#ff4d4d]'}`}>{sel.mods > 0 ? '+' : ''}{sel.mods} boost</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => commit(sel.value - 1)}
              disabled={minusDisabled}
              aria-label={`Decrease ${sel.name}`}
              className="w-9 h-9 rounded-lg border border-[#26334A] bg-[#131A2A] text-lg font-bold text-[#F4F7FB] disabled:opacity-30 active:bg-[#192235]"
            >−</button>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={`${sel.name} value`}
              value={draft ?? String(sel.value)}
              onFocus={(e) => { setDraft(String(sel.value)); e.currentTarget.select(); }}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => { if (draft !== null && draft !== '') commit(Number(draft)); setDraft(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
              className="w-12 h-9 rounded-lg border border-[#4D8DFF]/40 bg-[#080B14] text-center text-base font-black text-[#F4F7FB] outline-none focus:border-[#4D8DFF]"
            />
            <button
              onClick={() => commit(sel.value + 1)}
              disabled={plusDisabled}
              aria-label={`Increase ${sel.name}`}
              className="w-9 h-9 rounded-lg border border-[#facc15]/40 bg-[#192235] text-lg font-bold text-[#facc15] disabled:opacity-30 active:bg-[#facc15] active:text-[#080B14]"
            >+</button>
          </div>
        </div>
      </div>

      {/* 2-COLUMN GRID */}
      <div className="mt-3 grid grid-cols-2 gap-x-3">
        <div>{left.map((g) => <GroupBlock key={g.cat} g={g} />)}</div>
        <div>{right.map((g) => <GroupBlock key={g.cat} g={g} />)}</div>
      </div>

      {/* OTHER */}
      <div className="mt-1 border-t border-[#26334A]/60 pt-2">
        <div className="px-1.5 pb-1 text-[9px] font-black uppercase tracking-widest text-[#4D8DFF]">OTHER</div>
        <div className="grid grid-cols-2 gap-x-3">
          <StarRow id={SM} label="Skill Moves" value={smLevel} />
          <StarRow id={WF} label="Weak Foot" value={wfLevel} />
        </div>
      </div>
    </section>
  );
};
