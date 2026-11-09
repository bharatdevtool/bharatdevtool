import { describe, it, expect } from 'vitest';
import {
  fitToSize,
  padJpeg,
  kbRangeToBytes,
  MAX_QUALITY,
  QUALITY_FLOOR,
} from '../public/assets/js/target-size.js';
import { computeFrame, capSize, crc32, createZip } from '../public/assets/js/image-utils.js';
import { EXAM_GROUPS, guessDoc, getGroup } from '../public/assets/js/exam-presets.js';

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

  it('falls back to the only document a group has', () => {
    expect(guessDoc(getGroup('ssc')!, 600, 700)).toBe('signature');
  });
});
