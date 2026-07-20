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
  "Skill Moves": { color: "#ec4899", icon: "★" },
  "Weak Foot": { color: "#06b6d4", icon: "◆" },
};

export default function ExportPoster({ blueprint, result, apBudget }: Props) {
  const safeBudget = typeof apBudget === 'number' ? apBudget : 0;
  const safeSpent = typeof result?.totalApSpent === 'number' ? result.totalApSpent : 0;
  const allPlaystyles = [
    ...(result?.playstyles?.signatures?.map(name => ({ name, isSignature: true })) || []),
    ...(result?.playstyles?.standard?.map(name => ({ name, isSignature: false })) || [])
  ];

  return (
    <div
      id="export-poster"
      style={{
        width: "1080px",
        backgroundColor: "#000000",
        color: "#ffffff",
        padding: "48px",
        fontFamily: "sans-serif"
      }}
    >
      {/* Header */}
      <h1 style={{ fontSize: "40px", marginBottom: "20px" }}>{blueprint.archetype} BUILD</h1>
      <p>Budget: {safeBudget} | Spent: {safeSpent}</p>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "40px" }}>
        {["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physicality"].map((catName) => {
          const stats = result?.byCategory?.[catName];
          if (!stats) return null;
          return (
            <div key={catName} style={{ border: "1px solid #333", padding: "10px" }}>
              <h2 style={{ color: CATEGORY_CONFIG[catName].color }}>{catName}</h2>
              {stats.map((s: StatResult) => (
                <div key={s.attribute}>{s.attribute}: {s.final}</div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Playstyles (Text only for Isolation Test) */}
      <div style={{ marginTop: "40px" }}>
        <h3>Playstyles</h3>
        {allPlaystyles.map((ps, i) => (
          <div key={i}>{ps.name}</div>
        ))}
      </div>
    </div>
  );
}
