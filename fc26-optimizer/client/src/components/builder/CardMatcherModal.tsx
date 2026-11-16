import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { ARCH_PHYSICALS } from '@/constants/archetypeData';
import { FACILITIES, MASTERIES } from '@/constants/playstylesData';
import { CLUB_BUDGETS } from '@/constants/builderData';
import { getModifier, getApCost } from '@/utils/builderUtils';
import { optimiseFacilities, normStat } from '@/utils/facilityOptimizer';
import { samePlaystyle } from '@/utils/gameRules';

export interface CardMatcherModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  defaultLevel: number;
  clubLevel: number;
  equippedFacilities: Record<string, number>;
  unlockedMasteries: Record<string, { l10: boolean; l30: boolean; l55?: boolean }>;
  serverArchetypes: Record<string, any> | undefined;
  progressionData: any;
  canSelectArchetype: boolean;
  onUpgrade: () => void;
  onApplyCardBuild: (payload: {
    matchOutput: any;
    targetLevel: number;
    appliedFacilities: Record<string, number>;
    appliedMasteries: Record<string, { l10: boolean; l30: boolean; l55?: boolean }>;
    facilityMode: 'ai' | 'keep' | 'none';
  }) => void;
}

const POSITIONS = ['ALL', 'ST', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'LB', 'RB', 'CB'];

