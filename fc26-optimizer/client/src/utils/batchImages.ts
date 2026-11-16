/**
 * The three 4:5 (1080x1350) images made for every finished batch player, drawn in the browser:
 *   card        the player card (the build screen's Share image, with the player's name; photo area left empty)
 *   facilities  the equipped facilities, their tiers, boosts and free PlayStyles
 *   scout       the scout report, the standout attributes and the PlayStyles
 * Plus a small ZIP writer (no packages) so every image can be saved in one file.
 */
import { CLUB_BUDGETS } from '@/constants/builderData';
import { FACILITIES } from '@/constants/playstylesData';
import { facilityBoosts } from '@/utils/aiBuildPipeline';
import { factsFromItem, trimToSentence, type BuildFacts } from '@/utils/socialCopy';
import {
  renderBuildImage, ensureFonts, loadImage, rrect, fitFont, ellipsize, drawContain, drawPills,
  W, H, PAD, C, HEAD, BODY, NUM, tierColor, type ShareBuildData, type PillKind,
} from '@/utils/buildShareImage';

export interface ImageSourceItem {
  playerName: string;
  note?: string | null;
  blueprint?: any;
  build?: any;
  social?: any;
}

/** What the three images are drawn from */
export interface ImageSource {
  facts: BuildFacts;
  share: ShareBuildData;
  equippedFacilities: Record<string, number>;
  clubLevel: number;
  apSaved: number | null;
  highlights: { attribute: string; value: number }[];
  scoutReport: string;
}

