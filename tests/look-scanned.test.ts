import { describe, it, expect } from 'vitest';
import { pageTilt, rng, scanTone } from '@/lib/scan/lookScanned';
import type { Pixels } from '@/lib/image/perspective';

function colourful(w = 20, h = 10): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set([200, 40, 90, 255], i);
  return { width: w, height: h, data };
}
const still = { noise: 0, brightness: 0, contrast: 0 };

describe('make PDF look scanned', () => {
  it('uses the same random numbers for the same seed', () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(1)()).not.toBe(rng(2)());
  });

  it('tilts every page a little, never more than the maximum', () => {
    const tilts = Array.from({ length: 12 }, (_, i) => pageTilt(1, i));
    for (const t of tilts) {
      expect(Math.abs(t)).toBeGreaterThanOrEqual(0.3);
      expect(Math.abs(t)).toBeLessThanOrEqual(1);
    }
    expect(new Set(tilts.map(Math.sign)).size).toBe(2);
    expect(Math.abs(pageTilt(0, 3))).toBe(0);
  });

  it('grey mode removes the colour (only a faint paper tint is left)', () => {
    const out = scanTone(colourful(), { colour: 'gray', ...still });
    const [r, g, b] = out.data;
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(5);
  });

  it('colour mode with no grain leaves the page alone', () => {
    const src = colourful();
    expect(Array.from(scanTone(src, { colour: 'colour', ...still }).data)).toEqual(Array.from(src.data));
  });

  it('adds grain only when asked', () => {
    const out = scanTone(colourful(), { colour: 'colour', noise: 1, brightness: 0, contrast: 0 }, 3);
    const reds = new Set<number>();
    for (let i = 0; i < out.data.length; i += 4) reds.add(out.data[i]);
    expect(reds.size).toBeGreaterThan(5);
  });
});
