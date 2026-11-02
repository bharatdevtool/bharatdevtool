import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';
import { TOOLS } from '@/config/tools';

export const dynamic = 'force-static';

const STATIC_PAGES = ['/tools', '/about', '/privacy', '/feedback'];

/** Sitemap generated from the tools registry, so new tools are listed automatically */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...TOOLS.map((tool) => ({
      url: `${SITE.url}${tool.route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...STATIC_PAGES.map((path) => ({
      url: `${SITE.url}${path}`,
      changeFrequency: 'monthly' as const,
      priority: path === '/tools' ? 0.8 : 0.3,
    })),
  ];
}
