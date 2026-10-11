import React from 'react';
import { formatHeight, formatWeight } from '@/utils/builderUtils';
import type { FoundationTabProps } from '@/types/builder';

export const FoundationTab: React.FC<FoundationTabProps> = ({
  height,
  weight,
  accelerate,
  activeMasteriesCount,
  activeFacilitiesCount,
  setActiveModal,
}) => {
  const openFacilitiesModal = () => setActiveModal('facilities');

  return (
    <section className="animate-fade-up space-y-4">
      <div className="flex items-center gap-2 mb-3 pl-1">
        <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          Physicals & Base Setup
        </span>
      </div>
      
      <button 
        onClick={() => setActiveModal('physicals')} 
        className="w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3 flex items-center justify-between hover:bg-[#192235] hover:border-[#4D8DFF]/40 transition-all shadow-sm group mb-3"
      >
         <div className="flex items-center gap-5">
            <div className="flex flex-col items-center">
               <img src="/icons/height.png" alt="Height" className="w-4 h-4 mb-1 object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238E9AAF"><path d="M12 2L8 6h3v12H8l4 4 4-4h-3V6h3l-4-4z"/></svg>'; }} />
               <span className="text-xs font-bold text-[#F4F7FB]">{formatHeight(height)}</span>
            </div>
            <div className="w-px h-6 bg-[#26334A]" />
            <div className="flex flex-col items-center">
               <img src="/icons/weight.png" alt="Weight" className="w-4 h-4 mb-1 object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238E9AAF"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'; }} />
               <span className="text-xs font-bold text-[#F4F7FB]">{formatWeight(weight)}</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${accelerate === 'Lengthy' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30' : accelerate === 'Explosive' ? 'bg-[#4D8DFF]/20 text-[#4D8DFF] border border-[#4D8DFF]/30' : 'bg-[#26334A]/50 text-[#F4F7FB] border border-[#26334A]'}`}>
              {accelerate}
            </div>
            <div className="text-[#8E9AAF] group-hover:text-[#F4F7FB] transition-colors text-xs">▼</div>
         </div>
      </button>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={() => setActiveModal('masteries')} className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center gap-3 hover:bg-[#192235] hover:border-[#8B5CF6]/40 transition-all group">
           <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex shrink-0 items-center justify-center group-hover:scale-110 transition-transform p-1.5 overflow-hidden border border-[#8B5CF6]/20">
               <img src="/icons/masteries.png" alt="Masteries" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238B5CF6"><path d="M12 2L2 9l10 7 10-7-10-7z"/></svg>'; }} />
           </div>
           <div className="text-left">
               <div className="text-[10px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Masteries</div>
               <div className="text-[8px] text-[#8E9AAF] font-bold uppercase mt-0.5 tracking-wider">{activeMasteriesCount} Active</div>
           </div>
        </button>
        
        <button onClick={openFacilitiesModal} className="bg-[#131A2A] border border-[#26334A] p-3 rounded-xl flex items-center gap-3 hover:bg-[#192235] hover:border-[#4D8DFF]/40 transition-all group">
           <div className="w-8 h-8 shrink-0 rounded-full bg-[#080B14] border border-[#26334A] flex items-center justify-center p-1.5 overflow-hidden group-hover:scale-110 transition-transform">
               <img src="/icons/facilities/default.png" alt="Facilities" className="w-full h-full object-contain opacity-80" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
           </div>
           <div className="text-left">
               <div className="text-[10px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Facilities</div>
               <div className="text-[8px] text-[#8E9AAF] font-bold uppercase mt-0.5 tracking-wider">{activeFacilitiesCount} Equipped</div>
           </div>
        </button>
      </div>
    </section>
  );
};
