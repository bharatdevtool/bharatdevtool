// kb-edit.js — image edits for the Resize Image to KB pages: rotate, crop,
// signature clean-up and the name/date band under exam photos.
// Works on the main thread and in a module Web Worker (OffscreenCanvas).

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect  fractions 0–1 of the rotated image
 * @typedef {{
 *   rotate?: 0 | 90 | 180 | 270,
 *   crop?: Rect | null,
 *   clean?: boolean,
 *   stamp?: { name: string, date: string } | null
 * }} Edits
 */

/** @param {number} w @param {number} h */
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Largest side used while cleaning a signature (keeps memory low on phones). */
const CLEAN_MAX_SIDE = 2000;

/**
 * Make a signature or thumb impression clear: paper becomes pure white, ink gets darker
 * (keeping blue ink blue). Works in place on RGBA pixels.
 * Returns the bounding box of the ink, or null when nothing looks like ink.
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function cleanSignaturePixels(data, width, height) {
  const n = width * height;
  const hist = new Uint32Array(256);
  const lum = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    // Transparent pixels (PNG signatures) count as paper.
    const a = data[o + 3] / 255;
    const l = Math.round((0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * a + 255 * (1 - a));
    lum[i] = l;
    hist[l]++;
  }
  const percentile = (p) => {
    let acc = 0;
    const target = n * p;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  // Paper is most of the image; ink is the darkest few percent.
  const paper = percentile(0.6);
  const ink = Math.min(percentile(0.01), paper - 40);
  const hi = paper - 18; // a little darker than paper is still paper (shadows, grain)
  const span = Math.max(1, hi - ink);

  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    let t = (hi - lum[i]) / span;
    t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); // smoothstep
    if (t < 0.08) {
      data[o] = data[o + 1] = data[o + 2] = 255;
      data[o + 3] = 255;
      continue;
    }
    // Darken the ink colour so its brightness is about 40, keeping its hue.
    const f = Math.min(1, 40 / Math.max(1, lum[i]));
    data[o] = Math.round(255 * (1 - t) + data[o] * f * t);
    data[o + 1] = Math.round(255 * (1 - t) + data[o + 1] * f * t);
    data[o + 2] = Math.round(255 * (1 - t) + data[o + 2] * f * t);
    data[o + 3] = 255;
    if (t > 0.35) {
      const x = i % width;
      const y = (i - x) / width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Apply rotate → crop → clean (+ trim to the ink) and return a canvas to resize from.
 * @param {CanvasImageSource & { width: number, height: number }} src
 * @param {Edits} edits
 */
export function prepareSource(src, edits) {
  const rot = edits.rotate || 0;
  const crop = edits.crop;
  if (!rot && !crop && !edits.clean) return src;

  const rw = rot % 180 ? src.height : src.width;
  const rh = rot % 180 ? src.width : src.height;
  const c = crop && crop.w > 0 && crop.h > 0 ? crop : { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(c.x * rw), sy = Math.round(c.y * rh);
  const sw = Math.max(1, Math.round(c.w * rw)), sh = Math.max(1, Math.round(c.h * rh));
  const scale = edits.clean ? Math.min(1, CLEAN_MAX_SIDE / Math.max(sw, sh)) : 1;
  const outW = Math.max(1, Math.round(sw * scale)), outH = Math.max(1, Math.round(sh * scale));

  const canvas = makeCanvas(outW, outH);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-sx, -sy);
  // Rotate the full image clockwise into the (rw × rh) frame.
  if (rot === 90) { ctx.translate(rw, 0); ctx.rotate(Math.PI / 2); }
  else if (rot === 180) { ctx.translate(rw, rh); ctx.rotate(Math.PI); }
  else if (rot === 270) { ctx.translate(0, rh); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(src, 0, 0);
  ctx.restore();

  if (!edits.clean) return canvas;
  const img = ctx.getImageData(0, 0, outW, outH);
  const box = cleanSignaturePixels(img.data, outW, outH);
  ctx.putImageData(img, 0, 0);
  if (!box) return canvas;
  // Trim to the ink with a small margin, so the signature fills the upload box.
  const m = Math.max(4, Math.round(Math.max(box.w, box.h) * 0.06));
  const tx = Math.max(0, box.x - m), ty = Math.max(0, box.y - m);
  const tw = Math.min(outW - tx, box.w + 2 * m), th = Math.min(outH - ty, box.h + 2 * m);
  const trimmed = makeCanvas(tw, th);
  /** @type {CanvasRenderingContext2D} */ (trimmed.getContext('2d')).drawImage(canvas, tx, ty, tw, th, 0, 0, tw, th);
  return trimmed;
}

/** Height of the white name/date band for an output of height h. @param {number} h */
export function stampBandHeight(h) {
  return Math.max(14, Math.round(h * 0.16));
}

/**
 * White band with the name (upper case) and date in black, centred, at the bottom.
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} top
 * @param {number} band
 * @param {{ name: string, date: string }} stamp
 */
export function drawStamp(ctx, width, top, band, stamp) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, top, width, band);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = [stamp.name.trim().toUpperCase(), stamp.date.trim()].filter(Boolean);
  if (!lines.length) return;
  let size = Math.floor((band / lines.length) * 0.78);
  const fit = (s) => {
    ctx.font = `600 ${s}px Arial, Helvetica, sans-serif`;
    return Math.max(...lines.map((l) => ctx.measureText(l).width)) <= width * 0.94;
  };
  while (size > 6 && !fit(size)) size--;
  fit(size);
  const lineH = band / lines.length;
  lines.forEach((l, i) => ctx.fillText(l, width / 2, top + lineH * (i + 0.5)));
}
