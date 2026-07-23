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
  // 👉 NEW: Added level to properly display it on the export
  level: number; 
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

const PlayStyleBadge = ({ name, isSignature }: { name: string; isSignature?: boolean }) => {
  if (!name) return null;
  const isPlus = name.includes('+');
  const isGold = isSignature || isPlus;
  
  let cleanName = name.replace('+', '').trim();
  let fileName = cleanName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/\s+/g, '-');

  const OVERRIDES: Record<string, string> = {
    "dead-ball": "deadball",
    "deadball": "deadball",
    "gamechanger": "game-changer",
    "game-changer": "game-changer",
    "aerial-fortress": "aerial",
    "aerial": "aerial"
  };

  if (OVERRIDES[fileName]) {
    fileName = OVERRIDES[fileName];
  }

  const rawName = cleanName.replace(/\s+/g, '').toLowerCase();
  if (rawName === 'gamechanger') cleanName = 'Game Changer';
  if (rawName === 'deadball') cleanName = 'Dead Ball';

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const imagePath = `${baseUrl}/icons/playstyles/${fileName}${isPlus ? '-plus' : ''}.png`;

  const borderColor = isGold ? "#b45309" : "#1e3a8a"; 
  const bgColor = isGold ? "#291304" : "#0a1121";
  const textColor = isGold ? "#fcd34d" : "#93c5fd";
  const iconColor = isGold ? "#fbbf24" : "#ffffff";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 10px",
      borderRadius: "6px",
      border: `1px solid ${borderColor}`,
      backgroundColor: bgColor,
      color: textColor,
    }}>
      <div style={{ width: "20px", height: "20px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img 
          src={imagePath} 
          alt="" 
          loading="eager"
          decoding="sync"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          onError={(e) => { 
            e.currentTarget.style.display = 'none';
            e.currentTarget.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
          }} 
        />
      </div>
      <span style={{ fontSize: "14px", color: iconColor }}>
        {isGold ? '★' : '◆'}
      </span>
      <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'Rajdhani', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {cleanName}{isPlus ? '+' : ''}
      </span>
    </div>
  );
};

