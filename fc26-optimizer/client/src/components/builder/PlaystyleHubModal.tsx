import React, { useEffect, useState } from 'react';
import { PLAYSTYLES_DATA, PLAYSTYLE_CATEGORIES } from '@/constants/playstylesData';
import { getPlaystyleIconPath, getStatCaps, isPlaystyleConflict } from '@/utils/builderUtils';
import type { PlaystyleHubModalProps, StatReq } from '@/types/builder';

type Notice = { type: 'success' | 'error'; text: string };

const stripPlus = (s: string) => (s || '').replace(/\+/g, '').trim();

export const PlaystyleHubModal: React.FC<PlaystyleHubModalProps> = ({
  isOpen,
  setIsOpen,
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
  basePsPlus,
  specPlaystyle,
  psPlusChoice,
  setPsPlusMode,
  handleUnlockPlaystyle,
}) => {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  if (isOpen !== 'playstyles') return null;

  const hasSpec = !!equippedSpecialization && !!specPlaystyle;

  const tryUnlock = (name: string, reqs: StatReq[]) => {
    const data = getUpgradeData(reqs);
    if (data.canEquip && data.cost > 0) {
      handleUnlockPlaystyle(data.upgrades);
      setNotice({ type: 'success', text: `${name} unlocked for ${data.cost} AP` });
      return;
    }
    if (!data.canEquip) {
      setNotice({
        type: 'error',
        text: data.reason === 'INSUFFICIENT AP'
          ? `Not enough AP to unlock ${name}: it needs ${data.cost} AP and you have ${availableAp}.`
          : `${name} can't be unlocked: a requirement is above this archetype's attribute cap.`,
      });
    }
  };

  const handleTileClick = (name: string, reqs: StatReq[], isBlocked: boolean) => {
    if (isBlocked) {
      setNotice({ type: 'error', text: `${name} is blocked because you already have the Plus variant equipped.` });
      return;
    }
    const isEquipped = equippedPlaystyles.includes(name);
    const { canEquip, cost } = getUpgradeData(reqs);
    const unlocked = canEquip && cost === 0;
    if (!isEquipped && !unlocked) tryUnlock(name, reqs);
    else setNotice(null);
    setSelectedPsView(name);
  };

  const goldOptions: { key: 'signature' | 'spec'; label: string; name: string; active: boolean }[] = [];
  if (basePsPlus && basePsPlus !== 'None') {
    goldOptions.push({ key: 'signature', label: 'Signature', name: basePsPlus, active: !hasSpec || psPlusChoice === 'signature' });
  }
  if (hasSpec) {
    goldOptions.push({ key: 'spec', label: 'Specialisation', name: specPlaystyle as string, active: psPlusChoice === 'spec' });
  }

  // 👉 NEW: Collect all currently equipped Playstyle+ names to check for conflicts
  const allEquippedPlus = [
    ...(basePsPlus && basePsPlus !== 'None' ? [basePsPlus] : []),
    ...(hasSpec && specPlaystyle ? [specPlaystyle] : [])
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
          <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>PlayStyle Hub</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]">
              <span className="text-[#facc15] font-black text-[13px] mr-1">{availableAp.toLocaleString()}</span>AP
            </span>
            <button onClick={() => { setIsOpen(null); setSelectedPsView(null); setNotice(null); }} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={`absolute top-[60px] left-4 right-4 z-30 rounded-xl px-4 py-3 text-[11px] font-bold tracking-wide shadow-xl border ${
              notice.type === 'success'
                ? 'bg-[#0f2a22] border-[#21E6A4]/60 text-[#21E6A4]'
                : 'bg-[#2a1216] border-[#ff4d4d]/60 text-[#ff8a8a]'
            }`}
          >
            {notice.text}
          </div>
        )}
        
        <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${selectedPsView ? 'pb-64' : 'pb-8'} hide-scrollbar`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-[#26334A] pb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#facc15]" style={{ fontFamily: "'Rajdhani', sans-serif" }}>PlayStyle+ (Gold)</span>
              </div>
              {hasSpec && <span className="text-[8px] font-bold uppercase tracking-widest text-[#59657A]">Only one can be equipped</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {goldOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { if (hasSpec) setPsPlusMode(opt.key); }}
                  className={`rounded-xl p-3.5 flex flex-row items-center gap-3 relative overflow-hidden text-left transition-all duration-200 border ${
                    opt.active
                      ? 'bg-[#131A2A] border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                      : 'bg-[#0D1220] border-[#26334A] opacity-40 hover:opacity-70 cursor-pointer'
                  } ${!hasSpec ? 'cursor-default' : ''}`}
                >
                  <div className="w-1/2 flex items-center justify-center">
                    <img src={getPlaystyleIconPath(opt.name, true)} alt={opt.name} className={`w-14 h-14 object-contain ${opt.active ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'grayscale'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <div className="w-1/2 flex flex-col justify-center">
                    <div className="text-[8px] text-[#8E9AAF] font-bold uppercase tracking-widest mb-0.5">{opt.label}</div>
                    <div className="text-[11px] font-black text-[#F4F7FB] uppercase tracking-wider leading-tight">{opt.name}</div>
                    <div className="text-[8px] text-[#facc15] font-bold uppercase mt-1 tracking-widest">
                      {opt.active ? (isPsPlusUnlocked ? 'Equipped' : 'Locked') : 'Tap to switch'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {PLAYSTYLE_CATEGORIES.map(category => {
             const categoryStyles = PLAYSTYLES_DATA.filter(ps => ps.category === category.id && ps.name !== stripPlus(activePsPlus));
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
                      const { canEquip, cost, reason } = getUpgradeData(ps.reqs);
                      const isUnlocked = canEquip && cost === 0;
                      
                      // 👉 NEW: Check if this standard style conflicts with an equipped PS+
                      const isBlockedByPlus = isPlaystyleConflict(ps.name, allEquippedPlus);
                      
                      // A blocked style is technically "locked" but we style it specifically below
                      const isLocked = !isEquipped && !isUnlocked && !isBlockedByPlus; 
                      const isCapped = isLocked && !canEquip && reason !== 'INSUFFICIENT AP';

                      return (
                        <button 
                          key={ps.name} 
                          onClick={() => handleTileClick(ps.name, ps.reqs, isBlockedByPlus)} 
                          className={`rounded-xl p-3 flex flex-row items-center gap-2.5 relative overflow-hidden text-left transition-all duration-200 border ${
                            isBlockedByPlus
                              ? 'opacity-30 bg-[#0D1220] border-[#ff4d4d]/30 cursor-not-allowed'
                              : isLocked
                                ? (isSelected ? 'opacity-70 bg-[#192235] border-[#4D8DFF]' : 'opacity-45 bg-[#0D1220] border-[#26334A] hover:opacity-70')
                                : isSelected ? 'bg-[#192235] border-[#4D8DFF] shadow-[0_0_12px_rgba(77,141,255,0.2)]'
                                : isEquipped ? 'bg-[#131A2A] border-[#21E6A4]/60'
                                : 'bg-[#131A2A] border-[#26334A] hover:bg-[#192235]'
                          }`}
                        >
                          <div className="w-1/2 flex items-center justify-center">
                             <img src={getPlaystyleIconPath(ps.name, false)} alt={ps.name} className={`w-12 h-12 object-contain drop-shadow-sm ${isBlockedByPlus ? 'grayscale' : ''}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          </div>
                          <div className="w-1/2 flex flex-col justify-center">
                            {isBlockedByPlus && <span className="text-[7px] bg-[#ff4d4d]/20 text-[#ff4d4d] px-1 py-0.5 rounded font-black uppercase mb-0.5 w-fit">Blocked By PS+</span>}
                            {isEquipped && <span className="text-[7px] bg-[#21E6A4]/20 text-[#21E6A4] px-1 py-0.5 rounded font-black uppercase mb-0.5 w-fit">Equipped</span>}
                            {isLocked && (
                              <span className="flex items-center gap-1 text-[7px] bg-[#26334A] text-[#F4F7FB] px-1 py-0.5 rounded font-black uppercase mb-0.5 w-fit">
                                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>
                                {isCapped ? 'Cap' : `${cost} AP`}
                              </span>
                            )}
                            <div className={`text-[10px] font-black uppercase tracking-wider leading-tight ${isBlockedByPlus ? 'text-[#8E9AAF]' : isEquipped ? 'text-[#21E6A4]' : 'text-[#F4F7FB]'}`}>{ps.name}</div>
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
              const { canEquip, cost, reason } = getUpgradeData(ps.reqs);
              const isEquipped = equippedPlaystyles.includes(ps.name);
              const isUnlocked = canEquip && cost === 0;
              const isBlockedByPlus = isPlaystyleConflict(ps.name, allEquippedPlus);

              let label = '';
              if (isBlockedByPlus) label = 'Blocked by Equipped PS+';
              else if (isEquipped) label = 'Deselect Element';
              else if (isUnlocked) label = hasEmptySlot ? 'Equip PlayStyle' : 'No Free Slot';
              else if (canEquip) label = `Unlock [ ${cost} AP ]`;
              else label = reason;

              const handleAction = () => {
                if (isBlockedByPlus) return;
                if (isEquipped) handleActionPlaystyle(ps.name, {}, true);
                else if (isUnlocked) handleActionPlaystyle(ps.name, {}, false);
                else tryUnlock(ps.name, ps.reqs);
              };

              return (
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 flex items-center justify-center ${(!isEquipped && !isUnlocked) || isBlockedByPlus ? 'opacity-50' : ''}`}>
                        <img src={getPlaystyleIconPath(ps.name, false)} alt={ps.name} className="w-full h-full object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                      <div className="ml-1">
                         <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider">{ps.name}</h3>
                         <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isBlockedByPlus ? 'text-[#ff4d4d]' : isEquipped || isUnlocked ? 'text-[#21E6A4]' : 'text-[#59657A]'}`}>
                           {isBlockedByPlus ? 'Blocked by PS+' : isEquipped ? 'Equipped' : isUnlocked ? 'Unlocked' : 'Locked'}
                         </div>
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

                  <button
                    onClick={handleAction}
                    disabled={isBlockedByPlus || (!isEquipped && isUnlocked && !hasEmptySlot)}
                    className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      isBlockedByPlus
                        ? 'bg-[#131A2A] border border-[#ff4d4d]/30 text-[#ff4d4d]'
                        : !isEquipped && !isUnlocked
                          ? 'bg-[#192235] border border-[#facc15]/50 text-[#facc15]'
                          : 'bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white'
                    }`}
                  >
                    {label}
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
