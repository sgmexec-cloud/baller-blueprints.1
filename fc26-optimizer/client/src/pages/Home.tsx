import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toPng } from "html-to-image";
import ScoutingReport from "@/components/ScoutingReport";
import PlayerCard from "@/components/PlayerCard";
import ExportPoster from "@/components/ExportPoster";
import type { Blueprint } from "../../../server/routers/scout";
import type { MathEngineResult } from "../../../server/mathEngine";

// ── Loading spinner ────────────────────────────────────────────────────────────
function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "oklch(0.75 0.22 142)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div
          className="absolute inset-2 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "oklch(0.65 0.20 230)",
            animation: "spin 1.2s linear infinite reverse",
          }}
        />
        <div
          className="absolute inset-4 rounded-full"
          style={{ background: "oklch(0.75 0.22 142 / 0.15)" }}
        />
      </div>
      <p
        className="text-sm tracking-widest uppercase animate-pulse"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          color: "oklch(0.75 0.22 142)",
        }}
      >
        {label}
      </p>

      {/* Sponsored Loading Banner */}
      <a
        href="https://www.u7buy.com/fc26/fc26-coins?referral-code=xbRz7JOo"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 w-full max-w-xs px-4 py-3 rounded-lg border transition-all duration-200 hover:scale-105 hover:shadow-lg"
        style={{
          background: "linear-gradient(135deg, oklch(0.78 0.18 85 / 0.15) 0%, oklch(0.75 0.22 142 / 0.1) 100%)",
          borderColor: "oklch(0.78 0.18 85 / 0.4)",
          boxShadow: "0 0 16px oklch(0.78 0.18 85 / 0.2), inset 0 1px 1px oklch(0.95 0.01 240 / 0.1)",
        }}
      >
        <p
          className="text-xs font-bold text-center tracking-wide"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            color: "oklch(0.78 0.18 85)",
          }}
        >
          📢 SPONSORED: Buy FC 26 Coins - Cheap, Fast &amp; Safe. Trusted 10+ Years (5% Tax Covered).
        </p>
      </a>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Hero header ────────────────────────────────────────────────────────────────
function HeroHeader() {
  return (
    <header className="relative overflow-hidden pt-8 pb-6 px-4 text-center">
      {/* Premium VIP Button */}
      <div className="absolute top-4 right-4 z-20">
        <a
          href="https://discord.gg/ZEypgpczDH"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-200 hover:scale-110 hover:shadow-lg"
          style={{
            background: "linear-gradient(135deg, oklch(0.78 0.18 85) 0%, oklch(0.75 0.22 142) 100%)",
            color: "oklch(0.08 0.01 240)",
            boxShadow: "0 0 20px oklch(0.78 0.18 85 / 0.4), inset 0 1px 2px oklch(0.95 0.01 240 / 0.2)",
            fontFamily: "'Rajdhani', sans-serif",
          }}
        >
          👑 Unlock Premium Features &amp; VIP Blueprints
        </a>
      </div>

      {/* Background grid lines */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.75 0.22 142) 1px, transparent 1px), linear-gradient(90deg, oklch(0.75 0.22 142) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 opacity-20 blur-3xl"
        style={{ background: "oklch(0.75 0.22 142)" }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* ClubDNA Logo */}
        <img 
          src="/clubdna-logo.png" 
          alt="ClubDNA - Remove Opinion. Build With Data." 
          className="w-auto h-40 md:h-48 object-contain mb-4 drop-shadow-2xl"
        />
        <p
          className="text-sm max-w-xs mx-auto"
          style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'Inter', sans-serif" }}
        >
          AI-powered scouting &amp; build calculator for the perfect player
        </p>
      </div>
    </header>
  );
}

