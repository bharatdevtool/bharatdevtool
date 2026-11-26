// pdf.ts — put scanned pages (JPEG bytes) into a PDF: one page per scan, on A4 or at the scan's own size.

import { PDFDocument } from '@cantoo/pdf-lib';

export interface ScanImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type ScanPageSize = 'a4' | 'fit';

const A4: [number, number] = [595.28, 841.89];
/** Resolution scans are treated as when the page takes the image's own size. */
export const SCAN_DPI = 200;

/** Where a w×h image goes: centred and as large as possible on A4 (portrait or landscape), or a page of its own size. */
export function scanPageLayout(width: number, height: number, size: ScanPageSize) {
  if (size === 'fit') {
    const w = (width * 72) / SCAN_DPI;
    const h = (height * 72) / SCAN_DPI;
    return { pageW: w, pageH: h, x: 0, y: 0, w, h };
  }
  const [pageW, pageH] = width > height ? [A4[1], A4[0]] : A4;
  const k = Math.min(pageW / width, pageH / height);
  const w = width * k;
  const h = height * k;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

export async function scansToPdf(pages: ScanImage[], size: ScanPageSize): Promise<Uint8Array> {
  if (!pages.length) throw new Error('No pages to save.');
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const img = await doc.embedJpg(p.bytes);
    const l = scanPageLayout(p.width, p.height, size);
    doc.addPage([l.pageW, l.pageH]).drawImage(img, { x: l.x, y: l.y, width: l.w, height: l.h });
  }
  doc.setProducer('Bharat Dev Tools');
  return doc.save();
}
