import { describe, it, expect } from 'vitest';
import { detectQuad, otsu } from '@/lib/scan/detect';
import type { Pixels, Point, Quad } from '@/lib/image/perspective';

function inside(q: Quad, x: number, y: number) {
  let c = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const a = q[i], b = q[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** A tilted page (value `fg`) on a table (value `bg`), with a little noise. */
function photo(q: Quad, fg: number, bg: number, w = 200, h = 160): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  let seed = 7;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      seed = (seed * 16807) % 2147483647;
      const v = (inside(q, x + 0.5, y + 0.5) ? fg : bg) + ((seed % 21) - 10);
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  return { width: w, height: h, data };
}
const near = (a: Point, b: Point, tol = 4) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

describe('page detection', () => {
  const page: Quad = [{ x: 40, y: 22 }, { x: 165, y: 35 }, { x: 150, y: 140 }, { x: 28, y: 120 }];

  it('finds the corners of a bright page on a dark table', () => {
    const q = detectQuad(photo(page, 225, 60));
    expect(q).not.toBeNull();
    q!.forEach((p, i) => expect(near(p, page[i]), `corner ${i}: ${p.x},${p.y}`).toBe(true));
  });

  it('also finds a dark card on a light table', () => {
    const q = detectQuad(photo(page, 50, 220));
    expect(q).not.toBeNull();
    q!.forEach((p, i) => expect(near(p, page[i])).toBe(true));
  });

  it('gives up on a photo with no clear page', () => {
    expect(detectQuad(photo([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 128, 128))).toBeNull();
  });

  it('splits a two-tone histogram between the tones', () => {
    const t = otsu(Uint8Array.from([...Array(50).fill(40), ...Array(50).fill(200)]));
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
  });
});
