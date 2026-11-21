import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';
import {
  PASSPORT_PHOTO,
  compositeOnColor,
  defaultFrame,
  estimateHead,
  faceToImage,
  frameForHead,
  headFromFace,
  letterbox,
  modnetInputSize,
  pickFace,
  toModnetTensor,
} from '@/lib/image/passport';
import { photoSheet, mmToPx } from '@/lib/print/sheet';
import { sheetToPdf } from '@/lib/print/output';

/** A matte with a head (ellipse) on shoulders (a wide block), like a passport photo. */
function personMatte(w: number, h: number) {
  const a = new Float32Array(w * h);
  const cx = w / 2;
  const headTop = 40;
  const headH = 130;
  const headW = 100;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / (headW / 2);
      const ny = (y - (headTop + headH / 2)) / (headH / 2);
      const inHead = nx * nx + ny * ny <= 1;
      const inBody = y >= headTop + headH + 10 && Math.abs(x - cx) < 140;
      const inNeck = y >= headTop + headH - 10 && y < headTop + headH + 10 && Math.abs(x - cx) < 30;
      if (inHead || inBody || inNeck) a[y * w + x] = 1;
    }
  }
  return { a, headTop, headH, cx };
}

describe('passport photo maths', () => {
  it('sizes MODNet input to a 512 short side in multiples of 32', () => {
    expect(modnetInputSize(1500, 2000)).toEqual({ w: 512, h: 672 });
    expect(modnetInputSize(4000, 3000)).toEqual({ w: 672, h: 512 });
    expect(modnetInputSize(500, 3000)).toEqual({ w: 160, h: 1024 }); // long side capped
  });

  it('normalises pixels to [-1, 1] in channel-first order', () => {
    const t = toModnetTensor(new Uint8ClampedArray([255, 0, 127.5, 255, 0, 255, 0, 255]), 2, 1);
    expect(Array.from(t).map((v) => Math.round(v * 100) / 100)).toEqual([1, -1, -1, 1, 0, -1]);
  });

  it('frames the head at the passport size: 34 mm head, top of hair 4 mm from the top', () => {
    const f = frameForHead({ crownY: 100, centerX: 300, height: 340 });
    expect(f.w / f.h).toBeCloseTo(35 / 45, 6);
    expect(f.h).toBeCloseTo((340 / 34) * 45, 6);
    expect(f.y).toBeCloseTo(100 - 40, 6);
    expect(f.x + f.w / 2).toBeCloseTo(300, 6);
  });

  it('falls back to a centred frame of the right shape', () => {
    const f = defaultFrame(1000, 800);
    expect(f.w / f.h).toBeCloseTo(35 / 45, 6);
    expect(f.h).toBeLessThanOrEqual(800);
  });

  it('finds the head from the matte alone when no face is detected', () => {
    const { a, headTop, headH, cx } = personMatte(400, 400);
    const head = estimateHead(a, 400, 400)!;
    expect(Math.abs(head.crownY - headTop)).toBeLessThanOrEqual(2); // ignores the thinnest top rows
    expect(head.centerX).toBeCloseTo(cx, 0);
    expect(head.height).toBeGreaterThan(headH * 0.85);
    expect(head.height).toBeLessThan(headH * 1.25);
    expect(estimateHead(new Float32Array(100), 10, 10)).toBeNull();
  });

  it('takes the chin from the face box and the top of the hair from the matte above it', () => {
    const { a, headTop } = personMatte(400, 400);
    const face = { x1: 165, y1: 80, x2: 235, y2: 165, score: 0.99 };
    const head = headFromFace(face, a, 400, 400);
    expect(head.crownY).toBe(headTop);
    expect(head.centerX).toBe(200);
    expect(head.height).toBeCloseTo(165 - headTop, 6);
    // Without a matte it guesses the hair above the face.
    expect(headFromFace(face, null, 400, 400).crownY).toBeCloseTo(80 - 85 * 0.3, 6);
  });

  it('picks the biggest confident face and maps it back through the letterbox', () => {
    // anchors: [bg, face] scores and [x1, y1, x2, y2] boxes
    const scores = [0.9, 0.1, 0.05, 0.95, 0.2, 0.8, 0.01, 0.99];
    const boxes = [0, 0, 1, 1, 0.4, 0.2, 0.6, 0.5, 0.1, 0.1, 0.15, 0.15, 0.45, 0.25, 0.55, 0.45];
    const face = pickFace(scores, boxes)!;
    expect(face).toMatchObject({ x1: 0.4, y1: 0.2, x2: 0.6, y2: 0.5 });
    expect(pickFace([1, 0], [0, 0, 1, 1])).toBeNull();

    const lb = letterbox(400, 600); // portrait into 320×240: scale 0.4, centred
    expect(lb).toEqual({ scale: 0.4, dx: 80, dy: 0 });
    const px = faceToImage({ x1: 0.25, y1: 0, x2: 0.75, y2: 1, score: 1 }, 400, 600);
    expect(px).toMatchObject({ x1: 0, y1: 0, x2: 400, y2: 600 });
  });

  it('blends the person over the background colour', () => {
    const rgba = new Uint8ClampedArray([200, 100, 50, 255, 200, 100, 50, 255]);
    compositeOnColor(rgba, [1, 0.5], [255, 255, 255]);
    expect(Array.from(rgba)).toEqual([200, 100, 50, 255, 228, 178, 152, 255]); // pixel arrays round .5 to even
  });
});

describe('passport photo print sheets', () => {
  it('fits 8 photos on 4×6 photo paper, lying sideways, without a scale line', () => {
    const s = photoSheet({ paper: '4x6' });
    expect(s.capacity).toBe(8);
    expect(s.paper).toEqual({ w: 152.4, h: 101.6 });
    expect(s.scale).toBeUndefined();
    for (const r of s.slots) {
      expect(r).toMatchObject({ w: 35, h: 45 });
      expect(r.x).toBeGreaterThanOrEqual(3);
      expect(r.x + r.w).toBeLessThanOrEqual(152.4 - 3);
      expect(r.y + r.h).toBeLessThanOrEqual(101.6 - 3);
    }
    expect(mmToPx(PASSPORT_PHOTO.w)).toBe(413);
    expect(mmToPx(PASSPORT_PHOTO.h)).toBe(531);
  });

  it('fits 25 on A4 with the 50 mm check line, and honours a smaller count', () => {
    const s = photoSheet({ paper: 'a4' });
    expect(s.capacity).toBe(25);
    expect(s.scale?.length).toBe(50);
    const last = s.slots.at(-1)!;
    expect(last.y + last.h).toBeLessThan(s.scale!.y - 3);
    expect(photoSheet({ paper: 'a4', count: 6 }).slots).toHaveLength(6);
    expect(photoSheet({ paper: '4x6', count: 99 }).slots).toHaveLength(8);
  });

  it('stores a photo placed many times only once in the PDF', async () => {
    const PNG_1PX = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const sheet = photoSheet({ paper: '4x6' });
    const pdf = await sheetToPdf(sheet, sheet.slots.map((rect) => ({ rect, bytes: PNG_1PX, mime: 'image/png' as const })));
    const doc = await PDFDocument.load(pdf);
    const page = doc.getPage(0);
    expect(page.getWidth()).toBeCloseTo(152.4 * (72 / 25.4), 1);
    const images = doc.context
      .enumerateIndirectObjects()
      .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    expect(images.length).toBeLessThanOrEqual(2); // the image and its alpha mask, not 8 copies
  });
});
