import React from 'react';
import { getPlaystyleIconPath } from '@/utils/builderUtils';
import type { PlaystyleSlotsRowProps, GridSlotProps } from '@/types/builder';

export const PlaystyleSlotsRow: React.FC<PlaystyleSlotsRowProps> = ({
  interactive = false,
  basePsPlus,
  specPlaystyle,
  equippedSpecialization,
  equippedPlaystyles,
  level,
  fac1,
  fac2,
  setActiveModal
}) => {
  const slotsData = [
     { id: 'base', type: 'gold', name: basePsPlus, unlocked: true, unlockText: '' },
     { id: 'spec', type: 'gold', name: specPlaystyle, unlocked: !!equippedSpecialization, unlockText: 'SPEC' },
     { id: 'lvl5', type: 'silver', name: equippedPlaystyles[0], unlocked: level >= 5, unlockText: 'LVL 5' },
     { id: 'lvl15', type: 'silver', name: equippedPlaystyles[1], unlocked: level >= 15, unlockText: 'LVL 15' },
     { id: 'lvl40', type: 'silver', name: equippedPlaystyles[2], unlocked: level >= 40, unlockText: 'LVL 40' },
     { id: 'facil1', type: 'silver', name: fac1, unlocked: !!fac1, unlockText: 'FAC 1' },
     { id: 'facil2', type: 'silver', name: fac2, unlocked: !!fac2, unlockText: 'FAC 2' }
  ];

  return (
     <div className="flex justify-center gap-[4px] sm:gap-1.5 w-full">
        {slotsData.map(slot => {
           const handleSlotClick = () => {
              if (interactive && slot.unlocked) {
                 if (slot.id === 'spec') setActiveModal('specializations');
                 else if (slot.id.startsWith('lvl')) setActiveModal('playstyles');
              }
           };

           return (
             <button 
               key={slot.id} 
               onClick={handleSlotClick}
               disabled={!interactive || !slot.unlocked || (!slot.id.startsWith('lvl') && slot.id !== 'spec')}
               className={`w-[2.3rem] h-[2.3rem] md:w-10 md:h-10 rounded bg-[#131A2A] border ${slot.name && slot.type === 'gold' ? 'border-[#facc15]/50 shadow-[0_0_8px_rgba(250,204,21,0.2)]' : 'border-[#26334A]'} flex items-center justify-center relative overflow-hidden transition-all ${interactive && slot.unlocked && (slot.id.startsWith('lvl') || slot.id === 'spec') ? 'hover:bg-[#192235] cursor-pointer' : 'cursor-default'}`}
             >
                {!slot.unlocked ? (
                   <div className="flex flex-col items-center justify-center opacity-40">
                      <svg className="w-3.5 h-3.5 mb-0.5 text-[#F4F7FB]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                      <span className="text-[6px] font-bold text-[#F4F7FB] uppercase leading-none">{slot.unlockText}</span>
                   </div>
                ) : slot.name ? (
                   <img src={getPlaystyleIconPath(slot.name, slot.type === 'gold')} className="w-5 h-5 md:w-6 md:h-6 object-contain" alt={slot.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                   <div className="flex items-center justify-center w-full h-full opacity-50">
                      <span className="text-[12px] text-[#59657A] font-bold">+</span>
                   </div>
                )}
             </button>
           )
        })}
     </div>
  );
};

export const GridSlot: React.FC<GridSlotProps> = ({ slot, interactive, onClick }) => (
   <button 
     onClick={() => { if (interactive && slot.unlocked && onClick) onClick(); }}
     disabled={!interactive || !slot.unlocked}
     className={`h-[70px] rounded-xl bg-[#0D1220] border ${slot.name && slot.type === 'gold' ? 'border-[#facc15]/50 shadow-[0_0_8px_rgba(250,204,21,0.15)]' : 'border-[#26334A]'} flex items-center justify-center relative overflow-hidden transition-all ${interactive && slot.unlocked ? 'hover:bg-[#192235] hover:border-[#4D8DFF]/50 cursor-pointer ring-1 ring-transparent hover:ring-[#4D8DFF]/20' : 'cursor-default'}`}
   >
      {!slot.unlocked ? (
         <div className="flex flex-col items-center justify-center opacity-40">
            <svg className="w-6 h-6 mb-1 text-[#F4F7FB]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
            <span className="text-[9px] font-bold text-[#F4F7FB] uppercase tracking-widest">{slot.unlockText}</span>
         </div>
      ) : slot.name ? (
         <img src={getPlaystyleIconPath(slot.name, slot.type === 'gold')} className="w-10 h-10 object-contain drop-shadow-md" alt={slot.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
         <div className="flex items-center justify-center w-full h-full opacity-50">
            <span className="text-[18px] text-[#59657A] font-bold">+</span>
         </div>
      )}
   </button>
);
