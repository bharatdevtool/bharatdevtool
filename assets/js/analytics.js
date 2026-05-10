// analytics.js - Centralized analytics configuration and tracking
// Bharat Dev Tools - Google Analytics 4 Integration

// ============================================================================
// ANALYTICS CONSTANTS
// ============================================================================
const ANALYTICS_CONFIG = {
  // Google Analytics 4 Measurement ID
  GA4_MEASUREMENT_ID: 'G-H00TEVH9KG',
  
  // Environments where analytics should be disabled
  DISABLED_HOSTNAMES: ['localhost', '127.0.0.1'],
  
  // GA4 Configuration options
  GA4_OPTIONS: {
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure',
    send_page_view: true
  }
};

// Event names for consistent tracking across the application
const ANALYTICS_EVENTS = {
  // JSON Formatter events
  FORMAT_JSON: 'format_json',
  MINIFY_JSON: 'minify_json',
  ESCAPE_JSON: 'escape_json',
  UNESCAPE_JSON: 'unescape_json',
  UPLOAD_FILE: 'upload_file',
  FETCH_FROM_URL: 'fetch_from_url',
  DOWNLOAD_JSON: 'download_json',
  COPY_CONTENT: 'copy_content',
  FULLSCREEN_MODE: 'fullscreen_mode',
  
  // DeepLink Launcher events
  ENCODE_DEEPLINK: 'encode_deeplink',
  DECODE_DEEPLINK: 'decode_deeplink',
  LAUNCH_DEEPLINK: 'launch_deeplink',
  GENERATE_QR_FROM_DEEPLINK: 'generate_qr_from_deeplink',
  DOWNLOAD_HISTORY_CSV: 'download_history_csv',
  IMPORT_HISTORY_CSV: 'import_history_csv',
  
  // QR Generator events
  GENERATE_QR_CODE: 'generate_qr_code',
  DOWNLOAD_QR_CODE: 'download_qr_code',
  COPY_QR_URL: 'copy_qr_url',
  
  // QR Decoder events
  QR_DECODE: 'qr_decode',
  QR_DECODE_SUCCESS: 'qr_decode_success',
  QR_DECODE_FAILED: 'qr_decode_failed',
  QR_DECODE_COPY: 'qr_decode_copy',
  QR_DECODE_LAUNCH: 'qr_decode_launch',
  QR_DECODE_HISTORY_LOAD: 'qr_decode_history_load',
  QR_DECODE_HISTORY_COPY: 'qr_decode_history_copy',
  QR_DECODE_HISTORY_LAUNCH: 'qr_decode_history_launch',
  QR_DECODE_HISTORY_DELETE: 'qr_decode_history_delete',
  
  // General events
  THEME_TOGGLE: 'theme_toggle',
  BOOKMARK_ADD: 'bookmark_add',
  FEEDBACK_SUBMIT: 'feedback_submit',
  
  // Button click events
  BUTTON_CLICK_FORMAT: 'button_click_format',
  BUTTON_CLICK_MINIFY: 'button_click_minify',
  BUTTON_CLICK_ESCAPE: 'button_click_escape',
  BUTTON_CLICK_UNESCAPE: 'button_click_unescape',
  BUTTON_CLICK_FULLSCREEN: 'button_click_fullscreen',
  BUTTON_CLICK_URL_ENCODER: 'button_click_url_encoder',
  BUTTON_CLICK_DEEPLINK_LAUNCHER: 'button_click_deeplink_launcher',
  BUTTON_CLICK_QR_GENERATOR: 'button_click_qr_generator',
  BUTTON_CLICK_BOOKMARK: 'button_click_bookmark',
  BUTTON_CLICK_FOOTER_LINK: 'button_click_footer_link',
  
  // Error/failure events
  FORMAT_FAILED: 'format_failed',
  MINIFY_FAILED: 'minify_failed',
  ESCAPE_FAILED: 'escape_failed',
  UNESCAPE_FAILED: 'unescape_failed',
  DEEPLINK_LAUNCH_FAILED: 'deeplink_launch_failed',
  QR_GENERATION_FAILED: 'qr_generation_failed',
  FILE_UPLOAD_FAILED: 'file_upload_failed',
  URL_FETCH_FAILED: 'url_fetch_failed',
  VERSION_LOAD_FAILED: 'version_load_failed',
  
  // Base64 Encoder/Decoder events
  BASE64_ENCODE: 'base64_encode',
  BASE64_DECODE: 'base64_decode',
  BASE64_COPY: 'base64_copy',
  BASE64_SWAP: 'base64_swap',
  BASE64_HISTORY_EDIT: 'base64_history_edit',
  BASE64_HISTORY_COPY: 'base64_history_copy',
  BASE64_HISTORY_DELETE: 'base64_history_delete',
  VALIDATION_ERROR: 'validation_error',
  ENCODE_ERROR: 'encode_error',
  DECODE_ERROR: 'decode_error',
  
  // Regex events
  TEST_REGEX: 'test_regex',
  GENERATE_REGEX: 'generate_regex',
  COPY_REGEX_PATTERN: 'copy_regex_pattern',
  SELECT_PATTERN_TYPE: 'select_pattern_type',
  LOAD_TEST_EXAMPLE: 'load_test_example',
  SEARCH_PATTERNS: 'search_patterns',
  DOWNLOAD_REGEX_JSON: 'download_regex_json',
  
  // Deeplink specific button events
  DEEPLINK_ENCODE: 'deeplink_encode',
  DEEPLINK_DECODE: 'deeplink_decode',
  DEEPLINK_GENERATE_QR: 'deeplink_generate_qr',
  DEEPLINK_LAUNCH: 'deeplink_launch',
  DEEPLINK_UPLOAD_CSV: 'deeplink_upload_csv',
  DEEPLINK_DOWNLOAD_CSV: 'deeplink_download_csv',
  DEEPLINK_CLEAR_ALL: 'deeplink_clear_all',
  DEEPLINK_HISTORY_EDIT: 'deeplink_history_edit',
  DEEPLINK_HISTORY_LAUNCH: 'deeplink_history_launch',
  DEEPLINK_HISTORY_DELETE: 'deeplink_history_delete',
  DEEPLINK_HISTORY_COPY: 'deeplink_history_copy',
  
  // QR Generator specific button events
  QR_GENERATE_BUTTON: 'qr_generate_button',
  QR_DOWNLOAD: 'qr_download',
  QR_COPY_URL: 'qr_copy_url',
  QR_HISTORY_EDIT: 'qr_history_edit',
  QR_HISTORY_COPY: 'qr_history_copy',
  QR_HISTORY_DELETE: 'qr_history_delete',
  
  // JSON Diff/Comparison events
  JSON_DIFF_COMPARE: 'json_diff_compare',
  JSON_DIFF_FORMAT_BOTH: 'json_diff_format_both',
  JSON_DIFF_SWAP: 'json_diff_swap',
  JSON_DIFF_CLEAR: 'json_diff_clear',
  JSON_DIFF_FULLSCREEN: 'json_diff_fullscreen',
  JSON_DIFF_UPLOAD_FILE: 'json_diff_upload_file',
  JSON_DIFF_FETCH_URL: 'json_diff_fetch_url',
  JSON_DIFF_COMPARE_FAILED: 'json_diff_compare_failed',
  
  // Color Picker events
  COLOR_PICKER_COPY: 'color_picker_copy',
  COLOR_PICKER_COPY_FAILED: 'color_picker_copy_failed',
  COLOR_PICKER_LOAD_STATE_FAILED: 'color_picker_load_state_failed',
  COLOR_PICKER_SAVE_STATE_FAILED: 'color_picker_save_state_failed',
  COLOR_PICKER_IRO_INITIALIZED: 'color_picker_iro_initialized',
  COLOR_PICKER_IRO_INIT_FAILED: 'color_picker_iro_init_failed',
  COLOR_PICKER_IRO_CHANGE_ERROR: 'color_picker_iro_change_error',
  COLOR_PICKER_INIT_FAILED: 'color_picker_init_failed',
  IMAGE_UPLOADED: 'image_uploaded',
  IMAGE_UPLOAD_FAILED: 'image_upload_failed',
  COLOR_PICKED_FROM_IMAGE: 'color_picked_from_image',
  DOMINANT_COLORS_EXTRACTED: 'dominant_colors_extracted',
  DOMINANT_COLORS_EXTRACTION_FAILED: 'dominant_colors_extraction_failed',
  COLOR_BLINDNESS_UPDATE_FAILED: 'color_blindness_update_failed',
  KEYBOARD_SHORTCUT_UNDO: 'keyboard_shortcut_undo',
  KEYBOARD_SHORTCUT_REDO: 'keyboard_shortcut_redo',
  EXPORT_ASE: 'export_ase',
  EXPORT_ASE_FAILED: 'export_ase_failed',
  EXPORT_GPL: 'export_gpl',
  EXPORT_GPL_FAILED: 'export_gpl_failed',
  
  // Gradient Generator events
  GRADIENT_GENERATOR_COPY: 'gradient_generator_copy',
  GRADIENT_GENERATOR_COPY_FAILED: 'gradient_generator_copy_failed',
  GRADIENT_GENERATOR_LOAD_STATE_FAILED: 'gradient_generator_load_state_failed',
  GRADIENT_GENERATOR_SAVE_STATE_FAILED: 'gradient_generator_save_state_failed',
  
  // cURL Tester events
  CURL_PARSE: 'curl_parse',
  CURL_RUN_REQUEST: 'curl_run_request',
  CURL_REQUEST_SUCCESS: 'curl_request_success',
  CURL_COPY_CURL: 'curl_copy_curl',
  CURL_COPY_RESPONSE: 'curl_copy_response',
  CURL_DOWNLOAD_RESPONSE: 'curl_download_response',
  CURL_GENERATE_CODE: 'curl_generate_code',
  CURL_MODE_SWITCH: 'curl_mode_switch',
  CURL_LOAD_EXAMPLE: 'curl_load_example',
  CURL_RESET_BUILDER: 'curl_reset_builder',
  CURL_ERROR: 'curl_error',
  
  // cURL Comparison events
  COMPARISON_COMPARE: 'comparison_compare',
  COMPARISON_COMPARE_SUCCESS: 'comparison_compare_success',
  COMPARISON_ERROR: 'comparison_error',
  COMPARISON_SWAP: 'comparison_swap',
  COMPARISON_RESET: 'comparison_reset',
  COMPARISON_LOAD_EXAMPLE: 'comparison_load_example',
  COMPARISON_CLEAR_INPUT: 'comparison_clear_input',
  
  // Password Generator events
  PASSWORD_GENERATED: 'password_generated',
  PASSWORD_COPIED: 'password_copied',
  PASSWORD_GENERATE_FAILED: 'password_generate_failed',
  PASSWORD_GENERATE_ERROR: 'password_generate_error',
  BULK_PASSWORDS_GENERATED: 'bulk_passwords_generated',
  BULK_PASSWORD_COPIED: 'bulk_password_copied',
  BULK_ALL_PASSWORDS_COPIED: 'bulk_all_passwords_copied',
  // WhatsApp Link Generator events
  WHATSAPP_LINK_GENERATE: 'whatsapp_link_generate',
  WHATSAPP_LINK_COPY: 'whatsapp_link_copy',

  // UI Freeze events
  UI_FREEZE: 'ui_freeze',
  OPERATION_COMPLETE: 'operation_complete'
};

