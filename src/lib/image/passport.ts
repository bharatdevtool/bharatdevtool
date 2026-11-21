// passport.ts — passport-size photo maths (pure, no DOM): model input, head position, framing,
// background compositing. The browser side lives in passportBrowser.ts.

/** Indian passport-size photo (also most job/exam forms and Schengen visas). All values in mm. */
export const PASSPORT_PHOTO = {
  w: 35,
  h: 45,
  /** Space above the top of the head. */
  crown: 4,
  /** Top of the head to the chin. ICAO allows 32–36 mm. */
  head: 34,
  headMin: 32,
  headMax: 36,
} as const;

export type PhotoSpec = typeof PASSPORT_PHOTO;

/** Background colours offered for the photo. */
export const BACKGROUNDS = {
  white: { label: 'White', rgb: [255, 255, 255] as [number, number, number] },
  blue: { label: 'Light blue', rgb: [214, 232, 250] as [number, number, number] },
} as const;

export type BackgroundId = keyof typeof BACKGROUNDS;

/** MODNet input size: shortest side 512, both sides multiples of 32, long side capped. */
export function modnetInputSize(w: number, h: number, short = 512, maxLong = 1024): { w: number; h: number } {
  const round32 = (v: number) => Math.max(32, Math.round(v / 32) * 32);
  let scale = short / Math.min(w, h);
  if (Math.max(w, h) * scale > maxLong) scale = maxLong / Math.max(w, h);
  return { w: round32(w * scale), h: round32(h * scale) };
}

/** RGBA pixels → MODNet's NCHW float input, scaled to [-1, 1]. */
export function toModnetTensor(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const n = w * h;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4] / 127.5 - 1;
    out[n + i] = rgba[i * 4 + 1] / 127.5 - 1;
    out[2 * n + i] = rgba[i * 4 + 2] / 127.5 - 1;
  }
  return out;
}

export interface HeadBox {
  /** Top of the head (hair), in pixels. */
  crownY: number;
  /** Horizontal centre of the head. */
  centerX: number;
  /** Estimated top-of-head to chin height. */
  height: number;
}

/**
 * Find the head in a person matte (values 0–1, row-major). The top of the person is the crown;
 * going down, the outline widens to the head's full width about 0.6 widths below the crown.
 * A head is about 1.3 times as tall as it is wide. Returns null when no person is found.
 */
export function estimateHead(alpha: ArrayLike<number>, w: number, h: number, threshold = 0.5): HeadBox | null {
  const left = new Int32Array(h).fill(-1);
  const right = new Int32Array(h).fill(-1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (alpha[row + x] < threshold) continue;
      if (left[y] < 0) left[y] = x;
      right[y] = x;
    }
  }
  const minSpan = Math.max(2, w * 0.02);
  const span = (y: number) => (left[y] < 0 ? 0 : right[y] - left[y] + 1);
  let crownY = -1;
  for (let y = 0; y < h; y++) if (span(y) >= minSpan) { crownY = y; break; }
  if (crownY < 0) return null;

  let widthY = -1;
  for (let y = crownY; y < h; y++) {
    if (y - crownY >= 0.6 * span(y)) { widthY = y; break; }
  }
  if (widthY < 0) return null; // the person runs off the bottom before the head is complete
  const headW = span(widthY);
  // Centre on the upper half of the head, where hair or shoulders do not pull it sideways.
  let sum = 0;
  let rows = 0;
  for (let y = crownY + Math.round((widthY - crownY) / 3); y <= widthY; y++) {
    if (left[y] < 0) continue;
    sum += (left[y] + right[y]) / 2;
    rows++;
  }
  return { crownY, centerX: rows ? sum / rows : (left[widthY] + right[widthY]) / 2, height: headW * 1.3 };
}

/** Face detector input (Ultra-Light-Fast-Generic-Face-Detector, version RFB-320). */
export const FACE_INPUT = { w: 320, h: 240 } as const;

/** Where an image of w×h lands when fitted (letterboxed) into the detector's input. */
export function letterbox(w: number, h: number, box: { w: number; h: number } = FACE_INPUT): { scale: number; dx: number; dy: number } {
  const scale = Math.min(box.w / w, box.h / h);
  return { scale, dx: (box.w - w * scale) / 2, dy: (box.h - h * scale) / 2 };
}

/** RGBA pixels → the face detector's NCHW input: (value − 127) / 128. */
export function toFaceTensor(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const n = w * h;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = (rgba[i * 4] - 127) / 128;
    out[n + i] = (rgba[i * 4 + 1] - 127) / 128;
    out[2 * n + i] = (rgba[i * 4 + 2] - 127) / 128;
  }
  return out;
}

