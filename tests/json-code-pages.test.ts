import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, MAIN_SLUG, SITE, renderPage } from '../scripts/json-code-pages.mjs';

type Page = { slug: string; lang: string; title: string; description: string; h1: string; faqs: string[][] };
const pages = PAGES as unknown as Page[];
const PUBLIC = join(process.cwd(), 'public');
const read = (slug: string) => readFileSync(join(PUBLIC, `${slug}.html`), 'utf8');
const sitemap = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');

describe('JSON to Kotlin / Swift / Dart landing pages', () => {
  it('are up to date with scripts/json-code-pages.mjs (run `pnpm gen:pages`)', () => {
    const template = read(MAIN_SLUG);
    for (const p of pages) expect(read(p.slug) === renderPage(template, p), `${p.slug}.html is stale: run pnpm gen:pages`).toBe(true);
  });

  it('have unique, well-sized titles and descriptions, sitemap entries, canonicals and FAQ data', () => {
    for (const key of ['slug', 'title', 'description', 'h1'] as const) expect(new Set(pages.map((p) => p[key])).size, key).toBe(pages.length);
    for (const p of pages) {
      expect(`${p.title} | Bharat Dev Tools`.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(140);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
      expect(sitemap, p.slug).toContain(`<loc>${SITE}/${p.slug}.html</loc>`);
      const html = read(p.slug);
      expect(html, p.slug).toContain(`<link rel="canonical" href="${SITE}/${p.slug}.html">`);
      expect(html, p.slug).toContain(`<meta name="bdt:variant-of" content="${MAIN_SLUG}">`);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      expect(blocks.map((b) => b['@type']), p.slug).toEqual(['WebApplication', 'BreadcrumbList', 'FAQPage']);
      expect((html.match(/class="faq-item"/g) || []).length, p.slug).toBe(p.faqs.length);
    }
  });

  it('opens each page on its language and accepts "Send to" for that language', () => {
    for (const p of pages) {
      const html = read(p.slug);
      expect(html).toContain(`<script type="application/json" id="codePage">{"lang":"${p.lang}"}</script>`);
      expect(html).toContain(`data-tool="${p.lang}"`);
    }
    const formatter = readFileSync(join(PUBLIC, 'jsonformatter', 'index.html'), 'utf8');
    for (const lang of ['kotlin', 'swift', 'dart']) expect(formatter).toContain(`data-send="${lang}"`);
  });
});
