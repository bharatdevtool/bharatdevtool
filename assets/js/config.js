// Application Configuration Constants
// Centralized configuration for easy maintenance

export const APP_CONFIG = {
  // Logo Configuration
  LOGO_URL: 'https://ik.imagekit.io/bdt/bdt_logo_v3_400.png',
  LOGO_ALT_TEXT: 'Bharat Dev Tools Logo'
};

// For non-module scripts (backward compatibility)
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}