// ============================================================================
// ANALYTICS UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if analytics should be enabled based on the current hostname
 * @returns {boolean} - True if analytics should be enabled
 */
function shouldEnableAnalytics() {
  const hostname = window.location.hostname;
  return !ANALYTICS_CONFIG.DISABLED_HOSTNAMES.includes(hostname);
}

/**
 * Initialize Google Analytics 4
 * Only loads if analytics is enabled (not on localhost)
 */
function initGA4() {
  // Skip initialization if analytics is disabled
  if (!shouldEnableAnalytics()) {
    console.log('Analytics disabled for localhost/development environment');
    return;
  }

  // Load Google Analytics gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_CONFIG.GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  
  // Note: Page view tracking happens in auto-initialization section
  // with user-friendly page names
}

/**
 * Track a custom event in Google Analytics
 * @param {string} eventName - Name of the event (use ANALYTICS_EVENTS constants)
 * @param {object} eventParams - Optional parameters for the event
 */
function trackEvent(eventName, eventParams = {}) {
  if (!shouldEnableAnalytics() || typeof window.gtag === 'undefined') {
    // Silently fail in development or if GA4 is not loaded
    return;
  }

  try {
    window.gtag('event', eventName, eventParams);
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

/**
 * Get page performance metrics
 * @returns {object} - Performance data
 */
function getPerformanceMetrics() {
  if (!window.performance || !window.performance.timing) {
    return null;
  }

  const timing = window.performance.timing;
  
  // Calculate key performance metrics
  const metrics = {
    // DNS lookup time
    dns_lookup_time: timing.domainLookupEnd - timing.domainLookupStart,
    
    // Server connection time
    server_connection_time: timing.connectEnd - timing.connectStart,
    
    // Time to first byte (server response)
    time_to_first_byte: timing.responseStart - timing.requestStart,
    
    // Download time
    download_time: timing.responseEnd - timing.responseStart,
    
    // DOM processing time
    dom_processing_time: timing.domComplete - timing.domLoading,
    
    // Page load time (total)
    page_load_time: timing.loadEventEnd - timing.navigationStart,
    
    // Connection info (if available)
    connection_type: navigator.connection ? navigator.connection.effectiveType : 'unknown',
    
    // Screen info
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    
    // Viewport info
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight
  };

  return metrics;
}

/**
 * Track page view with performance metrics
 * @param {string} pagePath - The path to track
 * @param {string} pageTitle - Optional page title
 */
function trackPageView(pagePath, pageTitle) {
  if (!shouldEnableAnalytics() || typeof window.gtag === 'undefined') {
    return;
  }

  try {
    // Get performance metrics
    const performanceMetrics = getPerformanceMetrics();
    
    // Base config with page info
    const pageConfig = {
      page_path: pagePath,
      page_title: pageTitle || document.title
    };
    
    // Add performance metrics if available
    if (performanceMetrics) {
      // Add metrics as custom parameters
      Object.keys(performanceMetrics).forEach(key => {
        if (performanceMetrics[key] !== null && performanceMetrics[key] !== undefined) {
          pageConfig[key] = performanceMetrics[key];
        }
      });
    }
    
    window.gtag('config', ANALYTICS_CONFIG.GA4_MEASUREMENT_ID, pageConfig);
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

/**
 * Set user properties in Google Analytics
 * @param {object} properties - User properties to set
 */
function setUserProperties(properties) {
  if (!shouldEnableAnalytics() || typeof window.gtag === 'undefined') {
    return;
  }

  try {
    window.gtag('set', 'user_properties', properties);
  } catch (error) {
    console.error('Error setting user properties:', error);
  }
}

/**
 * Get current page name for analytics
 * @returns {string} - Current page name
 */
function getCurrentPageNameForAnalytics() {
  return getCurrentPageName();
}

// ============================================================================
// CONVENIENCE HELPER FUNCTIONS FOR SPECIFIC EVENTS
// ============================================================================

const Analytics = {
  // JSON Formatter helpers
  trackFormatJson: (params) => trackEvent(ANALYTICS_EVENTS.FORMAT_JSON, params),
  trackMinifyJson: (params) => trackEvent(ANALYTICS_EVENTS.MINIFY_JSON, params),
  trackEscapeJson: (params) => trackEvent(ANALYTICS_EVENTS.ESCAPE_JSON, params),
  trackUnescapeJson: (params) => trackEvent(ANALYTICS_EVENTS.UNESCAPE_JSON, params),
  trackUploadFile: (params) => trackEvent(ANALYTICS_EVENTS.UPLOAD_FILE, params),
  trackFetchFromUrl: (params) => trackEvent(ANALYTICS_EVENTS.FETCH_FROM_URL, params),
  trackDownloadJson: (params) => trackEvent(ANALYTICS_EVENTS.DOWNLOAD_JSON, params),
  trackCopyContent: (params) => trackEvent(ANALYTICS_EVENTS.COPY_CONTENT, params),
  trackFullscreenMode: (params) => trackEvent(ANALYTICS_EVENTS.FULLSCREEN_MODE, params),
  
  // DeepLink Launcher helpers
  trackEncodeDeeplink: (params) => trackEvent(ANALYTICS_EVENTS.ENCODE_DEEPLINK, params),
  trackDecodeDeeplink: (params) => trackEvent(ANALYTICS_EVENTS.DECODE_DEEPLINK, params),
  trackLaunchDeeplink: (params) => trackEvent(ANALYTICS_EVENTS.LAUNCH_DEEPLINK, params),
  trackGenerateQrFromDeeplink: (params) => trackEvent(ANALYTICS_EVENTS.GENERATE_QR_FROM_DEEPLINK, params),
  trackDownloadHistoryCsv: (params) => trackEvent(ANALYTICS_EVENTS.DOWNLOAD_HISTORY_CSV, params),
  trackImportHistoryCsv: (params) => trackEvent(ANALYTICS_EVENTS.IMPORT_HISTORY_CSV, params),
  
  // QR Generator helpers
  trackGenerateQrCode: (params) => trackEvent(ANALYTICS_EVENTS.GENERATE_QR_CODE, params),
  trackDownloadQrCode: (params) => trackEvent(ANALYTICS_EVENTS.DOWNLOAD_QR_CODE, params),
  trackCopyQrUrl: (params) => trackEvent(ANALYTICS_EVENTS.COPY_QR_URL, params),
  
  // QR Decoder helpers
  trackQrDecode: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE, params),
  trackQrDecodeSuccess: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_SUCCESS, params),
  trackQrDecodeFailed: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_FAILED, params),
  trackQrDecodeCopy: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_COPY, params),
  trackQrDecodeLaunch: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_LAUNCH, params),
  trackQrDecodeHistoryLoad: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_HISTORY_LOAD, params),
  trackQrDecodeHistoryCopy: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_HISTORY_COPY, params),
  trackQrDecodeHistoryLaunch: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_HISTORY_LAUNCH, params),
  trackQrDecodeHistoryDelete: (params) => trackEvent(ANALYTICS_EVENTS.QR_DECODE_HISTORY_DELETE, params),
  
  // General helpers
  trackThemeToggle: (params) => trackEvent(ANALYTICS_EVENTS.THEME_TOGGLE, params),
  trackBookmarkAdd: (params) => trackEvent(ANALYTICS_EVENTS.BOOKMARK_ADD, params),
  trackFeedbackSubmit: (params) => trackEvent(ANALYTICS_EVENTS.FEEDBACK_SUBMIT, params),
  
  // Button click helpers
  trackButtonClickFormat: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_FORMAT, params),
  trackButtonClickMinify: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_MINIFY, params),
  trackButtonClickEscape: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_ESCAPE, params),
  trackButtonClickUnescape: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_UNESCAPE, params),
  trackButtonClickFullscreen: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_FULLSCREEN, params),
  trackButtonClickUrlEncoder: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_URL_ENCODER, params),
  trackButtonClickDeeplinkLauncher: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_DEEPLINK_LAUNCHER, params),
  trackButtonClickQrGenerator: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_QR_GENERATOR, params),
  trackButtonClickBookmark: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_BOOKMARK, params),
  trackButtonClickFooterLink: (params) => trackEvent(ANALYTICS_EVENTS.BUTTON_CLICK_FOOTER_LINK, params),
  
  // Error/failure helpers
  trackFormatFailed: (params) => trackEvent(ANALYTICS_EVENTS.FORMAT_FAILED, params),
  trackMinifyFailed: (params) => trackEvent(ANALYTICS_EVENTS.MINIFY_FAILED, params),
  trackEscapeFailed: (params) => trackEvent(ANALYTICS_EVENTS.ESCAPE_FAILED, params),
  trackUnescapeFailed: (params) => trackEvent(ANALYTICS_EVENTS.UNESCAPE_FAILED, params),
  trackDeeplinkLaunchFailed: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_LAUNCH_FAILED, params),
  trackQrGenerationFailed: (params) => trackEvent(ANALYTICS_EVENTS.QR_GENERATION_FAILED, params),
  trackFileUploadFailed: (params) => trackEvent(ANALYTICS_EVENTS.FILE_UPLOAD_FAILED, params),
  trackUrlFetchFailed: (params) => trackEvent(ANALYTICS_EVENTS.URL_FETCH_FAILED, params),
  trackVersionLoadFailed: (params) => trackEvent(ANALYTICS_EVENTS.VERSION_LOAD_FAILED, params),
  
  // Deeplink specific event helpers
  trackDeeplinkEncode: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_ENCODE, params),
  trackDeeplinkDecode: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_DECODE, params),
  trackDeeplinkGenerateQr: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_GENERATE_QR, params),
  trackDeeplinkLaunch: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_LAUNCH, params),
  trackDeeplinkUploadCsv: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_UPLOAD_CSV, params),
  trackDeeplinkDownloadCsv: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_DOWNLOAD_CSV, params),
  trackDeeplinkClearAll: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_CLEAR_ALL, params),
  trackDeeplinkHistoryEdit: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_HISTORY_EDIT, params),
  trackDeeplinkHistoryLaunch: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_HISTORY_LAUNCH, params),
  trackDeeplinkHistoryDelete: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_HISTORY_DELETE, params),
  trackDeeplinkHistoryCopy: (params) => trackEvent(ANALYTICS_EVENTS.DEEPLINK_HISTORY_COPY, params),
  
  // QR Generator specific event helpers
  trackQrGenerateButton: (params) => trackEvent(ANALYTICS_EVENTS.QR_GENERATE_BUTTON, params),
  trackQrDownload: (params) => trackEvent(ANALYTICS_EVENTS.QR_DOWNLOAD, params),
  trackQrCopyUrl: (params) => trackEvent(ANALYTICS_EVENTS.QR_COPY_URL, params),
  trackQrHistoryEdit: (params) => trackEvent(ANALYTICS_EVENTS.QR_HISTORY_EDIT, params),
  trackQrHistoryCopy: (params) => trackEvent(ANALYTICS_EVENTS.QR_HISTORY_COPY, params),
  trackQrHistoryDelete: (params) => trackEvent(ANALYTICS_EVENTS.QR_HISTORY_DELETE, params),
  
  // JSON Diff/Comparison event helpers
  trackJsonDiffCompare: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_COMPARE, params),
  trackJsonDiffFormatBoth: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_FORMAT_BOTH, params),
  trackJsonDiffSwap: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_SWAP, params),
  trackJsonDiffClear: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_CLEAR, params),
  trackJsonDiffFullscreen: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_FULLSCREEN, params),
  trackJsonDiffUploadFile: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_UPLOAD_FILE, params),
  trackJsonDiffFetchUrl: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_FETCH_URL, params),
  trackJsonDiffCompareFailed: (params) => trackEvent(ANALYTICS_EVENTS.JSON_DIFF_COMPARE_FAILED, params),
  
  // Generic event tracker
  track: trackEvent
};

