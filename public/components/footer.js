// Footer Component JavaScript - Simple and clean

/**
 * Returns base path for relative URLs (e.g. "" at root, "../" in jsondiff/ or jsondiff/index.html)
 * @returns {string}
 */
function getFooterBasePath() {
  const pathname = window.location.pathname || '/';
  const segments = pathname.split('/').filter(function(s) { return s.length > 0; });
  if (segments.length === 0) return '';
  const lastSegment = segments[segments.length - 1];
  const isFile = lastSegment.indexOf('.') > -1;
  const depth = isFile ? segments.length - 1 : segments.length;
  return depth > 0 ? '../'.repeat(depth) : '';
}

/** Link to the homepage (the tool directory), relative so it also works from sub-folders. */
function homeHref() {
  return getFooterBasePath() || './';
}

/** Alpha for All tools button backgrounds: 0 = fully transparent, 1 = fully opaque. Change this to see effect. */
const ALL_TOOLS_BUTTON_ALPHA = 0.07;

/**
 * Returns a random color with given alpha (0–1). Uses HSL for pleasant hues.
 * @param {number} alpha - 0 = transparent, 1 = opaque
 * @returns {string} hsla(...) CSS value
 */
function getRandomColorWithAlpha(alpha) {
  const h = Math.floor(Math.random() * 360);
  const s = 55;
  const l = 50;
  return 'hsla(' + h + ',' + s + '%,' + l + '%,' + alpha + ')';
}

/** Tool list: { label, href } - href is relative to root or full URL for external */
const ALL_TOOLS_LIST = [
  { label: 'JSON Formatter', href: 'jsonformatter/', cat: 'json' },
  { label: 'JSON Diff', href: 'jsondiff/', cat: 'json' },
  { label: 'DeepLink Launcher', href: 'deeplink.html', cat: 'qr-links' },
  { label: 'URL Encoder', href: 'url-encoder.html', cat: 'qr-links' },
  { label: 'Base64 Encoder', href: 'base64.html', cat: 'security' },
  { label: 'QR Code Generator', href: 'qr-generator-free.html', cat: 'qr-links' },
  { label: 'QR Code Decoder', href: 'qr-decoder.html', cat: 'qr-links' },
  { label: 'Regex Tester', href: 'regex-tester.html', cat: 'developer' },
  { label: 'Regex Generator', href: 'regex-generator.html', cat: 'developer' },
  { label: 'Regex Library', href: 'regex-library.html', cat: 'developer' },
  { label: 'Color Picker', href: 'color-picker.html', cat: 'design' },
  { label: 'Gradient Generator', href: 'gradient-generator.html', cat: 'design' },
  { label: 'cURL Tester', href: 'curl-tester.html', cat: 'developer' },
  { label: 'cURL Comparison', href: 'curl-comparison.html', cat: 'developer' },
  { label: 'WhatsApp Link Generator', href: 'whatsapp-link.html', cat: 'qr-links' },
  { label: 'UUID Generator', href: 'uuid-generator.html', cat: 'security' },
  { label: 'Percentage Calculator', href: 'percentage-calculator.html', cat: 'calculators' },
  { label: 'BMI Calculator', href: 'bmi-calculator.html', cat: 'calculators' },
  { label: 'GST Calculator', href: 'gst-calculator.html', cat: 'calculators' },
  { label: 'EMI Calculator', href: 'emi-calculator.html', cat: 'calculators' },
  { label: 'Unix Timestamp Converter', href: 'timestamp-converter.html', cat: 'calculators' },
  { label: 'JWT Decoder', href: 'jwt-decoder.html', cat: 'security' },
  { label: 'PNG ↔ JPG Converter', href: 'image-converter.html', cat: 'image' },
  { label: 'Image Resizer', href: 'image-resizer.html', cat: 'image' },
  { label: 'Image Compressor', href: 'image-compressor.html', cat: 'image' },
  { label: 'Resize Image to KB', href: 'resize-image-to-kb.html', cat: 'image' },
  { label: 'Hash Generator', href: 'hash-generator.html', cat: 'security' },
  { label: 'CSV ↔ JSON Converter', href: 'csv-json-converter.html', cat: 'json' },
  { label: 'YAML ↔ JSON Converter', href: 'yaml-json-converter.html', cat: 'json' },
  { label: 'Diff Checker', href: 'diff-checker.html', cat: 'developer' },
  { label: 'Cron Expression Generator', href: 'cron-generator.html', cat: 'developer' },
  { label: 'Lorem Ipsum Generator', href: 'lorem-ipsum.html', cat: 'developer' },
  { label: 'Timezone Converter', href: 'timezone-converter.html', cat: 'calculators' },
  { label: 'Markdown to HTML', href: 'markdown-to-html.html', cat: 'developer' },
  { label: 'JSON to TypeScript Interface', href: 'json-to-typescript.html', cat: 'json' },
  { label: 'HTML Formatter & Beautifier', href: 'html-formatter.html', cat: 'developer' },
  { label: 'Favicon Generator', href: 'favicon-generator.html', cat: 'image' },
  { label: 'Compress PDF', href: 'compress-pdf', cat: 'pdf' },
  { label: 'Merge PDF', href: 'merge-pdf', cat: 'pdf' },
  { label: 'Split PDF', href: 'split-pdf', cat: 'pdf' },
  { label: 'Organize PDF', href: 'organize-pdf', cat: 'pdf' },
  { label: 'PDF to JPG', href: 'pdf-to-jpg', cat: 'pdf' },
  { label: 'JPG to PDF', href: 'jpg-to-pdf', cat: 'pdf' },
  { label: 'Protect PDF', href: 'protect-pdf', cat: 'pdf' },
  { label: 'Unlock PDF', href: 'unlock-pdf', cat: 'pdf' },
  { label: 'Edit PDF', href: 'pdf-editor', cat: 'pdf' },
  { label: 'Sign PDF', href: 'sign-pdf', cat: 'pdf' },
  { label: 'Redact PDF', href: 'redact-pdf', cat: 'pdf' },
  { label: 'Watermark PDF', href: 'watermark-pdf', cat: 'pdf' },
  { label: 'Add Page Numbers to PDF', href: 'add-page-numbers', cat: 'pdf' },
  { label: 'Grayscale PDF', href: 'grayscale-pdf', cat: 'pdf' },
  { label: 'Edit PDF Metadata', href: 'pdf-metadata', cat: 'pdf' },
  { label: 'Share PDF with Expiry', href: 'share-pdf-with-expiry', cat: 'pdf' },
  { label: 'Image to PDF', href: 'image-to-pdf', cat: 'pdf' },
  { label: 'PDF to Image', href: 'pdf-to-image', cat: 'pdf' },
  { label: 'Lottie Player & Studio', href: 'lottie-player', cat: 'design' },
  { label: 'Lottie Converter', href: 'lottie-converter', cat: 'design' },
  { label: 'Lottie Validator', href: 'lottie-validator', cat: 'design' },
  { label: 'Lottie Optimizer', href: 'lottie-optimizer', cat: 'design' },
  { label: 'Suggest Tool', href: 'https://forms.gle/TA7WEhzzQ6csQFGZ7', external: true }
];

