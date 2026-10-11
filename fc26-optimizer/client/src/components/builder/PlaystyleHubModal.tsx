import React from 'react';
import { PLAYSTYLES_DATA, PLAYSTYLE_CATEGORIES } from '@/constants/playstylesData';
import { getPlaystyleIconPath, getStatCaps } from '@/utils/builderUtils';
import type { PlaystyleHubModalProps } from '@/types/builder';

export const PlaystyleHubModal: React.FC<PlaystyleHubModalProps> = ({
  isOpen,
  setIsOpen,
  level,
  availableAp,
  activePsPlus,
  isPsPlusUnlocked,
  equippedSpecialization,
  equippedPlaystyles,
  selectedPsView,
  setSelectedPsView,
  getUpgradeData,
  handleActionPlaystyle,
  hasEmptySlot,
  archetype,
  serverArchetypes,
  addedPoints,
}) => {
  if (isOpen !== 'playstyles') return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
          <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>PlayStyle Hub</h2>
          <button onClick={() => { setIsOpen(null); setSelectedPsView(null); }} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
        </div>
        
        <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${selectedPsView ? 'pb-64' : 'pb-8'} hide-scrollbar`}>
          <div>
            <div className="flex items-center gap-2 mb-3 border-b border-[#26334A] pb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#facc15]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle+ (Gold)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-[#131A2A] border border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.15)] rounded-xl p-3.5 flex flex-row items-center gap-3 relative overflow-hidden group text-left">
                 <div className="w-1/2 flex items-center justify-center">
                   <img src={getPlaystyleIconPath(activePsPlus, true)} alt={activePsPlus} className="w-14 h-14 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                 </div>
                 <div className="w-1/2 flex flex-col justify-center">
                   <div className="text-[11px] font-black text-[#F4F7FB] uppercase tracking-wider leading-tight">{activePsPlus}</div>
                   <div className="text-[8px] text-[#facc15] font-bold uppercase mt-1 tracking-widest">{isPsPlusUnlocked ? (equippedSpecialization ? 'From Spec.' : 'Active') : 'Locked'}</div>
                 </div>
              </button>
            </div>
          </div>

          {PLAYSTYLE_CATEGORIES.map(category => {
             const categoryStyles = PLAYSTYLES_DATA.filter(ps => ps.category === category.id && ps.name !== activePsPlus);
             if (categoryStyles.length === 0) return null;
             return (
               <div key={category.id}>
                 <div className="flex items-center gap-2 mb-3 border-b border-[#26334A] pb-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#8E9AAF]" />
                   <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8E9AAF]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{category.label}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {categoryStyles.map(ps => {
                      const isEquipped = equippedPlaystyles.includes(ps.name);
                      const isSelected = selectedPsView === ps.name;
                      const { canEquip } = getUpgradeData(ps.reqs);
                      const isUnavailable = !canEquip && !isEquipped;

                      return (
                        <button 
                          key={ps.name} 
                          onClick={() => setSelectedPsView(ps.name)} 
                          disabled={isUnavailable}
                          className={`rounded-xl p-3 flex flex-row items-center gap-2.5 relative overflow-hidden text-left transition-all duration-200 border ${isUnavailable ? 'opacity-30 grayscale cursor-not-allowed bg-[#0D1220] border-[#26334A]' : isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_12px_rgba(77,141,255,0.2)]' : isEquipped ? 'bg-[#131A2A] border-[#21E6A4]/60' : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]'}`}
                        >
                          <div className="w-1/2 flex items-center justify-center">
                             <img src={getPlaystyleIconPath(ps.name, false)} alt={ps.name} className="w-12 h-12 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          </div>
                          <div className="w-1/2 flex flex-col justify-center">
                            {isEquipped && <span className="text-[7px] bg-[#21E6A4]/20 text-[#21E6A4] px-1 py-0.5 rounded font-black uppercase mb-0.5 w-fit">Equipped</span>}
                            <div className={`text-[10px] font-black uppercase tracking-wider leading-tight ${isEquipped ? 'text-[#21E6A4]' : 'text-[#F4F7FB]'}`}>{ps.name}</div>
                          </div>
                        </button>
                      )
                    })}
                 </div>
               </div>
             );
          })}
        </div>

        {selectedPsView && (
          <div className="absolute bottom-0 left-0 w-full bg-[#0D1220] border-t border-[#4D8DFF]/50 rounded-t-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.6)] animate-fade-up z-20">
            {(() => {
              const ps = PLAYSTYLES_DATA.find(p => p.name === selectedPsView);
              if (!ps) return null;
              const { canEquip, cost, upgrades, reason } = getUpgradeData(ps.reqs);
              const isEquipped = equippedPlaystyles.includes(ps.name);
              return (
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 flex items-center justify-center">
                        <img src={getPlaystyleIconPath(ps.name, false)} alt={ps.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                      <div className="ml-1">
                         <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider">{ps.name}</h3>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPsView(null)} className="text-[#59657A] hover:text-[#F4F7FB] font-bold p-1">✕</button>
                  </div>

                  <div className="bg-[#080B14] rounded-xl border border-[#26334A] p-4">
                    <div className="text-[9px] text-[#8E9AAF] uppercase tracking-widest mb-3">Attribute Dependencies</div>
                    <div className="space-y-3">
                      {ps.reqs.map(req => {
                        const caps = getStatCaps(archetype, req.stat);
                        const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[req.stat] || 70;
                        const currentInvested = addedPoints[req.stat] || 0;
                        const userStatWithoutMods = rawBase + currentInvested;
                        const targetVal = req.min;
                        const isMet = userStatWithoutMods >= targetVal;
                        
                        return (
                          <div key={req.stat}>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                              <span className={isMet ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}>{req.stat}</span>
                              <span className={isMet ? 'text-[#21E6A4]' : 'text-[#8E9AAF]'}>{userStatWithoutMods} / {targetVal}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <button onClick={() => handleActionPlaystyle(ps.name, upgrades, isEquipped)} disabled={!isEquipped && (!canEquip || (!hasEmptySlot && Object.keys(upgrades).length === 0 && cost === 0))} className="w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px] bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white">
                    {isEquipped ? 'Deselect Element' : !canEquip ? reason : cost > 0 ? `Quick Equip [ ${cost} AP ]` : 'Equip PlayStyle'}
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
