import type { MathEngineResult, StatResult } from "../../../server/mathEngine";

interface Props {
  result: MathEngineResult & {
    playstyles?: {
      signatures: string[];
      standard: string[];
      specialisation: string | null;
    };
  };
  apBudget: number;
  archetype: string;
}

// ... (KEEP ALL YOUR EXISTING CATEGORY_CONFIG, StatRow, StatBar, CategoryBlock CODE HERE) ...

export default function PlayerCard({ result, apBudget, archetype }: Props) {
  // ... (KEEP ALL EXISTING CONSTS LIKE efficiency, remaining, categoryOrder) ...

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "oklch(0.10 0.015 240)" }}>
      {/* ... (KEEP ALL EXISTING HEADER AND STATS BODY CODE) ... */}

      {/* FIXED PLAYSTYLE RENDERER */}
      <div className="px-4 pb-6 mt-2 border-t border-slate-700 pt-4">
        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">Recommended PlayStyle Loadout</h3>
        {!result.playstyles ? (
          <p className="text-[10px] text-gray-500 italic">Calculating PlayStyles...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(result.playstyles.signatures || []).map((sig, i) => (
              <span key={`sig-${i}`} className="px-2 py-1 bg-blue-900/30 border border-blue-500/50 rounded text-[10px] font-bold text-blue-200">★ {sig}</span>
            ))}
            {(result.playstyles.standard || []).map((ps, i) => (
              <span key={`std-${i}`} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300">{ps}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
