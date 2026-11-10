import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, PDFName, PDFRawStream, decodePDFRawStream } from '@cantoo/pdf-lib';
import { parsePageRanges, formatPageList } from '@/lib/pdf/ranges';
import { buildPdf, imagePageLayout, normalizeRotation, loadPdf, type SourceFile } from '@/lib/pdf/build';
import { compressKeepText, compressToTarget, type RasterPage } from '@/lib/pdf/compress';

const FIX = join(process.cwd(), 'tests/fixtures/pdf');
const JPG = new Uint8Array(readFileSync(join(FIX, 'sample.jpg')));
const PNG = new Uint8Array(readFileSync(join(FIX, 'sample.png')));

async function makePdf(labels: string[], opts: { jpeg?: boolean; rotate?: number } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const photo = opts.jpeg ? await doc.embedJpg(JPG) : null; // one image object shared by every page
  for (const label of labels) {
    const page = doc.addPage([300, 400]);
    page.drawText(label, { x: 20, y: 360, size: 18, font });
    if (photo) page.drawImage(photo, { x: 20, y: 20, width: 256, height: 192 });
    if (opts.rotate) page.setRotation({ type: 'degrees', angle: opts.rotate } as never);
  }
  return doc.save();
}

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  // Each test page draws exactly one label; read it back from the content stream.
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => {
    const raw = p.node.Contents();
    const streams = raw && 'asArray' in raw ? (raw as unknown as { asArray(): unknown[] }).asArray() : [raw];
    const text = streams
      .map((s) => doc.context.lookup(s as never) as PDFRawStream)
      .map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1'))
      .join('');
    const m = /<([0-9A-Fa-f]+)> Tj/.exec(text);
    return m ? Buffer.from(m[1], 'hex').toString('latin1') : '';
  });
}

const file = (id: string, bytes: Uint8Array, kind: 'pdf' | 'image' = 'pdf', mime?: string): SourceFile => ({ id, name: `${id}.${kind === 'pdf' ? 'pdf' : 'jpg'}`, kind, bytes, mime });

describe('page ranges', () => {
  it('parses single pages, ranges and open ends into groups', () => {
    expect(parsePageRanges('1-3, 5, 8-', 9)).toEqual({ ok: true, groups: [[0, 1, 2], [4], [7, 8]] });
    expect(parsePageRanges('-2', 5)).toEqual({ ok: true, groups: [[0, 1]] });
  });
  it('explains bad input', () => {
    expect(parsePageRanges('', 3).ok).toBe(false);
    expect(parsePageRanges('4', 3)).toMatchObject({ ok: false, error: expect.stringContaining('does not exist') });
    expect(parsePageRanges('3-1', 3)).toMatchObject({ ok: false, error: expect.stringContaining('1-3') });
    expect(parsePageRanges('a', 3).ok).toBe(false);
    expect(parsePageRanges('0', 3).ok).toBe(false);
  });
  it('formats page lists compactly', () => {
    expect(formatPageList([4, 0, 1, 2, 7])).toBe('1-3, 5, 8');
  });
});

