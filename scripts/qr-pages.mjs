// QR code generator landing pages: one tool, several search intents ("visiting card qr code"…).
//
// public/qr-generator-free.html is the TEMPLATE and is itself generated: every page is a copy
// with its own SEO head, hero, FAQ and starting QR type. Edit the template markup or this file,
// then run:  pnpm gen:pages     (tests/qr-pages.test.ts fails if a page is out of date)

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { esc, jsonBlock, region, addSitemapUrls } from './page-regions.mjs';

export const SITE = 'https://bharatdevtool.com';
export const MAIN_SLUG = 'qr-generator-free';
const BRAND = 'Bharat Dev Tools';
const OG_IMAGE = `${SITE}/og/qr-generator.png`;

const PRIVACY_FAQ = ['Is my data uploaded or tracked?', 'No. The QR code is created in your browser. Your links, Wi-Fi passwords, UPI ID and contact details are never sent to a server, and scans are not tracked.'];
const EXPIRY_FAQ = ['Will my QR code ever expire?', 'No. These are static QR codes: the link or details are stored inside the code itself, with no redirect through our servers. They keep working forever, even if this website disappears. Many other generators make dynamic codes that stop working when a trial or subscription ends.'];

const MAIN = {
  slug: MAIN_SLUG,
  preset: {},
  title: 'Free QR Code Generator with Logo',
  description: 'Free QR code generator for links, Wi-Fi, UPI, WhatsApp and contacts. Add a logo, colours and a frame. Never expires, no sign-up, no watermark.',
  keywords: 'qr code generator, free qr code generator, qr code with logo, upi qr code generator, wifi qr code, whatsapp qr code, vcard qr code, qr code that never expires, qr code svg',
  name: 'QR Code Generator',
  h1: 'Free QR Code Generator',
  lead: 'Links, Wi-Fi, UPI payments, WhatsApp, contacts and more. Add your logo and colours, check that it scans, and download it ready to print.',
  appDescription: 'Free QR code generator for links, Wi-Fi, UPI payments, WhatsApp, contacts, email, SMS, locations and events, with logo, colours, gradients and frames. Static codes that never expire, made in your browser.',
  faqs: [
    EXPIRY_FAQ,
    ['How do I make a QR code for UPI payments?', 'Choose UPI, enter your UPI ID (like name@okhdfcbank) and the name customers should see. Leave the amount empty for a shop QR where customers type the amount, or fill it in for a fixed bill. Any UPI app such as Google Pay, PhonePe or Paytm can scan it.'],
    ['Can I add my logo to the QR code?', 'Yes. Open Logo, upload a PNG, JPG or SVG, and choose its size. The code automatically switches to the highest error correction so it still scans, and the scan check confirms it before you download.'],
    ['How do I share my Wi-Fi with a QR code?', 'Choose Wi-Fi, type the network name and password and pick the security type (WPA/WPA2/WPA3 for most home routers). Guests point their phone camera at the code and join without typing the password. The password never leaves your device.'],
    ['Which format should I download for printing?', 'SVG for print: it stays sharp at any size, from a business card to a banner. For a quick image, PNG at 2048 or 4096 pixels works for most printing. The scan check tells you the smallest safe print size for your code.'],
    PRIVACY_FAQ,
  ],
};

