// Build a new PDF from an ordered list of pages taken from PDFs and images.
// Covers Merge, Organize (reorder/rotate/delete), Extract/Split and JPG→PDF. Pure: no DOM.

import { PDFDocument, degrees, type PDFPage } from '@cantoo/pdf-lib';
import { normalizeRotation, DEFAULT_IMAGE_OPTIONS, type ImagePageOptions, type PageSize } from './shared';

export { normalizeRotation, DEFAULT_IMAGE_OPTIONS };
export type { ImagePageOptions, PageSize, Orientation } from './shared';

export type SourceKind = 'pdf' | 'image';

export interface SourceFile {
  id: string;
  name: string;
  kind: SourceKind;
  /** PDF bytes, or JPEG/PNG bytes for images (other image formats are converted before they get here). */
  bytes: Uint8Array;
  /** 'image/jpeg' | 'image/png' for images. */
  mime?: string;
  /** Password for a protected PDF (kept in memory only). */
  password?: string;
}

export interface PageRef {
  fileId: string;
  /** 0-based page index inside the source PDF (always 0 for an image). */
  index: number;
  /** Extra clockwise rotation chosen by the user: 0, 90, 180 or 270. */
  rotation: number;
}

const PAGE_SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Thrown when a PDF needs a password (or the one given is wrong). */
export class EncryptedPdfError extends Error {
  constructor(public fileName: string, public wrongPassword = false) {
    super(wrongPassword ? `Wrong password for ${fileName}` : `${fileName} is password-protected`);
    this.name = 'EncryptedPdfError';
  }
}

/**
 * Load a PDF. Files that are only "owner-protected" (they open without a password but restrict
 * printing/copying) are decrypted with an empty password. Files that need a password to open
 * throw EncryptedPdfError unless `file.password` is right.
 */
export async function loadPdf(file: SourceFile): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(file.bytes, { updateMetadata: false });
  } catch (err) {
    if (!/encrypt/i.test(String((err as Error)?.message))) throw err;
  }
  try {
    return await PDFDocument.load(file.bytes, { updateMetadata: false, password: file.password ?? '' });
  } catch (err) {
    const msg = String((err as Error)?.message);
    if (/password/i.test(msg)) throw new EncryptedPdfError(file.name, !!file.password);
    throw err;
  }
}

/** Page count of a PDF file. */
export async function countPages(file: SourceFile): Promise<number> {
  return (await loadPdf(file)).getPageCount();
}

/** Page box for an image page, in points. */
export function imagePageLayout(
  imgW: number,
  imgH: number,
  opts: ImagePageOptions,
): { pageW: number; pageH: number; x: number; y: number; w: number; h: number } {
  // Images carry pixel sizes: 1 px = 0.75 pt (96 dpi), the size the image shows at on screen.
  const natW = imgW * 0.75;
  const natH = imgH * 0.75;
  const margin = Math.max(0, opts.margin);

  let pageW: number;
  let pageH: number;
  if (opts.pageSize === 'fit') {
    pageW = natW + margin * 2;
    pageH = natH + margin * 2;
  } else {
    const [a, b] = PAGE_SIZES[opts.pageSize];
    const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && imgW > imgH);
    [pageW, pageH] = landscape ? [b, a] : [a, b];
  }

  const boxW = Math.max(1, pageW - margin * 2);
  const boxH = Math.max(1, pageH - margin * 2);
  // Fit inside the box; never upscale small images on a fixed page size.
  const scale = opts.pageSize === 'fit' ? 1 : Math.min(boxW / natW, boxH / natH, 1);
  const w = natW * scale;
  const h = natH * scale;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

/**
 * Build one PDF from `pages`, in order. Source PDFs are loaded once each.
 * `onProgress(done, total)` is called after every page.
 */
export async function buildPdf(
  files: ReadonlyMap<string, SourceFile>,
  pages: readonly PageRef[],
  imageOptions: ImagePageOptions = DEFAULT_IMAGE_OPTIONS,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  if (!pages.length) throw new Error('There are no pages to save.');
  const out = await PDFDocument.create();
  for (const ref of pages) {
    if (!files.has(ref.fileId)) throw new Error('A page refers to a file that was removed.');
  }

  // Copy all pages needed from each source PDF in ONE copyPages call, so resources they share
  // (fonts, a logo or photo on every page) are copied once instead of once per page.
  const copied = new Map<string, PDFPage[]>(); // fileId -> copies, in order of first use
  const usesSoFar = new Map<string, number>();
  for (const file of files.values()) {
    if (file.kind !== 'pdf') continue;
    const indexes = pages.filter((p) => p.fileId === file.id).map((p) => p.index);
    if (!indexes.length) continue;
    copied.set(file.id, await out.copyPages(await loadPdf(file), indexes));
  }

  for (let i = 0; i < pages.length; i++) {
    const ref = pages[i];
    const file = files.get(ref.fileId)!;

    if (file.kind === 'pdf') {
      const n = usesSoFar.get(file.id) ?? 0;
      usesSoFar.set(file.id, n + 1);
      const page = copied.get(file.id)![n];
      page.setRotation(degrees(normalizeRotation(page.getRotation().angle + ref.rotation)));
      out.addPage(page);
    } else {
      const img = file.mime === 'image/png' ? await out.embedPng(file.bytes) : await out.embedJpg(file.bytes);
      const l = imagePageLayout(img.width, img.height, imageOptions);
      const page = out.addPage([l.pageW, l.pageH]);
      page.drawImage(img, { x: l.x, y: l.y, width: l.w, height: l.h });
      if (ref.rotation) page.setRotation(degrees(normalizeRotation(ref.rotation)));
    }
    onProgress?.(i + 1, pages.length);
  }

  out.setProducer('Bharat Dev Tools (bharatdevtool.com)');
  out.setCreator('Bharat Dev Tools');
  return out.save({ useObjectStreams: true });
}
