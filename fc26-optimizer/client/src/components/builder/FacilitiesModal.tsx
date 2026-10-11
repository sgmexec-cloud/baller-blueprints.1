import React from 'react';
import { FACILITIES } from '@/constants/playstylesData';
import { CLUB_BUDGETS, CSV_STAT_MAP } from '@/constants/builderData';
import { getPlaystyleIconPath } from '@/utils/builderUtils';
import type { FacilitiesModalProps } from '@/types/builder';

export const FacilitiesModal: React.FC<FacilitiesModalProps> = ({
  isOpen,
  setIsOpen,
  clubLevel,
  setClubLevel,
  remainingBudget,
  equippedFacilities,
  selectedFacView,
  handleSelectFacilityView,
  viewingFacTier,
  setViewingFacTier,
  handleFacTouchStart,
  handleFacTouchMove,
  handleFacTouchEnd,
  handleRemoveFacility,
  handleEquipFacilityTier,
}) => {
  if (isOpen !== 'facilities') return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A] z-40">
          <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Club Facilities</h2>
          <button onClick={() => setIsOpen(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
        </div>
        
        <div className="p-4 bg-[#131A2A] border-b border-[#26334A] shadow-md z-40">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mb-0.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Club Level</div>
              <div className="text-lg font-black text-[#F4F7FB]">{clubLevel}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mb-0.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Remaining Budget</div>
              <div className={`text-xl font-black ${remainingBudget < 0 ? 'text-[#ff4d4d]' : 'text-[#4D8DFF]'}`}>
                {remainingBudget.toLocaleString()} <span className="text-[9px] text-[#59657A] ml-1">/ {CLUB_BUDGETS[clubLevel]?.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <input type="range" min="1" max="10" value={clubLevel} onChange={(e) => setClubLevel(Number(e.target.value))} className="w-full accent-[#4D8DFF] cursor-pointer" />
        </div>

        <div className="flex flex-col h-full overflow-hidden bg-[#080B14]">
           <div className="w-full bg-[#0D1220] border-b border-[#26334A] max-h-[140px] overflow-y-auto hide-scrollbar z-30">
              {Object.keys(FACILITIES).map(facName => {
                const isSelected = selectedFacView === facName;
                const equippedTier = equippedFacilities[facName];
                const iconSlug = facName.toLowerCase().replace(/\s+/g, '-');
                const iconPath = `/icons/facilities/${iconSlug}.png`;
                
                return (
                  <button key={facName} onClick={() => handleSelectFacilityView(facName)} className={`w-full px-4 py-2.5 flex items-center gap-3 text-left border-b border-[#26334A]/30 transition-colors ${isSelected ? 'bg-[#192235]' : 'hover:bg-[#131A2A]'}`}>
                    <div className="w-7 h-7 shrink-0 rounded bg-[#080B14] border border-[#26334A] flex items-center justify-center p-1 overflow-hidden">
                       <img src={iconPath} alt={facName} className="w-full h-full object-contain opacity-80" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234D8DFF"><path d="M12 2L2 22h20L12 2z"/></svg>'; }} />
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <div className={`text-[11px] font-bold leading-snug tracking-wide ${isSelected ? 'text-[#F4F7FB]' : 'text-[#8E9AAF]'}`}>{facName}</div>
                      {equippedTier && <div className="text-[9px] text-[#21E6A4] uppercase tracking-wider font-bold">★ Tier {equippedTier}</div>}
                    </div>
                  </button>
                );
              })}
           </div>

           <div 
             className="flex-1 relative flex flex-col items-center justify-center p-4 pt-8 perspective-[1000px] overflow-hidden"
             onTouchStart={handleFacTouchStart}
             onTouchMove={handleFacTouchMove}
             onTouchEnd={handleFacTouchEnd}
           >
              <div className="w-full flex justify-center items-center relative h-[340px]">
                 {[1, 2, 3].map(tier => {
                    const facility = FACILITIES[selectedFacView];
                    if (!facility) return null;
                    
                    const isActive = viewingFacTier === tier;
                    let transformStyle = 'translateX(0) scale(1)';
                    let zIndexStyle = 30;
                    let opacityStyle = 1;
                    
                    if (tier < viewingFacTier) {
                       transformStyle = 'translateX(-80px) scale(0.85) translateZ(-100px) rotateY(15deg)';
                       zIndexStyle = 20;
                       opacityStyle = 0.5;
                    } else if (tier > viewingFacTier) {
                       transformStyle = 'translateX(80px) scale(0.85) translateZ(-100px) rotateY(-15deg)';
                       zIndexStyle = 20;
                       opacityStyle = 0.5;
                    }

                    return (
                       <div 
                         key={tier} 
                         onClick={() => setViewingFacTier(tier)}
                         className="absolute transition-all duration-500 ease-out cursor-pointer"
                         style={{ transform: transformStyle, zIndex: zIndexStyle, opacity: opacityStyle }}
                       >
                          <div className={`w-[220px] h-[320px] rounded-xl flex flex-col bg-gradient-to-b from-[#192235] to-[#0D1220] border ${isActive ? 'border-[#4D8DFF]/60 shadow-[0_15px_40px_rgba(0,0,0,0.8)]' : 'border-[#26334A] shadow-xl'} overflow-hidden`}>
                             <div className="pt-5 pb-3 px-3 text-center border-b border-[#26334A]/50 bg-[#131A2A]">
                                <h3 className="text-[12px] font-black text-[#F4F7FB] uppercase tracking-widest leading-tight">{selectedFacView}</h3>
                             </div>
                             <div className="flex-1 p-4 flex flex-col justify-center items-center">
                                <div className="text-[10px] text-[#4D8DFF] uppercase tracking-widest mb-3 font-bold" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Attribute Boosts</div>
                                <div className="flex flex-col gap-2 w-full">
                                   {facility.stats.map(stat => (
                                     <div key={stat} className="bg-[#080B14] rounded p-2 flex justify-between items-center border border-[#26334A]/50">
                                        <span className="text-[10px] font-bold text-[#F4F7FB] tracking-wider">{CSV_STAT_MAP[stat] || stat}</span>
                                        <span className="text-[11px] font-black text-[#21E6A4]">+{facility.boosts[tier - 1]}</span>
                                     </div>
                                   ))}
                                </div>
                             </div>
                             <div className="py-4 bg-[#080B14] text-center border-t border-[#26334A]">
                                <div className="text-xl font-black text-[#4D8DFF]">{facility.cost[tier - 1]?.toLocaleString()}</div>
                             </div>
                          </div>
                       </div>
                    )
                 })}
              </div>

              <div className="w-full px-6 mt-4 z-40">
                 {(() => {
                    const currentEquippedTier = equippedFacilities[selectedFacView];
                    if (currentEquippedTier === viewingFacTier) {
                       return <button onClick={() => handleRemoveFacility(selectedFacView)} className="w-full py-3.5 rounded-xl bg-[#080B14] text-[#ff4d4d] font-black uppercase tracking-widest text-[11px] border border-red-500/30 hover:bg-red-500/10 transition-all">Unequip</button>;
                    } else {
                       const costToRefund = currentEquippedTier ? FACILITIES[selectedFacView].cost[currentEquippedTier - 1] : 0;
                       const targetCost = FACILITIES[selectedFacView].cost[viewingFacTier - 1];
                       const canAfford = remainingBudget + costToRefund >= targetCost;
                       return (
                         <button onClick={() => handleEquipFacilityTier(selectedFacView, viewingFacTier)} disabled={!canAfford} className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg ${canAfford ? 'bg-white text-[#080B14]' : 'bg-[#192235] text-[#59657A] cursor-not-allowed'}`}>
                           {canAfford ? (currentEquippedTier ? 'Upgrade to Tier ' + viewingFacTier : 'Buy') : 'Insufficient Budget'}
                         </button>
                       );
                    }
                 })()}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
