// Map positions on the page as the user SEES it (rotation applied, origin top-left,
// u/v as fractions 0..1) to PDF user space (origin bottom-left, unrotated). Pure.

export interface PdfBox {
  /** Crop box in PDF points. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export function asRotation(deg: number): Rotation {
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rotation;
}

/** Size of the page as displayed, in points. */
export function displaySize(box: PdfBox, rotation: Rotation): { w: number; h: number } {
  return rotation % 180 === 0 ? { w: box.w, h: box.h } : { w: box.h, h: box.w };
}

/** Displayed fraction (u right, v down) → PDF point. */
export function toPdfPoint(u: number, v: number, box: PdfBox, rotation: Rotation): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x: box.x + u * box.w, y: box.y + (1 - v) * box.h };
    case 90:
      return { x: box.x + v * box.w, y: box.y + u * box.h };
    case 180:
      return { x: box.x + (1 - u) * box.w, y: box.y + v * box.h };
    case 270:
      return { x: box.x + (1 - v) * box.w, y: box.y + (1 - u) * box.h };
  }
}

/** Displayed rectangle (fractions) → axis-aligned PDF rectangle. */
export function toPdfRect(u: number, v: number, w: number, h: number, box: PdfBox, rotation: Rotation) {
  const a = toPdfPoint(u, v, box, rotation);
  const b = toPdfPoint(u + w, v + h, box, rotation);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/**
 * Point given in displayed POINTS from the top-left → PDF point.
 * Handy for text layout, where sizes are in points.
 */
export function displayPointsToPdf(px: number, py: number, box: PdfBox, rotation: Rotation) {
  const d = displaySize(box, rotation);
  return toPdfPoint(px / d.w, py / d.h, box, rotation);
}
