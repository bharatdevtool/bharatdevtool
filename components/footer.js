// Footer Component JavaScript - Simple and clean
function createFooter(version = '1.0') {
  const currentYear = new Date().getFullYear();
  const footerHTML = `
    <footer class="site-footer">
      <section class="footer-hero">
        <h2>Thank you!</h2>
        <p>Thanks for being part of the Bharat Dev Tools community. If you have ideas, we'd love to hear them.</p>
      </section>
      <section class="footer-meta">
        <p class="made-in">Built with ❤️ in India</p>
        <nav class="footer-links" aria-label="Footer links">
          <a href="about.html">About</a>
          <span class="sep">•</span>
          <a href="privacy.html">Privacy</a>
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

// Load version and create footer
function initFooter() {
  // Get version from version.js (already loaded) or use default
  const version = (window.appVersion && window.appVersion.version) || '1.0';
  
  // Create footer with version
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
