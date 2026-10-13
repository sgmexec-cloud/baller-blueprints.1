import React from 'react';

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
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (isGeneratingAi) return;
    setIsOpen(false);
    setAiBlueprint(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#080B14] border border-[#4D8DFF]/40 rounded-2xl p-5 shadow-2xl relative">
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
              <label className="block text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">Archetype Preference</label>
              <select 
                value={aiArchetypeLock}
                onChange={(e) => setAiArchetypeLock(e.target.value)}
                disabled={isGeneratingAi}
                className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#F4F7FB] font-bold outline-none focus:border-[#4D8DFF] transition-colors disabled:opacity-50 appearance-none"
              >
                <option value="AUTO">✨ Let AI Decide</option>
                {serverArchetypes && Object.keys(serverArchetypes).map(arch => (
                   <option key={arch} value={arch}>{arch}</option>
                ))}
              </select>
            </div>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Enter player description..."
              disabled={isGeneratingAi}
              className="w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3 text-xs text-[#F4F7FB] focus:outline-none focus:border-[#4D8DFF] h-28 resize-none mb-4 disabled:opacity-50 transition-colors"
            />

            <button
              onClick={handleGenerateBlueprint}
              disabled={isGeneratingAi || !aiPrompt.trim()}
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
                   <h4 className="text-[#21E6A4] font-black text-[10px] tracking-wider uppercase mb-0.5">AI Recommended</h4>
                   <p className="text-[#F4F7FB] font-bold text-lg leading-none">{aiBlueprint.archetype}</p>
                 </div>
               </div>
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
                       {Array.from({ length: 40 }, (_, i) => i + 1).map(l => (
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
