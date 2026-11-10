// image-utils.js — shared helpers for the static image tools.
// ES module; works on the main thread and inside a module Web Worker
// (no DOM access except where a canvas fallback is needed).

import { fitToSize, padJpeg, kbRangeToBytes } from './target-size.js';
import { prepareSource, stampBandHeight, drawStamp } from './kb-edit.js';

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Where to draw a source image inside an output box.
 * - cover: fill the box, cropping the overflow (centred)
 * - contain: fit inside the box, padding with the background colour
 * - stretch: ignore aspect ratio
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} outW
 * @param {number} outH
 * @param {'cover' | 'contain' | 'stretch'} fit
 */
export function computeFrame(srcW, srcH, outW, outH, fit) {
  if (fit === 'stretch') return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: outW, dh: outH };
  const srcRatio = srcW / srcH;
  const outRatio = outW / outH;
  if (fit === 'cover') {
    if (srcRatio > outRatio) {
      const sw = srcH * outRatio;
      return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH, dx: 0, dy: 0, dw: outW, dh: outH };
    }
    const sh = srcW / outRatio;
    return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh, dx: 0, dy: 0, dw: outW, dh: outH };
  }
  // contain
  if (srcRatio > outRatio) {
    const dh = outW / srcRatio;
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: (outH - dh) / 2, dw: outW, dh };
  }
  const dw = outH * srcRatio;
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (outW - dw) / 2, dy: 0, dw, dh: outH };
}

/**
 * Scale (w, h) down so the longest side is at most `maxSide`.
 * @param {number} w
 * @param {number} h
 * @param {number} maxSide
 */
export function capSize(w, h, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** @param {number} w @param {number} h */
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * @param {OffscreenCanvas | HTMLCanvasElement} canvas
 * @param {string} type
 * @param {number} [quality]
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, type, quality) {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))), type, quality);
  });
}

/**
 * Draw an image onto a fresh canvas. JPEG has no transparency, so callers
 * that export JPEG pass a background colour (transparent pixels would
 * otherwise turn black).
 * @param {CanvasImageSource & { width: number, height: number }} source
 * @param {number} outW
 * @param {number} outH
 * @param {{ fit?: 'cover' | 'contain' | 'stretch', background?: string | null }} [opts]
 */
