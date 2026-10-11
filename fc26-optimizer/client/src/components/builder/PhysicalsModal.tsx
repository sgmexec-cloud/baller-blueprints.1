import React from 'react';
import { formatHeight, formatWeight } from '@/utils/builderUtils';
import type { PhysicalsModalProps } from '@/types/builder';

export const PhysicalsModal: React.FC<PhysicalsModalProps> = ({
  isOpen,
  setIsOpen,
  activeBounds,
  height,
  setHeight,
  weight,
  setWeight,
  physicalModifiers,
  currentStats,
}) => {
  if (!isOpen || !currentStats) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg mx-auto bg-[#080B14] rounded-t-3xl border-t border-[#4D8DFF]/50 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up overflow-hidden flex flex-col max-h-[85vh]">
         
         <div className="flex items-center justify-between p-5 bg-[#0D1220] border-b border-[#26334A]">
           <div>
              <h2 className="text-lg font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Physical Attributes</h2>
              <div className="text-[10px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1">Adjust Height & Weight</div>
           </div>
           <button onClick={() => setIsOpen(null)} className="w-8 h-8 rounded-full bg-[#131A2A] text-[#8E9AAF] flex items-center justify-center hover:bg-[#192235] hover:text-[#F4F7FB] transition-colors">✕</button>
         </div>
         
         <div className="p-4 overflow-y-auto hide-scrollbar pb-12 flex gap-4">
            
            <div className="w-1/2 flex flex-col gap-6 pt-2">
               <div>
                 <div className="flex justify-between items-end mb-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Height</label>
                    <span className="text-sm font-black text-[#F4F7FB]">{formatHeight(height)}</span>
                 </div>
                 <input type="range" min={activeBounds.minH} max={activeBounds.maxH} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full cursor-pointer accent-[#4D8DFF] h-1.5 bg-[#131A2A] rounded-lg appearance-none" />
               </div>

               <div className="mt-2">
                 <div className="flex justify-between items-end mb-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Weight</label>
                    <span className="text-sm font-black text-[#F4F7FB]">{formatWeight(weight)}</span>
                 </div>
                 <input type="range" min={activeBounds.minW} max={activeBounds.maxW} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full cursor-pointer accent-[#4D8DFF] h-1.5 bg-[#131A2A] rounded-lg appearance-none" />
               </div>
            </div>

            <div className="w-1/2 flex flex-col gap-2">
               <div className="text-[9px] font-bold text-[#59657A] tracking-wider uppercase text-center mb-1">Affected Attributes</div>
               <div className="bg-[#0D1220] border border-[#26334A] rounded-xl p-3 space-y-3">
                  {["Acceleration", "Agility", "Balance", "Jumping", "Sprint Speed", "Strength"].map(stat => {
                     const mod = physicalModifiers[stat] || 0;
                     const val = currentStats[stat] || 70;
                     
                     let colorClass = "text-[#59657A]";
                     let badgeClass = "bg-[#131A2A] text-[#8E9AAF]";
                     let sign = "+/-";
                     let modDisplay = "0";

                     if (mod > 0) {
                       colorClass = "text-[#21E6A4]";
                       badgeClass = "bg-[#21E6A4]/10 text-[#21E6A4] border border-[#21E6A4]/30";
                       sign = "+";
                       modDisplay = mod.toString();
                     } else if (mod < 0) {
                       colorClass = "text-[#ff4d4d]";
                       badgeClass = "bg-[#ff4d4d]/10 text-[#ff4d4d] border border-[#ff4d4d]/30";
                       sign = "";
                       modDisplay = mod.toString();
                     }

                     return (
                       <div key={stat} className="flex items-center justify-between">
                          <span className="text-[10px] font-bold tracking-wide uppercase text-[#8E9AAF]">{stat}</span>
                          <div className="flex items-center gap-2">
                             <span className={`w-6 text-center text-[9px] font-black rounded ${badgeClass}`}>{sign}{modDisplay}</span>
                             <span className={`text-[11px] font-black w-4 text-right ${colorClass}`}>{val}</span>
                          </div>
                       </div>
                     );
                  })}
               </div>
            </div>

         </div>
      </div>
    </div>
  );
};
