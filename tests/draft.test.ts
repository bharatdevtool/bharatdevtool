import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const PUBLIC_DIR = join(process.cwd(), 'public');
const SRC = readFileSync(join(PUBLIC_DIR, 'assets', 'js', 'draft.js'), 'utf8');

type DraftTest = {
  fits: (t: string) => boolean;
  pageKey: (id: string) => string;
  read: (k: string) => { v: string; t: number; m?: string } | null;
  write: (k: string, t: string, m?: string) => void;
  MAX_LINES: number;
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
  runInNewContext(SRC, { window, document, location: { pathname }, setTimeout, clearTimeout, JSON, Date });
  return { api: (window.BDTDraft as { _test: DraftTest })._test, store };
}

describe('draft.js (remember last input)', () => {
  let t: DraftTest;
  let store: Map<string, string>;
  beforeAll(() => ({ api: t, store } = load()));

  it('keeps text up to 300 lines and drops anything longer', () => {
    expect(t.fits('x\n'.repeat(t.MAX_LINES - 1) + 'x')).toBe(true);
    expect(t.fits('x\n'.repeat(t.MAX_LINES))).toBe(false);
    expect(t.fits('x'.repeat(200_000))).toBe(false); // one huge minified line
  });

  it('keys drafts by page and field', () => {
    expect(t.pageKey('input')).toBe('bdt_draft:/jsonformatter/#input');
    expect(load('/diff-checker.html').api.pageKey('original-text')).toBe('bdt_draft:/diff-checker#original-text');
  });

  it('stores, reads back, and removes empty or oversized text', () => {
    const k = t.pageKey('a');
    t.write(k, '{"a":1}', 'modeX');
    expect(t.read(k)).toMatchObject({ v: '{"a":1}', m: 'modeX' });
    t.write(k, '   ');
    expect(store.has(k)).toBe(false);
    t.write(k, '{}');
    t.write(k, 'x\n'.repeat(400));
    expect(store.has(k)).toBe(false); // too big: the old draft must not come back either
  });

  it('expires drafts after 7 days', () => {
    const k = t.pageKey('old');
    store.set(k, JSON.stringify({ v: 'old', t: Date.now() - 8 * 24 * 3600 * 1000 }));
    expect(t.read(k)).toBeNull();
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
