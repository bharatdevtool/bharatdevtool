import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS, TOOL_CATEGORIES, CATEGORY_SLUGS } from '@/config/tools';
import { TOOL_FAQS } from '@/config/faqs';
import { SITE } from '@/config/site';
import { generateToolMetadata, generateToolJsonLd, getToolTitle } from '@/config/seo';

// The sitemap is a static file: legacy HTML tools and Next.js tools share it.
const PUBLIC_DIR = join(process.cwd(), 'public');
const sitemapUrls = [...readFileSync(join(PUBLIC_DIR, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const toUrl = (route: string) => `${SITE.url}${route === '/index.html' ? '/' : route}`;

// Legacy tools are static HTML pages: their title, description and FAQ live in
// the HTML file, so the Next.js metadata rules below apply only to Next.js tools.
const NEXT_TOOLS = TOOLS.filter((t) => !t.legacy);

describe('SEO registry', () => {
  it('gives every Next.js tool at least three FAQs', () => {
    for (const tool of NEXT_TOOLS) {
      expect(TOOL_FAQS[tool.id]?.length ?? 0, tool.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('has no FAQs for unknown tools', () => {
    const ids = new Set(TOOLS.map((t) => t.id));
    expect(Object.keys(TOOL_FAQS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('keeps every full page title within 60 characters and brands it once', () => {
    for (const tool of NEXT_TOOLS) {
      const title = `${getToolTitle(tool)} | ${SITE.name}`;
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(getToolTitle(tool)).not.toContain(SITE.name);
    }
  });

  it('keeps descriptions between 140 and 160 characters', () => {
    for (const tool of NEXT_TOOLS) {
      expect(tool.description.length, tool.id).toBeGreaterThanOrEqual(140);
      expect(tool.description.length, tool.id).toBeLessThanOrEqual(160);
    }
  });

  it('gives every tool its own generated link-preview image', async () => {
    const meta = generateToolMetadata('compress-pdf');
    const images = meta.openGraph?.images as { url: string; width: number; height: number }[];
    expect(images[0]).toMatchObject({ url: `${SITE.url}/og/compress-pdf.png`, width: 1200, height: 630 });
    const { generateStaticParams } = await import('@/app/og/[id]/route');
    const ids = generateStaticParams().map((p) => p.id);
    for (const t of TOOLS) expect(ids, t.id).toContain(`${t.id}.png`);
  });

  it('emits WebApplication, BreadcrumbList and FAQPage structured data', () => {
    const types = generateToolJsonLd('lottie-player').map((s) => s['@type']);
    expect(types).toEqual(['WebApplication', 'BreadcrumbList', 'FAQPage']);
  });

  it('lists every registered tool route in the sitemap', () => {
    for (const tool of TOOLS) expect(sitemapUrls, tool.id).toContain(toUrl(tool.route));
  });

  it('lists every static HTML page in the sitemap', () => {
    const pages = readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html') && f !== 'index.html');
    for (const page of pages) expect(sitemapUrls, page).toContain(`${SITE.url}/${page}`);
  });

  it('has no duplicate sitemap entries', () => {
    expect(new Set(sitemapUrls).size).toBe(sitemapUrls.length);
  });

});

describe('Shared navigation', () => {
  const footerJs = readFileSync(join(PUBLIC_DIR, 'components', 'footer.js'), 'utf8');
  const footerHrefs = [...footerJs.matchAll(/href: '([^']+)'/g)].map((m) => m[1]).filter((h) => !h.startsWith('http'));
  const toFooterHref = (route: string) => (route === '/index.html' ? 'index.html' : route.replace(/^\//, ''));

  it('lists every registered tool in the static HTML footer', () => {
    for (const tool of TOOLS) expect(footerHrefs, tool.id).toContain(toFooterHref(tool.route));
  });

  it('registers every tool the static HTML footer links to', () => {
    const routes = TOOLS.map((t) => toFooterHref(t.route));
    for (const href of footerHrefs) expect(routes, href).toContain(href);
  });

  it('gives every tool page in public/ a registry entry', () => {
    const nonTools = ['about.html', 'privacy.html', 'feedback.html', 'tools.html', 'simple-qr.html'];
    const pages = readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html') && f !== 'index.html' && !nonTools.includes(f));
    const routes = TOOLS.map((t) => t.route);
    for (const page of pages) expect(routes, page).toContain(`/${page}`);
  });

  it('puts every footer entry in the same category as the registry', () => {
    const entries = [...footerJs.matchAll(/href: '([^']+)', cat: '([^']+)'/g)];
    expect(entries.length).toBe(TOOLS.length);
    for (const [, href, cat] of entries) {
      const tool = TOOLS.find((t) => toFooterHref(t.route) === href);
      expect(tool, href).toBeDefined();
      expect(cat, href).toBe(CATEGORY_SLUGS[tool!.category]);
    }
  });
});

describe('Tool categories', () => {
  const slugs = TOOL_CATEGORIES.map((c) => CATEGORY_SLUGS[c]);
  const footerJs = readFileSync(join(PUBLIC_DIR, 'components', 'footer.js'), 'utf8');
  const toolsHtml = readFileSync(join(PUBLIC_DIR, 'tools.html'), 'utf8');

  it('uses the same category ids, in the same order, in footer.js and tools.html', () => {
    const footerBlock = footerJs.slice(footerJs.indexOf('const TOOL_CATEGORIES'), footerJs.indexOf('];', footerJs.indexOf('const TOOL_CATEGORIES')));
    expect([...footerBlock.matchAll(/id: '([^']+)'/g)].map((m) => m[1])).toEqual(slugs);
    const labelsBlock = toolsHtml.slice(toolsHtml.indexOf('const CATEGORY_LABELS'), toolsHtml.indexOf('};', toolsHtml.indexOf('const CATEGORY_LABELS')));
    expect([...labelsBlock.matchAll(/^\s+'?([a-z-]+)'?: '/gm)].map((m) => m[1])).toEqual(slugs);
  });

  it('gives every tools.html card a known category', () => {
    const cats = [...toolsHtml.matchAll(/class="feature-card" data-category="([^"]+)"/g)].map((m) => m[1]);
    expect(cats.length).toBe(TOOLS.length);
    for (const c of cats) expect(slugs).toContain(c);
  });

  it('has no empty category', () => {
    for (const c of TOOL_CATEGORIES) expect(TOOLS.some((t) => t.category === c), c).toBe(true);
  });
});
