import { STAT_GROUPS } from '@/constants/builderData';

/**
 * Renders the current build to a 1080x1350 PNG (4:5 portrait, ideal for
 * Instagram / X / Facebook) using a plain canvas. No extra dependencies.
 * All images are same-origin (/cards, /icons, /archetypes), so the canvas is never tainted.
 */

export interface ShareBuildData {
  archetype: string;
  level: number;
  height: number;
  weight: number;
  smLevel: number;
  wfLevel: number;
  position: string;
  ovr: number;
  positionRatings: { pos: string; ovr: number }[];
  faceStats: { pac: number; sho: number; pas: number; dri: number; def: number; phy: number };
  stats: Record<string, number>;
  playstylePlus: string[];
  playstyles: string[];
  facilityPlaystyles: string[];
  specialization: string | null;
  apSpent: number;
  apTotal: number;
}

// ---------- constants ----------
const W = 1080;
const H = 1350;
const PAD = 60;

const C = {
  bg: '#080B14',
  panel: '#131A2A',
  panelAlt: '#192235',
  border: '#26334A',
  text: '#F4F7FB',
  muted: '#8E9AAF',
  green: '#21E6A4',
  blue: '#4D8DFF',
  gold: '#facc15',
};

const HEAD = `'Rajdhani', 'Inter', system-ui, sans-serif`;
const BODY = `'Inter', system-ui, -apple-system, sans-serif`;
const NUM = `'Montserrat', 'Inter', system-ui, sans-serif`;

const tierColor = (v: number) =>
  v >= 90 ? '#21E6A4' : v >= 80 ? '#4ade80' : v >= 70 ? '#facc15' : v >= 60 ? '#fb923c' : '#f87171';

// ---------- helpers ----------
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

