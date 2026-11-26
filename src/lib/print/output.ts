// output.ts — turn a print sheet (sheet.ts) into a PDF at exact millimetre size, or a 300 DPI canvas.
// The PDF builder is pure (works in tests); sheetToCanvas needs a browser.

import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { mmToPt, mmToPx, type Rect, type Size, type SheetLine } from './sheet';

export interface PrintSheet {
  paper: Size;
  lines: SheetLine[];
  /** 50 mm check line; left out on papers printed as is (4×6 photo paper). */
  scale?: { x: number; y: number; length: number };
}

export interface PlacedImage {
  rect: Rect;
  bytes: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
}

export const SCALE_LABEL = 'Print at 100% (Actual size). This line should measure 50 mm.';

const GUIDE = rgb(0.6, 0.6, 0.6);

/** One-page PDF with every image placed at its exact size, plus cut/fold guides and the 50 mm scale line. */
export async function sheetToPdf(sheet: PrintSheet, images: PlacedImage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pageH = mmToPt(sheet.paper.h);
  const page = doc.addPage([mmToPt(sheet.paper.w), pageH]);
  // PDF origin is bottom-left; sheet maths is top-left.
  const y = (top: number, h = 0) => pageH - mmToPt(top + h);

  // The same image placed many times (a sheet of passport photos) is stored once.
  const cache = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedJpg>>>();
  for (const img of images) {
    let embedded = cache.get(img.bytes);
    if (!embedded) {
      embedded = img.mime === 'image/png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
      cache.set(img.bytes, embedded);
    }
    page.drawImage(embedded, { x: mmToPt(img.rect.x), y: y(img.rect.y, img.rect.h), width: mmToPt(img.rect.w), height: mmToPt(img.rect.h) });
  }
  for (const l of sheet.lines) {
    page.drawLine({
      start: { x: mmToPt(l.x1), y: y(l.y1) },
      end: { x: mmToPt(l.x2), y: y(l.y2) },
      thickness: 0.4,
      color: GUIDE,
      dashArray: l.kind === 'fold' ? [3, 3] : undefined,
    });
  }
  const s = sheet.scale;
  if (s) {
    page.drawLine({ start: { x: mmToPt(s.x), y: y(s.y) }, end: { x: mmToPt(s.x + s.length), y: y(s.y) }, thickness: 0.8, color: rgb(0, 0, 0) });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(SCALE_LABEL, { x: mmToPt(s.x + s.length + 3), y: y(s.y) - 2.5, size: 7, font, color: rgb(0.3, 0.3, 0.3) });
  }

  return doc.save();
}

/** Draw the sheet on a canvas at `dpi` (300 for photo paper) for a JPG download. Browser only. */
export function sheetToCanvas(sheet: PrintSheet, images: { rect: Rect; source: CanvasImageSource }[], dpi = 300): HTMLCanvasElement {
  const px = (mm: number) => mmToPx(mm, dpi);
  const canvas = document.createElement('canvas');
  canvas.width = px(sheet.paper.w);
  canvas.height = px(sheet.paper.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const img of images) ctx.drawImage(img.source, px(img.rect.x), px(img.rect.y), px(img.rect.w), px(img.rect.h));

  const unit = dpi / 72; // one PDF point in pixels
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 0.4 * unit;
  for (const l of sheet.lines) {
    ctx.setLineDash(l.kind === 'fold' ? [3 * unit, 3 * unit] : []);
    ctx.beginPath();
    ctx.moveTo(px(l.x1), px(l.y1));
    ctx.lineTo(px(l.x2), px(l.y2));
    ctx.stroke();
  }
  const s = sheet.scale;
  if (!s) return canvas;
  ctx.setLineDash([]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.8 * unit;
  ctx.beginPath();
  ctx.moveTo(px(s.x), px(s.y));
  ctx.lineTo(px(s.x + s.length), px(s.y));
  ctx.stroke();
  ctx.fillStyle = '#4d4d4d';
  ctx.font = `${Math.round(7 * unit)}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(SCALE_LABEL, px(s.x + s.length + 3), px(s.y));
  return canvas;
}
