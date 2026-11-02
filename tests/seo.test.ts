import { describe, it, expect } from 'vitest';
import { TOOLS } from '@/config/tools';
import { TOOL_FAQS } from '@/config/faqs';
import { SITE } from '@/config/site';
import { generateToolMetadata, generateToolJsonLd, getToolTitle } from '@/config/seo';
import sitemap from '@/app/sitemap';

describe('SEO registry', () => {
  it('gives every tool at least three FAQs', () => {
    for (const tool of TOOLS) {
      expect(TOOL_FAQS[tool.id]?.length ?? 0, tool.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('has no FAQs for unknown tools', () => {
    const ids = new Set(TOOLS.map((t) => t.id));
    expect(Object.keys(TOOL_FAQS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('keeps every full page title within 60 characters and brands it once', () => {
    for (const tool of TOOLS) {
      const title = `${getToolTitle(tool)} | ${SITE.name}`;
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(getToolTitle(tool)).not.toContain(SITE.name);
    }
  });

  it('keeps descriptions between 140 and 160 characters', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length, tool.id).toBeGreaterThanOrEqual(140);
      expect(tool.description.length, tool.id).toBeLessThanOrEqual(160);
    }
  });

  it('points social images at the published OG image', () => {
    const meta = generateToolMetadata('json-formatter');
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0].url).toBe(`${SITE.url}/og-image.jpg`);
  });

  it('emits WebApplication, BreadcrumbList and FAQPage structured data', () => {
    const types = generateToolJsonLd('lottie-player').map((s) => s['@type']);
    expect(types).toEqual(['WebApplication', 'BreadcrumbList', 'FAQPage']);
  });

  it('lists every tool route in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const tool of TOOLS) expect(urls).toContain(`${SITE.url}${tool.route}`);
    expect(urls.some((u) => u.endsWith('.html'))).toBe(false);
  });
});
