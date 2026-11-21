import React, { useState, useEffect, useMemo } from 'react';

// PHASE 1 CONSTANTS
import { SPECIALIZATIONS_DATA } from '@/constants/playstylesData';

// PHASE 2 HELPER UTILITIES
import { getStatCaps } from '@/utils/builderUtils';
import { calculateOVR } from '@/utils/ovrCalculator';
import { shareBuildImage } from '@/utils/buildShareImage';
import { useAccount } from '@/hooks/useAccount';
import { trpc } from '@/lib/trpc';

// PHASE 3 SUB-COMPONENTS & MODALS
import { PlaystyleSlotsRow } from '@/components/builder/PlaystyleSlots';
import { InfoTab } from '@/components/builder/InfoTab';
import { ArchetypeTab } from '@/components/builder/ArchetypeTab';
import { FoundationTab } from '@/components/builder/FoundationTab';
import { AttributesTab } from '@/components/builder/AttributesTab';
import { PlaystylesTab } from '@/components/builder/PlaystylesTab';
import { AiGeneratorModal } from '@/components/builder/AiGeneratorModal';
import { CardMatcherModal } from '@/components/builder/CardMatcherModal';
import { PlayerCardEditor, resolveWorkingImage, cardImageCandidates } from '@/components/builder/PlayerCardEditor';
import { PhysicalsModal } from '@/components/builder/PhysicalsModal';
import { SkillsModal } from '@/components/builder/SkillsModal';
import { FacilitiesModal } from '@/components/builder/FacilitiesModal';
import { MasteriesModal } from '@/components/builder/MasteriesModal';
import { PlaystyleHubModal } from '@/components/builder/PlaystyleHubModal';
import { AccountMenu } from '@/components/builder/AccountMenu';
import { AuthPromptModal } from '@/components/builder/AuthPromptModal';
import { ProfileModal } from '@/components/builder/ProfileModal';
import { PreviewBanner } from '@/components/builder/PreviewBanner';
import { FacilityPlanCard } from '@/components/builder/FacilityPlanCard';
import { PriorityReportCard } from '@/components/builder/PriorityReportCard';
import { CLUB_BUDGETS } from '@/constants/builderData';

// PHASE 4 CUSTOM HOOK
import { useBuilderLogic } from '@/hooks/useBuilderLogic';

