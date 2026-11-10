import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, MAIN_SLUG, SITE, renderPage } from '../scripts/qr-pages.mjs';

type Page = { slug: string; title: string; description: string; h1: string; faqs: string[][]; preset: { type?: string } };
const pages = PAGES as unknown as Page[];
const PUBLIC = join(process.cwd(), 'public');
const read = (slug: string) => readFileSync(join(PUBLIC, `${slug}.html`), 'utf8');
const sitemap = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');

describe('QR generator landing pages', () => {
  it('are up to date with scripts/qr-pages.mjs (run `pnpm gen:pages`)', () => {
    const template = read(MAIN_SLUG);
    for (const p of pages) expect(read(p.slug) === renderPage(template, p), `${p.slug}.html is stale: run pnpm gen:pages`).toBe(true);
  });

  it('have unique, well-sized titles and descriptions, sitemap entries and canonicals', () => {
    for (const key of ['slug', 'title', 'description', 'h1'] as const) expect(new Set(pages.map((p) => p[key])).size, key).toBe(pages.length);
    for (const p of pages) {
      expect(`${p.title} | Bharat Dev Tools`.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(140);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
      expect(sitemap, p.slug).toContain(`<loc>${SITE}/${p.slug}.html</loc>`);
      const html = read(p.slug);
      expect(html, p.slug).toContain(`<link rel="canonical" href="${SITE}/${p.slug}.html">`);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      expect(blocks.map((b) => b['@type']), p.slug).toEqual(['WebApplication', 'BreadcrumbList', 'FAQPage']);
      expect((html.match(/class="faq-item"/g) || []).length, p.slug).toBe(p.faqs.length);
    }
  });

  it('starts the visiting-card page on the contact card type', () => {
    expect(pages.find((p) => p.slug === 'visiting-card-qr-code')?.preset.type).toBe('vcard');
    expect(read('visiting-card-qr-code')).toContain('<script type="application/json" id="qrPage">{"type":"vcard"');
  });
});
