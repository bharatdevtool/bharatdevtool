// qr-render.js — draw a QR code matrix as a styled SVG: dot shapes, corner ("eye") styles,
// colours and gradients, a centre logo and an optional "Scan me" frame.
// Pure: returns an SVG string (no DOM), so it works in tests and for both PNG and SVG export.

/**
 * @typedef {{ size: number, isDark: (row: number, col: number) => boolean }} Matrix
 * @typedef {{
 *   dots: 'square' | 'rounded' | 'dots' | 'fluid',
 *   eyeFrame: 'square' | 'rounded' | 'circle',
 *   eyeBall: 'square' | 'rounded' | 'circle',
 *   fg: string, fg2: string, gradient: 'none' | 'linear' | 'radial',
 *   eyeColor: string, bg: string, transparent: boolean, margin: number,
 *   logo: string | null, logoSize: number, logoBg: boolean,
 *   frame: 'none' | 'card' | 'pill', frameText: string, frameColor: string
 * }} QrStyle
 */

/** @type {QrStyle} */
export const DEFAULT_STYLE = {
  dots: 'square', eyeFrame: 'square', eyeBall: 'square',
  fg: '#0f172a', fg2: '#2563eb', gradient: 'none', eyeColor: '', bg: '#ffffff', transparent: false, margin: 4,
  logo: null, logoSize: 0.22, logoBg: true,
  frame: 'none', frameText: 'SCAN ME', frameColor: '#0f172a',
};

/** Ready-made looks, shown as one-click swatches. @type {Record<string, Partial<QrStyle>>} */
export const PRESETS = {
  classic: { dots: 'square', eyeFrame: 'square', eyeBall: 'square', fg: '#0f172a', gradient: 'none', eyeColor: '' },
  rounded: { dots: 'fluid', eyeFrame: 'rounded', eyeBall: 'rounded', fg: '#0f172a', gradient: 'none', eyeColor: '' },
  dots: { dots: 'dots', eyeFrame: 'circle', eyeBall: 'circle', fg: '#1e293b', gradient: 'none', eyeColor: '' },
  ocean: { dots: 'rounded', eyeFrame: 'rounded', eyeBall: 'rounded', fg: '#1d4ed8', fg2: '#0891b2', gradient: 'linear', eyeColor: '#1e3a8a' },
  emerald: { dots: 'fluid', eyeFrame: 'rounded', eyeBall: 'circle', fg: '#047857', fg2: '#0d9488', gradient: 'linear', eyeColor: '#064e3b' },
  sunset: { dots: 'dots', eyeFrame: 'rounded', eyeBall: 'rounded', fg: '#be123c', fg2: '#ea580c', gradient: 'linear', eyeColor: '#9f1239' },
};

const f = (n) => Math.round(n * 1000) / 1000;
// Several SVGs share one page (preview + style thumbnails): each gets its own gradient id.
let gradientSeq = 0;
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rectangle path with its own radius per corner [top-left, top-right, bottom-right, bottom-left]. */
function rectPath(x, y, w, h, [tl, tr, br, bl]) {
  return (
    `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}` +
    (tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : '') +
    'Z'
  );
}
const circlePath = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

/** Top-left module of each finder pattern ("eye"). @param {number} n */
export const eyeOrigins = (n) => [[0, 0], [0, n - 7], [n - 7, 0]];

