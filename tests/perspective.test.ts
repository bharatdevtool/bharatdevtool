import { describe, it, expect } from 'vitest';
import { homography, applyHomography, warpPixels, orderQuad, defaultQuad, quadSize, type Quad, type Pixels } from '@/lib/image/perspective';
import { scanPageLayout, scansToPdf } from '@/lib/scan/pdf';
import { PDFDocument } from '@cantoo/pdf-lib';

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

describe('scan pages', () => {
  it('keeps the shape of the corners when no shape is fixed', () => {
    expect(quadSize([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 600 }, { x: 0, y: 600 }])).toEqual({ w: 400, h: 600 });
    expect(quadSize([{ x: 0, y: 0 }, { x: 4800, y: 0 }, { x: 4800, y: 2400 }, { x: 0, y: 2400 }])).toEqual({ w: 2400, h: 1200 });
  });

  it('centres a scan on A4 and turns A4 landscape for wide scans', () => {
    const tall = scanPageLayout(1000, 2000, 'a4');
    expect([tall.pageW, tall.pageH]).toEqual([595.28, 841.89]);
    expect(tall.h).toBeCloseTo(841.89, 2);
    expect(tall.x).toBeCloseTo((595.28 - tall.w) / 2, 6);
    const wide = scanPageLayout(2000, 1000, 'a4');
    expect(wide.pageW).toBeGreaterThan(wide.pageH);
    const fit = scanPageLayout(1654, 2339, 'fit');
    expect(fit.pageW).toBeCloseTo(595.4, 1); // 1654 px at 200 DPI ≈ A4 width
  });

  it('writes one PDF page per scan', async () => {
    const jpeg = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z'), (c) => c.charCodeAt(0));
    const bytes = await scansToPdf([{ bytes: jpeg, width: 1, height: 1 }, { bytes: jpeg, width: 1, height: 1 }], 'a4');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});
