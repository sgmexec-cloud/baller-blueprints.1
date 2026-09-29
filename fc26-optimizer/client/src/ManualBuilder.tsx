import React, { useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc"; 

interface BaseStats {
  Pace: number;
  Shooting: number;
  Passing: number;
  Dribbling: number;
  Defending: number;
  Physical: number;
}

const getApCost = (currentVal: number, isAdding: boolean): number => {
  const target = isAdding ? currentVal + 1 : currentVal;
  if (target <= 70) return 1;
  if (target <= 85) return 2;
  return 3;
};

export default function ManualBuilder() {
  const [level, setLevel] = useState<number>(25);
  const [archetype, setArchetype] = useState<string>('');
  const [height, setHeight] = useState<number>(69);
  const [weight, setWeight] = useState<number>(160);
  const [stats, setStats] = useState<BaseStats | null>(null);
  const [spentAp, setSpentAp] = useState<number>(0);
  const [gameVersion, setGameVersion] = useState<"FC26" | "FC27">("FC27");

  // Fetch real data from your CSV backend
  const { data: progressionData, isLoading: isProgLoading } = trpc.build.getProgression.useQuery({ gameVersion } as any);
  const { data: serverArchetypes, isLoading: isArchLoading } = trpc.scout.getArchetypeBaseStats.useQuery({ gameVersion } as any);

  // Use real server AP limits, fallback to standard math if loading
  const maxAp = progressionData?.[level]?.apAvailable ?? (Math.floor(level * 1.5) + 10);
  const availableAp = maxAp - spentAp;

  // Initialize stats once server data loads
  useEffect(() => {
    if (serverArchetypes && Object.keys(serverArchetypes).length > 0) {
      // If the currently selected archetype exists in the new data, use it. Otherwise default to the first one.
      const targetArch = serverArchetypes[archetype] ? archetype : Object.keys(serverArchetypes)[0];
      setArchetype(targetArch);
      setStats(serverArchetypes[targetArch].base);
      setSpentAp(0);
    }
  }, [serverArchetypes, gameVersion]);

  // Handle stat resets when user manually changes archetype
  const handleArchetypeChange = (newArch: string) => {
    setArchetype(newArch);
    if (serverArchetypes?.[newArch]) {
      setStats(serverArchetypes[newArch].base);
      setSpentAp(0);
    }
  };

  const handleStatChange = (statKey: string, isAdding: boolean) => {
    if (!stats || !serverArchetypes) return;
    const key = statKey as keyof BaseStats;
    const current = stats[key];
    const base = serverArchetypes[archetype].base[key];
    
    if (isAdding) {
      const cost = getApCost(current, true);
      if (availableAp >= cost && current < 99) {
        setStats({ ...stats, [key]: current + 1 });
        setSpentAp(spentAp + cost);
      }
    } else {
      if (current > base) {
        const cost = getApCost(current - 1, false);
        setStats({ ...stats, [key]: current - 1 });
        setSpentAp(spentAp - cost);
      }
    }
  };

  let accelerate = 'Controlled';
  if (stats) {
    if (height >= 71 && weight >= 165 && stats.Physical >= 65) accelerate = 'Lengthy';
    else if (height <= 69 && stats.Dribbling >= 80) accelerate = 'Explosive';
  }

  if (isArchLoading || isProgLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <div className="w-12 h-12 rounded-full border-4 border-t-green-500 border-green-900 animate-spin mb-4"></div>
        <p className="text-green-500 font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Loading Engine Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pt-8 pb-16 px-4">
      <div className="max-w-lg mx-auto">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-2xl" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Manual Builder
          </h1>
          <p className="text-sm mt-2" style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'Inter', sans-serif" }}>
            Powered by live engine parameters.
          </p>
        </div>

        {/* Engine Toggle */}
        <div className="flex bg-black/60 border border-white/10 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setGameVersion("FC26"); setSpentAp(0); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all ${
              gameVersion === "FC26"
                ? "bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                : "text-gray-500 hover:text-white"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 26 DATA
          </button>
          <button
            onClick={() => { setGameVersion("FC27"); setSpentAp(0); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all ${
              gameVersion === "FC27"
                ? "bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                : "text-gray-500 hover:text-white"
            }`}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            FC 27 DATA
          </button>
        </div>

        <section className="mb-6 animate-fade-in">
          <div className="rounded-xl p-4 border bg-black/60 border-white/10 shadow-2xl" style={{ boxShadow: "0 0 20px oklch(0.75 0.22 142 / 0.08)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ background: "oklch(0.75 0.22 142)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "oklch(0.75 0.22 142)", fontFamily: "'Rajdhani', sans-serif" }}>
                Player Foundation
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-black/40 border border-white/5 p-4 rounded-xl">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>
                    PLAYER LEVEL
                  </label>
                  <input 
                    type="range" min="1" max="100" value={level} 
                    onChange={(e) => {
                      setLevel(Number(e.target.value));
                      setSpentAp(0);
                      if (serverArchetypes && serverArchetypes[archetype]) {
                        setStats(serverArchetypes[archetype].base);
                      }
                    }}
                    className="w-full accent-green-500"
                  />
                  <div className="text-white font-bold text-lg mt-1">{level}</div>
                </div>
                <div className="flex-1 text-right border-l border-white/10 pl-4">
                  <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>
                    AVAILABLE AP
                  </label>
                  <div className="text-3xl font-black text-green-400 drop-shadow-md">{availableAp}</div>
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 p-4 rounded-xl">
                <label className="block text-xs font-medium mb-2 uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>
                  Archetype Selection
                </label>
                <select 
                  className="w-full bg-black/60 border border-white/10 text-white rounded-lg p-3 text-sm focus:outline-none focus:border-green-500 transition-colors appearance-none"
                  value={archetype}
                  onChange={(e) => handleArchetypeChange(e.target.value)}
                >
                  {serverArchetypes && Object.keys(serverArchetypes).map(arch => (
                    <option key={arch} value={arch}>{arch} ({serverArchetypes[arch].pos})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 bg-black/40 border border-white/5 p-4 rounded-xl">
                  <label className="block text-xs font-medium mb-2 uppercase text-center" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                  <input 
                    type="range" min="64" max="79" value={height} 
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-center mt-1 font-bold text-white">{Math.floor(height / 12)}'{height % 12}"</p>
                </div>
                <div className="flex-1 bg-black/40 border border-white/5 p-4 rounded-xl">
                  <label className="block text-xs font-medium mb-2 uppercase text-center" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                  <input 
                    type="range" min="99" max="253" value={weight} 
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-center mt-1 font-bold text-white">{weight} lbs</p>
                </div>
              </div>

              <div className="bg-green-950/20 p-4 rounded-xl border border-green-900/30 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none bg-green-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-500" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  AccelerATE Style
                </span>
                <span className="text-lg font-black text-white uppercase tracking-wider z-10" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  {accelerate}
                </span>
              </div>
            </div>
          </div>
        </section>

        {stats && serverArchetypes && (
          <section className="animate-fade-up">
            <div className="rounded-xl p-4 border bg-black/60 border-white/10 shadow-2xl" style={{ boxShadow: "0 0 20px oklch(0.78 0.18 85 / 0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full" style={{ background: "oklch(0.78 0.18 85)" }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif", color: "oklch(0.78 0.18 85)" }}>
                  Attribute Tuning
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(Object.keys(stats) as Array<keyof BaseStats>).map((stat) => {
                  const value = stats[stat];
                  const base = serverArchetypes[archetype].base[stat];
                  const nextCost = getApCost(value, true);
                  
                  return (
                    <div key={stat} className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between transition-colors hover:border-white/10">
                      <div className="w-1/3">
                        <p className="font-bold text-white text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>{stat}</p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Base: {base}</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleStatChange(stat, false)}
                          disabled={value <= base}
                          className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 text-gray-400 font-bold disabled:opacity-30 active:bg-zinc-800 flex items-center justify-center transition-all"
                        >
                          -
                        </button>
                        
                        <div className="w-10 text-center">
                          <p className="text-xl font-black text-white">{value}</p>
                        </div>
                        
                        <button 
                          onClick={() => handleStatChange(stat, true)}
                          disabled={availableAp < nextCost || value >= 99}
                          className="w-10 h-10 rounded-lg text-black font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center flex-col leading-none transition-all"
                          style={{
                            background: availableAp < nextCost || value >= 99 ? "oklch(0.20 0.02 240)" : "oklch(0.75 0.22 142)",
                            color: availableAp < nextCost || value >= 99 ? "oklch(0.45 0.01 240)" : "oklch(0.08 0.01 240)",
                          }}
                        >
                          <span className="text-lg">+</span>
                          <span className="text-[8px] font-bold uppercase opacity-80 mt-0.5 tracking-wider">{nextCost} AP</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
