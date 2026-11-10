// Resize Image to KB landing pages: one tool, many search intents
// ("resize image to 20 kb", "ibps photo resize", "add name and date on photo"…).
//
// public/resize-image-to-kb.html is the TEMPLATE and is itself generated: every page is a
// copy of it with its own SEO head, hero, FAQ and preset. Edit the template's markup or
// this file, then run:  pnpm gen:kb
// tests/kb-pages.test.ts fails if a generated page is out of date.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXAM_GROUPS, getGroup, rangeText, dimsText } from '../public/assets/js/exam-presets.js';
import { esc, jsonBlock as json, region as replaceRegion, addSitemapUrls } from './page-regions.mjs';

export const SITE = 'https://bharatdevtool.com';
export const MAIN_SLUG = 'resize-image-to-kb';
const BRAND = 'Bharat Dev Tools';
const OG_IMAGE = `${SITE}/og/resize-image-to-kb.png`;

const PRIVACY_FAQ = ['Are my photos uploaded to a server?', 'No. Resizing happens entirely in your browser. Your photos and signature never leave your device, and they are gone when you close the page.'];
const PHONE_FAQ = ['Does it work on my phone?', 'Yes. Tap "Take a photo" to use the camera, or pick a photo from your gallery. iPhone photos (HEIC) open in Safari; in other browsers set Camera → Formats → Most Compatible first.'];

// ── Size pages ──────────────────────────────────────────────────────────────
const SIZES = [10, 20, 30, 50, 100, 200];

/** Exam documents whose upper limit is this size (from the presets). */
function docsAt(kb) {
  const out = [];
  for (const g of EXAM_GROUPS) {
    if (g.id === 'size') continue;
    for (const d of g.docs) if (d.maxKB === kb) out.push(`${g.short} ${d.label.toLowerCase()} (${rangeText(d)})`);
  }
  return out;
}

const SIZE_DESCRIPTIONS = {
  10: 'Free tool to resize a photo or signature to under 10 KB for any online form. Keeps it as sharp as possible, checks the size and works on phones. No upload.',
  20: 'Free tool to resize a photo or signature to under 20 KB for SSC, IBPS, SBI and other forms. Keeps it sharp, checks the size and works on phones. No upload.',
  30: 'Free tool to resize a photo or signature to under 30 KB for NEET, CTET and other forms. Keeps it sharp, checks the size and works on phones. No upload.',
  50: 'Free tool to resize a photo or signature to under 50 KB for IBPS, SBI, JEE and other forms. Keeps it sharp, checks the size and works on phones. No upload.',
  100: 'Free tool to resize a photo or document to under 100 KB for UPSC, CTET and bank forms. Keeps it sharp, checks the size and works on phones. No upload.',
  200: 'Free tool to resize a photo to under 200 KB for NEET, JEE Main, CUET and UPSC forms. Keeps it sharp, checks the size and works on phones. No upload.',
};

function sizePage(kb) {
  const fits = docsAt(kb);
  return {
    slug: `resize-image-to-${kb}kb`,
    nav: `${kb} KB`,
    preset: { group: 'size', doc: `${kb}kb` },
    title: `Resize Image to ${kb} KB Online Free`,
    description: SIZE_DESCRIPTIONS[kb],
    keywords: `resize image to ${kb}kb, compress image to ${kb}kb, photo ${kb}kb, reduce image size to ${kb} kb, signature ${kb}kb, image ${kb} kb converter`,
    h1: `Resize Image to ${kb} KB`,
    lead: `Get any photo or signature under ${kb} KB in one step. It stays as sharp as the limit allows, and you can see that it fits before you upload.`,
    facts: fits.length ? { title: `Forms that ask for ${kb} KB`, items: fits } : null,
    faqs: [
      [`How do I resize an image to ${kb} KB?`, `Drop your photo in (or tap "Take a photo" on a phone). "${kb} KB" is already selected, so the tool finds the best quality and pixel size under ${kb} KB straight away. Check the green ticks, then download the JPG.`],
      [`Will my photo still look clear at ${kb} KB?`, `It keeps the quality as high as the limit allows and only reduces the pixel size when it must. ${kb <= 20 ? 'Signatures stay crisp at this size; for photos, crop close to your face so the detail goes where it matters.' : 'At this size photos stay clear enough for any exam form.'}`],
      ['What if my form also has a minimum size or exact pixels?', 'Choose your exam in step 1, or "Custom size" to enter a minimum and maximum KB and an exact width and height in pixels or centimetres.'],
      PHONE_FAQ,
      PRIVACY_FAQ,
    ],
  };
}

