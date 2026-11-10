import { describe, it, expect } from 'vitest';
import {
  fitToSize,
  padJpeg,
  kbRangeToBytes,
  MAX_QUALITY,
  QUALITY_FLOOR,
} from '../public/assets/js/target-size.js';
import { computeFrame, capSize, crc32, createZip } from '../public/assets/js/image-utils.js';
import { EXAM_GROUPS, guessDoc, getGroup, rangeText, dimsText, inkLines } from '../public/assets/js/exam-presets.js';
import { checkOutput, toPixels, formatPhotoDate } from '../public/assets/js/kb-checks.js';
import { cleanSignaturePixels, stampBandHeight } from '../public/assets/js/kb-edit.js';
import { aspectBox } from '../public/assets/js/image-utils.js';

/** Fake JPEG encoder: size grows with pixel count and quality, like the real thing. */
function fakeEncoder(bytesPerPixelAtMax = 1.2) {
  const calls: { w: number; h: number; q: number }[] = [];
  const encode = async (w: number, h: number, q: number) => {
    calls.push({ w, h, q });
    return { size: Math.round(w * h * bytesPerPixelAtMax * (0.08 + q * q)) };
  };
  return { encode, calls };
}

describe('kbRangeToBytes', () => {
  it('uses 1000-byte KB for the maximum and 1024-byte KB for the minimum', () => {
    const { minBytes, maxBytes } = kbRangeToBytes(20, 50);
    expect(maxBytes).toBeLessThanOrEqual(50_000);
    expect(minBytes).toBeGreaterThanOrEqual(20 * 1024);
  });

  it('falls back to raw bounds when the safety margins overlap', () => {
    const { minBytes, maxBytes } = kbRangeToBytes(49, 50);
    expect(minBytes).toBeLessThanOrEqual(maxBytes);
  });
});

describe('fitToSize', () => {
  it('lands inside the range for a fixed pixel size', async () => {
    const { encode } = fakeEncoder();
    const { minBytes, maxBytes } = kbRangeToBytes(20, 50);
    const r = await fitToSize({ width: 200, height: 230, minBytes, maxBytes, fixedSize: true, encode });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.size).toBeLessThanOrEqual(maxBytes);
    expect([r.width, r.height]).toEqual([200, 230]);
  });

  it('shrinks pixels when even the quality floor is too big', async () => {
    const { encode } = fakeEncoder();
    const { maxBytes } = kbRangeToBytes(0, 20);
    const r = await fitToSize({ width: 2000, height: 1500, maxBytes, encode });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.size).toBeLessThanOrEqual(maxBytes);
    expect(r.width).toBeLessThan(2000);
    expect(r.width / r.height).toBeCloseTo(2000 / 1500, 1);
    expect(r.quality).toBeGreaterThanOrEqual(QUALITY_FLOOR);
  });

  it('keeps maximum quality when the image already fits', async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToSize({ width: 100, height: 100, maxBytes: 1_000_000, encode });
    expect(r.ok && r.quality).toBe(MAX_QUALITY);
    expect(calls).toHaveLength(1);
  });

  it('asks for padding when the image is below the minimum even at full quality', async () => {
    const { encode } = fakeEncoder();
    const { minBytes, maxBytes } = kbRangeToBytes(50, 100);
    const r = await fitToSize({ width: 140, height: 60, minBytes, maxBytes, fixedSize: true, encode });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.padToBytes).toBeGreaterThanOrEqual(minBytes);
    expect(r.padToBytes).toBeLessThanOrEqual(maxBytes);
  });

  it('reports too-large when a fixed pixel size cannot fit', async () => {
    const { encode } = fakeEncoder(50);
    const r = await fitToSize({ width: 2000, height: 2000, maxBytes: 1000, fixedSize: true, encode });
    expect(r).toEqual({ ok: false, reason: 'too-large' });
  });

  it('terminates with a bounded number of encodes', async () => {
    const { encode, calls } = fakeEncoder();
    await fitToSize({ width: 6000, height: 4000, maxBytes: 20_000, encode });
    expect(calls.length).toBeLessThan(40);
  });
});

describe('padJpeg', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 0xff, 0xd9]);

  it('grows the file to the target with comment segments after SOI', () => {
    const out = padJpeg(jpeg, 200);
    expect(out.length).toBe(200);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0xff, 0xd8, 0xff, 0xfe]);
    expect(Array.from(out.slice(-7))).toEqual([0xff, 0xdb, 1, 2, 3, 0xff, 0xd9]);
  });

  it('splits padding larger than one segment', () => {
    const out = padJpeg(jpeg, 150_000);
    expect(out.length).toBeGreaterThanOrEqual(150_000);
    const segLen = (out[4] << 8) | out[5];
    expect(segLen).toBe(65535);
  });

  it('leaves files already at the target alone and rejects non-JPEGs', () => {
    expect(padJpeg(jpeg, 5)).toBe(jpeg);
    expect(() => padJpeg(new Uint8Array([0x89, 0x50]), 100)).toThrow();
  });
});

