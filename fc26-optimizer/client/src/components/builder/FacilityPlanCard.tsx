import React from 'react';
import type { FacilityPlan } from '@/utils/facilityOptimizer';

interface FacilityPlanCardProps {
  plan: FacilityPlan | null;
  onClose: () => void;
  /** Opens the Facilities screen so the plan can be edited by hand */
  onEdit: () => void;
}

const millions = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

/** Appears after an AI build with "Let AI choose" facilities: what was bought, what it gives, and why. */
export const FacilityPlanCard: React.FC<FacilityPlanCardProps> = ({ plan, onClose, onEdit }) => {
  if (!plan) return null;

  const wasted = Object.entries(plan.wastedBoosts);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-lg max-h-[75vh] overflow-y-auto bg-[#0D1220] border-t border-[#21E6A4]/50 rounded-t-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.6)] p-5 hide-scrollbar"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ✨ AI picked your facilities
            </h3>
            <p className="text-[10px] text-[#8E9AAF] font-semibold mt-1">
              {plan.choices.length === 0
                ? 'Nothing in your budget helps this build enough to buy.'
                : <>Spent <span className="text-[#F4F7FB]">{millions(plan.totalCost)}</span> of {millions(plan.budget)} · saves about{' '}
                    <span className="text-[#21E6A4] font-black">{plan.apSaved} AP</span> of attribute upgrades</>}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#59657A] hover:text-[#F4F7FB] p-1 text-lg leading-none">✕</button>
        </div>

        {plan.playstylesGained.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#8E9AAF]">Free PlayStyles</span>
            {plan.playstylesGained.map(p => (
              <span key={p} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#4D8DFF]/50 bg-[#4D8DFF]/10 text-[#cfe0ff]">{p}</span>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {plan.choices.map(c => (
            <div key={c.name} className="bg-[#131A2A] border border-[#26334A] rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-[8px] font-black uppercase tracking-widest bg-[#facc15]/20 text-[#facc15] px-1.5 py-0.5 rounded">T{c.tier}</span>
                  <span className="text-[11px] font-black text-[#F4F7FB] truncate">{c.name}</span>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-[#8E9AAF]">{millions(c.cost)}</span>
              </div>
              <div className="text-[10px] text-[#21E6A4] font-semibold mt-1">
                {Object.entries(c.boosts).map(([s, b]) => `+${b} ${s}`).join(' · ')}
                {c.playstyle && plan.playstylesGained.includes(c.playstyle) && <span className="text-[#cfe0ff]"> · free {c.playstyle}</span>}
              </div>
            </div>
          ))}
        </div>

        {wasted.length > 0 && (
          <p className="mt-3 text-[10px] text-[#facc15] font-semibold leading-relaxed">
            Heads up: {wasted.map(([s, n]) => `${n} point${n > 1 ? 's' : ''} of ${s}`).join(', ')} go past 99, so they add nothing.
            That was the best trade-off for this budget.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="flex-1 py-2.5 rounded-xl bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] text-[10px] font-black uppercase tracking-widest hover:bg-[#192235] transition-colors"
          >
            Edit facilities
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white text-[10px] font-black uppercase tracking-widest"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
