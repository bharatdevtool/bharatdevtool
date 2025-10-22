// Footer Component JavaScript - Simple and clean
function createFooter() {
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
        <small>Copyright © BharatDevTool 2025 | v1.0</small>
      </section>
    </footer>
  `;

  // Insert footer before closing body tag
  document.body.insertAdjacentHTML('beforeend', footerHTML);
}

// Initialize footer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  createFooter();
});