const VISITING_CARD = {
  slug: 'visiting-card-qr-code',
  preset: { type: 'vcard', frameText: 'SAVE CONTACT' },
  title: 'Visiting Card QR Code Generator, Free',
  description: 'Free visiting card QR code: one scan saves your name, phone, email and company to contacts on iPhone and Android. Add your logo. Never expires, no sign-up.',
  keywords: 'visiting card qr code, business card qr code, vcard qr code generator, contact qr code, qr code to save contact, qr code for visiting card free',
  name: 'Visiting Card QR Code Generator',
  h1: 'Visiting Card QR Code Generator',
  lead: 'Put a QR code on your visiting card. One scan and your name, number, email, company and website are saved in the phone’s contacts, with no typing.',
  appDescription: 'Free visiting card (vCard) QR code generator: scanning saves the contact on iPhone and Android. Logo, colours and a "Save contact" frame, with a print-size check. Made in your browser.',
  faqs: [
    ['How does a visiting card QR code work?', 'The code holds your details in the standard vCard format. When someone points their phone camera at it, iPhone and Android offer "Add to contacts" with your name, number, email and company already filled in.'],
    ['Which details can I add?', 'First and last name, mobile number, email, company, job title, website and address. Fill in only what you need: fewer details make a simpler code that scans easily even when printed small. A photo can’t fit inside a QR code, but you can put your logo in the centre.'],
    ['How big should the QR code be on my card?', 'The scan check shows the smallest safe print size for your code, usually about 2 to 2.5 cm wide for a visiting card. Download the SVG for the printer so it stays sharp.'],
    ['What if my number or email changes?', 'Make a new code with the new details. The code never expires, but because your details are inside it, they can’t be changed after printing.'],
    PRIVACY_FAQ,
  ],
};

export const PAGES = [MAIN, VISITING_CARD];

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

  <!-- Social preview -->
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url(p)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(p.h1)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(p.description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">`;
}

function jsonld(p) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: p.name,
    description: p.appDescription,
    url: url(p),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    creator: { '@type': 'Organization', name: BRAND, url: SITE },
    featureList: [
      '11 QR types: link, text, Wi-Fi, UPI, WhatsApp, contact card (vCard), email, SMS, phone, location, event',
      'Logo in the centre, colours, gradients, dot and corner styles',
      'Frames with a call to action such as Scan me',
      'Automatic scan test and smallest safe print size',
      'PNG up to 4096 px and SVG for print',
      'Static codes that never expire, no tracking, no watermark',
      '100% in the browser: nothing is uploaded',
    ],
  };
  const crumbs = [{ name: 'Home', item: `${SITE}/` }, { name: 'QR Code Generator', item: `${SITE}/${MAIN_SLUG}.html` }];
  if (p.slug !== MAIN_SLUG) crumbs.push({ name: p.h1, item: url(p) });
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return [app, breadcrumb, faq].map((o) => `  <script type="application/ld+json">\n${jsonBlock(o)}\n  </script>`).join('\n\n');
}

const CHECK = '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

function hero(p) {
  const chips = ['Never expires', 'No sign-up, no watermark', 'No scan tracking', 'Made on your device'].map((c) => `        <span class="qr-chip">${CHECK}${c}</span>`).join('\n');
  return `    <!-- Hero -->
    <div class="text-center mb-8">
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">${esc(p.h1)}</h1>
      <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
        ${esc(p.lead)}
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
${chips}
      </div>
    </div>
    <script type="application/json" id="qrPage">${JSON.stringify(p.preset)}</script>`;
}

function faq(p) {
  return `    <!-- FAQ (generated with the FAQPage JSON-LD from scripts/qr-pages.mjs) -->
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

/** Render one page from the template HTML. */
export function renderPage(template, p) {
  let html = template;
  html = region(html, 'qr', 'seo', seo(p));
  html = region(html, 'qr', 'jsonld', jsonld(p));
  html = region(html, 'qr', 'hero', hero(p));
  html = region(html, 'qr', 'faq', faq(p));
  return html;
}

export function withSitemapEntries(xml, today) {
  return addSitemapUrls(xml, PAGES.map(url), url(MAIN), today);
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PUBLIC = join(process.cwd(), 'public');
  const template = readFileSync(join(PUBLIC, `${MAIN_SLUG}.html`), 'utf8');
  for (const p of PAGES) writeFileSync(join(PUBLIC, `${p.slug}.html`), renderPage(template, p));
  const sitemapPath = join(PUBLIC, 'sitemap.xml');
  writeFileSync(sitemapPath, withSitemapEntries(readFileSync(sitemapPath, 'utf8'), new Date().toISOString().slice(0, 10)));
  console.log(`Wrote ${PAGES.length} QR generator pages and updated the sitemap.`);
}
