import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, PDFRawStream, decodePDFRawStream, PDFTextField, degrees } from '@cantoo/pdf-lib';
import { toPdfPoint, toPdfRect, displaySize, asRotation } from '@/lib/pdf/geometry';
import { applyEdits, readFormFields, redactedPages, replacePagesWithImages, type EditObject } from '@/lib/pdf/overlay';
import { addWatermark, addPageNumbers, formatPageNumber, fillWatermarkTemplate, DEFAULT_PAGE_NUMBERS } from '@/lib/pdf/stamp';
import { findSensitive, verhoeffValid, isAadhaar, type TextRun } from '@/lib/pdf/find';
import { createShare, openShare, readShareHeader, ShareError, shareWatermarkText } from '@/lib/pdf/secure';
import { wrapShareInPdf, extractShare, isShareCover } from '@/lib/pdf/secure-cover';
import { readMetadata, writeMetadata } from '@/lib/pdf/metadata';

const JPG = new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/pdf/sample.jpg')));
const PNG = new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/pdf/sample.png')));

async function makePdf(n: number, opts: { rotate?: number; size?: [number, number] } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const p = doc.addPage(opts.size ?? [300, 400]);
    p.drawText(`P${i}`, { x: 20, y: 360, size: 18, font });
    if (opts.rotate) p.setRotation(degrees(opts.rotate));
  }
  return doc.save();
}

/** All text shown with Tj on each page (pdf-lib writes hex strings). */
async function allText(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => {
    const raw = p.node.Contents();
    const list = raw && 'asArray' in raw ? (raw as unknown as { asArray(): unknown[] }).asArray() : [raw];
    const content = list
      .map((s) => doc.context.lookup(s as never) as PDFRawStream)
      .map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1'))
      .join('\n');
    return [...content.matchAll(/<([0-9A-Fa-f]+)> Tj/g)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join('|');
  });
}

