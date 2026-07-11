import type { Blueprint } from "../../../server/routers/scout";
import type { MathEngineResult } from "../../../server/mathEngine";

interface Props {
  blueprint: Blueprint;
  result: MathEngineResult;
  apBudget: number;
}

// EA FC 26 Standard Category Mapping
const CATEGORIES = {
  PACE: { color: "#22c55e", attrs: ["Acceleration", "SprintSpeed"] },
  SHOOTING: { color: "#ef4444", attrs: ["AttackPositioning", "Finishing", "ShotPower", "LongShots", "Volleys", "Penalties"] },
  PASSING: { color: "#3b82f6", attrs: ["Vision", "Crossing", "FKAccuracy", "ShortPassing", "LongPassing", "Curve"] },
  DRIBBLING: { color: "#eab308", attrs: ["Agility", "Balance", "Reactions", "BallControl", "Dribbling", "Composure"] },
  DEFENDING: { color: "#a855f7", attrs: ["Interceptions", "HeadingAccuracy", "DefAwareness", "StandingTackle", "SlidingTackle"] },
  PHYSICALITY: { color: "#f97316", attrs: ["Jumping", "Stamina", "Strength", "Aggression"] },
  TRAITS: { color: "#06b6d4", attrs: ["Skill Moves", "Weak foot"] },
};

export default function ExportPoster({ blueprint, result, apBudget }: Props) {
  const stats = (result as any).stats || result;

  // Bulletproof Stat Finder
  const getStat = (targetAttr: string) => {
    const target = targetAttr.toLowerCase().replace(/\s/g, '');
    if (Array.isArray(stats)) {
      return stats.find((s: any) => {
         const name = (s.name || s.attribute || s.attr || "").toLowerCase().replace(/\s/g, '');
         return name === target;
      });
    } else {
      const key = Object.keys(stats).find(k => k.toLowerCase().replace(/\s/g, '') === target);
      return key ? stats[key] : undefined;
    }
  };

  // Safely calculate the totals ourselves just in case
  let calculatedSpent = 0;
  if (Array.isArray(stats)) {
    stats.forEach((stat: any) => { if (typeof stat.apSpent === 'number') calculatedSpent += stat.apSpent; });
  } else {
    Object.values(stats).forEach((stat: any) => { if (stat && typeof stat.apSpent === 'number') calculatedSpent += stat.apSpent; });
  }

  const finalSpent = (result as any).summary?.totalApSpent ?? calculatedSpent;
  const finalEfficiency = (result as any).summary?.efficiency ?? (apBudget > 0 ? (finalSpent / apBudget) * 100 : 0);

  return (
    <div
      id="export-poster"
      style={{
        width: "1080px",
        height: "1350px", // Strict 4:5 Aspect Ratio for Social Media
        boxSizing: "border-box", 
        backgroundColor: "#050505",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        padding: "40px", 
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between", 
        position: "relative",
      }}
    >
      {/* Header Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#111", padding: "24px 30px", borderRadius: "16px", border: "1px solid #333" }}>
        <div>
          <h2 style={{ margin: 0, color: "#aaa", fontSize: "20px", letterSpacing: "4px", textTransform: "uppercase" }}>Final Player Card</h2>
          <h1 style={{ margin: "8px 0 0 0", fontSize: "42px", color: "#fff", textTransform: "uppercase", letterSpacing: "2px" }}>{blueprint.archetype} BUILD</h1>
        </div>
        <div style={{ display: "flex", gap: "40px", textAlign: "right" }}>
          <div>
            <div style={{ color: "#aaa", fontSize: "16px", letterSpacing: "2px" }}>BUDGET</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#fff" }}>{apBudget.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: "#aaa", fontSize: "16px", letterSpacing: "2px" }}>SPENT</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#22c55e" }}>{finalSpent.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: "#aaa", fontSize: "16px", letterSpacing: "2px" }}>EFFICIENCY</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#eab308" }}>{finalEfficiency.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Attributes Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {Object.entries(CATEGORIES).map(([catName, catData]) => {
          const activeAttrs = catData.attrs.filter((attr) => getStat(attr));
          if (activeAttrs.length === 0) return null;

          return (
            <div key={catName} style={{ backgroundColor: "#111", padding: "16px", borderRadius: "12px", border: `1px solid #222` }}>
              <h3 style={{ margin: "0 0 12px 0", color: catData.color, fontSize: "18px", letterSpacing: "2px", fontWeight: "bold" }}>{catName}</h3>
              {activeAttrs.map((attr) => {
                const stat = getStat(attr);
                if (!stat) return null;
                
                const finalStatValue = stat.total ?? stat.value ?? stat.final ?? stat.finalValue ?? stat.rating ?? 0;
                const widthPct = Math.min(100, Math.max(0, (finalStatValue / 99) * 100));
                
                return (
                  <div key={attr} style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "15px", marginBottom: "4px" }}>
                      <span style={{ color: "#ccc", fontWeight: "500" }}>{attr}</span>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span style={{ color: catData.color, fontSize: "11px", fontWeight: "bold" }}>+{stat.apSpent || 0} AP</span>
                        <span style={{ fontWeight: "900", fontSize: "16px", width: "24px", textAlign: "right", color: finalStatValue >= 90 ? catData.color : "#fff" }}>
                          {finalStatValue}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: "5px", backgroundColor: "#333", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${widthPct}%`, height: "100%", backgroundColor: catData.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* PlayStyles Section */}
      <div style={{ backgroundColor: "#111", padding: "24px 30px", borderRadius: "16px", border: "1px solid #333" }}>
        <div style={{ display: "flex", gap: "40px" }}>
          {/* PlayStyle+ */}
          <div style={{ flex: 1 }}>
            <h3 style={{ color: "#fbbf24", margin: "0 0 12px 0", letterSpacing: "2px", fontWeight: "bold", fontSize: "16px" }}>★ PLAYSTYLE+</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {blueprint.playstylePlus.map((ps) => (
                <div key={ps} style={{ backgroundColor: "#382c0a", color: "#fbbf24", padding: "6px 14px", borderRadius: "8px", border: "1px solid #785a0c", fontSize: "16px", fontWeight: "bold" }}>
                  {ps}
                </div>
              ))}
              {blueprint.specialisationPlaystylePlus && (
                <div style={{ backgroundColor: "#2e1065", color: "#d8b4fe", padding: "6px 14px", borderRadius: "8px", border: "1px solid #6b21a8", fontSize: "16px", fontWeight: "bold" }}>
                  {blueprint.specialisationPlaystylePlus} (Spec)
                </div>
              )}
            </div>
          </div>
          
          {/* Standard PlayStyles */}
          <div style={{ flex: 2 }}>
            <h3 style={{ color: "#3b82f6", margin: "0 0 12px 0", letterSpacing: "2px", fontWeight: "bold", fontSize: "16px" }}>STANDARD PLAYSTYLES</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {blueprint.playstyles.map((ps) => (
                <div key={ps.name} style={{ backgroundColor: "#0f172a", color: "#93c5fd", padding: "6px 14px", borderRadius: "8px", border: "1px solid #1e3a8a", fontSize: "15px", fontWeight: "500" }}>
                  {ps.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Watermark */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <img 
          src="/clubdna-logo.png" 
          alt="ClubDNA" 
          style={{ height: "60px", objectFit: "contain" }} 
        />
      </div>
    </div>
  );
}