export interface FaceBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
}

/**
 * The main face from the detector's outputs: `scores` holds [background, face] pairs and `boxes`
 * holds normalised [x1, y1, x2, y2] per anchor. Picks the largest confident face (the person in
 * front, not someone in the background). Coordinates stay normalised to the detector input.
 */
export function pickFace(scores: ArrayLike<number>, boxes: ArrayLike<number>, minScore = 0.7): FaceBox | null {
  let best: FaceBox | null = null;
  let bestArea = 0;
  for (let i = 0, n = scores.length / 2; i < n; i++) {
    const score = scores[i * 2 + 1];
    if (score < minScore) continue;
    const b = { x1: boxes[i * 4], y1: boxes[i * 4 + 1], x2: boxes[i * 4 + 2], y2: boxes[i * 4 + 3], score };
    const area = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    if (area > bestArea * 1.2 || (area > bestArea * 0.8 && best && score > best.score)) {
      best = b;
      bestArea = Math.max(area, bestArea);
    }
  }
  return best;
}

/** A detector box (normalised to its letterboxed input) → image pixels. */
export function faceToImage(face: FaceBox, imgW: number, imgH: number, box: { w: number; h: number } = FACE_INPUT): FaceBox {
  const { scale, dx, dy } = letterbox(imgW, imgH, box);
  const x = (v: number) => (v * box.w - dx) / scale;
  const y = (v: number) => (v * box.h - dy) / scale;
  return { x1: x(face.x1), y1: y(face.y1), x2: x(face.x2), y2: y(face.y2), score: face.score };
}

/**
 * Head from a face box (image pixels) and the person matte at the same size: the chin is near
 * the bottom of the face box, and the top of the hair is where the matte ends above the face.
 */
export function headFromFace(face: FaceBox, alpha: ArrayLike<number> | null, w: number, h: number, threshold = 0.5): HeadBox {
  const faceW = face.x2 - face.x1;
  const faceH = face.y2 - face.y1;
  const chin = face.y2 + faceH * CHIN_BELOW_BOX;
  let crownY = face.y1 - faceH * 0.3; // fallback without a matte: typical forehead and hair
  if (alpha) {
    const from = Math.max(0, Math.round(face.x1 + faceW * 0.3));
    const to = Math.min(w - 1, Math.round(face.x2 - faceW * 0.3));
    let y = Math.min(h - 1, Math.max(0, Math.round(face.y1)));
    const covered = (row: number) => {
      for (let x = from; x <= to; x++) if (alpha[row * w + x] >= threshold) return true;
      return false;
    };
    while (y > 0 && covered(y - 1)) y--;
    crownY = y;
  }
  return { crownY, centerX: (face.x1 + face.x2) / 2, height: Math.max(1, chin - crownY) };
}

/** The detector's box ends a little above the chin: share of the box height to add below it. */
export const CHIN_BELOW_BOX = 0;

export interface Frame {
  /** Crop rectangle in source pixels; may reach outside the image (filled with the background). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The crop that puts the head at the spec's size and place: crown `spec.crown` mm from the top. */
export function frameForHead(head: HeadBox, spec: PhotoSpec = PASSPORT_PHOTO): Frame {
  const pxPerMm = head.height / spec.head;
  const w = spec.w * pxPerMm;
  const h = spec.h * pxPerMm;
  return { x: head.centerX - w / 2, y: head.crownY - spec.crown * pxPerMm, w, h };
}

/** A centred crop of the spec's shape covering most of the image, when no head was found. */
export function defaultFrame(imgW: number, imgH: number, spec: PhotoSpec = PASSPORT_PHOTO): Frame {
  const aspect = spec.w / spec.h;
  const h = Math.min(imgH, imgW / aspect) * 0.9;
  const w = h * aspect;
  return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

/** Blend the person over a plain colour: out = pixel·alpha + background·(1 − alpha). In place. */
export function compositeOnColor(rgba: Uint8ClampedArray, alpha: ArrayLike<number>, rgb: readonly [number, number, number]): Uint8ClampedArray {
  for (let i = 0, n = alpha.length; i < n; i++) {
    const a = Math.min(1, Math.max(0, alpha[i]));
    const p = i * 4;
    rgba[p] = rgba[p] * a + rgb[0] * (1 - a);
    rgba[p + 1] = rgba[p + 1] * a + rgb[1] * (1 - a);
    rgba[p + 2] = rgba[p + 2] * a + rgb[2] * (1 - a);
    rgba[p + 3] = 255;
  }
  return rgba;
}
