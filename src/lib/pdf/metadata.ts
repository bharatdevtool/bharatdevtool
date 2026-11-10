// Read / edit / remove PDF document properties. Pure.

import { PDFDocument, PDFName } from '@cantoo/pdf-lib';

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  created?: string;
  modified?: string;
}

export async function readMetadata(pdfBytes: Uint8Array): Promise<PdfMetadata> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
    created: doc.getCreationDate()?.toISOString(),
    modified: doc.getModificationDate()?.toISOString(),
  };
}

/** Write properties. `removeAll` clears every field and the XMP metadata stream. */
export async function writeMetadata(
  pdfBytes: Uint8Array,
  meta: Pick<PdfMetadata, 'title' | 'author' | 'subject' | 'keywords'>,
  opts: { removeAll?: boolean } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  if (opts.removeAll) {
    // Drop the Info dictionary and the XMP stream (which often repeats author, software, dates).
    doc.context.trailerInfo.Info = undefined;
    doc.catalog.delete(PDFName.of('Metadata'));
    return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  }
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setKeywords(meta.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: true });
}
