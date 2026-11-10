// target-size.js — find a JPEG encoding whose file size lands inside a KB range.
//
// Pure search logic: the encoder is injected, so the same code runs in a Web
// Worker, on the main thread, or in unit tests with a fake encoder.

/** Highest quality tried in the normal search; 1.0 is only used to reach a minimum size. */
export const MAX_QUALITY = 0.92;
/** Below this, JPEG artefacts get ugly, so we shrink pixels instead (when allowed). */
export const QUALITY_FLOOR = 0.35;
/** Last-resort floor when the pixel size is fixed and can't be reduced. */
export const FIXED_SIZE_QUALITY_FLOOR = 0.05;

/**
 * Portals differ on whether 1 KB is 1000 or 1024 bytes. Use the stricter one on
 * each side so the file passes either way: max in 1000s, min in 1024s.
 * @param {number} minKB
 * @param {number} maxKB
 * @returns {{ minBytes: number, maxBytes: number }}
 */
export function kbRangeToBytes(minKB, maxKB) {
  const maxBytes = Math.floor(maxKB * 1000) - 256;
  const minBytes = minKB > 0 ? Math.ceil(minKB * 1024) + 256 : 0;
  if (minBytes > maxBytes) {
    // Range too tight for the safety margins (e.g. 49–50 KB): fall back to the raw bounds.
    return { minBytes: Math.ceil(minKB * 1000), maxBytes: Math.floor(maxKB * 1000) };
  }
  return { minBytes, maxBytes };
}

/**
 * @template {{ size: number }} R
 * @typedef {(width: number, height: number, quality: number) => Promise<R>} Encoder
 */

/**
 * @template {{ size: number }} R
 * @typedef {{
 *   ok: true, result: R, width: number, height: number, quality: number,
 *   padToBytes: number
 * } | { ok: false, reason: 'too-large' }} FitResult
 */

/**
 * Search for the best-looking encoding whose size is ≤ maxBytes and ≥ minBytes.
 *
 * 1. Try the highest quality. If it fits, stop (raising to 1.0 or asking for
 *    padding if it is under the minimum).
 * 2. If even the quality floor is too big, scale the pixels down by
 *    √(max / size) and repeat — unless the pixel size is fixed.
 * 3. Otherwise binary-search quality between the floor and the max.
 *
 * @template {{ size: number }} R
 * @param {{
 *   width: number, height: number, minBytes?: number, maxBytes: number,
 *   fixedSize?: boolean, encode: Encoder<R>, maxRounds?: number, searchSteps?: number
 * }} opts
 * @returns {Promise<FitResult<R>>}
 */
export async function fitToSize(opts) {
  const { minBytes = 0, maxBytes, fixedSize = false, encode, maxRounds = 8, searchSteps = 7 } = opts;
  let width = Math.max(1, Math.round(opts.width));
  let height = Math.max(1, Math.round(opts.height));

  for (let round = 0; round < maxRounds; round++) {
    const top = await encode(width, height, MAX_QUALITY);

    if (top.size <= maxBytes) {
      if (top.size >= minBytes) return done(top, MAX_QUALITY);
      // Under the minimum: best quality first, then pad the file.
      const full = await encode(width, height, 1);
      if (full.size <= maxBytes && full.size >= minBytes) return done(full, 1);
      const base = full.size <= maxBytes ? { r: full, q: 1 } : { r: top, q: MAX_QUALITY };
      return done(base.r, base.q, padTarget(minBytes, maxBytes));
    }

    const floor = fixedSize ? FIXED_SIZE_QUALITY_FLOOR : QUALITY_FLOOR;
    const low = await encode(width, height, floor);

    if (low.size > maxBytes) {
      if (fixedSize) return { ok: false, reason: 'too-large' };
      const scale = Math.sqrt(maxBytes / low.size) * 0.92;
      const nextW = Math.max(1, Math.floor(width * scale));
      const nextH = Math.max(1, Math.floor(height * scale));
      if (nextW === width && nextH === height) return { ok: false, reason: 'too-large' };
      width = nextW;
      height = nextH;
      continue;
    }

    // low fits, top doesn't: binary-search the highest quality that fits.
    let lo = floor;
    let hi = MAX_QUALITY;
    let best = low;
    let bestQ = floor;
    for (let i = 0; i < searchSteps; i++) {
      const mid = (lo + hi) / 2;
      const r = await encode(width, height, mid);
      if (r.size <= maxBytes) {
        best = r;
        bestQ = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return done(best, bestQ, best.size < minBytes ? padTarget(minBytes, maxBytes) : 0);
  }
  return { ok: false, reason: 'too-large' };

  /**
   * @param {R} result
   * @param {number} quality
   * @param {number} [padToBytes]
   * @returns {FitResult<R>}
   */
  function done(result, quality, padToBytes = 0) {
    return { ok: true, result, width, height, quality: Math.round(quality * 100) / 100, padToBytes };
  }
}

/**
 * Aim a little above the minimum, never above the maximum.
 * @param {number} minBytes
 * @param {number} maxBytes
 */
function padTarget(minBytes, maxBytes) {
  return Math.min(maxBytes, minBytes + 512);
}

/**
 * Grow a JPEG to at least `targetBytes` by inserting comment (COM) segments
 * right after the start-of-image marker. The picture is untouched; decoders
 * skip COM segments. Used when a portal demands a minimum file size.
 * @param {Uint8Array} bytes
 * @param {number} targetBytes
 * @returns {Uint8Array}
 */
export function padJpeg(bytes, targetBytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG');
  let missing = targetBytes - bytes.length;
  if (missing <= 0) return bytes;

  const segments = [];
  while (missing > 0) {
    // Each segment: FF FE + 2-byte length (counts itself) + payload (max 65533).
    const payload = Math.min(65533, Math.max(0, missing - 4));
    const seg = new Uint8Array(4 + payload);
    seg[0] = 0xff;
    seg[1] = 0xfe;
    seg[2] = ((payload + 2) >> 8) & 0xff;
    seg[3] = (payload + 2) & 0xff;
    seg.fill(0x20, 4); // spaces
    segments.push(seg);
    missing -= seg.length;
  }

  const out = new Uint8Array(bytes.length + segments.reduce((n, s) => n + s.length, 0));
  out.set(bytes.subarray(0, 2), 0);
  let offset = 2;
  for (const seg of segments) {
    out.set(seg, offset);
    offset += seg.length;
  }
  out.set(bytes.subarray(2), offset);
  return out;
}