// ============================================================================
// PAGE NAME MAPPING
// ============================================================================
// Map file paths to user-friendly page names for GA4
const PAGE_NAMES = {
  'index.html': 'JSON Formatter',
  '/': 'JSON Formatter',
  'jsondiff.html': 'JSON Comparison Tool',
  '/jsondiff/': 'JSON Comparison Tool',
  'deeplink.html': 'DeepLink Launcher',
  'url-encoder.html': 'Url Encoder/Decoder',
  'base64.html': 'Base64 Encoder/Decoder',
  'base64': 'Base64 Encoder/Decoder',
  'qr-generator-free.html': 'QR Code Generator',
  'simple-qr.html': 'QR Code Generator', // Legacy redirect support
  'qr-decoder.html': 'QR Code Decoder',
  'regex-tester.html': 'Regex Tester',
  'regex-generator.html': 'Regex Generator',
  'regex-library.html': 'Regex Library',
  'color-picker.html': 'Color Picker',
  'gradient-generator.html': 'Gradient Generator',
  'curl-tester.html': 'cURL Tester',
  'curl-comparison.html': 'cURL Comparison',
  'word-counter.html': 'Word Counter',
  'tools.html': 'Our Developer Tools',
  'age-calculator.html': 'Age Calculator',
  'about.html': 'About',
  'feedback.html': 'Feedback',
  'privacy.html': 'Privacy Policy',
  'password-generator.html': 'Password Generator',
  'text-case-converter.html': 'Text Case Converter',
  'uuid-generator.html': 'UUID Generator',
  'whatsapp-link.html': 'WhatsApp Link Generator',
  'lorem-ipsum.html': 'Lorem Ipsum Generator'
};

/**
 * Get a user-friendly page name for the current page
 * @returns {string} - Descriptive page name
 */
function getCurrentPageName() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  return PAGE_NAMES[filename] || PAGE_NAMES[path] || document.title || 'Unknown Page';
}

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================
// Initialize GA4 when the script loads
if (typeof window !== 'undefined') {
  initGA4();
  
  // Function to track page view with performance metrics
  function trackPageViewWithMetrics() {
    const pageName = getCurrentPageName();
    const pagePath = window.location.pathname;
    
    if (shouldEnableAnalytics()) {
      trackPageView(pagePath, pageName);
    }
  }
  
  // Track page view after load complete to capture accurate performance metrics
  if (document.readyState === 'complete') {
    // Page already loaded
    setTimeout(trackPageViewWithMetrics, 100);
  } else {
    // Wait for page to fully load
    window.addEventListener('load', function() {
      setTimeout(trackPageViewWithMetrics, 100);
    });
  }
  
  // Make analytics functions globally available
  window.Analytics = Analytics;
  window.ANALYTICS_EVENTS = ANALYTICS_EVENTS;
  window.getCurrentPageNameForAnalytics = getCurrentPageNameForAnalytics;
}