/** True for modules that belong to an eye (drawn separately). */
function inEye(r, c, n) {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

/** Logo hole in module units (odd size, centred), or null. @param {number} n @param {QrStyle} s */
export function logoArea(n, s) {
  if (!s.logo) return null;
  let size = Math.round(n * Math.min(0.3, Math.max(0.1, s.logoSize)));
  if (size % 2 === 0) size += 1;
  const start = (n - size) / 2;
  return { start, size };
}

/** Shape outline for a 7×7 eye frame (ring) or a 3×3 eye ball. */
function eyeShape(x, y, size, style) {
  if (style === 'circle') return circlePath(x + size / 2, y + size / 2, size / 2);
  const r = style === 'rounded' ? size * 0.3 : 0;
  return rectPath(x, y, size, size, [r, r, r, r]);
}

/**
 * @param {Matrix} m
 * @param {Partial<QrStyle>} options
 * @returns {{ svg: string, width: number, height: number, cleared: number }}
 *   width/height in module units (scale them when exporting).
 */
export function renderQrSvg(m, options = {}) {
  const s = { ...DEFAULT_STYLE, ...options };
  const n = m.size;
  const q = Math.max(0, s.margin);
  const W = n + 2 * q;
  const hole = logoArea(n, s);
  const inHole = (r, c) => Boolean(hole) && r >= hole.start && r < hole.start + hole.size && c >= hole.start && c < hole.start + hole.size;
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && !inEye(r, c, n) && !inHole(r, c) && m.isDark(r, c);

  // Frame geometry (module units): the code sits at (ox, oy) inside the canvas.
  const label = s.frame !== 'none' && s.frameText.trim();
  const pad = s.frame === 'card' ? 1.6 : 0;
  const labelH = label ? Math.max(5, W * 0.16) : 0;
  const ox = pad;
  const oy = pad;
  const width = W + 2 * pad;
  const height = W + 2 * pad + labelH + (s.frame === 'pill' && label ? 1.2 : 0);

  // Modules.
  let d = '';
  let cleared = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (inHole(r, c) && m.isDark(r, c)) cleared++;
      if (!dark(r, c)) continue;
      const x = ox + q + c;
      const y = oy + q + r;
      if (s.dots === 'dots') d += circlePath(x + 0.5, y + 0.5, 0.42);
      else if (s.dots === 'rounded') d += rectPath(x + 0.04, y + 0.04, 0.92, 0.92, [0.3, 0.3, 0.3, 0.3]);
      else if (s.dots === 'fluid') {
        const up = dark(r - 1, c), down = dark(r + 1, c), left = dark(r, c - 1), right = dark(r, c + 1);
        d += rectPath(x, y, 1, 1, [!up && !left ? 0.5 : 0, !up && !right ? 0.5 : 0, !down && !right ? 0.5 : 0, !down && !left ? 0.5 : 0]);
      } else {
        // Square: merge each horizontal run into one rectangle (smaller SVG).
        let len = 1;
        while (dark(r, c + len)) len++;
        d += `M${x} ${y}h${len}v1h-${len}Z`;
        c += len - 1;
      }
    }
  }

  // Eyes: ring (outer minus inner, even-odd) + ball.
  let eyes = '';
  for (const [er, ec] of eyeOrigins(n)) {
    const x = ox + q + ec;
    const y = oy + q + er;
    eyes += eyeShape(x, y, 7, s.eyeFrame) + eyeShape(x + 1, y + 1, 5, s.eyeFrame) + eyeShape(x + 2, y + 2, 3, s.eyeBall);
  }

  const useGrad = s.gradient !== 'none' && s.fg2;
  const gid = `qrFill${++gradientSeq}`;
  const fill = useGrad ? `url(#${gid})` : s.fg;
  const eyeFill = s.eyeColor || fill;
  const defs = useGrad
    ? s.gradient === 'radial'
      ? `<radialGradient id="${gid}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${escAttr(s.fg)}"/><stop offset="1" stop-color="${escAttr(s.fg2)}"/></radialGradient>`
      : `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${ox + q}" y1="${oy + q}" x2="${ox + q + n}" y2="${oy + q + n}"><stop offset="0" stop-color="${escAttr(s.fg)}"/><stop offset="1" stop-color="${escAttr(s.fg2)}"/></linearGradient>`
    : '';

  const parts = [];
  // Background / frame.
  if (s.frame === 'card' && label) {
    parts.push(`<rect width="${f(width)}" height="${f(height)}" rx="${f(W * 0.07)}" fill="${escAttr(s.frameColor)}"/>`);
    parts.push(`<rect x="${f(ox)}" y="${f(oy)}" width="${W}" height="${W}" rx="${f(W * 0.045)}" fill="${s.transparent ? '#ffffff' : escAttr(s.bg)}"/>`);
  } else if (!s.transparent) {
    parts.push(`<rect x="${f(ox)}" y="${f(oy)}" width="${W}" height="${W}" fill="${escAttr(s.bg)}"/>`);
  }
  parts.push(`<path d="${d}" fill="${fill}"/>`);
  parts.push(`<path d="${eyes}" fill="${eyeFill}" fill-rule="evenodd"/>`);

  if (hole) {
    const x = ox + q + hole.start;
    const y = oy + q + hole.start;
    if (s.logoBg) parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${hole.size}" height="${hole.size}" rx="${f(hole.size * 0.18)}" fill="${s.transparent ? '#ffffff' : escAttr(s.bg)}"/>`);
    const inset = hole.size * 0.1;
    parts.push(`<image href="${escAttr(s.logo)}" x="${f(x + inset)}" y="${f(y + inset)}" width="${f(hole.size - 2 * inset)}" height="${f(hole.size - 2 * inset)}" preserveAspectRatio="xMidYMid meet"/>`);
  }

  if (label) {
    const fontSize = labelH * 0.46;
    const ty = oy + W + pad * 0.4 + labelH / 2;
    if (s.frame === 'pill') {
      const pw = Math.min(W * 0.86, Math.max(W * 0.45, s.frameText.length * fontSize * 0.68 + labelH));
      parts.push(`<rect x="${f((width - pw) / 2)}" y="${f(oy + W + 1.2)}" width="${f(pw)}" height="${f(labelH)}" rx="${f(labelH / 2)}" fill="${escAttr(s.frameColor)}"/>`);
      parts.push(`<text x="${f(width / 2)}" y="${f(oy + W + 1.2 + labelH / 2)}" fill="#ffffff" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="700" font-size="${f(fontSize)}" letter-spacing="${f(fontSize * 0.08)}" text-anchor="middle" dominant-baseline="central">${escText(s.frameText.trim())}</text>`);
    } else {
      parts.push(`<text x="${f(width / 2)}" y="${f(ty)}" fill="#ffffff" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="700" font-size="${f(fontSize)}" letter-spacing="${f(fontSize * 0.08)}" text-anchor="middle" dominant-baseline="central">${escText(s.frameText.trim())}</text>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}" shape-rendering="geometricPrecision">${defs ? `<defs>${defs}</defs>` : ''}${parts.join('')}</svg>`;
  return { svg, width, height, cleared };
}

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a, b) {
  const lum = (hex) => {
    const v = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!v) return 1;
    const n = parseInt(v[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Relative brightness 0–1 of a #rrggbb colour (to spot light-on-dark codes). */
export function brightness(hex) {
  const v = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!v) return 0;
  const n = parseInt(v[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
