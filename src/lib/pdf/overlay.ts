// Apply editor objects (text, images, signatures, white-out, highlight, shapes, redaction boxes)
// and form values to a PDF. Positions are fractions of the page as displayed. Pure.

import { PDFDocument, PDFString, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField, PDFOptionList } from '@cantoo/pdf-lib';
import { toPdfRect } from './geometry';
import { fontCss, isStandardFont } from './fonts';
import { FontCache, MARK_STROKES, arrowHead, drawEllipseBlock, drawImageBlock, drawLineBlock, drawRectBlock, drawTextBlock, pageGeometry, type TextImager, type CustomFonts } from './draw';

interface Base {
  id: string;
  /** 0-based page index in the document being edited. */
  page: number;
  /** Top-left as a fraction of the displayed page. */
  u: number;
  v: number;
}
export interface TextObj extends Base {
  type: 'text';
  text: string;
  /** Font size in points. */
  size: number;
  color: string;
  bold: boolean;
  italic?: boolean;
  /** 'sans' | 'serif' | 'mono', 'web:<id>' or 'sys:<family>' (see lib/pdf/fonts). */
  family?: string;
  /**
   * Set when this replaces text already in the PDF: a box in the page's background colour that
   * hides the original line (drawn before everything else).
   */
  cover?: { u: number; v: number; w: number; h: number; color: string };
  /** Editor bookkeeping: which original line this replaces. Ignored when saving. */
  source?: string;
}
export interface ImageObj extends Base {
  type: 'image';
  /** Width/height as fractions of the displayed page. */
  w: number;
  h: number;
  bytes: Uint8Array;
  mime: 'image/png' | 'image/jpeg';
  /** Signatures are images too; kept for labels/analytics. */
  isSignature?: boolean;
}
export interface RectObj extends Base {
  type: 'rect';
  w: number;
  h: number;
  /**
   * whiteout = white fill, highlight = translucent fill, box/ellipse = outline, redact = black + page
   * flattened, strike/underline = a line through / under the text in the box.
   */
  style: 'whiteout' | 'highlight' | 'box' | 'ellipse' | 'redact' | 'strike' | 'underline';
  color: string;
}
export interface LineObj extends Base {
  type: 'line';
  /** End point as fractions of the displayed page. */
  u2: number;
  v2: number;
  color: string;
  width: number;
  /** Arrowhead at the end point. */
  arrow?: boolean;
}
/** Form marks: tick, cross or dot in a square box. */
export interface MarkObj extends Base {
  type: 'mark';
  kind: 'check' | 'cross' | 'dot';
  w: number;
  h: number;
  color: string;
}
/** A clickable area: a web/email address, or a page of this document (1-based). */
export interface LinkObj extends Base {
  type: 'link';
  w: number;
  h: number;
  url?: string;
  toPage?: number;
}
export type EditObject = TextObj | ImageObj | RectObj | LineObj | LinkObj | MarkObj;

/** Where strike-through and underline sit in a text box (fractions of its height; see pageTextRuns). */
export const STRIKE_AT = 0.6;
export const UNDERLINE_AT = 0.9;
/** Line thickness for strike-through / underline of a text box this tall (points). */
export const markupWidth = (boxHeight: number) => Math.max(0.6, boxHeight * 0.07);

/** Turn what someone typed into a link target, or null when it isn't one. */
export function normalizeLinkUrl(raw: string): string | null {
  const s = raw.trim();
  if (/^\+?[\d\s-]{8,}$/.test(s)) return `tel:${s.replace(/[\s-]/g, '')}`;
  if (!s || /\s/.test(s)) return null;
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[^@\s/]+@[^@\s/]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(s)) return `https://${s}`;
  return null;
}

export type FormValues = Record<string, string | boolean>;

export interface FormFieldInfo {
  name: string;
  kind: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'list';
  value: string | boolean;
  options?: string[];
  multiline?: boolean;
}

/** List the fillable fields of a PDF (empty when it has none). */
export async function readFormFields(pdfBytes: Uint8Array): Promise<FormFieldInfo[]> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  let fields;
  try {
    fields = doc.getForm().getFields();
  } catch {
    return [];
  }
  const out: FormFieldInfo[] = [];
  for (const f of fields) {
    const name = f.getName();
    if (f instanceof PDFTextField) out.push({ name, kind: 'text', value: f.getText() ?? '', multiline: f.isMultiline() });
    else if (f instanceof PDFCheckBox) out.push({ name, kind: 'checkbox', value: f.isChecked() });
    else if (f instanceof PDFDropdown) out.push({ name, kind: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions() });
    else if (f instanceof PDFRadioGroup) out.push({ name, kind: 'radio', value: f.getSelected() ?? '', options: f.getOptions() });
    else if (f instanceof PDFOptionList) out.push({ name, kind: 'list', value: f.getSelected()[0] ?? '', options: f.getOptions() });
  }
  return out;
}

