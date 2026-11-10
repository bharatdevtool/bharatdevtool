// Draw text and images on a PDF page using DISPLAY coordinates (points from the top-left of the
// page as the user sees it). Handles page rotation and non-Latin text. Pure: the browser-only
// text renderer is passed in.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb, type PDFImage } from '@cantoo/pdf-lib';
import { asRotation, displayPointsToPdf, displaySize, type PdfBox } from './geometry';

/**
 * Renders text the PDF standard fonts can't encode (Hindi, ₹, emoji…) to a PNG.
 * The browser shapes every script correctly, so this is used as a fallback.
 */
export type TextImager = (
  text: string,
  sizePt: number,
  color: string,
  bold: boolean,
  /** CSS font-family to draw with (custom fonts); default is the Helvetica-like stack. */
  cssFont?: string,
) => Promise<{ png: Uint8Array; widthPt: number; heightPt: number }>;

// First baseline below the block top, matching an HTML box with line-height 1.2:
// half-leading (1.2 - ascent 0.718 - descent 0.207) / 2 + ascent 0.718 ≈ 0.856 em.
export const ASCENT = 0.856;
export const LINE_HEIGHT = 1.2;

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

export function pageGeometry(page: PDFPage): { box: PdfBox; rotation: ReturnType<typeof asRotation>; disp: { w: number; h: number } } {
  const c = page.getCropBox();
  const box = { x: c.x, y: c.y, w: c.width, h: c.height };
  const rotation = asRotation(page.getRotation().angle);
  return { box, rotation, disp: displaySize(box, rotation) };
}

export type FontFamily = 'sans' | 'serif' | 'mono';

/** Custom font files by font key (see lib/pdf/fonts). Requires doc.registerFontkit(). */
export type CustomFonts = Record<string, { regular: Uint8Array; bold?: Uint8Array }>;

/** The 12 standard PDF fonts: [family][bold][italic]. Every viewer has them, so nothing is embedded. */
const STANDARD: Record<FontFamily, [[StandardFonts, StandardFonts], [StandardFonts, StandardFonts]]> = {
  sans: [[StandardFonts.Helvetica, StandardFonts.HelveticaOblique], [StandardFonts.HelveticaBold, StandardFonts.HelveticaBoldOblique]],
  serif: [[StandardFonts.TimesRoman, StandardFonts.TimesRomanItalic], [StandardFonts.TimesRomanBold, StandardFonts.TimesRomanBoldItalic]],
  mono: [[StandardFonts.Courier, StandardFonts.CourierOblique], [StandardFonts.CourierBold, StandardFonts.CourierBoldOblique]],
};

export class FontCache {
  private cache = new Map<string, PDFFont | null>();
  constructor(private doc: PDFDocument, private custom: CustomFonts = {}) {}

  /** A standard font, or the custom font for this key (null when it can't be embedded). */
  async get(bold: boolean, family: string = 'sans', italic = false): Promise<PDFFont | null> {
    if (!(family in STANDARD)) {
      const files = this.custom[family];
      if (!files) return null;
      const key = `${family}|${bold && files.bold ? 'b' : 'r'}`;
      if (!this.cache.has(key)) {
        try {
          // Subset: only the letters used are stored, so files stay small.
          this.cache.set(key, await this.doc.embedFont(bold && files.bold ? files.bold : files.regular, { subset: true }));
        } catch {
          this.cache.set(key, null);
        }
      }
      return this.cache.get(key)!;
    }
    const name = STANDARD[family as FontFamily][bold ? 1 : 0][italic ? 1 : 0];
    let f = this.cache.get(name);
    if (!f) {
      f = await this.doc.embedFont(name);
      this.cache.set(name, f);
    }
    return f!;
  }
}

const charsets = new WeakMap<PDFFont, Set<number>>();

/** True when every character can be written with the standard (WinAnsi) font. */
export function canEncode(font: PDFFont, text: string): boolean {
  let set = charsets.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsets.set(font, set);
  }
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') continue;
    if (!set.has(ch.codePointAt(0)!)) return false;
  }
  return true;
}

/** Unit vectors in display space (y down) for a text angle (degrees, counter-clockwise as seen). */
function axes(angleDeg: number) {
  const t = (angleDeg * Math.PI) / 180;
  return { dir: { x: Math.cos(t), y: -Math.sin(t) }, down: { x: Math.sin(t), y: Math.cos(t) } };
}

export interface TextBlock {
  text: string;
  /** Top-left of the text block in display points. */
  x: number;
  y: number;
  size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  /** 'sans' | 'serif' | 'mono' or a custom font key. */
  family?: string;
  /** CSS font-family for the image fallback (custom fonts). */
  cssFont?: string;
  opacity?: number;
  /** Counter-clockwise angle as seen on screen. */
  angle?: number;
}

/** Measure a text block (width of the longest line, height of all lines) in points. */
export async function measureText(fonts: FontCache, block: Pick<TextBlock, 'text' | 'size' | 'bold' | 'italic' | 'family' | 'cssFont'>, imager?: TextImager) {
  const font = await fonts.get(!!block.bold, block.family, !!block.italic);
  const lines = block.text.split('\n');
  if (font && lines.every((l) => canEncode(font, l))) {
    const w = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, block.size)));
    return { w, h: lines.length * block.size * LINE_HEIGHT };
  }
  if (!imager) return { w: block.text.length * block.size * 0.55, h: lines.length * block.size * LINE_HEIGHT };
  const img = await imager(block.text, block.size, '#000000', !!block.bold, block.cssFont);
  return { w: img.widthPt, h: img.heightPt };
}

