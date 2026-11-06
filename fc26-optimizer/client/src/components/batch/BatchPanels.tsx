import React from 'react';
import type { ItemStatus } from '@/utils/batchRunner';

// ───────────────────────── shared bits ─────────────────────────

export interface BatchItemView {
  id: number;
  position: number;
  playerName: string;
  note: string | null;
  status: ItemStatus;
  error: string | null;
  blueprint: any;
  build: any;
  selected: boolean;
}

export interface BatchSettingsView {
  level: number;
  facilityMode: 'ai' | 'keep';
  clubLevel: number;
  keptFacilities: Record<string, number>;
  masteriesMode: 'all' | 'profile';
  buildStyle: 'balanced' | 'authentic';
  concurrency: number;
}

const STATUS_STYLE: Record<ItemStatus, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-[#26334A] text-[#8E9AAF]' },
  running: { label: 'Building…', cls: 'bg-[#4D8DFF]/20 text-[#4D8DFF]' },
  done: { label: 'Done', cls: 'bg-[#21E6A4]/15 text-[#21E6A4]' },
  failed: { label: 'Failed', cls: 'bg-[#ff4d4d]/15 text-[#ff8a8a]' },
};

export const StatusChip: React.FC<{ status: ItemStatus }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${STATUS_STYLE[status].cls}`}>
    {STATUS_STYLE[status].label}
  </span>
);

function Seg<T extends string | number>({
  value, options, onChange, disabled,
}: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          disabled={disabled}
          className={`py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
            value === o.id
              ? 'bg-[#4D8DFF]/15 border-[#4D8DFF] text-[#4D8DFF]'
              : 'bg-[#131A2A] border-[#26334A] text-[#8E9AAF] hover:text-[#F4F7FB]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest mb-1.5">{children}</div>
);

// ───────────────────────── new batch ─────────────────────────

export interface NewBatchFormProps {
  name: string; setName: (v: string) => void;
  text: string; setText: (v: string) => void;
  facilityMode: 'ai' | 'keep'; setFacilityMode: (v: 'ai' | 'keep') => void;
  clubLevel: number; setClubLevel: (v: number) => void;
  masteriesMode: 'all' | 'profile'; setMasteriesMode: (v: 'all' | 'profile') => void;
  buildStyle: 'balanced' | 'authentic'; setBuildStyle: (v: 'balanced' | 'authentic') => void;
  concurrency: number; setConcurrency: (v: number) => void;
  keptFacilityCount: number;
  parsed: { items: { playerName: string; note?: string }[]; duplicates: number; overLimit: number };
  busy: boolean;
  notReady?: string | null;
  onCreate: () => void;
}

export const NewBatchForm: React.FC<NewBatchFormProps> = p => {
  const n = p.parsed.items.length;
  return (
    <div className="rounded-2xl border border-[#26334A] bg-[#0D1220] p-4 space-y-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#facc15]">New batch</div>

      <div>
        <Label>Batch name</Label>
        <input
          value={p.name}
          onChange={e => p.setName(e.target.value)}
          placeholder="e.g. Midfield legends"
          maxLength={80}
          className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#F4F7FB] outline-none focus:border-[#4D8DFF]"
        />
      </div>

      <div>
        <Label>Players (one per line)</Label>
        <textarea
          value={p.text}
          onChange={e => p.setText(e.target.value)}
          placeholder={'Sergio Busquets | 2011 Barcelona\nPaul Scholes\nXavi'}
          className="w-full h-40 bg-[#131A2A] border border-[#26334A] rounded-xl p-3 text-xs text-[#F4F7FB] outline-none focus:border-[#4D8DFF] resize-none"
        />
        <p className="mt-1.5 text-[10px] text-[#8E9AAF] leading-relaxed">
          Add a note after | for an era or role. Every build is level 55.{' '}
          <span className={n > 0 ? 'text-[#21E6A4] font-bold' : ''}>{n} player{n === 1 ? '' : 's'}</span>
          {p.parsed.duplicates > 0 && ` · ${p.parsed.duplicates} repeated name${p.parsed.duplicates === 1 ? '' : 's'} ignored`}
          {p.parsed.overLimit > 0 && <span className="text-[#ff8a8a]"> · {p.parsed.overLimit} over the 100 limit, not included</span>}
        </p>
      </div>

      <div>
        <Label>Facilities</Label>
        <Seg value={p.facilityMode} onChange={p.setFacilityMode} options={[{ id: 'ai', label: '✨ Let AI choose' }, { id: 'keep', label: 'My profile' }]} />
        <p className="mt-1.5 text-[10px] text-[#8E9AAF] leading-relaxed">
          {p.facilityMode === 'ai'
            ? 'Each build picks its own best facilities within the Club level budget.'
            : p.keptFacilityCount > 0
              ? `Every build uses the ${p.keptFacilityCount} facilit${p.keptFacilityCount === 1 ? 'y' : 'ies'} saved in My Profile.`
              : 'Nothing is saved in My Profile, so no facilities will be used.'}
        </p>
      </div>

      {p.facilityMode === 'ai' && (
        <div>
          <Label>Club level (facility budget)</Label>
          <select
            value={p.clubLevel}
            onChange={e => p.setClubLevel(Number(e.target.value))}
            className="w-full bg-[#131A2A] border border-[#26334A] rounded-lg p-2.5 text-xs text-[#F4F7FB] font-bold outline-none"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(l => <option key={l} value={l}>Club level {l}</option>)}
          </select>
        </div>
      )}

      <div>
        <Label>Masteries</Label>
        <Seg value={p.masteriesMode} onChange={p.setMasteriesMode} options={[{ id: 'all', label: 'All unlocked' }, { id: 'profile', label: 'My profile' }]} />
      </div>

      <div>
        <Label>Build style</Label>
        <Seg value={p.buildStyle} onChange={p.setBuildStyle} options={[{ id: 'balanced', label: 'Balanced' }, { id: 'authentic', label: 'Authentic' }]} />
      </div>

      <div>
        <Label>Speed (builds at once)</Label>
        <Seg value={p.concurrency} onChange={p.setConcurrency} options={[{ id: 1, label: '1 · gentle' }, { id: 2, label: '2' }, { id: 3, label: '3 · fast' }]} />
      </div>

      <button
        onClick={p.onCreate}
        disabled={p.busy || n === 0 || !!p.notReady}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#21E6A4] to-[#10b981] text-[#080B14] font-black uppercase tracking-widest text-xs disabled:opacity-40"
      >
        {p.busy ? 'Starting…' : `Create & start (${n})`}
      </button>
      {p.notReady && <p className="text-[10px] text-[#8E9AAF] text-center">{p.notReady}</p>}
    </div>
  );
};

