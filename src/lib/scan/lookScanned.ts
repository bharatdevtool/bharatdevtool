// lookScanned.ts — make a clean page look like it went through a scanner or photocopier.
// scanTone/pageTilt are pure (tested); renderScanned needs a browser canvas.

import type { Pixels } from '@/lib/image/perspective';
import { applyScanFilter } from './filters';

export type ScanColour = 'gray' | 'bw' | 'colour';

export interface ScanLook {
  colour: ScanColour;
  /** Grain, 0 … 1 */
  noise: number;
  /** Softness, 0 … 1 (0.5 px blur at 1) */
  blur: number;
  /** Largest tilt in degrees; each page gets its own random tilt up to this */
  tilt: number;
  brightness: number;
  contrast: number;
}

export const DEFAULT_LOOK: ScanLook = { colour: 'gray', noise: 0.35, blur: 0.4, tilt: 0.8, brightness: 0, contrast: 10 };

/** Small, seeded random number generator (mulberry32), so a preview matches the download. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tilt for page `index`: between 30% and 100% of `max`, left or right. */
export function pageTilt(max: number, index: number, seed = 1): number {
  const r = rng(seed * 7919 + index * 104729);
  const size = max * (0.3 + 0.7 * r());
  return r() < 0.5 ? -size : size;
}

/** Paper tone the grey mode tints toward (a slightly warm photocopy grey). */
const PAPER = [244, 241, 234];

/** Colour mode, grain and brightness/contrast on raw pixels. */
export function scanTone(px: Pixels, look: Pick<ScanLook, 'colour' | 'noise' | 'brightness' | 'contrast'>, seed = 1): Pixels {
  const base =
    look.colour === 'bw'
      ? applyScanFilter(px, { filter: 'bw', brightness: 0, contrast: 0 })
      : { width: px.width, height: px.height, data: new Uint8ClampedArray(px.data) };
  const d = base.data;
  const rand = rng(seed);
  const amp = look.noise * 28;
  for (let i = 0; i < d.length; i += 4) {
    if (look.colour === 'gray') {
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      d[i] = g * PAPER[0];
      d[i + 1] = g * PAPER[1];
      d[i + 2] = g * PAPER[2];
    }
    if (amp) {
      const n = (rand() + rand() - 1) * amp;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }
  return look.brightness || look.contrast ? applyScanFilter(base, { filter: 'original', brightness: look.brightness, contrast: look.contrast }) : base;
}

/** Browser: tilt + blur on a canvas, then tone and grain. Page `index` decides its own tilt. */
export function renderScanned(source: HTMLCanvasElement, look: ScanLook, index: number, seed = 1): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = `rgb(${PAPER.join(',')})`;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.save();
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((pageTilt(look.tilt, index, seed) * Math.PI) / 180);
  if (look.blur > 0) ctx.filter = `blur(${(look.blur * 0.5 * Math.max(1, out.width / 1200)).toFixed(2)}px)`;
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  ctx.restore();
  const toned = scanTone(ctx.getImageData(0, 0, out.width, out.height), look, seed + index);
  const img = ctx.createImageData(out.width, out.height);
  img.data.set(toned.data);
  ctx.putImageData(img, 0, 0);
  return out;
}