export default function ExportPoster({ blueprint, result, apBudget, level }: Props) {
  const safeBudget = typeof apBudget === 'number' ? apBudget : 0;
  const safeSpent = typeof result?.totalApSpent === 'number' ? result.totalApSpent : 0;
  const safeLevel = typeof level === 'number' ? level : 1;
  const efficiency = safeBudget > 0 ? (safeSpent / safeBudget) * 100 : 0;
  
  const allPlaystyles = [
    ...(result?.playstyles?.signatures?.map(name => ({ name, isSignature: true })) || []),
    ...(result?.playstyles?.standard?.map(name => ({ name, isSignature: false })) || [])
  ];

  return (
    <div
      id="export-poster"
      style={{
        width: "1080px",
        height: "1350px", // 👉 Hard-locked to exact 4:5 social media aspect ratio
        boxSizing: "border-box", 
        backgroundColor: "#050505",
        color: "#ffffff",
        fontFamily: "'Inter', sans-serif",
        padding: "40px 48px", 
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div style={{ position: "absolute", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "1000px", height: "600px", background: "radial-gradient(circle, rgba(217, 70, 239, 0.15) 0%, rgba(5, 5, 5, 0) 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(17, 17, 17, 0.8)", padding: "20px 28px", borderRadius: "16px", border: "1px solid #333", zIndex: 10, marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <img 
              src={`${typeof window !== 'undefined' ? window.location.origin : ''}/clubdna-logo.png`} 
              alt="ClubDNA" 
              loading="eager" 
              decoding="sync" 
              style={{ height: "28px", objectFit: "contain" }} 
              onError={(e) => { 
                e.currentTarget.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
              }}
            />
            <div style={{ width: "1px", height: "16px", backgroundColor: "#333" }} />
            <h2 style={{ margin: 0, color: "#d946ef", fontSize: "12px", letterSpacing: "4px", textTransform: "uppercase", fontFamily: "'Rajdhani', sans-serif", fontWeight: "bold" }}>
              Final Player Card
            </h2>
          </div>
          <h1 style={{ margin: 0, fontSize: "36px", color: "#fff", textTransform: "uppercase", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif", fontWeight: 900 }}>
            {blueprint.archetype} BUILD
          </h1>
          {/* 👉 NEW: Physical properties locked in below the build title */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "8px", fontSize: "14px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "2px", fontFamily: "'Rajdhani', sans-serif", fontWeight: "bold" }}>
            <span>{blueprint.heightRange}</span>
            <span style={{ color: "#4b5563" }}>|</span>
            <span>{blueprint.weightRange}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", textAlign: "center" }}>
          {/* 👉 NEW: Added Level stat block seamlessly next to the others */}
          <div style={{ backgroundColor: "#111", padding: "10px 16px", borderRadius: "10px", border: "1px solid #222" }}>
            <div style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'Rajdhani', sans-serif", fontWeight: "bold" }}>Level</div>
            <div style={{ fontSize: "24px", fontWeight: "900", color: "#d946ef", fontFamily: "'Orbitron', sans-serif" }}>{safeLevel}</div>
          </div>
          <div style={{ backgroundColor: "#111", padding: "10px 16px", borderRadius: "10px", border: "1px solid #222" }}>
            <div style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'Rajdhani', sans-serif", fontWeight: "bold" }}>Budget</div>
            <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff", fontFamily: "'Orbitron', sans-serif" }}>{safeBudget.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: "#111", padding: "10px 16px", borderRadius: "10px", border: "1px solid #222" }}>
            <div style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'Rajdhani', sans-serif", fontWeight: "bold" }}>Spent</div>
            <div style={{ fontSize: "24px", fontWeight: "900", color: "#22c55e", fontFamily: "'Orbitron', sans-serif" }}>{safeSpent.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: "#111", padding: "10px 16px", borderRadius: "10px", border: "1px solid #222" }}>
            <div style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'Rajdhani', sans-serif", fontWeight: "bold" }}>Efficiency</div>
            <div style={{ fontSize: "24px", fontWeight: "900", color: "#eab308", fontFamily: "'Orbitron', sans-serif" }}>{Math.round(efficiency)}%</div>
          </div>
        </div>
      </div>

      {/* 👉 Changed to a compact 3-column layout to save massive vertical space */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", zIndex: 10, flexGrow: 1 }}>
        {["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physicality", "Skill Moves", "Weak Foot"].map((catName) => {
          const stats = result?.byCategory?.[catName];
          if (!stats || stats.length === 0) return null;
          const cfg = CATEGORY_CONFIG[catName] || { color: "#888", icon: "◉" };

          return (
            <div key={catName} style={{ backgroundColor: "rgba(17, 17, 17, 0.6)", padding: "16px", borderRadius: "12px", border: `1px solid rgba(255,255,255,0.05)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "16px" }}>{cfg.icon}</span>
                <h3 style={{ margin: 0, color: cfg.color, fontSize: "14px", letterSpacing: "2px", fontWeight: "bold", textTransform: "uppercase", fontFamily: "'Rajdhani', sans-serif" }}>
                  {catName}
                </h3>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {stats.map((stat: StatResult) => {
                  const pct = Math.min(100, Math.max(0, (stat.final / Math.max(stat.max, 1)) * 100));
                  
                  return (
                    <div key={stat.attribute}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ color: "#9ca3af", fontSize: "12px", fontWeight: "500" }}>{stat.attribute}</span>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          {stat.apSpent > 0 && (
                            <span style={{ color: cfg.color, fontSize: "10px", fontWeight: "bold", backgroundColor: `${cfg.color}15`, padding: "2px 4px", borderRadius: "4px" }}>
                              +{stat.apSpent} AP
                            </span>
                          )}
                          <span style={{ fontWeight: "900", fontSize: "16px", width: "24px", textAlign: "right", color: stat.final >= 90 ? cfg.color : "#fff", fontFamily: "'Orbitron', sans-serif" }}>
                            {stat.final}
                          </span>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: "4px", backgroundColor: "#222", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: cfg.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {allPlaystyles.length > 0 && (
        <div style={{ zIndex: 10, marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #333" }}>
          <h3 style={{ color: "#22c55e", margin: "0 0 12px 0", letterSpacing: "3px", fontWeight: "bold", fontSize: "12px", textTransform: "uppercase", fontFamily: "'Rajdhani', sans-serif" }}>
            Recommended Playstyle Loadout
          </h3>
          {/* 👉 Uses a 5-column grid for playstyles so Level 100 builds fit cleanly */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
            {allPlaystyles.map((ps, i) => (
              <PlayStyleBadge key={`ps-${i}`} name={ps.name} isSignature={ps.isSignature} />
            ))}
          </div>
        </div>
      )}
      
      <div style={{ zIndex: 10, marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#6b7280", fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "bold" }}>
        <span>Generated by ClubDNA Engine</span>
        <span>clubdna.io</span>
      </div>
    </div>
  );
}
