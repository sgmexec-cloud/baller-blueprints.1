import React, { useState } from 'react';

/** Attribute Priorities. Values are in-game values (they include height/weight, facility and mastery boosts). */
export interface AttributePriorities {
  weights: Record<string, number>; // 1-5 (Premium and above)
  min: Record<string, number>;     // target floor (Premium+ and above)
  max: Record<string, number>;     // hard ceiling (Premium+ and above)
  exclude: string[];               // skipped unless nothing else can use the AP (VIP)
}

export const EMPTY_PRIORITIES: AttributePriorities = { weights: {}, min: {}, max: {}, exclude: [] };

const PRIORITY_ATTRS = [
  "Acceleration", "Sprint Speed", "Attack Positioning", "Finishing", "Shot Power",
  "Long Shots", "Volleys", "Penalties", "Vision", "Crossing", "FK Accuracy",
  "Short Passing", "Long Passing", "Curve", "Agility", "Balance", "Reactions",
  "Ball Control", "Dribbling", "Composure", "Interceptions", "Heading Accuracy",
  "Def Awareness", "Standing Tackle", "Sliding Tackle", "Jumping", "Stamina",
  "Strength", "Aggression",
];

const TIER_RANK: Record<string, number> = { free: 0, premium: 1, premium_plus: 2, vip: 3, owner: 3 };

export interface AiGeneratorModalProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  aiPrompt: string;
  setAiPrompt: (val: string) => void;
  isGeneratingAi: boolean;
  handleGenerateBlueprint: () => void;
  handleFinalizeBuild: () => void;
  aiArchetypeLock: string;
  setAiArchetypeLock: (val: string) => void;
  aiTargetLevel: number;
  setAiTargetLevel: (val: number) => void;
  serverArchetypes: any;
  aiBlueprint: any;
  setAiBlueprint: (val: any) => void;
  progressionData: any;
  /** AI builds left this month (null/undefined while loading) */
  quota?: { tier: string; used: number; limit: number | null; remaining: number | null } | null;
  /** Last error from generating a blueprint */
  aiError?: string | null;
  onUpgrade?: () => void;
  /** Archetype Select is a paid feature (Premium and above) */
  canSelectArchetype?: boolean;
  /** Facilities for this build: let the AI choose within the Club level budget, or keep the ones already set */
  facilityMode?: 'ai' | 'keep';
  setFacilityMode?: (mode: 'ai' | 'keep') => void;
  clubLevel?: number;
  clubBudget?: number;
  keptFacilityCount?: number;
  /** The plan in effect ("free" | "premium" | "premium_plus" | "vip" | "owner") */
  tier?: string;
  attributePriorities?: AttributePriorities;
  setAttributePriorities?: React.Dispatch<React.SetStateAction<AttributePriorities>>;
  /** Balanced tops up Stamina / pace to a playable level; Authentic keeps the build exactly as scouted */
  buildStyle?: 'balanced' | 'authentic';
  setBuildStyle?: (style: 'balanced' | 'authentic') => void;
  /** Ask the AI again instead of using the saved result for this player (uses one AI build) */
  onRescout?: () => void;
}

