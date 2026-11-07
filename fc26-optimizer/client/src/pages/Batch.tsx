import React, { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAccount } from '@/hooks/useAccount';
import { runAiBuildPipeline, allMasteriesUnlocked, type BatchBuildSettings } from '@/utils/aiBuildPipeline';
import { computeBuildView } from '@/utils/buildView';
import { mergeMasteries } from '@/utils/masteryFromLevel';
import { buildExport, downloadCsv, EXPORT_KINDS, type ExportKind } from '@/utils/batchExport';
import { parsePlayerList, playerIdentity, friendlyError, runQueue, composeBuildRecord, summarise } from '@/utils/batchRunner';
import { NewBatchForm, SavedBatches, BatchView, type BatchItemView, type BatchSettingsView } from '@/components/batch/BatchPanels';

type OpenBatch = { id: number; name: string; settings: BatchSettingsView };

const defaultName = () => `Batch ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

const toView = (r: any): BatchItemView => ({
  id: r.id,
  position: r.position,
  playerName: r.playerName,
  note: r.note ?? null,
  status: r.status,
  error: r.error ?? null,
  blueprint: r.blueprint ?? null,
  build: r.build ?? null,
  social: r.social ?? null,
  selected: !!r.selected,
});

// Defined outside the page so it keeps its identity between renders (typing in a box must not lose focus)
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#080B14] text-[#F4F7FB] px-4 pt-4 pb-16">
    <div className="max-w-lg mx-auto space-y-4">{children}</div>
  </div>
);

export default function BatchPage() {
  const { user, loading } = useAccount();
  // realTier is the stored plan, so previewing another plan does not lock the owner out
  const isOwner = (user?.realTier ?? user?.tier) === 'owner';
  const utils = trpc.useUtils();

  // ── data ──
  const listQuery = trpc.scout.batches.list.useQuery(undefined, { enabled: isOwner, refetchOnWindowFocus: false });
  const archQuery = trpc.scout.getArchetypeBaseStats.useQuery(undefined, { enabled: isOwner, refetchOnWindowFocus: false });
  const progQuery = trpc.build.getProgression.useQuery({ gameVersion: 'FC27' } as any, { enabled: isOwner, refetchOnWindowFocus: false });
  const profileQuery = trpc.scout.builds.profileGet.useQuery(undefined, { enabled: isOwner, refetchOnWindowFocus: false });
  const serverArchetypes: any = archQuery.data;
  const progression: any = progQuery.data;
  const profile: any = profileQuery.data;

  const createM = trpc.scout.batches.create.useMutation();
  const updateItemM = trpc.scout.batches.updateItem.useMutation();
  const requeueM = trpc.scout.batches.requeueRunning.useMutation();
  const removeBatchM = trpc.scout.batches.remove.useMutation();
  const removeItemM = trpc.scout.batches.removeItem.useMutation();
  const addItemsM = trpc.scout.batches.addItems.useMutation();
  const setAllSelectedM = trpc.scout.batches.setAllSelected.useMutation();
  const generateSocialM = trpc.scout.batches.generateSocial.useMutation();
  const generateM = trpc.scout.generateReport.useMutation();
  const statsM = trpc.scout.calculateStats.useMutation();

  // ── new batch form ──
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [facilityMode, setFacilityMode] = useState<'ai' | 'keep'>('ai');
  const [clubLevel, setClubLevel] = useState(10);
  const [masteriesMode, setMasteriesMode] = useState<'all' | 'profile'>('all');
  const [buildStyle, setBuildStyle] = useState<'balanced' | 'authentic'>('balanced');
  const [concurrency, setConcurrency] = useState(2);
  const parsed = useMemo(() => parsePlayerList(text), [text]);

  // ── open batch ──
  const [open, setOpen] = useState<OpenBatch | null>(null);
  const [items, setItems] = useState<BatchItemView[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [socialBusy, setSocialBusy] = useState<number[]>([]);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const stopRef = useRef(false);
  const runningRef = useRef(false);

  const keptFacilities: Record<string, number> = profile?.equippedFacilities ?? {};
  const summary = useMemo(() => summarise(items), [items]);
  // What an export would hold right now (selected, finished players)
  const exportInfo = useMemo(() => {
    const r = buildExport('titles', items, open?.name ?? 'batch');
    return { ready: r.rowCount, usingTemplate: r.usedTemplate.length, skipped: r.skipped.length };
  }, [items, open]);
  const missingCopy = useMemo(() => items.filter(i => i.status === 'done' && !i.social).length, [items]);

  // Leaving the page mid-run would stop the builds
  useEffect(() => {
    if (!running) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [running]);

  const patchItem = (id: number, patch: Partial<BatchItemView>) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const save = async (id: number, patch: Record<string, unknown>) => {
    await updateItemM.mutateAsync({ id, ...patch } as any);
  };

  const pipelineSettings = (s: BatchSettingsView): BatchBuildSettings => ({
    level: s.level,
    facilityMode: s.facilityMode,
    clubLevel: s.clubLevel,
    keptFacilities: s.keptFacilities ?? {},
    masteries:
      s.masteriesMode === 'profile'
        ? mergeMasteries((profile?.unlockedMasteries ?? {}) as any, (profile?.archetypeLevels ?? {}) as any)
        : allMasteriesUnlocked(),
    buildStyle: s.buildStyle,
  });

  /** Write (or rewrite) the social copy for one finished player. Throws if it fails. */
  const writeCopy = async (item: BatchItemView) => {
    setSocialBusy(b => (b.includes(item.id) ? b : [...b, item.id]));
    try {
      const social = await generateSocialM.mutateAsync({ id: item.id, useAI: true } as any);
      patchItem(item.id, { social });
    } finally {
      setSocialBusy(b => b.filter(x => x !== item.id));
    }
  };

  /** One player, start to finish: scout, build, save. Throws if anything fails. */
  const processItem = async (item: BatchItemView, s: BatchSettingsView, rescout: boolean) => {
    if (!serverArchetypes || !progression) throw new Error('Game data is still loading. Try again in a moment.');
    try { await save(item.id, { status: 'running', error: null }); } catch { /* progress marker only */ }

    const raw: any = await generateM.mutateAsync({
      playerIdentity: playerIdentity(item.playerName, item.note),
      rescout,
      gameVersion: 'FC27',
    } as any);
    const blueprint = { ...raw };
    delete blueprint.fromCache;

    const result = await runAiBuildPipeline(blueprint, pipelineSettings(s), {
      serverArchetypes,
      progressionData: progression,
      calculateStats: input => statsM.mutateAsync(input as any),
    });
    const view = computeBuildView(result.snapshot, serverArchetypes);
    const build = composeBuildRecord(result, view, blueprint);

    try {
      await save(item.id, { status: 'done', error: null, blueprint, build });
    } catch (e) {
      throw new Error(`Built, but could not be saved: ${friendlyError(e)}`);
    }
    patchItem(item.id, { status: 'done', error: null, blueprint, build, social: null });

    // The copy is written from the saved build. If it fails the build is still good: use "Write social copy" later.
    try { await writeCopy(item); } catch { /* can be written later */ }
  };

  const runItems = async (list: BatchItemView[], s: BatchSettingsView, rescout: boolean) => {
    if (runningRef.current || list.length === 0) return;
    runningRef.current = true;
    stopRef.current = false;
    setRunning(true);
    setNotice(null);

    // Stops the phone from sleeping while it builds (not supported everywhere, so optional)
    let lock: any = null;
    try { lock = await (navigator as any).wakeLock?.request?.('screen'); } catch { /* optional */ }

    try {
      await runQueue(list, {
        concurrency: s.concurrency,
        isStopped: () => stopRef.current,
        onStart: it => patchItem(it.id, { status: 'running', error: null }),
        run: it => processItem(it, s, rescout),
        onFail: (it, err) => {
          const msg = friendlyError(err);
          patchItem(it.id, { status: 'failed', error: msg });
          save(it.id, { status: 'failed', error: msg }).catch(() => {});
        },
      });
    } finally {
      try { await lock?.release?.(); } catch { /* ignore */ }
      runningRef.current = false;
      setRunning(false);
      if (stopRef.current) setNotice('Stopped. Finished players are saved. Press Resume to continue.');
    }
  };

  const openBatch = async (id: number, autoStart = false) => {
    setBusy(true);
    setPageError(null);
    try {
      await requeueM.mutateAsync({ batchId: id });
      const data: any = await utils.scout.batches.get.fetch({ id });
      const next: BatchItemView[] = data.items.map(toView);
      setOpen({ id: data.id, name: data.name, settings: data.settings });
      setItems(next);
      setExpandedId(null);
      setAddOpen(false);
      setAddText('');
      setNotice(null);
      if (autoStart) void runItems(next.filter(i => i.status === 'queued'), data.settings, false);
    } catch (e) {
      setPageError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const createBatch = async () => {
    if (parsed.items.length === 0) return;
    setBusy(true);
    setPageError(null);
    try {
      const keep = facilityMode === 'keep';
      const res: any = await createM.mutateAsync({
        name: name.trim() || defaultName(),
        settings: {
          level: 55,
          facilityMode,
          clubLevel: keep ? profile?.clubLevel ?? clubLevel : clubLevel,
          keptFacilities: keep ? keptFacilities : {},
          masteriesMode,
          buildStyle,
          concurrency,
          useSavedResults: true,
        },
        items: parsed.items,
      });
      setText('');
      setName('');
      await utils.scout.batches.list.invalidate();
      await openBatch(res.id, true);
    } catch (e) {
      setPageError(friendlyError(e));
      setBusy(false);
    }
  };

  const reloadItems = async () => {
    if (!open) return;
    const data: any = await utils.scout.batches.get.fetch({ id: open.id });
    setItems(data.items.map(toView));
  };

  const closeBatch = async () => {
    setOpen(null);
    setItems([]);
    await utils.scout.batches.list.invalidate();
  };

  const deleteSaved = async (id: number) => {
    if (!window.confirm('Delete this batch and all its builds?')) return;
    setBusy(true);
    try {
      await removeBatchM.mutateAsync({ id });
      await utils.scout.batches.list.invalidate();
    } catch (e) {
      setPageError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteOpen = async () => {
    if (!open || !window.confirm('Delete this batch and all its builds?')) return;
    try {
      await removeBatchM.mutateAsync({ id: open.id });
      await closeBatch();
    } catch (e) {
      setNotice(friendlyError(e));
    }
  };

  const addPlayers = async () => {
    if (!open) return;
    const have = new Set(items.map(i => i.playerName.toLowerCase().replace(/\s+/g, ' ').trim()));
    const fresh = parsePlayerList(addText).items.filter(i => !have.has(i.playerName.toLowerCase().replace(/\s+/g, ' ').trim()));
    if (fresh.length === 0) { setNotice('Those players are already in this batch.'); return; }
    try {
      await addItemsM.mutateAsync({ batchId: open.id, items: fresh });
      setAddText('');
      setAddOpen(false);
      await reloadItems();
      setNotice(`${fresh.length} player${fresh.length === 1 ? '' : 's'} added. Press Start to build them.`);
    } catch (e) {
      setNotice(friendlyError(e));
    }
  };

  const regenerateCopy = async (item: BatchItemView) => {
    try {
      await writeCopy(item);
    } catch (e) {
      setNotice(`Could not write the copy for ${item.playerName}: ${friendlyError(e)}`);
    }
  };

  const writeMissingCopy = async () => {
    const todo = items.filter(i => i.status === 'done' && !i.social);
    if (todo.length === 0) return;
    let failed = 0;
    await runQueue(todo, {
      concurrency: 2,
      isStopped: () => false,
      run: it => writeCopy(it),
      onFail: () => { failed++; },
    });
    setNotice(failed > 0 ? `Copy written, but ${failed} could not be written. Press the button again to retry.` : 'Social copy written for every finished player.');
  };

  const saveSocial = async (item: BatchItemView, social: any) => {
    try {
      await save(item.id, { social });
      patchItem(item.id, { social });
    } catch (e) {
      setNotice(`Could not save your changes for ${item.playerName}: ${friendlyError(e)}`);
    }
  };

  const doExport = (kind: ExportKind) => {
    if (!open) return;
    const r = buildExport(kind, items, open.name);
    if (r.rowCount === 0) { setExportNotice('Tick at least one finished player first.'); return; }
    downloadCsv(r.filename, r.csv);
    setExportNotice(
      `Downloaded ${r.filename} (${r.rowCount} row${r.rowCount === 1 ? '' : 's'}).` +
        (r.usedTemplate.length > 0 ? ` Template wording used for ${r.usedTemplate.length}.` : '') +
        (r.skipped.length > 0 ? ` Skipped (incomplete build): ${r.skipped.join(', ')}.` : '')
    );
  };

  const exportAll = () => {
    // Staggered so the browser treats them as separate downloads (it may ask to allow multiple downloads)
    EXPORT_KINDS.forEach((k, i) => setTimeout(() => doExport(k.id), i * 600));
  };

  const toggleSelect = (item: BatchItemView) => {
    patchItem(item.id, { selected: !item.selected });
    save(item.id, { selected: !item.selected }).catch(() => patchItem(item.id, { selected: item.selected }));
  };

  const selectAll = (selected: boolean) => {
    if (!open) return;
    setItems(prev => prev.map(i => (i.status === 'done' ? { ...i, selected } : i)));
    setAllSelectedM.mutateAsync({ batchId: open.id, selected }).catch(() => reloadItems());
  };

  const removeItem = async (item: BatchItemView) => {
    if (!window.confirm(`Remove ${item.playerName} from this batch?`)) return;
    try {
      await removeItemM.mutateAsync({ id: item.id });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e) {
      setNotice(friendlyError(e));
    }
  };

  // ── screens ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080B14]">
        <div className="w-10 h-10 rounded-full border-4 border-t-[#4D8DFF] border-[#131A2A] animate-spin" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <Shell>
        <p className="text-sm text-[#8E9AAF] text-center mt-16">The Batch Build Generator is for the account owner.</p>
        <p className="text-center"><a href="/" className="text-[#4D8DFF] font-bold underline text-xs">Back to the builder</a></p>
      </Shell>
    );
  }

  const notReady = !serverArchetypes || !progression ? 'Loading game data…' : null;

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>Batch Builds</h1>
        <a href="/" className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] hover:text-[#F4F7FB]">← Builder</a>
      </div>

      {pageError && (
        <div className="rounded-xl border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 p-3 text-[11px] text-[#ff8a8a] leading-relaxed">{pageError}</div>
      )}

      {!open ? (
        <>
          <NewBatchForm
            name={name} setName={setName}
            text={text} setText={setText}
            facilityMode={facilityMode} setFacilityMode={setFacilityMode}
            clubLevel={clubLevel} setClubLevel={setClubLevel}
            masteriesMode={masteriesMode} setMasteriesMode={setMasteriesMode}
            buildStyle={buildStyle} setBuildStyle={setBuildStyle}
            concurrency={concurrency} setConcurrency={setConcurrency}
            keptFacilityCount={Object.keys(keptFacilities).length}
            parsed={parsed}
            busy={busy}
            notReady={notReady}
            onCreate={createBatch}
          />
          <SavedBatches
            batches={listQuery.data as any}
            loading={listQuery.isLoading}
            busy={busy}
            onOpen={id => openBatch(id)}
            onDelete={deleteSaved}
          />
        </>
      ) : (
        <BatchView
          name={open.name}
          settings={open.settings}
          items={items}
          running={running}
          summary={summary}
          notice={notice}
          expandedId={expandedId} setExpandedId={setExpandedId}
          addOpen={addOpen} setAddOpen={setAddOpen}
          addText={addText} setAddText={setAddText}
          onAddPlayers={addPlayers}
          onStart={() => runItems(items.filter(i => i.status === 'queued'), open.settings, false)}
          onStop={() => { stopRef.current = true; }}
          onRetryFailed={() => runItems(items.filter(i => i.status === 'failed'), open.settings, false)}
          onSelectAll={selectAll}
          onRetry={item => runItems([item], open.settings, false)}
          onRegenerate={item => runItems([item], open.settings, true)}
          onRemove={removeItem}
          onToggleSelect={toggleSelect}
          onClose={closeBatch}
          onDeleteBatch={deleteOpen}
          socialBusy={socialBusy}
          missingCopy={missingCopy}
          onWriteMissingCopy={writeMissingCopy}
          onSaveSocial={saveSocial}
          onRegenerateSocial={regenerateCopy}
          exportInfo={exportInfo}
          exportNotice={exportNotice}
          onExport={doExport}
          onExportAll={exportAll}
        />
      )}
    </Shell>
  );
}
