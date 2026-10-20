import React from 'react';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What the visitor tried to use */
  reason?: 'ai' | 'builds';
}

const COPY = {
  ai: {
    icon: '✨',
    title: 'Log in for AI Auto-Build',
    text: 'The Manual Builder is free for everyone. Create a free account to unlock AI Auto-Build.',
    bullets: ['5 free AI builds every month', 'Unlimited manual builds'],
  },
  builds: {
    icon: '📁',
    title: 'Log in to save your builds',
    text: 'The Manual Builder is free for everyone. Create a free account to save your builds and come back to them any time.',
    bullets: ['Save a build for free (more on paid plans)', '5 free AI builds every month'],
  },
} as const;

/** Shown when a logged-out visitor taps a feature that needs an account. The Manual Builder never does. */
export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, onClose, reason = 'ai' }) => {
  if (!isOpen) return null;
  const copy = COPY[reason];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-[#080B14] border border-[#4D8DFF]/40 rounded-2xl p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-4 text-[#8E9AAF] hover:text-white transition-colors"
        >✕</button>

        <div className="text-2xl mb-2">{copy.icon}</div>
        <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          {copy.title}
        </h3>
        <p className="text-[11px] text-[#8E9AAF] leading-relaxed mb-5">
          {copy.text}
        </p>

        <div className="bg-[#131A2A] border border-[#26334A] rounded-xl p-3 mb-5 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-[#F4F7FB] font-semibold">
            <span className="text-[#21E6A4]">✓</span> {copy.bullets[0]}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#F4F7FB] font-semibold">
            <span className="text-[#21E6A4]">✓</span> {copy.bullets[1]}
          </div>
        </div>

        <button
          onClick={() => { window.location.href = '/login?next=/'; }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(77,141,255,0.4)] mb-2"
        >
          Log in / Create free account
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-[#8E9AAF] hover:text-[#F4F7FB] font-bold uppercase tracking-widest text-[10px] transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};
