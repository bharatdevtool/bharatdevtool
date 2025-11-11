// Logo Loader - Dynamically sets logo images from centralized config
// This ensures logo URL is maintained in one place

(function() {
  'use strict';
  
  function initLogo() {
    // Try to get config from module or window
    let logoUrl, logoAlt;
    
    if (typeof window !== 'undefined' && window.APP_CONFIG) {
      logoUrl = window.APP_CONFIG.LOGO_URL;
      logoAlt = window.APP_CONFIG.LOGO_ALT_TEXT;
    } else {
      // Fallback to direct value if config not loaded yet
      logoUrl = 'https://ik.imagekit.io/bdt/bdt_logo.png';
      logoAlt = 'Bharat Dev Tools Logo';
    }
    
    // Find all logo images by data-logo attribute, alt text, or class
    const logoImages = document.querySelectorAll('img[data-logo="true"], img[alt*="Bharat Dev Tools Logo"], img.logo, img[class*="logo"]');
    
    logoImages.forEach(img => {
      img.src = logoUrl;
      img.alt = logoAlt;
    });
  }
  
  // Expose initLogo function globally so header component can call it
  window.initLogo = initLogo;
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogo);
  } else {
    initLogo();
  }
})();

