import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  premium: 'Premium',
  premium_plus: 'Premium Plus',
  vip: 'VIP',
  owner: 'Owner',
};

/**
 * Header control.
 *  - Logged out: a "Log in" button.
 *  - Logged in:  a small "AI 3/5" chip that opens a popover (plan, builds left, log out).
 */
export const AccountMenu: React.FC = () => {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const quotaQuery = trpc.scout.getQuota.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  if (loading) return <div className="w-[68px] h-7" aria-hidden />;

  if (!isAuthenticated) {
    return (
      <a
        // 👉 FIX: Uses hardcoded URL instead of undefined function
        href="/api/auth/login"
        className="flex items-center px-3 py-1 rounded-full border border-[#26334A] bg-[#131A2A] text-[#F4F7FB] text-[11px] font-bold transition-colors hover:bg-[#192235] hover:border-[#4D8DFF]/50"
      >
        Log in
      </a>
    );
  }

  const q = quotaQuery.data;
  const chip = q ? (q.limit === null ? 'AI ∞' : `AI ${q.remaining}/${q.limit}`) : 'Account';
  const lowOrOut = !!q && q.remaining !== null && q.remaining <= 1;
  const displayName = (user as any)?.name || (user as any)?.email || 'Your account';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account"
        className={`flex items-center px-3 py-1 rounded-full border bg-[#192235] text-[11px] font-bold transition-colors hover:bg-[#26334A] ${
          lowOrOut ? 'border-[#facc15]/50 text-[#facc15]' : 'border-[#21E6A4]/40 text-[#21E6A4]'
        }`}
      >
        {chip}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-60 bg-[#0D1220] border border-[#26334A] rounded-xl p-4 shadow-2xl">
            <div className="text-[11px] font-bold text-[#F4F7FB] truncate">{displayName}</div>
            {q && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#8E9AAF] uppercase tracking-widest font-bold">Plan</span>
                  <span className="text-[#F4F7FB] font-black">{PLAN_LABEL[q.tier] ?? q.tier}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#8E9AAF] uppercase tracking-widest font-bold">AI builds left</span>
                  <span className="text-[#21E6A4] font-black">
                    {q.limit === null ? 'Unlimited' : `${q.remaining} of ${q.limit}`}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={async () => { setOpen(false); await logout(); }}
              className="mt-3 w-full py-2 rounded-lg bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] text-[10px] font-black uppercase tracking-widest hover:bg-[#192235] transition-colors"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
};
