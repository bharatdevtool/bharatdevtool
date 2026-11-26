// filters.ts — scan clean-up filters on raw RGBA pixels (pure, no DOM).

import type { Pixels } from '@/lib/image/perspective';

export type ScanFilter = 'original' | 'magic' | 'gray' | 'bw' | 'shadows';

export const SCAN_FILTERS: { id: ScanFilter; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'magic', label: 'Magic colour' },
  { id: 'gray', label: 'Grayscale' },
  { id: 'bw', label: 'Black & white' },
  { id: 'shadows', label: 'Remove shadows' },
];

export interface FilterSettings {
  filter: ScanFilter;
  /** -100 … 100 */
  brightness: number;
  /** -100 … 100 */
  contrast: number;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Luminance of every pixel. */
function luminance(px: Pixels): Float32Array {
  const out = new Float32Array(px.width * px.height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) out[p] = lum(px.data, i);
  return out;
}

/** Mean of `values` over a (2r+1)² window around every pixel, via a summed-area table. */
export function boxMean(values: Float32Array, width: number, height: number, r: number): Float32Array {
  const w1 = width + 1;
  const sat = new Float64Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += values[y * width + x];
      sat[(y + 1) * w1 + x + 1] = sat[y * w1 + x + 1] + row;
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);
      const sum = sat[y1 * w1 + x1] - sat[y0 * w1 + x1] - sat[y1 * w1 + x0] + sat[y0 * w1 + x0];
      out[y * width + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * Even out the lighting: divide each pixel by the local paper brightness (a large blurred copy),
 * so shadows and uneven light turn into plain white paper while ink stays dark.
 */
function flattenLight(px: Pixels, out: Uint8ClampedArray) {
  const l = luminance(px);
  const r = Math.max(4, Math.round(Math.min(px.width, px.height) / 12));
  const bg = boxMean(l, px.width, px.height, r);
  for (let p = 0, i = 0; p < l.length; p++, i += 4) {
    const k = 245 / Math.max(bg[p], 1);
    out[i] = clamp(px.data[i] * k);
    out[i + 1] = clamp(px.data[i + 1] * k);
    out[i + 2] = clamp(px.data[i + 2] * k);
    out[i + 3] = px.data[i + 3];
  }
}

/** Apply a filter and brightness/contrast; returns new pixels (input untouched). */
export function applyScanFilter(px: Pixels, s: FilterSettings): Pixels {
  const n = px.width * px.height;
  const out = new Uint8ClampedArray(px.data);

  if (s.filter === 'shadows' || s.filter === 'magic') flattenLight(px, out);

  if (s.filter === 'magic') {
    // A little extra contrast and colour on the flattened page.
    for (let i = 0; i < out.length; i += 4) {
      const g = lum(out, i);
      for (let c = 0; c < 3; c++) out[i + c] = clamp((g + (out[i + c] - g) * 1.3 - 128) * 1.15 + 128 + 10);
    }
  } else if (s.filter === 'gray') {
    for (let i = 0; i < out.length; i += 4) out[i] = out[i + 1] = out[i + 2] = Math.round(lum(out, i));
  } else if (s.filter === 'bw') {
    // Adaptive threshold: ink is anything clearly darker than its neighbourhood.
    const l = luminance(px);
    const mean = boxMean(l, px.width, px.height, Math.max(4, Math.round(Math.min(px.width, px.height) / 24)));
    for (let p = 0, i = 0; p < n; p++, i += 4) out[i] = out[i + 1] = out[i + 2] = l[p] < mean[p] * 0.85 ? 0 : 255;
  }

  if (s.brightness || s.contrast) {
    const b = (s.brightness / 100) * 128;
    const c = 1 + s.contrast / 100;
    for (let i = 0; i < out.length; i += 4) for (let k = 0; k < 3; k++) out[i + k] = clamp((out[i + k] - 128) * c + 128 + b);
  }
  return { width: px.width, height: px.height, data: out };
}
