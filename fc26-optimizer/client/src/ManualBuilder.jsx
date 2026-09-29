```react
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Ruler, Weight, Shield, Swords, Activity, 
  ChevronUp, ChevronDown, RefreshCw, Save 
} from 'lucide-react';

// 11 Core Archetypes with Positions and Base Stats
const ARCHETYPES = {
  Finisher: { pos: 'Attacker', icon: Swords, base: { Pace: 75, Shooting: 82, Passing: 65, Dribbling: 78, Defending: 40, Physical: 70 } },
  'Target Forward': { pos: 'Attacker', icon: Swords, base: { Pace: 70, Shooting: 80, Passing: 60, Dribbling: 70, Defending: 45, Physical: 85 } },
  Spark: { pos: 'Attacker', icon: Swords, base: { Pace: 85, Shooting: 75, Passing: 70, Dribbling: 82, Defending: 35, Physical: 60 } },
  Maestro: { pos: 'Midfielder', icon: Activity, base: { Pace: 72, Shooting: 72, Passing: 82, Dribbling: 82, Defending: 50, Physical: 65 } },
  Creator: { pos: 'Midfielder', icon: Activity, base: { Pace: 75, Shooting: 70, Passing: 85, Dribbling: 80, Defending: 55, Physical: 60 } },
  Disruptor: { pos: 'Midfielder', icon: Activity, base: { Pace: 70, Shooting: 60, Passing: 70, Dribbling: 65, Defending: 82, Physical: 82 } },
  Boss: { pos: 'Defender', icon: Shield, base: { Pace: 65, Shooting: 40, Passing: 60, Dribbling: 55, Defending: 85, Physical: 85 } },
  Marauder: { pos: 'Defender', icon: Shield, base: { Pace: 80, Shooting: 50, Passing: 70, Dribbling: 70, Defending: 80, Physical: 75 } },
  Progressor: { pos: 'Defender', icon: Shield, base: { Pace: 72, Shooting: 55, Passing: 78, Dribbling: 72, Defending: 82, Physical: 70 } },
  'Shot Stopper': { pos: 'Goalkeeper', icon: Shield, base: { Pace: 50, Shooting: 30, Passing: 60, Dribbling: 40, Defending: 85, Physical: 75 } },
  'Sweeper Keeper': { pos: 'Goalkeeper', icon: Shield, base: { Pace: 60, Shooting: 30, Passing: 70, Dribbling: 45, Defending: 80, Physical: 70 } },
};

// Cost to upgrade from current value to current + 1
const getUpgradeCost = (current) => {
  if (current < 70) return 1;
  if (current < 85) return 2;
  return 3;
};

// AP to refund when downgrading from current value to current - 1
const getRefundAmount = (current) => {
  if (current <= 70) return 1;
  if (current <= 85) return 2;
  return 3;
};

export default function ManualBuilder() {
  const [level, setLevel] = useState(25);
  const [archetype, setArchetype] = useState('Finisher');
  const [height, setHeight] = useState(69); // 69 inches = 5'9"
  const [weight, setWeight] = useState(160); // 160 lbs
  const [stats, setStats] = useState(ARCHETYPES.Finisher.base);
  const [spentAp, setSpentAp] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  // Dynamic AP Calculation based on Level
  // e.g. Level 1 = 11 AP, Level 100 = 160 AP
  const maxAp = Math.floor(level * 1.5) + 10;
  const availableAp = maxAp - spentAp;

  // Reset stats and AP when archetype changes
  useEffect(() => {
    setStats(ARCHETYPES[archetype].base);
    setSpentAp(0);
    setIsSaved(false);
  }, [archetype]);

  // Handle Level downscaling: reset if spent AP exceeds new lower cap
  useEffect(() => {
    if (spentAp > maxAp) {
      setStats(ARCHETYPES[archetype].base);
      setSpentAp(0);
    }
  }, [level, maxAp, spentAp, archetype]);

  const handleStatChange = (stat, isAdding) => {
    setIsSaved(false);
    const current = stats[stat];
    const base = ARCHETYPES[archetype].base[stat];
    
    if (isAdding) {
      const cost = getUpgradeCost(current);
      if (availableAp >= cost && current < 99) {
        setStats({ ...stats, [stat]: current + 1 });
        setSpentAp(spentAp + cost);
      }
    } else {
      if (current > base) {
        const refund = getRefundAmount(current);
        setStats({ ...stats, [stat]: current - 1 });
        setSpentAp(spentAp - refund);
      }
    }
  };

  const handleReset = () => {
    setStats(ARCHETYPES[archetype].base);
    setSpentAp(0);
    setIsSaved(false);
  };

  const handleSave = () => {
    // Placeholder for saving logic to Firebase/Supabase
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // AccelerATE Engine mapping Pace/Dribbling/Physical to game mechanics
  let accelerate = 'Controlled';
  // Lengthy: Min 6'2" (74"), High Strength (Mapped to Physical), Moderate Pace
  if (height >= 74 && stats.Physical >= 80 && stats.Pace >= 55) {
    accelerate = 'Lengthy';
  } 
  // Explosive: Max 5'9" (69"), High Agility (Mapped to Dribbling), High Pace
  else if (height <= 69 && stats.Dribbling >= 80 && stats.Pace >= 80) {
    accelerate = 'Explosive';
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 pb-12 font-sans selection:bg-cyan-500/30">
      
      {/* Top Navigation Bar */}
      <nav className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-10 px-4 py-4 mb-6 shadow-xl shadow-black/40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
              ClubsDNA Builder
            </h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleReset} 
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all"
              title="Reset Build"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={handleSave} 
              className={`p-2 rounded-full transition-all flex items-center justify-center ${isSaved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'}`}
              title="Save Build"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 space-y-6">
        
        <section className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 shadow-xl">
          <div className="flex justify-between items-end mb-6">
            <div className="flex-1 pr-4">
              <label className="text-xs text-zinc-400 font-bold tracking-widest uppercase mb-2 block flex justify-between">
                <span>Player Level</span>
                <span className="text-cyan-400 text-sm">{level}</span>
              </label>
              <input 
                type="range" min="1" max="100" value={level} 
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          <div className="bg-zinc-950 rounded-xl p-4 flex justify-between items-center border border-zinc-800/50">
            <div>
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Available AP</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-black text-cyan-400 tracking-tighter">{availableAp}</span>
                <span className="text-sm text-zinc-600 font-semibold">/ {maxAp}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">Spent</p>
              <span className="text-xl font-bold text-zinc-300">{spentAp}</span>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 shadow-xl">
          <label className="text-xs text-zinc-400 font-bold tracking-widest uppercase mb-2 block">
            Archetype & Position
          </label>
          <div className="relative mb-6">
            <select 
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 p-4 rounded-xl appearance-none outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
            >
              {Object.keys(ARCHETYPES).map(arch => (
                <option key={arch} value={arch}>{arch} • {ARCHETYPES[arch].pos}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-4 w-5 h-5 text-zinc-400 pointer-events-none" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-cyan-500" />
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Height</label>
                </div>
                <span className="text-sm font-bold text-zinc-300">{Math.floor(height / 12)}'{height % 12}"</span>
              </div>
              <input 
                type="range" min="64" max="79" value={height} 
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Weight className="w-4 h-4 text-cyan-500" />
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Weight</label>
                </div>
                <span className="text-sm font-bold text-zinc-300">{weight} lb</span>
              </div>
              <input 
                type="range" min="99" max="253" value={weight} 
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 to-blue-600"></div>
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest pl-3">AccelerATE</span>
            <span className={`font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-[11px] ${
              accelerate === 'Lengthy' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' : 
              accelerate === 'Explosive' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 
              'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
            }`}>
              {accelerate}
            </span>
          </div>
        </section>

        <section className="space-y-3 pt-2">
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-xs text-zinc-400 font-bold tracking-widest uppercase">Attributes</h2>
            <span className="text-[10px] text-cyan-500/70 font-semibold tracking-widest uppercase bg-cyan-500/10 px-2 py-1 rounded">
              Tiered Costs Active
            </span>
          </div>
          
          {Object.entries(stats).map(([stat, value]) => {
            const base = ARCHETYPES[archetype].base[stat];
            const nextCost = getUpgradeCost(value);
            const isAtBase = value <= base;
            const isMaxed = value >= 99;
            const canAfford = availableAp >= nextCost;
            
            return (
              <div key={stat} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center justify-between shadow-lg hover:border-zinc-700 transition-colors">
                
                <div className="w-1/3">
                  <p className="font-bold text-zinc-200 tracking-wide">{stat}</p>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Base: {base}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleStatChange(stat, false)}
                    disabled={isAtBase}
                    className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:border-zinc-800 active:bg-zinc-800 transition-all touch-manipulation"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  
                  <div className="w-12 text-center flex flex-col items-center">
                    <span className={`text-2xl font-black ${
                      value >= 86 ? 'text-fuchsia-400' : 
                      value >= 71 ? 'text-cyan-400' : 'text-zinc-100'
                    }`}>
                      {value}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleStatChange(stat, true)}
                    disabled={!canAfford || isMaxed}
                    className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border transition-all touch-manipulation ${
                      canAfford && !isMaxed 
                        ? 'bg-cyan-600 border-cyan-500 text-white active:bg-cyan-700 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <ChevronUp className="w-5 h-5 -mb-1" />
                    <span className="text-[9px] font-bold opacity-90 mt-0.5 tracking-tighter">
                      {isMaxed ? 'MAX' : `${nextCost} AP`}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </section>

      </div>
    </div>
  );
}
```