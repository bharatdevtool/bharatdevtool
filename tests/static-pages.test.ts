import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Checks every static HTML page in public/ (the HTML half of the hybrid site).
const PUBLIC_DIR = join(process.cwd(), 'public');
const PAGES = [
  ...readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html')),
  'jsondiff/index.html',
  'jsonformatter/index.html',
];
// Site pages that are not tools: they need good meta tags but no FAQ.
const NON_TOOL_PAGES = new Set(['about.html', 'privacy.html', 'feedback.html', 'tools.html']);

const read = (page: string) => readFileSync(join(PUBLIC_DIR, page), 'utf8');
const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (html: string, attr: string, key: string) => {
  const tag = html.match(new RegExp(`<meta[^>]*\\b${attr}="${key}"[^>]*>`, 'i'))?.[0];
  const content = tag?.match(/content="([^"]*)"/)?.[1];
  return content === undefined ? undefined : decode(content);
};

/** Text a visitor can see: no head, scripts, styles or tag attributes. */
const visibleText = (html: string) =>
  html
    .replace(/<head[\s>][\s\S]*?<\/head>/i, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

// Emoji drawn as emoji (colour glyphs). Text symbols like → ↔ © ✕ are fine, and so
// are country flags (regional-indicator pairs), which are content, e.g. "🇮🇳 India (+91)".
const EMOJI = /(?![\u{1F1E6}-\u{1F1FF}])\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu;

describe('Static pages: icons', () => {
  it('uses SVG icons instead of emoji in visible markup', () => {
    const found: string[] = [];
    for (const page of PAGES) {
      const hits = visibleText(read(page)).match(EMOJI);
      if (hits) found.push(`${page}: ${[...new Set(hits)].join(' ')}`);
    }
    expect(found).toEqual([]);
  });

  it('uses SVG icons instead of emoji in the shared header and footer', () => {
    for (const file of ['header.js', 'footer.js']) {
      const src = readFileSync(join(PUBLIC_DIR, 'components', file), 'utf8');
      expect(src.match(EMOJI) ?? [], file).toEqual([]);
    }
  });
});

describe('Static pages: SEO', () => {
  for (const page of PAGES) {
    describe(page, () => {
      const html = read(page);
      const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
      const description = meta(html, 'name', 'description') ?? '';

      it('has a title of at most 60 characters', () => {
        expect(title.length, title).toBeGreaterThan(0);
        expect(title.length, title).toBeLessThanOrEqual(60);
      });

      it('has a description of 140–160 characters', () => {
        expect(description.length, description).toBeGreaterThanOrEqual(140);
        expect(description.length, description).toBeLessThanOrEqual(160);
      });

      it('points canonical and og:url at its own URL, as listed in the sitemap', () => {
        const own = `https://bharatdevtool.com/${page === 'index.html' ? '' : page.replace(/index\.html$/, '')}`;
        expect(html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]).toBe(own);
        expect(meta(html, 'property', 'og:url')).toBe(own);
      });

      it('keeps Open Graph and Twitter tags in sync with the title and description', () => {
        expect(meta(html, 'property', 'og:title')).toBe(title);
        expect(meta(html, 'property', 'og:description')).toBe(description);
        expect(meta(html, 'name', 'twitter:title')).toBe(title);
        expect(meta(html, 'name', 'twitter:description')).toBe(description);
      });

      if (!NON_TOOL_PAGES.has(page)) {
        it('has FAQPage structured data', () => {
          expect(html).toMatch(/"@type"\s*:\s*"FAQPage"/);
        });
      }
    });
  }
});
