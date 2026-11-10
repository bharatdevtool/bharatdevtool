import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, MAIN_SLUG, SITE, renderPage } from '../scripts/kb-pages.mjs';
import { EXAM_GROUPS, getGroup } from '../public/assets/js/exam-presets.js';
import { TOOLS } from '@/config/tools';

type Page = { slug: string; title: string; description: string; h1: string; faqs: string[][]; preset: { group?: string; doc?: string } };
const pages = PAGES as unknown as Page[];
const PUBLIC = join(process.cwd(), 'public');
const read = (slug: string) => readFileSync(join(PUBLIC, `${slug}.html`), 'utf8');
const template = read(MAIN_SLUG);
const sitemap = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');

describe('Resize-to-KB landing pages', () => {
  it('are up to date with scripts/kb-pages.mjs (run `pnpm gen:kb`)', () => {
    for (const p of pages) expect(read(p.slug) === renderPage(template, p), `${p.slug}.html is stale: run pnpm gen:kb`).toBe(true);
  });

  it('have unique slugs, titles, descriptions and H1s', () => {
    for (const key of ['slug', 'title', 'description', 'h1'] as const) {
      expect(new Set(pages.map((p) => p[key])).size, key).toBe(pages.length);
    }
  });

  it('keep titles within 60 characters and descriptions between 140 and 160', () => {
    for (const p of pages) {
      expect(`${p.title} | Bharat Dev Tools`.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(140);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
    }
  });

  it('are in the sitemap, self-canonical, and point to the registered tool', () => {
    expect(TOOLS.some((t) => t.route === `/${MAIN_SLUG}.html`)).toBe(true);
    for (const p of pages) {
      const html = read(p.slug);
      expect(sitemap, p.slug).toContain(`<loc>${SITE}/${p.slug}.html</loc>`);
      expect(html, p.slug).toContain(`<link rel="canonical" href="${SITE}/${p.slug}.html">`);
      if (p.slug !== MAIN_SLUG) expect(html, p.slug).toContain(`<meta name="bdt:variant-of" content="${MAIN_SLUG}">`);
    }
  });

  it('show the same FAQs as their FAQPage structured data, and the JSON-LD parses', () => {
    for (const p of pages) {
      const html = read(p.slug);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      expect(blocks.map((b) => b['@type']), p.slug).toEqual(['WebApplication', 'BreadcrumbList', 'FAQPage']);
      expect(blocks[2].mainEntity.length, p.slug).toBe(p.faqs.length);
      expect((html.match(/class="faq-item"/g) || []).length, p.slug).toBe(p.faqs.length);
      expect(p.faqs.length, p.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('preselect a real exam or size, and cover every exam', () => {
    for (const p of pages) {
      if (!p.preset.group) continue;
      const g = getGroup(p.preset.group);
      expect(g, p.slug).toBeDefined();
      if (p.preset.doc) expect(g!.docs.some((d) => d.id === p.preset.doc), p.slug).toBe(true);
    }
    const covered = new Set(pages.map((p) => p.preset.group));
    for (const g of EXAM_GROUPS) expect(covered.has(g.id), g.id).toBe(true);
  });

  it('load the shared page script, not an inline copy', () => {
    for (const p of pages) {
      const html = read(p.slug);
      expect(html, p.slug).toContain('<script type="module" src="assets/js/resize-to-kb-page.js"></script>');
      expect(html, p.slug).toContain('id="kbPage"');
    }
  });
});
