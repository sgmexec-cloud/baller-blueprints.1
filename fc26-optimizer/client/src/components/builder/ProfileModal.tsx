import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAccount } from '@/hooks/useAccount';
import { MyBuildsPanel } from '@/components/builder/MyBuildsPanel';
import { useTierPreview, type PreviewTier } from '@/hooks/useTierPreview';
import { masteryFromLevel } from '@/utils/masteryFromLevel';
import type { BuildSnapshot, ProfileSnapshot } from '@/types/buildSnapshot';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Archetypes available in the builder */
  archetypes: string[];
  archetypeLevels: Record<string, number>;
  setArchetypeLevel: (arch: string, lvl: number | null) => void;
  /** Current builder state, used as the default name when saving a build */
  archetype: string;
  level: number;
  getSnapshot: () => BuildSnapshot;
  applySnapshot: (snap: BuildSnapshot) => { ok: boolean; message?: string };
  getProfileSnapshot: () => ProfileSnapshot;
}

type Notice = { type: 'success' | 'error'; text: string };

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  premium: 'Premium',
  premium_plus: 'Premium Plus',
  vip: 'VIP',
  owner: 'Owner',
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  archetypes,
  archetypeLevels,
  setArchetypeLevel,
  archetype,
  level,
  getSnapshot,
  applySnapshot,
  getProfileSnapshot,
}) => {
  const { user, logout } = useAccount();
  const utils = trpc.useUtils();
  const { setPreview, resetCounter, busy: previewBusy } = useTierPreview();

  const quotaQuery = trpc.scout.getQuota.useQuery(undefined, { enabled: isOpen, refetchOnWindowFocus: false });
  const listQuery = trpc.scout.builds.list.useQuery(undefined, { enabled: isOpen, refetchOnWindowFocus: false });
  const profileQuery = trpc.scout.builds.profileGet.useQuery(undefined, { enabled: isOpen, refetchOnWindowFocus: false });
  const profileSaveMutation = trpc.scout.builds.profileSave.useMutation();
  const profileClearMutation = trpc.scout.builds.profileClear.useMutation();

  const [tab, setTab] = useState<'profile' | 'builds'>('profile');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab('profile');
      setNotice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  if (!isOpen) return null;

  const quota = quotaQuery.data;
  const canSaveProfile = !!listQuery.data?.canSaveProfile;
  const hasProfile = !!profileQuery.data;
  const snapshot = getProfileSnapshot();
  const facilityCount = Object.keys(snapshot.equippedFacilities).length;
  const tier = quota?.tier ?? user?.tier ?? 'free';

  const saveProfile = async () => {
    setBusy(true);
    try {
      await profileSaveMutation.mutateAsync({ data: getProfileSnapshot() });
      await utils.scout.builds.profileGet.invalidate();
      setNotice({ type: 'success', text: 'Profile saved. It applies automatically every time you open the builder.' });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message === 'PAID_FEATURE' ? 'Saving a profile is included in the paid plans.' : 'Could not save your profile. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const clearProfile = async () => {
    if (!window.confirm('Clear your saved profile? Your current builder settings are not affected.')) return;
    setBusy(true);
    try {
      await profileClearMutation.mutateAsync();
      await utils.scout.builds.profileGet.invalidate();
      setNotice({ type: 'success', text: 'Saved profile cleared.' });
    } catch {
      setNotice({ type: 'error', text: 'Could not clear your profile. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...archetypes].sort((a, b) => a.localeCompare(b));
  const tabClass = (active: boolean) =>
    `flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${
      active
        ? 'bg-[#192235] text-[#F4F7FB] border border-[#4D8DFF]/40 shadow-[0_0_10px_rgba(77,141,255,0.15)]'
        : 'text-[#59657A] hover:text-[#8E9AAF] hover:bg-[#131A2A]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 bg-[#0D1220] border-b border-[#26334A]">
          <h2 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            My Profile
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-[#8E9AAF] hover:text-[#F4F7FB] p-2 text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-10 hide-scrollbar">
          {/* ACCOUNT */}
          <section className="bg-[#0D1220] border border-[#26334A] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-[#F4F7FB] truncate">{user?.name || user?.email || 'Your account'}</div>
                {user?.email && user?.name && <div className="text-[10px] text-[#8E9AAF] truncate">{user.email}</div>}
              </div>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-[#4D8DFF]/15 text-[#4D8DFF] px-2 py-1 rounded">
                {PLAN_LABEL[tier] ?? tier}
              </span>
            </div>

            <div className="flex items-center justify-between mt-3 bg-[#131A2A] rounded-lg px-3 py-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#8E9AAF]">AI builds left</span>
              <span className="text-xs font-black text-[#21E6A4]">
                {quota ? (quota.limit === null ? 'Unlimited' : `${quota.remaining} of ${quota.limit}`) : '…'}
              </span>
            </div>

            <div className="flex gap-2 mt-3">
              <a
                href="/pricing"
                className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white text-[10px] font-black uppercase tracking-widest"
              >
                {tier === 'vip' || tier === 'owner' ? 'Plans & billing' : 'Upgrade'}
              </a>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-lg bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] text-[10px] font-black uppercase tracking-widest hover:bg-[#192235] transition-colors"
              >
                Log out
              </button>
            </div>
          </section>

          {/* OWNER TOOLS: only visible on the owner account */}
          {user?.realTier === 'owner' && (
            <section className="bg-[#0D1220] border border-[#facc15]/40 rounded-xl p-4">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#facc15] mb-1">Owner tools</div>
              <p className="text-[11px] text-[#8E9AAF] leading-relaxed mb-3">
                View ClubsDNA exactly as each plan sees it. Limits and locked features are enforced on the server, so
                what you see is what that plan really gets.
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {([
                  ['owner', 'Owner'],
                  ['free', 'Free'],
                  ['premium', 'Premium'],
                  ['premium_plus', 'Prem+'],
                  ['vip', 'VIP'],
                ] as [PreviewTier, string][]).map(([id, label]) => {
                  const active = (user.previewing ? user.tier : 'owner') === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPreview(id)}
                      disabled={previewBusy}
                      className={`py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${
                        active
                          ? 'bg-[#facc15] border-[#facc15] text-[#080B14]'
                          : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={async () => {
                  await resetCounter();
                  setNotice({ type: 'success', text: 'AI build counter reset to 0.' });
                }}
                disabled={previewBusy}
                className="mt-3 w-full py-2 rounded-lg bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] text-[10px] font-black uppercase tracking-widest hover:bg-[#192235] transition-colors disabled:opacity-50"
              >
                Reset my AI build counter
              </button>
            </section>
          )}

          {/* TABS */}
          <div className="flex bg-[#0D1220] border border-[#26334A] p-1 rounded-xl">
            <button onClick={() => setTab('profile')} className={tabClass(tab === 'profile')} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              PROFILE
            </button>
            <button onClick={() => setTab('builds')} className={tabClass(tab === 'builds')} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              📁 MY BUILDS
            </button>
          </div>

          {notice && (
            <div
              role="status"
              className={`rounded-xl px-4 py-3 text-[11px] font-bold tracking-wide border ${
                notice.type === 'success'
                  ? 'bg-[#0f2a22] border-[#21E6A4]/60 text-[#21E6A4]'
                  : 'bg-[#2a1216] border-[#ff4d4d]/60 text-[#ff8a8a]'
              }`}
            >
              {notice.text}
            </div>
          )}

          {tab === 'builds' ? (
            <MyBuildsPanel
              archetype={archetype}
              level={level}
              getSnapshot={getSnapshot}
              applySnapshot={applySnapshot}
              onLoaded={onClose}
            />
          ) : (
            <>
              {/* ARCHETYPE LEVELS */}
              <section>
                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8E9AAF] mb-1">Archetype levels</div>
                <p className="text-[11px] text-[#8E9AAF] leading-relaxed mb-3">
                  Enter the level you've reached on each archetype. Masteries complete automatically at{' '}
                  <span className="text-[#F4F7FB] font-semibold">level 10</span> and{' '}
                  <span className="text-[#F4F7FB] font-semibold">level 30</span>, so you never tick them by hand.
                  The builder also opens an archetype at your level.
                </p>

                <div className="space-y-2">
                  {sorted.map(arch => {
                    const lvl = archetypeLevels[arch];
                    const m = lvl ? masteryFromLevel(lvl) : null;
                    return (
                      <div key={arch} className="flex items-center gap-3 bg-[#0D1220] border border-[#26334A] rounded-xl px-3 py-2.5">
                        <img
                          src={`/archetypes/${arch.replace(/\s+/g, '-').toLowerCase()}.png`}
                          alt=""
                          className="w-6 h-6 object-contain brightness-200 opacity-80"
                          onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                        />
                        <div className="flex-1 min-w-0 text-sm font-black text-[#F4F7FB] truncate">{arch}</div>

                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-1 rounded ${m?.l10 ? 'bg-[#21E6A4]/20 text-[#21E6A4]' : 'bg-[#131A2A] text-[#59657A]'}`}>
                          M10
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-1 rounded ${m?.l30 ? 'bg-[#21E6A4]/20 text-[#21E6A4]' : 'bg-[#131A2A] text-[#59657A]'}`}>
                          M30
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-1 rounded ${m?.l55 ? 'bg-[#21E6A4]/20 text-[#21E6A4]' : 'bg-[#131A2A] text-[#59657A]'}`}>
                          M55
                        </span>

                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={55}
                          placeholder="–"
                          aria-label={`${arch} level`}
                          value={lvl ?? ''}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === '') return setArchetypeLevel(arch, null);
                            const n = parseInt(raw, 10);
                            if (!Number.isNaN(n)) setArchetypeLevel(arch, n);
                          }}
                          className="w-14 text-center bg-[#131A2A] border border-[#26334A] rounded-lg py-1.5 text-sm font-black text-[#F4F7FB] outline-none focus:border-[#4D8DFF]"
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SAVE PROFILE */}
              <section className="bg-[#0D1220] border border-[#26334A] rounded-xl p-4">
                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8E9AAF] mb-1">Saved profile</div>
                <p className="text-[11px] text-[#8E9AAF] leading-relaxed mb-3">
                  Saves your archetype levels, masteries, club level ({snapshot.clubLevel}) and facilities ({facilityCount} set; edit them
                  in the Foundation tab). They apply automatically every time you open the builder.
                  Each saved build keeps its own copy, so changing your profile never alters old builds.
                </p>

                {canSaveProfile ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={saveProfile}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg bg-[#21E6A4]/15 border border-[#21E6A4]/50 text-[#21E6A4] text-[10px] font-black uppercase tracking-widest hover:bg-[#21E6A4]/25 transition-colors disabled:opacity-40"
                    >
                      {hasProfile ? 'Update saved profile' : 'Save my profile'}
                    </button>
                    {hasProfile && (
                      <button
                        onClick={clearProfile}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg border border-[#26334A] text-[#8E9AAF] text-[10px] font-black uppercase tracking-widest hover:text-[#F4F7FB] transition-colors disabled:opacity-40"
                      >
                        Clear
                      </button>
                    )}
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${hasProfile ? 'text-[#21E6A4]' : 'text-[#59657A]'}`}>
                      {hasProfile ? '✓ Profile active' : 'Not saved yet'}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#facc15]/30 bg-[#facc15]/10 p-3 text-[10px] text-[#facc15] font-bold leading-relaxed">
                    The levels above work for this session. Keeping them on your account is included in the paid plans.{' '}
                    <a href="/pricing" className="underline">See plans</a>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
