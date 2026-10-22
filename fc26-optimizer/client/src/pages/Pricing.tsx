import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAccount } from '@/hooks/useAccount';
import { PreviewBanner } from '@/components/builder/PreviewBanner';

type PlanId = 'free' | 'premium' | 'premium_plus' | 'vip';
const RANK: Record<PlanId, number> = { free: 0, premium: 1, premium_plus: 2, vip: 3 };

// Display only. The real prices live in Stripe (STRIPE_PRICE_* env vars): keep these in sync.
// 👉 Only list features that really exist in the app, because customers are paying for them.
const PLANS: { id: PlanId; name: string; price: string; builds: number; features: string[]; highlight?: boolean }[] = [
  {
    id: 'free', name: 'Free', price: '£0', builds: 5,
    features: ['5 AI builds per month', 'Manual Builder, unlimited', 'Save 1 build', 'Share your build as an image'],
  },
  {
    id: 'premium', name: 'Premium', price: '£0.99', builds: 20,
    features: ['20 AI builds per month', 'Choose your own archetype for AI builds', 'Save up to 5 builds', 'Saved profile: archetype levels, Facilities & Masteries'],
  },
  {
    id: 'premium_plus', name: 'Premium+', price: '£1.99', builds: 60, highlight: true,
    features: ['60 AI builds per month', 'Save up to 15 builds', 'Everything in Premium'],
  },
  {
    id: 'vip', name: 'VIP', price: '£3.99', builds: 150,
    features: ['150 AI builds per month', 'Save up to 50 builds', 'Everything in Premium+', 'Priority support'],
  },
];

async function post(url: string, body: unknown = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data;
}

export default function Pricing() {
  const { user, isAuthenticated, loading } = useAccount();
  const utils = trpc.useUtils();
  const quota = trpc.scout.getQuota.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const tier = (user?.tier ?? 'free') as PlanId;
  const hasSubscription = !!user?.hasSubscription && tier !== 'free';

  // Back from Stripe Checkout: the webhook upgrades the account a moment later, so poll for a few seconds
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('checkout');
    if (status === 'cancelled') setMessage('Checkout cancelled. You have not been charged.');
    if (status !== 'success') return;

    setMessage('Payment received. Your plan is updating…');
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      utils.scout.me.invalidate();
      utils.scout.getQuota.invalidate();
      if (tries >= 10) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const subscribe = (plan: PlanId) =>
    run(plan, async () => {
      const { url } = await post('/api/billing/checkout', { plan });
      window.location.href = url; // off to Stripe Checkout
    });

  const upgrade = (plan: PlanId, name: string) =>
    run(plan, async () => {
      if (!window.confirm(`Upgrade to ${name}? You'll be charged the prorated difference now, and keep the builds you've already used this month.`)) return;
      await post('/api/billing/change-plan', { plan });
      await Promise.all([utils.scout.me.invalidate(), utils.scout.getQuota.invalidate()]);
      setMessage(`You're now on ${name}. Enjoy your extra builds!`);
    });

  const openPortal = () =>
    run('portal', async () => {
      const { url } = await post('/api/billing/portal');
      window.location.href = url;
    });

  const renderAction = (plan: (typeof PLANS)[number]) => {
    const base = 'w-full py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all disabled:opacity-50';
    const primary = `${base} bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white shadow-[0_0_15px_rgba(77,141,255,0.35)]`;
    const quiet = `${base} bg-[#131A2A] border border-[#26334A] text-[#8E9AAF]`;

    if (plan.id === 'free') {
      return <div className={`${quiet} text-center`}>{tier === 'free' ? 'Current plan' : 'Included'}</div>;
    }
    if (!isAuthenticated) {
      return (
        <a href="/login?next=/pricing" className={`${primary} block text-center`}>
          Log in to subscribe
        </a>
      );
    }
    if (tier === plan.id) {
      return <div className={`${quiet} text-center border-[#21E6A4]/50 text-[#21E6A4]`}>Current plan</div>;
    }
    if (hasSubscription) {
      return RANK[plan.id] > RANK[tier] ? (
        <button onClick={() => upgrade(plan.id, plan.name)} disabled={!!busy} className={primary}>
          {busy === plan.id ? 'Upgrading…' : `Upgrade to ${plan.name}`}
        </button>
      ) : (
        <button onClick={openPortal} disabled={!!busy} className={quiet}>
          Change in billing
        </button>
      );
    }
    return (
      <button onClick={() => subscribe(plan.id)} disabled={!!busy} className={primary}>
        {busy === plan.id ? 'Opening checkout…' : `Subscribe to ${plan.name}`}
      </button>
    );
  };

  const q = quota.data;

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] px-4 py-8">
      <PreviewBanner />
      <div className="max-w-lg mx-auto">
        <div className="flex justify-center mb-6">
          <img src="/clubs-dna-logo.png" alt="ClubsDNA" className="w-52 object-contain drop-shadow-md" />
        </div>

        <h1 className="text-center text-base font-black uppercase tracking-widest mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          Plans
        </h1>
        <p className="text-center text-[11px] text-[#8E9AAF] mb-5">
          The Manual Builder is always free. Plans add more AI builds each month.
        </p>

        {isAuthenticated && q && (
          <div className="bg-[#131A2A] border border-[#26334A] rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]">
              Your plan: <span className="text-[#F4F7FB]">{PLANS.find(p => p.id === tier)?.name ?? tier}</span>
            </div>
            <div className="text-xs font-black text-[#21E6A4]">
              {q.limit === null ? 'Unlimited' : `${q.remaining} of ${q.limit} AI builds left`}
            </div>
          </div>
        )}

        {message && (
          <div role="status" className="mb-4 rounded-xl border border-[#21E6A4]/50 bg-[#0f2a22] px-4 py-3 text-[11px] font-bold text-[#21E6A4]">
            {message}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-[#ff4d4d]/50 bg-[#2a1216] px-4 py-3 text-[11px] font-bold text-[#ff8a8a]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`rounded-2xl p-5 border ${
                plan.highlight ? 'border-[#4D8DFF] shadow-[0_0_20px_rgba(77,141,255,0.2)] bg-[#0D1220]' : 'border-[#26334A] bg-[#0D1220]'
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-widest">{plan.name}</h2>
                  {plan.highlight && (
                    <span className="text-[8px] font-black uppercase tracking-widest bg-[#4D8DFF]/20 text-[#4D8DFF] px-2 py-0.5 rounded">Popular</span>
                  )}
                </div>
                <div className="text-lg font-black">
                  {plan.price}
                  {plan.id !== 'free' && <span className="text-[10px] font-bold text-[#8E9AAF]"> /month</span>}
                </div>
              </div>

              <ul className="my-3 space-y-1.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] text-[#F4F7FB] font-semibold">
                    <span className="text-[#21E6A4]">✓</span> {f}
                  </li>
                ))}
              </ul>

              {!loading && renderAction(plan)}
            </div>
          ))}
        </div>

        {isAuthenticated && (user?.hasSubscription || tier !== 'free') && (
          <button
            onClick={openPortal}
            disabled={!!busy}
            className="w-full mt-5 py-3 rounded-xl bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] font-black uppercase tracking-widest text-[10px] hover:bg-[#192235] transition-colors disabled:opacity-50"
          >
            {busy === 'portal' ? 'Opening…' : 'Manage billing · invoices, card, cancel'}
          </button>
        )}

        <div className="text-center mt-6">
          <a href="/" className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] hover:text-[#F4F7FB] transition-colors">
            ← Back to the builder
          </a>
        </div>
      </div>
    </div>
  );
}