export function CardMatcherModal({
  isOpen,
  setIsOpen,
  defaultLevel,
  clubLevel,
  equippedFacilities,
  unlockedMasteries,
  serverArchetypes,
  progressionData,
  canSelectArchetype,
  onUpgrade,
  onApplyCardBuild,
}: CardMatcherModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  // Match options
  const [targetLevel, setTargetLevel] = useState<number>(defaultLevel);
  const [archetypeLock, setArchetypeLock] = useState<string>('AUTO');
  const [masteryMode, setMasteryMode] = useState<'current' | 'all55' | 'none'>('current');
  const [facilityMode, setFacilityMode] = useState<'ai' | 'keep' | 'none'>(
    Object.keys(equippedFacilities).length > 0 ? 'keep' : 'ai'
  );
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const cardsQuery = trpc.scout.cards.search.useQuery(
    {
      query: searchQuery.trim() || undefined,
      position: positionFilter === 'ALL' ? undefined : positionFilter,
      rarity: rarityFilter === 'ALL' ? undefined : rarityFilter,
      limit: 30,
    },
    { enabled: isOpen }
  );

  const raritiesQuery = trpc.scout.cards.getRarities.useQuery(undefined, { enabled: isOpen });
  const quotaQuery = trpc.scout.cards.getMatchQuota.useQuery(undefined, { enabled: isOpen });
  const matchCardMutation = trpc.scout.cards.matchCard.useMutation();

  const archetypeNames = useMemo(
    () =>
      Object.keys(serverArchetypes ?? {})
        .filter((a) => a !== 'Shot Stopper' && a !== 'Sweeper Keeper')
        .sort(),
    [serverArchetypes]
  );

  if (!isOpen) return null;

  const openMatchSheet = (card: any) => {
    setSelectedCard(card);
    setTargetLevel(defaultLevel);
    setArchetypeLock('AUTO');
    setMatchError(null);
  };

  const handleRunMatch = async () => {
    if (!selectedCard || isMatching) return;
    setIsMatching(true);
    setMatchError(null);

    try {
      // 1. Resolve mastery boosts according to user's selected mode
      let effectiveMasteries: Record<string, { l10: boolean; l30: boolean; l55?: boolean }> = {};
      if (masteryMode === 'current') {
        effectiveMasteries = unlockedMasteries;
      } else if (masteryMode === 'all55') {
        for (const arch of Object.keys(MASTERIES)) {
          effectiveMasteries[arch] = { l10: true, l30: true, l55: true };
        }
      }

      const masteryBoosts: Record<string, number> = {};
      Object.entries(effectiveMasteries).forEach(([arch, status]) => {
        const m = MASTERIES[arch];
        if (!m) return;
        if (status.l10 && m.l10) Object.entries(m.l10).forEach(([s, v]) => (masteryBoosts[s] = (masteryBoosts[s] || 0) + v));
        if (status.l30 && m.l30) Object.entries(m.l30).forEach(([s, v]) => (masteryBoosts[s] = (masteryBoosts[s] || 0) + v));
        if (status.l55 && m.l55) Object.entries(m.l55).forEach(([s, v]) => (masteryBoosts[s] = (masteryBoosts[s] || 0) + v));
      });

      // 2. Estimate physical boosts (for facility optimization pass)
      const guessArch =
        canSelectArchetype && archetypeLock !== 'AUTO'
          ? archetypeLock
          : archetypeNames[0] || 'Maestro';
      const bounds = ARCH_PHYSICALS[guessArch] || ARCH_PHYSICALS['Finisher'];
      const hCm = Math.min(bounds.maxH, Math.max(bounds.minH, selectedCard.heightCm ?? bounds.baseH));
      const wKg = Math.min(bounds.maxW, Math.max(bounds.minW, selectedCard.weightKg ?? bounds.baseW));
      const hMod = getModifier(hCm, bounds.baseH, 4);
      const wMod = getModifier(wKg, bounds.baseW, 8);

      const baseBoosts: Record<string, number> = {
        ...masteryBoosts,
        Jumping: (masteryBoosts['Jumping'] || 0) + hMod + wMod,
        'Sprint Speed': (masteryBoosts['Sprint Speed'] || 0) + hMod - wMod,
        Strength: (masteryBoosts['Strength'] || 0) + hMod + wMod,
        Acceleration: (masteryBoosts['Acceleration'] || 0) - hMod - wMod,
        Agility: (masteryBoosts['Agility'] || 0) - hMod - wMod,
        Balance: (masteryBoosts['Balance'] || 0) - hMod + wMod,
      };

      // 3. Resolve facilities according to selected mode
      let finalFacilities: Record<string, number> = {};
      if (facilityMode === 'keep') {
        finalFacilities = equippedFacilities;
      } else if (facilityMode === 'ai') {
        const currentInGame: Record<string, number> = {};
        const archBase = serverArchetypes?.[guessArch]?.base ?? {};
        for (const [stat, baseVal] of Object.entries(archBase)) {
          currentInGame[stat] = Number(baseVal) + (baseBoosts[stat] || 0);
        }
        const cardStyles = [...(selectedCard.playstylePlus ?? []), ...(selectedCard.playstyles ?? [])];
        const plan = optimiseFacilities({
          facilities: FACILITIES,
          budget: CLUB_BUDGETS[clubLevel] || 0,
          currentStats: currentInGame,
          pointValue: (stat, lvl) => {
            const cardTarget = selectedCard.attributes?.[stat] ?? 75;
            const weight = cardTarget >= 85 ? 1.2 : cardTarget >= 78 ? 0.9 : 0.4;
            return getApCost(guessArch, stat, lvl) * weight;
          },
          playstyleBonus: (ps) => (cardStyles.some((cs) => samePlaystyle(cs, ps)) ? 90 : 0),
        });
        finalFacilities = plan.equipped;
      }

      const fullBoosts: Record<string, number> = { ...baseBoosts };
      Object.entries(finalFacilities).forEach(([name, tier]) => {
        const fac = FACILITIES[name];
        if (fac) {
          const amt = fac.boosts[tier - 1];
          fac.stats.forEach((s) => {
            fullBoosts[s] = (fullBoosts[s] || 0) + amt;
          });
        }
      });

      // 4. Progression AP & slots for targetLevel
      const progRow = progressionData?.[targetLevel];
      const apBudget = progRow?.apAvailable ?? Math.floor(targetLevel * 1.5) + 10;
      const signatureSlots = progRow?.signatureUpgrades ?? (targetLevel >= 55 ? 2 : targetLevel >= 20 ? 1 : 0);
      const standardSlots =
        progRow?.playstyleSlots ??
        (targetLevel >= 55 ? 4 : targetLevel >= 40 ? 3 : targetLevel >= 15 ? 2 : targetLevel >= 5 ? 1 : 0);

      const forcedArchetype = canSelectArchetype && archetypeLock !== 'AUTO' ? archetypeLock : undefined;

      const result = await matchCardMutation.mutateAsync({
        cardId: selectedCard.id,
        forcedArchetype,
        apBudget,
        signatureSlots,
        standardSlots,
        foundationBoosts: fullBoosts,
        starsPrepaid: false,
      });

      onApplyCardBuild({
        matchOutput: result,
        targetLevel,
        appliedFacilities: finalFacilities,
        appliedMasteries: effectiveMasteries,
        facilityMode,
      });

      utils.scout.cards.getMatchQuota.invalidate();
      setSelectedCard(null);
      setIsOpen(false);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg === 'CARD_MATCH_LIMIT_REACHED') {
        setMatchError("You've reached your monthly FUT Card Match limit. Upgrade your plan for more matches.");
      } else if (msg === 'PAID_FEATURE') {
        setMatchError('Locking a specific archetype is available on Paid plans. Switch back to Automatic.');
      } else {
        setMatchError('Could not match this card right now. Your quota was not charged.');
      }
    } finally {
      setIsMatching(false);
    }
  };

  const quota = quotaQuery.data;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden border-x border-[#26334A]">
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
          <div>
            <h2
              className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest flex items-center gap-2"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              <span>🃏 FUT Card Matcher</span>
            </h2>
            <p className="text-[11px] text-[#8E9AAF] mt-0.5">
              Replicate any FC 27 Ultimate Team card in Pro Clubs
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {quota && (
              <span className="px-2.5 py-1 rounded-full bg-[#192235] border border-[#26334A] text-[10px] font-bold text-[#21E6A4]">
                {quota.remaining === null ? 'Unlimited' : `${quota.remaining}/${quota.limit} left`}
              </span>
            )}
            <button
              onClick={() => {
                setSelectedCard(null);
                setIsOpen(false);
              }}
              className="text-[#8E9AAF] hover:text-[#F4F7FB] p-1.5 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* STEP 2: SELECTED CARD DETAILS & MATCH OPTIONS */}
        {selectedCard ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
            <button
              onClick={() => setSelectedCard(null)}
              className="text-xs font-bold text-[#4D8DFF] hover:underline flex items-center gap-1"
            >
              ← Back to Cards
            </button>

            {/* Card Header */}
            <div className="bg-[#131A2A] border border-[#26334A] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-16 h-20 rounded-xl bg-gradient-to-b from-[#facc15]/20 to-[#192235] border border-[#facc15]/40 flex flex-col items-center justify-center shrink-0">
                <span className="text-2xl font-black text-[#facc15] leading-none">{selectedCard.overall}</span>
                <span className="text-[11px] font-bold text-[#F4F7FB] mt-1">{selectedCard.position}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-black text-[#F4F7FB] truncate">{selectedCard.name}</div>
                <div className="text-xs text-[#8E9AAF] truncate">
                  {selectedCard.rarity} {selectedCard.club ? `• ${selectedCard.club}` : ''}
                </div>
                <div className="grid grid-cols-6 gap-1 mt-2.5 text-center bg-[#080B14] p-2 rounded-lg border border-[#26334A]">
                  <div><div className="text-[9px] text-[#8E9AAF]">PAC</div><div className="text-xs font-bold">{selectedCard.faceStats.pace}</div></div>
                  <div><div className="text-[9px] text-[#8E9AAF]">SHO</div><div className="text-xs font-bold">{selectedCard.faceStats.shooting}</div></div>
                  <div><div className="text-[9px] text-[#8E9AAF]">PAS</div><div className="text-xs font-bold">{selectedCard.faceStats.passing}</div></div>
                  <div><div className="text-[9px] text-[#8E9AAF]">DRI</div><div className="text-xs font-bold">{selectedCard.faceStats.dribbling}</div></div>
                  <div><div className="text-[9px] text-[#8E9AAF]">DEF</div><div className="text-xs font-bold">{selectedCard.faceStats.defending}</div></div>
                  <div><div className="text-[9px] text-[#8E9AAF]">PHY</div><div className="text-xs font-bold">{selectedCard.faceStats.physical}</div></div>
                </div>
              </div>
            </div>

            {/* Bio & PlayStyles */}
            <div className="bg-[#0D1220] border border-[#26334A] rounded-xl p-3.5 space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-[#131A2A] p-2 rounded-lg">
                  <div className="text-[9px] text-[#8E9AAF] uppercase">Height</div>
                  <div className="font-bold text-[#F4F7FB]">{selectedCard.heightCm ? `${selectedCard.heightCm}cm` : 'Auto'}</div>
                </div>
                <div className="bg-[#131A2A] p-2 rounded-lg">
                  <div className="text-[9px] text-[#8E9AAF] uppercase">Weight</div>
                  <div className="font-bold text-[#F4F7FB]">{selectedCard.weightKg ? `${selectedCard.weightKg}kg` : 'Auto-fit'}</div>
                </div>
                <div className="bg-[#131A2A] p-2 rounded-lg">
                  <div className="text-[9px] text-[#8E9AAF] uppercase">SM / WF</div>
                  <div className="font-bold text-[#facc15]">{selectedCard.skillMoves}★ / {selectedCard.weakFoot}★</div>
                </div>
                <div className="bg-[#131A2A] p-2 rounded-lg">
                  <div className="text-[9px] text-[#8E9AAF] uppercase">Foot</div>
                  <div className="font-bold text-[#F4F7FB]">{selectedCard.preferredFoot}</div>
                </div>
              </div>

              {(selectedCard.playstylePlus?.length > 0 || selectedCard.playstyles?.length > 0) && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E9AAF] mb-1.5">Card PlayStyles</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedCard.playstylePlus ?? []).map((ps: string) => (
                      <span
                        key={ps}
                        className="px-2 py-0.5 rounded-md bg-[#facc15]/15 border border-[#facc15]/50 text-[#facc15] text-[10px] font-bold"
                      >
                        {ps}+
                      </span>
                    ))}
                    {(selectedCard.playstyles ?? []).map((ps: string) => (
                      <span
                        key={ps}
                        className="px-2 py-0.5 rounded-md bg-[#192235] border border-[#26334A] text-[#F4F7FB] text-[10px] font-medium"
                      >
                        {ps}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Match Settings */}
            <div className="bg-[#0D1220] border border-[#26334A] rounded-xl p-4 space-y-3.5">
              <div className="text-xs font-black uppercase tracking-wider text-[#4D8DFF]">Match Configuration</div>

              {/* Target Pro Level */}
              <div>
                <label className="block text-[11px] font-bold text-[#8E9AAF] mb-1">Pro Level (1–55)</label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(Number(e.target.value))}
                  className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg px-3 py-2 text-xs font-bold text-[#F4F7FB] outline-none"
                >
                  {Array.from({ length: 55 }, (_, i) => i + 1).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level {lvl}
                    </option>
                  ))}
                </select>
              </div>

              {/* Archetype Selection */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#8E9AAF]">Archetype</label>
                  {!canSelectArchetype && (
                    <button onClick={onUpgrade} className="text-[10px] font-bold text-[#facc15] hover:underline">
                      Paid feature — Upgrade
                    </button>
                  )}
                </div>
                <select
                  value={archetypeLock}
                  onChange={(e) => setArchetypeLock(e.target.value)}
                  disabled={!canSelectArchetype}
                  className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg px-3 py-2 text-xs font-bold text-[#F4F7FB] outline-none disabled:opacity-60"
                >
                  <option value="AUTO">✨ Automatic (Best Archetype Match)</option>
                  {archetypeNames.map((arch) => (
                    <option key={arch} value={arch}>
                      {arch}
                    </option>
                  ))}
                </select>
              </div>

              {/* Masteries Toggle */}
              <div>
                <label className="block text-[11px] font-bold text-[#8E9AAF] mb-1">Masteries</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'current', label: 'Current' },
                    { id: 'all55', label: 'All Lvl 55' },
                    { id: 'none', label: 'None' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMasteryMode(opt.id as any)}
                      className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${
                        masteryMode === opt.id
                          ? 'bg-[#192235] border-[#21E6A4] text-[#21E6A4]'
                          : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Facilities Toggle */}
              <div>
                <label className="block text-[11px] font-bold text-[#8E9AAF] mb-1">
                  Club Facilities (Club Lvl {clubLevel})
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'ai', label: 'AI Optimised' },
                    { id: 'keep', label: 'Current' },
                    { id: 'none', label: 'None' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFacilityMode(opt.id as any)}
                      className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${
                        facilityMode === opt.id
                          ? 'bg-[#192235] border-[#4D8DFF] text-[#4D8DFF]'
                          : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {matchError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-300 flex items-center justify-between gap-2">
                <span>{matchError}</span>
                {matchError.includes('Upgrade') && (
                  <button
                    onClick={onUpgrade}
                    className="px-2.5 py-1 rounded-lg bg-[#facc15] text-[#080B14] font-black text-[10px] shrink-0"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleRunMatch}
              disabled={isMatching}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#21E6A4] text-[#080B14] font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-95 disabled:opacity-50"
            >
              {isMatching ? 'Matching Card Stats...' : `Match ${selectedCard.name} (1 Match)`}
            </button>
          </div>
        ) : (
          /* STEP 1: CARD BROWSER & SEARCH */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 bg-[#0D1220] border-b border-[#26334A] space-y-2.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FC 27 player (e.g. Mbappé, Bellingham, Putellas)..."
                className="w-full bg-[#131A2A] border border-[#26334A] focus:border-[#4D8DFF] rounded-xl px-3.5 py-2.5 text-xs text-[#F4F7FB] placeholder-[#59657A] outline-none"
              />

              <div className="flex gap-2 items-center">
                <div className="flex-1 flex gap-1 overflow-x-auto hide-scrollbar">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setPositionFilter(pos)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border ${
                        positionFilter === pos
                          ? 'bg-[#192235] text-[#21E6A4] border-[#21E6A4]/50'
                          : 'bg-[#131A2A] text-[#8E9AAF] border-transparent'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>

                <select
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value)}
                  className="bg-[#131A2A] border border-[#26334A] rounded-lg px-2 py-1 text-[10px] font-bold text-[#F4F7FB] outline-none max-w-[110px]"
                >
                  <option value="ALL">All Rarities</option>
                  {(raritiesQuery.data ?? []).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 hide-scrollbar">
              {cardsQuery.isLoading ? (
                <div className="text-center text-xs text-[#8E9AAF] py-12">Searching FC 27 cards...</div>
              ) : (cardsQuery.data ?? []).length === 0 ? (
                <div className="text-center text-xs text-[#8E9AAF] py-12">
                  No cards found. Try searching another player name.
                </div>
              ) : (
                (cardsQuery.data ?? []).map((card: any) => (
                  <div
                    key={card.id}
                    className="bg-[#0D1220] hover:bg-[#131A2A] border border-[#26334A] rounded-xl p-3 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-14 rounded-lg bg-[#192235] border border-[#facc15]/40 flex flex-col items-center justify-center shrink-0">
                        <span className="text-base font-black text-[#facc15] leading-none">{card.overall}</span>
                        <span className="text-[9px] font-bold text-[#F4F7FB] mt-0.5">{card.position}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-[#F4F7FB] truncate">{card.name}</div>
                        <div className="text-[10px] text-[#8E9AAF] truncate">
                          {card.rarity} • {card.skillMoves}★/{card.weakFoot}★
                          {card.playstylePlus?.[0] ? ` • ${card.playstylePlus[0]}+` : ''}
                        </div>
                        <div className="flex gap-2 mt-1 text-[10px] font-bold text-[#8E9AAF]">
                          <span>PAC <b className="text-[#F4F7FB]">{card.faceStats.pace}</b></span>
                          <span>SHO <b className="text-[#F4F7FB]">{card.faceStats.shooting}</b></span>
                          <span>PAS <b className="text-[#F4F7FB]">{card.faceStats.passing}</b></span>
                          <span>DRI <b className="text-[#F4F7FB]">{card.faceStats.dribbling}</b></span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => openMatchSheet(card)}
                      className="px-3 py-2 rounded-lg bg-[#192235] hover:bg-[#4D8DFF] text-[#4D8DFF] hover:text-[#080B14] border border-[#4D8DFF]/40 font-black text-[10px] uppercase tracking-wider shrink-0 transition-colors"
                    >
                      Match
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
