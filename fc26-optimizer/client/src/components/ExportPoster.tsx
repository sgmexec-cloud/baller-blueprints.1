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
  const { stats, summary } = result;

  return (
    <div
      id="export-poster"
      style={{
        width: "1080px", // Fixed width for high-quality social media export
        backgroundColor: "#050505",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        padding: "40px",
        position: "relative",
      }}
    >
      {/* Header Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#111", padding: "30px", borderRadius: "16px", border: "1px solid #333", marginBottom: "40px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#aaa", fontSize: "24px", letterSpacing: "4px", textTransform: "uppercase" }}>Final Player Card</h2>
          <h1 style={{ margin: "10px 0 0 0", fontSize: "48px", color: "#fff", textTransform: "uppercase", letterSpacing: "2px" }}>{blueprint.archetype} BUILD</h1>
        </div>
        <div style={{ display: "flex", gap: "40px", textAlign: "right" }}>
          <div>
            <div style={{ color: "#aaa", fontSize: "18px", letterSpacing: "2px" }}>BUDGET</div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#fff" }}>{apBudget.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: "#aaa", fontSize: "18px", letterSpacing: "2px" }}>SPENT</div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#22c55e" }}>{summary.totalApSpent.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: "#aaa", fontSize: "18px", letterSpacing: "2px" }}>EFFICIENCY</div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#eab308" }}>{summary.efficiency.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Attributes Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "30px", marginBottom: "40px" }}>
        {Object.entries(CATEGORIES).map(([catName, catData]) => {
          // Filter out attributes that might not be in this build's stats
          const activeAttrs = catData.attrs.filter((attr) => stats[attr]);
          if (activeAttrs.length === 0) return null;

          return (
            <div key={catName} style={{ backgroundColor: "#111", padding: "20px", borderRadius: "12px", border: `1px solid #222` }}>
              <h3 style={{ margin: "0 0 20px 0", color: catData.color, fontSize: "20px", letterSpacing: "2px" }}>{catName}</h3>
              {activeAttrs.map((attr) => {
                const stat = stats[attr];
                const widthPct = Math.min(100, Math.max(0, (stat.total / 99) * 100));
                return (
                  <div key={attr} style={{ marginBottom: "15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", marginBottom: "5px" }}>
                      <span style={{ color: "#ccc" }}>{attr}</span>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <span style={{ color: catData.color, fontSize: "12px", alignSelf: "center" }}>+{stat.apSpent} AP</span>
                        <span style={{ fontWeight: "bold", width: "30px", textAlign: "right", color: stat.total >= 90 ? catData.color : "#fff" }}>
                          {stat.total}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#333", borderRadius: "3px", overflow: "hidden" }}>
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
      <div style={{ backgroundColor: "#111", padding: "30px", borderRadius: "16px", border: "1px solid #333" }}>
        <div style={{ display: "flex", gap: "40px" }}>
          {/* PlayStyle+ */}
          <div style={{ flex: 1 }}>
            <h3 style={{ color: "#fbbf24", margin: "0 0 15px 0", letterSpacing: "2px" }}>★ PLAYSTYLE+</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {blueprint.playstylePlus.map((ps) => (
                <div key={ps} style={{ backgroundColor: "#382c0a", color: "#fbbf24", padding: "8px 16px", borderRadius: "8px", border: "1px solid #785a0c", fontSize: "18px", fontWeight: "bold" }}>
                  {ps}
                </div>
              ))}
              {blueprint.specialisationPlaystylePlus && (
                <div style={{ backgroundColor: "#2e1065", color: "#d8b4fe", padding: "8px 16px", borderRadius: "8px", border: "1px solid #6b21a8", fontSize: "18px", fontWeight: "bold" }}>
                  {blueprint.specialisationPlaystylePlus} (Spec)
                </div>
              )}
            </div>
          </div>
          
          {/* Standard PlayStyles */}
          <div style={{ flex: 2 }}>
            <h3 style={{ color: "#3b82f6", margin: "0 0 15px 0", letterSpacing: "2px" }}>STANDARD PLAYSTYLES</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {blueprint.playstyles.map((ps) => (
                <div key={ps.name} style={{ backgroundColor: "#0f172a", color: "#93c5fd", padding: "8px 16px", borderRadius: "8px", border: "1px solid #1e3a8a", fontSize: "16px" }}>
                  {ps.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Watermark */}
      <div style={{ textAlign: "center", marginTop: "40px", color: "#444", fontSize: "20px", letterSpacing: "4px", fontWeight: "bold" }}>
        FC 26 OPTIMIZER
      </div>
    </div>
  );
}
