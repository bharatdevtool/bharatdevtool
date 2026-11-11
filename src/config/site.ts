// ============================================================
// site.ts — Global site-wide constants (single source of truth)
// ============================================================

export const SITE = {
  name: 'Bharat Dev Tools',
  tagline: 'Free Developer Tools. No Sign Up. Privacy First.',
  url: 'https://bharatdevtool.com',
  version: '4.0',

  // Branding
  logoUrl: 'https://ik.imagekit.io/bdt/bdt_logo_v3_400.png',
  logoAlt: 'Bharat Dev Tools Logo',
  faviconBaseUrl: 'https://ik.imagekit.io/bdt',

  // External services
  ga4MeasurementId: 'G-H00TEVH9KG',
  // Sentry Loader Script — same project key as the static HTML pages
  sentryLoaderUrl: 'https://js-de.sentry-cdn.com/377fa2c5032178b56ab058bb0a0fffbb.min.js',

  // Social / links
  feedbackFormUrl: 'https://forms.gle/TA7WEhzzQ6csQFGZ7',

  // Analytics and error tracking: disable on these hostnames
  analyticsDisabledHosts: ['localhost', '127.0.0.1'],

  // Default theme
  defaultTheme: 'dark' as 'dark' | 'light',
} as const;

// Analytics event names — typed to prevent typos
export const ANALYTICS_EVENTS = {
  // JSON
  FORMAT_JSON: 'format_json',
  MINIFY_JSON: 'minify_json',
  VALIDATE_JSON: 'validate_json',
  ESCAPE_JSON: 'escape_json',
  UNESCAPE_JSON: 'unescape_json',
  REPAIR_JSON: 'repair_json',
  // JSON Diff
  COMPARE_JSON: 'compare_json',
  // QR
  GENERATE_QR: 'generate_qr_code',
  DOWNLOAD_QR: 'download_qr_code',
  DECODE_QR: 'qr_decode',
  // Encoding
  ENCODE_BASE64: 'encode_base64',
  DECODE_BASE64: 'decode_base64',
  ENCODE_URL: 'encode_url',
  DECODE_URL: 'decode_url',
  // Regex
  TEST_REGEX: 'test_regex',
  GENERATE_REGEX: 'generate_regex',
  COPY_PATTERN: 'copy_regex_pattern',
  // Color
  PICK_COLOR: 'pick_color',
  GENERATE_GRADIENT: 'generate_gradient',
  COPY_COLOR: 'copy_color',
  // cURL
  RUN_CURL: 'run_curl_request',
  COMPARE_CURL: 'compare_curl',
  // DeepLink
  LAUNCH_DEEPLINK: 'launch_deeplink',
  // Lottie (props are fixed labels and counts only — never file names or content)
  LOAD_LOTTIE: 'load_lottie',
  REPLACE_LOTTIE_COLOR: 'replace_lottie_color',
  DOWNLOAD_LOTTIE: 'download_lottie',
  VALIDATE_LOTTIE: 'validate_lottie',
  OPTIMIZE_LOTTIE: 'optimize_lottie',
  CONVERT_LOTTIE: 'convert_lottie',
  // PDF (props are fixed labels and counts only — never file names or content)
  PDF_FILES_ADDED: 'pdf_files_added',
  PDF_EXPORT: 'pdf_export',
  PDF_EXPORT_FAILED: 'pdf_export_failed',
  PDF_SHARE: 'pdf_share',
  // Security
  GENERATE_UUID: 'generate_uuid',
  // Social
  GENERATE_WHATSAPP_LINK: 'generate_whatsapp_link',
  // General
  COPY_CONTENT: 'copy_content',
  THEME_TOGGLE: 'theme_toggle',
  DOWNLOAD_FILE: 'download_file',
} as const;

