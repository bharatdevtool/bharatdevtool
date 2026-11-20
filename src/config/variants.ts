// ============================================================
// variants.ts — landing pages that open an existing Next.js tool with a preset
// ("Compress PDF to 100 KB" opens Compress PDF in Exact size mode).
//
// A variant has its own URL, title, description, H1 and FAQs, is listed in
// public/sitemap.xml and linked from its parent tool's "Popular" row, but it is
// NOT a registry tool: it stays out of the footer, ⌘K and the homepage.
// The static HTML stack has the same idea via <meta name="bdt:variant-of">.
// ============================================================

import type { ToolFaq } from './faqs';

export interface ToolVariant {
  id: string;
  /** Clean root path, e.g. /compress-pdf-to-100kb */
  route: string;
  /** Registry id of the tool this page opens */
  parentToolId: string;
  /** H1, breadcrumb and title base, e.g. "Compress PDF to 100 KB" */
  label: string;
  /** Short text for the parent's "Popular" row, e.g. "100 KB" */
  chip: string;
  /** Meta description: 140–160 characters */
  description: string;
  keywords: string[];
  /** At least three; shown on the page and mirrored in FAQPage JSON-LD */
  faqs: ToolFaq[];
}

export const VARIANTS: ToolVariant[] = [];

export function getVariant(id: string): ToolVariant | undefined {
  return VARIANTS.find((v) => v.id === id);
}

/** Variants of one tool, in registry order (drives the "Popular" row). */
export function variantsOf(parentToolId: string): ToolVariant[] {
  return VARIANTS.filter((v) => v.parentToolId === parentToolId);
}