// ── Exam pages ──────────────────────────────────────────────────────────────
const EXAMS = {
  banking: {
    slug: 'ibps-sbi-photo-signature-resize',
    title: 'IBPS & SBI Photo and Signature Resizer',
    description: 'Free IBPS and SBI photo resizer: photo 200×230 px 20–50 KB, signature, left thumb and handwritten declaration at the exact size. Checks every limit. No upload.',
    lead: 'Drop your photo, signature, left thumb impression and handwritten declaration together. Each one is sorted, cropped to the exact pixels and sized for IBPS PO, Clerk, RRB, SO and SBI forms.',
  },
  upsc: {
    slug: 'upsc-photo-signature-resize',
    title: 'UPSC Photo and Signature Resizer',
    description: 'Free UPSC photo and signature resizer with your name and photo date added below the photo. Sized for CSE, NDA and CDS forms and checked before you upload.',
    lead: 'Resize your photo and three-signature image for UPSC Civil Services, NDA, CDS and other UPSC forms, and add your name and the photo date at the bottom in one click.',
    stamp: true,
  },
  ssc: {
    slug: 'ssc-signature-resize',
    title: 'SSC Signature Resize to 10–20 KB',
    description: 'Free SSC signature resizer for CGL, CHSL, MTS and GD forms: 10–20 KB JPG, clean white background and dark ink. The photo is live-captured. No upload.',
    lead: 'SSC captures your photo live during the application, so the signature is the only image you upload. Make it 10–20 KB with clean white paper and dark, clear ink.',
  },
  neet: {
    slug: 'neet-photo-signature-resize',
    title: 'NEET Photo and Signature Resizer',
    description: 'Free NEET UG photo resizer: passport and postcard photos, signature and both thumb impressions, each sized to the NTA limit and checked. Nothing is uploaded.',
    lead: 'Prepare all five NEET UG images at once: passport-size photo, postcard-size photo, signature and left and right thumb impressions, each within the NTA limit.',
  },
  jee: {
    slug: 'jee-main-photo-signature-resize',
    title: 'JEE Main Photo and Signature Resizer',
    description: 'Free JEE Main photo and signature resizer: 3.5×4.5 cm photo and signature within the NTA KB limits, cropped to the right shape and checked. Nothing is uploaded.',
    lead: 'Get your JEE Main photo to the 3.5 × 4.5 cm shape and the right file size, and your signature clean and within the NTA limit.',
  },
  cuet: {
    slug: 'cuet-photo-signature-resize',
    title: 'CUET Photo and Signature Resizer',
    description: 'Free CUET UG and PG photo and signature resizer: 3.5×4.5 cm photo and a clean signature within the NTA KB limits, checked before upload. Nothing is uploaded.',
    lead: 'Resize your photo and signature for CUET UG and CUET PG: the photo cropped to 3.5 × 4.5 cm and both files within the NTA size limits.',
  },
  ctet: {
    slug: 'ctet-photo-signature-resize',
    title: 'CTET Photo and Signature Resizer',
    description: 'Free CTET photo and signature resizer: 3.5×4.5 cm photo up to 100 KB and a 3.5×1.5 cm signature, cropped to shape and checked for you. Nothing is uploaded.',
    lead: 'Crop your CTET photo to 3.5 × 4.5 cm and your signature to 3.5 × 1.5 cm, both within the CBSE size limits.',
  },
  rrb: {
    slug: 'rrb-signature-resize',
    title: 'RRB Signature Resizer for Railway Forms',
    description: 'Free RRB signature resizer for NTPC, Group D and ALP forms: the right KB size, clean white background and dark ink. The photo is live-captured. No upload.',
    lead: 'Railway forms capture your photo live, so you only upload a signature. Get it within the RRB limit with clean white paper and clear ink.',
  },
};