/**
 * Tool categories, in display order. Each ALL_TOOLS_LIST entry's `cat` is one
 * of these ids. Must match CATEGORY_SLUGS in src/config/tools.ts (tested).
 */
const TOOL_CATEGORIES = [
  { id: 'json', label: 'JSON & Data', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>' },
  { id: 'image', label: 'Image', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>' },
  { id: 'pdf', label: 'PDF', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>' },
  { id: 'qr-links', label: 'QR & Links', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>' },
  { id: 'developer', label: 'Developer', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></svg>' },
  { id: 'security', label: 'Encode & Security', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>' },
  { id: 'calculators', label: 'Calculators & Time', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>' },
  { id: 'design', label: 'Design & Animation', icon: '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>' }
];

/** Footer: one tile per category (instead of every tool) linking to the filtered tools page. */
function createAllToolsSection() {
  const base = getFooterBasePath();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = base + 'components/all-tools.css';
  document.head.appendChild(link);

  const tiles = TOOL_CATEGORIES.map(function(cat) {
    const count = ALL_TOOLS_LIST.filter(function(t) { return t.cat === cat.id; }).length;
    const bgColor = getRandomColorWithAlpha(ALL_TOOLS_BUTTON_ALPHA);
    return '<a href="' + homeHref() + '#cat=' + cat.id + '" class="all-tools-btn category-tile" style="background-color:' + bgColor + '">' +
      '<span class="category-tile-icon" aria-hidden="true">' + cat.icon + '</span>' +
      '<span class="category-tile-label">' + cat.label + '</span>' +
      '<span class="category-tile-count">' + count + ' tools</span></a>';
  }).join('');

  const html = '<section class="all-tools-section" aria-label="Tool categories">' +
    '<div class="all-tools-container">' +
    '<h2 class="all-tools-title">Browse free tools by category</h2>' +
    '<div class="all-tools-grid category-grid">' + tiles + '</div>' +
    '<p class="all-tools-more"><a href="' + homeHref() + '">See all ' + ALL_TOOLS_LIST.filter(function(t) { return t.cat; }).length + ' tools</a>' +
    ' · <a href="https://forms.gle/TA7WEhzzQ6csQFGZ7" target="_blank" rel="noopener noreferrer">Suggest a tool</a></p>' +
    '</div></section>';
  document.body.insertAdjacentHTML('beforeend', html);
}

/** Normalise a path so "/base64", "/base64.html" and "base64.html" compare equal. */
function normaliseToolPath(path) {
  let p = String(path || '').split(/[?#]/)[0].replace(/^\/+/, '').replace(/\.html$/, '').replace(/\/index$/, '/');
  if (p === '' || p === 'index') return 'index';
  return p.replace(/\/$/, '') || 'index';
}

/**
 * Related-tools bar under the trust strip: the other tools in the current
 * tool's category, so the next step (e.g. resize → compress) is one tap away.
 */
function createRelatedToolsBar() {
  if (document.querySelector('.related-tools')) return;
  const here = normaliseToolPath(window.location.pathname);
  const current = ALL_TOOLS_LIST.find(function(t) { return t.cat && normaliseToolPath(t.href) === here; });
  if (!current) return;
  const cat = TOOL_CATEGORIES.find(function(c) { return c.id === current.cat; });
  const base = getFooterBasePath();
  const links = ALL_TOOLS_LIST.filter(function(t) { return t.cat === current.cat; }).map(function(t) {
    const isCurrent = t === current;
    return '<a href="' + base + t.href + '" class="related-link' + (isCurrent ? ' is-current' : '') + '"' +
      (isCurrent ? ' aria-current="page"' : '') + '>' + t.label + '</a>';
  }).join('');
  const bar = '<nav class="related-tools" aria-label="' + cat.label + ' tools">' +
    '<span class="related-title">' + cat.label + ':</span>' + links +
    '<a href="' + homeHref() + '#cat=' + cat.id + '" class="related-link related-all">All ' + cat.label + ' →</a></nav>';
  const anchor = document.querySelector('.trust-strip');
  if (anchor) anchor.insertAdjacentHTML('afterend', bar);
}

function createFooter(version = '1.0') {
  const currentYear = new Date().getFullYear();
  const base = getFooterBasePath();
  const footerHTML = `
    <footer class="site-footer">
      <section class="footer-hero">
        <h2>Thank you!</h2>
        <p>Thanks for being part of the Bharat Dev Tools community. If you have ideas, we'd love to hear them.</p>
      </section>
      <section class="footer-meta">
        <p class="made-in">Built with <svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="love" role="img" style="display:inline-block;vertical-align:-0.125em"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg> in India</p>
        <nav class="footer-links" aria-label="Footer links">
          <a href="${base}about.html">About</a>
          <span class="sep">•</span>
          <a href="${base}privacy.html">Privacy</a>
          <span class="sep">•</span>
          <a href="https://forms.gle/TA7WEhzzQ6csQFGZ7" target="_blank" rel="noopener noreferrer">Contact us</a>
          <span class="sep">•</span>
          <a href="https://forms.gle/TA7WEhzzQ6csQFGZ7" target="_blank" rel="noopener noreferrer">Suggestions</a>
        </nav>
      </section>
      <section class="footer-copy">
        <small>Copyright © BharatDevTool ${currentYear} | v${version}</small>
      </section>
    </footer>
  `;

  // Insert footer before closing body tag
  document.body.insertAdjacentHTML('beforeend', footerHTML);
}

/**
 * One-line trust strip shown right below the header on every static page:
 * the tools are free and nothing the user enters or uploads leaves the browser.
 */
function createTrustBadge() {
  if (document.querySelector('.trust-strip')) return;
  const strip = '<p class="trust-strip"><strong>100% free</strong> · No sign-up · ' +
    '<span class="trust-long">Your data never leaves your browser</span>' +
    '<span class="trust-short">Nothing uploaded</span></p>';
  const header = document.querySelector('body > header, header.secondary-header');
  if (header) header.insertAdjacentHTML('afterend', strip);
  else {
    const main = document.querySelector('main');
    if (!main) return;
    main.insertAdjacentHTML('afterbegin', strip);
  }
  if (!document.getElementById('trust-strip-style')) {
    // Styles live here because not every page loads footer.css.
    const style = document.createElement('style');
    style.id = 'trust-strip-style';
    style.textContent = TRUST_STRIP_CSS;
    document.head.appendChild(style);
  }
}

const TRUST_STRIP_CSS = `
.trust-strip {
  margin: 0; padding: 6px 16px; text-align: center;
  font-size: 13px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: #047857;
}
[data-theme="dark"] .trust-strip, .dark .trust-strip { color: #6ee7b7; }
.trust-strip .trust-short { display: none; }
.related-tools {
  display: flex; align-items: center; gap: 6px; overflow-x: auto; white-space: nowrap;
  padding: 6px 16px 8px; justify-content: safe center; scrollbar-width: none;
  font-size: 13px;
}
.related-tools::-webkit-scrollbar { display: none; }
.continue-banner { margin: 0; padding: 2px 16px 8px; text-align: center; font-size: 13px; }
.continue-banner a { color: #2563eb; font-weight: 600; text-decoration: none; }
.continue-banner a:hover { text-decoration: underline; }
[data-theme="dark"] .continue-banner a, .dark .continue-banner a { color: #93c5fd; }
.related-tools .related-title { font-weight: 600; opacity: 0.75; margin-right: 2px; flex-shrink: 0; }
.related-tools .related-link {
  flex-shrink: 0; padding: 4px 10px; border-radius: 9999px; text-decoration: none;
  color: inherit; border: 1px solid rgba(127, 127, 127, 0.28);
}
.related-tools .related-link:hover { border-color: #3b82f6; color: #2563eb; }
.related-tools .related-link.is-current { background: #2563eb; border-color: #2563eb; color: #fff; }
.related-tools .related-all { border-style: dashed; }
[data-theme="dark"] .related-tools, .dark .related-tools { color: #e5e7eb; }
[data-theme="dark"] .related-tools .related-link:hover, .dark .related-tools .related-link:hover { color: #93c5fd; border-color: #60a5fa; }
@media (max-width: 520px) {
  .related-tools { justify-content: flex-start; font-size: 12px; }
  .trust-strip { font-size: 12px; }
  .trust-strip .trust-long { display: none; }
  .trust-strip .trust-short { display: inline; }
}
`;

/**
 * Homepage only: if the visitor last used a different tool, offer a one-line
 * link back to it. Replaces the old automatic redirect, which sent search
 * visitors (and Google) away from the JSON Formatter.
 */
function createContinueBanner() {
  if (normaliseToolPath(window.location.pathname) !== 'index') return;
  let last = '';
  try {
    const match = document.cookie.split('; ').find(function(c) { return c.indexOf('bdt_last_tool=') === 0; });
    last = match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
  } catch (e) { return; }
  if (!last || /^[a-z]+:/i.test(last)) return; // only same-site paths
  const tool = ALL_TOOLS_LIST.find(function(t) { return t.cat && normaliseToolPath(t.href) === normaliseToolPath(last); });
  if (!tool || normaliseToolPath(tool.href) === 'index') return;
  const html = '<p class="continue-banner">Continue where you left off: ' +
    '<a href="' + getFooterBasePath() + tool.href + '">' + tool.label + ' →</a></p>';
  const anchor = document.querySelector('.related-tools') || document.querySelector('.trust-strip');
  if (anchor) anchor.insertAdjacentHTML('afterend', html);
}

// Load version and create footer
function initFooter() {
  createTrustBadge();
  createRelatedToolsBar();
  createContinueBanner();
  createAllToolsSection();
  // Get version from version.js (already loaded) or use default
  const version = (window.appVersion && window.appVersion.version) || '1.0';
  createFooter(version);
}

// Function to update footer version if it was already created
function updateFooterVersion() {
  const footerVersion = document.querySelector('.footer-copy small');
  if (footerVersion && window.appVersion && window.appVersion.version) {
    const currentYear = new Date().getFullYear();
    footerVersion.textContent = `Copyright © BharatDevTool ${currentYear} | v${window.appVersion.version}`;
  }
}

// Initialize footer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initFooter();
  
  // Also listen for version update event
  window.addEventListener('versionLoaded', updateFooterVersion);
  
  // Fallback: check version after a short delay
  setTimeout(() => {
    if (window.appVersion && window.appVersion.version !== '1.0') {
      updateFooterVersion();
    }
  }, 500);
  
  // Add analytics tracking for footer links after footer is created
  setTimeout(() => {
    if (typeof window.Analytics !== 'undefined') {
      // Track footer link clicks
      const footerLinks = document.querySelectorAll('.footer-links a');
      footerLinks.forEach(link => {
        link.addEventListener('click', function(e) {
          const linkText = this.textContent.trim();
          const linkHref = this.href;
          
          // Track the event
          if (typeof window.Analytics !== 'undefined') {
            window.Analytics.trackButtonClickFooterLink({
              page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'Unknown',
              link_text: linkText,
              link_href: linkHref
            });
          }
          
          // For external links (target="_blank"), allow tracking before navigation
          // The event will be sent before the page unloads
          if (this.target === '_blank' || linkHref.startsWith('http')) {
            // Give a small delay to ensure event is sent
            e.preventDefault();
            setTimeout(() => {
              window.open(linkHref, this.target || '_self');
            }, 200);
          }
        });
      });
    }
  }, 100);
});
