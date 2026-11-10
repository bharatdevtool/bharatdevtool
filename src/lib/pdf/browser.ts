// Browser-only PDF helpers: pdf.js loading, rendering, image conversion, ZIP.
// Kept apart from the pure modules so those stay testable in Node.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { zipSync } from 'fflate';
import type { JpegReencoder, PageRasterizer, RasterPage } from './compress';
import type { TextImager } from './draw';
import type { TextRun } from './find';

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

/** Load pdf.js on first use (it is ~1 MB; pages that never need it never download it). */
export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return pdfjs;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

/** Open a PDF with pdf.js. pdf.js takes ownership of the buffer it is given, so pass a copy. */
export async function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data: bytes.slice(), password }).promise;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), type, quality),
  );
}

export async function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Uint8Array(await (await canvasToBlob(canvas, type, quality)).arrayBuffer());
}

/**
 * Render page `index` (0-based) at `scale` (1 = 72 dpi) with extra clockwise rotation.
 * White background, so transparent PDFs don't turn black in JPEG.
 */
export async function renderPage(doc: PDFDocumentProxy, index: number, scale: number, extraRotation = 0): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(index + 1);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Thumbnail as an object URL, about `width` px wide. */
export async function renderThumbnail(doc: PDFDocumentProxy, index: number, width = 180): Promise<string> {
  const page = await doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const canvas = await renderPage(doc, index, width / base.width);
  return URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.8));
}

/** Page sizes in points (with the page's own rotation applied). */
export async function pageSizes(doc: PDFDocumentProxy): Promise<{ w: number; h: number }[]> {
  const out: { w: number; h: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
    out.push({ w: vp.width, h: vp.height });
  }
  return out;
}

/** Above this many pixels in total, pages are re-rendered for every encode instead of kept in memory. */
const KEEP_IN_MEMORY_PIXELS = 60_000_000;

/** PageRasterizer for compressToTarget, backed by pdf.js. */
export function makeRasterizer(doc: PDFDocumentProxy): PageRasterizer {
  return async (scale) => {
    const sizes = await pageSizes(doc);
    const totalPixels = sizes.reduce((n, s) => n + s.w * s.h * scale * scale, 0);
    const keep = totalPixels <= KEEP_IN_MEMORY_PIXELS;
    const pages: RasterPage[] = [];
    for (let i = 0; i < sizes.length; i++) {
      const cached = keep ? await renderPage(doc, i, scale) : null;
      pages.push({
        widthPt: sizes[i].w,
        heightPt: sizes[i].h,
        encode: async (quality) => {
          const canvas = cached ?? (await renderPage(doc, i, scale));
          return canvasToBytes(canvas, 'image/jpeg', quality);
        },
      });
    }
    return pages;
  };
}

/** JpegReencoder for compressKeepText, backed by createImageBitmap + canvas. */
export const canvasReencoder: JpegReencoder = async ({ jpeg, width, height, maxSide, quality }) => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }));
  } catch {
    return null; // a JPEG variant the browser can't decode: keep the original
  }
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return { bytes: await canvasToBytes(canvas, 'image/jpeg', quality), width: w, height: h };
};

/**
 * Bytes pdf-lib can embed: JPEG and PNG pass through, any other format the browser can open
 * (WebP, GIF, BMP, AVIF…) is converted to PNG (keeps transparency) or JPEG.
 */
