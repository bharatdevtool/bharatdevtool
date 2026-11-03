// ============================================================
// seo.ts — SEO metadata factory
// Generates Next.js Metadata from the tools registry.
// Never write title/description inline in page files — use this.
// ============================================================

import type { Metadata } from 'next';
import { SITE } from './site';
import { getToolById } from './tools';

const OG_IMAGE = `${SITE.url}/assets/img/og/og-image.jpg`;

/** Generate full Metadata for a tool page */
export function generateToolMetadata(toolId: string): Metadata {
  const tool = getToolById(toolId);
  if (!tool) throw new Error(`Unknown tool id: "${toolId}" — add it to src/config/tools.ts`);

  const title = `${tool.label} — Free Online Tool | ${SITE.name}`;
  const canonical = `${SITE.url}${tool.route}`;

  return {
    title,
    description: tool.description,
    keywords: tool.keywords,
    authors: [{ name: SITE.name, url: SITE.url }],
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      title,
      description: tool.description,
      type: 'website',
      url: canonical,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${tool.label} — Free Online Tool` }],
      siteName: SITE.name,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: tool.description,
      images: [OG_IMAGE],
    },
    other: {
      'application-ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: tool.label,
        url: canonical,
        description: tool.description,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        creator: { '@type': 'Organization', name: SITE.name, url: SITE.url },
      }),
    },
  };
}

/** Generate metadata for static pages (about, privacy, etc.) */
export function generateStaticMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const title = `${opts.title} | ${SITE.name}`;
  const canonical = `${SITE.url}${opts.path}`;
  return {
    title,
    description: opts.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: opts.description,
      url: canonical,
      siteName: SITE.name,
    },
  };
}

/** Root metadata (applied to every page via layout.tsx) */
export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.tagline,
  icons: {
    icon: [
      { url: `${SITE.faviconBaseUrl}/bdt_logo_v3_32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${SITE.faviconBaseUrl}/bdt_logo_v3_16.png`, sizes: '16x16', type: 'image/png' },
    ],
    apple: `${SITE.faviconBaseUrl}/bdt_logo_v3_180.png`,
  },
};