const plain = (x: string) => String(x).replace(/\+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

/** The same PlayStyle never shows twice: Signatures win, then regular slots, then free facility PlayStyles */
function dedupeStyles(signatures: string[], regular: string[], facility: string[]) {
  const seen = new Set<string>();
  const keep = (list: string[]) => list.filter(n => { const k = plain(n); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const playstylePlus = keep(signatures);
  const playstyles = keep(regular);
  const facilityPlaystyles = keep(facility);
  return { playstylePlus, playstyles, facilityPlaystyles };
}

export function imageSourceFor(item: ImageSourceItem): ImageSource | null {
  const facts = factsFromItem(item);
  if (!facts) return null;
  const b = item.build;
  const snap = b.snapshot;
  const v = b.view;
  const equipped: Record<string, number> = snap.equippedFacilities ?? {};

  const social = item.social;
  const highlights: { attribute: string; value: number }[] = (social?.highlights?.length ? social.highlights : facts.highlights).slice(0, 3);
  const report: string =
    (typeof social?.scoutReport === 'string' && social.scoutReport.trim()) ||
    facts.scoutSummary ||
    (typeof social?.description === 'string' ? social.description : '');

  return {
    facts,
    share: {
      playerName: facts.playerName,
      archetype: facts.archetype,
      level: typeof snap.level === 'number' ? snap.level : 55,
      height: snap.height,
      weight: snap.weight,
      smLevel: snap.smLevel,
      wfLevel: snap.wfLevel,
      position: facts.position,
      ovr: v.ovr,
      positionRatings: Array.isArray(v.positionRatings) ? v.positionRatings : [],
      faceStats: v.faceStats,
      stats: v.boostedStats ?? {},
      ...dedupeStyles((b.signatures ?? []).map(String), (snap.equippedPlaystyles ?? []).filter(Boolean).map(String),
        Object.entries(equipped).filter(([, tier]) => tier === 3).map(([name]) => FACILITIES[name]?.playstyle).filter(Boolean) as string[]),
      specialization: snap.equippedSpecialization ?? null,
      apSpent: typeof v.spentAp === 'number' ? v.spentAp : 0,
      apTotal: (typeof b.availableAp === 'number' ? b.availableAp : 0) + (typeof b.starCost === 'number' ? b.starCost : 0),
    },
    equippedFacilities: equipped,
    clubLevel: typeof snap.clubLevel === 'number' ? snap.clubLevel : 10,
    apSaved: typeof b.facilityPlan?.apSaved === 'number' ? b.facilityPlan.apSaved : null,
    highlights,
    scoutReport: report,
  };
}

// ───────────────────────── shared drawing ─────────────────────────

async function newPage(): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported on this device');

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 360, 40, W / 2, 360, 760);
  glow.addColorStop(0, 'rgba(77,141,255,0.18)');
  glow.addColorStop(1, 'rgba(77,141,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const logo = await loadImage('/clubs-dna-logo.png');
  if (logo) {
    drawContain(ctx, logo, (W - 320) / 2, 36, 320, 80);
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 48px ${HEAD}`;
    ctx.fillStyle = C.text;
    ctx.fillText('CLUBSDNA', W / 2, 76);
  }
  return { canvas, ctx };
}

function drawFooter(ctx: CanvasRenderingContext2D, leftText: string) {
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, 1270);
  ctx.lineTo(W - PAD, 1270);
  ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 22px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(leftText, PAD, 1308);
  ctx.textAlign = 'right';
  ctx.font = `700 32px ${HEAD}`;
  ctx.fillStyle = C.green;
  ctx.fillText('Built with ClubsDNA', W - PAD, 1308);
}

/** The player's name, with a coloured line of archetype / position / overall under it. Returns the next y. */
function drawTitleBlock(ctx: CanvasRenderingContext2D, facts: BuildFacts, heading: string, top: number): number {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text;
  fitFont(ctx, facts.playerName, 700, HEAD, 76, 34, W - PAD * 2);
  ctx.fillText(ellipsize(ctx, facts.playerName, W - PAD * 2), W / 2, top + 62);

  ctx.font = `700 30px ${HEAD}`;
  ctx.fillStyle = C.green;
  const sub = `${facts.archetype}${facts.position ? `  •  ${facts.position}` : ''}  •  ${facts.ovr} OVR`;
  ctx.fillText(ellipsize(ctx, sub, W - PAD * 2), W / 2, top + 106);

  ctx.font = `700 22px ${HEAD}`;
  ctx.fillStyle = C.gold;
  ctx.fillText(heading.toUpperCase(), W / 2, top + 150);
  return top + 176;
}

/** Wrap text to a width. Returns at most `maxLines` lines (the last one ends with … when text was cut). */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = String(text ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) { line = ''; break; }
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const consumed = lines.join(' ').split(' ').length;
  if (consumed < words.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'));

// ───────────────────────── image 1: the player card ─────────────────────────

export function renderCardImage(src: ImageSource): Promise<Blob> {
  return renderBuildImage(src.share);
}

// ───────────────────────── image 2: facilities ─────────────────────────

const TIER_STYLE: Record<number, { label: string; fill: string; stroke: string; text: string }> = {
  1: { label: 'TIER 1', fill: 'rgba(142,154,175,0.14)', stroke: C.muted, text: '#d5dcea' },
  2: { label: 'TIER 2', fill: 'rgba(77,141,255,0.16)', stroke: C.blue, text: '#cfe0ff' },
  3: { label: 'TIER 3', fill: 'rgba(250,204,21,0.14)', stroke: C.gold, text: C.gold },
};

const millions = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

export async function renderFacilitiesImage(src: ImageSource): Promise<Blob> {
  const { canvas, ctx } = await newPage();
  let y = drawTitleBlock(ctx, src.facts, 'Facilities', 140);

  const entries = Object.entries(src.equippedFacilities)
    .filter(([name, tier]) => FACILITIES[name] && tier >= 1 && tier <= 3)
    .map(([name, tier]) => ({ name, tier, def: FACILITIES[name] }))
    .sort((a, b) => b.tier - a.tier || b.def.cost[b.tier - 1] - a.def.cost[a.tier - 1] || a.name.localeCompare(b.name));

  const spent = entries.reduce((sum, e) => sum + (e.def.cost[e.tier - 1] ?? 0), 0);
  const budget = CLUB_BUDGETS[src.clubLevel] || 0;
  const totalBoost = Object.values(facilityBoosts(src.equippedFacilities)).reduce((a, b) => a + b, 0);
  const freePlaystyles = [...new Set(entries.filter(e => e.tier === 3 && e.def.playstyle).map(e => e.def.playstyle as string))];

  // summary strip
  const chips: string[] = [`${entries.length} facilit${entries.length === 1 ? 'y' : 'ies'}`, `+${totalBoost} attribute points`];
  if (entries.length > 0 && src.apSaved !== null && src.apSaved > 0) chips.push(`≈ ${src.apSaved} AP saved`);
  ctx.textBaseline = 'middle';
  ctx.font = `700 22px ${BODY}`;
  const gap = 14;
  const widths = chips.map(c => ctx.measureText(c).width + 40);
  let cx = (W - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1))) / 2;
  chips.forEach((c, i) => {
    rrect(ctx, cx, y, widths[i], 46, 23);
    ctx.fillStyle = C.panelAlt;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.fillText(c, cx + widths[i] / 2, y + 24);
    cx += widths[i] + gap;
  });
  y += 46 + 26;

  if (entries.length === 0) {
    y += Math.floor((1250 - y - 200) * 0.3);
    rrect(ctx, PAD, y, W - PAD * 2, 200, 20);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.font = `600 30px ${BODY}`;
    ctx.fillText('No facilities equipped on this build', W / 2, y + 100);
  } else {
    const cols = 2;
    const colGap = 18;
    const rowGap = 16;
    const cw = (W - PAD * 2 - colGap) / cols;
    const avail = 1250 - y;
    const minH = 142;
    const maxRows = Math.max(1, Math.floor((avail + rowGap) / (minH + rowGap)));
    const maxCards = maxRows * cols;
    const shown = entries.length > maxCards ? entries.slice(0, maxCards - 1) : entries;
    const needRows = Math.ceil((shown.length < entries.length ? shown.length + 1 : shown.length) / cols);
    // few facilities: taller cards with bigger text, and the block sits a little below the top of the free space
    const ch = Math.max(minH, Math.min(200, Math.floor((avail - (needRows - 1) * rowGap) / needRows)));
    const f = Math.min(1.3, ch / minH);
    const sz = (n: number) => Math.round(n * f);
    y += Math.max(0, Math.floor((avail - (needRows * ch + (needRows - 1) * rowGap)) * 0.25));

    shown.forEach((e, i) => {
      const x = PAD + (i % cols) * (cw + colGap);
      const yy = y + Math.floor(i / cols) * (ch + rowGap);
      const ts = TIER_STYLE[e.tier];

      rrect(ctx, x, yy, cw, ch, 18);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = e.tier === 3 ? C.gold : C.border;
      ctx.lineWidth = e.tier === 3 ? 2 : 1.5;
      ctx.stroke();

      // tier badge
      ctx.font = `800 ${sz(15)}px ${BODY}`;
      const bw = ctx.measureText(ts.label).width + 24;
      rrect(ctx, x + cw - bw - 16, yy + ch * 0.11, bw, sz(28), sz(14));
      ctx.fillStyle = ts.fill;
      ctx.fill();
      ctx.strokeStyle = ts.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = ts.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ts.label, x + cw - bw / 2 - 16, yy + ch * 0.11 + sz(28) / 2);

      // name
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.text;
      fitFont(ctx, e.name, 700, HEAD, sz(28), 18, cw - bw - 52);
      ctx.fillText(e.name, x + 20, yy + ch * 0.11 + sz(28) / 2);

      // boosts
      const boost = e.def.boosts[e.tier - 1];
      ctx.font = `700 ${sz(21)}px ${BODY}`;
      ctx.fillStyle = C.green;
      const line = e.def.stats.map(s => `+${boost} ${s}`).join('   ');
      fitFont(ctx, line, 700, BODY, sz(21), 14, cw - 40);
      ctx.fillText(line, x + 20, yy + ch * 0.535);

      // cost and free PlayStyle
      ctx.font = `600 ${sz(18)}px ${BODY}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(millions(e.def.cost[e.tier - 1] ?? 0), x + 20, yy + ch * 0.82);
      if (e.tier === 3 && e.def.playstyle) {
        const txt = `Free ${e.def.playstyle}`;
        ctx.font = `700 ${sz(17)}px ${BODY}`;
        const pw = ctx.measureText(txt).width + 26;
        rrect(ctx, x + cw - pw - 16, yy + ch * 0.82 - sz(15), pw, sz(30), sz(15));
        ctx.fillStyle = 'rgba(250,204,21,0.12)';
        ctx.fill();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = C.gold;
        ctx.textAlign = 'center';
        ctx.fillText(txt, x + cw - pw / 2 - 16, yy + ch * 0.82);
        ctx.textAlign = 'left';
      }
    });

    if (shown.length < entries.length) {
      const i = shown.length;
      const x = PAD + (i % cols) * (cw + colGap);
      const yy = y + Math.floor(i / cols) * (ch + rowGap);
      rrect(ctx, x, yy, cw, ch, 18);
      ctx.fillStyle = C.panelAlt;
      ctx.fill();
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 28px ${HEAD}`;
      ctx.fillText(`+ ${entries.length - shown.length} more`, x + cw / 2, yy + ch / 2);
    }
  }

  drawFooter(ctx, budget > 0 ? `${millions(spent)} of ${millions(budget)} Club level ${src.clubLevel} budget` : `${millions(spent)} spent`);
  void freePlaystyles;
  return toBlob(canvas);
}

// ───────────────────────── image 3: scout report ─────────────────────────

export async function renderScoutImage(src: ImageSource): Promise<Blob> {
  const { canvas, ctx } = await newPage();
  let y = drawTitleBlock(ctx, src.facts, 'AI scout report', 140);

  // report panel
  const panelX = PAD;
  const panelW = W - PAD * 2;
  const panelH = 400;
  rrect(ctx, panelX, y, panelW, panelH, 22);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 120px ${HEAD}`;
  ctx.fillStyle = 'rgba(77,141,255,0.35)';
  ctx.fillText('“', panelX + 26, y + 112);

  const text = src.scoutReport.trim() || 'No scout report was written for this player.';
  const innerW = panelW - 90;
  let size = 38;
  let lines: string[] = [];
  for (; size >= 26; size -= 2) {
    ctx.font = `500 ${size}px ${BODY}`;
    lines = wrapLines(ctx, text, innerW, 99);
    if (lines.length * (size + 14) <= panelH - 110) break;
  }
  ctx.font = `500 ${size}px ${BODY}`;
  const maxLines = Math.max(1, Math.floor((panelH - 110) / (size + 14)));
  lines = wrapLines(ctx, text, innerW, maxLines);
  ctx.fillStyle = '#DCE3F0';
  lines.forEach((l, i) => ctx.fillText(l, panelX + 45, y + 120 + i * (size + 14)));
  y += panelH + 34;

  // standout attributes
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 24px ${HEAD}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('STANDOUT ATTRIBUTES', PAD, y + 12);
  y += 40;
  src.highlights.slice(0, 3).forEach(h => {
    ctx.textAlign = 'left';
    ctx.font = `700 30px ${BODY}`;
    ctx.fillStyle = C.text;
    ctx.fillText(h.attribute, PAD, y + 18);
    ctx.textAlign = 'right';
    ctx.font = `800 36px ${NUM}`;
    ctx.fillStyle = tierColor(h.value);
    ctx.fillText(String(h.value), W - PAD, y + 18);
    rrect(ctx, PAD, y + 42, W - PAD * 2, 10, 5);
    ctx.fillStyle = C.border;
    ctx.fill();
    rrect(ctx, PAD, y + 42, Math.max(10, (Math.min(h.value, 99) / 99) * (W - PAD * 2)), 10, 5);
    ctx.fillStyle = tierColor(h.value);
    ctx.fill();
    y += 76;
  });
  y += 12;

  // PlayStyles
  ctx.textAlign = 'left';
  ctx.font = `700 24px ${HEAD}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('PLAYSTYLES', PAD, y + 8);
  y += 34;
  const pills: { text: string; kind: PillKind }[] = [
    ...src.share.playstylePlus.map(t => ({ text: `${t}+`.replace('++', '+'), kind: 'plus' as PillKind })),
    ...(src.share.specialization ? [{ text: src.share.specialization, kind: 'spec' as PillKind }] : []),
    ...src.share.playstyles.map(t => ({ text: t, kind: 'style' as PillKind })),
    ...src.share.facilityPlaystyles.map(t => ({ text: t, kind: 'facility' as PillKind })),
  ];
  if (pills.length > 0) drawPills(ctx, pills, PAD, y, W - PAD * 2);

  drawFooter(ctx, `${src.share.height}cm  •  ${src.share.weight}kg  •  Level ${src.share.level}`);
  return toBlob(canvas);
}

// ───────────────────────── files for one player ─────────────────────────

export const slug = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'player';

export interface PlayerImages {
  files: { name: string; blob: Blob }[];
}

/** The three images for one finished player, named like busquets-card.png, busquets-facilities.png, busquets-scout.png */
export async function renderPlayerImages(item: ImageSourceItem): Promise<PlayerImages | null> {
  const src = imageSourceFor(item);
  if (!src) return null;
  const base = slug(src.facts.playerName);
  return {
    files: [
      { name: `${base}-card.png`, blob: await renderCardImage(src) },
      { name: `${base}-facilities.png`, blob: await renderFacilitiesImage(src) },
      { name: `${base}-scout.png`, blob: await renderScoutImage(src) },
    ],
  };
}

// ───────────────────────── ZIP (store only: PNGs are already compressed) ─────────────────────────

let crcTable: Uint32Array | null = null;
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A standard .zip file holding the given files, uncompressed. Names are kept unique. */
export function makeZip(files: { name: string; data: Uint8Array }[], now: Date = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = ((Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  const used = new Set<string>();
  const entries = files.map(f => {
    let name = f.name.replace(/[\\/:*?"<>|]+/g, '-');
    let n = 2;
    while (used.has(name.toLowerCase())) name = f.name.replace(/(\.[^.]*)?$/, `-${n++}$1`);
    used.add(name.toLowerCase());
    return { nameBytes: enc.encode(name), data: f.data, crc: crc32(f.data), offset: 0 };
  });

  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (b: Uint8Array) => { parts.push(b); offset += b.length; };
  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const cat = (...a: Uint8Array[]) => { const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let o = 0; a.forEach(x => { out.set(x, o); o += x.length; }); return out; };

  for (const e of entries) {
    e.offset = offset;
    push(cat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(e.crc), u32(e.data.length), u32(e.data.length), u16(e.nameBytes.length), u16(0), e.nameBytes));
    push(e.data);
  }
  const centralStart = offset;
  for (const e of entries) {
    push(cat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(e.crc), u32(e.data.length), u32(e.data.length), u16(e.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset), e.nameBytes));
  }
  const centralSize = offset - centralStart;
  push(cat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralSize), u32(centralStart), u16(0)));
  return cat(...parts);
}

export async function zipPlayerFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const data = await Promise.all(files.map(async f => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
  return new Blob([makeZip(data)], { type: 'application/zip' });
}

// ───────────────────────── saving and sharing ─────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Phone: opens the share sheet with all the images (gallery, TikTok ...). Anywhere else, or if sharing is not
 * possible, the images are downloaded one by one. Returns what happened.
 */
export async function shareOrDownload(files: { name: string; blob: Blob }[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const fileObjs = files.map(f => new File([f.blob], f.name, { type: 'image/png' }));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && nav.canShare && nav.canShare({ files: fileObjs })) {
    try {
      await nav.share({ files: fileObjs, title });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  files.forEach((f, i) => setTimeout(() => downloadBlob(f.blob, f.name), i * 500));
  return 'downloaded';
}
