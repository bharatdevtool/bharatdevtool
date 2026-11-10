import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFString, PDFRef, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { applyEdits, normalizeLinkUrl, replacedTextPages, type EditObject, type TextObj } from '@/lib/pdf/overlay';

async function makePdf(n: number, rotate = 0) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const p = doc.addPage([300, 400]);
    p.drawText(`Page ${i}`, { x: 20, y: 360, size: 18, font });
    if (rotate) p.setRotation(degrees(rotate));
  }
  return doc.save();
}

/** Link annotations on a page: their Rect and either the URI or the target page index. */
function links(doc: PDFDocument, pageIndex: number) {
  const page = doc.getPages()[pageIndex];
  const annots = page.node.Annots();
  if (!annots) return [];
  const pageRefs = doc.getPages().map((p) => p.ref.toString());
  return annots.asArray().map((ref) => {
    const a = doc.context.lookup(ref, PDFDict);
    expect(a.get(PDFName.of('Subtype'))?.toString()).toBe('/Link');
    const rect = a.lookup(PDFName.of('Rect'), PDFArray).asArray().map((n) => Number(n.toString()));
    const action = a.lookupMaybe(PDFName.of('A'), PDFDict);
    const dest = a.lookupMaybe(PDFName.of('Dest'), PDFArray);
    return {
      rect,
      uri: action ? (action.lookup(PDFName.of('URI')) as PDFString).decodeText() : undefined,
      toPage: dest ? pageRefs.indexOf((dest.get(0) as PDFRef).toString()) : undefined,
    };
  });
}

