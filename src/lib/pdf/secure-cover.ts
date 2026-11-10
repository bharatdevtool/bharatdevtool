// Secure Share "cover PDF": a normal PDF whose page explains how to open the document, with the
// encrypted .bdtpdf container attached inside it. Phones and WhatsApp can preview and share a PDF
// (they can't share a .bdtpdf), so the instructions travel with the file.

import {
  PDFDocument, PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFString, StandardFonts, rgb, decodePDFRawStream,
  type PDFFont, type PDFPage,
} from '@cantoo/pdf-lib';
import { isRawShare, ShareError } from './secure';

/** Catalog key that marks a cover PDF (saved without object streams, so it is visible as plain bytes). */
const MARKER = 'BDTShare';

export interface CoverInfo {
  /** Original file name, shown on the cover. */
  name: string;
  /** Expiry, already formatted for the reader (e.g. "12 Nov 2026, 5:30 pm IST"). */
  until: string;
  recipient?: string;
  hasPassword: boolean;
  /** Where the viewer lives, e.g. https://bharatdevtool.com/open */
  openUrl: string;
}

const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const BLUE = rgb(0.15, 0.39, 0.92);
const EMERALD = rgb(0.06, 0.73, 0.51);

/** Keep only characters the standard font can draw (names may contain Hindi, emoji…). */
function safe(font: PDFFont, text: string): string {
  const set = new Set(font.getCharacterSet());
  return Array.from(text, (ch) => (set.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let t = safe(font, text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function centered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

function link(doc: PDFDocument, page: PDFPage, rect: [number, number, number, number], url: string) {
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rect,
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  });
  page.node.addAnnot(doc.context.register(annot));
}

/** Wrap a .bdtpdf container in a one-page PDF that tells the recipient how to open it. */
export async function wrapShareInPdf(share: Uint8Array, info: CoverInfo): Promise<Uint8Array> {
  if (!isRawShare(share)) throw new Error('Not a secure share file.');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4
  const W = page.getWidth();
  const shownUrl = info.openUrl.replace(/^https?:\/\//, '');

  // Brand line
  centered(page, bold, 'BHARAT DEV TOOLS  ·  SECURE SHARE', 770, 9, EMERALD);

  // Lock icon
  const cx = W / 2;
  // Shackle: legs go down into the body (SVG y points down from the origin).
  page.drawSvgPath('M -15 6 L -15 -14 A 15 15 0 0 1 15 -14 L 15 6', { x: cx, y: 670, borderColor: INK, borderWidth: 6 });
  page.drawRectangle({ x: cx - 26, y: 626, width: 52, height: 44, color: INK });
  page.drawCircle({ x: cx, y: 652, size: 5, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: cx - 2, y: 638, width: 4, height: 12, color: rgb(1, 1, 1) });

  centered(page, bold, 'Protected document', 580, 26);
  centered(page, font, fit(font, info.name, 13, W - 120), 556, 13, MUTED);

  let y = 520;
  const facts = [
    ...(info.recipient ? [`Shared with ${info.recipient}`] : []),
    `Can be opened until ${info.until}`,
    info.hasPassword ? 'Needs the password the sender gave you' : 'No password needed',
  ];
  for (const f of facts) {
    centered(page, font, fit(font, f, 12, W - 120), y, 12);
    y -= 20;
  }

  // Button
  const bw = 260;
  const bh = 46;
  const by = y - 40;
  page.drawRectangle({ x: (W - bw) / 2, y: by, width: bw, height: bh, color: BLUE });
  centered(page, bold, 'Tap here to open', by + 17, 15, rgb(1, 1, 1));
  link(doc, page, [(W - bw) / 2, by, (W + bw) / 2, by + bh], info.openUrl);

  // Steps
  let sy = by - 60;
  page.drawText('How to open it', { x: 90, y: sy, size: 14, font: bold, color: INK });
  sy -= 26;
  const steps = [
    `Save this PDF on your phone or computer.`,
    `Open ${shownUrl} in your browser (or tap the button above).`,
    `Choose this PDF file.${info.hasPassword ? ' Enter the password from the sender.' : ''}`,
  ];
  steps.forEach((s, i) => {
    page.drawCircle({ x: 98, y: sy + 4, size: 9, color: BLUE });
    page.drawText(String(i + 1), { x: 95, y: sy, size: 10, font: bold, color: rgb(1, 1, 1) });
    page.drawText(fit(font, s, 12, W - 200), { x: 116, y: sy, size: 12, font, color: INK });
    if (i === 1) {
      const pre = 'Open ';
      const x0 = 116 + font.widthOfTextAtSize(pre, 12);
      const x1 = x0 + font.widthOfTextAtSize(shownUrl, 12);
      page.drawLine({ start: { x: x0, y: sy - 2 }, end: { x: x1, y: sy - 2 }, thickness: 0.8, color: BLUE });
      link(doc, page, [x0, sy - 4, x1, sy + 12], info.openUrl);
    }
    sy -= 26;
  });

  // Footer
  const foot = [
    'Why can\'t I see the pages here? The sender locked this document so it can be viewed',
    'only until the date above. It is encrypted inside this PDF and decrypted on your device:',
    'nothing is uploaded. Free and private, no sign-up: bharatdevtool.com',
  ];
  foot.forEach((l, i) => centered(page, font, l, 120 - i * 14, 9, MUTED));

  await doc.attach(share, `${safe(font, info.name).replace(/\.pdf$/i, '')}.bdtpdf`, {
    mimeType: 'application/octet-stream',
    description: 'Encrypted document (open at bharatdevtool.com/open)',
  });
  doc.catalog.set(PDFName.of(MARKER), PDFNumber.of(1));
  doc.setTitle(`Protected document: ${safe(font, info.name)}`);
  doc.setProducer('Bharat Dev Tools Secure Share');
  doc.setCreator('bharatdevtool.com');
  return doc.save({ useObjectStreams: false });
}

/** True for a cover PDF made by wrapShareInPdf (cheap: no parsing). */
export function isShareCover(file: Uint8Array): boolean {
  if (file.length < 5 || String.fromCharCode(...file.subarray(0, 5)) !== '%PDF-') return false;
  return new TextDecoder('latin1').decode(file).includes(`/${MARKER} 1`);
}

/** Get the .bdtpdf container from a cover PDF (or return a raw .bdtpdf as is). */
export async function extractShare(file: Uint8Array): Promise<Uint8Array> {
  if (isRawShare(file)) return file;
  if (!isShareCover(file)) throw new ShareError('not-a-share', 'This is not a Bharat Dev Tools secure file.');
  try {
    const doc = await PDFDocument.load(file, { updateMetadata: false });
    const files = doc.catalog
      .lookupMaybe(PDFName.of('Names'), PDFDict)
      ?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
      ?.lookupMaybe(PDFName.of('Names'), PDFArray);
    for (let i = 1; files && i < files.size(); i += 2) {
      const stream = files.lookup(i, PDFDict).lookupMaybe(PDFName.of('EF'), PDFDict)?.lookup(PDFName.of('F'));
      if (!(stream instanceof PDFRawStream)) continue;
      const bytes = decodePDFRawStream(stream).decode();
      if (isRawShare(bytes)) return bytes;
    }
  } catch {
    // fall through
  }
  throw new ShareError('damaged', 'This secure file is damaged.');
}
