import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// The homepage <head> script that sends typed/bookmarked visits to the last tool used.
const html = readFileSync(join(__dirname, '../public/index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes('bdt_auto_opened'));

interface Visit {
  cookie?: string;
  referrer?: string;
  search?: string;
  hash?: string;
  session?: Record<string, string>;
}

function visit({ cookie = '', referrer = '', search = '', hash = '', session = {} }: Visit) {
  const store: Record<string, string> = { ...session };
  let replacedWith: string | null = null;
  runInNewContext(script!, {
    document: { cookie, referrer },
    location: {
      pathname: '/',
      search,
      hash,
      replace: (u: string) => {
        replacedWith = u;
      },
    },
    history: { replaceState: () => {} },
    sessionStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    },
  });
  return { replacedWith, store };
}

const last = (p: string) => `_ga=GA1.1.1; bdt_visited=1; bdt_last_tool=${encodeURIComponent(p)}`;

describe('homepage: return to the last tool', () => {
  it('finds the script', () => {
    expect(script).toBeTruthy();
  });

  it('sends a typed or bookmarked visit to the last tool, once per tab', () => {
    const r = visit({ cookie: last('/deeplink.html') });
    expect(r.replacedWith).toBe('/deeplink.html');
    expect(r.store.bdt_auto_opened).toBe('1');
    expect(r.store.bdt_auto_note).toBe('1');
    expect(visit({ cookie: last('/deeplink.html'), session: r.store }).replacedWith).toBeNull();
  });

  it('works for Next.js tools, folders and generated pages', () => {
    expect(visit({ cookie: last('/compress-pdf') }).replacedWith).toBe('/compress-pdf');
    expect(visit({ cookie: last('/jsonformatter/') }).replacedWith).toBe('/jsonformatter/');
    expect(visit({ cookie: last('/resize-image-to-20kb.html') }).replacedWith).toBe('/resize-image-to-20kb.html');
  });

  it('keeps visitors from Google, links and the logo on the directory', () => {
    expect(visit({ cookie: last('/deeplink.html'), referrer: 'https://www.google.com/' }).replacedWith).toBeNull();
    expect(visit({ cookie: last('/deeplink.html'), referrer: 'https://bharatdevtool.com/deeplink.html' }).replacedWith).toBeNull();
  });

  it('stays on the directory for "See all tools" (?all), other queries and hashes', () => {
    expect(visit({ cookie: last('/deeplink.html'), search: '?all' }).replacedWith).toBeNull();
    expect(visit({ cookie: last('/deeplink.html'), hash: '#pdf' }).replacedWith).toBeNull();
  });

  it('does nothing without a cookie (first visit, bots)', () => {
    expect(visit({}).replacedWith).toBeNull();
  });

  it('never follows unsafe or non-tool cookie values', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/', '/index.html', '/test/x.html', '/open', '/og/x', '/a/../b', 'javascript:alert(1)']) {
      expect(visit({ cookie: last(bad) }).replacedWith, bad).toBeNull();
    }
  });

  it('still forwards old #json= share links to the JSON Formatter', () => {
    expect(visit({ cookie: last('/deeplink.html'), hash: '#json=abc' }).replacedWith).toBe('/jsonformatter/#json=abc');
  });
});
