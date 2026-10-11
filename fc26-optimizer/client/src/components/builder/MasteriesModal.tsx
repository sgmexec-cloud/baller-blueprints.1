import React from 'react';
import { MASTERIES } from '@/constants/playstylesData';
import { STAT_ABBR } from '@/constants/builderData';
import type { MasteriesModalProps } from '@/types/builder';

export const MasteriesModal: React.FC<MasteriesModalProps> = ({
  isOpen,
  setIsOpen,
  masteryProgressPct,
  serverArchetypes,
  unlockedMasteries,
  toggleMasteryUnlock,
}) => {
  if (isOpen !== 'masteries') return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
          <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Masteries</h2>
          <button onClick={() => setIsOpen(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
        </div>
        
        <div className="p-4 bg-[#131A2A] border-b border-[#26334A] shadow-md z-10 flex flex-col gap-3">
          <div className="flex justify-between items-center">
             <div className="text-[11px] font-bold text-[#F4F7FB] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Mastery Progress</div>
             <div className="text-sm font-black text-[#F4F7FB]">{masteryProgressPct}%</div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex-1 h-2 bg-[#080B14] rounded-full overflow-hidden border border-[#26334A]">
                <div className="h-full bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] transition-all duration-500 ease-out" style={{ width: `${masteryProgressPct}%` }} />
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 hide-scrollbar bg-[#080B14]">
          {serverArchetypes && Object.keys(serverArchetypes).map(arch => {
            const status = unlockedMasteries[arch] || { l10: false, l30: false };
            const masteryDef = MASTERIES[arch];
            if (!masteryDef) return null;
            const iconFilename = arch.replace(/\s+/g, '-').toLowerCase() + '.png';
            return (
              <div key={arch} className="flex bg-[#0D1220] rounded-xl border border-[#26334A] overflow-hidden hover:border-[#4D8DFF]/40 transition-colors">
                <div className="w-1/3 bg-[#131A2A] p-3 flex flex-col items-center justify-center border-r border-[#26334A]">
                   <div className="w-6 h-6 mb-1.5 flex items-center justify-center">
                      <img src={`/archetypes/${iconFilename}`} alt={arch} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                   </div>
                   <span className="text-[9px] font-black uppercase tracking-wider text-[#F4F7FB] text-center leading-tight">{arch}</span>
                </div>
                <button onClick={() => toggleMasteryUnlock(arch, 'l10')} className={`w-1/3 p-2 flex flex-col items-center justify-center border-r border-[#26334A] transition-all duration-200 group ${status.l10 ? 'bg-[#4D8DFF]/20' : 'bg-[#0D1220] hover:bg-[#131A2A]'}`}>
                   {Object.entries(masteryDef.l10).map(([stat, val]) => (
                      <div key={stat} className={`text-[10px] font-black tracking-widest uppercase transition-colors ${status.l10 ? 'text-[#4D8DFF]' : 'text-[#8E9AAF] group-hover:text-[#F4F7FB]'}`}>{STAT_ABBR[stat]} <span className="opacity-80 ml-0.5">+{val}</span></div>
                   ))}
                </button>
                <button onClick={() => toggleMasteryUnlock(arch, 'l30')} className={`w-1/3 p-2 flex flex-col items-center justify-center transition-all duration-200 group ${status.l30 ? 'bg-[#8B5CF6]/20' : 'bg-[#0D1220] hover:bg-[#131A2A]'}`}>
                   {Object.entries(masteryDef.l30).map(([stat, val]) => (
                      <div key={stat} className={`text-[10px] font-black tracking-widest uppercase transition-colors ${status.l30 ? 'text-[#8B5CF6]' : 'text-[#8E9AAF] group-hover:text-[#F4F7FB]'}`}>{STAT_ABBR[stat]} <span className="opacity-80 ml-0.5">+{val}</span></div>
                   ))}
                </button>
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 bg-[#0D1220]/90 backdrop-blur-md border-t border-[#26334A] flex gap-3 z-20">
           <button onClick={() => setIsOpen(null)} className="flex-1 py-3 rounded-xl bg-[#131A2A] border border-[#26334A] text-[#8E9AAF] font-bold uppercase tracking-widest text-[10px]">Close</button>
        </div>
      </div>
    </div>
  );
};