describe('image-utils', () => {
  it('cover crops the overflow and fills the box', () => {
    const f = computeFrame(400, 400, 200, 230, 'cover');
    expect(f.dw).toBe(200);
    expect(f.dh).toBe(230);
    expect(f.sw).toBeLessThan(400);
    expect(f.sh).toBe(400);
  });

  it('contain fits inside the box with padding', () => {
    const f = computeFrame(1000, 200, 140, 60, 'contain');
    expect(f.dw).toBe(140);
    expect(f.dh).toBeCloseTo(28);
    expect(f.dy).toBeCloseTo(16);
  });

  it('caps the longest side', () => {
    expect(capSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(capSize(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });

  it('computes standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
  });

  it('writes a ZIP with one entry per file', () => {
    const zip = createZip([
      { name: 'photo.jpg', data: new Uint8Array([1, 2, 3]) },
      { name: 'signature.jpg', data: new Uint8Array([4, 5]) },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
  });
});

describe('exam presets', () => {
  it('has valid ranges and unique ids', () => {
    expect(new Set(EXAM_GROUPS.map((g) => g.id)).size).toBe(EXAM_GROUPS.length);
    for (const g of EXAM_GROUPS) {
      expect(new Set(g.docs.map((d) => d.id)).size, g.id).toBe(g.docs.length);
      for (const d of g.docs) {
        expect(d.maxKB, `${g.id}/${d.id}`).toBeGreaterThan(d.minKB);
        expect(Boolean(d.width) === Boolean(d.height), `${g.id}/${d.id}`).toBe(true);
        if (d.width) expect(d.fit, `${g.id}/${d.id}`).not.toBe('none');
      }
    }
  });

  it('sorts a banking batch by shape', () => {
    const banking = getGroup('banking')!;
    expect(guessDoc(banking, 600, 700)).toBe('photo');
    expect(guessDoc(banking, 900, 300)).toBe('signature');
    expect(guessDoc(banking, 500, 500)).toBe('thumb');
    expect(guessDoc(banking, 1600, 800)).toBe('declaration');
  });

  it('tells a phone photo of a signature from a declaration by its lines of writing', () => {
    const banking = getGroup('banking')!;
    expect(guessDoc(banking, 1600, 900, 1)).toBe('signature');
    expect(guessDoc(banking, 1600, 900, 4)).toBe('declaration');
    // A 40×30 page with three dark lines vs. one tall signature stroke.
    const page = (bands: [number, number][]) => {
      const w = 40, h = 30;
      const d = new Uint8ClampedArray(w * h * 4).fill(230);
      for (const [y0, y1] of bands) for (let y = y0; y < y1; y++) for (let x = 5; x < 35; x++) d.set([20, 20, 20, 255], (y * w + x) * 4);
      return inkLines(d, w, h);
    };
    expect(page([[3, 6], [12, 15], [21, 24]])).toBe(3);
    expect(page([[8, 20]])).toBe(1);
  });

  it('falls back to the only document a group has', () => {
    expect(guessDoc(getGroup('ssc')!, 600, 700)).toBe('signature');
  });

  it('gives every document a kind, a sane shape and readable labels', () => {
    for (const g of EXAM_GROUPS) {
      expect(g.short, g.id).toBeTruthy();
      for (const d of g.docs) {
        expect(['photo', 'signature', 'thumb', 'document'], `${g.id}/${d.id}`).toContain(d.kind);
        if (d.aspect) expect(d.aspect, `${g.id}/${d.id}`).toBeGreaterThan(0);
        if (d.cm && d.aspect) expect(Math.abs(d.cm[0] / d.cm[1] - d.aspect), `${g.id}/${d.id}`).toBeLessThan(0.01);
      }
    }
    expect(rangeText({ minKB: 20, maxKB: 50 })).toBe('20–50 KB');
    expect(rangeText({ minKB: 0, maxKB: 20 })).toBe('under 20 KB');
    expect(dimsText(getGroup('banking')!.docs[0])).toBe('200 × 230 px');
    expect(dimsText(getGroup('ctet')!.docs[0])).toBe('3.5 × 4.5 cm');
  });
});

describe('size units', () => {
  it('converts cm, mm and inches to pixels at a DPI', () => {
    expect(toPixels(3.5, 'cm', 300)).toBe(413);
    expect(toPixels(45, 'mm', 300)).toBe(531);
    expect(toPixels(2, 'in', 200)).toBe(400);
    expect(toPixels(200, 'px', 300)).toBe(200);
    expect(toPixels(0, 'cm', 300)).toBe(0);
  });

  it('formats the photo date as DD-MM-YYYY', () => {
    expect(formatPhotoDate(new Date(2026, 0, 5))).toBe('05-01-2026');
  });

  it('finds the largest centre box with the required shape', () => {
    expect(aspectBox(1000, 1000, 3.5 / 4.5)).toEqual({ width: 778, height: 1000 });
    expect(aspectBox(900, 300, 3)).toEqual({ width: 900, height: 300 });
    expect(aspectBox(1200, 300, 3)).toEqual({ width: 900, height: 300 });
  });
});

describe('will the form accept it?', () => {
  const jpg = (bytes: number, width = 200, height = 230, stamped = false) => ({ bytes, width, height, mime: 'image/jpeg', stamped });

  it('passes a file that fits under both 1000- and 1024-byte KB', () => {
    const checks = checkOutput(jpg(35_000), { minKB: 20, maxKB: 50, width: 200, height: 230 });
    expect(checks.map((c) => [c.id, c.ok])).toEqual([['size', true], ['format', true], ['pixels', true]]);
    expect(checks[2].label).toBe('Exactly 200 × 230 px');
  });

  it('fails a file that only fits if the portal counts 1 KB as 1024 bytes', () => {
    expect(checkOutput(jpg(50_500), { minKB: 20, maxKB: 50 })[0].ok).toBe(false);
    // …and one under the minimum when the portal counts 1 KB as 1024 bytes.
    expect(checkOutput(jpg(20_200), { minKB: 20, maxKB: 50 })[0].ok).toBe(false);
  });

  it('catches wrong pixels, wrong shape, PNG and a missing name/date', () => {
    expect(checkOutput(jpg(30_000, 201, 230), { minKB: 20, maxKB: 50, width: 200, height: 230 })[2].ok).toBe(false);
    expect(checkOutput(jpg(30_000, 350, 450), { minKB: 10, maxKB: 100, aspect: 3.5 / 4.5 })[2].ok).toBe(true);
    expect(checkOutput(jpg(30_000, 450, 450), { minKB: 10, maxKB: 100, aspect: 3.5 / 4.5 })[2].ok).toBe(false);
    expect(checkOutput({ ...jpg(30_000), mime: 'image/png' }, { minKB: 0, maxKB: 50 })[1].ok).toBe(false);
    const stamp = checkOutput(jpg(30_000), { minKB: 0, maxKB: 50, stamp: 'required' });
    expect(stamp.find((c) => c.id === 'stamp')?.ok).toBe(false);
    // "Recommended" only shows a tick once it was added.
    expect(checkOutput(jpg(30_000), { minKB: 0, maxKB: 50, stamp: 'recommended' }).some((c) => c.id === 'stamp')).toBe(false);
    expect(checkOutput(jpg(30_000, 200, 230, true), { minKB: 0, maxKB: 50, stamp: 'recommended' }).find((c) => c.id === 'stamp')?.ok).toBe(true);
  });
});

describe('signature clean-up', () => {
  /** Grey paper (190) with a faint blue stroke and a soft shadow. */
  function scan(w: number, h: number) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const shadow = x < 10 ? 25 : 0;
        const ink = y >= 20 && y < 24 && x >= 30 && x < 70;
        d[o] = ink ? 70 : 190 - shadow;
        d[o + 1] = ink ? 80 : 190 - shadow;
        d[o + 2] = ink ? 150 : 185 - shadow;
        d[o + 3] = 255;
      }
    }
    return d;
  }

  it('turns paper white, darkens the ink (keeping it blue) and finds the ink box', () => {
    const w = 100, h = 50;
    const d = scan(w, h);
    const box = cleanSignaturePixels(d, w, h);
    expect(box).toEqual({ x: 30, y: 20, w: 40, h: 4 });
    const px = (x: number, y: number) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 3));
    expect(px(90, 5)).toEqual([255, 255, 255]); // paper
    expect(px(3, 5)).toEqual([255, 255, 255]); // shadowed paper
    const [r, g, b] = px(50, 21);
    expect(Math.max(r, g, b)).toBeLessThan(80); // darker than before
    expect(b).toBeGreaterThan(r); // still blue
  });

  it('returns null for a blank page', () => {
    const d = new Uint8ClampedArray(20 * 20 * 4).fill(240);
    expect(cleanSignaturePixels(d, 20, 20)).toBeNull();
  });

  it('sizes the name/date band to the photo', () => {
    expect(stampBandHeight(230)).toBe(37);
    expect(stampBandHeight(50)).toBe(14);
  });
});
