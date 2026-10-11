import React from 'react';
import { formatHeight, formatWeight } from '@/utils/builderUtils';
import type { InfoTabProps } from '@/types/builder';

export const InfoTab: React.FC<InfoTabProps> = ({
  archetype,
  height,
  weight,
  accelerate,
  masteryProgressPct,
  smLevel,
  wfLevel,
}) => {
  return (
    <section className="animate-fade-up space-y-4">
       <div className="bg-[#131A2A] border border-[#26334A] rounded-xl p-4">
          <div className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF] mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Build Summary</div>
          <div className="space-y-3">
             <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                <span className="text-xs text-[#59657A] font-bold uppercase">Archetype</span>
                <span className="text-sm text-[#F4F7FB] font-black">{archetype}</span>
             </div>
             <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                <span className="text-xs text-[#59657A] font-bold uppercase">Height & Weight</span>
                <div className="text-right flex flex-col items-end">
                  <span className="text-sm text-[#F4F7FB] font-black">{formatHeight(height)}</span>
                  <span className="text-xs text-[#8E9AAF] font-bold">{formatWeight(weight)}</span>
                </div>
             </div>
             <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                <span className="text-xs text-[#59657A] font-bold uppercase">AcceleRATE</span>
                <span className="text-sm text-[#F4F7FB] font-black">{accelerate}</span>
             </div>
             <div className="flex justify-between items-center border-b border-[#26334A]/50 pb-2">
                <span className="text-xs text-[#59657A] font-bold uppercase">Mastery Progress</span>
                <span className="text-sm text-[#4D8DFF] font-black">{masteryProgressPct}%</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs text-[#59657A] font-bold uppercase">Skills / W.Foot</span>
                <span className="text-sm text-[#facc15] font-black">{smLevel}★ / {wfLevel}★</span>
             </div>
          </div>
       </div>
    </section>
  );
};
