import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, MAIN_SLUG, SITE, renderPage, allFormats } from '../scripts/cron-pages.mjs';
import { validateCron } from '../public/assets/js/cron-formats.js';

type Page = { slug: string; format: string; expr: string; title: string; description: string; h1: string; faqs: string[][]; table?: Record<string, string | null> };
const pages = PAGES as unknown as Page[];
const PUBLIC = join(process.cwd(), 'public');
const read = (slug: string) => readFileSync(join(PUBLIC, `${slug}.html`), 'utf8');
const sitemap = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');

describe('cron landing pages', () => {
  it('are up to date with scripts/cron-pages.mjs (run `pnpm gen:pages`)', () => {
    const template = read(MAIN_SLUG);
    for (const p of pages) expect(read(p.slug) === renderPage(template, p), `${p.slug}.html is stale: run pnpm gen:pages`).toBe(true);
  });

  it('have unique, well-sized titles and descriptions, sitemap entries, canonicals and FAQ data', () => {
    expect(pages.length).toBe(16);
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
      expect(html, p.slug).toContain(`<script type="application/json" id="cronPage">${JSON.stringify({ format: p.format, expr: p.expr })}</script>`);
    }
  });

  it('only shows expressions that the checker accepts', () => {
    for (const p of pages) {
      expect(validateCron(p.expr, p.format).ok, p.slug).toBe(true);
      for (const [format, expr] of Object.entries(p.table ?? {})) if (expr) expect(validateCron(expr, format).ok, `${p.slug} ${format}`).toBe(true);
    }
    expect(allFormats('0 9 * * 1-5').aws).toBe('cron(0 9 ? * MON-FRI *)');
  });
});