// BOTTOM NAV TABS (icon + single-word label, equal-width columns)
const TABS = [
  { id: 'info', label: 'Info', icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></> },
  { id: 'archetype', label: 'Archetype', icon: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  { id: 'foundation', label: 'Foundation', icon: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></> },
  { id: 'attributes', label: 'Attributes', icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
  { id: 'playstyles', label: 'PlayStyles', icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/> },
] as const;

export default function ManualBuilder() {
  const {
    level, setLevel,
    archetype, handleArchetypeChange,
    height, setHeight,
    weight, setWeight,
    addedPoints, setAddedPoints,
    smLevel, wfLevel,
    clubLevel, setClubLevel,
    equippedFacilities,
    unlockedMasteries,
    equippedPlaystyles,
    equippedSpecialization,
    expandedPerk, setExpandedPerk,
    activeTab, setActiveTab,
    activeModal, setActiveModal,
    selectedFacView,
    viewingFacTier, setViewingFacTier,
    selectedPsView, setSelectedPsView,
    viewMode, setViewMode,
    isAiModalOpen, setIsAiModalOpen,
    aiPrompt, setAiPrompt,
    isGeneratingAi,
    aiArchetypeLock, setAiArchetypeLock,
    aiTargetLevel, setAiTargetLevel,
    aiBlueprint, setAiBlueprint,
    facilityMode, setFacilityMode,
    aiFacilityPlan, setAiFacilityPlan,
    attributePriorities, setAttributePriorities,
    aiPriorityReport, setAiPriorityReport,
    buildStyle, setBuildStyle,
    aiFloorReport, setAiFloorReport,
    aiError,
    isCardModalOpen, setIsCardModalOpen,
    cardMatchReport, setCardMatchReport,
    handleApplyCardMatch,
    serverArchetypes,
    progressionData,
    isArchLoading, isProgLoading,
    maxAp,
    activeBounds, activeStarCaps,
    physicalModifiers, facilityModifiers, masteryModifiers,
    currentStats, availableAp, faceStats, accelerate,
    masteryProgressPct, activeMasteriesCount, activeFacilitiesCount,
    isPsPlusUnlocked, specPlaystyle, sig1, sig2, activePsPlus, basePsPlus,
    psPlusChoice, setPsPlusMode, handleUnlockPlaystyle,
    signatureNames, specSwapIndex, setSpecSwapIndex,
    getSnapshot, applySnapshot, getProfileSnapshot,
    archetypeLevels, setArchetypeLevel,
    fac1, fac2, hasEmptySlot, remainingBudget,
    handleGenerateBlueprint, handleRescoutBlueprint, handleFinalizeBuild, handleSelectFacilityView,
    handleEquipFacilityTier, handleRemoveFacility, handleFacTouchStart,
    handleFacTouchMove, handleFacTouchEnd, toggleMasteryUnlock,
    getUpgradeData, handleActionPlaystyle, handleActionSpecialization,
    handleStarChange, handleSliderChange
  } = useBuilderLogic();

  const [activePosition, setActivePosition] = useState<string>('');
  const [showCardDiff, setShowCardDiff] = useState<boolean>(false);

  // Editable player card (name + picture). Filled automatically from a matched FUT card, editable by hand.
  const [playerName, setPlayerName] = useState<string>('');
  const [playerImage, setPlayerImage] = useState<string | null>(null);
  const [isCardEditorOpen, setIsCardEditorOpen] = useState<boolean>(false);

  const matchedCardId = cardMatchReport?.card?.id;
  useEffect(() => {
    const card = cardMatchReport?.card;
    if (!card) return;
    setPlayerName(card.name || '');
    let cancelled = false;
    resolveWorkingImage(cardImageCandidates(card)).then((url) => {
      if (!cancelled) setPlayerImage(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCardId]);

  // Saved builds keep the card's name and picture too
  const getSnapshotWithCard = (...args: any[]) => ({
    ...(getSnapshot as any)(...args),
    playerName,
    playerImage,
  });
  const applySnapshotWithCard = (data: any, ...rest: any[]) => {
    (applySnapshot as any)(data, ...rest);
    setPlayerName(data?.playerName ?? '');
    setPlayerImage(data?.playerImage ?? null);
  };

  const recommendedPositions = useMemo<string[]>(() => {
    if (!archetype) return ['ST'];
    const archData = serverArchetypes?.[archetype];
    if (archData && archData.recommended && archData.recommended.length > 0) {
      return archData.recommended;
    }
    return ['ST'];
  }, [archetype, serverArchetypes]);

  useEffect(() => {
    if (recommendedPositions.length > 0 && !recommendedPositions.includes(activePosition)) {
      setActivePosition(recommendedPositions[0]);
    }
  }, [recommendedPositions, activePosition, archetype]);

  const calcOvr = activePosition && currentStats ? calculateOVR(currentStats, activePosition) : 0;
  const finalOvr = calcOvr > 0 ? calcOvr : faceStats.ovr;

  const positionRatings = useMemo(
    () => recommendedPositions.map((pos) => ({ pos, ovr: currentStats ? calculateOVR(currentStats, pos) : 0 })),
    [recommendedPositions, currentStats]
  );

  const { user: accountUser, isAuthenticated } = useAccount();
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const quotaQuery = trpc.scout.getQuota.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const [isSharing, setIsSharing] = useState(false);

  const getShareStats = (): Record<string, number> => {
    if (!currentStats) return {};
    if (viewMode !== 'raw' || !serverArchetypes?.[archetype]) return currentStats;
    const baseObj = serverArchetypes[archetype].base;
    const raw: Record<string, number> = {};
    for (const stat in baseObj) {
      const caps = getStatCaps(archetype, stat);
      const rawBase = caps.min || baseObj[stat] || 70;
      raw[stat] = Math.min(caps.max || 99, rawBase + (addedPoints[stat] || 0));
    }
    return raw;
  };

  const handleShareBuild = async () => {
    if (!currentStats || isSharing) return;
    setIsSharing(true);
    try {
      await shareBuildImage({
        archetype,
        level,
        height,
        weight,
        smLevel,
        wfLevel,
        position: activePosition,
        ovr: finalOvr,
        positionRatings,
        faceStats,
        stats: getShareStats(),
        statsMode: viewMode === 'raw' ? 'raw' : 'boosted',
        playstylePlus: [sig1.name, sig2.name].filter((p) => p && p !== 'None').map(String),
        playstyles: equippedPlaystyles.filter(Boolean),
        facilityPlaystyles: [fac1, fac2].filter(Boolean).map(String),
        specialization: equippedSpecialization,
        apSpent: Math.max(0, maxAp - availableAp),
        apTotal: maxAp,
      });
    } catch (err) {
      console.error('Share image failed:', err);
      alert("Couldn't create the image. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  if (isArchLoading || isProgLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080B14]">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#4D8DFF] border-[#131A2A] animate-spin mb-4"></div>
        <p className="text-[#4D8DFF] font-bold tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Loading Engine Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] relative overflow-x-clip pt-2 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto relative">
        
        {/* MAIN APP LOGO */}
        <div className="flex justify-center items-center mb-4 pt-2">
          <img src="/clubs-dna-logo.png" alt="ClubsDNA Logo" className="w-full object-contain drop-shadow-md" />
        </div>

        {/* STICKY HEADER CARD */}
        <div className="sticky top-0 z-40 bg-[#080B14]/95 backdrop-blur-md pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 border-b border-[#26334A]/60 shadow-[0_10px_30px_rgba(0,0,0,0.5)] pt-3">
           
           {/* STICKY CONTROLS ROW */}
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <img src="/app-icon.png" alt="App Icon" className="w-7 h-7 object-contain rounded-md shadow-[0_0_8px_rgba(77,141,255,0.2)]" />
                <AccountMenu onOpenProfile={() => setIsProfileOpen(true)} />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleShareBuild}
                  disabled={isSharing || !currentStats}
                  aria-label="Share build as image"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#4D8DFF]/40 bg-[#192235] text-[#4D8DFF] text-[11px] font-bold transition-colors hover:bg-[#4D8DFF] hover:text-[#080B14] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  {isSharing ? 'Creating…' : 'Share'}
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#F4F7FB] font-bold text-[14px]">{availableAp.toLocaleString()}</span>
                  <div className="w-4 h-4 rounded-full bg-[#facc15] flex items-center justify-center border border-[#eab308]">
                    <span className="text-[#080B14] font-black text-[7px]">AP</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 relative group">
                  <select 
                    value={level} 
                    onChange={(e) => { setLevel(Number(e.target.value)); setAddedPoints({}); }}
                    className="bg-transparent font-bold text-[#21E6A4] text-[14px] outline-none appearance-none cursor-pointer z-10 w-4 text-center"
                  >
                    {Array.from({ length: 55 }, (_, i) => i + 1).map(l => (
                      <option key={l} value={l} className="bg-[#131A2A] text-[#21E6A4]">{l}</option>
                    ))}
                  </select>
                  <div className="w-4 h-4 rounded-full bg-[#21E6A4] flex items-center justify-center border border-[#10b981]">
                     <svg className="w-2.5 h-2.5 text-[#080B14]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>
                  </div>
                </div>
              </div>
           </div>

           {/* BUILD MODE BAR (icon + label, equal columns, sits under the account / My Profile row) */}
           <div className="grid grid-cols-3 mb-4 rounded-xl border border-[#26334A] bg-[#0D1220] overflow-hidden">
              <button
                aria-current="true"
                className="relative h-12 min-w-0 flex flex-col items-center justify-center gap-1 px-0.5 text-[#facc15]"
              >
                <span className="absolute bottom-0 inset-x-4 h-0.5 rounded-t bg-[#facc15]" />
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                </svg>
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">Manual</span>
              </button>

              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    setIsAuthPromptOpen(true);
                    return;
                  }
                  setAiTargetLevel(level);
                  setAiArchetypeLock("AUTO");
                  setFacilityMode(Object.keys(equippedFacilities).length > 0 ? 'keep' : 'ai');
                  setIsAiModalOpen(true);
                }}
                className="relative h-12 min-w-0 flex flex-col items-center justify-center gap-1 px-0.5 text-[#8E9AAF] active:text-[#F4F7FB] transition-colors border-x border-[#26334A]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 17v4"/><path d="M17 19h4"/>
                </svg>
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">AI Scout</span>
              </button>

              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    setIsAuthPromptOpen(true);
                    return;
                  }
                  setIsCardModalOpen(true);
                }}
                className="relative h-12 min-w-0 flex flex-col items-center justify-center gap-1 px-0.5 text-[#8E9AAF] active:text-[#F4F7FB] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><line x1="9" y1="16" x2="15" y2="16"/>
                </svg>
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">Card Match</span>
              </button>
           </div>

           {/* PLAYER CARD VIEW */}
           <div className="bg-[#192235] rounded-xl p-4 flex gap-5 shadow-sm items-center">
              <div 
                 className={`w-[96px] h-[135px] rounded-lg relative overflow-hidden shrink-0 bg-cover bg-center transition-all duration-300 ${
                   finalOvr >= 75 
                     ? 'shadow-[0_0_15px_rgba(250,204,21,0.2)]' 
                     : 'shadow-[0_0_15px_rgba(192,192,192,0.25)]'
                 }`}
                 style={{ backgroundImage: `url('/cards/${finalOvr >= 75 ? 'gold' : 'silver'}-card.png')` }}
              >
                 <div className="absolute z-20 flex flex-col items-center justify-center" style={{ left: '12%', top: '15%', width: '15%' }}>
                    <span className="text-[#080B14] text-[15px] font-bold leading-none tracking-tighter" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {finalOvr}
                    </span>
                 </div>
                 
                 <div className="absolute z-10 flex justify-center" style={{ left: '11.8px', top: '14.7px', width: '77.1px', height: '77.1px' }}>
                    <img 
                      src={playerImage
                        ? playerImage
                        : equippedSpecialization 
                          ? `/icons/specializations/${equippedSpecialization.toLowerCase().replace('+', '_plus').replace(/[^a-z0-9_]+/g, '-')}.png` 
                          : "/default-avatar.png"
                      }
                      alt={playerName || equippedSpecialization || "Pro"} 
                      referrerPolicy="no-referrer"
                      className={`w-full h-full drop-shadow-md transition-all duration-300 ${
                        playerImage ? 'object-cover object-top' : equippedSpecialization ? 'object-contain' : 'object-cover object-bottom'
                      }`} 
                      onError={(e) => { 
                         e.currentTarget.onerror = null; 
                         e.currentTarget.src = '/default-avatar.png'; 
                      }} 
                    />
                 </div>
                 
                 <div className="absolute z-20 flex justify-center" style={{ left: '38.9%', top: '65.8%', width: '22.1%', height: '22.1%' }}>
                    <img 
                       src={`/archetypes/${archetype.replace(/\s+/g, '-').toLowerCase()}.png`}
                       alt={archetype}
                       className="w-full h-full object-contain brightness-0 opacity-90 drop-shadow-sm"
                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                 </div>
              </div>

              <div className="flex-1 flex flex-col justify-center py-1 min-w-0">
                 <div className="flex items-start justify-between gap-2 mb-2">
                   <div className="min-w-0">
                     <div className="text-xl font-bold text-[#F4F7FB] truncate">{playerName || archetype || "Your Pro"}</div>
                     {playerName && archetype && (
                       <div className="text-[11px] font-bold uppercase tracking-wider text-[#8E9AAF] truncate">{archetype}</div>
                     )}
                   </div>
                   <button
                     onClick={() => setIsCardEditorOpen(true)}
                     aria-label="Edit player card"
                     className="shrink-0 px-2 py-1 rounded-md border border-[#4D8DFF]/40 bg-[#131A2A] text-[#4D8DFF] text-[10px] font-bold hover:bg-[#4D8DFF] hover:text-[#080B14] transition-colors"
                   >
                     ✎ Edit
                   </button>
                 </div>
                 
                 <div className="grid grid-cols-6 gap-1 w-full max-w-[220px]">
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">PAC</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.pac}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">SHO</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.sho}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">PAS</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.pas}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">DRI</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.dri}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">DEF</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.def}</span></div>
                    <div className="flex flex-col"><span className="text-[#F4F7FB] text-[10px] opacity-70">PHY</span><span className="text-[#F4F7FB] font-bold text-[15px] transform translate-y-[2px]">{faceStats.phy}</span></div>
                 </div>
                 
                 <div className="mt-3 flex flex-wrap gap-1.5">
                    {recommendedPositions.map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setActivePosition(pos)}
                        className={`px-2.5 py-0.5 rounded-sm font-bold text-[10px] uppercase transition-colors duration-200 ${
                          activePosition === pos 
                            ? 'bg-[#4caf50] text-white shadow-[0_0_8px_rgba(76,175,80,0.5)] border border-[#4caf50]' 
                            : 'bg-[#131A2A] text-[#8E9AAF] border border-[#26334A] hover:bg-[#26334A] hover:text-[#F4F7FB]'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                 </div>
              </div>
           </div>

           <div className="mt-4 px-2">
              <PlaystyleSlotsRow 
                interactive={true}
                sig1={sig1}
                sig2={sig2}
                equippedPlaystyles={equippedPlaystyles}
                level={level}
                fac1={fac1}
                fac2={fac2}
                setActiveModal={setActiveModal}
              />
           </div>
        </div>

        {/* CARD MATCH SIMILARITY REPORT */}
        {cardMatchReport && (
          <div className="mb-6 bg-[#0D1220] border border-[#21E6A4]/40 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#21E6A4]">
                  FUT Card Match Active
                </div>
                <div className="text-sm font-black text-[#F4F7FB]">
                  {cardMatchReport.card?.overall} {cardMatchReport.card?.name} ({cardMatchReport.card?.position})
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#21E6A4]/15 border border-[#21E6A4]/50 text-xs font-black text-[#21E6A4]">
                  {cardMatchReport.similarityScore}% Match
                </span>
                <button
                  onClick={() => setCardMatchReport(null)}
                  className="text-[#8E9AAF] hover:text-[#F4F7FB] text-sm px-1"
                  aria-label="Dismiss card match report"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8E9AAF]">
              <span>Matched Archetype: <b className="text-[#F4F7FB]">{cardMatchReport.chosenArchetype}</b></span>
              <button
                onClick={() => setShowCardDiff((prev) => !prev)}
                className="font-bold text-[#4D8DFF] hover:underline"
              >
                {showCardDiff ? 'Hide Stat Diff' : 'View Stat Diff'}
              </button>
            </div>

            {showCardDiff && Array.isArray(cardMatchReport.comparison) && (
              <div className="mt-3 max-h-52 overflow-y-auto border-t border-[#26334A] pt-2.5 space-y-1 text-[11px] hide-scrollbar">
                {cardMatchReport.comparison.map((row: any) => (
                  <div key={row.attribute} className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-[#131A2A]">
                    <span className="text-[#8E9AAF]">{row.attribute}</span>
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-[#facc15]">Card {row.cardValue}</span>
                      <span className="text-[#59657A]">→</span>
                      <span className="text-[#F4F7FB]">Pro {row.proValue}</span>
                      <span
                        className={`w-8 text-right ${
                          row.diff >= 0 ? 'text-[#21E6A4]' : row.diff >= -4 ? 'text-[#facc15]' : 'text-red-400'
                        }`}
                      >
                        {row.diff >= 0 ? `+${row.diff}` : row.diff}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BUILD NOTES (usability floors and attribute priorities after an AI build) */}
        {((aiPriorityReport && aiPriorityReport.length > 0) || (aiFloorReport && aiFloorReport.length > 0)) && (
          <div className="mb-6">
            <PriorityReportCard
              report={aiPriorityReport}
              floors={aiFloorReport}
              onDismiss={() => { setAiPriorityReport(null); setAiFloorReport(null); }}
            />
          </div>
        )}

        {/* TAB RENDERING */}
        {activeTab === 'info' && (
          <InfoTab 
            archetype={archetype}
            height={height}
            weight={weight}
            accelerate={accelerate}
            masteryProgressPct={masteryProgressPct}
            smLevel={smLevel}
            wfLevel={wfLevel}
          />
        )}

        {activeTab === 'archetype' && (
          <ArchetypeTab 
            archetype={archetype}
            handleArchetypeChange={handleArchetypeChange}
            equippedSpecialization={equippedSpecialization}
            setActiveModal={setActiveModal}
            level={level}
            expandedPerk={expandedPerk}
            setExpandedPerk={setExpandedPerk}
          />
        )}

        {activeTab === 'foundation' && (
          <FoundationTab 
            height={height}
            weight={weight}
            accelerate={accelerate}
            activeMasteriesCount={activeMasteriesCount}
            activeFacilitiesCount={activeFacilitiesCount}
            setActiveModal={setActiveModal}
          />
        )}

        {activeTab === 'attributes' && currentStats && serverArchetypes && (
          <AttributesTab 
            archetype={archetype}
            serverArchetypes={serverArchetypes}
            currentStats={currentStats}
            addedPoints={addedPoints}
            viewMode={viewMode}
            setViewMode={setViewMode}
            smLevel={smLevel}
            wfLevel={wfLevel}
            setActiveModal={setActiveModal}
            physicalModifiers={physicalModifiers}
            facilityModifiers={facilityModifiers}
            masteryModifiers={masteryModifiers}
            handleSliderChange={handleSliderChange}
            availableAp={availableAp}
          />
        )}

        {activeTab === 'playstyles' && (
          <PlaystylesTab 
            level={level}
            sig1={sig1}
            sig2={sig2}
            equippedSpecialization={equippedSpecialization}
            equippedPlaystyles={equippedPlaystyles}
            fac1={fac1}
            fac2={fac2}
            setActiveModal={setActiveModal}
          />
        )}

      </div>

      {/* FIXED BOTTOM TAB BAR (outside the sticky header so position:fixed pins to the viewport) */}
      <nav
        aria-label="Build sections"
        className="fixed inset-x-0 bottom-0 z-50 bg-[#0D1220]/95 backdrop-blur-md border-t border-[#26334A]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative h-14 min-w-0 flex flex-col items-center justify-center gap-1 px-0.5 transition-colors ${
                  isActive ? 'text-[#facc15]' : 'text-[#8E9AAF] active:text-[#F4F7FB]'
                }`}
              >
                <span className={`absolute top-0 inset-x-3 h-0.5 rounded-b bg-[#facc15] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {tab.icon}
                </svg>
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <AiGeneratorModal 
        isOpen={isAiModalOpen}
        setIsOpen={setIsAiModalOpen}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        isGeneratingAi={isGeneratingAi}
        handleGenerateBlueprint={handleGenerateBlueprint}
        handleFinalizeBuild={handleFinalizeBuild}
        onRescout={handleRescoutBlueprint}
        aiArchetypeLock={aiArchetypeLock}
        setAiArchetypeLock={setAiArchetypeLock}
        aiTargetLevel={aiTargetLevel}
        setAiTargetLevel={setAiTargetLevel}
        aiBlueprint={aiBlueprint}
        setAiBlueprint={setAiBlueprint}
        progressionData={progressionData}
        serverArchetypes={serverArchetypes}
        quota={quotaQuery.data ?? null}
        aiError={aiError}
        onUpgrade={() => { window.location.href = '/pricing'; }}
        canSelectArchetype={!!accountUser && accountUser.tier !== 'free'}
        facilityMode={facilityMode}
        setFacilityMode={setFacilityMode}
        clubLevel={clubLevel}
        clubBudget={CLUB_BUDGETS[clubLevel] || 0}
        keptFacilityCount={Object.keys(equippedFacilities).length}
        tier={accountUser?.tier ?? 'free'}
        attributePriorities={attributePriorities}
        setAttributePriorities={setAttributePriorities}
        buildStyle={buildStyle}
        setBuildStyle={setBuildStyle}
      />

      <CardMatcherModal
        isOpen={isCardModalOpen}
        setIsOpen={setIsCardModalOpen}
        defaultLevel={level}
        clubLevel={clubLevel}
        equippedFacilities={equippedFacilities}
        unlockedMasteries={unlockedMasteries}
        serverArchetypes={serverArchetypes}
        progressionData={progressionData}
        canSelectArchetype={!!accountUser && accountUser.tier !== 'free'}
        onUpgrade={() => { window.location.href = '/pricing'; }}
        onApplyCardBuild={handleApplyCardMatch}
      />

      <PlayerCardEditor
        isOpen={isCardEditorOpen}
        onClose={() => setIsCardEditorOpen(false)}
        playerName={playerName}
        setPlayerName={setPlayerName}
        playerImage={playerImage}
        setPlayerImage={setPlayerImage}
        position={activePosition}
        setPosition={setActivePosition}
        positions={recommendedPositions}
        matchedCard={cardMatchReport?.card ?? null}
      />

      <AuthPromptModal isOpen={isAuthPromptOpen} onClose={() => setIsAuthPromptOpen(false)} />

      <PreviewBanner />

      <FacilityPlanCard
        plan={aiFacilityPlan}
        onClose={() => setAiFacilityPlan(null)}
        onEdit={() => setActiveModal('facilities')}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        archetypes={Object.keys(serverArchetypes ?? {})}
        archetypeLevels={archetypeLevels}
        setArchetypeLevel={setArchetypeLevel}
        archetype={archetype}
        level={level}
        getSnapshot={getSnapshotWithCard}
        applySnapshot={applySnapshotWithCard}
        getProfileSnapshot={getProfileSnapshot}
      />

      <PhysicalsModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        activeBounds={activeBounds}
        height={height}
        setHeight={setHeight}
        weight={weight}
        setWeight={setWeight}
        physicalModifiers={physicalModifiers}
        currentStats={currentStats}
      />

      <SkillsModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        activeStarCaps={activeStarCaps}
        smLevel={smLevel}
        wfLevel={wfLevel}
        handleStarChange={handleStarChange}
        availableAp={availableAp}
      />

      <FacilitiesModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        clubLevel={clubLevel}
        setClubLevel={setClubLevel}
        remainingBudget={remainingBudget}
        equippedFacilities={equippedFacilities}
        selectedFacView={selectedFacView}
        handleSelectFacilityView={handleSelectFacilityView}
        viewingFacTier={viewingFacTier}
        setViewingFacTier={setViewingFacTier}
        handleFacTouchStart={handleFacTouchStart}
        handleFacTouchMove={handleFacTouchMove}
        handleFacTouchEnd={handleFacTouchEnd}
        handleRemoveFacility={handleRemoveFacility}
        handleEquipFacilityTier={handleEquipFacilityTier}
      />

      <MasteriesModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        masteryProgressPct={masteryProgressPct}
        serverArchetypes={serverArchetypes}
        unlockedMasteries={unlockedMasteries}
        toggleMasteryUnlock={toggleMasteryUnlock}
      />

      <PlaystyleHubModal 
        isOpen={activeModal}
        setIsOpen={setActiveModal}
        level={level}
        availableAp={availableAp}
        activePsPlus={activePsPlus}
        basePsPlus={basePsPlus}
        specPlaystyle={specPlaystyle}
        psPlusChoice={psPlusChoice}
        setPsPlusMode={setPsPlusMode}
        handleUnlockPlaystyle={handleUnlockPlaystyle}
        isPsPlusUnlocked={isPsPlusUnlocked}
        equippedSpecialization={equippedSpecialization}
        equippedPlaystyles={equippedPlaystyles}
        selectedPsView={selectedPsView}
        setSelectedPsView={setSelectedPsView}
        getUpgradeData={getUpgradeData}
        handleActionPlaystyle={handleActionPlaystyle}
        hasEmptySlot={hasEmptySlot}
        archetype={archetype}
        serverArchetypes={serverArchetypes}
        addedPoints={addedPoints}
        sig1={sig1}
        sig2={sig2}
        signatureNames={signatureNames}
        specSwapIndex={specSwapIndex}
        setSpecSwapIndex={setSpecSwapIndex}
      />

      {activeModal === 'specializations' && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
              <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Browse Specializations</h2>
              <button onClick={() => setActiveModal(null)} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#131A2A] border-b border-[#26334A] shadow-md z-10">
               <div className="text-[10px] text-[#8E9AAF] tracking-wide font-medium">Select a path for <span className="font-bold text-[#F4F7FB] uppercase tracking-widest">{archetype}</span></div>
               <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest text-[#8E9AAF] mr-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>AP Remaining</span>
                  <span className="text-base font-black text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">{availableAp}</span>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8 hide-scrollbar">
              {(!SPECIALIZATIONS_DATA[archetype] || SPECIALIZATIONS_DATA[archetype].length === 0) ? (
                 <div className="text-center text-[#8E9AAF] text-xs font-bold uppercase tracking-widest mt-10">No Specializations available for this archetype.</div>
              ) : (
                SPECIALIZATIONS_DATA[archetype].map((spec) => {
                  const isEquipped = equippedSpecialization === spec.name;
                  const { canEquip, cost, upgrades, reason } = getUpgradeData(spec.reqs);
                  return (
                    <div key={spec.name} className={`bg-[#0D1220] rounded-2xl overflow-hidden transition-all duration-300 border ${isEquipped ? 'border-[#facc15] shadow-[0_0_20px_rgba(250,204,21,0.15)] ring-1 ring-[#facc15]/30' : 'border-[#26334A]'}`}>
                       <div className="p-4 flex flex-col gap-4">
                          <div className="flex justify-between items-start gap-4">
                             <div className="flex-1">
                               <div className="text-sm font-black text-[#F4F7FB] uppercase tracking-wider">{spec.name}</div>
                               <div className="text-[9px] text-[#8E9AAF] font-bold tracking-widest uppercase mt-0.5 mb-2">{spec.inspiredBy}</div>
                               <div className="text-[10px] text-[#8E9AAF] font-medium leading-relaxed bg-[#080B14] p-2.5 rounded-lg border border-[#26334A]/50">
                                 <span className="font-bold text-[#facc15] block mb-1">{spec.perk}</span>
                                 {spec.desc}
                               </div>
                             </div>
                             <div className="w-[120px] shrink-0 bg-[#080B14] rounded-xl border border-[#26334A] p-3 shadow-inner">
                               <div className="space-y-2.5">
                                 {spec.reqs.map(req => {
                                    const caps = getStatCaps(archetype, req.stat);
                                    const rawBase = caps.min || serverArchetypes?.[archetype]?.base?.[req.stat] || 70;
                                    const currentInvested = addedPoints[req.stat] || 0;
                                    
                                    const userStatWithoutMods = rawBase + currentInvested;
                                    const targetVal = req.min;
                                    const isMet = userStatWithoutMods >= targetVal;
                                    const isImpossible = targetVal > (caps.max || 99);
                                    
                                    return (
                                       <div key={req.stat}>
                                          <div className="flex justify-between items-end mb-1">
                                             <span className="text-[9px] font-bold uppercase tracking-wide text-[#8E9AAF] leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>{req.stat}</span>
                                             <span className={`text-[10px] font-black leading-none ${isMet ? 'text-[#21E6A4]' : isImpossible ? 'text-[#ff4d4d]' : 'text-[#F4F7FB]'}`}>{userStatWithoutMods}<span className="text-[#59657A] font-medium text-[8px] mx-0.5">/</span>{targetVal}</span>
                                          </div>
                                       </div>
                                    )
                                 })}
                               </div>
                             </div>
                          </div>
                          <button onClick={() => handleActionSpecialization(spec.name, upgrades, isEquipped)} disabled={!isEquipped && !canEquip} className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 ${isEquipped ? 'bg-[#131A2A] text-[#facc15] border border-[#facc15]/30 hover:bg-[#192235]' : !canEquip ? 'bg-[#131A2A] text-[#59657A] border border-[#26334A] cursor-not-allowed' : 'bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] hover:bg-[#4D8DFF] hover:text-[#080B14] shadow-[0_0_15px_rgba(77,141,255,0.15)]'}`}>
                            {isEquipped ? '✔ Equipped' : !canEquip ? reason : cost > 0 ? `Unlock (${cost} AP)` : 'Equip Path'}
                          </button>
                       </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
