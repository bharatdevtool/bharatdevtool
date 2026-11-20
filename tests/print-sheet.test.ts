import { describe, it, expect } from 'vitest';
import { PDFDocument } from '@cantoo/pdf-lib';
import { cardSheet, maxCardRows, mmToPt, mmToPx, ID_CARD } from '@/lib/print/sheet';
import { sheetToPdf } from '@/lib/print/output';

const PNG_1PX = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

describe('print sheet layout', () => {
  it('places four [front | back] pairs on A4 by default, at exact ID-1 card size', () => {
    const s = cardSheet();
    expect(s.paper).toEqual({ w: 210, h: 297 });
    expect(s.slots).toHaveLength(8);
    for (const slot of s.slots) {
      expect(slot.rect.w).toBe(85.6);
      expect(slot.rect.h).toBe(54);
      expect(slot.rect.x).toBeGreaterThanOrEqual(10);
      expect(slot.rect.x + slot.rect.w).toBeLessThanOrEqual(200);
      expect(slot.rect.y + slot.rect.h).toBeLessThanOrEqual(297 - 10);
    }
    expect(mmToPt(ID_CARD.w)).toBeCloseTo(242.65, 2);
    expect(mmToPx(ID_CARD.w)).toBe(1011);
  });

  it('fold mode: front and back touch along a dashed fold line', () => {
    const s = cardSheet({ mode: 'fold' });
    const front = s.slots.find((x) => x.row === 0 && x.side === 'front')!.rect;
    const back = s.slots.find((x) => x.row === 0 && x.side === 'back')!.rect;
    expect(front.x + front.w).toBeCloseTo(back.x, 6);
    const fold = s.lines.filter((l) => l.kind === 'fold');
    expect(fold).toHaveLength(4);
    expect(fold[0].x1).toBeCloseTo(back.x, 6);
    // pair is centred on the page
    expect(front.x).toBeCloseTo(210 - (back.x + back.w), 6);
  });

  it('cut mode: a gap between front and back and no fold lines', () => {
    const s = cardSheet({ mode: 'cut', gap: 6 });
    const front = s.slots[0].rect;
    const back = s.slots[1].rect;
    expect(back.x - (front.x + front.w)).toBeCloseTo(6, 6);
    expect(s.lines.some((l) => l.kind === 'fold')).toBe(false);
  });

  it('never lets rows overlap or run past the scale line', () => {
    expect(maxCardRows()).toBe(4);
    const s = cardSheet({ rows: 10 });
    expect(s.slots.length / 2).toBe(4);
    const last = s.slots[s.slots.length - 1].rect;
    expect(last.y + last.h).toBeLessThan(s.scale.y);
    for (let r = 1; r < 4; r++) {
      const prev = s.slots.find((x) => x.row === r - 1)!.rect;
      const cur = s.slots.find((x) => x.row === r)!.rect;
      expect(cur.y).toBeGreaterThanOrEqual(prev.y + prev.h);
    }
  });

  it('refuses paper too narrow for a card pair', () => {
    expect(() => cardSheet({ paper: '4x6' })).toThrow();
  });
});

describe('print sheet PDF', () => {
  it('writes an A4 page of 595.28 × 841.89 pt with the images embedded', async () => {
    const s = cardSheet();
    const bytes = await sheetToPdf(s, [{ rect: s.slots[0].rect, bytes: PNG_1PX, mime: 'image/png' }]);
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 2);
    expect(height).toBeCloseTo(841.89, 2);
    expect(doc.getPageCount()).toBe(1);
  });
});