// ── Phase indicator ────────────────────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      {[1, 2].map((p) => (
        <div key={p} className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-300"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              background:
                p === phase
                  ? "oklch(0.75 0.22 142)"
                  : p < phase
                  ? "oklch(0.75 0.22 142 / 0.3)"
                  : "oklch(0.20 0.02 240)",
              color:
                p === phase
                  ? "oklch(0.08 0.01 240)"
                  : p < phase
                  ? "oklch(0.75 0.22 142)"
                  : "oklch(0.45 0.01 240)",
              boxShadow: p === phase ? "0 0 12px oklch(0.75 0.22 142 / 0.5)" : "none",
            }}
          >
            {p < phase ? "✓" : p}
          </div>
          <span
            className="text-xs font-bold tracking-wider uppercase"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              color:
                p === phase
                  ? "oklch(0.75 0.22 142)"
                  : p < phase
                  ? "oklch(0.55 0.10 142)"
                  : "oklch(0.40 0.01 240)",
            }}
          >
            {p === 1 ? "Scout" : "Build"}
          </span>
          {p === 1 && (
            <div
              className="w-6 h-px mx-1"
              style={{
                background:
                  phase > 1
                    ? "oklch(0.75 0.22 142 / 0.5)"
                    : "oklch(0.20 0.02 240)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [playerIdentity, setPlayerIdentity] = useState("");
  const [apBudget, setApBudget] = useState<number>(5000);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [playerCard, setPlayerCard] = useState<MathEngineResult | null>(null);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [isExporting, setIsExporting] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const scoutMutation = trpc.scout.generateReport.useMutation({
    onSuccess: (data) => {
      setBlueprint(data);
      setPlayerCard(null);
      setPhase(2);
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    onError: (error) => {
      alert(`Backend Crash: ${error.message}`);
      console.error("Scout Error:", error);
    }
  });

  const calcMutation = trpc.scout.calculateStats.useMutation({
    onSuccess: (data) => {
      setPlayerCard(data);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
  });

  const handleScout = () => {
    if (!playerIdentity.trim()) return;
    setBlueprint(null);
    setPlayerCard(null);
    setPhase(1);
    scoutMutation.mutate({ playerIdentity: playerIdentity.trim() });
  };

  const handleCalculate = () => {
    if (!blueprint || apBudget <= 0) return;
    calcMutation.mutate({ blueprint, apBudget });
  };

  const handleReset = () => {
    setBlueprint(null);
    setPlayerCard(null);
    setPhase(1);
    setPlayerIdentity("");
    setApBudget(5000);
  };

  // The Magic Camera Function
  const handleDownloadImage = async () => {
    const node = document.getElementById("export-poster");
    if (!node || !blueprint) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await toPng(node, { 
        quality: 1.0, 
        pixelRatio: 2, 
        backgroundColor: '#000000' 
      });
      const link = document.createElement("a");
      link.download = `${blueprint.archetype}-FC26-Build.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image", err);
      alert("Failed to export image. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      
      {/* ── THE HIDDEN POSTER (Rendered off-screen) ── */}
      {blueprint && playerCard && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <ExportPoster blueprint={blueprint} result={playerCard} apBudget={apBudget} />
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pb-16">
        <HeroHeader />

        {/* ── Phase 1: Scouting Input ─────────────────────────────────────── */}
        <section className="mb-6">
          <PhaseIndicator phase={phase} />

          <div
            className="rounded-xl p-4 border"
            style={{
              background: "oklch(0.11 0.015 240)",
              borderColor:
                phase === 1
                  ? "oklch(0.75 0.22 142 / 0.3)"
                  : "oklch(0.20 0.02 240)",
              boxShadow:
                phase === 1
                  ? "0 0 20px oklch(0.75 0.22 142 / 0.08)"
                  : "none",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-1 h-5 rounded-full"
                style={{ background: "oklch(0.75 0.22 142)" }}
              />
              <span className="section-label">Phase 1 — Scouting</span>
            </div>

            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Inter', sans-serif" }}
            >
              Player Identity &amp; Position
            </label>
            <textarea
              className="input-gaming resize-none mb-3"
              rows={3}
              placeholder="e.g. Explosive left winger with elite dribbling, pace, and creativity. Plays for a high-press team as LW/CAM."
              value={playerIdentity}
              onChange={(e) => setPlayerIdentity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleScout();
              }}
              disabled={scoutMutation.isPending}
            />

            <button
              className="btn-neon w-full py-3 rounded-lg text-sm"
              onClick={handleScout}
              disabled={scoutMutation.isPending || !playerIdentity.trim()}
            >
              {scoutMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  Analysing...
                </span>
              ) : (
                "Generate Scouting Report"
              )}
            </button>
          </div>
        </section>

        {/* ── Loading state ────────────────────────────────────────────────── */}
        {scoutMutation.isPending && (
          <Spinner label="Running AI Scout Analysis..." />
        )}

        {/* ── Phase 1 Result: Scouting Blueprint ──────────────────────────── */}
        {blueprint && !scoutMutation.isPending && (
          <div ref={reportRef} className="animate-fade-up mb-6">
            <ScoutingReport blueprint={blueprint} />
          </div>
        )}

        {/* ── Phase 2: AP Budget Calculator ───────────────────────────────── */}
        {blueprint && !scoutMutation.isPending && (
          <section className="mb-6 animate-fade-up">
            <div
              className="rounded-xl p-4 border"
              style={{
                background: "oklch(0.11 0.015 240)",
                borderColor: "oklch(0.78 0.18 85 / 0.3)",
                boxShadow: "0 0 20px oklch(0.78 0.18 85 / 0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: "oklch(0.78 0.18 85)" }}
                />
                <span
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    color: "oklch(0.78 0.18 85)",
                  }}
                >
                  Phase 2 — Build Calculator
                </span>
              </div>

              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Inter', sans-serif" }}
              >
                AP Budget
              </label>
              <input
                type="number"
                className="input-gaming mb-3"
                min={1}
                max={999999}
                value={apBudget}
                onChange={(e) => setApBudget(Math.max(1, parseInt(e.target.value) || 0))}
                disabled={calcMutation.isPending}
                placeholder="Enter AP budget..."
              />

              <button
                className="w-full py-3 rounded-lg text-sm font-bold tracking-widest uppercase transition-all duration-200"
                onClick={handleCalculate}
                disabled={calcMutation.isPending || apBudget <= 0}
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  background:
                    calcMutation.isPending || apBudget <= 0
                      ? "oklch(0.20 0.02 240)"
                      : "oklch(0.78 0.18 85)",
                  color:
                    calcMutation.isPending || apBudget <= 0
                      ? "oklch(0.45 0.01 240)"
                      : "oklch(0.08 0.01 240)",
                  boxShadow:
                    calcMutation.isPending || apBudget <= 0
                      ? "none"
                      : "0 0 20px oklch(0.78 0.18 85 / 0.3)",
                  cursor: calcMutation.isPending || apBudget <= 0 ? "not-allowed" : "pointer",
                }}
              >
                {calcMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                    </svg>
                    Calculating...
                  </span>
                ) : (
                  "Calculate Perfect Stats"
                )}
              </button>
            </div>
          </section>
        )}

        {/* ── Loading state for calc ───────────────────────────────────────── */}
        {calcMutation.isPending && (
          <Spinner label="Running Math Engine..." />
        )}

        {/* ── Phase 2 Result: Player Card ──────────────────────────────────── */}
        {playerCard && !calcMutation.isPending && (
          <div ref={cardRef} className="animate-fade-up mb-6">
            <PlayerCard result={playerCard} apBudget={apBudget} archetype={blueprint?.archetype ?? ""} />
            
            {/* Download Build Button */}
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="mt-4 w-full py-3 rounded-lg text-sm font-bold tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                background: "oklch(0.25 0.02 240)",
                color: "oklch(0.95 0.01 240)",
                border: "1px solid oklch(0.45 0.01 240)",
              }}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  Exporting HQ Image...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download Build as Image
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Reset button ─────────────────────────────────────────────────── */}
        {blueprint && (
          <div className="text-center mt-2">
            <button
              onClick={handleReset}
              className="text-xs tracking-wider uppercase transition-colors duration-200"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                color: "oklch(0.40 0.01 240)",
              }}
            >
              ↺ Start New Build
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
