import React from 'react';
import { SPECIALIZATIONS_DATA, SIGNATURE_PERKS_DATA } from '@/constants/playstylesData';
import type { ArchetypeTabProps } from '@/types/builder';

export const ArchetypeTab: React.FC<ArchetypeTabProps> = ({
  archetype,
  handleArchetypeChange,
  equippedSpecialization,
  setActiveModal,
  level,
  expandedPerk,
  setExpandedPerk,
}) => {
  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3 pl-1">
          <div className="w-1 h-3 rounded-full bg-[#4D8DFF]" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Select Archetype
          </span>
        </div>
        <div className="grid grid-cols-12 gap-2 pb-4">
          {[
            { name: 'Progressor', col: 'col-start-2 col-span-2' },
            { name: 'Disruptor', col: 'col-start-4 col-span-2' },
            { name: 'Maestro', col: 'col-start-6 col-span-2' },
            { name: 'Spark', col: 'col-start-8 col-span-2' },
            { name: 'Finisher', col: 'col-start-10 col-span-2' }
          ].map(item => {
            const isSelected = archetype === item.name;
            const iconFilename = item.name.replace(/\s+/g, '-').toLowerCase() + '.png';
            return (
              <button key={item.name} onClick={() => handleArchetypeChange(item.name)} className={`${item.col} flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border-2 ${isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_15px_rgba(77,141,255,0.2)] scale-[1.02]' : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/40 opacity-70 hover:opacity-100'}`}>
                <div className="w-7 h-7 mb-1.5 flex items-center justify-center">
                  <img src={`/archetypes/${iconFilename}`} alt={item.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                </div>
                <div className={`font-black text-[7.5px] sm:text-[8.5px] text-center uppercase tracking-wider leading-tight ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>{item.name}</div>
              </button>
            );
          })}
          {[
            { name: 'Boss', col: 'col-start-1 col-span-2' },
            { name: 'Marauder', col: 'col-start-3 col-span-2' },
            { name: 'Recycler', col: 'col-start-5 col-span-2' },
            { name: 'Creator', col: 'col-start-7 col-span-2' },
            { name: 'Magician', col: 'col-start-9 col-span-2' },
            { name: 'Target', col: 'col-start-11 col-span-2' }
          ].map(item => {
            const isSelected = archetype === item.name;
            const iconFilename = item.name.replace(/\s+/g, '-').toLowerCase() + '.png';
            return (
              <button key={item.name} onClick={() => handleArchetypeChange(item.name)} className={`${item.col} flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border-2 ${isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_15px_rgba(77,141,255,0.2)] scale-[1.02]' : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235] hover:border-[#4D8DFF]/40 opacity-70 hover:opacity-100'}`}>
                <div className="w-7 h-7 mb-1.5 flex items-center justify-center">
                  <img src={`/archetypes/${iconFilename}`} alt={item.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                </div>
                <div className={`font-black text-[7.5px] sm:text-[8.5px] text-center uppercase tracking-wider leading-tight ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>{item.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {SPECIALIZATIONS_DATA[archetype] && (
        <div className="border-t border-[#26334A]/50 pt-6">
          <div className="flex items-center gap-2 mb-4 pl-1">
            <div className="w-1 h-3 rounded-full bg-[#facc15]" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              Specialization
            </span>
          </div>
          {equippedSpecialization ? (
            <div onClick={() => setActiveModal('specializations')} className="bg-gradient-to-r from-[#192235] to-[#131A2A] border border-[#facc15]/40 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(250,204,21,0.1)] cursor-pointer hover:border-[#facc15]/70 transition-all group">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-[#facc15]/10 flex items-center justify-center border border-[#facc15]/30 group-hover:scale-110 transition-transform">
                    <div className="w-4 h-4 border-2 border-[#facc15] rotate-45 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-[#facc15] -rotate-45" /></div>
                 </div>
                 <div>
                   <div className="text-[11px] font-black tracking-widest uppercase text-[#facc15]" style={{ fontFamily: "'Orbitron', sans-serif" }}>{equippedSpecialization}</div>
                   <div className="text-[9px] text-[#F4F7FB] font-bold tracking-wider mt-1 uppercase">Active Specialization</div>
                 </div>
              </div>
              <span className="text-[#facc15] text-xs font-black">➔</span>
            </div>
          ) : (
            <div className="bg-[#131A2A] border border-[#26334A] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase text-[#F4F7FB]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Choose a Specialization</div>
                <div className="text-[9px] text-[#8E9AAF] font-medium tracking-wide mt-1">Boost key attributes and unlock unique playstyle perks.</div>
              </div>
              <button onClick={() => setActiveModal('specializations')} className="flex items-center gap-2 bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4D8DFF]/20 transition-colors shadow-[0_0_10px_rgba(77,141,255,0.1)]">
                <span className="w-3 h-3 flex items-center justify-center border border-[#4D8DFF] rounded-full text-[8px] leading-none">+</span>
                Browse
              </button>
            </div>
          )}
        </div>
      )}

      {SIGNATURE_PERKS_DATA[archetype] && (
        <div className="border-t border-[#26334A]/50 pt-6">
          <div className="flex items-center gap-2 mb-4 pl-1">
            <div className="w-1 h-3 rounded-full bg-[#21E6A4]" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              Signature Perks
            </span>
          </div>
          <div className="space-y-2">
            {SIGNATURE_PERKS_DATA[archetype].map((perk, index) => {
              const isUnlocked = level >= perk.level;
              const isExpanded = expandedPerk === perk.name;
              return (
                <div key={index} onClick={() => setExpandedPerk(isExpanded ? null : perk.name)} className={`px-4 py-3 rounded-xl border transition-all cursor-pointer ${isUnlocked ? 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]' : 'bg-[#0D1220]/60 border-[#26334A]/50 opacity-70'} ${isExpanded && isUnlocked ? 'shadow-sm ring-1 ring-[#21E6A4]/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isUnlocked ? 'text-[#F4F7FB]' : 'text-[#59657A]'}`} style={{ fontFamily: "'Orbitron', sans-serif" }}>{perk.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${isUnlocked ? 'text-[#21E6A4]' : 'text-[#8E9AAF]'}`} style={{ fontFamily: "'Rajdhani', sans-serif" }}>LVL {perk.level}</span>
                      <span className={`text-[#8E9AAF] text-[10px] transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>
                    </div>
                  </div>
                  {isExpanded && (
                     <div className="mt-3 pt-3 border-t border-[#26334A]/50 animate-fade-in">
                        <p className={`text-[10px] leading-relaxed font-medium ${isUnlocked ? 'text-[#8E9AAF]' : 'text-[#59657A]'}`}><span className={`font-bold ${isUnlocked ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>Effect:</span> {perk.desc}</p>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
