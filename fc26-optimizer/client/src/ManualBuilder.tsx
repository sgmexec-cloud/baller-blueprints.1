import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from "@/lib/trpc"; 

const STAT_GROUPS: Record<string, string[]> = {
  "Pace": ["Acceleration", "Sprint Speed"],
  "Shooting": ["Attack Positioning", "Finishing", "Shot Power", "Long Shots", "Volleys", "Penalties"],
  "Passing": ["Vision", "Crossing", "FK Accuracy", "Short Passing", "Long Passing", "Curve"],
  "Dribbling": ["Agility", "Balance", "Reactions", "Ball Control", "Dribbling", "Composure"],
  "Defending": ["Interceptions", "Heading Accuracy", "Def Awareness", "Standing Tackle", "Sliding Tackle"],
  "Physical": ["Jumping", "Stamina", "Strength", "Aggression"]
};

// Defined physical boundaries and base sizes for each archetype
const ARCH_PHYSICALS: Record<string, { baseH: number, minH: number, maxH: number, baseW: number, minW: number, maxW: number, type: 'DEF' | 'MID_ATT' | 'GK' }> = {
  'Shot Stopper': { baseH: 188, minH: 179, maxH: 197, baseW: 90, minW: 80, maxW: 100, type: 'GK' },
  'Sweeper Keeper': { baseH: 192, minH: 184, maxH: 200, baseW: 90, minW: 80, maxW: 100, type: 'GK' },
  'Progressor': { baseH: 186, minH: 177, maxH: 195, baseW: 85, minW: 75, maxW: 95, type: 'DEF' },
  'Boss': { baseH: 188, minH: 180, maxH: 196, baseW: 90, minW: 80, maxW: 100, type: 'DEF' },
  'Disruptor': { baseH: 178, minH: 168, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'DEF' },
  'Marauder': { baseH: 178, minH: 168, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'DEF' },
  'Recycler': { baseH: 182, minH: 172, maxH: 192, baseW: 75, minW: 65, maxW: 85, type: 'MID_ATT' },
  'Maestro': { baseH: 175, minH: 162, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'MID_ATT' },
  'Creator': { baseH: 175, minH: 162, maxH: 188, baseW: 75, minW: 65, maxW: 85, type: 'MID_ATT' },
  'Spark': { baseH: 175, minH: 162, maxH: 188, baseW: 70, minW: 60, maxW: 80, type: 'MID_ATT' },
  'Magician': { baseH: 175, minH: 162, maxH: 188, baseW: 70, minW: 60, maxW: 80, type: 'MID_ATT' },
  'Finisher': { baseH: 177, minH: 164, maxH: 190, baseW: 80, minW: 70, maxW: 90, type: 'MID_ATT' },
  'Target': { baseH: 186, minH: 177, maxH: 195, baseW: 90, minW: 80, maxW: 100, type: 'MID_ATT' },
  'Target Forward': { baseH: 186, minH: 177, maxH: 195, baseW: 90, minW: 80, maxW: 100, type: 'MID_ATT' } 
};

// The tiered AP Cost system
const getApCost = (currentVal: number, isAdding: boolean): number => {
  const target = isAdding ? currentVal + 1 : currentVal;
  if (target <= 70) return 1;
  if (target <= 85) return 2;
  return 3;
};

// The "qe" Formula logic
const getModifier = (current: number, base: number, step: number): number => {
  const diff = current - base;
  const absDiff = Math.abs(diff);
  if (absDiff === 0) return 0;
  const magnitude = 1 + Math.floor((absDiff - 1) / step);
  return diff > 0 ? magnitude : -magnitude;
};

