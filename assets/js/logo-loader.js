// Logo Loader - Dynamically sets logo images from centralized config
// This ensures logo URL is maintained in one place

(function() {
  'use strict';
  
  // Fallback values
  const FALLBACK_LOGO_URL = 'https://ik.imagekit.io/bdt/bdt_logo.png';
  const FALLBACK_LOGO_ALT = 'Bharat Dev Tools Logo';
  
  function initLogo() {
    // Try to get config from module or window
    let logoUrl, logoAlt;
    
    if (typeof window !== 'undefined' && window.APP_CONFIG) {
      logoUrl = window.APP_CONFIG.LOGO_URL;
      logoAlt = window.APP_CONFIG.LOGO_ALT_TEXT;
    } else {
      // Fallback to direct value if config not loaded yet
      logoUrl = FALLBACK_LOGO_URL;
      logoAlt = FALLBACK_LOGO_ALT;
    }
    
    // Find all logo images by data-logo attribute, alt text, or class
    const logoImages = document.querySelectorAll('img[data-logo="true"], img[alt*="Bharat Dev Tools Logo"], img.logo, img[class*="logo"]');
    
    logoImages.forEach(img => {
      img.src = logoUrl;
      img.alt = logoAlt;
    });
  }
  
  // Wait for APP_CONFIG to be available (handles race condition with module scripts)
  function waitForConfigAndInit(maxWait = 1000, checkInterval = 50) {
    const startTime = Date.now();
    
    function checkConfig() {
      if (typeof window !== 'undefined' && window.APP_CONFIG) {
        // Config is available, initialize logo
        initLogo();
      } else if (Date.now() - startTime < maxWait) {
        // Config not ready yet, check again after interval
        setTimeout(checkConfig, checkInterval);
      } else {
        // Timeout reached, use fallback values
        initLogo();
      }
    }
    
    // Start checking
    checkConfig();
  }
  
  // Expose initLogo function globally so header component can call it
  window.initLogo = initLogo;
  
  // Initialize when DOM is ready, waiting for config if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      waitForConfigAndInit();
    });
  } else {
    // DOM already loaded, wait for config
    waitForConfigAndInit();
  }
})();