function examPage(groupId) {
  const g = getGroup(groupId);
  const e = EXAMS[groupId];
  const items = g.docs.map((d) => {
    const dims = dimsText(d);
    return `${d.label}: ${rangeText(d)}${dims ? `, ${dims}` : ''}${d.stamp ? ', name and date on the photo' : ''}`;
  });
  const photo = g.docs.find((d) => d.kind === 'photo');
  const sign = g.docs.find((d) => d.kind === 'signature');
  return {
    slug: e.slug,
    nav: g.short,
    preset: { group: groupId, ...(e.stamp ? { stamp: true } : {}) },
    title: e.title,
    description: e.description,
    keywords: `${g.short.toLowerCase()} photo resize, ${g.short.toLowerCase()} signature resize, ${g.short.toLowerCase()} photo size, ${g.short.toLowerCase()} signature size kb, ${g.short.toLowerCase()} image resizer`,
    h1: e.title.replace(/ Resizer.*$/, ' Resizer'),
    lead: e.lead,
    facts: { title: `What ${g.short} asks for`, items, note: g.note },
    faqs: [
      [
        `What photo and signature size does ${g.short} need?`,
        `${items.join('. ')}. These are the typical limits from recent notices; limits can change between cycles, so confirm them in your official notice.`,
      ],
      [
        `How do I resize my ${photo ? 'photo and signature' : 'signature'} for ${g.short}?`,
        `${g.short} is already selected. Drop in your ${g.docs.length > 1 ? 'images together: each one is matched to its document by shape (you can change it)' : 'signature'} and gets the right size. Check the green ticks, then download one by one or all as a ZIP.`,
      ],
      ...(e.stamp ? [[`How do I add my name and date on the ${g.short} photo?`, 'Tick "Add name and date below the photo", type your name and the date the photo was taken. They are printed in a white strip at the bottom, and the photo still meets the size limit.']] : []),
      ...(sign ? [['My signature looks grey or faint. Can this fix it?', '"Make signatures and handwriting clear" turns the paper pure white, darkens faint ink and trims the empty space around it, which is what upload portals and reviewers want.']] : []),
      PRIVACY_FAQ,
    ],
  };
}

// ── Feature pages ───────────────────────────────────────────────────────────
const FEATURES = [
  {
    slug: 'add-name-and-date-on-photo',
    nav: 'Name & date on photo',
    preset: { group: 'size', doc: '50kb', stamp: true },
    title: 'Add Name and Date on Photo for Exam Forms',
    description: 'Free tool to add your name and photo date below a passport photo for UPSC, SSC and state exam forms, then resize it to the KB limit. Nothing is uploaded.',
    keywords: 'add name and date on photo, photo with name and date, name and date below photo, upsc photo name date, ssc photo with date, photo date stamp',
    h1: 'Add Name and Date on Your Photo',
    lead: 'Print your name and the date the photo was taken in a clean white strip under your photo, the way UPSC and many state exams ask, and get it to the right file size in the same step.',
    facts: { title: 'How it looks', items: ['White strip at the bottom of the photo', 'Your name in capital letters, the date as DD-MM-YYYY', 'Black text, centred, sized to fit', 'Photo resized to your form\u2019s KB limit with the strip included'] },
    faqs: [
      ['How do I add my name and date on a photo?', 'Type your name and the date the photo was taken (today is filled in), then add your photo. The name and date are printed in a white strip below it. Choose your exam in step 1 to get its size limits too.'],
      ['Which exams need the name and date on the photo?', 'Many UPSC guides ask for it, and several state public service commissions and recruitment boards do too. If your notice mentions "name and date of photograph", use this.'],
      ['What date should I use?', 'The date the photo was actually taken. Many notices want a recent photo (for example within the last few months), so use a fresh photo.'],
      PHONE_FAQ,
      PRIVACY_FAQ,
    ],
  },
  {
    slug: 'signature-resize',
    nav: 'Signature resizer',
    preset: { group: 'size', doc: '20kb', clean: true },
    title: 'Signature Resizer for Online Forms',
    description: 'Free signature resizer: photo of your signature to a clean, white-background JPG of 10, 20 or 50 KB for exam and job forms. Darkens faint ink. No upload.',
    keywords: 'signature resize, signature resizer, resize signature to 20kb, signature 10kb, signature white background, clear signature for online form',
    h1: 'Signature Resizer for Online Forms',
    lead: 'Sign on white paper, take a photo, and get a clean signature: white background, dark ink, empty space trimmed, and the file size your form asks for.',
    facts: { title: 'What it fixes', items: ['Grey or shadowed paper becomes pure white', 'Faint ink becomes dark and clear', 'Empty space around the signature is trimmed', 'Sized to 10, 20, 50 KB or any limit'] },
    faqs: [
      ['How do I resize my signature to 20 KB?', 'Take a clear photo of your signature on white paper and add it here. "20 KB" is selected; pick another size if your form needs it. The signature is cleaned, trimmed and saved as a JPG under the limit.'],
      ['How do I make the background of my signature white?', '"Make signatures and handwriting clear" is on by default on this page. It turns the paper pure white and darkens the ink, keeping blue ink blue.'],
      ['My form needs exact pixels, like 140 × 60. Can it do that?', 'Yes. Choose your exam in step 1 (bank exams use 140 × 60 px), or "Custom size" to type any width and height.'],
      PHONE_FAQ,
      PRIVACY_FAQ,
    ],
  },
];

