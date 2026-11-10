// Watermark and page numbers. Placed on the page as the user sees it (rotation-aware). Pure.

import { PDFDocument } from '@cantoo/pdf-lib';
import { formatPageNumber, type PageNumberOptions, type WatermarkLayout } from './options';
import { FontCache, drawImageBlock, drawTextBlock, measureText, pageGeometry, type TextImager } from './draw';

// ─── Watermark ───────────────────────────────────────────────────────────────

export {
  DEFAULT_PAGE_NUMBERS, WATERMARK_PRESETS, fillWatermarkTemplate, formatPageNumber,
  type NumberFormat, type NumberPosition, type PageNumberOptions, type WatermarkLayout,
} from './options';

export interface WatermarkOptions {
  text: string;
  layout: WatermarkLayout;
  /** Font size in points. */
  size: number;
  color: string;
  /** 0–1 */
  opacity: number;
  bold: boolean;
  /** Optional logo, drawn instead of / next to the text. */
  logo?: { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; widthFraction: number };
  /** 0-based page indexes to skip. */
  skipPages?: number[];
}

export async function addWatermark(pdfBytes: Uint8Array, opts: WatermarkOptions, imager?: TextImager): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const fonts = new FontCache(doc);
  const text = opts.text.trim();
  const logo = opts.logo ? (opts.logo.mime === 'image/png' ? await doc.embedPng(opts.logo.bytes) : await doc.embedJpg(opts.logo.bytes)) : null;
  const measured = text ? await measureText(fonts, { text, size: opts.size, bold: opts.bold }, imager) : { w: 0, h: 0 };
  const skip = new Set(opts.skipPages ?? []);

  for (const [i, page] of doc.getPages().entries()) {
    if (skip.has(i)) continue;
    const { disp } = pageGeometry(page);
    const block = { size: opts.size, color: opts.color, bold: opts.bold, opacity: opts.opacity };

    // Logo: centred (or bottom/top), scaled to a fraction of the page width.
    if (logo && opts.logo) {
      const w = disp.w * opts.logo.widthFraction;
      const h = (w * logo.height) / logo.width;
      const y = opts.layout === 'bottom' ? disp.h - h - 24 : opts.layout === 'top' ? 24 : (disp.h - h) / 2 - (text ? measured.h : 0);
      await drawImageBlock(page, logo, { x: (disp.w - w) / 2, y, w, h, opacity: opts.opacity });
    }
    if (!text) continue;

    const place = async (cx: number, cy: number, angle: number) => {
      // Top-left of the block so that its centre lands on (cx, cy) after rotating by `angle`.
      const t = (angle * Math.PI) / 180;
      const dir = { x: Math.cos(t), y: -Math.sin(t) };
      const down = { x: Math.sin(t), y: Math.cos(t) };
      const x = cx - dir.x * (measured.w / 2) - down.x * (measured.h / 2);
      const y = cy - dir.y * (measured.w / 2) - down.y * (measured.h / 2);
      await drawTextBlock(doc, page, fonts, { ...block, text, x, y, angle }, imager);
    };

    const diagonal = (Math.atan2(disp.h, disp.w) * 180) / Math.PI;
    if (opts.layout === 'diagonal') {
      await place(disp.w / 2, disp.h / 2, diagonal);
    } else if (opts.layout === 'center') {
      await place(disp.w / 2, disp.h / 2, 0);
    } else if (opts.layout === 'bottom') {
      await place(disp.w / 2, disp.h - 24 - measured.h / 2, 0);
    } else if (opts.layout === 'top') {
      await place(disp.w / 2, 24 + measured.h / 2, 0);
    } else {
      // Tiled: staggered grid of 30° stamps covering the page.
      const stepX = Math.max(measured.w * 0.9 + 60, 140);
      const stepY = Math.max(measured.h * 4, 110);
      let row = 0;
      for (let y = stepY / 2; y < disp.h + stepY; y += stepY, row++) {
        for (let x = (row % 2 ? stepX / 2 : 0); x < disp.w + stepX; x += stepX) {
          await place(x, y, 30);
        }
      }
    }
  }
  return doc.save({ useObjectStreams: true });
}

// ─── Page numbers ────────────────────────────────────────────────────────────

/** `totalOverride` lets a one-page preview show the real "of N". */
export async function addPageNumbers(pdfBytes: Uint8Array, opts: PageNumberOptions, totalOverride?: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const fonts = new FontCache(doc);
  const font = (await fonts.get(false))!; // standard Helvetica: never null
  const pages = doc.getPages();
  const numbered = pages.length - (opts.skipFirst ? 1 : 0);
  const total = totalOverride ?? opts.start + numbered - 1;

  for (const [i, page] of pages.entries()) {
    if (opts.skipFirst && i === 0) continue;
    const n = opts.start + i - (opts.skipFirst ? 1 : 0);
    const text = formatPageNumber(opts.format, n, total);
    const { disp } = pageGeometry(page);
    const w = font.widthOfTextAtSize(text, opts.size);
    const [vert, horiz] = opts.position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
    const x = horiz === 'left' ? opts.margin : horiz === 'right' ? disp.w - opts.margin - w : (disp.w - w) / 2;
    const y = vert === 'top' ? opts.margin : disp.h - opts.margin - opts.size;
    await drawTextBlock(doc, page, fonts, { text, x, y, size: opts.size, color: opts.color });
  }
  return doc.save({ useObjectStreams: true });
}
