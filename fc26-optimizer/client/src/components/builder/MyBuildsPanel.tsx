import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { BuildSnapshot } from '@/types/buildSnapshot';

interface MyBuildsPanelProps {
  archetype: string;
  level: number;
  getSnapshot: () => BuildSnapshot;
  applySnapshot: (snap: BuildSnapshot) => { ok: boolean; message?: string };
  /** Called after a build has been loaded (the profile screen closes itself) */
  onLoaded: () => void;
}

type Notice = { type: 'success' | 'error'; text: string };

const friendlyError = (err: any): string => {
  const msg = err?.message;
  if (msg === 'BUILD_LIMIT_REACHED') return "You've reached your saved-build limit. Delete one, or upgrade for more space.";
  return msg && msg.length < 120 ? msg : 'Something went wrong. Please try again.';
};

export const MyBuildsPanel: React.FC<MyBuildsPanelProps> = ({ archetype, level, getSnapshot, applySnapshot, onLoaded }) => {
  const utils = trpc.useUtils();
  const listQuery = trpc.scout.builds.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const saveMutation = trpc.scout.builds.save.useMutation();
  const duplicateMutation = trpc.scout.builds.duplicate.useMutation();
  const removeMutation = trpc.scout.builds.remove.useMutation();

  const [name, setName] = useState(`${archetype} L${level}`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const data = listQuery.data;
  const atLimit = !!data && data.limit !== null && data.used >= data.limit;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) setNotice({ type: 'success', text: msg });
    } catch (err: any) {
      setNotice({ type: 'error', text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const refresh = () => utils.scout.builds.list.invalidate();

  const saveNew = () =>
    run(async () => {
      await saveMutation.mutateAsync({ name: name.trim() || `${archetype} L${level}`, data: getSnapshot() });
      await refresh();
      return 'Build saved.';
    });

  const overwrite = (id: number, buildName: string) =>
    run(async () => {
      if (!window.confirm(`Replace "${buildName}" with your current build?`)) return;
      await saveMutation.mutateAsync({ id, name: buildName, data: getSnapshot() });
      await refresh();
      return 'Build updated.';
    });

  const load = (id: number, buildName: string) =>
    run(async () => {
      if (!window.confirm(`Load "${buildName}"? Your current build will be replaced, so save it first if you want to keep it.`)) return;
      const snap = await utils.scout.builds.get.fetch({ id });
      const result = applySnapshot(snap as BuildSnapshot);
      if (!result.ok) throw new Error(result.message);
      onLoaded();
    });

  const duplicate = (id: number) =>
    run(async () => {
      await duplicateMutation.mutateAsync({ id });
      await refresh();
      return 'Build duplicated.';
    });

  const remove = (id: number, buildName: string) =>
    run(async () => {
      if (!window.confirm(`Delete "${buildName}"? This can't be undone.`)) return;
      await removeMutation.mutateAsync({ id });
      await refresh();
      return 'Build deleted.';
    });

  const small = 'px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-colors disabled:opacity-40';

  return (
    <div className="space-y-6">
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

      {/* SAVE CURRENT BUILD */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8E9AAF]">Save current build</div>
          {data && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]">
              <span className="text-[#21E6A4] font-black text-[13px] mr-1">{data.used}</span>
              of {data.limit === null ? '∞' : data.limit} saved
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            placeholder="Build name"
            className="flex-1 min-w-0 bg-[#131A2A] border border-[#26334A] rounded-xl px-3 py-2.5 text-sm text-[#F4F7FB] outline-none focus:border-[#4D8DFF]"
          />
          <button
            onClick={saveNew}
            disabled={busy || atLimit}
            className="px-4 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {atLimit && (
          <p className="mt-2 text-[10px] text-[#facc15] font-bold leading-relaxed">
            You've used all {data?.limit} saved-build slots.{' '}
            <a href="/pricing" className="underline">See plans</a> for more, or delete one below.
          </p>
        )}
      </section>

      {/* SAVED BUILDS */}
      <section>
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8E9AAF] mb-2">Saved builds</div>
        {listQuery.isLoading ? (
          <div className="text-[11px] text-[#59657A] text-center py-6">Loading…</div>
        ) : !data || data.builds.length === 0 ? (
          <div className="text-[11px] text-[#59657A] text-center py-6 border border-dashed border-[#26334A] rounded-xl">
            Nothing saved yet. Build something, then save it here.
          </div>
        ) : (
          <div className="space-y-3">
            {data.builds.map(b => (
              <div key={b.id} className="bg-[#0D1220] border border-[#26334A] rounded-xl p-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-[#F4F7FB] truncate">{b.name}</div>
                  <div className="text-[10px] text-[#8E9AAF] font-semibold mt-0.5">
                    {b.archetype} · Level {b.level} · {new Date(b.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => load(b.id, b.name)} disabled={busy} className={`${small} bg-[#4D8DFF]/15 border-[#4D8DFF]/50 text-[#4D8DFF] hover:bg-[#4D8DFF]/25`}>
                    Load
                  </button>
                  <button onClick={() => overwrite(b.id, b.name)} disabled={busy} className={`${small} bg-[#131A2A] border-[#26334A] text-[#F4F7FB] hover:bg-[#192235]`}>
                    Update
                  </button>
                  <button onClick={() => duplicate(b.id)} disabled={busy || atLimit} className={`${small} bg-[#131A2A] border-[#26334A] text-[#F4F7FB] hover:bg-[#192235]`}>
                    Duplicate
                  </button>
                  <button onClick={() => remove(b.id, b.name)} disabled={busy} className={`${small} bg-transparent border-[#ff4d4d]/40 text-[#ff8a8a] hover:bg-[#ff4d4d]/10`}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
