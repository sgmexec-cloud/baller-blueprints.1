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
  level: number;
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

const PlayStyleBadge = ({ name, isSignature }: { name: string; isSignature?: boolean }) => {
  if (!name) return null;
  const isPlus = name.includes('+');
  
  // 👉 Added .trim() to kill ghost spaces from the AI
  let cleanName = name.replace('+', '').trim();
  
  // Auto-hyphenate what the AI gives us (e.g. "DeadBall" -> "dead-ball")
  let fileName = cleanName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/\s+/g, '-');

  // 👉 OVERRIDES: Map AI names to your exact file names
  const OVERRIDES: Record<string, string> = {
    "dead-ball": "deadball",
    "game-changer": "gamechanger",
    "aerial-fortress": "aerial",
  };

  if (OVERRIDES[fileName]) {
    fileName = OVERRIDES[fileName];
  }

  // Restore the space for the text label on the UI
  if (cleanName.toLowerCase() === 'gamechanger') cleanName = 'Game Changer';
  if (cleanName.toLowerCase() === 'deadball') cleanName = 'Dead Ball';

  const imagePath = `/icons/playstyles/${fileName}${isPlus ? '-plus' : ''}.png`;

  const textColor = isSignature || isPlus ? 'text-amber-200' : 'text-slate-200';

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-1">
      <img 
        src={imagePath} 
        alt="" 
        aria-hidden="true"
        className="w-14 h-14 object-contain drop-shadow-lg"
        onError={(e) => { e.currentTarget.src = '/icons/playstyles/fallback.png'; }} 
      />
      <span className={`text-[9px] font-bold uppercase tracking-widest text-center ${textColor}`}>
        ☆ {cleanName}
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

export default function PlayerCard({ result, apBudget, archetype, level }: Props) {
  // 👉 BULLETPROOF SAFETY CHECKS: Guaranteeing numbers so toLocaleString() never fails
  const safeBudget = typeof apBudget === 'number' ? apBudget : 0;
  const safeSpent = typeof result?.totalApSpent === 'number' ? result.totalApSpent : 0;
  const safeLevel = typeof level === 'number' ? level : 1;
  const safeArchetype = archetype || "Unknown";

  const efficiency = safeBudget > 0 ? Math.round((safeSpent / safeBudget) * 100) : 0;
  const remaining = safeBudget - safeSpent;

  return (
    <div className="rounded-xl border overflow-hidden p-4" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.78 0.18 85 / 0.25)" }}>
      <div className="border-b pb-4 mb-4" style={{ borderColor: "oklch(0.78 0.18 85 / 0.2)" }}>
        
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs tracking-widest uppercase" style={{ color: "oklch(0.78 0.18 85)", fontFamily: "'Rajdhani', sans-serif" }}>Final Player Card</div>
          <div className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider" style={{ background: "oklch(0.75 0.22 142 / 0.1)", color: "oklch(0.75 0.22 142)", borderColor: "oklch(0.75 0.22 142 / 0.3)", fontFamily: "'Rajdhani', sans-serif" }}>
            Level {safeLevel}
          </div>
        </div>
        
        <div className="text-xl font-black mb-3" style={{ fontFamily: "'Orbitron', sans-serif", color: "oklch(0.95 0.01 240)" }}>{safeArchetype.toUpperCase()} BUILD</div>
        
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Budget", value: safeBudget.toLocaleString(), color: "oklch(0.65 0.01 240)" },
            { label: "Spent", value: safeSpent.toLocaleString(), color: "oklch(0.75 0.22 142)" },
            { label: "Efficiency", value: `${efficiency}%`, color: remaining <= 0 ? "oklch(0.75 0.22 142)" : "oklch(0.78 0.18 85)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-2 text-center border" style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
              <div className="text-xs tracking-wider uppercase mb-0.5" style={{ color: "oklch(0.45 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>{label}</div>
              <div className="text-base font-black" style={{ color, fontFamily: "'Orbitron', sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4">
        {["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physicality", "Skill Moves", "Weak Foot"].map((cat) => {
          const stats = result?.byCategory?.[cat];
          if (!stats || stats.length === 0) return null;
          return <CategoryBlock key={cat} name={cat} stats={stats} />;
        })}
      </div>

      <div className="mt-8 border-t border-slate-700/50 pt-8 pb-4">
        {!result?.playstyles ? (
          <p className="text-[10px] text-gray-500 italic text-center">Calculating Playstyles...</p>
        ) : (
          <div className="flex flex-col gap-8">
            
            {result.playstyles.signatures && result.playstyles.signatures.length > 0 && (
              <div>
                <h2 className="text-xl font-black text-center text-amber-200 uppercase tracking-widest mb-6" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Signature Playstyles
                </h2>
                <div className="grid grid-cols-2 gap-y-6 gap-x-2">
                  {result.playstyles.signatures.map((sig, i) => (
                    <PlayStyleBadge key={`sig-${i}`} name={sig} isSignature={true} />
                  ))}
                </div>
              </div>
            )}

            {result.playstyles.standard && result.playstyles.standard.length > 0 && (
              <div>
                <h2 className="text-xl font-black text-center text-slate-200 uppercase tracking-widest mb-6" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  Playstyles
                </h2>
                <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                  {result.playstyles.standard.map((ps, i) => (
                    <PlayStyleBadge key={`std-${i}`} name={ps} isSignature={false} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
