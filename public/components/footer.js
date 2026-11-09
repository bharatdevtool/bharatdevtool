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
  { label: 'JSON Formatter', href: 'index.html' },
  { label: 'JSON Diff', href: 'jsondiff/' },
  { label: 'DeepLink Launcher', href: 'deeplink.html' },
  { label: 'URL Encoder', href: 'url-encoder.html' },
  { label: 'Base64 Encoder', href: 'base64.html' },
  { label: 'QR Code Generator', href: 'qr-generator-free.html' },
  { label: 'QR Code Decoder', href: 'qr-decoder.html' },
  { label: 'Regex Tester', href: 'regex-tester.html' },
  { label: 'Regex Generator', href: 'regex-generator.html' },
  { label: 'Regex Library', href: 'regex-library.html' },
  { label: 'Color Picker', href: 'color-picker.html' },
  { label: 'Gradient Generator', href: 'gradient-generator.html' },
  { label: 'cURL Tester', href: 'curl-tester.html' },
  { label: 'cURL Comparison', href: 'curl-comparison.html' },
  { label: 'WhatsApp Link Generator', href: 'whatsapp-link.html' },
  { label: 'UUID Generator', href: 'uuid-generator.html' },
  { label: 'Percentage Calculator', href: 'percentage-calculator.html' },
  { label: 'BMI Calculator', href: 'bmi-calculator.html' },
  { label: 'GST Calculator', href: 'gst-calculator.html' },
  { label: 'EMI Calculator', href: 'emi-calculator.html' },
  { label: 'Unix Timestamp Converter', href: 'timestamp-converter.html' },
  { label: 'JWT Decoder', href: 'jwt-decoder.html' },
  { label: 'PNG ↔ JPG Converter', href: 'image-converter.html' },
  { label: 'Image Resizer', href: 'image-resizer.html' },
  { label: 'Image Compressor', href: 'image-compressor.html' },
  { label: 'Resize Image to KB', href: 'resize-image-to-kb.html' },
  { label: 'Image to PDF Converter', href: 'image-to-pdf.html' },
  { label: 'Hash Generator', href: 'hash-generator.html' },
  { label: 'CSV ↔ JSON Converter', href: 'csv-json-converter.html' },
  { label: 'YAML ↔ JSON Converter', href: 'yaml-json-converter.html' },
  { label: 'Diff Checker', href: 'diff-checker.html' },
  { label: 'Cron Expression Generator', href: 'cron-generator.html' },
  { label: 'Lorem Ipsum Generator', href: 'lorem-ipsum.html' },
  { label: 'Timezone Converter', href: 'timezone-converter.html' },
  { label: 'Markdown to HTML', href: 'markdown-to-html.html' },
  { label: 'JSON to TypeScript Interface', href: 'json-to-typescript.html' },
  { label: 'HTML Formatter & Beautifier', href: 'html-formatter.html' },
  { label: 'Favicon Generator', href: 'favicon-generator.html' },
  { label: 'Lottie Player & Studio', href: 'tools/lottie-player' },
  { label: 'Lottie Converter', href: 'tools/lottie-converter' },
  { label: 'Lottie Validator', href: 'tools/lottie-validator' },
  { label: 'Lottie Optimizer', href: 'tools/lottie-optimizer' },
  { label: 'Suggest Tool', href: 'https://forms.gle/TA7WEhzzQ6csQFGZ7', external: true }
];

function createAllToolsSection() {
  const base = getFooterBasePath();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = base + 'components/all-tools.css';
  document.head.appendChild(link);

  const buttons = ALL_TOOLS_LIST.map(function(tool) {
    const href = tool.external ? tool.href : base + tool.href;
    const targetAttr = tool.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const bgColor = getRandomColorWithAlpha(ALL_TOOLS_BUTTON_ALPHA);
    const styleAttr = ' style="background-color:' + bgColor + '"';
    return '<a href="' + href + '" class="all-tools-btn"' + styleAttr + targetAttr + '>' + tool.label + '</a>';
  }).join('');

  const html = '<section class="all-tools-section" aria-label="All tools">' +
    '<div class="all-tools-container">' +
    '<h2 class="all-tools-title">All tools</h2>' +
    '<div class="all-tools-grid">' + buttons + '</div>' +
    '</div></section>';
  document.body.insertAdjacentHTML('beforeend', html);
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
        <p class="made-in">Built with ❤️ in India</p>
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
 * Trust badge shown at the top of every static page's main content:
 * the tools are free and nothing the user enters or uploads leaves the browser.
 */
function createTrustBadge() {
  const main = document.querySelector('main');
  if (!main || main.querySelector('.trust-badge')) return;
  const lock = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const badge = '<div class="trust-badge-wrap"><p class="trust-badge">' + lock +
    '<span><strong>100% free</strong> · No sign-up · Your data never leaves your browser</span></p></div>';
  main.insertAdjacentHTML('afterbegin', badge);
  if (!document.getElementById('trust-badge-style')) {
    // Styles live here because not every page loads footer.css.
    const style = document.createElement('style');
    style.id = 'trust-badge-style';
    style.textContent = TRUST_BADGE_CSS;
    document.head.appendChild(style);
  }
}

const TRUST_BADGE_CSS = `
.trust-badge-wrap { display: flex; justify-content: center; padding: 12px 16px 0; }
.trust-badge {
  display: inline-flex; align-items: center; gap: 8px; margin: 0;
  padding: 6px 14px; border-radius: 9999px;
  font-size: 13px; line-height: 1.4; text-align: center;
  color: #047857; background: rgba(16, 185, 129, 0.10); border: 1px solid rgba(16, 185, 129, 0.35);
}
.trust-badge svg { flex-shrink: 0; }
[data-theme="dark"] .trust-badge, .dark .trust-badge { color: #6ee7b7; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.35); }
@media (max-width: 480px) { .trust-badge { font-size: 12px; padding: 6px 12px; } }
`;

// Load version and create footer
function initFooter() {
  createTrustBadge();
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