export function drawImage(source, outW, outH, opts = {}) {
  const { fit = 'stretch', background = '#ffffff' } = opts;
  const canvas = makeCanvas(outW, outH);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const f = computeFrame(source.width, source.height, outW, outH, fit);
  ctx.drawImage(source, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
  return canvas;
}

/**
 * Like drawImage, plus an optional white name/date band at the bottom: the picture
 * fills the area above the band.
 * @param {CanvasImageSource & { width: number, height: number }} source
 * @param {number} outW
 * @param {number} outH
 * @param {'cover' | 'contain' | 'stretch'} fit
 * @param {{ name: string, date: string } | null | undefined} stamp
 */
export function drawOutput(source, outW, outH, fit, stamp) {
  if (!stamp) return drawImage(source, outW, outH, { fit });
  const band = stampBandHeight(outH);
  const imgH = Math.max(1, outH - band);
  const canvas = makeCanvas(outW, outH);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const f = computeFrame(source.width, source.height, outW, imgH, fit);
  ctx.drawImage(source, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
  drawStamp(ctx, outW, imgH, band, stamp);
  return canvas;
}

/**
 * Largest box with width/height = aspect inside (w × h): the centre crop for a required photo shape.
 * @param {number} w @param {number} h @param {number} aspect
 */
export function aspectBox(w, h, aspect) {
  return w / h > aspect ? { width: Math.round(h * aspect), height: h } : { width: w, height: Math.round(w / aspect) };
}

/**
 * Decode a file into a bitmap, honouring EXIF orientation (phone photos).
 * @param {Blob} file
 */
export async function loadBitmap(file) {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Largest side used when a preset gives no pixel size; keeps encoding fast. */
export const DEFAULT_MAX_SIDE = 2000;

/**
 * @typedef {{
 *   minKB: number, maxKB: number,
 *   width?: number, height?: number,
 *   fit?: 'cover' | 'contain' | 'none',
 *   aspect?: number,
 *   maxSide?: number,
 *   edits?: import('./kb-edit.js').Edits
 * }} SizeJob
 * `aspect` (width/height) crops to that shape when no exact pixel size is given.
 * `edits` are applied first: rotate, crop, signature clean-up; `edits.stamp` adds the name/date band.
 */

/**
 * Resize/compress one image to a JPEG inside [minKB, maxKB].
 * With width/height the output has exactly that pixel size (cover or contain);
 * without, the aspect ratio is kept and pixels shrink only as needed.
 * @param {Blob} file
 * @param {SizeJob} job
 */
export async function processToKB(file, job) {
  const bitmap = await loadBitmap(file);
  try {
    const edits = job.edits || {};
    const source = prepareSource(bitmap, edits);
    const stamp = edits.stamp && (edits.stamp.name.trim() || edits.stamp.date.trim()) ? edits.stamp : null;
    const hasBox = Boolean(job.width && job.height);
    /** @type {{ width: number, height: number }} */
    let start;
    /** @type {'cover' | 'contain' | 'stretch'} */
    let fit;
    if (hasBox) {
      start = { width: /** @type {number} */ (job.width), height: /** @type {number} */ (job.height) };
      fit = job.fit && job.fit !== 'none' ? job.fit : 'stretch';
    } else {
      const shape = job.aspect ? aspectBox(source.width, source.height, job.aspect) : { width: source.width, height: source.height };
      // With a name/date band, the output is taller so the picture keeps its shape above the band.
      start = capSize(shape.width, stamp ? Math.round(shape.height / 0.84) : shape.height, job.maxSide || DEFAULT_MAX_SIDE);
      fit = job.aspect ? 'cover' : 'stretch';
    }
    const { minBytes, maxBytes } = kbRangeToBytes(job.minKB, job.maxKB);

    // Draw once per pixel size; only re-encode for each quality step.
    /** @type {{ key: string, canvas: OffscreenCanvas | HTMLCanvasElement } | null} */
    let cached = null;
    /** @param {number} w @param {number} h @param {number} q */
    const encode = (w, h, q) => {
      const key = w + 'x' + h;
      if (!cached || cached.key !== key) cached = { key, canvas: drawOutput(source, w, h, fit, stamp) };
      return canvasToBlob(cached.canvas, 'image/jpeg', q);
    };

    const fitted = await fitToSize({ ...start, minBytes, maxBytes, fixedSize: hasBox, encode });
    if (!fitted.ok) return { ok: /** @type {const} */ (false), reason: fitted.reason };

    let blob = fitted.result;
    if (fitted.padToBytes > blob.size) {
      const padded = padJpeg(new Uint8Array(await blob.arrayBuffer()), fitted.padToBytes);
      blob = new Blob([padded], { type: 'image/jpeg' });
    }
    return {
      ok: /** @type {const} */ (true),
      blob,
      width: fitted.width,
      height: fitted.height,
      quality: fitted.quality,
      padded: fitted.padToBytes > 0,
      stamped: Boolean(stamp),
    };
  } finally {
    bitmap.close();
  }
}

// ── ZIP (store only; JPEGs don't compress further) ─────────────────────────

/** @type {Uint32Array | null} */
let crcTable = null;

/** @param {Uint8Array} data */
export function crc32(data) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build an uncompressed ZIP archive.
 * @param {{ name: string, data: Uint8Array }[]} files
 * @returns {Uint8Array}
 */
export function createZip(files) {
  const enc = new TextEncoder();
  /** @type {Uint8Array[]} */
  const parts = [];
  /** @type {Uint8Array[]} */
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, file.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/**
 * Save a blob with the given file name.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
