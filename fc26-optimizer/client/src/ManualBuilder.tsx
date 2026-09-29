import React, { useState, useEffect } from 'react';

interface BaseStats {
  Pace: number;
  Shooting: number;
  Passing: number;
  Dribbling: number;
  Defending: number;
  Physical: number;
}

interface ArchetypeData {
  pos: string;
  base: BaseStats;
}

const ARCHETYPES: Record<string, ArchetypeData> = {
  Finisher: { pos: 'Attacker', base: { Pace: 75, Shooting: 82, Passing: 65, Dribbling: 78, Defending: 40, Physical: 70 } },
  'Target Forward': { pos: 'Attacker', base: { Pace: 70, Shooting: 80, Passing: 60, Dribbling: 70, Defending: 45, Physical: 85 } },
  Spark: { pos: 'Attacker', base: { Pace: 85, Shooting: 75, Passing: 70, Dribbling: 82, Defending: 35, Physical: 60 } },
  Maestro: { pos: 'Midfielder', base: { Pace: 72, Shooting: 72, Passing: 82, Dribbling: 82, Defending: 50, Physical: 65 } },
  Creator: { pos: 'Midfielder', base: { Pace: 75, Shooting: 70, Passing: 85, Dribbling: 80, Defending: 55, Physical: 60 } },
  Disruptor: { pos: 'Midfielder', base: { Pace: 70, Shooting: 60, Passing: 70, Dribbling: 65, Defending: 82, Physical: 82 } },
  Boss: { pos: 'Defender', base: { Pace: 65, Shooting: 40, Passing: 60, Dribbling: 55, Defending: 85, Physical: 85 } },
  Marauder: { pos: 'Defender', base: { Pace: 80, Shooting: 50, Passing: 70, Dribbling: 70, Defending: 80, Physical: 75 } },
  Progressor: { pos: 'Defender', base: { Pace: 72, Shooting: 55, Passing: 78, Dribbling: 72, Defending: 82, Physical: 70 } },
  'Shot Stopper': { pos: 'Goalkeeper', base: { Pace: 50, Shooting: 30, Passing: 60, Dribbling: 40, Defending: 85, Physical: 75 } },
  'Sweeper Keeper': { pos: 'Goalkeeper', base: { Pace: 60, Shooting: 30, Passing: 70, Dribbling: 45, Defending: 80, Physical: 70 } },
};

const getApCost = (currentVal: number, isAdding: boolean): number => {
  const target = isAdding ? currentVal + 1 : currentVal;
  if (target <= 70) return 1;
  if (target <= 85) return 2;
  return 3;
};

export default function ManualBuilder() {
  const [level, setLevel] = useState<number>(25);
  const [archetype, setArchetype] = useState<string>('Finisher');
  const [height, setHeight] = useState<number>(69);
  const [weight, setWeight] = useState<number>(160);
  const [stats, setStats] = useState<BaseStats>(ARCHETYPES.Finisher.base);
  const [spentAp, setSpentAp] = useState<number>(0);

  const maxAp = Math.floor(level * 1.5) + 10;
  const availableAp = maxAp - spentAp;

  useEffect(() => {
    if (ARCHETYPES[archetype]) {
      setStats(ARCHETYPES[archetype].base);
      setSpentAp(0);
    }
  }, [archetype]);

  const handleStatChange = (statKey: string, isAdding: boolean) => {
    const key = statKey as keyof BaseStats;
    const current = stats[key];
    const base = ARCHETYPES[archetype].base[key];
    
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
  if (height >= 71 && weight >= 165 && stats.Physical >= 65) accelerate = 'Lengthy';
  else if (height <= 69 && stats.Dribbling >= 80) accelerate = 'Explosive';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-md mx-auto bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl mb-6">
        <h1 className="text-2xl font-bold text-center text-cyan-400 mb-4">Manual Build Creator</h1>
        <div className="flex justify-between items-center bg-slate-950 p-4 rounded-lg border border-slate-800">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Player Level</p>
            <input 
              type="range" min="1" max="100" value={level} 
              onChange={(e) => {
                setLevel(Number(e.target.value));
                setSpentAp(0);
                setStats(ARCHETYPES[archetype].base);
              }}
              className="w-24 accent-cyan-500 mt-2"
            />
            <span className="ml-2 font-bold text-lg">{level}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-semibold uppercase">Available AP</p>
            <p className="text-3xl font-black text-cyan-400">{availableAp}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl mb-6">
        <label className="block text-xs text-slate-400 font-semibold mb-2 uppercase">Archetype</label>
        <select 
          className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg mb-6 outline-none"
          value={archetype}
          onChange={(e) => setArchetype(e.target.value)}
        >
          {Object.keys(ARCHETYPES).map(arch => (
            <option key={arch} value={arch}>{arch} ({ARCHETYPES[arch].pos})</option>
          ))}
        </select>

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 font-semibold mb-2 uppercase">Height</label>
            <input 
              type="range" min="64" max="79" value={height} 
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <p className="text-center mt-1 font-bold">{Math.floor(height / 12)}'{height % 12}"</p>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 font-semibold mb-2 uppercase">Weight</label>
            <input 
              type="range" min="99" max="253" value={weight} 
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <p className="text-center mt-1 font-bold">{weight} lbs</p>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex justify-between items-center">
          <span className="text-slate-400 font-semibold">AccelerATE</span>
          <span className={`font-black uppercase tracking-wider ${
            accelerate === 'Lengthy' ? 'text-orange-400' : 
            accelerate === 'Explosive' ? 'text-yellow-400' : 'text-cyan-400'
          }`}>
            {accelerate}
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto grid grid-cols-1 gap-3">
        {(Object.keys(stats) as Array<keyof BaseStats>).map((stat) => {
          const value = stats[stat];
          const base = ARCHETYPES[archetype].base[stat];
          const nextCost = getApCost(value, true);
          
          return (
            <div key={stat} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="w-1/3">
                <p className="font-bold text-slate-200">{stat}</p>
                <p className="text-xs text-slate-500">Base: {base}</p>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleStatChange(stat, false)}
                  disabled={value <= base}
                  className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold disabled:opacity-30 active:bg-slate-700"
                >-</button>
                
                <div className="w-12 text-center">
                  <p className="text-2xl font-black text-white">{value}</p>
                </div>
                
                <button 
                  onClick={() => handleStatChange(stat, true)}
                  disabled={availableAp < nextCost || value >= 99}
                  className="w-10 h-10 rounded-full bg-cyan-600 text-white font-bold disabled:opacity-30 active:bg-cyan-500 flex items-center justify-center flex-col leading-none"
                >
                  <span>+</span>
                  <span className="text-[9px] font-normal opacity-80 mt-0.5">({nextCost})</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
