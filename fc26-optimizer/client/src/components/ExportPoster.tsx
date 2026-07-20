import React from "react";
import type { MathEngineResult, StatResult } from "../../../server/mathEngine";
import type { Blueprint } from "../../../server/routers/scout";

interface Props {
  blueprint: Blueprint;
  result: MathEngineResult & {
    playstyles?: {
      signatures: string[];
      standard: string[];
      specialisation: string | null;
    };
  };
  apBudget: number;
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  Pace: { color: "#22c55e", icon: "⚡" },
  Shooting: { color: "#ef4444", icon: "🎯" },
  Passing: { color: "#3b82f6", icon: "🔵" },
  Dribbling: { color: "#eab308", icon: "✦" },
  Defending: { color: "#a855f7", icon: "🛡" },
  Physicality: { color: "#f97316", icon: "💪" },
};

export default function ExportPoster({ blueprint, result, apBudget }: Props) {
  const safeBudget = typeof apBudget === 'number' ? apBudget : 0;
  const safeSpent = typeof result?.totalApSpent === 'number' ? result.totalApSpent : 0;
  
  return (
    <div
      id="export-poster"
      style={{
        width: "1080px",
        backgroundColor: "#050505",
        color: "#ffffff",
        padding: "48px",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Safe Background Glow */}
      <div style={{ position: "absolute", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "1000px", height: "600px", background: "radial-gradient(circle, rgba(217, 70, 239, 0.15) 0%, rgba(5, 5, 5, 0) 70%)", pointerEvents: "none" }} />

      <h1 style={{ fontSize: "42px", fontWeight: 900, textTransform: "uppercase" }}>{blueprint.archetype} BUILD</h1>
      <p style={{ color: "#6b7280" }}>Budget: {safeBudget.toLocaleString()} AP | Spent: {safeSpent.toLocaleString()} AP</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "40px" }}>
        {Object.entries(CATEGORY_CONFIG).map(([catName, cfg]) => {
          const stats = result?.byCategory?.[catName];
          if (!stats) return null;
          return (
            <div key={catName} style={{ backgroundColor: "rgba(17, 17, 17, 0.8)", padding: "20px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h2 style={{ color: cfg.color, fontSize: "16px", textTransform: "uppercase" }}>{cfg.icon} {catName}</h2>
              {stats.map((s: StatResult) => (
                <div key={s.attribute} style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                  <span>{s.attribute}</span>
                  <span style={{ fontWeight: "bold" }}>{s.final}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
