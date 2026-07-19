import type { MathEngineResult, StatResult } from "../../../server/mathEngine";

interface Props {
  result: MathEngineResult & {
    scoutSummary?: string;
    playstyles?: {
      signatures: string[];
      standard: string[];
      specialisation: string | null;
    };
  };
  apBudget: number;
  archetype: string;
}

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  Pace: { color: "oklch(0.75 0.22 142)", bg: "oklch(0.75 0.22 142 / 0.08)", border: "oklch(0.75 0.22 142 / 0.25)", icon: "⚡" },
  Shooting: { color: "oklch(0.65 0.22 25)", bg: "oklch(0.65 0.22 25 / 0.08)", border: "oklch(0.65 0.22 25 / 0.25)", icon: "🎯" },
  Passing: { color: "oklch(0.65 0.20 230)", bg: "oklch(0.65 0.20 230 / 0.08)", border: "oklch(0.65 0.20 230 / 0.25)", icon: "🔵" },
  Dribbling: { color: "oklch(0.78 0.18 85)", bg: "oklch(0.78 0.18 85 / 0.08)", border: "oklch(0.78 0.18 85 / 0.25)", icon: "✦" },
  Defending: { color: "oklch(0.70 0.15 300)", bg: "oklch(0.70 0.15 300 / 0.08)", border: "oklch(0.70 0.15 300 / 0.25)", icon: "🛡" },
  Physicality: { color: "oklch(0.72 0.18 55)", bg: "oklch(0.72 0.18 55 / 0.08)", border: "oklch(0.72 0.18 55 / 0.25)", icon: "💪" },
  "Skill Moves": { color: "oklch(0.75 0.22 142)", bg: "oklch(0.75 0.22 142 / 0.06)", border: "oklch(0.75 0.22 142 / 0.2)", icon: "★" },
  "Weak Foot": { color: "oklch(0.65 0.20 230)", bg: "oklch(0.65 0.20 230 / 0.06)", border: "oklch(0.65 0.20 230 / 0.2)", icon: "◆" },
};

const PlayStyleBadge = ({ name }: { name: string }) => {
  const isPlus = name.includes('+');
  
  // 1. Clean the name: remove '+', handle common "squashed" names 
  // 2. Add spaces before capital letters (like FirstTouch -> First Touch) so they map to kebab-case
  let cleanName = name.replace('+', '').replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // 3. Convert to kebab-case (e.g., "First Touch" -> "first-touch")
  const fileName = cleanName
    .toLowerCase()
    .replace(/\s+/g, '-');

  const imagePath = `/icons/playstyles/${fileName}${isPlus ? '-plus' : ''}.png`;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${isPlus ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-800 border-slate-700'}`}>
      <img 
        src={imagePath} 
        alt={name} 
        className="w-4 h-4 object-contain"
        onError={(e) => { 
            // Debugging tip: Log which file failed in the browser console
            console.error(`Failed to load: ${imagePath}`);
            e.currentTarget.src = '/icons/playstyles/fallback.png'; 
        }} 
      />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${isPlus ? 'text-amber-200' : 'text-slate-300'}`}>
        {isPlus ? `★ ${name.replace('+', '')}` : name}
      </span>
    </div>
  );
};


function StatBar({ val, max, color }: { val: number; max: number; color: string }) {
  const pct = Math.min(100, (val / Math.max(max, 1)) * 100);
  return <div className="h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.015 240)" }}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} /></div>;
}

function StatRow({ stat, catColor }: { stat: StatResult; catColor: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "oklch(0.65 0.01 240)" }}>{stat.attribute}</span>
        <div className="flex items-center gap-2">
           {stat.apSpent > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.75 0.22 142 / 0.1)", color: "oklch(0.75 0.22 142)" }}>+{stat.apSpent} AP</span>}
           <span className="text-sm font-bold w-8 text-right" style={{ color: "oklch(0.95 0.01 240)" }}>{stat.final}</span>
        </div>
      </div>
      <StatBar val={stat.final} max={stat.max} color={catColor} />
    </div>
  );
}

function CategoryBlock({ name, stats }: { name: string; stats: StatResult[] }) {
  const cfg = CATEGORY_CONFIG[name] ?? { color: "#888", bg: "#111", border: "#222", icon: "◉" };
  return (
    <div className="rounded-xl border p-3 mb-3" style={{ background: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center gap-2 mb-3"><span>{cfg.icon}</span><span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{name}</span></div>
      {stats.map((stat) => <StatRow key={stat.attribute} stat={stat} catColor={cfg.color} />)}
    </div>
  );
}

export default function PlayerCard({ result, apBudget, archetype }: Props) {
  const efficiency = Math.round((result.totalApSpent / apBudget) * 100);
  return (
    <div className="rounded-xl border overflow-hidden p-4" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.78 0.18 85 / 0.25)" }}>
      <div className="text-xl font-black mb-4" style={{ fontFamily: "'Orbitron', sans-serif", color: "oklch(0.95 0.01 240)" }}>{archetype.toUpperCase()} BUILD</div>
      
      <div className="mt-4">
        {["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physicality", "Skill Moves", "Weak Foot"].map((cat) => {
          const stats = result.byCategory[cat];
          if (!stats || stats.length === 0) return null;
          return <CategoryBlock key={cat} name={cat} stats={stats} />;
        })}
      </div>

      <div className="mt-4 border-t border-slate-700 pt-4 pb-2">
        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Recommended PlayStyle Loadout</h3>
        {!result.playstyles ? <p className="text-[10px] text-gray-500 italic">Calculating...</p> : (
          <div className="grid grid-cols-2 gap-2">
            {result.playstyles.signatures.map((sig, i) => <PlayStyleBadge key={`sig-${i}`} name={sig} />)}
            {result.playstyles.standard.map((ps, i) => <PlayStyleBadge key={`std-${i}`} name={ps} />)}
          </div>
        )}
      </div>
    </div>
  );
}
