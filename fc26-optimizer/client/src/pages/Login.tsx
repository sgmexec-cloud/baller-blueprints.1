import React, { useEffect, useState } from 'react';

const RESEND_SECONDS = 45;

async function postJson(url: string, body: unknown) {
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

// Only allow redirects back into this site (prevents ?next=https://evil.com)
function getSafeNext(): string {
  const next = new URLSearchParams(window.location.search).get('next') || '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/auth/send-otp', { email: email.trim() });
      setStep('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/auth/verify-otp', { email: email.trim(), code });
      // Full reload so the app picks up the new login cookie everywhere
      window.location.href = getSafeNext();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const inputClass =
    'w-full bg-[#131A2A] border border-[#26334A] rounded-xl p-3.5 text-sm text-[#F4F7FB] placeholder-[#59657A] outline-none focus:border-[#4D8DFF] transition-colors disabled:opacity-50';
  const primaryBtn =
    'w-full py-3.5 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(77,141,255,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2';

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img src="/clubs-dna-logo.png" alt="ClubsDNA" className="w-56 object-contain drop-shadow-md" />
        </div>

        <div className="bg-[#0D1220] border border-[#26334A] rounded-2xl p-6 shadow-2xl">
          <h1 className="text-sm font-black uppercase tracking-widest text-center mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            {step === 'email' ? 'Log in or sign up' : 'Check your email'}
          </h1>
          <p className="text-[11px] text-[#8E9AAF] text-center leading-relaxed mb-5">
            {step === 'email'
              ? 'No password needed. We email you a 6-digit code. New here? An account is created automatically.'
              : <>We sent a 6-digit code to <span className="text-[#F4F7FB] font-semibold">{email.trim()}</span>. It expires in 10 minutes.</>}
          </p>

          {step === 'email' ? (
            <form onSubmit={e => { e.preventDefault(); if (email.trim() && !busy) sendCode(); }}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={busy}
                className={`${inputClass} mb-4`}
              />
              <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>
                {busy ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin" /><span>Sending…</span></>
                ) : (
                  <span>Email me a code</span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (code.length === 6 && !busy) verifyCode(); }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
                className={`${inputClass} mb-4 text-center text-xl font-black tracking-[0.5em]`}
              />
              <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
                {busy ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin" /><span>Checking…</span></>
                ) : (
                  <span>Verify and continue</span>
                )}
              </button>

              <div className="flex items-center justify-between mt-4 text-[10px] font-bold uppercase tracking-widest">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); }}
                  className="text-[#8E9AAF] hover:text-[#F4F7FB] transition-colors"
                >
                  Different email
                </button>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy || cooldown > 0}
                  className="text-[#4D8DFF] hover:text-white disabled:text-[#59657A] transition-colors"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-4 text-[11px] text-[#ff8a8a] font-bold text-center leading-relaxed">{error}</p>
          )}
        </div>

        <div className="mt-5 bg-[#131A2A]/60 border border-[#26334A]/60 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-[#F4F7FB] font-semibold">
            <span className="text-[#21E6A4]">✓</span> 5 free AI builds every month
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#F4F7FB] font-semibold">
            <span className="text-[#21E6A4]">✓</span> The Manual Builder is always free
          </div>
        </div>

        <div className="text-center mt-5">
          <a href="/" className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] hover:text-[#F4F7FB] transition-colors">
            ← Back to the builder
          </a>
        </div>
      </div>
    </div>
  );
}