/** Draw a (multi-line) text block. Real PDF text when possible, otherwise an image of the text. */
export async function drawTextBlock(doc: PDFDocument, page: PDFPage, fonts: FontCache, block: TextBlock, imager?: TextImager) {
  const { box, rotation } = pageGeometry(page);
  const angle = block.angle ?? 0;
  const { down } = axes(angle);
  const font = await fonts.get(!!block.bold, block.family, !!block.italic);
  const lines = block.text.split('\n');
  const color = hexToRgb(block.color);
  const opacity = block.opacity ?? 1;

  if (font && lines.every((l) => canEncode(font, l))) {
    lines.forEach((line, i) => {
      if (!line) return;
      const off = block.size * (ASCENT + i * LINE_HEIGHT); // baseline distance from block top
      const p = displayPointsToPdf(block.x + down.x * off, block.y + down.y * off, box, rotation);
      page.drawText(line, { x: p.x, y: p.y, size: block.size, font, color, opacity, rotate: degrees(angle + rotation) });
    });
    return;
  }
  if (!imager) throw new Error('This text needs characters the PDF font does not have.');
  const img = await imager(block.text, block.size, block.color, !!block.bold, block.cssFont);
  await drawImageBlock(page, await doc.embedPng(img.png), { x: block.x, y: block.y, w: img.widthPt, h: img.heightPt, angle, opacity });
}

export interface ImageBlock {
  /** Top-left in display points. */
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  opacity?: number;
}

export async function drawImageBlock(page: PDFPage, image: PDFImage, b: ImageBlock) {
  const { box, rotation } = pageGeometry(page);
  const angle = b.angle ?? 0;
  const { down } = axes(angle);
  // pdf-lib anchors images at their bottom-left corner.
  const p = displayPointsToPdf(b.x + down.x * b.h, b.y + down.y * b.h, box, rotation);
  page.drawImage(image, { x: p.x, y: p.y, width: b.w, height: b.h, rotate: degrees(angle + rotation), opacity: b.opacity ?? 1 });
}

/** Axis-aligned rectangle in display points. */
export function drawRectBlock(
  page: PDFPage,
  r: { x: number; y: number; w: number; h: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number },
) {
  const { box, rotation } = pageGeometry(page);
  const a = displayPointsToPdf(r.x, r.y, box, rotation);
  const b = displayPointsToPdf(r.x + r.w, r.y + r.h, box, rotation);
  page.drawRectangle({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
    color: r.fill ? hexToRgb(r.fill) : undefined,
    borderColor: r.stroke ? hexToRgb(r.stroke) : undefined,
    borderWidth: r.stroke ? (r.strokeWidth ?? 1.5) : 0,
    opacity: r.fill ? (r.opacity ?? 1) : undefined,
    borderOpacity: r.stroke ? (r.opacity ?? 1) : undefined,
  });
}

/** Axis-aligned ellipse inside a box in display points (outline or filled). */
export function drawEllipseBlock(
  page: PDFPage,
  r: { x: number; y: number; w: number; h: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number },
) {
  const { box, rotation } = pageGeometry(page);
  const a = displayPointsToPdf(r.x, r.y, box, rotation);
  const b = displayPointsToPdf(r.x + r.w, r.y + r.h, box, rotation);
  page.drawEllipse({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    xScale: Math.abs(b.x - a.x) / 2,
    yScale: Math.abs(b.y - a.y) / 2,
    color: r.fill ? hexToRgb(r.fill) : undefined,
    borderColor: r.stroke ? hexToRgb(r.stroke) : undefined,
    borderWidth: r.stroke ? (r.strokeWidth ?? 1.5) : 0,
    opacity: r.opacity ?? 1,
    borderOpacity: r.opacity ?? 1,
  });
}

/** Two short strokes at (x2, y2) pointing along the line from (x1, y1). Display points. */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, width: number) {
  const len = Math.max(7, width * 5);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const spread = (28 * Math.PI) / 180;
  return [ang - spread, ang + spread].map((a) => ({ x: x2 - len * Math.cos(a), y: y2 - len * Math.sin(a) }));
}

/** Tick, cross and dot strokes inside a box, as fractions of the box (for drawing and on screen). */
export const MARK_STROKES: Record<'check' | 'cross', [number, number][][]> = {
  check: [[[0.14, 0.55], [0.4, 0.8], [0.88, 0.18]]],
  cross: [[[0.18, 0.18], [0.82, 0.82]], [[0.82, 0.18], [0.18, 0.82]]],
};

export function drawLineBlock(page: PDFPage, l: { x1: number; y1: number; x2: number; y2: number; color: string; width: number; opacity?: number }) {
  const { box, rotation } = pageGeometry(page);
  const a = displayPointsToPdf(l.x1, l.y1, box, rotation);
  const b = displayPointsToPdf(l.x2, l.y2, box, rotation);
  page.drawLine({ start: a, end: b, thickness: l.width, color: hexToRgb(l.color), opacity: l.opacity ?? 1 });
}
