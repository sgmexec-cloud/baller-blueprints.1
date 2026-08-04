import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toPng } from "html-to-image";
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Hero header ────────────────────────────────.──────────────────────────────
function HeroHeader() {
  const { data: user, isLoading } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
  });

  const [showPricingModal, setShowPricingModal] = useState(false);

  const checkoutMutation = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  const isCheckoutLoading = checkoutMutation.isPending;
  const isPremiumOrVIP = user?.tier === "premium" || user?.tier === "premium_plus" || user?.tier === "vip" || user?.tier === "owner";

  let tierLabel = "👤 Guest";
  let buildsLeftText = "2 Free Builds";
  
  if (user) {
    if (user.tier === "owner") {
      tierLabel = "👑 Owner";
      buildsLeftText = "Unlimited Builds";
    } else if (user.tier === "vip") {
      tierLabel = "💎 VIP Member";
      buildsLeftText = "Unlimited Builds";
    } else if (user.tier === "premium_plus") {
      tierLabel = "🚀 Premium Plus";
      buildsLeftText = `${Math.max(0, 250 - (user.monthlyBuilds || 0))} / 250 Builds Left`;
    } else if (user.tier === "premium") {
      tierLabel = "🏅 Premium Member";
      buildsLeftText = `${Math.max(0, 100 - (user.monthlyBuilds || 0))} / 100 Builds Left`;
    } else {
      tierLabel = "⚽️ Free Member";
      buildsLeftText = `${Math.max(0, 5 - (user.monthlyBuilds || 0))} / 5 Free Builds`;
    }
  }

  return (
    <header className="relative overflow-hidden pt-8 pb-6 px-4 text-center">
      {/* Pricing Modal Overlay */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-zinc-900 border border-green-500/30 rounded-2xl max-w-md w-full p-6 text-left relative shadow-2xl">
            <button 
              onClick={() => setShowPricingModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            
            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Choose Your Plan
            </h2>
            <p className="text-xs text-gray-400 mb-6 font-sans">
              Unlock powerful AI scouting tools and higher monthly build limits.
            </p>

            <div className="space-y-3 mb-6">
              {/* Premium Tier */}
              <div 
                onClick={() => checkoutMutation.mutate({ tier: "premium" })}
                className="p-4 rounded-xl border border-white/10 bg-black/40 hover:border-green-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white text-sm" style={{ fontFamily: "'Rajdhani', sans-serif" }}>🏅 Premium</div>
                  <div className="text-[11px] text-gray-400">100 Monthly Builds • GPT-4o-mini &amp; 4o</div>
                </div>
                <div className="text-green-400 font-bold text-xs uppercase tracking-wider bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-900/50">
                  Select
                </div>
              </div>

              {/* Premium Plus Tier */}
              <div 
                onClick={() => checkoutMutation.mutate({ tier: "premium_plus" })}
                className="p-4 rounded-xl border border-white/10 bg-black/40 hover:border-green-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white text-sm" style={{ fontFamily: "'Rajdhani', sans-serif" }}>🚀 Premium Plus</div>
                  <div className="text-[11px] text-gray-400">250 Monthly Builds • Priority Processing</div>
                </div>
                <div className="text-green-400 font-bold text-xs uppercase tracking-wider bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-900/50">
                  Select
                </div>
              </div>

              {/* VIP Tier */}
              <div 
                onClick={() => checkoutMutation.mutate({ tier: "vip" })}
                className="p-4 rounded-xl border border-white/10 bg-black/40 hover:border-green-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white text-sm" style={{ fontFamily: "'Rajdhani', sans-serif" }}>💎 VIP Member</div>
                  <div className="text-[11px] text-gray-400">500 Monthly Builds • Ultimate Access</div>
                </div>
                <div className="text-green-400 font-bold text-xs uppercase tracking-wider bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-900/50">
                  Select
                </div>
              </div>
            </div>

            {isCheckoutLoading && (
              <div className="text-center text-xs text-green-400 animate-pulse py-2">
                Connecting to Stripe secure checkout...
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center">
        <img 
          src="/clubdna-logo.png" 
          alt="ClubDNA - Remove Opinion. Build With Data." 
          className="w-auto h-40 md:h-48 object-contain mb-4 drop-shadow-2xl"
        />
        <p
          className="text-sm max-w-xs mx-auto mb-6"
          style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'Inter', sans-serif" }}
        >
          AI-powered scouting &amp; build calculator for the perfect player
        </p>

        {isLoading ? (
          <div className="w-8 h-8 rounded-full border-2 border-t-[#5865F2] border-transparent animate-spin"></div>
        ) : user ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <div className="flex items-center justify-between w-full bg-black/40 border border-white/10 px-5 py-3 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-4">
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={`${user.name}'s avatar`} 
                    className="w-10 h-10 rounded-full shadow-lg object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg border border-white/20"
                       style={{ backgroundColor: "#5865F2", color: "#fff" }}>
                    {user.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <div className="text-left">
                  <p className="font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "1.1rem" }}>
                    {user.name}
                  </p>
                  <p className="text-xs font-medium" style={{ color: isPremiumOrVIP ? "oklch(0.78 0.18 85)" : "oklch(0.55 0.01 240)" }}>
                    {tierLabel} • {buildsLeftText}
                  </p>
                </div>
              </div>
              <div className="ml-2 flex flex-col items-end gap-1.5 border-l border-white/10 pl-4">
                {isPremiumOrVIP && user.tier !== "owner" && (
                  <a 
                    href="https://billing.stripe.com/p/login/test_9B6aEZ4In3R545o9te1gs00" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
                    style={{ color: "oklch(0.78 0.18 85)" }}
                  >
                    Manage Sub
                  </a>
                )}
                <a href="/api/auth/logout" className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors">
                  Logout
                </a>
              </div>
            </div>

            {/* Upgrade Button triggers the pricing modal */}
            {!isPremiumOrVIP && (
              <button
                onClick={() => setShowPricingModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, rgba(20, 83, 45, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%)",
                  color: "oklch(0.75 0.22 142)", 
                  border: "1px solid oklch(0.75 0.22 142 / 0.4)",
                  boxShadow: "0 0 15px oklch(0.75 0.22 142 / 0.1)",
                  fontFamily: "'Rajdhani', sans-serif",
                }}
              >
                <span className="text-base">🏅</span> Choose Upgrade Plan
              </button>
            )}
          </div>
        ) : (
          <a
            href="/api/auth/discord"
            className="inline-flex items-center gap-3 px-6 py-3 rounded-lg font-bold text-sm tracking-widest uppercase transition-all duration-200 hover:scale-105 hover:shadow-lg"
            style={{
              backgroundColor: "#5865F2",
              color: "#ffffff",
              boxShadow: "0 0 20px rgba(88, 101, 242, 0.4)",
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            Login with Discord
          </a>
        )}
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
  const [forcedArchetype, setForcedArchetype] = useState<string>(""); 
  const [level, setLevel] = useState<number>(1);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [playerCard, setPlayerCard] = useState<MathEngineResult | null>(null);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [isExporting, setIsExporting] = useState(false);

  const [guestBuildCount, setGuestBuildCount] = useState(0);

  const reportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  const { data: user, isLoading: isUserLoading } = trpc.auth.getMe.useQuery();
  const { data: progressionData, isLoading: isProgressionLoading } = trpc.build.getProgression.useQuery();
  const { data: archetypesList } = trpc.scout.getArchetypes.useQuery(); 

  useEffect(() => {
    if (!isUserLoading && !user) {
      const storedCount = parseInt(localStorage.getItem("guest_builds") || "0", 10);
      setGuestBuildCount(storedCount);
    }
  }, [user, isUserLoading]);

  const checkoutMutation = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    }
  });

  const apBudget = progressionData?.[level]?.apAvailable ?? 0;
  
  const isPremiumOrVIP = user?.tier === "premium" || user?.tier === "premium_plus" || user?.tier === "vip" || user?.tier === "owner";

  const scoutMutation = trpc.scout.generateReport.useMutation({
    onSuccess: (data) => {
      setBlueprint(data);
      setPlayerCard(null);
      setPhase(2);
      utils.auth.getMe.invalidate();

      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    onError: (error) => {
      if (error.message.includes("LIMIT_REACHED")) {
        alert("Free limit reached (5/5)! Please tap the 'Choose Upgrade Plan' button under your profile to view subscription options.");
      } else {
        alert(`Scouting failed: ${error.message}`);
      }
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
    if (!playerIdentity.trim() || scoutMutation.isPending) return;
    
    const isGuest = !user;

    if (isGuest && guestBuildCount >= 2) {
      alert("Guest limit reached! Please click 'Login with Discord' at the top of the page to get 5 free builds.");
      return;
    }

    if (user?.tier === "free" && (user?.monthlyBuilds || 0) >= 5) {
      alert("Free limit reached (5/5)! Please tap the 'Choose Upgrade Plan' button under your profile to view subscription options.");
      return;
    }

    if (isGuest) {
      const newCount = guestBuildCount + 1;
      localStorage.setItem("guest_builds", newCount.toString());
      setGuestBuildCount(newCount);
    }

    const secureForcedArchetype = isPremiumOrVIP ? forcedArchetype : undefined;

    scoutMutation.mutate({ 
      playerIdentity, 
      forcedArchetype: secureForcedArchetype || undefined 
    });
  };

  const handleCalculate = () => {
    if (!blueprint || apBudget <= 0) return;

    const sigSlots = progressionData?.[level]?.signatureUpgrades ?? 2;
    const stdSlots = progressionData?.[level]?.customSlots ?? 6;

    calcMutation.mutate({ 
      blueprint, 
      apBudget,
      signatureSlots: sigSlots,
      standardSlots: stdSlots
    });
  };

  const handleReset = () => {
    setBlueprint(null);
    setPlayerCard(null);
    setPhase(1);
    setPlayerIdentity("");
    setForcedArchetype("");
    setLevel(1);
  };

  const handleDownloadImage = async () => {
    if (!playerCard || !blueprint) {
      alert("Please wait for the calculation to finish before downloading.");
      return;
    }

    const node = document.getElementById("export-poster");
    if (!node) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await toPng(node, { 
        quality: 1.0, 
        pixelRatio: 1, 
        backgroundColor: '#000000',
        cacheBust: true,
        imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" 
      });
      const link = document.createElement("a");
      link.download = `${blueprint.archetype}-FC26-Build.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image", err);
      alert("Export failed. Please check your internet connection and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {blueprint && playerCard && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <ExportPoster blueprint={blueprint} result={playerCard} apBudget={apBudget} level={level} />
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pb-16">
        <HeroHeader />

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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: "oklch(0.75 0.22 142)" }}
                />
                <span className="section-label">Phase 1 — Scouting</span>
              </div>
              
              {!user && !isUserLoading && (
                <div className="text-[10px] font-bold px-2 py-1 rounded bg-black/40 border border-white/10 text-gray-400">
                  Guest Builds: <span className="text-white">{Math.max(0, 2 - guestBuildCount)}</span> / 2
                </div>
              )}
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

            <div className="mb-4 relative">
              <div className="flex justify-between items-center mb-1.5">
                <label 
                  className="block text-xs font-medium" 
                  style={{ fontFamily: "'Rajdhani', sans-serif", color: isPremiumOrVIP ? "oklch(0.75 0.01 240)" : "oklch(0.40 0.01 240)" }}
                >
                  Force Archetype <span className="text-gray-500">(Optional)</span>
                </label>
                {!isPremiumOrVIP && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                    Premium Feature
                  </span>
                )}
              </div>

              {isPremiumOrVIP ? (
                <select
                  value={forcedArchetype}
                  onChange={(e) => setForcedArchetype(e.target.value)}
                  className="input-gaming w-full text-white appearance-none bg-black/40 text-xs py-2 px-3 rounded-lg"
                >
                  <option value="">✨ Let AI Choose Best Match</option>
                  {archetypesList && archetypesList.length > 0 ? (
                    archetypesList.map((arch) => (
                      <option key={arch} value={arch}>
                        {arch}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Loading archetypes...</option>
                  )}
                </select>
              ) : (
                <div 
                  onClick={() => checkoutMutation.mutate({ tier: "premium" })}
                  className="w-full text-gray-500 bg-black/40 border border-white/5 text-xs py-2 px-3 rounded-lg cursor-pointer flex items-center justify-between hover:bg-white/5 hover:border-white/10 transition-colors"
                >
                  <span>✨ Let AI Choose Best Match (Locked)</span>
                  <span className="text-yellow-500/70">🔒</span>
                </div>
              )}
            </div>

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

        {scoutMutation.isPending && (
          <Spinner label="Running AI Scout Analysis..." />
        )}

        {blueprint && !scoutMutation.isPending && (
          <div ref={reportRef} className="animate-fade-up mb-6">
            <div className="rounded-xl border border-green-900/40 bg-black/40 overflow-hidden mb-6">
              <div className="p-4 border-b border-green-900/30 flex justify-between items-end" style={{ background: "linear-gradient(to bottom, rgba(20,83,45,0.1), transparent)" }}>
                <div>
                  <div className="text-[10px] font-bold text-green-500 tracking-widest uppercase mb-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    Scouting Blueprint
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    {blueprint.archetype}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 font-medium tracking-wide">
                  <div>{blueprint.heightRange}</div>
                  <div>{blueprint.weightRange}</div>
                </div>
              </div>

              {blueprint.scoutSummary && (
                <div className="p-4">
                  <div className="rounded-xl border border-green-900/30 bg-green-950/20 p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none bg-green-500" />
                    <div className="flex items-center gap-2 mb-3 relative z-10">
                      <span className="text-base">📋</span>
                      <h3 className="text-[11px] font-bold text-green-500 uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                        Chief Scout's Verdict
                      </h3>
                    </div>
                    <p className="text-[13px] sm:text-sm leading-relaxed text-gray-300 relative z-10" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {blueprint.scoutSummary}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                Player Level
              </label>

              {isProgressionLoading || !progressionData ? (
                <div className="text-green-400 mb-4 animate-pulse text-sm">Loading progression limits...</div>
              ) : (
                <>
                  <select 
                    value={level} 
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="input-gaming w-full mb-4 text-white appearance-none bg-black/40"
                  >
                    {Object.keys(progressionData).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Level {lvl}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-3 gap-3 text-center mb-6">
                    <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                      <div className="text-xl font-bold" style={{ color: "oklch(0.75 0.22 142)" }}>{progressionData[level]?.apAvailable}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Avail. AP</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                      <div className="text-xl font-bold text-blue-400">{progressionData[level]?.signatureUpgrades}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Sig. Upgrades</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                      <div className="text-xl font-bold text-purple-400">{progressionData[level]?.customSlots}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Custom Slots</div>
                    </div>
                  </div>
                </>
              )}

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

        {calcMutation.isPending && (
          <Spinner label="Running Math Engine..." />
        )}

        {playerCard && !calcMutation.isPending && (
          <div ref={cardRef} className="animate-fade-up mb-6">
            <PlayerCard 
              result={playerCard} 
              apBudget={apBudget} 
              archetype={blueprint?.archetype ?? ""} 
              level={level} 
              blueprint={blueprint} 
            />
            
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
