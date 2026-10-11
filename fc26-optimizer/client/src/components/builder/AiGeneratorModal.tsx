import React from 'react';
import type { AiGeneratorModalProps } from '@/types/builder';

export const AiGeneratorModal: React.FC<AiGeneratorModalProps> = ({
  isOpen,
  setIsOpen,
  aiPrompt,
  setAiPrompt,
  isGeneratingAi,
  handleRunAiBuild,
  aiArchetypeLock,
  setAiArchetypeLock,
  aiTargetLevel,
  setAiTargetLevel,
  serverArchetypes,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#080B14] border border-[#4D8DFF]/40 rounded-2xl p-5 shadow-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>AI Player Creator</h3>
          <button 
            onClick={() => !isGeneratingAi && setIsOpen(false)} 
            disabled={isGeneratingAi}
            className="text-[#8E9AAF] hover:text-white transition-colors"
          >✕</button>
        </div>
        
        <p className="text-[11px] text-[#8E9AAF] mb-4 leading-relaxed">
          Type a player name, era, or description (e.g., <span className="text-[#F4F7FB] font-semibold">"Prime Gareth Bale 2013"</span>).
        </p>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
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
          <div className="w-[110px] shrink-0">
            <label className="block text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">Target Level</label>
            <select
              value={aiTargetLevel}
              onChange={(e) => setAiTargetLevel(Number(e.target.value))}
              disabled={isGeneratingAi}
              className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#21E6A4] font-black outline-none focus:border-[#4D8DFF] transition-colors disabled:opacity-50 appearance-none"
            >
              {Array.from({ length: 40 }, (_, i) => i + 1).map(l => (
                 <option key={l} value={l}>Lvl {l}</option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Enter player description..."
          disabled={isGeneratingAi}
          className="w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3 text-xs text-[#F4F7FB] focus:outline-none focus:border-[#4D8DFF] h-28 resize-none mb-4 disabled:opacity-50 transition-colors"
        />

        <button
          onClick={handleRunAiBuild}
          disabled={isGeneratingAi || !aiPrompt.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(77,141,255,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isGeneratingAi ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin" />
              <span>Scouting & Optimizing Math...</span>
            </>
          ) : (
            <span>Generate Build ✨</span>
          )}
        </button>
      </div>
    </div>
  );
};
