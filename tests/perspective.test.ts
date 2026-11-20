import { describe, it, expect } from 'vitest';
import { homography, applyHomography, warpPixels, orderQuad, defaultQuad, type Quad, type Pixels } from '@/lib/image/perspective';

/** w×h image where every pixel has a unique red value (x + y*w) and green = 255. */
function grid(w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x + y * w, 255, 0, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
}
const red = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4];

describe('perspective maths', () => {
  it('maps each source corner exactly onto its target corner', () => {
    const from: Quad = [{ x: 12, y: 30 }, { x: 410, y: 8 }, { x: 395, y: 290 }, { x: 25, y: 260 }];
    const to: Quad = [{ x: 0, y: 0 }, { x: 1011, y: 0 }, { x: 1011, y: 638 }, { x: 0, y: 638 }];
    const h = homography(from, to);
    from.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(to[i].x, 6);
      expect(q.y).toBeCloseTo(to[i].y, 6);
    });
  });

  it('reproduces the image when the corners cover it exactly', () => {
    const src = grid(6, 4);
    const out = warpPixels(src, [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }], 6, 4);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('rotates when the corners start at another edge', () => {
    const src = grid(4, 4);
    // top-left of the output = top-right of the source → 90° anticlockwise turn
    const out = warpPixels(src, [{ x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }], 4, 4);
    expect(red(out, 0, 0)).toBe(red(src, 3, 0));
    expect(red(out, 3, 0)).toBe(red(src, 3, 3));
    expect(red(out, 0, 3)).toBe(red(src, 0, 0));
  });

  it('crops and scales to the requested output size', () => {
    const out = warpPixels(grid(8, 8), [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 6 }, { x: 2, y: 6 }], 8, 4);
    expect(out.width).toBe(8);
    expect(out.height).toBe(4);
    expect(out.data.length).toBe(8 * 4 * 4);
    expect(out.data[1]).toBe(255);
  });

  it('orders detected corners as TL, TR, BR, BL', () => {
    const q = orderQuad([{ x: 90, y: 95 }, { x: 5, y: 10 }, { x: 100, y: 3 }, { x: 2, y: 80 }]);
    expect(q).toEqual([{ x: 5, y: 10 }, { x: 100, y: 3 }, { x: 90, y: 95 }, { x: 2, y: 80 }]);
    expect(defaultQuad(100, 50, 0.1)[2]).toEqual({ x: 90, y: 45 });
  });

  it('rejects corners that collapse to a line', () => {
    expect(() => warpPixels(grid(4, 4), [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], 4, 4)).toThrow();
  });
});