describe('build (merge / organize / extract / images)', () => {
  it('merges two PDFs in the chosen order with rotation', async () => {
    const files = new Map([
      ['a', file('a', await makePdf(['A1', 'A2']))],
      ['b', file('b', await makePdf(['B1'], { rotate: 90 }))],
    ]);
    const out = await buildPdf(files, [
      { fileId: 'b', index: 0, rotation: 90 },
      { fileId: 'a', index: 1, rotation: 0 },
      { fileId: 'a', index: 0, rotation: 270 },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([180, 0, 270]);
    expect(await pageTexts(out)).toEqual(['B1', 'A2', 'A1']);
  });

  it('copies a photo shared by many pages only once (merged file is not inflated)', async () => {
    const src = await makePdf(['P1', 'P2', 'P3', 'P4'], { jpeg: true });
    const files = new Map([['a', file('a', src)], ['b', file('b', await makePdf(['B1']))]]);
    const out = await buildPdf(files, [
      { fileId: 'a', index: 3, rotation: 0 },
      { fileId: 'b', index: 0, rotation: 0 },
      { fileId: 'a', index: 0, rotation: 90 },
      { fileId: 'a', index: 1, rotation: 0 },
      { fileId: 'a', index: 2, rotation: 0 },
    ]);
    expect(await pageTexts(out)).toEqual(['P4', 'B1', 'P1', 'P2', 'P3']);
    expect(out.length).toBeLessThan(src.length + JPG.length);
  });

  it('turns JPEG and PNG images into pages', async () => {
    const files = new Map([
      ['j', file('j', JPG, 'image', 'image/jpeg')],
      ['p', file('p', PNG, 'image', 'image/png')],
    ]);
    const out = await buildPdf(files, [
      { fileId: 'j', index: 0, rotation: 0 },
      { fileId: 'p', index: 0, rotation: 0 },
    ], { pageSize: 'fit', orientation: 'auto', margin: 0 });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 48, height: 36 }); // 64x48 px at 0.75 pt/px
  });

  it('lays images out on A4 without upscaling and picks landscape for wide images', () => {
    const l = imagePageLayout(4000, 2000, { pageSize: 'a4', orientation: 'auto', margin: 36 });
    expect(l.pageW).toBeGreaterThan(l.pageH);
    expect(l.w).toBeLessThanOrEqual(l.pageW - 72 + 0.01);
    const small = imagePageLayout(100, 100, { pageSize: 'a4', orientation: 'portrait', margin: 0 });
    expect(small.w).toBe(75);
  });

  it('normalizes rotation', () => {
    expect([normalizeRotation(-90), normalizeRotation(450), normalizeRotation(360)]).toEqual([270, 90, 0]);
  });

  it('opens owner-only protected PDFs and asks for a password only when one is needed', async () => {
    const lock = async (userPassword: string) => {
      const doc = await PDFDocument.load(await makePdf(['secret']));
      doc.encrypt({ userPassword, ownerPassword: 'owner' });
      return doc.save();
    };
    // Restrictions only: opens without a password, output is no longer encrypted
    const restricted = await loadPdf(file('r', await lock('')));
    expect(restricted.getPageCount()).toBe(1);

    const locked = await lock('pw');
    await expect(loadPdf(file('s', locked))).rejects.toMatchObject({ name: 'EncryptedPdfError', wrongPassword: false });
    await expect(loadPdf({ ...file('s', locked), password: 'nope' })).rejects.toMatchObject({ wrongPassword: true });
    const files = new Map([['s', { ...file('s', locked), password: 'pw' }]]);
    const out = await buildPdf(files, [{ fileId: 's', index: 0, rotation: 0 }]);
    const reopened = await PDFDocument.load(out);
    expect(reopened.isEncrypted).toBe(false);
    expect(await pageTexts(out)).toEqual(['secret']);
  });
});

describe('compress', () => {
  it('keep-text mode recompresses JPEGs, keeps text and never grows the file', async () => {
    const input = await makePdf(['T1', 'T2'], { jpeg: true });
    let calls = 0;
    const { bytes, stats } = await compressKeepText(input, { quality: 0.5, maxSide: 32 }, async ({ jpeg }) => {
      calls++;
      // Pretend the browser produced a smaller JPEG at half size.
      return { bytes: jpeg.slice(0, Math.floor(jpeg.length / 2)), width: 32, height: 24 };
    });
    expect(stats.imagesFound).toBeGreaterThan(0);
    expect(calls).toBe(stats.imagesFound);
    expect(bytes.length).toBeLessThan(input.length);
    expect(await pageTexts(bytes)).toEqual(['T1', 'T2']);
    const doc = await PDFDocument.load(bytes);
    const img = doc.context.enumerateIndirectObjects().map(([, o]) => o).find((o) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') as PDFRawStream;
    expect(img.dict.get(PDFName.of('Width'))?.toString()).toBe('32');
  });

  it('keep-text mode returns the original when nothing gets smaller', async () => {
    const input = await makePdf(['T1'], { jpeg: true });
    const { bytes } = await compressKeepText(input, { quality: 0.9, maxSide: 4000 }, async () => null);
    expect(bytes.length).toBeLessThanOrEqual(input.length);
  });

  // Fake renderer: JPEG size grows with scale² and quality, like a real encoder.
  const fakeRasterizer = (pages: number) => async (scale: number): Promise<RasterPage[]> =>
    Array.from({ length: pages }, () => ({
      widthPt: 595,
      heightPt: 842,
      encode: async (q: number) => {
        const n = Math.round(60_000 * scale * scale * (0.2 + q));
        const out = new Uint8Array(n);
        out.set(JPG.subarray(0, Math.min(JPG.length - 2, n - 2)));
        out.set([0xff, 0xd9], n - 2);
        return out.length >= JPG.length ? out : JPG; // keep it a decodable JPEG header
      },
    }));

  it('target mode hits the size and prefers the sharpest scale that fits', async () => {
    const target = 200 * 1024;
    const r = await compressToTarget(target, fakeRasterizer(2));
    expect(r.reachedTarget).toBe(true);
    expect(r.bytes.length).toBeLessThanOrEqual(target);
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(2);
  });

  it('target mode returns a small-enough original untouched', async () => {
    const original = await makePdf(['tiny']);
    let rendered = false;
    const r = await compressToTarget(100 * 1024, async (s) => { rendered = true; return fakeRasterizer(1)(s); }, undefined, original);
    expect(r.alreadySmallEnough).toBe(true);
    expect(r.bytes).toBe(original);
    expect(rendered).toBe(false);
  });

  it('target mode says so when the target is impossible', async () => {
    const r = await compressToTarget(5 * 1024, fakeRasterizer(3));
    expect(r.reachedTarget).toBe(false);
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(3);
  });
});
