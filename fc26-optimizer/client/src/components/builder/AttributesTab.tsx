import React from 'react';
import { STAT_GROUPS, CSV_STAT_MAP } from '@/constants/builderData';
import { getStatCaps, getCostForPoints } from '@/utils/builderUtils';
import type { AttributesTabProps } from '@/types/builder';

export const AttributesTab: React.FC<AttributesTabProps> = ({
  archetype,
  serverArchetypes,
  currentStats,
  addedPoints,
  viewMode,
  setViewMode,
  smLevel,
  wfLevel,
  setActiveModal,
  physicalModifiers,
  facilityModifiers,
  masteryModifiers,
  handleSliderChange,
  availableAp,
}) => {
  return (
    <section className="animate-fade-up">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 rounded-full bg-[#4caf50]" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Player Attributes
          </span>
        </div>
        
        <div className="flex bg-[#131A2A] border border-[#26334A] rounded-lg p-0.5">
          <button 
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors ${viewMode === 'raw' ? 'bg-[#192235] text-[#21E6A4]' : 'text-[#59657A] hover:text-[#8E9AAF]'}`}
          >
            Raw Stats
          </button>
          <button 
            onClick={() => setViewMode('boosted')}
            className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors ${viewMode === 'boosted' ? 'bg-[#192235] text-[#4D8DFF]' : 'text-[#59657A] hover:text-[#8E9AAF]'}`}
          >
            Boosted
          </button>
        </div>
      </div>

      <div className="mb-4 shadow-sm animate-fade-in">
         <div className="bg-[#192235] rounded-t-lg px-4 py-2.5 flex justify-between items-center border-b border-[#26334A]/80">
            <span className="text-[14px] font-bold text-[#F4F7FB]">Skills & W.Foot</span>
            <span className="text-[10px] text-[#facc15] font-bold tracking-widest uppercase">Budget Priority</span>
         </div>
         <div className="bg-[#0D1220] rounded-b-lg overflow-hidden border border-[#26334A] border-t-0 p-4 flex justify-between items-center">
            <div className="flex flex-col gap-2">
               <span className="text-[12px] text-[#F4F7FB]">Skill Moves</span>
               <span className="text-[12px] text-[#F4F7FB]">Weak Foot</span>
            </div>
            <div className="flex flex-col gap-2 items-end">
               <button onClick={() => setActiveModal('skills_wf')} className="text-[13px] font-black text-[#facc15] hover:text-white transition-colors">{smLevel} ★</button>
               <button onClick={() => setActiveModal('skills_wf')} className="text-[13px] font-black text-[#facc15] hover:text-white transition-colors">{wfLevel} ★</button>
            </div>
         </div>
      </div>
      
      <div className="space-y-4 pb-20">
        {Object.entries(STAT_GROUPS).map(([category, stats]) => {
          const catTotal = stats.reduce((sum, stat) => {
            const caps = getStatCaps(archetype, stat);
            const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[stat] || 70;
            const invested = addedPoints[stat] || 0;
            const rawVal = rawBase + invested;
            return sum + (viewMode === 'raw' ? rawVal : (currentStats?.[stat] || 70));
          }, 0);
          const catAvg = Math.round(catTotal / stats.length);
          
          return (
            <div key={category} className="mb-4 shadow-sm animate-fade-in">
               <div className="bg-[#192235] rounded-t-lg px-4 py-2.5 flex justify-between items-center border-b border-[#26334A]/80">
                  <span className="text-[14px] font-bold text-[#F4F7FB]">{category}</span>
                  <span className="text-[14px] font-black text-[#4caf50] drop-shadow-[0_0_5px_rgba(76,175,80,0.3)]">{catAvg}</span>
               </div>
               <div className="bg-[#0D1220] rounded-b-lg overflow-hidden border border-[#26334A] border-t-0">
                  {stats.map(stat => {
                    const val = currentStats?.[stat] || 70;
                    const displayName = CSV_STAT_MAP[stat] || stat;
                    
                    const caps = getStatCaps(archetype, stat);
                    const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[stat] || 70;
                    
                    const physMod = physicalModifiers[stat] || 0;
                    const facMod = facilityModifiers[stat] || 0;
                    const mastMod = masteryModifiers[stat] || 0;
                    
                    const invested = addedPoints[stat] || 0;
                    const rawVal = rawBase + invested;
                    const apSpent = getCostForPoints(archetype, stat, rawBase, invested);
                    
                    const displayVal = viewMode === 'raw' ? rawVal : val;
                    const showModifiers = viewMode === 'boosted';
                    
                    return (
                      <div key={stat} className="px-4 py-2.5 border-b border-[#26334A]/40 last:border-0 hover:bg-[#131A2A] transition-colors flex flex-col">
                         <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-[#F4F7FB]">{displayName}</span>
                              <div className="flex items-center gap-1">
                                 {showModifiers && physMod !== 0 && (
                                   <div className={`flex items-center gap-0.5 px-1 py-[1px] rounded border ${physMod > 0 ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30' : 'bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/30'}`}>
                                     <span className="text-[8.5px] font-black">{physMod > 0 ? '+' : ''}{physMod}</span>
                                   </div>
                                 )}
                                 {showModifiers && facMod !== 0 && (
                                   <div className={`flex items-center gap-0.5 px-1 py-[1px] rounded border ${facMod > 0 ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30' : 'bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/30'}`}>
                                     <span className="text-[8.5px] font-black">{facMod > 0 ? '+' : ''}{facMod}</span>
                                   </div>
                                 )}
                                 {showModifiers && mastMod !== 0 && (
                                   <div className={`flex items-center gap-0.5 px-1 py-[1px] rounded border ${mastMod > 0 ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30' : 'bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/30'}`}>
                                     <span className="text-[8.5px] font-black">{mastMod > 0 ? '+' : ''}{mastMod}</span>
                                   </div>
                                 )}
                                 {apSpent > 0 && (
                                   <div className="flex items-center gap-0.5 px-1.5 py-[1px] rounded bg-[#facc15]/15 border border-[#facc15]/30 text-[#facc15]">
                                     <span className="text-[8.5px] font-black">{apSpent} AP</span>
                                   </div>
                                 )}
                              </div>
                            </div>
                            <span className="text-[13px] font-bold text-[#F4F7FB]">{displayVal}</span>
                         </div>
                         <div className="flex items-center gap-3 w-full group">
                            <button onClick={() => handleSliderChange(stat, displayVal - 1)} disabled={invested <= 0} className="w-5 h-5 flex items-center justify-center text-[#8E9AAF] bg-[#192235] rounded border border-[#26334A] hover:bg-[#26334A] hover:text-[#F4F7FB] disabled:opacity-30 transition-all text-xs font-black shrink-0">-</button>
                            <div className="flex-1 h-2 bg-[#192235] rounded-full relative overflow-hidden group-hover:ring-1 ring-[#4D8DFF]/30 transition-all cursor-pointer">
                               <div className="absolute top-0 left-0 h-full bg-[#4caf50] rounded-full transition-all" style={{ width: `${displayVal}%` }} />
                               <input type="range" min={rawBase} max={caps.max || 99} value={displayVal} onChange={(e) => handleSliderChange(stat, parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            </div>
                            <button onClick={() => handleSliderChange(stat, displayVal + 1)} disabled={displayVal >= (caps.max || 99) || availableAp < 1} className="w-5 h-5 flex items-center justify-center text-[#8E9AAF] bg-[#192235] rounded border border-[#26334A] hover:bg-[#26334A] hover:text-[#F4F7FB] disabled:opacity-30 transition-all text-xs font-black shrink-0">+</button>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
