// detect.ts — find the corners of a page or card in a photo (pure JS, no OpenCV download).
// Works on a small copy of the photo: threshold (Otsu) → largest region → its four extreme corners.
// Paper is usually brighter than the table; if that fails, the darker region is tried.
// Returns null when unsure, and the user drags the corners by hand.

import type { Pixels, Point, Quad } from '@/lib/image/perspective';

/** Otsu's threshold for a 0–255 luminance array. */
export function otsu(lum: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of lum) hist[v]++;
  const total = lum.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Pixels of the largest 4-connected region where mask is 1. */
function largestRegion(mask: Uint8Array, w: number, h: number): number[] {
  const seen = new Uint8Array(mask.length);
  let best: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const region: number[] = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const x = p % w;
      const y = (p - x) / w;
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of next) {
        if (q >= 0 && mask[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (region.length > best.length) best = region;
  }
  return best;
}

const area = (q: Quad) =>
  Math.abs(q.reduce((s, p, i) => {
    const n = q[(i + 1) % 4];
    return s + p.x * n.y - n.x * p.y;
  }, 0)) / 2;

function cornersOf(region: number[], w: number): Quad {
  let tl = 0, tr = 0, br = 0, bl = 0;
  let sMin = Infinity, sMax = -Infinity, dMin = Infinity, dMax = -Infinity;
  for (const p of region) {
    const x = p % w;
    const y = (p - x) / w;
    if (x + y < sMin) { sMin = x + y; tl = p; }
    if (x + y > sMax) { sMax = x + y; br = p; }
    if (x - y > dMax) { dMax = x - y; tr = p; }
    if (x - y < dMin) { dMin = x - y; bl = p; }
  }
  const pt = (p: number): Point => ({ x: (p % w) + 0.5, y: Math.floor(p / w) + 0.5 });
  return [pt(tl), pt(tr), pt(br), pt(bl)];
}

/** Corners of the page in `px` (in px's own coordinates), or null. Keep px small (about 320 px). */
export function detectQuad(px: Pixels): Quad | null {
  const { width: w, height: h, data } = px;
  const n = w * h;
  const lum = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) lum[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  const t = otsu(lum);
  for (const bright of [true, false]) {
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) mask[p] = (bright ? lum[p] > t : lum[p] <= t) ? 1 : 0;
    const region = largestRegion(mask, w, h);
    const share = region.length / n;
    if (share < 0.15 || share > 0.97) continue;
    const q = cornersOf(region, w);
    // Reject shapes that are not page-like (too small, or a thin sliver).
    if (area(q) < 0.12 * n || area(q) > 1.2 * region.length + 0.1 * n) continue;
    return q;
  }
  return null;
}

/** Browser: detect on a ~320 px copy of the canvas and return corners in the canvas' own pixels. */
export function detectOnCanvas(source: HTMLCanvasElement, side = 320): Quad | undefined {
  const k = Math.min(1, side / Math.max(source.width, source.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(source.width * k));
  small.height = Math.max(1, Math.round(source.height * k));
  const ctx = small.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(source, 0, 0, small.width, small.height);
  const q = detectQuad(ctx.getImageData(0, 0, small.width, small.height));
  if (!q) return undefined;
  const sx = source.width / small.width;
  const sy = source.height / small.height;
  return q.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad;
}