export async function toEmbeddableImage(file: File): Promise<{ bytes: Uint8Array; mime: 'image/jpeg' | 'image/png' }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') return { bytes, mime: 'image/jpeg' };
  if (file.type === 'image/png') return { bytes, mime: 'image/png' };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC is decoded only where the browser supports it (Safari). We deliberately ship no HEVC decoder:
    // HEVC is patent-encumbered, so other browsers get a clear way out instead.
    if (isHeicName(file)) {
      throw new Error(`${file.name}: this browser can't open iPhone HEIC photos. Open this page in Safari, or export the photo as JPG (on iPhone: Settings → Camera → Formats → Most Compatible).`);
    }
    throw new Error(`${file.name}: this image format can't be opened in the browser. Save it as JPG or PNG first.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  // PNG only when the image really has transparency; photos stay compact as JPEG.
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      transparent = true;
      break;
    }
  }
  return transparent
    ? { bytes: await canvasToBytes(canvas, 'image/png'), mime: 'image/png' }
    : { bytes: await canvasToBytes(canvas, 'image/jpeg', 0.92), mime: 'image/jpeg' };
}

/** Pack files into a ZIP (stored, no compression: PDFs and JPEGs are already compressed). */
export function makeZip(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const f of files) {
    let name = f.name;
    for (let n = 2; entries[name]; n++) name = f.name.replace(/(\.[^.]+)?$/, `-${n}$1`);
    entries[name] = [f.bytes, { level: 0 }];
  }
  return zipSync(entries);
}


export const isHeicName = (f: File) => /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/i.test(f.name);

// ─── Text as image (for scripts the standard PDF fonts can't write) ─────────

const PX_PER_PT = 3;
const TEXT_FONT_STACK = '"Noto Sans", "Noto Sans Devanagari", "Nirmala UI", "Mangal", "Segoe UI", system-ui, sans-serif';

export const canvasTextImager: TextImager = async (text, sizePt, color, bold, cssFont) => {
  const lines = text.split('\n');
  const px = sizePt * PX_PER_PT;
  const font = `${bold ? '700' : '400'} ${px}px ${cssFont ?? TEXT_FONT_STACK}`;
  if (cssFont && 'fonts' in document) await document.fonts.load(font, text).catch(() => {});
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const lineH = px * 1.2;
  const width = Math.ceil(Math.max(1, ...lines.map((l) => measure.measureText(l).width)) + px * 0.1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(lineH * lines.length);
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 0, i * lineH + px * 0.08));
  return { png: await canvasToBytes(canvas, 'image/png'), widthPt: canvas.width / PX_PER_PT, heightPt: canvas.height / PX_PER_PT };
};

// ─── Text positions (for Find & redact) ──────────────────────────────────────

let measureCtx: CanvasRenderingContext2D | null = null;
/** Relative start of each character (0..1), measured with a sans font and scaled to the run. */
function charOffsets(str: string): number[] {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return Array.from({ length: str.length + 1 }, (_, i) => i / Math.max(1, str.length));
  measureCtx.font = '100px Helvetica, Arial, sans-serif';
  const total = measureCtx.measureText(str).width || 1;
  const out: number[] = [];
  for (let i = 0; i <= str.length; i++) out.push(measureCtx.measureText(str.slice(0, i)).width / total);
  return out;
}

/**
 * Font look of a text run: family from pdf.js styles, bold/italic from the font pdf.js loaded for
 * rendering (known once the page has been drawn; otherwise regular).
 */
function fontInfo(page: { commonObjs: { has: (id: string) => boolean; get: (id: string) => unknown } }, family: string | undefined, fontId: string) {
  let font: { bold?: boolean; black?: boolean; italic?: boolean; fallbackName?: string; loadedName?: string } = {};
  try {
    if (page.commonObjs.has(fontId)) font = (page.commonObjs.get(fontId) as typeof font) ?? {};
  } catch {
    /* font not loaded yet */
  }
  const f = `${family ?? ''} ${font.fallbackName ?? ''}`.toLowerCase();
  return {
    family: (/mono|courier|consol/.test(f) ? 'mono' : /serif|times|georgia|garamond|cambria|roman/.test(f) && !/sans/.test(f) ? 'serif' : 'sans') as 'sans' | 'serif' | 'mono',
    bold: !!(font.bold || font.black),
    italic: !!font.italic,
  };
}

/** Text runs of a page with boxes as fractions of the page as displayed. */
export async function pageTextRuns(doc: PDFDocumentProxy, index: number): Promise<TextRun[]> {
  const pdfjs = await loadPdfJs();
  const page = await doc.getPage(index + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const runs: TextRun[] = [];
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontH = Math.hypot(tx[2], tx[3]);
    const horizontal = Math.abs(tx[1]) < Math.abs(tx[0]) * 0.1;
    const len = item.width * viewport.scale;
    const x = tx[4];
    const y = tx[5] - fontH;
    // Vertical runs (rotated text) get their bounding box; partial masking is approximate there.
    const w = horizontal ? len : fontH;
    const h = horizontal ? fontH * 1.15 : len;
    runs.push({
      str: item.str, u: x / viewport.width, v: y / viewport.height, w: w / viewport.width, h: h / viewport.height,
      charX: horizontal ? charOffsets(item.str) : undefined,
      ...fontInfo(page, content.styles[item.fontName]?.fontFamily, item.fontName),
      fontPt: fontH,
    });
  }
  return runs;
}

// ─── Flatten pages to images (redaction, grayscale, "make permanent") ───────

export async function flattenPages(
  pdfBytes: Uint8Array,
  indexes: readonly number[],
  opts: {
    dpi?: number; grayscale?: boolean; quality?: number; onProgress?: (done: number, total: number) => void;
    /** Draw on each rendered page before it is saved (e.g. a watermark preview). */
    decorate?: (canvas: HTMLCanvasElement) => void;
  } = {},
): Promise<Map<number, { bytes: Uint8Array; mime: 'image/jpeg' }>> {
  const doc = await openPdf(pdfBytes);
  const out = new Map<number, { bytes: Uint8Array; mime: 'image/jpeg' }>();
  try {
    for (let n = 0; n < indexes.length; n++) {
      const canvas = await renderPage(doc, indexes[n], (opts.dpi ?? 150) / 72);
      if (opts.grayscale) {
        const ctx = canvas.getContext('2d')!;
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          d[i] = d[i + 1] = d[i + 2] = y;
        }
        ctx.putImageData(img, 0, 0);
      }
      opts.decorate?.(canvas);
      out.set(indexes[n], { bytes: await canvasToBytes(canvas, 'image/jpeg', opts.quality ?? 0.85), mime: 'image/jpeg' });
      canvas.width = canvas.height = 0;
      opts.onProgress?.(n + 1, indexes.length);
    }
  } finally {
    doc.loadingTask.destroy();
  }
  return out;
}

// ─── Secure Share watermark ──────────────────────────────────────────────────

/** Diagonal, tiled watermark drawn into the page pixels (viewer, print and preview use the same one). */
export function stampShareWatermark(canvas: HTMLCanvasElement, text: string) {
  if (!text) return;
  const ctx = canvas.getContext('2d')!;
  const size = Math.max(14, Math.round(canvas.width / 32));
  ctx.save();
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(30, 64, 175, 0.12)';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.atan2(canvas.height, canvas.width));
  const step = ctx.measureText(text).width + size * 3;
  for (let y = -canvas.height; y < canvas.height; y += size * 6) {
    for (let x = -canvas.width; x < canvas.width; x += step) ctx.fillText(text, x + ((y / (size * 6)) % 2 ? step / 2 : 0), y);
  }
  ctx.restore();
}

// ─── Trusted time (Secure Share) ─────────────────────────────────────────────

/** Current time from our own server's Date header, so changing the device clock doesn't help. */
export async function trustedNow(): Promise<number> {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  const date = Date.parse(res.headers.get('date') ?? '');
  if (!Number.isFinite(date)) throw new Error('No server time');
  return date;
}