const HIGHLIGHT_OPACITY = 0.35;

/**
 * Draw `objects` on top of the pages and fill `formValues`.
 * Redaction boxes are drawn black here; the caller then flattens those pages (see redactedPages).
 */
export async function applyEdits(
  pdfBytes: Uint8Array,
  objects: readonly EditObject[],
  options: { formValues?: FormValues; flattenForm?: boolean; imager?: TextImager; customFonts?: CustomFonts } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  if (options.customFonts && Object.keys(options.customFonts).length) {
    // fontkit is only loaded when a custom font is actually used.
    doc.registerFontkit((await import('@cantoo/fontkit')).default);
  }
  const fonts = new FontCache(doc, options.customFonts);
  const pages = doc.getPages();

  if (options.formValues && Object.keys(options.formValues).length) {
    const form = doc.getForm();
    for (const [name, value] of Object.entries(options.formValues)) {
      const f = form.getFieldMaybe(name);
      if (!f) continue;
      try {
        if (f instanceof PDFTextField) f.setText(String(value));
        else if (f instanceof PDFCheckBox) {
          if (value) f.check();
          else f.uncheck();
        }
        else if ((f instanceof PDFDropdown || f instanceof PDFOptionList || f instanceof PDFRadioGroup) && value) f.select(String(value));
      } catch {
        /* a value the field does not accept is skipped */
      }
    }
    // Text with characters the default form font lacks would throw while drawing appearances.
    try {
      form.updateFieldAppearances((await fonts.get(false))!); // standard Helvetica: never null
    } catch {
      /* keep the viewer's own rendering */
    }
    if (options.flattenForm) form.flatten();
  }

  // Covers for replaced text go first, so they never hide anything the user added on top.
  for (const o of objects) {
    const page = pages[o.page];
    if (!page || o.type !== 'text' || !o.cover) continue;
    const { disp } = pageGeometry(page);
    const c = o.cover;
    drawRectBlock(page, { x: c.u * disp.w, y: c.v * disp.h, w: c.w * disp.w, h: c.h * disp.h, fill: c.color });
  }

  for (const o of objects) {
    const page = pages[o.page];
    if (!page) continue;
    const { disp } = pageGeometry(page);
    const x = o.u * disp.w;
    const y = o.v * disp.h;
    if (o.type === 'link') {
      addLink(doc, page, pages, o);
    } else if (o.type === 'text') {
      if (o.text.trim()) await drawTextBlock(doc, page, fonts, { text: o.text, x, y, size: o.size, color: o.color, bold: o.bold, italic: isStandardFont(o.family) && o.italic, family: o.family, cssFont: fontCss(o.family) }, options.imager);
    } else if (o.type === 'image') {
      const img = o.mime === 'image/png' ? await doc.embedPng(o.bytes) : await doc.embedJpg(o.bytes);
      await drawImageBlock(page, img, { x, y, w: o.w * disp.w, h: o.h * disp.h });
    } else if (o.type === 'rect') {
      const r = { x, y, w: o.w * disp.w, h: o.h * disp.h };
      if (o.style === 'whiteout') drawRectBlock(page, { ...r, fill: '#ffffff' });
      else if (o.style === 'redact') drawRectBlock(page, { ...r, fill: '#000000' });
      else if (o.style === 'highlight') drawRectBlock(page, { ...r, fill: o.color, opacity: HIGHLIGHT_OPACITY });
      else if (o.style === 'ellipse') drawEllipseBlock(page, { ...r, stroke: o.color, strokeWidth: 1.5 });
      else if (o.style === 'strike' || o.style === 'underline') {
        const ly = r.y + r.h * (o.style === 'strike' ? STRIKE_AT : UNDERLINE_AT);
        drawLineBlock(page, { x1: r.x, y1: ly, x2: r.x + r.w, y2: ly, color: o.color, width: markupWidth(r.h) });
      } else drawRectBlock(page, { ...r, stroke: o.color, strokeWidth: 1.5 });
    } else if (o.type === 'line') {
      const x2 = o.u2 * disp.w;
      const y2 = o.v2 * disp.h;
      drawLineBlock(page, { x1: x, y1: y, x2, y2, color: o.color, width: o.width });
      if (o.arrow) for (const p of arrowHead(x, y, x2, y2, o.width)) drawLineBlock(page, { x1: p.x, y1: p.y, x2, y2, color: o.color, width: o.width });
    } else if (o.type === 'mark') {
      const w = o.w * disp.w;
      const h = o.h * disp.h;
      if (o.kind === 'dot') {
        drawEllipseBlock(page, { x: x + w * 0.25, y: y + h * 0.25, w: w * 0.5, h: h * 0.5, fill: o.color });
      } else {
        const t = Math.max(0.8, w * 0.12);
        for (const stroke of MARK_STROKES[o.kind]) {
          for (let i = 1; i < stroke.length; i++) {
            const [a, b] = [stroke[i - 1], stroke[i]];
            drawLineBlock(page, { x1: x + a[0] * w, y1: y + a[1] * h, x2: x + b[0] * w, y2: y + b[1] * h, color: o.color, width: t });
          }
        }
      }
    }
  }
  try {
    return await doc.save({ useObjectStreams: true });
  } catch (err) {
    // A custom font that fontkit can't subset only fails here, at save. Never lose the user's
    // edits over it: save again with that text drawn as images (in the same font, by the browser).
    if (options.customFonts && Object.keys(options.customFonts).length) return applyEdits(pdfBytes, objects, { ...options, customFonts: {} });
    throw err;
  }
}