export default function ManualBuilder() {
  const [level, setLevel] = useState<number>(25);
  const [archetype, setArchetype] = useState<string>('');
  const [height, setHeight] = useState<number>(175);
  const [weight, setWeight] = useState<number>(75);
  
  // State to track user's point investments per attribute
  const [addedPoints, setAddedPoints] = useState<Record<string, number>>({});
  const [spentAp, setSpentAp] = useState<number>(0);
  const [gameVersion, setGameVersion] = useState<"FC26" | "FC27">("FC27");

  const { data: progressionData, isLoading: isProgLoading } = trpc.build.getProgression.useQuery({ gameVersion } as any);
  const { data: serverArchetypes, isLoading: isArchLoading } = trpc.scout.getArchetypeBaseStats.useQuery({ gameVersion } as any);

  const maxAp = progressionData?.[level]?.apAvailable ?? (Math.floor(level * 1.5) + 10);
  const availableAp = maxAp - spentAp;

  const activeBounds = ARCH_PHYSICALS[archetype] || ARCH_PHYSICALS['Finisher'];

  // Initialize and handle archetype switching
  useEffect(() => {
    if (serverArchetypes && Object.keys(serverArchetypes).length > 0) {
      const targetArch = serverArchetypes[archetype] ? archetype : Object.keys(serverArchetypes)[0];
      setArchetype(targetArch);
      
      const bounds = ARCH_PHYSICALS[targetArch] || ARCH_PHYSICALS['Finisher'];
      setHeight(bounds.baseH);
      setWeight(bounds.baseW);
      setAddedPoints({});
      setSpentAp(0);
    }
  }, [serverArchetypes, gameVersion]);

  const handleArchetypeChange = (newArch: string) => {
    setArchetype(newArch);
    const bounds = ARCH_PHYSICALS[newArch] || ARCH_PHYSICALS['Finisher'];
    setHeight(bounds.baseH);
    setWeight(bounds.baseW);
    setAddedPoints({});
    setSpentAp(0);
  };

  // Dynamically calculate attribute modifiers based on height/weight deltas
  const physicalModifiers = useMemo(() => {
    const mods: Record<string, number> = {};
    const hModRaw = getModifier(height, activeBounds.baseH, 4);
    const wModRaw = getModifier(weight, activeBounds.baseW, 8);
    const isGK = activeBounds.type === 'GK';

    if (isGK) {
      mods["Sprint Speed"] = (mods["Sprint Speed"] || 0) + hModRaw - wModRaw;
      mods["Strength"] = (mods["Strength"] || 0) + hModRaw + wModRaw;
      mods["Acceleration"] = (mods["Acceleration"] || 0) - hModRaw - wModRaw;
    } else {
      mods["Jumping"] = (mods["Jumping"] || 0) + hModRaw + wModRaw;
      mods["Sprint Speed"] = (mods["Sprint Speed"] || 0) + hModRaw - wModRaw;
      mods["Strength"] = (mods["Strength"] || 0) + hModRaw + wModRaw;
      mods["Acceleration"] = (mods["Acceleration"] || 0) - hModRaw - wModRaw;
      mods["Agility"] = (mods["Agility"] || 0) - hModRaw - wModRaw;
      mods["Balance"] = (mods["Balance"] || 0) - hModRaw + wModRaw;
    }
    return mods;
  }, [height, weight, activeBounds]);

  // Compute final attributes on the fly
  const currentStats = useMemo(() => {
    if (!serverArchetypes || !serverArchetypes[archetype]) return null;
    const computed: Record<string, number> = {};
    const baseObj = serverArchetypes[archetype].base;
    
    for (const statKey in baseObj) {
      const baseVal = baseObj[statKey] || 70;
      const modVal = physicalModifiers[statKey] || 0;
      const invested = addedPoints[statKey] || 0;
      // Ensure stats don't drop below 1 or exceed 99
      computed[statKey] = Math.max(1, Math.min(99, baseVal + modVal + invested));
    }
    return computed;
  }, [serverArchetypes, archetype, physicalModifiers, addedPoints]);

  const handleStatChange = (statKey: string, isAdding: boolean) => {
    if (!currentStats) return;
    const currentVal = currentStats[statKey];
    
    if (isAdding) {
      const cost = getApCost(currentVal, true);
      if (availableAp >= cost && currentVal < 99) {
        setAddedPoints(prev => ({ ...prev, [statKey]: (prev[statKey] || 0) + 1 }));
        setSpentAp(prev => prev + cost);
      }
    } else {
      if ((addedPoints[statKey] || 0) > 0) {
        const cost = getApCost(currentVal - 1, false);
        setAddedPoints(prev => ({ ...prev, [statKey]: prev[statKey] - 1 }));
        setSpentAp(prev => prev - cost);
      }
    }
  };

  let accelerate = 'Controlled';
  if (currentStats) {
    const acc = currentStats["Acceleration"] || 70;
    const agi = currentStats["Agility"] || 70;
    const str = currentStats["Strength"] || 70;

    if (height >= 185 && str >= 65 && (str - agi) >= 4 && acc >= 40) {
      accelerate = 'Lengthy';
    } else if (height <= 184 && agi >= 65 && (agi - str) >= 10 && acc >= 80) {
      accelerate = 'Explosive';
    }
  }

  const leagueWarning = useMemo(() => {
    if (activeBounds.type === 'DEF' && height > 187) return "Max DEF height is 187cm";
    if (activeBounds.type === 'MID_ATT' && height > 182) return "Max MID/ATT height is 182cm";
    return null;
  }, [height, activeBounds]);

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

        <div className="flex bg-black/60 border border-white/10 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setGameVersion("FC26"); setAddedPoints({}); setSpentAp(0); }}
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
            onClick={() => { setGameVersion("FC27"); setAddedPoints({}); setSpentAp(0); }}
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
            
            {leagueWarning && (
              <div className="mb-4 bg-yellow-950/40 border border-yellow-500/50 text-yellow-400 p-3 rounded-xl text-center text-xs font-bold uppercase tracking-widest">
                ⚠️ League Warning: {leagueWarning}
              </div>
            )}

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
                      setAddedPoints({});
                      setSpentAp(0);
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
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                    <span className="text-[10px] text-gray-500">{activeBounds.minH}-{activeBounds.maxH}cm</span>
                  </div>
                  <input 
                    type="range" min={activeBounds.minH} max={activeBounds.maxH} value={height} 
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-center mt-1 font-bold text-white">{height} cm</p>
                </div>
                <div className="flex-1 bg-black/40 border border-white/5 p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium uppercase" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                    <span className="text-[10px] text-gray-500">{activeBounds.minW}-{activeBounds.maxW}kg</span>
                  </div>
                  <input 
                    type="range" min={activeBounds.minW} max={activeBounds.maxW} value={weight} 
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-center mt-1 font-bold text-white">{weight} kg</p>
                </div>
              </div>

              <div className="bg-green-950/20 p-4 rounded-xl border border-green-900/30 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none bg-green-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-500" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  AccelerATE Style
                </span>
                <span className={`text-lg font-black uppercase tracking-wider z-10 ${
                  accelerate === 'Lengthy' ? 'text-orange-400' : accelerate === 'Explosive' ? 'text-yellow-400' : 'text-white'
                }`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  {accelerate}
                </span>
              </div>
            </div>
          </div>
        </section>

        {currentStats && serverArchetypes && (
          <section className="animate-fade-up">
            <div className="rounded-xl p-4 border bg-black/60 border-white/10 shadow-2xl" style={{ boxShadow: "0 0 20px oklch(0.78 0.18 85 / 0.06)" }}>
              
              {Object.entries(STAT_GROUPS).map(([category, attributes]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 rounded-full" style={{ background: "oklch(0.78 0.18 85)" }} />
                    <h3 className="text-sm font-bold uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif", color: "oklch(0.78 0.18 85)" }}>
                      {category}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {attributes.map(stat => {
                      const value = currentStats[stat] || 70;
                      const invested = addedPoints[stat] || 0;
                      const nextCost = getApCost(value, true);
                      
                      const rawBase = serverArchetypes[archetype]?.base?.[stat] || 70;
                      const mod = physicalModifiers[stat] || 0;
                      const modifiedBase = rawBase + mod;
                      const isModified = mod !== 0;
                      
                      return (
                        <div key={stat} className="bg-black/40 p-3 rounded-xl border border-white/5 flex items-center justify-between transition-colors hover:border-white/10">
                          <div className="w-1/2">
                            <p className="font-bold text-white text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>{stat}</p>
                            <div className="flex gap-2 text-[10px] uppercase tracking-wider font-bold">
                               <span className="text-gray-500" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Base: {rawBase}</span>
                               {isModified && (
                                 <span className={mod > 0 ? "text-green-500" : "text-red-500"} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                                   {mod > 0 ? "+" : ""}{mod}
                                 </span>
                               )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleStatChange(stat, false)}
                              disabled={invested <= 0}
                              className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/10 text-gray-400 font-bold disabled:opacity-30 active:bg-zinc-800 flex items-center justify-center transition-all"
                            >
                              -
                            </button>
                            
                            <div className="w-8 text-center relative">
                              <p className={`text-lg font-black ${invested > 0 ? 'text-green-400' : 'text-white'}`}>{value}</p>
                            </div>
                            
                            <button 
                              onClick={() => handleStatChange(stat, true)}
                              disabled={availableAp < nextCost || value >= 99}
                              className="w-9 h-9 rounded-lg text-black font-bold disabled:opacity-30 active:scale-95 flex items-center justify-center flex-col leading-none transition-all"
                              style={{
                                background: availableAp < nextCost || value >= 99 ? "oklch(0.20 0.02 240)" : "oklch(0.75 0.22 142)",
                                color: availableAp < nextCost || value >= 99 ? "oklch(0.45 0.01 240)" : "oklch(0.08 0.01 240)",
                              }}
                            >
                              <span className="text-base leading-[0.5]">+</span>
                              <span className="text-[7px] font-bold uppercase opacity-80 mt-1 tracking-wider">{nextCost}AP</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>
          </section>
        )}

      </div>
    </div>
  );
}