// ── Main page ───────────────────────────────────────────────────────────────
const MAIN = {
  slug: MAIN_SLUG,
  nav: 'All exams',
  preset: {},
  title: 'Free Image Resize to KB for Exam Forms',
  description: 'Free tool to resize photos and signatures to 20 KB, 50 KB or any size for SSC, IBPS, SBI, NEET, JEE and UPSC forms. Batch resize, nothing uploaded.',
  keywords: 'resize image to 20kb, compress image to 50kb, resize photo in kb, signature resize, ssc photo resize, ibps photo resize, neet photo size, exam photo resizer, image size reducer in kb',
  h1: 'Resize Image to KB for Exam Forms',
  lead: 'Get your photo, signature, thumb impression and declaration to the exact size your form asks for: 20 KB, 50 KB or any range, with a check that it will be accepted. All in your browser, nothing uploaded.',
  facts: null,
  faqs: [
    ['How do I resize a photo to 20 KB or 50 KB?', 'Choose your exam, or "Any form: exact size" and pick 20 KB or 50 KB, then drop your photo in. The tool finds the best quality and pixel size that fits the limit automatically. Check the green ticks and download the JPG.'],
    ['What photo and signature size do SSC, IBPS, NEET and UPSC need?', 'Each exam has its own limits; the table on this page lists the typical values. Bank exams (IBPS, SBI) ask for a 20–50 KB photo and a 10–20 KB signature, NTA exams (NEET, JEE Main, CUET) accept photos up to 200 KB, and SSC and RRB capture your photo live, so only the signature is uploaded. Where guides disagree we use the range that satisfies all of them. Always confirm in your official notice.'],
    ['Can I add my name and date on the photo?', 'Yes. Tick "Add name and date below the photo" and type them in. They are printed in a white strip at the bottom, as UPSC and several state exams ask.'],
    ['Can I resize my photo, signature, thumb impression and declaration together?', 'Yes. Drop all your files at once. Each one is matched to a document type by its shape, which you can change, and gets that document\u2019s size limit. Download them one by one or all together as a ZIP.'],
    ['What if my form needs a minimum file size?', 'If an image is still too small at full quality, the tool adds harmless padding data inside the JPG so it meets the minimum. The picture itself looks exactly the same. Files are also kept under the maximum whether the form counts 1 KB as 1000 or 1024 bytes.'],
    PRIVACY_FAQ,
  ],
};

export const PAGES = [
  MAIN,
  ...SIZES.map(sizePage),
  ...Object.keys(EXAMS).map(examPage),
  ...FEATURES,
];

// ── Rendering ───────────────────────────────────────────────────────────────
const url = (p) => `${SITE}/${p.slug}.html`;

function seo(p) {
  const title = `${p.title} | ${BRAND}`;
  return `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(p.description)}">
  <meta name="keywords" content="${esc(p.keywords)}">
  <meta name="author" content="${BRAND}">
  <meta name="robots" content="index, follow">${p.slug === MAIN_SLUG ? '' : `\n  <meta name="bdt:variant-of" content="${MAIN_SLUG}">`}
  <link rel="canonical" href="${url(p)}">

  <!-- Open Graph -->
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url(p)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(p.h1)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(p.description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">`;
}

function jsonld(p) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: p.h1,
    description: p.description,
    url: url(p),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    creator: { '@type': 'Organization', name: BRAND, url: SITE },
    featureList: [
      'Resize image to an exact KB range (minimum and maximum)',
      'Exam presets for IBPS, SBI, UPSC, SSC, NEET, JEE Main, CUET, CTET and RRB',
      'Exact pixel size or size in cm with DPI',
      'Name and date below the photo',
      'Signature clean-up: white background, dark ink',
      'Crop and rotate with a face guide',
      'Checks size, format, pixels and shape before download',
      '100% in the browser: nothing is uploaded',
    ],
  };
  const crumbs = [{ name: 'Home', item: `${SITE}/` }, { name: 'Resize Image to KB', item: `${SITE}/${MAIN_SLUG}.html` }];
  if (p.slug !== MAIN_SLUG) crumbs.push({ name: p.h1, item: url(p) });
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return [app, breadcrumb, faq].map((o) => `  <script type="application/ld+json">\n${json(o)}\n  </script>`).join('\n\n');
}

