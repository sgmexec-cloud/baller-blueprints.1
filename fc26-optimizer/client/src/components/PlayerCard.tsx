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

const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: string }
> = {
  Pace: { color: "oklch(0.75 0.22 142)", bg: "oklch(0.75 0.22 142 / 0.08)", border: "oklch(0.75 0.22 142 / 0.25)", icon: "⚡" },
  Shooting: { color: "oklch(0.65 0.22 25)", bg: "oklch(0.65 0.22 25 / 0.08)", border: "oklch(0.65 0.22 25 / 0.25)", icon: "🎯" },
  Passing: { color: "oklch(0.65 0.20 230)", bg: "oklch(0.65 0.20 230 / 0.08)", border: "oklch(0.65 0.20 230 / 0.25)", icon: "🔵" },
  Dribbling: { color: "oklch(0.78 0.18 85)", bg: "oklch(0.78 0.18 85 / 0.08)", border: "oklch(0.78 0.18 85 / 0.25)", icon: "✦" },
  Defending: { color: "oklch(0.70 0.15 300)", bg: "oklch(0.70 0.15 300 / 0.08)", border: "oklch(0.70 0.15 300 / 0.25)", icon: "🛡" },
  Physicality: { color: "oklch(0.72 0.18 55)", bg: "oklch(0.72 0.18 55 / 0.08)", border: "oklch(0.72 0.18 55 / 0.25)", icon: "💪" },
  "Skill Moves": { color: "oklch(0.75 0.22 142)", bg: "oklch(0.75 0.22 142 / 0.06)", border: "oklch(0.75 0.22 142 / 0.2)", icon: "★" },
  "Weak Foot": { color: "oklch(0.65 0.20 230)", bg: "oklch(0.65 0.20 230 / 0.06)", border: "oklch(0.65 0.20 230 / 0.2)", icon: "◆" },
};

function getStatColor(val: number, max: number): string {
  const pct = val / max;
  if (pct >= 0.92) return "oklch(0.75 0.22 142)";
  if (pct >= 0.80) return "oklch(0.78 0.18 85)";
  if (pct >= 0.65) return "oklch(0.72 0.18 55)";
  return "oklch(0.65 0.01 240)";
}

function StatBar({ val, max, color }: { val: number; max: number; color: string }) {
  const pct = Math.min(100, (val / Math.max(max, 1)) * 100);
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.015 240)" }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatRow({ stat, catColor }: { stat: StatResult; catColor: string }) {
  const valColor = getStatColor(stat.final, stat.max);
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "oklch(0.65 0.01 240)", fontFamily: "'Inter', sans-serif" }}>{stat.attribute}</span>
        <div className="flex items-center gap-2">
          {stat.apSpent > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(0.75 0.22 142 / 0.08)", color: "oklch(0.65 0.12 142)", fontFamily: "'Inter', sans-serif", fontSize: "10px" }}>+{stat.apSpent} AP</span>
          )}
          <span className="text-sm font-bold w-8 text-right" style={{ color: valColor, fontFamily: "'Orbitron', sans-serif", fontSize: "13px" }}>{stat.final}</span>
        </div>
      </div>
      <StatBar val={stat.final} max={stat.max} color={catColor} />
    </div>
  );
}

function CategoryBlock({ name, stats }: { name: string; stats: StatResult[] }) {
  const cfg = CATEGORY_CONFIG[name] ?? { color: "oklch(0.65 0.01 240)", bg: "oklch(0.14 0.015 240)", border: "oklch(0.20 0.02 240)", icon: "◉" };
  const totalAP = stats.reduce((s, r) => s + r.apSpent, 0);
  const numericStats = stats.filter((s) => s.max > 5);
  const avg = numericStats.length > 0 ? Math.round(numericStats.reduce((s, r) => s + r.final, 0) / numericStats.length) : null;

  return (
    <div className="rounded-xl border p-3 mb-3" style={{ background: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{cfg.icon}</span>
          <span className="text-sm font-bold tracking-wider uppercase" style={{ color: cfg.color, fontFamily: "'Rajdhani', sans-serif" }}>{name}</span>
        </div>
        <div className="flex items-center gap-2">
          {avg !== null && <span className="text-lg font-black" style={{ color: cfg.color, fontFamily: "'Orbitron', sans-serif" }}>{avg}</span>}
          {totalAP > 0 && <span className="text-xs px-2 py-0.5 rounded-full border" style={{ background: "oklch(0.75 0.22 142 / 0.08)", borderColor: "oklch(0.75 0.22 142 / 0.2)", color: "oklch(0.65 0.12 142)", fontFamily: "'Inter', sans-serif" }}>{totalAP} AP</span>}
        </div>
      </div>
      {stats.map((stat) => <StatRow key={stat.attribute} stat={stat} catColor={cfg.color} />)}
    </div>
  );
}

export default function PlayerCard({ result, apBudget, archetype }: Props) {
  const efficiency = Math.round((result.totalApSpent / apBudget) * 100);
  const remaining = apBudget - result.totalApSpent;
  const categoryOrder = ["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physicality", "Skill Moves", "Weak Foot"];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.78 0.18 85 / 0.25)", boxShadow: "0 0 30px oklch(0.78 0.18 85 / 0.08)" }}>
      <div className="px-4 py-3 border-b" style={{ background: "oklch(0.78 0.18 85 / 0.08)", borderColor: "oklch(0.78 0.18 85 / 0.2)" }}>
        <div className="text-xs tracking-widest uppercase mb-0.5" style={{ color: "oklch(0.78 0.18 85)", fontFamily: "'Rajdhani', sans-serif" }}>Final Player Card</div>
        <div className="text-xl font-black mb-2" style={{ fontFamily: "'Orbitron', sans-serif", color: "oklch(0.95 0.01 240)" }}>{archetype.toUpperCase()} BUILD</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Budget", value: apBudget.toLocaleString(), color: "oklch(0.65 0.01 240)" },
            { label: "Spent", value: result.totalApSpent.toLocaleString(), color: "oklch(0.75 0.22 142)" },
            { label: "Efficiency", value: `${efficiency}%`, color: remaining === 0 ? "oklch(0.75 0.22 142)" : "oklch(0.78 0.18 85)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-2 text-center border" style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
              <div className="text-xs tracking-wider uppercase mb-0.5" style={{ color: "oklch(0.45 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>{label}</div>
              <div className="text-base font-black" style={{ color, fontFamily: "'Orbitron', sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4">
        {categoryOrder.map((cat) => {
          const stats = result.byCategory[cat];
          if (!stats || stats.length === 0) return null;
          return <CategoryBlock key={cat} name={cat} stats={stats} />;
        })}
      </div>
      <div className="px-4 pb-6 mt-2 border-t border-slate-700 pt-4">
        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Recommended PlayStyle Loadout</h3>
        {!result.playstyles ? (
          <p className="text-[10px] text-gray-500 italic">Calculating PlayStyles...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(result.playstyles.signatures || []).map((sig, i) => (
              <span key={`sig-${i}`} className="px-2 py-1 bg-blue-900/30 border border-blue-500/50 rounded text-[10px] font-bold text-blue-200 uppercase tracking-wider">★ {sig}</span>
            ))}
            {(result.playstyles.standard || []).map((ps, i) => (
              <span key={`std-${i}`} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300 uppercase tracking-wider">{ps}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
