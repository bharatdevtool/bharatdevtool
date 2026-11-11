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
  MAX_CHARS: number;
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
  runInNewContext(SRC, { window, document, location: { pathname }, setTimeout, clearTimeout, JSON, Date });
  return { api: (window.BDTDraft as { _test: DraftTest })._test, store };
}

describe('draft.js (remember last input)', () => {
  let t: DraftTest;
  let store: Map<string, string>;
  beforeAll(() => ({ api: t, store } = load()));

  it('keeps a whole pasted JSON of any line count, up to about 1 MB', () => {
    expect(t.fits('{"a":1},\n'.repeat(50_000))).toBe(true); // 50,000 lines, ~450 KB
    expect(t.fits('x'.repeat(t.MAX_CHARS))).toBe(true);
    expect(t.fits('x'.repeat(t.MAX_CHARS + 1))).toBe(false);
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
    t.write(k, 'x'.repeat(t.MAX_CHARS + 1));
    expect(store.has(k)).toBe(false); // too big: the old draft must not come back either
  });

  it('drops the oldest other drafts to stay within the total budget', () => {
    const { api, store: st } = load();
    const big = 'y'.repeat(700_000);
    const now = Date.now();
    st.set('bdt_draft:/old#a', JSON.stringify({ v: big, t: now - 3000 }));
    st.set('bdt_draft:/mid#a', JSON.stringify({ v: big, t: now - 2000 }));
    st.set('unrelated', 'kept');
    api.write(api.pageKey('new'), big);
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
