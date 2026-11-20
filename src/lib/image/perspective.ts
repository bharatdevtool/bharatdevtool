// perspective.ts — 4-corner perspective correction ("straighten a photo of a card or page").
// The maths and warpPixels are pure (tested in Node); warpCanvas / loadImageCanvas need a browser.

export interface Point {
  x: number;
  y: number;
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Solve A·x = b (n×n) by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) throw new Error('These corners do not form a usable shape.');
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** 3×3 homography H (row-major, h33 = 1) that maps each `from[i]` onto `to[i]`. */
export function homography(from: Quad, to: Quad): number[] {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(a, b), 1];
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Starting corners: the image inset by `inset` (fraction of each side). */
export function defaultQuad(width: number, height: number, inset = 0.06): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/**
 * Output size for a quad when the shape is not fixed: average edge lengths,
 * capped so the longer side is at most `maxSide` pixels.
 */
export function quadSize(q: Quad, maxSide = 2400): { w: number; h: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const w = (d(q[0], q[1]) + d(q[3], q[2])) / 2;
  const h = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  const k = Math.min(1, maxSide / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Put any four points in TL, TR, BR, BL order (for detected corners). */
export function orderQuad(points: Point[]): Quad {
  if (points.length !== 4) throw new Error('Need exactly four corners.');
  const bySum = [...points].sort((p, q) => p.x + p.y - (q.x + q.y));
  const byDiff = [...points].sort((p, q) => p.y - p.x - (q.y - q.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/**
 * Warp the area inside `quad` of `src` into an outW×outH rectangle (bilinear sampling).
 * Pixel centres are at +0.5, so a quad covering the whole image reproduces it exactly.
 */
export function warpPixels(src: Pixels, quad: Quad, outW: number, outH: number): Pixels {
  const dst: Quad = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  const h = homography(dst, quad); // output → source
  const out = new Uint8ClampedArray(outW * outH * 4);
  const { width: sw, height: sh, data } = src;
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      const p = applyHomography(h, { x: i + 0.5, y: j + 0.5 });
      const fx = Math.min(Math.max(p.x - 0.5, 0), sw - 1);
      const fy = Math.min(Math.max(p.y - 0.5, 0), sh - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const o = (j * outW + i) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[(y0 * sw + x0) * 4 + c] * (1 - tx) + data[(y0 * sw + x1) * 4 + c] * tx;
        const bottom = data[(y1 * sw + x0) * 4 + c] * (1 - tx) + data[(y1 * sw + x1) * 4 + c] * tx;
        out[o + c] = Math.round(top * (1 - ty) + bottom * ty);
      }
    }
  }
  return { width: outW, height: outH, data: out };
}

/** Browser: straighten `quad` of a canvas into a new outW×outH canvas. */
export function warpCanvas(source: HTMLCanvasElement, quad: Quad, outW: number, outH: number): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const warped = warpPixels(ctx.getImageData(0, 0, source.width, source.height), quad, outW, outH);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d')!;
  const image = octx.createImageData(outW, outH);
  image.data.set(warped.data);
  octx.putImageData(image, 0, 0);
  return out;
}

/** Browser: rotate a canvas 90° clockwise. */
export function rotateCanvas90(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.height;
  out.height = source.width;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return out;
}

/** Browser: decode an image file (EXIF rotation applied) into a canvas no larger than maxSide. */
export async function loadImageCanvas(file: Blob, maxSide = 3000): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