/** A real PDF link annotation (works in every viewer), invisible like links in other PDFs. */
function addLink(doc: PDFDocument, page: ReturnType<PDFDocument['getPages']>[number], pages: ReturnType<PDFDocument['getPages']>, o: LinkObj) {
  const url = o.url ? normalizeLinkUrl(o.url) : null;
  const target = o.toPage && pages[o.toPage - 1] ? pages[o.toPage - 1] : null;
  if (!url && !target) return;
  const { box, rotation } = pageGeometry(page);
  const r = toPdfRect(o.u, o.v, o.w, o.h, box, rotation);
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [r.x, r.y, r.x + r.w, r.y + r.h],
    Border: [0, 0, 0],
    ...(url ? { A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } } : { Dest: [target!.ref, 'Fit'] }),
  });
  page.node.addAnnot(doc.context.register(annot));
}

/** Pages whose replaced text should be removed for good (flattened, like redaction). */
export function replacedTextPages(objects: readonly EditObject[]): number[] {
  return [...new Set(objects.filter((o) => o.type === 'text' && o.cover).map((o) => o.page))].sort((a, b) => a - b);
}

/** Pages that contain redaction boxes and must be flattened so the text underneath is removed. */
export function redactedPages(objects: readonly EditObject[]): number[] {
  return [...new Set(objects.filter((o) => o.type === 'rect' && o.style === 'redact').map((o) => o.page))].sort((a, b) => a - b);
}

/**
 * Replace some pages with flat images (used for redaction and "make permanent").
 * `images` maps page index → JPEG/PNG rendering of the page as displayed.
 * Also strips document metadata, since redacted documents should not leak it either.
 */
export async function replacePagesWithImages(
  pdfBytes: Uint8Array,
  images: ReadonlyMap<number, { bytes: Uint8Array; mime: 'image/jpeg' | 'image/png' }>,
  opts: { stripMetadata?: boolean } = {},
): Promise<Uint8Array> {
  const src = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const out = await PDFDocument.create();
  const keep = src.getPageIndices();
  const copies = await out.copyPages(src, keep);
  for (const i of keep) {
    const flat = images.get(i);
    if (!flat) {
      out.addPage(copies[i]);
      continue;
    }
    const { disp } = pageGeometry(src.getPage(i));
    const img = flat.mime === 'image/png' ? await out.embedPng(flat.bytes) : await out.embedJpg(flat.bytes);
    const page = out.addPage([disp.w, disp.h]);
    page.drawImage(img, { x: 0, y: 0, width: disp.w, height: disp.h });
  }
  if (!opts.stripMetadata) {
    const t = src.getTitle();
    if (t) out.setTitle(t);
    const a = src.getAuthor();
    if (a) out.setAuthor(a);
  }
  out.setProducer('Bharat Dev Tools (bharatdevtool.com)');
  out.setCreator('Bharat Dev Tools');
  return out.save({ useObjectStreams: true });
}
