import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const PUBLIC_DIR = join(process.cwd(), 'public');
const SRC = readFileSync(join(PUBLIC_DIR, 'assets', 'js', 'draft.js'), 'utf8');

type Rec = { v?: string; z?: string; t: number; m?: string };
type DraftTest = {
  pageKey: (id: string) => string;
  readRecord: (k: string) => Rec | null;
  recordText: (d: Rec) => Promise<string>;
  writePlain: (k: string, t: string, m?: string) => void;
  writeCompressed: (k: string, t: string, m?: string, isCurrent?: () => boolean) => Promise<void>;
  MAX_TEXT: number;
  MAX_STORED: number;
  TOTAL_BUDGET: number;
};

/** Load draft.js against a minimal fake browser (localStorage, location, document). */
function load(pathname = '/jsonformatter/') {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const window: Record<string, unknown> = { localStorage, addEventListener() {} };
  const document = { readyState: 'loading', addEventListener() {}, querySelectorAll: () => [] };
  runInNewContext(SRC, {
    window, document, location: { pathname }, setTimeout, clearTimeout, JSON, Date,
    CompressionStream, DecompressionStream, Response, Blob, TextEncoder, TextDecoder, btoa, atob, Uint8Array, String,
  });
  return { api: (window.BDTDraft as { _test: DraftTest })._test, store };
}

const bigJson = (n: number) =>
  JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: i, name: `user ${i}`, email: `u${i}@example.com`, active: i % 2 === 0 })), null, 2);

describe('draft.js (remember last input)', () => {
  let t: DraftTest;
  let store: Map<string, string>;
  beforeAll(() => ({ api: t, store } = load()));

  it('keys drafts by page and field', () => {
    expect(t.pageKey('input')).toBe('bdt_draft:/jsonformatter/#input');
    expect(load('/diff-checker.html').api.pageKey('original-text')).toBe('bdt_draft:/diff-checker#original-text');
  });

  it('compresses large JSON and gives back exactly the same text', async () => {
    const text = bigJson(6000); // ~870 KB, 60,000 lines
    const k = t.pageKey('big');
    await t.writeCompressed(k, text, 'modeX');
    const rec = t.readRecord(k)!;
    expect(rec.z).toBeTypeOf('string');
    expect(store.get(k)!.length).toBeLessThan(text.length / 5); // at least 5x smaller
    expect(await t.recordText(rec)).toBe(text);
    expect(rec.m).toBe('modeX');
  });

  it('keeps text that is not valid JSON, and big numbers, exactly as typed', async () => {
    const text = '{\n  "id": 12345678901234567890,\n  "half": [1, 2,\n' + '  "x",\n'.repeat(500);
    const k = t.pageKey('raw');
    await t.writeCompressed(k, text);
    expect(await t.recordText(t.readRecord(k)!)).toBe(text);
  });

  it('keeps JSON far larger than 1 MB when it compresses under the per-field limit', async () => {
    const text = bigJson(20000); // ~2.9 MB of text
    expect(text.length).toBeGreaterThan(t.MAX_STORED);
    const k = t.pageKey('huge');
    await t.writeCompressed(k, text);
    expect(store.get(k)!.length).toBeLessThanOrEqual(t.MAX_STORED);
    expect(await t.recordText(t.readRecord(k)!)).toBe(text);
    store.delete(k);
  });

  it('writes plain text instantly for a closing tab, and reads it back', async () => {
    const k = t.pageKey('plain');
    t.writePlain(k, '{"a":1}');
    expect(t.readRecord(k)).toMatchObject({ v: '{"a":1}' });
    expect(await t.recordText(t.readRecord(k)!)).toBe('{"a":1}');
  });

  it('removes empty or oversized text, so an old draft never comes back', async () => {
    const k = t.pageKey('a');
    t.writePlain(k, '{}');
    t.writePlain(k, '   ');
    expect(store.has(k)).toBe(false);
    t.writePlain(k, '{}');
    await t.writeCompressed(k, 'x'.repeat(t.MAX_TEXT + 1));
    expect(store.has(k)).toBe(false);
  });

  it('drops a compressed save that finished after a newer save', async () => {
    const k = t.pageKey('race');
    const slow = t.writeCompressed(k, bigJson(500), undefined, () => false); // superseded
    t.writePlain(k, '{"newer":true}');
    await slow;
    expect(t.readRecord(k)).toMatchObject({ v: '{"newer":true}' });
  });

  it('drops the oldest other drafts to stay within the total budget', () => {
    const { api, store: st } = load();
    const big = 'y'.repeat(700_000);
    const now = Date.now();
    st.set('bdt_draft:/old#a', JSON.stringify({ v: big, t: now - 3000 }));
    st.set('bdt_draft:/mid#a', JSON.stringify({ v: big, t: now - 2000 }));
    st.set('unrelated', 'kept');
    api.writePlain(api.pageKey('new'), big);
    expect(st.has('bdt_draft:/old#a')).toBe(false);
    expect(st.has('bdt_draft:/mid#a')).toBe(true);
    expect(st.has(api.pageKey('new'))).toBe(true);
    expect(st.get('unrelated')).toBe('kept');
    const total = [...st].filter(([k]) => k.startsWith('bdt_draft:')).reduce((n, [, v]) => n + v.length, 0);
    expect(total).toBeLessThanOrEqual(api.TOTAL_BUDGET);
  });

  it('expires drafts after 7 days', () => {
    const k = t.pageKey('old');
    store.set(k, JSON.stringify({ v: 'old', t: Date.now() - 8 * 24 * 3600 * 1000 }));
    expect(t.readRecord(k)).toBeNull();
    expect(store.has(k)).toBe(false);
  });
});

describe('draft.js wiring', () => {
  const pages = [...readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html')), 'jsondiff/index.html', 'jsonformatter/index.html'];
  const read = (p: string) => readFileSync(join(PUBLIC_DIR, p), 'utf8');

  it('loads draft.js on every page that opts a field in', () => {
    for (const p of pages) {
      const html = read(p);
      if (/\bdata-draft\b/.test(html)) expect(html, p).toMatch(/assets\/js\/draft\.js/);
    }
  });

  it('never keeps drafts on tools that handle secrets', () => {
    for (const p of ['jwt-decoder.html', 'hash-generator.html', 'curl-tester.html', 'curl-comparison.html', 'base64.html', 'url-encoder.html']) {
      expect(read(p), p).not.toMatch(/\bdata-draft\b|draft\.js/);
    }
  });
});
