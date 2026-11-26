// ============================================================
// seo.ts — SEO metadata factory
// Generates Next.js Metadata from the tools registry.
// Never write title/description inline in page files — use this.
// ============================================================

import type { Metadata } from 'next';
import { SITE } from './site';
import { getToolById, type Tool } from './tools';
import { getToolFaqs } from './faqs';
import { getVariant, type ToolVariant } from './variants';

// Per-tool link-preview images are generated at build time by src/app/og/[id]/route.tsx.
const ogImage = (id = 'default') => `${SITE.url}/og/${id}.png`;
const OG_IMAGE = ogImage();
const OG_IMAGE_SIZE = { width: 1200, height: 630 };
const BRAND_SUFFIX = ` | ${SITE.name}`;
const MAX_TITLE_LENGTH = 60;

/**
 * Page title without the brand — the root layout's title template appends it.
 * Falls back to a shorter form when the full title would exceed 60 characters.
 */
export function getToolTitle(tool: Tool): string {
  return pageTitle(tool.label);
}

function pageTitle(label: string): string {
  const full = `${label} — Free Online Tool`;
  return full.length + BRAND_SUFFIX.length <= MAX_TITLE_LENGTH ? full : `Free ${label}`;
}

/** Page title (without brand) for a variant landing page. */
export function getVariantTitle(variant: ToolVariant): string {
  return pageTitle(variant.label);
}

function requireVariant(variantId: string): ToolVariant {
  const variant = getVariant(variantId);
  if (!variant) throw new Error(`Unknown variant id: "${variantId}" — add it to src/config/variants.ts`);
  return variant;
}

/** Metadata for a variant landing page; the link preview reuses the parent tool's image. */
export function generateVariantMetadata(variantId: string): Metadata {
  const variant = requireVariant(variantId);
  const title = getVariantTitle(variant);
  const socialTitle = `${title}${BRAND_SUFFIX}`;
  const canonical = `${SITE.url}${variant.route}`;
  const image = ogImage(variant.parentToolId);

  return {
    title,
    description: variant.description,
    keywords: variant.keywords,
    authors: [{ name: SITE.name, url: SITE.url }],
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description: variant.description,
      type: 'website',
      url: canonical,
      images: [{ url: image, ...OG_IMAGE_SIZE, alt: variant.label }],
      siteName: SITE.name,
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description: variant.description, images: [image] },
  };
}

/** WebApplication, breadcrumbs (Home › parent tool › variant) and FAQPage for a variant page. */
export function generateVariantJsonLd(variantId: string): Record<string, unknown>[] {
  const variant = requireVariant(variantId);
  const parent = getToolById(variant.parentToolId);
  if (!parent) throw new Error(`Variant "${variantId}" has unknown parent "${variant.parentToolId}"`);
  const canonical = `${SITE.url}${variant.route}`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: variant.label,
      url: canonical,
      description: variant.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      creator: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
        { '@type': 'ListItem', position: 2, name: parent.label, item: `${SITE.url}${parent.route}` },
        { '@type': 'ListItem', position: 3, name: variant.label, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: variant.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ];
}

/** Generate full Metadata for a tool page */
export function generateToolMetadata(toolId: string): Metadata {
  const tool = getToolById(toolId);
  if (!tool) throw new Error(`Unknown tool id: "${toolId}" — add it to src/config/tools.ts`);

  const title = getToolTitle(tool);
  const socialTitle = `${title}${BRAND_SUFFIX}`;
  const canonical = `${SITE.url}${tool.route}`;

  return {
    title,
    description: tool.description,
    keywords: tool.keywords,
    authors: [{ name: SITE.name, url: SITE.url }],
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description: tool.description,
      type: 'website',
      url: canonical,
      images: [{ url: ogImage(tool.id), ...OG_IMAGE_SIZE, alt: `${tool.label} — Free Online Tool` }],
      siteName: SITE.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: tool.description,
      images: [ogImage(tool.id)],
    },
  };
}

/** Structured data for a tool page: WebApplication, breadcrumbs and (when present) FAQPage */
export function generateToolJsonLd(toolId: string): Record<string, unknown>[] {
  const tool = getToolById(toolId);
  if (!tool) throw new Error(`Unknown tool id: "${toolId}" — add it to src/config/tools.ts`);

  const canonical = `${SITE.url}${tool.route}`;
  const schemas: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: tool.label,
      url: canonical,
      description: tool.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      creator: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
        { '@type': 'ListItem', position: 2, name: tool.label, item: canonical },
      ],
    },
  ];

  const faqs = getToolFaqs(toolId);
  if (faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }

  return schemas;
}

/** Generate metadata for static pages (about, privacy, etc.) */
export function generateStaticMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const socialTitle = `${opts.title}${BRAND_SUFFIX}`;
  const canonical = `${SITE.url}${opts.path}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description: opts.description,
      type: 'website',
      url: canonical,
      siteName: SITE.name,
      images: [{ url: OG_IMAGE, ...OG_IMAGE_SIZE, alt: SITE.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: opts.description,
      images: [OG_IMAGE],
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

