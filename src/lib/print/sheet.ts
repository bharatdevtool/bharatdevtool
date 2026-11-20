// sheet.ts — print-sheet layout maths for ID cards and photos (pure, no DOM).
// All values are millimetres with the origin at the TOP-LEFT of the paper.

export const MM_TO_PT = 72 / 25.4;

export type PaperId = 'a4' | '4x6' | 'letter';

export interface Size {
  w: number;
  h: number;
}

export const PAPERS: Record<PaperId, Size & { label: string }> = {
  a4: { w: 210, h: 297, label: 'A4' },
  '4x6': { w: 101.6, h: 152.4, label: '4×6 in' },
  letter: { w: 215.9, h: 279.4, label: 'Letter' },
};

/** ISO/IEC 7810 ID-1: Aadhaar PVC, PAN, voter ID, driving licence, ATM cards. */
export const ID_CARD: Size = { w: 85.6, h: 54 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** cut: thin solid guide; fold: dashed line to fold along */
  kind: 'cut' | 'fold';
}

export interface CardSlot {
  row: number;
  side: 'front' | 'back';
  rect: Rect;
}

export interface CardSheet {
  paper: Size;
  slots: CardSlot[];
  lines: SheetLine[];
  /** Horizontal line that must print exactly `length` mm long at 100% scale. */
  scale: { x: number; y: number; length: number };
}

export type CardLayoutMode = 'fold' | 'cut';

export interface CardSheetOptions {
  paper?: PaperId;
  /** fold: front and back touch along a fold line (cut out the pair, fold, laminate). cut: a gap between them. */
  mode?: CardLayoutMode;
  /** Number of cards (rows). Clamped to what fits on the paper. */
  rows?: number;
  card?: Size;
  /** Printer-safe margin on every side (most printers can't print the outer 4–5 mm). */
  margin?: number;
  /** Space between rows, and between front and back in cut mode. */
  gap?: number;
}

const SCALE_LENGTH = 50;
/** Room reserved at the bottom for the 50 mm scale line and its label. */
const SCALE_BAND = 10;

/** Largest number of card rows that fit on the paper. */
export function maxCardRows(opts: CardSheetOptions = {}): number {
  const paper = PAPERS[opts.paper ?? 'a4'];
  const card = opts.card ?? ID_CARD;
  const margin = opts.margin ?? 10;
  const gap = opts.gap ?? 8;
  const usable = paper.h - 2 * margin - SCALE_BAND;
  return Math.max(0, Math.floor((usable + gap) / (card.h + gap)));
}

/**
 * Rows of [front | back] card pairs, centred horizontally, from the top margin down.
 * Default: A4, fold & laminate, 4 rows — four different cards on one sheet.
 */
export function cardSheet(opts: CardSheetOptions = {}): CardSheet {
  const paper = PAPERS[opts.paper ?? 'a4'];
  const mode = opts.mode ?? 'fold';
  const card = opts.card ?? ID_CARD;
  const margin = opts.margin ?? 10;
  const gap = opts.gap ?? 8;
  const middle = mode === 'fold' ? 0 : gap;
  const pairW = card.w * 2 + middle;
  if (pairW > paper.w - 2 * margin) throw new Error('A front and back pair does not fit across this paper.');

  const rows = Math.min(Math.max(1, Math.round(opts.rows ?? 4)), maxCardRows(opts));
  if (rows < 1) throw new Error('No card fits on this paper.');
  const left = (paper.w - pairW) / 2;
  const slots: CardSlot[] = [];
  const lines: SheetLine[] = [];
  const box = (r: Rect) => {
    lines.push(
      { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, kind: 'cut' },
      { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, kind: 'cut' },
      { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h, kind: 'cut' },
      { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, kind: 'cut' },
    );
  };

  for (let row = 0; row < rows; row++) {
    const y = margin + row * (card.h + gap);
    const front: Rect = { x: left, y, w: card.w, h: card.h };
    const back: Rect = { x: left + card.w + middle, y, w: card.w, h: card.h };
    slots.push({ row, side: 'front', rect: front }, { row, side: 'back', rect: back });
    if (mode === 'fold') {
      box({ x: left, y, w: pairW, h: card.h });
      lines.push({ x1: left + card.w, y1: y, x2: left + card.w, y2: y + card.h, kind: 'fold' });
    } else {
      box(front);
      box(back);
    }
  }

  return { paper: { w: paper.w, h: paper.h }, slots, lines, scale: { x: margin, y: paper.h - margin - 3, length: SCALE_LENGTH } };
}

/** Millimetres → PDF points. */
export const mmToPt = (mm: number) => mm * MM_TO_PT;

/** Millimetres → pixels at a given DPI (300 for print). */
export const mmToPx = (mm: number, dpi = 300) => Math.round((mm / 25.4) * dpi);
