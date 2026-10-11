import React from 'react';
import { STAR_UPGRADE_COSTS } from '@/constants/archetypeData';
import type { SkillsWfModalProps } from '@/types/builder';

export const SkillsModal: React.FC<SkillsWfModalProps> = ({
  isOpen,
  setIsOpen,
  activeStarCaps,
  smLevel,
  wfLevel,
  handleStarChange,
  availableAp,
}) => {
  if (isOpen !== 'skills_wf') return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
       <div className="w-full max-w-lg mx-auto bg-[#080B14] rounded-t-3xl border-t border-[#4D8DFF]/50 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between p-5 bg-[#0D1220] border-b border-[#26334A]">
             <div>
                <h2 className="text-lg font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Skills & Weak Foot</h2>
                <div className="text-[10px] text-[#4D8DFF] font-bold uppercase tracking-widest mt-1">AP Remaining: {availableAp}</div>
             </div>
             <button onClick={() => setIsOpen(null)} className="w-8 h-8 rounded-full bg-[#131A2A] text-[#8E9AAF] flex items-center justify-center hover:bg-[#192235] hover:text-[#F4F7FB] transition-colors">✕</button>
          </div>
          <div className="p-5 space-y-4 pb-12">
              <div className="flex items-center justify-between bg-[#131A2A] p-4 rounded-xl border border-[#26334A]">
                 <div>
                    <div className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wide">Skill Moves</div>
                    <div className="text-[9px] text-[#59657A] font-medium tracking-widest uppercase mt-0.5">Min: {activeStarCaps.sm.min} <span className="mx-1">•</span> Max: {activeStarCaps.sm.max}</div>
                 </div>
                 <div className="flex items-center gap-4">
                    <button onClick={() => handleStarChange('sm', smLevel - 1)} disabled={smLevel <= activeStarCaps.sm.min} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">-</button>
                    <span className="text-[#4D8DFF] font-black text-xl w-10 text-center">{smLevel} <span className="opacity-70 text-[12px]">★</span></span>
                    <button onClick={() => handleStarChange('sm', smLevel + 1)} disabled={smLevel >= activeStarCaps.sm.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.sm.tier][smLevel + 1]} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">+</button>
                 </div>
              </div>

              <div className="flex items-center justify-between bg-[#131A2A] p-4 rounded-xl border border-[#26334A]">
                 <div>
                    <div className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wide">Weak Foot</div>
                    <div className="text-[9px] text-[#59657A] font-medium tracking-widest uppercase mt-0.5">Min: {activeStarCaps.wf.min} <span className="mx-1">•</span> Max: {activeStarCaps.wf.max}</div>
                 </div>
                 <div className="flex items-center gap-4">
                    <button onClick={() => handleStarChange('wf', wfLevel - 1)} disabled={wfLevel <= activeStarCaps.wf.min} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">-</button>
                    <span className="text-[#4D8DFF] font-black text-xl w-10 text-center">{wfLevel} <span className="opacity-70 text-[12px]">★</span></span>
                    <button onClick={() => handleStarChange('wf', wfLevel + 1)} disabled={wfLevel >= activeStarCaps.wf.max || availableAp < STAR_UPGRADE_COSTS[activeStarCaps.wf.tier][wfLevel + 1]} className="w-10 h-10 rounded-lg bg-[#0D1220] border border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB] hover:border-[#4D8DFF] disabled:opacity-30 flex items-center justify-center transition-all pb-1 text-lg">+</button>
                 </div>
              </div>
          </div>
       </div>
    </div>
  );
};
