// PDF compression. Pure: the browser parts (decoding/encoding images, rendering pages)
// are passed in, so this logic runs and is tested in Node.

import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDict } from '@cantoo/pdf-lib';
import type { KeepTextLevel } from './shared';

// ─── Mode 1: "Keep text" — recompress the JPEG photos inside the PDF ─────────────

export interface ReencodeRequest {
  /** Original JPEG bytes (DCTDecode stream). */
  jpeg: Uint8Array;
  width: number;
  height: number;
  /** Longest side allowed in the output, in pixels. */
  maxSide: number;
  /** JPEG quality 0–1. */
  quality: number;
}

/** Returns new JPEG bytes and size, or null to keep the original. */
export type JpegReencoder = (req: ReencodeRequest) => Promise<{ bytes: Uint8Array; width: number; height: number } | null>;

export interface KeepTextOptions {
  quality: number;
  maxSide: number;
}

export const KEEP_TEXT_LEVELS: Record<KeepTextLevel, KeepTextOptions> = {
  light: { quality: 0.82, maxSide: 2400 },
  balanced: { quality: 0.7, maxSide: 1800 },
  strong: { quality: 0.5, maxSide: 1200 },
};

function nameOf(v: unknown): string | undefined {
  return v instanceof PDFName ? v.asString() : undefined;
}

/** Only plain RGB / gray JPEGs are safe to re-encode with a canvas (CMYK, Indexed, Decode arrays are skipped). */
function isSafeJpeg(dict: PDFDict): boolean {
  if (nameOf(dict.get(PDFName.of('Subtype'))) !== '/Image') return false;
  const filter = dict.get(PDFName.of('Filter'));
  const filterName = filter instanceof PDFArray ? (filter.size() === 1 ? nameOf(filter.get(0)) : undefined) : nameOf(filter);
  if (filterName !== '/DCTDecode') return false;
  if (dict.get(PDFName.of('Decode')) || dict.get(PDFName.of('ImageMask')) || dict.get(PDFName.of('Mask'))) return false;
  const bpc = dict.get(PDFName.of('BitsPerComponent'));
  if (bpc instanceof PDFNumber && bpc.asNumber() !== 8) return false;
  const cs = dict.get(PDFName.of('ColorSpace'));
  const csName = nameOf(cs);
  if (csName) return csName === '/DeviceRGB' || csName === '/DeviceGray';
  // [/ICCBased ref] with 1 or 3 components is fine; anything else (CMYK, Indexed, Separation…) is skipped.
  if (cs instanceof PDFArray && nameOf(cs.get(0)) === '/ICCBased') {
    const stream = dict.context.lookup(cs.get(1));
    const n = stream && 'dict' in (stream as object) ? (stream as PDFRawStream).dict.get(PDFName.of('N')) : undefined;
    return n instanceof PDFNumber && (n.asNumber() === 3 || n.asNumber() === 1);
  }
  return false;
}

export interface CompressStats {
  imagesFound: number;
  imagesRecompressed: number;
}

/**
 * Recompress JPEG images inside the PDF and re-save with object streams.
 * Text, vectors and links are untouched. Images only get replaced when the new one is smaller.
 */
export async function compressKeepText(
  pdfBytes: Uint8Array,
  options: KeepTextOptions,
  reencode: JpegReencoder,
  onProgress?: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; stats: CompressStats }> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const candidates = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && isSafeJpeg(obj.dict)) as [Parameters<typeof doc.context.assign>[0], PDFRawStream][];

  let recompressed = 0;
  for (let i = 0; i < candidates.length; i++) {
    const [ref, stream] = candidates[i];
    const width = (stream.dict.get(PDFName.of('Width')) as PDFNumber | undefined)?.asNumber() ?? 0;
    const height = (stream.dict.get(PDFName.of('Height')) as PDFNumber | undefined)?.asNumber() ?? 0;
    if (width > 0 && height > 0) {
      const result = await reencode({ jpeg: stream.contents, width, height, maxSide: options.maxSide, quality: options.quality });
      if (result && result.bytes.length < stream.contents.length) {
        const dict = stream.dict.clone(doc.context);
        dict.set(PDFName.of('Width'), PDFNumber.of(result.width));
        dict.set(PDFName.of('Height'), PDFNumber.of(result.height));
        dict.set(PDFName.of('Length'), PDFNumber.of(result.bytes.length));
        dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        dict.delete(PDFName.of('DecodeParms'));
        // The canvas always writes RGB or gray; keep gray as gray, everything else becomes RGB.
        if (nameOf(dict.get(PDFName.of('ColorSpace'))) !== '/DeviceGray') dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        doc.context.assign(ref, PDFRawStream.of(dict, result.bytes));
        recompressed++;
      }
    }
    onProgress?.(i + 1, candidates.length);
  }

  const bytes = await doc.save({ useObjectStreams: true });
  // Never hand back a bigger file than the user gave us.
  return {
    bytes: bytes.length < pdfBytes.length ? bytes : pdfBytes,
    stats: { imagesFound: candidates.length, imagesRecompressed: recompressed },
  };
}