async function ensureFonts() {
  try {
    if (!('fonts' in document)) return;
    await Promise.all([
      document.fonts.load(`700 40px 'Rajdhani'`),
      document.fonts.load(`600 20px 'Inter'`),
      document.fonts.load(`800 40px 'Montserrat'`),
    ]);
  } catch (_e) {
    /* fall back to system fonts */
  }
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  family: string,
  maxSize: number,
  minSize: number,
  maxWidth: number
) {
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawContain(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = C.gold;
    ctx.fill();
  } else {
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawStarRow(ctx: CanvasRenderingContext2D, label: string, value: number, x: number, y: number) {
  ctx.font = `600 17px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  const lw = ctx.measureText(label).width + 14;
  for (let i = 0; i < 5; i++) drawStar(ctx, x + lw + 11 + i * 26, y, 11, i < value);
}

function drawFaceStats(ctx: CanvasRenderingContext2D, f: ShareBuildData['faceStats'], x: number, y: number, totalW: number) {
  const items: [string, number][] = [
    ['PAC', f.pac], ['SHO', f.sho], ['PAS', f.pas], ['DRI', f.dri], ['DEF', f.def], ['PHY', f.phy],
  ];
  const gap = 10;
  const bw = (totalW - gap * 5) / 6;
  items.forEach(([label, val], i) => {
    const bx = x + i * (bw + gap);
    rrect(ctx, bx, y, bw, 78, 12);
    ctx.fillStyle = C.panelAlt;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 15px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(label, bx + bw / 2, y + 22);
    ctx.font = `800 32px ${NUM}`;
    ctx.fillStyle = tierColor(val);
    ctx.fillText(String(val), bx + bw / 2, y + 54);
  });
  return y + 78;
}

function drawChips(
  ctx: CanvasRenderingContext2D,
  chips: { pos: string; ovr: number }[],
  x: number,
  y: number,
  maxW: number
) {
  const h = 38;
  const gap = 10;
  let cx = x;
  let cy = y;
  let rows = 1;
  for (const chip of chips) {
    ctx.font = `700 19px ${BODY}`;
    const posW = ctx.measureText(chip.pos).width;
    ctx.font = `800 19px ${NUM}`;
    const valW = ctx.measureText(String(chip.ovr)).width;
    const w = 16 + posW + 10 + valW + 16;
    if (cx + w > x + maxW) {
      rows++;
      if (rows > 2) break;
      cx = x;
      cy += h + gap;
    }
    rrect(ctx, cx, cy, w, h, 8);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 19px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(chip.pos, cx + 16, cy + h / 2 + 1);
    ctx.font = `800 19px ${NUM}`;
    ctx.fillStyle = tierColor(chip.ovr);
    ctx.fillText(String(chip.ovr), cx + 16 + posW + 10, cy + h / 2 + 1);
    cx += w + gap;
  }
  return cy + h;
}

type PillKind = 'plus' | 'spec' | 'style' | 'facility';

const PILL_STYLES: Record<PillKind, { fill: string; stroke: string; text: string }> = {
  plus: { fill: 'rgba(250,204,21,0.12)', stroke: C.gold, text: C.gold },
  spec: { fill: 'rgba(33,230,164,0.12)', stroke: C.green, text: C.green },
  style: { fill: 'rgba(77,141,255,0.14)', stroke: C.blue, text: '#cfe0ff' },
  facility: { fill: 'rgba(142,154,175,0.12)', stroke: C.muted, text: '#d5dcea' },
};

function drawPills(
  ctx: CanvasRenderingContext2D,
  pills: { text: string; kind: PillKind }[],
  x: number,
  y: number,
  maxW: number
) {
  const h = 36;
  const gap = 10;
  let cx = x;
  let cy = y;
  let rows = 1;
  const styles = PILL_STYLES;
  for (const p of pills) {
    ctx.font = `600 18px ${BODY}`;
    const w = ctx.measureText(p.text).width + 32;
    if (cx + w > x + maxW) {
      rows++;
      if (rows > 2) break;
      cx = x;
      cy += h + gap;
    }
    const s = styles[p.kind];
    rrect(ctx, cx, cy, w, h, 18);
    ctx.fillStyle = s.fill;
    ctx.fill();
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = s.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, cx + 16, cy + h / 2 + 1);
    cx += w + gap;
  }
  return cy + h;
}

function drawStatPanels(ctx: CanvasRenderingContext2D, d: ShareBuildData, top: number) {
  const groups: { key: string; face: keyof ShareBuildData['faceStats'] }[] = [
    { key: 'Pace', face: 'pac' },
    { key: 'Shooting', face: 'sho' },
    { key: 'Passing', face: 'pas' },
    { key: 'Dribbling', face: 'dri' },
    { key: 'Defending', face: 'def' },
    { key: 'Physical', face: 'phy' },
  ];
  const gap = 18;
  const pw = (W - PAD * 2 - gap * 2) / 3;
  const ph = 268;
  const table = STAT_GROUPS as unknown as Record<string, string[]>;

  groups.forEach((g, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = PAD + col * (pw + gap);
    const y = top + row * (ph + gap);

    rrect(ctx, x, y, pw, ph, 18);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${HEAD}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(g.key.toUpperCase(), x + 20, y + 30);
    const avg = d.faceStats[g.face];
    ctx.textAlign = 'right';
    ctx.font = `800 26px ${NUM}`;
    ctx.fillStyle = tierColor(avg);
    ctx.fillText(String(avg), x + pw - 20, y + 30);

    const names = table[g.key] || [];
    names.forEach((name, r) => {
      const ry = y + 62 + r * 34;
      const v = Math.round(d.stats[name] ?? 0);
      ctx.textAlign = 'left';
      ctx.font = `600 18px ${BODY}`;
      ctx.fillStyle = '#C5CEDD';
      ctx.fillText(name, x + 20, ry);
      ctx.textAlign = 'right';
      ctx.font = `800 20px ${NUM}`;
      ctx.fillStyle = tierColor(v);
      ctx.fillText(String(v), x + pw - 20, ry);
      // bar
      const bx = x + 20;
      const bw = pw - 40;
      rrect(ctx, bx, ry + 13, bw, 4, 2);
      ctx.fillStyle = C.border;
      ctx.fill();
      rrect(ctx, bx, ry + 13, Math.max(4, (Math.min(v, 99) / 99) * bw), 4, 2);
      ctx.fillStyle = tierColor(v);
      ctx.fill();
    });
  });
}

// ---------- main render ----------
export async function renderBuildImage(d: ShareBuildData): Promise<Blob> {
  await ensureFonts();

  const logoImg = await loadImage('/clubs-dna-logo.png');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported on this device');

  // Background + glow behind the card
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const cardW = 360;
  const cardH = Math.round((cardW * 135) / 96);
  const cardX = PAD;
  const cardY = 150;

  const glow = ctx.createRadialGradient(cardX + cardW / 2, cardY + cardH / 2, 40, cardX + cardW / 2, cardY + cardH / 2, 620);
  glow.addColorStop(0, 'rgba(77,141,255,0.20)');
  glow.addColorStop(1, 'rgba(77,141,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header logo
  if (logoImg) {
    const box = { w: 320, h: 80 };
    drawContain(ctx, logoImg, (W - box.w) / 2, 36, box.w, box.h);
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 48px ${HEAD}`;
    ctx.fillStyle = C.text;
    ctx.fillText('CLUBSDNA', W / 2, 76);
  }

  // ----- Blank card area -----
  // The card artwork is intentionally NOT drawn: this area (cardX, cardY, cardW x cardH)
  // is left empty so a real player image can be dropped in afterwards.

  // Playstyles shown in the right column
  const pills: { text: string; kind: PillKind }[] = [
    ...d.playstylePlus.map((t) => ({ text: `${t}+`.replace('++', '+'), kind: 'plus' as PillKind })),
    ...(d.specialization ? [{ text: d.specialization, kind: 'spec' as PillKind }] : []),
    ...d.playstyles.map((t) => ({ text: t, kind: 'style' as PillKind })),
    ...d.facilityPlaystyles.map((t) => ({ text: t, kind: 'facility' as PillKind })),
  ];

  // ----- Right column -----
  const rx = cardX + cardW + 44;
  const rw = W - PAD - rx;
  let cy = cardY;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text;
  fitFont(ctx, d.archetype || 'Your Pro', 700, HEAD, 68, 36, rw);
  ctx.fillText(d.archetype || 'Your Pro', rx, cy + 56);
  cy += 76;

  ctx.font = `600 24px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(`Level ${d.level}  •  ${d.height}cm  •  ${d.weight}kg`, rx, cy + 20);
  cy += 46;

  drawStarRow(ctx, 'Skill moves', d.smLevel, rx, cy + 12);
  drawStarRow(ctx, 'Weak foot', d.wfLevel, rx + 285, cy + 12);
  cy += 46;

  cy = drawFaceStats(ctx, d.faceStats, rx, cy, rw) + 22;

  cy = drawChips(ctx, d.positionRatings, rx, cy, rw) + 22;

  if (pills.length > 0) drawPills(ctx, pills, rx, cy, rw);

  // ----- Stat panels -----
  drawStatPanels(ctx, d, 690);

  // ----- Footer -----
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
  ctx.fillText(`${d.apSpent.toLocaleString()} / ${d.apTotal.toLocaleString()} AP spent`, PAD, 1308);
  ctx.textAlign = 'right';
  ctx.font = `700 32px ${HEAD}`;
  ctx.fillStyle = C.green;
  ctx.fillText('Built with ClubsDNA', W - PAD, 1308);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png');
  });
}

// ---------- share / download ----------
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Phones/tablets: opens the native share sheet (Instagram, X, WhatsApp, Save Image...).
 * Desktop or unsupported browsers: downloads the PNG.
 */
export async function shareBuildImage(d: ShareBuildData): Promise<void> {
  const blob = await renderBuildImage(d);
  const filename = `${d.archetype || 'build'}-lvl${d.level}.png`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  if (isTouch && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `My ${d.archetype} build`,
        text: `My ${d.archetype} build (Level ${d.level}) made with ClubsDNA`,
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // user closed the share sheet
      // anything else: fall through to a normal download
    }
  }

  downloadBlob(blob, filename);
}
