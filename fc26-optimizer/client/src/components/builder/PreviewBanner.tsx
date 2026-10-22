import React from 'react';
import { useAccount } from '@/hooks/useAccount';
import { useTierPreview } from '@/hooks/useTierPreview';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  premium: 'Premium',
  premium_plus: 'Premium Plus',
  vip: 'VIP',
};

/** Floating reminder, shown only while the owner is previewing another plan. */
export const PreviewBanner: React.FC = () => {
  const { user } = useAccount();
  const { setPreview, busy } = useTierPreview();

  if (!user?.previewing) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-full bg-[#facc15] text-[#080B14] pl-4 pr-2 py-2 shadow-[0_0_25px_rgba(250,204,21,0.45)]"
    >
      <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
        👁 Previewing {PLAN_LABEL[user.tier] ?? user.tier}
      </span>
      <button
        onClick={() => setPreview('owner')}
        disabled={busy}
        className="rounded-full bg-[#080B14] text-[#facc15] px-3 py-1 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
      >
        Back to Owner
      </button>
    </div>
  );
};