// ───────────────────────── saved batches ─────────────────────────

export interface SavedBatchRow {
  id: number; name: string; updatedAt: string; total: number; done: number; failed: number; selected: number;
}

export const SavedBatches: React.FC<{
  batches: SavedBatchRow[] | undefined;
  loading: boolean;
  busy: boolean;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}> = ({ batches, loading, busy, onOpen, onDelete }) => (
  <div className="rounded-2xl border border-[#26334A] bg-[#0D1220] p-4">
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8E9AAF] mb-3">Saved batches</div>
    {loading && <p className="text-[11px] text-[#8E9AAF]">Loading…</p>}
    {!loading && (!batches || batches.length === 0) && <p className="text-[11px] text-[#8E9AAF]">No batches yet. Create your first one above.</p>}
    <div className="space-y-2">
      {(batches ?? []).map(b => (
        <div key={b.id} className="flex items-center gap-2 rounded-xl border border-[#26334A] bg-[#131A2A] p-3">
          <button onClick={() => onOpen(b.id)} disabled={busy} className="flex-1 text-left min-w-0">
            <div className="text-xs font-black text-[#F4F7FB] truncate">{b.name}</div>
            <div className="text-[10px] text-[#8E9AAF] mt-0.5">
              {b.done}/{b.total} built
              {b.failed > 0 && <span className="text-[#ff8a8a]"> · {b.failed} failed</span>}
              {b.selected > 0 && <span> · {b.selected} selected</span>}
              {' · '}
              {new Date(b.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
          </button>
          <button onClick={() => onDelete(b.id)} disabled={busy} aria-label={`Delete ${b.name}`} className="text-[#59657A] hover:text-[#ff8a8a] px-2 text-sm">✕</button>
        </div>
      ))}
    </div>
  </div>
);

// ───────────────────────── one open batch ─────────────────────────

const fmt = (n: unknown) => (typeof n === 'number' ? String(n) : '–');

const ItemRow: React.FC<{
  item: BatchItemView;
  expanded: boolean;
  locked: boolean;
  onExpand: () => void;
  onRetry: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  onToggleSelect: () => void;
}> = ({ item, expanded, locked, onExpand, onRetry, onRegenerate, onRemove, onToggleSelect }) => {
  const b = item.build;
  const v = b?.view;
  const f = v?.faceStats;
  const slots: string[] = (b?.snapshot?.equippedPlaystyles ?? []).filter(Boolean);
  const spec: string | null = b?.snapshot?.equippedSpecialization ?? null;

  return (
    <div className="rounded-xl border border-[#26334A] bg-[#131A2A] p-3">
      <div className="flex items-start gap-2">
        {item.status === 'done' && (
          <input type="checkbox" checked={item.selected} onChange={onToggleSelect} aria-label={`Select ${item.playerName}`} className="mt-1 w-4 h-4 accent-[#21E6A4]" />
        )}
        <button onClick={onExpand} disabled={item.status !== 'done'} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-[#F4F7FB] truncate">{item.playerName}</span>
            <StatusChip status={item.status} />
          </div>
          {item.note && <div className="text-[10px] text-[#8E9AAF] mt-0.5 truncate">{item.note}</div>}
          {item.status === 'done' && b && (
            <div className="mt-1.5 space-y-0.5">
              <div className="text-[11px] text-[#F4F7FB] font-bold">
                {b.archetype} · {v?.primaryPosition ?? '–'} · <span className="text-[#facc15]">{fmt(v?.ovr)} OVR</span>
                <span className="text-[#8E9AAF] font-medium"> · {b.snapshot?.height}cm / {b.snapshot?.weight}kg</span>
              </div>
              {f && (
                <div className="text-[10px] text-[#8E9AAF]">
                  PAC {f.pac} · SHO {f.sho} · PAS {f.pas} · DRI {f.dri} · DEF {f.def} · PHY {f.phy}
                </div>
              )}
              <div className="text-[10px] text-[#8E9AAF] truncate">
                {spec ? `${spec} · ` : ''}{slots.length > 0 ? slots.join(', ') : 'No standard PlayStyles'}
              </div>
            </div>
          )}
          {item.status === 'failed' && item.error && <div className="mt-1 text-[10px] text-[#ff8a8a] leading-snug">{item.error}</div>}
        </button>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {item.status === 'failed' && (
            <button onClick={onRetry} disabled={locked} className="text-[10px] font-black uppercase tracking-widest text-[#4D8DFF] disabled:opacity-40">Retry</button>
          )}
          {(item.status === 'done' || item.status === 'failed') && (
            <button onClick={onRegenerate} disabled={locked} className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] hover:text-[#F4F7FB] disabled:opacity-40">Regenerate</button>
          )}
          {item.status !== 'running' && (
            <button onClick={onRemove} disabled={locked} aria-label={`Remove ${item.playerName}`} className="text-[10px] text-[#59657A] hover:text-[#ff8a8a] disabled:opacity-40">Remove</button>
          )}
        </div>
      </div>

      {expanded && item.status === 'done' && b && (
        <div className="mt-3 pt-3 border-t border-[#26334A] space-y-2 text-[10px] leading-relaxed text-[#8E9AAF]">
          {item.blueprint?.scoutSummary && <p className="italic border-l-2 border-[#4D8DFF] pl-2">{item.blueprint.scoutSummary}</p>}
          <p><span className="text-[#F4F7FB] font-bold">Signatures:</span> {(b.signatures ?? []).join(', ') || '–'}</p>
          <p><span className="text-[#F4F7FB] font-bold">Stars:</span> {b.snapshot?.smLevel}★ skills · {b.snapshot?.wfLevel}★ weak foot</p>
          <p><span className="text-[#F4F7FB] font-bold">Highlights:</span> {(b.highlights ?? []).map((h: any) => `${h.attribute} ${h.value}`).join(' · ') || '–'}</p>
          <p><span className="text-[#F4F7FB] font-bold">Facilities:</span> {Object.keys(b.snapshot?.equippedFacilities ?? {}).length > 0
            ? Object.entries(b.snapshot.equippedFacilities as Record<string, number>).map(([n, t]) => `${n} T${t}`).join(', ')
            : 'none'}</p>
          {b.floorReport && b.floorReport.length > 0 && (
            <p><span className="text-[#F4F7FB] font-bold">Playability floors:</span> {b.floorReport.map((r: any) => `${r.attribute} ${r.before}→${r.after}`).join(', ')}</p>
          )}
          {(b.notes ?? []).length > 0 && <p className="text-[#facc15]">{(b.notes as string[]).join(' ')}</p>}
        </div>
      )}
    </div>
  );
};

export interface BatchViewProps {
  name: string;
  settings: BatchSettingsView;
  items: BatchItemView[];
  running: boolean;
  summary: { total: number; done: number; failed: number; running: number; queued: number; selected: number };
  notice: string | null;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  addOpen: boolean; setAddOpen: (v: boolean) => void;
  addText: string; setAddText: (v: string) => void;
  onAddPlayers: () => void;
  onStart: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  onSelectAll: (selected: boolean) => void;
  onRetry: (item: BatchItemView) => void;
  onRegenerate: (item: BatchItemView) => void;
  onRemove: (item: BatchItemView) => void;
  onToggleSelect: (item: BatchItemView) => void;
  onClose: () => void;
  onDeleteBatch: () => void;
}

export const BatchView: React.FC<BatchViewProps> = p => {
  const s = p.summary;
  const finished = s.done + s.failed;
  const pct = s.total > 0 ? Math.round((finished / s.total) * 100) : 0;
  const settingsLine = [
    'Level 55',
    p.settings.facilityMode === 'ai' ? `AI facilities (club ${p.settings.clubLevel})` : 'profile facilities',
    p.settings.masteriesMode === 'all' ? 'all masteries' : 'profile masteries',
    p.settings.buildStyle,
    `${p.settings.concurrency} at once`,
  ].join(' · ');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#26334A] bg-[#0D1220] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-black text-[#F4F7FB] truncate">{p.name}</div>
            <div className="text-[10px] text-[#8E9AAF] mt-0.5 leading-relaxed">{settingsLine}</div>
          </div>
          <button onClick={p.onClose} disabled={p.running} className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] hover:text-[#F4F7FB] disabled:opacity-40 shrink-0">← Batches</button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF] mb-1.5">
            <span>{finished} of {s.total} finished</span>
            <span>{s.done} done{s.failed > 0 && <span className="text-[#ff8a8a]"> · {s.failed} failed</span>}{s.running > 0 && ` · ${s.running} building`}</span>
          </div>
          <div className="h-2 bg-[#080B14] rounded-full overflow-hidden border border-[#26334A]">
            <div className="h-full bg-gradient-to-r from-[#4D8DFF] to-[#21E6A4] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {p.notice && <p className="mt-3 text-[10px] text-[#facc15] leading-relaxed">{p.notice}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {!p.running ? (
            <button onClick={p.onStart} disabled={s.queued === 0} className="py-2.5 rounded-lg bg-[#21E6A4] text-[#080B14] text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
              {s.done + s.failed > 0 ? `Resume (${s.queued})` : `Start (${s.queued})`}
            </button>
          ) : (
            <button onClick={p.onStop} className="py-2.5 rounded-lg bg-[#ff4d4d] text-white text-[10px] font-black uppercase tracking-widest">Stop after current</button>
          )}
          <button onClick={p.onRetryFailed} disabled={p.running || s.failed === 0} className="py-2.5 rounded-lg border border-[#26334A] bg-[#131A2A] text-[#F4F7FB] text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
            Retry failed ({s.failed})
          </button>
        </div>
        {p.running && <p className="mt-2 text-[10px] text-[#8E9AAF]">Keep this page open while it builds. Finished players are saved as they complete.</p>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#8E9AAF]">{s.selected} of {s.done} selected</div>
        <div className="flex items-center gap-3">
          <button onClick={() => p.onSelectAll(true)} disabled={s.done === 0} className="text-[10px] font-black uppercase tracking-widest text-[#4D8DFF] disabled:opacity-30">All</button>
          <button onClick={() => p.onSelectAll(false)} disabled={s.done === 0} className="text-[10px] font-black uppercase tracking-widest text-[#8E9AAF] disabled:opacity-30">None</button>
        </div>
      </div>

      <div className="space-y-2">
        {p.items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            expanded={p.expandedId === item.id}
            locked={p.running}
            onExpand={() => p.setExpandedId(p.expandedId === item.id ? null : item.id)}
            onRetry={() => p.onRetry(item)}
            onRegenerate={() => p.onRegenerate(item)}
            onRemove={() => p.onRemove(item)}
            onToggleSelect={() => p.onToggleSelect(item)}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-[#26334A] bg-[#0D1220] p-4">
        <button onClick={() => p.setAddOpen(!p.addOpen)} disabled={p.running} className="text-[10px] font-black uppercase tracking-widest text-[#4D8DFF] disabled:opacity-40">
          {p.addOpen ? '− Hide' : '+ Add more players'}
        </button>
        {p.addOpen && (
          <div className="mt-3 space-y-2">
            <textarea
              value={p.addText}
              onChange={e => p.setAddText(e.target.value)}
              placeholder={'One player per line\nName | optional note'}
              className="w-full h-28 bg-[#131A2A] border border-[#26334A] rounded-xl p-3 text-xs text-[#F4F7FB] outline-none focus:border-[#4D8DFF] resize-none"
            />
            <button onClick={p.onAddPlayers} disabled={p.running || !p.addText.trim()} className="w-full py-2.5 rounded-lg bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
              Add to batch
            </button>
          </div>
        )}
      </div>

      <div className="text-center">
        <button onClick={p.onDeleteBatch} disabled={p.running} className="text-[10px] font-bold uppercase tracking-widest text-[#59657A] hover:text-[#ff8a8a] disabled:opacity-40">Delete this batch</button>
        <p className="mt-2 text-[10px] text-[#59657A]">Social copy, the editor and the Canva export come in the next steps.</p>
      </div>
    </div>
  );
};