describe('normalizeLinkUrl', () => {
  it('accepts web addresses, emails and phone numbers', () => {
    expect(normalizeLinkUrl('https://bharatdevtool.com/x')).toBe('https://bharatdevtool.com/x');
    expect(normalizeLinkUrl('bharatdevtool.com')).toBe('https://bharatdevtool.com');
    expect(normalizeLinkUrl('www.example.co.in/path?q=1')).toBe('https://www.example.co.in/path?q=1');
    expect(normalizeLinkUrl('asha@example.com')).toBe('mailto:asha@example.com');
    expect(normalizeLinkUrl('+91 98765 43210')).toBe('tel:+919876543210');
  });
  it('rejects things that are not links', () => {
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl('hello world')).toBeNull();
    expect(normalizeLinkUrl('justaword')).toBeNull();
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('links', () => {
  it('adds a web link with the right rectangle', async () => {
    const src = await makePdf(1);
    const out = await applyEdits(src, [{ id: 'l', type: 'link', page: 0, u: 0.1, v: 0.1, w: 0.5, h: 0.05, url: 'example.com' }]);
    const doc = await PDFDocument.load(out);
    const [l] = links(doc, 0);
    expect(l.uri).toBe('https://example.com');
    // u/v from the top-left of a 300×400 page → PDF space from the bottom-left.
    expect(l.rect.map((n) => Math.round(n))).toEqual([30, 340, 180, 360]);
  });

  it('adds a link to another page', async () => {
    const src = await makePdf(3);
    const out = await applyEdits(src, [{ id: 'l', type: 'link', page: 0, u: 0.1, v: 0.1, w: 0.2, h: 0.05, toPage: 3 }]);
    const [l] = links(await PDFDocument.load(out), 0);
    expect(l.toPage).toBe(2);
    expect(l.uri).toBeUndefined();
  });

  it('skips links without a valid target', async () => {
    const src = await makePdf(1);
    const out = await applyEdits(src, [
      { id: 'a', type: 'link', page: 0, u: 0.1, v: 0.1, w: 0.2, h: 0.05, url: 'not a link' },
      { id: 'b', type: 'link', page: 0, u: 0.1, v: 0.3, w: 0.2, h: 0.05, toPage: 9 },
    ]);
    expect(links(await PDFDocument.load(out), 0)).toEqual([]);
  });

  it('places links correctly on a rotated page', async () => {
    const src = await makePdf(1, 90);
    // Displayed page is 400×300; a box at the displayed top-left maps to PDF x near 0, y near the top.
    const out = await applyEdits(src, [{ id: 'l', type: 'link', page: 0, u: 0, v: 0, w: 0.25, h: 0.1, url: 'https://a.in' }]);
    const [l] = links(await PDFDocument.load(out), 0);
    expect(l.rect.map((n) => Math.round(n))).toEqual([0, 0, 30, 100]);
  });
});

describe('replacing existing text', () => {
  it('draws the cover and the new text in the chosen standard font', async () => {
    const src = await makePdf(2);
    const obj: EditObject = {
      id: 't', type: 'text', page: 1, u: 0.05, v: 0.08, text: 'Changed', size: 18, color: '#111111', bold: true, italic: true, family: 'serif',
      cover: { u: 0.05, v: 0.08, w: 0.3, h: 0.06, color: '#ffffff' },
    };
    const out = await applyEdits(src, [obj]);
    const doc = await PDFDocument.load(out);
    const fonts = doc.getPages()[1].node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
    const names = fonts.keys().map((k) => doc.context.lookup(fonts.get(k), PDFDict).get(PDFName.of('BaseFont'))?.toString());
    expect(names).toContain('/Times-BoldItalic');
    expect(replacedTextPages([obj])).toEqual([1]);
  });

  it('keeps a cover with empty text (deleting the original line)', async () => {
    const src = await makePdf(1);
    const before = (await PDFDocument.load(src)).getPages()[0].node.Contents();
    const out = await applyEdits(src, [
      { id: 't', type: 'text', page: 0, u: 0.05, v: 0.08, text: '', size: 18, color: '#000000', bold: false, cover: { u: 0.05, v: 0.08, w: 0.3, h: 0.06, color: '#ffffff' } },
    ]);
    const after = (await PDFDocument.load(out)).getPages()[0].node.Contents();
    expect(after).not.toEqual(before); // the cover rectangle was added
  });
});

describe('markup, shapes and form marks', () => {
  /** Decoded content-stream operators of a page (pdf-lib writes them uncompressed before save). */
  async function ops(bytes: Uint8Array, page = 0): Promise<string> {
    const { decodePDFRawStream, PDFRawStream } = await import('@cantoo/pdf-lib');
    const doc = await PDFDocument.load(bytes);
    const contents = doc.getPages()[page].node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents!];
    return refs
      .map((r) => {
        const st = doc.context.lookup(r);
        return st instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(st).decode()) : String(st);
      })
      .join('\n');
  }
  const countLines = (s: string) => (s.match(/\bl\b/g) ?? []).length; // "x y l" = line-to

  it('draws strike-through, underline, ellipse, arrow and marks', async () => {
    const src = await makePdf(1);
    const base = countLines(await ops(src));
    const objects: EditObject[] = [
      { id: 's', type: 'rect', page: 0, u: 0.1, v: 0.1, w: 0.5, h: 0.04, style: 'strike', color: '#dc2626' },
      { id: 'u', type: 'rect', page: 0, u: 0.1, v: 0.2, w: 0.5, h: 0.04, style: 'underline', color: '#1d4ed8' },
      { id: 'e', type: 'rect', page: 0, u: 0.1, v: 0.3, w: 0.3, h: 0.1, style: 'ellipse', color: '#dc2626' },
      { id: 'a', type: 'line', page: 0, u: 0.1, v: 0.5, u2: 0.6, v2: 0.5, color: '#111827', width: 1.5, arrow: true },
      { id: 'c', type: 'mark', kind: 'check', page: 0, u: 0.1, v: 0.6, w: 0.05, h: 0.04, color: '#047857' },
      { id: 'x', type: 'mark', kind: 'cross', page: 0, u: 0.2, v: 0.6, w: 0.05, h: 0.04, color: '#dc2626' },
      { id: 'd', type: 'mark', kind: 'dot', page: 0, u: 0.3, v: 0.6, w: 0.05, h: 0.04, color: '#111827' },
    ];
    const content = await ops(await applyEdits(src, objects));
    // strike 1 + underline 1 + arrow line 1 + 2 head strokes + tick 2 segments + cross 2 = 9 line-to operators
    expect(countLines(content) - base).toBe(9);
    // ellipse and dot are Bézier curves
    expect((content.match(/\bc\b/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('puts the underline lower than the strike-through', async () => {
    const src = await makePdf(1);
    const y = async (style: 'strike' | 'underline') => {
      const c = await ops(await applyEdits(src, [{ id: 'r', type: 'rect', page: 0, u: 0.1, v: 0.5, w: 0.5, h: 0.05, style, color: '#000000' }]));
      const m = [...c.matchAll(/([\d.]+) ([\d.]+) m\s/g)].pop()!;
      return Number(m[2]);
    };
    expect(await y('underline')).toBeLessThan(await y('strike')); // PDF y grows upwards
  });
});

describe('blank pages', () => {
  it('creates a one-page PDF of the given size', async () => {
    const { blankPdf } = await import('@/lib/pdf/build');
    const doc = await PDFDocument.load(await blankPdf(400, 300));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPages()[0].getSize()).toEqual({ width: 400, height: 300 });
  });
});

describe('custom fonts', () => {
  const font = (name: string) => new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/pdf', name)));
  const baseFonts = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes);
    const fonts = doc.getPages()[0].node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
    return fonts.keys().map((k) => doc.context.lookup(fonts.get(k), PDFDict).get(PDFName.of('BaseFont'))!.toString());
  };
  const text = (family: string, bold = false): TextObj => ({ id: 't', type: 'text', page: 0, u: 0.1, v: 0.1, text: 'Hello Bharat', size: 14, color: '#111111', bold, family });

  it('embeds a bundled web font as a small subset, regular and bold', async () => {
    const src = await makePdf(1);
    const customFonts = { 'web:roboto': { regular: font('roboto-latin-400-normal.woff'), bold: font('roboto-latin-700-normal.woff') } };
    const regular = await applyEdits(src, [text('web:roboto')], { customFonts });
    const bold = await applyEdits(src, [text('web:roboto', true)], { customFonts });
    expect((await baseFonts(regular)).some((n) => /^\/Roboto(?!-Bold)/.test(n))).toBe(true);
    expect((await baseFonts(bold)).some((n) => /Roboto.*Bold/i.test(n))).toBe(true);
    // Only the used letters: far smaller than the 22 KB font file plus the page.
    expect(regular.length - src.length).toBeLessThan(15000);
  });

  // A subset that "saves fine" can still have empty letters (WOFF2 did): check the shapes exist.
  it.each(['roboto', 'open-sans', 'lato', 'noto-sans', 'poppins', 'montserrat', 'merriweather', 'playfair-display', 'courier-prime', 'dancing-script'])(
    'embeds %s with real letter shapes',
    async (id) => {
      const { decodePDFRawStream } = await import('@cantoo/pdf-lib');
      const fontkit = (await import('@cantoo/fontkit')).default;
      const key = `web:${id}`;
      const customFonts = { [key]: { regular: font(`${id}-latin-400-normal.woff`), bold: font(`${id}-latin-700-normal.woff`) } };
      const out = await applyEdits(await makePdf(1), [{ ...text(key), text: 'Abc 123' }, { ...text(key, true), id: 'b', v: 0.3, text: 'Xyz' }], { customFonts });
      const doc = await PDFDocument.load(out);
      const files = doc.context
        .enumerateIndirectObjects()
        .map(([, o]) => o)
        .filter((o): o is PDFDict => o instanceof PDFDict && (o.has(PDFName.of('FontFile2')) || o.has(PDFName.of('FontFile3'))))
        .map((fd) => fd.lookup(PDFName.of('FontFile2')) ?? fd.lookup(PDFName.of('FontFile3')));
      expect(files.length).toBe(2); // regular + bold
      for (const f of files) {
        const bytes = decodePDFRawStream(f as Parameters<typeof decodePDFRawStream>[0]).decode();
        const embedded = fontkit.create(Buffer.from(bytes)) as unknown as { numGlyphs: number; getGlyph: (id: number) => { path: { commands: unknown[] } } };
        const shaped = Array.from({ length: embedded.numGlyphs - 1 }, (_, g) => embedded.getGlyph(g + 1).path.commands.length).filter((n) => n > 0);
        expect(shaped.length).toBeGreaterThanOrEqual(3); // the letters we drew have outlines
      }
    },
  );

  it('draws text as an image when the font file is missing', async () => {
    const src = await makePdf(1);
    let used = '';
    const PNG1x1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const imager = async (_t: string, size: number, _c: string, _b: boolean, css?: string) => {
      used = css ?? '';
      return { png: PNG1x1, widthPt: size * 5, heightPt: size * 1.2 };
    };
    const out = await applyEdits(src, [text('sys:Some Missing Font')], { imager });
    expect(used).toContain('Some Missing Font'); // drawn with the chosen font by the browser
    const doc = await PDFDocument.load(out);
    const xobjects = doc.getPages()[0].node.Resources()!.lookupMaybe(PDFName.of('XObject'), PDFDict);
    expect(xobjects?.keys().length).toBe(1);
  });
});