describe('geometry', () => {
  const box = { x: 0, y: 0, w: 200, h: 100 };
  it('maps the displayed top-left corner for every rotation', () => {
    expect(toPdfPoint(0, 0, box, 0)).toEqual({ x: 0, y: 100 });
    expect(toPdfPoint(0, 0, box, 90)).toEqual({ x: 0, y: 0 });
    expect(toPdfPoint(0, 0, box, 180)).toEqual({ x: 200, y: 0 });
    expect(toPdfPoint(0, 0, box, 270)).toEqual({ x: 200, y: 100 });
  });
  it('maps rectangles and swaps the displayed size when sideways', () => {
    expect(displaySize(box, 90)).toEqual({ w: 100, h: 200 });
    expect(toPdfRect(0, 0, 1, 1, box, 270)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(toPdfRect(0.5, 0, 0.5, 0.25, box, 0)).toEqual({ x: 100, y: 75, w: 100, h: 25 });
    expect(asRotation(-90)).toBe(270);
  });
});

describe('editor (applyEdits)', () => {
  it('draws text, images, white-out, highlight and lines, on rotated pages too', async () => {
    const src = await makePdf(2, { rotate: 90 });
    const objects: EditObject[] = [
      { id: 't', type: 'text', page: 0, u: 0.1, v: 0.1, text: 'Hello\nWorld', size: 14, color: '#112233', bold: false },
      { id: 'i', type: 'image', page: 0, u: 0.5, v: 0.5, w: 0.2, h: 0.1, bytes: PNG, mime: 'image/png' },
      { id: 'w', type: 'rect', page: 1, u: 0, v: 0, w: 0.5, h: 0.5, style: 'whiteout', color: '#ffffff' },
      { id: 'h', type: 'rect', page: 1, u: 0.2, v: 0.2, w: 0.3, h: 0.05, style: 'highlight', color: '#ffeb3b' },
      { id: 'l', type: 'line', page: 1, u: 0.1, v: 0.9, u2: 0.9, v2: 0.9, color: '#000000', width: 2 },
    ];
    const out = await applyEdits(src, objects);
    const texts = await allText(out);
    expect(texts[0]).toContain('Hello');
    expect(texts[0]).toContain('World');
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it('falls back to an image for text the standard font cannot write (Hindi, ₹)', async () => {
    let called = 0;
    const out = await applyEdits(
      await makePdf(1),
      [{ id: 't', type: 'text', page: 0, u: 0.1, v: 0.1, text: 'नमस्ते ₹500', size: 12, color: '#000000', bold: false }],
      { imager: async () => { called++; return { png: PNG, widthPt: 60, heightPt: 14 }; } },
    );
    expect(called).toBe(1);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('fills and lists form fields', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const form = doc.getForm();
    form.createTextField('name').addToPage(page, { x: 20, y: 200, width: 200, height: 20 });
    form.createCheckBox('agree').addToPage(page, { x: 20, y: 150, width: 15, height: 15 });
    const src = await doc.save();
    expect((await readFormFields(src)).map((f) => [f.name, f.kind])).toEqual([['name', 'text'], ['agree', 'checkbox']]);
    const out = await applyEdits(src, [], { formValues: { name: 'Asha Rao', agree: true } });
    const f = await readFormFields(out);
    expect(f.find((x) => x.name === 'name')?.value).toBe('Asha Rao');
    expect(f.find((x) => x.name === 'agree')?.value).toBe(true);
    const flat = await applyEdits(src, [], { formValues: { name: 'Asha' }, flattenForm: true });
    expect(await readFormFields(flat)).toEqual([]);
    expect((await PDFDocument.load(out)).getForm().getField('name')).toBeInstanceOf(PDFTextField);
  });

  it('lists redacted pages and replaces them with images (text really gone)', async () => {
    const src = await makePdf(3);
    expect(redactedPages([
      { id: 'a', type: 'rect', page: 2, u: 0, v: 0, w: 0.1, h: 0.1, style: 'redact', color: '#000' },
      { id: 'b', type: 'rect', page: 0, u: 0, v: 0, w: 0.1, h: 0.1, style: 'redact', color: '#000' },
      { id: 'c', type: 'rect', page: 1, u: 0, v: 0, w: 0.1, h: 0.1, style: 'whiteout', color: '#fff' },
    ])).toEqual([0, 2]);
    const out = await replacePagesWithImages(src, new Map([[1, { bytes: JPG, mime: 'image/jpeg' as const }]]), { stripMetadata: true });
    expect(await allText(out)).toEqual(['P1', '', 'P3']);
  });
});

describe('watermark and page numbers', () => {
  it('fills preset templates', () => {
    expect(fillWatermarkTemplate('For KYC purpose only - {date}', { date: '10 Nov 2026' })).toBe('For KYC purpose only - 10 Nov 2026');
    expect(fillWatermarkTemplate('Shared with {name} - valid till {until}', { name: 'Rahul', until: '12 Nov' })).toBe('Shared with Rahul - valid till 12 Nov');
  });

  it('stamps every page in each layout, skipping chosen pages', async () => {
    for (const layout of ['diagonal', 'tiled', 'center', 'bottom', 'top'] as const) {
      const out = await addWatermark(await makePdf(2, { rotate: 270 }), { text: 'CONFIDENTIAL', layout, size: 40, color: '#ff0000', opacity: 0.2, bold: true, skipPages: [1] });
      const t = await allText(out);
      expect(t[0], layout).toContain('CONFIDENTIAL');
      expect(t[1], layout).not.toContain('CONFIDENTIAL');
    }
  });

  it('adds a logo watermark', async () => {
    const out = await addWatermark(await makePdf(1), { text: '', layout: 'center', size: 30, color: '#000', opacity: 0.3, bold: false, logo: { bytes: JPG, mime: 'image/jpeg', widthFraction: 0.4 } });
    expect(out.length).toBeGreaterThan(JPG.length);
  });

  it('numbers pages with formats, start number and a skipped cover', async () => {
    expect(formatPageNumber('page-n-of-total', 2, 9)).toBe('Page 2 of 9');
    const out = await addPageNumbers(await makePdf(3), { ...DEFAULT_PAGE_NUMBERS, skipFirst: true, start: 1 });
    const t = await allText(out);
    expect(t[0]).toBe('P1');
    expect(t[1]).toContain('Page 1 of 2');
    expect(t[2]).toContain('Page 2 of 2');
    const t2 = await allText(await addPageNumbers(await makePdf(2), { ...DEFAULT_PAGE_NUMBERS, format: 'n', start: 5 }));
    expect(t2).toEqual(['P1|5', 'P2|6']);
  });
});

describe('find sensitive data', () => {
  // A valid Aadhaar-style number: compute the Verhoeff check digit for a prefix.
  const prefix = '23456789012';
  const aadhaar = prefix + [...'0123456789'].find((d) => verhoeffValid(prefix + d))!;
  const spaced = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)}`;
  const run = (str: string, v = 0.1): TextRun => ({ str, u: 0.1, v, w: str.length * 0.01, h: 0.02 });

  it('validates Aadhaar with the Verhoeff checksum', () => {
    expect(isAadhaar(aadhaar)).toBe(true);
    expect(isAadhaar(prefix + ((Number(aadhaar[11]) + 1) % 10))).toBe(false);
    expect(isAadhaar('123456789012')).toBe(false); // cannot start with 0/1
  });

  it('finds Aadhaar, PAN, phone, email, IFSC and account numbers', () => {
    const runs = [run(`Aadhaar: ${spaced}`), run('PAN ABCDE1234F, IFSC SBIN0001234', 0.2), run('Call +91 98765 43210 or a@b.co', 0.3), run('A/c 123456789012345', 0.4)];
    const kinds = findSensitive(runs).map((m) => m.kind).sort();
    expect(kinds).toEqual(['aadhaar', 'account', 'email', 'ifsc', 'pan', 'phone']);
  });

  it('masks only the first 8 Aadhaar digits, with boxes inside the run', () => {
    const [m] = findSensitive([run(spaced)], { kinds: ['aadhaar-mask'] });
    expect(m.kind).toBe('aadhaar-mask');
    const box = m.boxes[0];
    expect(box.w).toBeLessThan(spaced.length * 0.01 * 0.8); // covers "XXXX XXXX" not the last 4
  });

  it('uses measured character offsets so boxes start exactly at the value', () => {
    // "A: 1234": narrow ': ' prefix; with offsets the box must start at or before the '1'.
    const str = 'PAN: ABCDE1234F';
    const charX = Array.from({ length: str.length + 1 }, (_, i) => (i <= 5 ? i * 0.04 : 0.2 + (i - 5) * 0.08));
    const runPan: TextRun = { str, u: 0.1, v: 0.1, w: 0.4, h: 0.02, charX };
    const [m] = findSensitive([runPan], { kinds: ['pan'] });
    const valueStart = 0.1 + charX[5] * 0.4;
    expect(m.boxes[0].u).toBeLessThanOrEqual(valueStart);
    expect(m.boxes[0].u + m.boxes[0].w).toBeGreaterThanOrEqual(0.5);
  });

  it('finds a custom phrase across runs', () => {
    const m = findSensitive([run('Ramesh'), run('Kumar', 0.1)], { kinds: [], custom: 'ramesh kumar' });
    expect(m).toHaveLength(1);
    expect(m[0].boxes).toHaveLength(2);
  });
});

describe('secure share', () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.7 fake pdf body for test');
  const now = Date.UTC(2026, 10, 10);

  it('round-trips without a password until it expires', async () => {
    const file = await createShare(pdfBytes, { name: 'a.pdf', expiresAt: now + 3600_000, recipient: 'Rahul', now });
    expect(readShareHeader(file).header).toMatchObject({ name: 'a.pdf', recipient: 'Rahul', kdf: 'none' });
    const { pdf } = await openShare(file, now + 1000);
    expect(new TextDecoder().decode(pdf)).toContain('fake pdf');
    await expect(openShare(file, now + 3600_001)).rejects.toMatchObject({ code: 'expired' });
  });

  it('needs the right password', async () => {
    const file = await createShare(pdfBytes, { name: 'b.pdf', expiresAt: now + 1000, password: 'pw-123', now });
    await expect(openShare(file, now)).rejects.toMatchObject({ code: 'needs-password' });
    await expect(openShare(file, now, 'nope')).rejects.toMatchObject({ code: 'wrong-password' });
    expect((await openShare(file, now, 'pw-123')).pdf.length).toBe(pdfBytes.length);
  });

  it('refuses a file whose expiry was edited', async () => {
    const file = await createShare(pdfBytes, { name: 'c.pdf', expiresAt: now + 1000, now });
    const text = new TextDecoder('latin1').decode(file);
    const later = String(now + 1000).replace(/^1/, '2'); // same length, far future
    const tampered = Uint8Array.from(text.replace(String(now + 1000), later), (c) => c.charCodeAt(0));
    await expect(openShare(tampered, now)).rejects.toBeInstanceOf(ShareError);
  });

  it('rejects other files', () => {
    expect(() => readShareHeader(pdfBytes)).toThrow(ShareError);
  });

  it('seals the print and watermark choices in the header (old files: no print, watermark on)', async () => {
    const old = readShareHeader(await createShare(pdfBytes, { name: 'o.pdf', expiresAt: now + 1000, recipient: 'Asha', now })).header;
    expect(old.allowPrint).toBeUndefined();
    expect(shareWatermarkText(old, '1 Jan')).toBe('Shared with Asha · until 1 Jan');
    const file = await createShare(pdfBytes, { name: 'n.pdf', expiresAt: now + 1000, allowPrint: true, watermark: false, now });
    const h = readShareHeader(file).header;
    expect(h).toMatchObject({ allowPrint: true, watermark: false });
    expect(shareWatermarkText(h, '1 Jan')).toBe('');
    // The choices are authenticated like the expiry: flipping them breaks decryption.
    const text = new TextDecoder('latin1').decode(file);
    const tampered = Uint8Array.from(text.replace('"watermark":false', '"watermark":true '), (c) => c.charCodeAt(0));
    await expect(openShare(tampered, now)).rejects.toBeInstanceOf(ShareError);
  });

  it('wraps the share in a cover PDF that explains how to open it, and gets it back out', async () => {
    const real = await makePdf(2);
    const share = await createShare(real, { name: 'Biodata — Final.pdf', expiresAt: now + 3600_000, password: 'pw-123', recipient: 'रवि Kumar', now });
    const cover = await wrapShareInPdf(share, {
      name: 'Biodata — Final.pdf', until: '10 Nov 2026, 6:30 pm', recipient: 'रवि Kumar', hasPassword: true, openUrl: 'https://bharatdevtool.com/open',
    });
    // A normal one-page PDF with a clickable link to the viewer, and none of the document's pages.
    const doc = await PDFDocument.load(cover);
    expect(doc.getPageCount()).toBe(1);
    const latin = Buffer.from(cover).toString('latin1');
    expect(latin).toContain('(https://bharatdevtool.com/open)');
    expect(isShareCover(cover)).toBe(true);
    expect(isShareCover(real)).toBe(false);
    expect(isShareCover(share)).toBe(false);
    // Same bytes come back out, and they still open with the password.
    const inner = await extractShare(cover);
    expect(inner).toEqual(share);
    expect((await openShare(inner, now, 'pw-123')).pdf).toEqual(real);
    expect(await extractShare(share)).toBe(share);
    await expect(extractShare(real)).rejects.toMatchObject({ code: 'not-a-share' });
  });
});

describe('metadata', () => {
  it('reads, writes and removes document properties', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setTitle('Old');
    doc.setAuthor('Someone');
    const src = await doc.save();
    expect((await readMetadata(src)).author).toBe('Someone');
    const edited = await writeMetadata(src, { title: 'New title', author: 'Me', subject: 'S', keywords: 'a, b' });
    expect(await readMetadata(edited)).toMatchObject({ title: 'New title', author: 'Me', subject: 'S', keywords: 'a b' });
    const wiped = await readMetadata(await writeMetadata(src, { title: '', author: '', subject: '', keywords: '' }, { removeAll: true }));
    expect([wiped.title, wiped.author, wiped.producer]).toEqual(['', '', '']);
  });
});
