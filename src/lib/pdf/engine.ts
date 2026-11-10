// Heavy PDF engine (pdf-lib + pdf.js glue). Import it dynamically: import('@/lib/pdf/engine').
export { buildPdf, loadPdf, EncryptedPdfError, isEncryptedPdf, blankPdf } from './build';
export { protectPdf } from './protect';
export { compressKeepText, compressToTarget, KEEP_TEXT_LEVELS } from './compress';
export { applyEdits, readFormFields, redactedPages, replacedTextPages, replacePagesWithImages, normalizeLinkUrl } from './overlay';
export { addWatermark, addPageNumbers } from './stamp';
export { findSensitive } from './find';
export { readMetadata, writeMetadata } from './metadata';
export { createShare, openShare, readShareHeader, ShareError, shareWatermarkText } from './secure';
export { wrapShareInPdf, extractShare, isShareCover } from './secure-cover';
export {
  openPdf, renderPage, renderThumbnail, canvasToBytes, makeRasterizer, canvasReencoder, toEmbeddableImage, makeZip,
  canvasTextImager, pageTextRuns, flattenPages, trustedNow, pageSizes, stampShareWatermark,
} from './browser';