export const AiGeneratorModal: React.FC<AiGeneratorModalProps> = ({
  isOpen,
  setIsOpen,
  aiPrompt,
  setAiPrompt,
  isGeneratingAi,
  handleGenerateBlueprint,
  handleFinalizeBuild,
  aiArchetypeLock,
  setAiArchetypeLock,
  aiTargetLevel,
  setAiTargetLevel,
  serverArchetypes,
  aiBlueprint,
  setAiBlueprint,
  progressionData,
  quota,
  aiError,
  onUpgrade,
  canSelectArchetype = true,
  facilityMode = 'keep',
  setFacilityMode,
  clubLevel = 0,
  clubBudget = 0,
  keptFacilityCount = 0,
  tier = 'free',
  attributePriorities = EMPTY_PRIORITIES,
  setAttributePriorities,
  buildStyle = 'balanced',
  setBuildStyle,
  onRescout,
}) => {
  const [prioOpen, setPrioOpen] = useState(false);

  if (!isOpen) return null;

  const outOfBuilds = !!quota && quota.remaining !== null && quota.remaining <= 0;

  const rank = TIER_RANK[tier] ?? 0;
  const canWeight = rank >= 1;
  const canMinMax = rank >= 2;
  const canExclude = rank >= 3;

  const pr = attributePriorities;
  const activeCount =
    (canWeight ? Object.keys(pr.weights).length : 0) +
    (canMinMax ? Object.keys(pr.min).length + Object.keys(pr.max).length : 0) +
    (canExclude ? pr.exclude.length : 0);

  const handleClose = () => {
    if (isGeneratingAi) return;
    setIsOpen(false);
    setAiBlueprint(null);
  };

  const cycleWeight = (attr: string) => {
    if (!setAttributePriorities || !canWeight) return;
    setAttributePriorities(p => {
      const cur = p.weights[attr] ?? 0;
      const next = cur >= 5 ? 0 : cur + 1;
      const weights = { ...p.weights };
      if (next === 0) delete weights[attr];
      else weights[attr] = next;
      return { ...p, weights };
    });
  };

  const setLimit = (kind: 'min' | 'max', attr: string, raw: string) => {
    if (!setAttributePriorities || !canMinMax) return;
    setAttributePriorities(p => {
      const next = { ...p[kind] };
      const digits = raw.replace(/\D/g, '');
      if (!digits) delete next[attr];
      else next[attr] = Math.max(1, Math.min(99, parseInt(digits, 10)));
      return { ...p, [kind]: next };
    });
  };

  const toggleExclude = (attr: string) => {
    if (!setAttributePriorities || !canExclude) return;
    setAttributePriorities(p => ({
      ...p,
      exclude: p.exclude.includes(attr) ? p.exclude.filter(a => a !== attr) : [...p.exclude, attr],
    }));
  };

  const clearPriorities = () => setAttributePriorities?.(EMPTY_PRIORITIES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#080B14] border border-[#4D8DFF]/40 rounded-2xl p-5 shadow-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>AI Player Creator</h3>
          <button 
            onClick={handleClose} 
            disabled={isGeneratingAi}
            className="text-[#8E9AAF] hover:text-white transition-colors"
          >✕</button>
        </div>
        
        {/* STEP 1: INITIAL PROMPT & SETTINGS */}
        {!aiBlueprint ? (
          <div className="animate-fade-in">
            <p className="text-[11px] text-[#8E9AAF] mb-4 leading-relaxed">
              Type a player name, era, or description (e.g., <span className="text-[#F4F7FB] font-semibold">"Prime Gareth Bale 2013"</span>).
            </p>

            <div className="mb-4">
              <label className="flex items-center justify-between text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">
                <span>Archetype Preference</span>
                {!canSelectArchetype && <span className="text-[#facc15]">🔒 Premium</span>}
              </label>
              <select 
                value={canSelectArchetype ? aiArchetypeLock : 'AUTO'}
                onChange={(e) => setAiArchetypeLock(e.target.value)}
                disabled={isGeneratingAi || !canSelectArchetype}
                className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#F4F7FB] font-bold outline-none focus:border-[#4D8DFF] transition-colors disabled:opacity-50 appearance-none"
              >
                <option value="AUTO">✨ Let AI Decide</option>
                {serverArchetypes && Object.keys(serverArchetypes).map(arch => (
                   <option key={arch} value={arch}>{arch}</option>
                ))}
              </select>
              {!canSelectArchetype && (
                <p className="mt-1.5 text-[10px] text-[#8E9AAF] leading-relaxed">
                  Choosing the archetype yourself is included in the paid plans; the AI picks the best fit.{' '}
                  {onUpgrade && <button onClick={onUpgrade} className="text-[#4D8DFF] font-bold underline">See plans</button>}
                </p>
              )}
            </div>

            {quota && (
              <div className="flex items-center justify-between mb-4 bg-[#0D1220] border border-[#26334A]/60 rounded-lg px-3 py-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#8E9AAF]">AI builds this month</span>
                <span className={`text-xs font-black ${outOfBuilds ? 'text-[#ff4d4d]' : 'text-[#21E6A4]'}`}>
                  {quota.limit === null ? 'Unlimited' : `${quota.remaining} of ${quota.limit} left`}
                </span>
              </div>
            )}

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Enter player description..."
              disabled={isGeneratingAi}
              className="w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3 text-xs text-[#F4F7FB] focus:outline-none focus:border-[#4D8DFF] h-28 resize-none mb-4 disabled:opacity-50 transition-colors"
            />

            <button
              onClick={handleGenerateBlueprint}
              disabled={isGeneratingAi || !aiPrompt.trim() || outOfBuilds}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(77,141,255,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isGeneratingAi ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin" />
                  <span>Scouting Player...</span>
                </>
              ) : (
                <span>Analyze & Select Archetype ✨</span>
              )}
            </button>

            {outOfBuilds && (
              <div className="mt-3 rounded-lg border border-[#facc15]/40 bg-[#facc15]/10 p-3 text-center">
                <p className="text-[10px] text-[#facc15] font-bold leading-relaxed mb-2">
                  You've used all {quota?.limit} AI builds this month. The Manual Builder is still unlimited.
                </p>
                {onUpgrade && (
                  <button
                    onClick={onUpgrade}
                    className="px-4 py-2 rounded-lg bg-[#facc15] text-[#080B14] text-[10px] font-black uppercase tracking-widest"
                  >
                    See plans
                  </button>
                )}
              </div>
            )}

            {aiError && !outOfBuilds && (
              <p className="mt-3 text-[10px] text-[#ff8a8a] font-bold text-center leading-relaxed">{aiError}</p>
            )}
          </div>
        ) : (
          /* STEP 2: CONFIRMATION & AP OPTIMIZATION */
          <div className="animate-fade-in">
             <div className="bg-[#192235] p-4 rounded-xl mb-4 border border-[#26334A] shadow-inner">
               <div className="flex items-center gap-4 mb-3">
                 <img 
                   src={`/archetypes/${aiBlueprint.archetype.replace(/\s+/g, '-').toLowerCase()}.png`} 
                   alt={aiBlueprint.archetype} 
                   className="w-12 h-12 object-contain brightness-0 invert opacity-90 drop-shadow-md" 
                   onError={(e) => { e.currentTarget.style.display = 'none'; }}
                 />
                 <div>
                   <h4 className="text-[#21E6A4] font-black text-[10px] tracking-wider uppercase mb-0.5">{aiArchetypeLock !== 'AUTO' ? 'Your Pick' : 'AI Recommended'}</h4>
                   <p className="text-[#F4F7FB] font-bold text-lg leading-none">{aiBlueprint.archetype}</p>
                 </div>
               </div>
               {aiArchetypeLock !== 'AUTO' && (
                 <p className="text-[10px] text-[#facc15] font-semibold leading-relaxed mb-3">
                   This is a {aiBlueprint.archetype} interpretation of the player: points, PlayStyles and costs follow the {aiBlueprint.archetype} archetype, even where their real-life style differs.
                 </p>
               )}
               <p className="text-[10px] text-[#8E9AAF] leading-relaxed italic border-l-2 border-[#4D8DFF] pl-2 mb-4">"{aiBlueprint.scoutSummary}"</p>
               
               <div className="flex items-center justify-between bg-[#0D1220] p-3 rounded-lg border border-[#26334A]/60">
                  <div>
                     <label className="block text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1">Confirm Level</label>
                     <select
                       value={aiTargetLevel}
                       onChange={(e) => setAiTargetLevel(Number(e.target.value))}
                       disabled={isGeneratingAi}
                       className="bg-transparent text-[#F4F7FB] font-black text-sm outline-none cursor-pointer appearance-none"
                     >
                       {Array.from({ length: 55 }, (_, i) => i + 1).map(l => (
                          <option key={l} value={l} className="bg-[#131A2A]">Level {l}</option>
                       ))}
                     </select>
                  </div>
                  <div className="text-right">
                     <span className="block text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1">Available AP</span>
                     <span className="text-[#facc15] font-black text-lg">{progressionData?.[aiTargetLevel]?.apAvailable ?? (Math.floor(aiTargetLevel * 1.5) + 10)}</span>
                  </div>
               </div>
             </div>

             {aiBlueprint.fromCache && onRescout && (
               <div className="flex items-center justify-between gap-3 mb-4 bg-[#0D1220] border border-[#26334A]/60 rounded-lg px-3 py-2">
                 <span className="text-[10px] text-[#8E9AAF] leading-snug">Saved result for this player, so repeat builds stay consistent.</span>
                 <button
                   onClick={onRescout}
                   disabled={isGeneratingAi || outOfBuilds}
                   className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#4D8DFF] underline disabled:opacity-40"
                 >
                   Re-scout (1 build)
                 </button>
               </div>
             )}
             {aiError && (
               <p className="mb-3 text-[10px] text-[#ff8a8a] font-bold text-center leading-relaxed">{aiError}</p>
             )}

             {setFacilityMode && (
               <div className="mb-4">
                 <div className="text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">Facilities</div>
                 <div className="grid grid-cols-2 gap-2">
                   {([
                     ['ai', '✨ Let AI choose'],
                     ['keep', `Keep mine${keptFacilityCount ? ` (${keptFacilityCount})` : ''}`],
                   ] as const).map(([id, label]) => (
                     <button
                       key={id}
                       onClick={() => setFacilityMode(id)}
                       className={`py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
                         facilityMode === id
                           ? 'bg-[#4D8DFF]/15 border-[#4D8DFF] text-[#4D8DFF]'
                           : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB]'
                       }`}
                     >
                       {label}
                     </button>
                   ))}
                 </div>
                 <p className="mt-1.5 text-[10px] text-[#8E9AAF] leading-relaxed">
                   {facilityMode === 'ai'
                     ? `Picks the facilities that save you the most AP within your Club level ${clubLevel} budget (${(clubBudget / 1_000_000).toFixed(1)}M). This replaces the facilities you have set.`
                     : keptFacilityCount > 0
                       ? `Uses the ${keptFacilityCount} facilit${keptFacilityCount === 1 ? 'y' : 'ies'} you've already set.`
                       : `You haven't set any facilities, so none will be used.`}
                 </p>
               </div>
             )}

             {setBuildStyle && (
               <div className="mb-4">
                 <div className="text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">Build Style</div>
                 <div className="grid grid-cols-2 gap-2">
                   {([
                     ['balanced', 'Balanced'],
                     ['authentic', 'Authentic'],
                   ] as const).map(([id, label]) => (
                     <button
                       key={id}
                       onClick={() => setBuildStyle(id)}
                       disabled={isGeneratingAi}
                       className={`py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
                         buildStyle === id
                           ? 'bg-[#4D8DFF]/15 border-[#4D8DFF] text-[#4D8DFF]'
                           : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB]'
                       }`}
                     >
                       {label}
                     </button>
                   ))}
                 </div>
                 <p className="mt-1.5 text-[10px] text-[#8E9AAF] leading-relaxed">
                   {buildStyle === 'balanced'
                     ? 'Keeps the player true to life, but lifts Stamina to at least 75 and Acceleration and Sprint Speed to at least 70 (boosts count) so the build stays playable. Uses at most 15% of your AP.'
                     : 'No changes: the build is exactly as the scout report reads, even if that means low Stamina or pace.'}
                 </p>
               </div>
             )}

             {/* ATTRIBUTE PRIORITIES */}
             {setAttributePriorities && (
               <div className="mb-4 rounded-xl border border-[#26334A] bg-[#0D1220] overflow-hidden">
                 <button
                   onClick={() => setPrioOpen(o => !o)}
                   className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                 >
                   <span className="text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest">
                     Attribute Priorities
                     {rank === 0 && <span className="ml-2 text-[#facc15]">🔒 Premium</span>}
                     {rank > 0 && activeCount > 0 && <span className="ml-2 text-[#21E6A4]">{activeCount} set</span>}
                   </span>
                   <span className="text-[#8E9AAF] text-xs">{prioOpen ? '▲' : '▼'}</span>
                 </button>

                 {prioOpen && (
                   <div className="px-3 pb-3 border-t border-[#26334A]/60">
                     {rank === 0 ? (
                       <p className="mt-2 text-[10px] text-[#8E9AAF] leading-relaxed">
                         Tell the engine which attributes matter most to you. Included in the paid plans.{' '}
                         {onUpgrade && <button onClick={onUpgrade} className="text-[#4D8DFF] font-bold underline">See plans</button>}
                       </p>
                     ) : (
                       <>
                         <p className="mt-2 mb-2 text-[10px] text-[#8E9AAF] leading-relaxed">
                           Tap the number to set how much you want an attribute (1–5, "–" = let the AI decide).
                           {canMinMax && ' Min is a target to reach first; Max is a hard ceiling. Values include your boosts.'}
                           {canExclude && ' ✕ skips an attribute unless nothing else can use the AP.'}
                         </p>

                         <div className="flex items-center gap-1.5 px-1 mb-1 text-[8px] font-bold uppercase tracking-widest text-[#8E9AAF]">
                           <span className="flex-1">Attribute</span>
                           <span className="w-8 text-center">Want</span>
                           {canMinMax && <span className="w-11 text-center">Min</span>}
                           {canMinMax && <span className="w-11 text-center">Max</span>}
                           {canExclude && <span className="w-7 text-center">Skip</span>}
                         </div>

                         <div className="max-h-64 overflow-y-auto pr-0.5 space-y-1">
                           {PRIORITY_ATTRS.map(attr => {
                             const w = pr.weights[attr];
                             const mn = pr.min[attr];
                             const mx = pr.max[attr];
                             const ex = pr.exclude.includes(attr);
                             const clash = mn !== undefined && mx !== undefined && mn > mx;
                             return (
                               <div key={attr} className={`flex items-center gap-1.5 rounded-md px-1 py-1 ${ex ? 'opacity-50' : ''} ${clash ? 'bg-[#ff4d4d]/10' : ''}`}>
                                 <span className="flex-1 text-[10px] text-[#F4F7FB] font-semibold truncate">{attr}</span>
                                 <button
                                   onClick={() => cycleWeight(attr)}
                                   disabled={isGeneratingAi}
                                   className={`w-8 h-7 rounded-md border text-[11px] font-black ${
                                     w ? 'bg-[#4D8DFF]/20 border-[#4D8DFF] text-[#4D8DFF]' : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF]'
                                   }`}
                                 >
                                   {w ?? '–'}
                                 </button>
                                 {canMinMax && (
                                   <input
                                     inputMode="numeric"
                                     value={mn ?? ''}
                                     onChange={(e) => setLimit('min', attr, e.target.value)}
                                     placeholder="–"
                                     disabled={isGeneratingAi}
                                     className="w-11 h-7 rounded-md bg-[#131A2A] border border-[#26334A] text-center text-[11px] text-[#F4F7FB] font-bold outline-none focus:border-[#4D8DFF]"
                                   />
                                 )}
                                 {canMinMax && (
                                   <input
                                     inputMode="numeric"
                                     value={mx ?? ''}
                                     onChange={(e) => setLimit('max', attr, e.target.value)}
                                     placeholder="–"
                                     disabled={isGeneratingAi}
                                     className="w-11 h-7 rounded-md bg-[#131A2A] border border-[#26334A] text-center text-[11px] text-[#F4F7FB] font-bold outline-none focus:border-[#4D8DFF]"
                                   />
                                 )}
                                 {canExclude && (
                                   <button
                                     onClick={() => toggleExclude(attr)}
                                     disabled={isGeneratingAi}
                                     className={`w-7 h-7 rounded-md border text-[11px] font-black ${
                                       ex ? 'bg-[#ff4d4d]/20 border-[#ff4d4d] text-[#ff8a8a]' : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF]'
                                     }`}
                                   >
                                     ✕
                                   </button>
                                 )}
                               </div>
                             );
                           })}
                         </div>

                         {Object.keys(pr.min).some(a => pr.max[a] !== undefined && pr.min[a] > pr.max[a]) && (
                           <p className="mt-2 text-[10px] text-[#ff8a8a] font-semibold leading-relaxed">
                             Where a Min is above its Max, the Max wins and the Min is ignored.
                           </p>
                         )}

                         {(!canMinMax || !canExclude) && (
                           <p className="mt-2 text-[10px] text-[#8E9AAF] leading-relaxed">
                             {!canMinMax && <span>🔒 Min / Max targets: Premium+. </span>}
                             {!canExclude && <span>🔒 Skip attributes: VIP. </span>}
                             {onUpgrade && <button onClick={onUpgrade} className="text-[#4D8DFF] font-bold underline">See plans</button>}
                           </p>
                         )}

                         {activeCount > 0 && (
                           <button
                             onClick={clearPriorities}
                             disabled={isGeneratingAi}
                             className="mt-2 text-[10px] font-bold text-[#8E9AAF] underline"
                           >
                             Clear all
                           </button>
                         )}
                       </>
                     )}
                   </div>
                 )}
               </div>
             )}

             <div className="flex items-center gap-2 mb-4 bg-[#4caf50]/10 border border-[#4caf50]/30 p-2.5 rounded-lg">
               <span className="text-[#4caf50] text-sm leading-none">⚡</span>
               <span className="text-[9px] text-[#4caf50] font-bold uppercase tracking-widest leading-tight">Applying active foundation boosts to AP Math (Height, Weight, Facilities & Masteries)</span>
             </div>

             <button
               onClick={handleFinalizeBuild}
               disabled={isGeneratingAi}
               className="w-full py-3 rounded-xl bg-gradient-to-r from-[#21E6A4] to-[#10b981] text-[#080B14] font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(33,230,164,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
             >
               {isGeneratingAi ? (
                 <>
                   <div className="w-4 h-4 rounded-full border-2 border-t-[#080B14] border-transparent animate-spin" />
                   <span>Optimizing Math Engine...</span>
                 </>
               ) : (
                 <span>Optimize & Finalize Build 🚀</span>
               )}
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
