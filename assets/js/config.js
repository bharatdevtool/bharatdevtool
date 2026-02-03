// Application Configuration Constants
// Centralized configuration for easy maintenance
// When changing LOGO_URL: also update FALLBACK_LOGO_URL in logo-loader.js and the fallback in components/header.js so all pages show the same logo.

export const APP_CONFIG = {
  // Logo Configuration (single source of truth for header logo across all pages)
  LOGO_URL: 'https://ik.imagekit.io/bdt/bdt_logo_v3_400.png',
  LOGO_ALT_TEXT: 'Bharat Dev Tools Logo'
};

// For non-module scripts (backward compatibility)
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}

