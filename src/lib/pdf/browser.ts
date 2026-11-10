// Browser-only PDF helpers: pdf.js loading, rendering, image conversion, ZIP.
// Kept apart from the pure modules so those stay testable in Node.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { zipSync } from 'fflate';
import type { JpegReencoder, PageRasterizer, RasterPage } from './compress';

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

