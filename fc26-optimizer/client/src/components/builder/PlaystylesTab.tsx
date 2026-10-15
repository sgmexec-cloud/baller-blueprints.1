import React from 'react';
import { GridSlot } from './PlaystyleSlots';
import type { PlaystylesTabProps } from '@/types/builder';

export const PlaystylesTab: React.FC<PlaystylesTabProps> = ({
  level,
  activePsPlus,
  equippedSpecialization,
  equippedPlaystyles,
  fac1,
  fac2,
  setActiveModal,
}) => {
  const hasPsPlus = !!activePsPlus && activePsPlus !== 'None';

  return (
    <section className="animate-fade-up">
      <div className="flex items-center gap-2 mb-3 pl-1">
        <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          PlayStyle Assignments
        </span>
      </div>
      
      <div className="bg-[#131A2A] border border-[#26334A] rounded-xl p-4 space-y-5">
         <div>
            <div className="text-[10px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-2 flex justify-between">
               <span>PlayStyle+</span>
               <span className="text-[8px] text-[#59657A]">ONE AT A TIME</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <GridSlot slot={{ id: 'psplus', type: 'gold', name: hasPsPlus ? activePsPlus : '', unlocked: true, unlockText: '' }} interactive={true} onClick={() => setActiveModal('playstyles')} />
               <button
                  onClick={() => setActiveModal('specializations')}
                  className="h-[70px] rounded-xl bg-[#0D1220] border border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/50 transition-all flex flex-col items-center justify-center gap-1 px-2"
               >
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[#59657A]">Specialisation</span>
                  <span className={`text-[11px] font-black uppercase tracking-wider text-center leading-tight ${equippedSpecialization ? 'text-[#21E6A4]' : 'text-[#8E9AAF]'}`}>
                     {equippedSpecialization || 'Browse'}
                  </span>
               </button>
            </div>
         </div>

         <div>
            <div className="text-[10px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-2 flex justify-between">
               <span>Pro Level Unlocks</span>
               <span className="text-[8px] text-[#21E6A4]">TAP TO EDIT</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
               {[0, 1, 2].map(idx => (
                  <GridSlot 
                     key={idx}
                     slot={{ id: `lvl${idx}`, type: 'silver', name: equippedPlaystyles[idx], unlocked: level >= [5, 15, 40][idx], unlockText: `LVL ${[5, 15, 40][idx]}` }} 
                     interactive={true} 
                     onClick={() => setActiveModal('playstyles')} 
                  />
               ))}
            </div>
         </div>

         <div>
            <div className="text-[10px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-2 flex justify-between">
               <span>Facility Unlocks</span>
               <span className="text-[8px] text-[#59657A]">VIA BUDGET</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <GridSlot slot={{ id: 'facil1', type: 'silver', name: fac1, unlocked: !!fac1, unlockText: 'FAC 1' }} interactive={false} />
               <GridSlot slot={{ id: 'facil2', type: 'silver', name: fac2, unlocked: !!fac2, unlockText: 'FAC 2' }} interactive={false} />
            </div>
         </div>
      </div>
    </section>
  );
};
