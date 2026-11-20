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

const PRIVATE = 'No. The PDF is compressed inside your browser and never leaves your device, so marksheets, ID proofs and certificates stay private. Nothing is stored after you close the page.';

export const VARIANTS: ToolVariant[] = [
  {
    id: 'compress-pdf-100kb',
    route: '/compress-pdf-to-100kb',
    parentToolId: 'compress-pdf',
    label: 'Compress PDF to 100 KB',
    chip: '100 KB',
    description:
      'Free tool to compress a PDF to under 100 KB for exam, job and government forms. It picks the sharpest quality that fits. Runs in your browser, no upload.',
    keywords: ['compress pdf to 100kb', 'reduce pdf size to 100kb', 'pdf under 100kb', 'compress pdf 100 kb online', 'pdf size reducer 100kb'],
    faqs: [
      {
        question: 'How do I compress a PDF to under 100 KB?',
        answer:
          'Add the PDF, keep "Fit an exact size" set to 100 KB and press Compress PDF. The tool turns each page into an image and searches for the best quality that still fits under 100 KB, then shows the size it reached before you download.',
      },
      {
        question: 'Will my document still be readable at 100 KB?',
        answer:
          'For one or two pages of text, yes: the tool keeps the highest resolution that fits. Long scans or photo-heavy pages lose detail at 100 KB. If the result looks soft, remove pages you do not need or check whether the form accepts 200 KB.',
      },
      {
        question: 'Why does it say it could not get under 100 KB?',
        answer:
          'Very long documents cannot fit in 100 KB and stay readable, so the tool stops at the smallest readable version instead of producing a blur. Delete extra pages, split the PDF, or upload the pages as separate files.',
      },
      { question: 'Is my PDF uploaded to a server?', answer: PRIVATE },
    ],
  },
  {
    id: 'compress-pdf-200kb',
    route: '/compress-pdf-to-200kb',
    parentToolId: 'compress-pdf',
    label: 'Compress PDF to 200 KB',
    chip: '200 KB',
    description:
      'Free tool to reduce a PDF to under 200 KB for certificates, marksheets and scholarship forms. Shows the final size before download. Runs in your browser.',
    keywords: ['compress pdf to 200kb', 'reduce pdf size to 200kb', 'pdf under 200kb', 'certificate pdf 200kb', 'marksheet pdf compress'],
    faqs: [
      {
        question: 'How do I reduce a PDF to 200 KB for a certificate upload?',
        answer:
          'Drop the certificate PDF here. The page is already set to fit an exact size of 200 KB, so press Compress PDF and download the result. The size it reached is shown first, so you know it will be accepted.',
      },
      {
        question: 'Which forms ask for PDFs under 200 KB?',
        answer:
          'Many university, scholarship and state government portals limit marksheets, caste, income and domicile certificates to around 200 KB. Always check the size and format your form asks for; you can change the target size on this page.',
      },
      {
        question: 'Does compressing to 200 KB keep the text selectable?',
        answer:
          'If your PDF is already under 200 KB, nothing is changed and the text stays selectable. Otherwise the pages are saved as images to reach the size, so the text can no longer be selected. Upload portals do not need selectable text.',
      },
      { question: 'Are my certificates uploaded anywhere?', answer: PRIVATE },
    ],
  },
  {
    id: 'compress-pdf-500kb',
    route: '/compress-pdf-to-500kb',
    parentToolId: 'compress-pdf',
    label: 'Compress PDF to 500 KB',
    chip: '500 KB',
    description:
      'Free tool to compress a multi-page PDF to under 500 KB. Fits scanned documents and applications to an exact size, one file or many. Runs in your browser.',
    keywords: ['compress pdf to 500kb', 'reduce pdf size to 500kb', 'pdf under 500kb', 'compress scanned pdf 500kb', 'multi page pdf compress'],
    faqs: [
      {
        question: 'How do I compress a multi-page PDF to 500 KB?',
        answer:
          'Add the PDF and press Compress PDF: this page is set to fit an exact size of 500 KB. All pages are kept, in order, and the tool picks the sharpest resolution that keeps the whole file under 500 KB.',
      },
      {
        question: 'How many pages fit in 500 KB?',
        answer:
          'It depends on the content: text pages compress far better than colour photos. The tool reports the resolution it reached in DPI, so you can check that the pages are still readable before you download.',
      },
      {
        question: 'Can I compress several PDFs to 500 KB each at once?',
        answer:
          'Yes. Add all the files and turn on the option to compress each file separately. Every PDF is fitted under 500 KB on its own and you download them together as a ZIP.',
      },
      { question: 'Is my PDF uploaded to compress it?', answer: PRIVATE },
    ],
  },
  {
    id: 'compress-pdf-1mb',
    route: '/compress-pdf-to-1mb',
    parentToolId: 'compress-pdf',
    label: 'Compress PDF to 1 MB',
    chip: '1 MB',
    description:
      'Free tool to make a PDF smaller than 1 MB for portals with a 1 MB upload limit. Keeps text and stamps sharp and shows the final size. Runs in your browser.',
    keywords: ['compress pdf to 1mb', 'reduce pdf size to 1mb', 'pdf under 1mb', 'pdf less than 1 mb', 'compress pdf below 1mb'],
    faqs: [
      {
        question: 'How do I make a PDF smaller than 1 MB?',
        answer:
          'Add the PDF and press Compress PDF. This page is set to fit an exact size of 1 MB (1000 KB, so it also passes portals that count 1 MB as 1000 KB). The final size is shown before you download.',
      },
      {
        question: 'Will a PDF under 1 MB keep good quality?',
        answer:
          'Usually yes. 1 MB leaves room for a high resolution, so text, signatures and stamps stay sharp. If your file is already under 1 MB it is left unchanged, and the text stays selectable.',
      },
      {
        question: 'Should I use "Fit an exact size" or "Keep text sharp"?',
        answer:
          'Use "Fit an exact size" when a portal enforces a hard limit such as 1 MB. "Keep text sharp" only shrinks the photos inside the PDF and keeps text selectable, but it cannot promise a size.',
      },
      { question: 'Is my PDF uploaded to a server?', answer: PRIVATE },
    ],
  },
];

export function getVariant(id: string): ToolVariant | undefined {
  return VARIANTS.find((v) => v.id === id);
}

/** Variants of one tool, in registry order (drives the "Popular" row). */
export function variantsOf(parentToolId: string): ToolVariant[] {
  return VARIANTS.filter((v) => v.parentToolId === parentToolId);
}
