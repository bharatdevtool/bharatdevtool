// Heavy PDF engine (pdf-lib + pdf.js glue). Import it dynamically: import('@/lib/pdf/engine').
export { buildPdf, loadPdf, EncryptedPdfError } from './build';
export { compressKeepText, compressToTarget, KEEP_TEXT_LEVELS } from './compress';
export {
  openPdf, renderPage, renderThumbnail, canvasToBytes, makeRasterizer, canvasReencoder, toEmbeddableImage, makeZip,
} from './browser';
