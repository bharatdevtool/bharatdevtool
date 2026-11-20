import { describe, it, expect } from 'vitest';
import { applyScanFilter, boxMean } from '@/lib/scan/filters';
import type { Pixels } from '@/lib/image/perspective';

/** Paper whose brightness falls from 240 (left) to 140 (right), with a dark ink stroke in the middle column. */
function page(w = 60, h = 40): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const paper = 240 - (100 * x) / (w - 1);
      const v = x === Math.floor(w / 2) && y > 5 && y < h - 5 ? 30 : paper;
      data.set([v, v, v * 0.95, 255], (y * w + x) * 4);
    }
  return { width: w, height: h, data };
}
const px = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4];
const base = { brightness: 0, contrast: 0 };

describe('scan filters', () => {
  it('Original with no adjustment leaves the pixels alone', () => {
    const p = page();
    expect(Array.from(applyScanFilter(p, { filter: 'original', ...base }).data)).toEqual(Array.from(p.data));
  });

  it('Remove shadows turns dark and light paper into near-white, keeping ink dark', () => {
    const out = applyScanFilter(page(), { filter: 'shadows', ...base });
    expect(px(out, 2, 20)).toBeGreaterThan(220);
    expect(px(out, 57, 20)).toBeGreaterThan(220);
    expect(px(out, 30, 20)).toBeLessThan(90);
  });

  it('Black & white keeps only pure black ink and white paper', () => {
    const out = applyScanFilter(page(), { filter: 'bw', ...base });
    const values = new Set<number>();
    for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i]);
    expect([...values].sort((a, b) => a - b)).toEqual([0, 255]);
    expect(px(out, 30, 20)).toBe(0);
    expect(px(out, 50, 20)).toBe(255);
  });

  it('Grayscale makes red, green and blue equal', () => {
    const out = applyScanFilter(page(), { filter: 'gray', ...base });
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(out.data[i + 1]);
      expect(out.data[i + 1]).toBe(out.data[i + 2]);
    }
  });

  it('Brightness lifts every channel', () => {
    const p = page();
    const out = applyScanFilter(p, { filter: 'original', brightness: 20, contrast: 0 });
    expect(px(out, 59, 0)).toBeGreaterThan(px(p, 59, 0));
  });

  it('box mean averages the window', () => {
    const m = boxMean(Float32Array.from([0, 0, 0, 9, 9, 9, 0, 0, 0]), 3, 3, 1);
    expect(m[4]).toBeCloseTo(3, 6);
  });
});