function hero(p) {
  const facts = p.facts
    ? `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 text-left max-w-2xl mx-auto">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">${esc(p.facts.title)}</h2>
      <ul class="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
${p.facts.items.map((i) => `        <li>${esc(i)}</li>`).join('\n')}
      </ul>${p.facts.note ? `\n      <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${esc(p.facts.note)}</p>` : ''}
    </div>`
    : '';
  return `    <!-- Hero -->
    <div class="text-center mb-8 animate-fade-in">
      <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
        ${esc(p.h1)}
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
        ${esc(p.lead)}
      </p>
    </div>${facts}
    <script type="application/json" id="kbPage">${JSON.stringify(p.preset)}</script>`;
}

function links(p) {
  const chip = (q) => `<a href="${q.slug}.html"${q.slug === p.slug ? ' aria-current="page"' : ''}>${esc(q.nav)}</a>`;
  const sizes = PAGES.filter((q) => q.preset.group === 'size' && /^resize-image-to-\d+kb$/.test(q.slug));
  const exams = PAGES.filter((q) => q.preset.group && q.preset.group !== 'size');
  const more = [MAIN, ...FEATURES];
  return `    <!-- Related pages and tools -->
    <nav class="kb-related bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-8 text-sm text-gray-700 dark:text-gray-300" aria-label="More resize pages">
      <p class="mb-1"><span class="font-medium">Sizes:</span> ${sizes.map(chip).join(' ')}</p>
      <p class="mb-1"><span class="font-medium">Exams:</span> ${exams.map(chip).join(' ')}</p>
      <p class="mb-3"><span class="font-medium">More:</span> ${more.map(chip).join(' ')}</p>
      <p class="text-gray-600 dark:text-gray-400">
        Need something else? Try the <a href="image-compressor.html">Image Compressor</a>, <a href="image-resizer.html">Image Resizer</a> or <a href="/jpg-to-pdf">Image to PDF</a>.
      </p>
    </nav>`;
}

function faq(p) {
  return `    <!-- FAQ (generated with the FAQPage JSON-LD from scripts/kb-pages.mjs) -->
    <section class="faq-section" id="faq">
      <div class="faq-container">
        <h2 class="section-title">Frequently Asked Questions</h2>
        <div class="faq-list">
${p.faqs
  .map(
    ([q, a]) => `          <div class="faq-item">
            <button class="faq-question" aria-expanded="false"><span>${esc(q)}</span><span class="faq-icon">+</span></button>
            <div class="faq-answer"><p>${esc(a)}</p></div>
          </div>`,
  )
  .join('\n')}
        </div>
      </div>
    </section>`;
}

const region = (html, name, body) => replaceRegion(html, 'kb', name, body);

/** Render one page from the template HTML. */
export function renderPage(template, p) {
  let html = template;
  html = region(html, 'seo', seo(p));
  html = region(html, 'jsonld', jsonld(p));
  html = region(html, 'hero', hero(p));
  html = region(html, 'links', links(p));
  html = region(html, 'faq', faq(p));
  return html;
}

/** Add any missing page to the sitemap, right after the main page. */
export function withSitemapEntries(xml, today) {
  return addSitemapUrls(xml, PAGES.map(url), url(MAIN), today);
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PUBLIC = join(process.cwd(), 'public');
  const templatePath = join(PUBLIC, `${MAIN_SLUG}.html`);
  const template = readFileSync(templatePath, 'utf8');
  for (const p of PAGES) writeFileSync(join(PUBLIC, `${p.slug}.html`), renderPage(template, p));
  const sitemapPath = join(PUBLIC, 'sitemap.xml');
  writeFileSync(sitemapPath, withSitemapEntries(readFileSync(sitemapPath, 'utf8'), new Date().toISOString().slice(0, 10)));
  console.log(`Wrote ${PAGES.length} Resize-to-KB pages and updated the sitemap.`);
}