// ─── Mode 2: "Target size" — turn pages into JPEGs and search for the best fit ────

export interface RasterPage {
  /** Page size in PDF points, after rotation. */
  widthPt: number;
  heightPt: number;
  /** Encode this page (already rendered at the current scale) as JPEG. */
  encode(quality: number): Promise<Uint8Array>;
}

/** Render every page at `scale` (1 = 72 dpi). Called once per scale tried. */
export type PageRasterizer = (scale: number) => Promise<RasterPage[]>;

/** Scales tried in order, from sharpest (~150 dpi) to smallest (~43 dpi). */
export const TARGET_SCALES = [2.1, 1.7, 1.4, 1.15, 0.95, 0.8, 0.6];
const MIN_QUALITY = 0.3;
const MAX_QUALITY = 0.9;
/** pdf-lib wrapper per page + document overhead, measured on real output. */
const PAGE_OVERHEAD = 400;
const DOC_OVERHEAD = 1200;

export interface TargetResult {
  bytes: Uint8Array;
  scale: number;
  quality: number;
  /** False when even the smallest setting is above the target. */
  reachedTarget: boolean;
  /** True when the original was already small enough and is returned untouched (text kept). */
  alreadySmallEnough?: boolean;
}

async function assemble(pages: RasterPage[], jpegs: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    const img = await out.embedJpg(jpegs[i]);
    const page = out.addPage([pages[i].widthPt, pages[i].heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: pages[i].widthPt, height: pages[i].heightPt });
  }
  out.setProducer('Bharat Dev Tools (bharatdevtool.com)');
  return out.save({ useObjectStreams: true });
}

/**
 * Find the sharpest scale and highest quality whose output fits in `targetBytes`.
 * For each scale (sharpest first) binary-search the JPEG quality; stop at the first scale that fits.
 */
export async function compressToTarget(
  targetBytes: number,
  rasterize: PageRasterizer,
  onProgress?: (step: string) => void,
  original?: Uint8Array,
): Promise<TargetResult> {
  // Already fits: never make a file bigger or blurrier than it needs to be.
  if (original && original.length <= targetBytes) {
    return { bytes: original, scale: 0, quality: 1, reachedTarget: true, alreadySmallEnough: true };
  }
  let fallback: { pages: RasterPage[]; jpegs: Uint8Array[]; scale: number } | null = null;

  for (const scale of TARGET_SCALES) {
    onProgress?.(`Trying ${Math.round(scale * 72)} dpi`);
    const pages = await rasterize(scale);
    const budget = targetBytes - DOC_OVERHEAD - PAGE_OVERHEAD * pages.length;
    const encodeAll = (q: number) => Promise.all(pages.map((p) => p.encode(q)));
    const size = (jpegs: Uint8Array[]) => jpegs.reduce((n, j) => n + j.length, 0);

    const low = await encodeAll(MIN_QUALITY);
    fallback = { pages, jpegs: low, scale };
    if (budget <= 0 || size(low) > budget) continue; // too big even at the lowest quality → smaller scale

    let best = { q: MIN_QUALITY, jpegs: low };
    let lo = MIN_QUALITY;
    let hi = MAX_QUALITY;
    for (let step = 0; step < 6; step++) {
      const mid = (lo + hi) / 2;
      const jpegs = await encodeAll(mid);
      if (size(jpegs) <= budget) {
        best = { q: mid, jpegs };
        lo = mid;
      } else {
        hi = mid;
      }
    }
    let bytes = await assemble(pages, best.jpegs);
    // The overhead estimate can be off by a little; step quality down until it truly fits.
    let q = best.q;
    while (bytes.length > targetBytes && q > MIN_QUALITY) {
      q = Math.max(MIN_QUALITY, q - 0.05);
      bytes = await assemble(pages, await encodeAll(q));
    }
    if (bytes.length <= targetBytes) return { bytes, scale, quality: q, reachedTarget: true };
  }

  if (!fallback) throw new Error('This PDF has no pages.');
  const bytes = await assemble(fallback.pages, fallback.jpegs);
  if (original && original.length <= bytes.length) {
    return { bytes: original, scale: 0, quality: 1, reachedTarget: false, alreadySmallEnough: false };
  }
  return { bytes, scale: fallback.scale, quality: MIN_QUALITY, reachedTarget: bytes.length <= targetBytes };
}
