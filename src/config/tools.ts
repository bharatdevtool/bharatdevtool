// ============================================================
// tools.ts — Master tool registry (SINGLE SOURCE OF TRUTH)
//
// All tool metadata lives here. Consumed by:
//  - SEO metadata generation (seo.ts)
//  - Footer tool list (Footer.tsx)
//  - Tools directory page (/tools)
//  - Header navigation
// ============================================================

export type ToolCategory =
  | 'JSON'
  | 'Lottie'
  | 'QR'
  | 'Color'
  | 'API/Network'
  | 'Encoding'
  | 'Regex'
  | 'Security'
  | 'Social';

export interface Tool {
  id: string;
  label: string;
  route: string;
  category: ToolCategory;
  description: string;
  /** Short description for footer / cards */
  shortDesc: string;
  keywords: string[];
  /** Whether this tool needs a heavy client-side lib (lazy load) */
  heavy?: boolean;
}

export const TOOLS: Tool[] = [
  // ── JSON ──────────────────────────────────────────────────
  {
    id: 'json-formatter',
    label: 'JSON Formatter',
    route: '/tools/json-formatter',
    category: 'JSON',
    description:
      'Format, beautify, minify, validate, escape and repair JSON instantly. Free online JSON formatter with clear error positions. Runs 100% in your browser.',
    shortDesc: 'Format, validate & minify JSON',
    keywords: ['json formatter', 'json beautifier', 'json minifier', 'json validator', 'pretty print json', 'json escape'],
    heavy: true,
  },
  {
    id: 'json-diff',
    label: 'JSON Diff',
    route: '/tools/json-diff',
    category: 'JSON',
    description:
      'Compare two JSON documents and see every added, removed and changed key in a clear diff tree. Free online JSON diff tool that runs fully in your browser.',
    shortDesc: 'Compare JSON structures side-by-side',
    keywords: ['json diff', 'json compare', 'json comparison', 'json difference'],
    heavy: true,
  },
  // ── QR ────────────────────────────────────────────────────
  {
    id: 'qr-generator',
    label: 'QR Code Generator',
    route: '/tools/qr-generator',
    category: 'QR',
    description:
      'Create QR codes for URLs, plain text and WiFi networks with custom colors and error correction. Free QR code generator that works offline in your browser.',
    shortDesc: 'Generate QR codes for any content',
    keywords: ['qr code generator', 'create qr code', 'free qr generator', 'qr code maker'],
    heavy: true,
  },
  {
    id: 'qr-decoder',
    label: 'QR Code Decoder',
    route: '/tools/qr-decoder',
    category: 'QR',
    description:
      'Decode QR codes from images and screenshots instantly. Upload or drag and drop a picture to read its content. Free, private, runs in your browser.',
    shortDesc: 'Decode QR code images',
    keywords: ['qr code decoder', 'qr scanner', 'qr reader', 'scan qr code', 'decode qr'],
    heavy: true,
  },
  // ── Color ─────────────────────────────────────────────────
  {
    id: 'color-picker',
    label: 'Color Picker',
    route: '/tools/color-picker',
    category: 'Color',
    description:
      'Pick colors and convert between HEX, RGB and HSL, explore complementary and triadic palettes, and check WCAG contrast. Free online color picker.',
    shortDesc: 'Pick & convert colors: HEX, RGB, HSL',
    keywords: ['color picker', 'hex color', 'rgb color', 'hsl color', 'color converter', 'color palette generator'],
  },
  {
    id: 'gradient-generator',
    label: 'CSS Gradient Generator',
    route: '/tools/gradient-generator',
    category: 'Color',
    description:
      'Build linear, radial and conic CSS gradients with multiple color stops and a live preview, then copy the CSS. Free online CSS gradient generator.',
    shortDesc: 'Generate CSS linear, radial & conic gradients',
    keywords: ['css gradient generator', 'linear gradient', 'radial gradient', 'gradient css', 'background gradient'],
  },
  // ── API/Network ───────────────────────────────────────────
  {
    id: 'curl-tester',
    label: 'cURL Tester',
    route: '/tools/curl-tester',
    category: 'API/Network',
    description:
      'Parse cURL commands into method, URL, headers and body, and convert them to JavaScript fetch or Python requests code. Free and runs in your browser.',
    shortDesc: 'Run & debug cURL API requests',
    keywords: ['curl tester', 'api tester', 'curl online', 'http request tester', 'rest api tester'],
  },
  {
    id: 'curl-comparison',
    label: 'cURL Comparison',
    route: '/tools/curl-comparison',
    category: 'API/Network',
    description:
      'Compare two cURL commands side by side and spot differences in method, URL, query params, headers and body. Free online cURL diff tool, fully private.',
    shortDesc: 'Compare two cURL commands',
    keywords: ['curl comparison', 'compare curl commands', 'curl diff', 'api comparison'],
  },
  {
    id: 'deeplink',
    label: 'DeepLink Launcher',
    route: '/tools/deeplink',
    category: 'API/Network',
    description:
      'Parse, inspect and launch app deep links and custom URL schemes. Check scheme, host, path and query parameters before testing on device. Free tool.',
    shortDesc: 'Test Android & iOS deep links',
    keywords: ['deeplink tester', 'deep link launcher', 'android deep link', 'ios deep link', 'app link tester'],
  },
  // ── Encoding ──────────────────────────────────────────────
  {
    id: 'base64',
    label: 'Base64 Encoder / Decoder',
    route: '/tools/base64',
    category: 'Encoding',
    description:
      'Encode text to Base64 and decode Base64 back to text instantly, with full Unicode support. Free online Base64 encoder and decoder, private in your browser.',
    shortDesc: 'Encode & decode Base64 strings',
    keywords: ['base64 encoder', 'base64 decoder', 'encode base64', 'decode base64', 'base64 online'],
  },
  {
    id: 'url-encoder',
    label: 'URL Encoder / Decoder',
    route: '/tools/url-encoder',
    category: 'Encoding',
    description:
      'Percent-encode URLs and query parameters, or decode and inspect encoded URLs instantly. Free online URL encoder and decoder that runs in your browser.',
    shortDesc: 'URL percent-encode & decode',
    keywords: ['url encoder', 'url decoder', 'percent encoding', 'uri encoder', 'url encode online'],
  },
  // ── Regex ─────────────────────────────────────────────────
  {
    id: 'regex-tester',
    label: 'Regex Tester',
    route: '/tools/regex-tester',
    category: 'Regex',
    description:
      'Test JavaScript regular expressions live with highlighted matches, capture groups and flags. Free online regex tester with ready-made example patterns.',
    shortDesc: 'Test & debug regex with live highlighting',
    keywords: ['regex tester', 'regular expression tester', 'regex online', 'regex debugger', 'regex match'],
  },
  {
    id: 'regex-generator',
    label: 'Regex Generator',
    route: '/tools/regex-generator',
    category: 'Regex',
    description:
      'Generate regex for emails, URLs, phone numbers, dates, UUIDs and more, or build custom patterns, then test them instantly. Free online regex generator.',
    shortDesc: 'Generate regex from descriptions',
    keywords: ['regex generator', 'generate regex', 'regular expression generator', 'regex builder'],
  },
  {
    id: 'regex-library',
    label: 'Regex Library',
    route: '/tools/regex-library',
    category: 'Regex',
    description:
      'Browse a curated library of tested regular expressions for emails, URLs, phone numbers and more, with examples. Copy or test any pattern for free.',
    shortDesc: 'Browse common regex patterns',
    keywords: ['regex library', 'regex patterns', 'common regex', 'regex examples', 'regex cheatsheet'],
  },
  // ── Security ──────────────────────────────────────────────
  {
    id: 'uuid-generator',
    label: 'UUID Generator',
    route: '/tools/uuid-generator',
    category: 'Security',
    description:
      'Generate UUID v1, v4 and v7 in bulk with uppercase and no-hyphen options, using secure browser randomness. Free online UUID generator, nothing stored.',
    shortDesc: 'Generate UUID v1, v4, v7',
    keywords: ['uuid generator', 'guid generator', 'uuid v4', 'uuid v7', 'random uuid', 'unique id generator'],
  },
  // ── Social ────────────────────────────────────────────────
  {
    id: 'whatsapp-link',
    label: 'WhatsApp Link Generator',
    route: '/tools/whatsapp-link',
    category: 'Social',
    description:
      'Create WhatsApp click-to-chat links with a pre-filled message and a scannable QR code. No need to save the number. Free WhatsApp link generator.',
    shortDesc: 'Create wa.me click-to-chat links',
    keywords: ['whatsapp link generator', 'wa.me link', 'whatsapp click to chat', 'whatsapp api link'],
  },
  // ── Lottie ────────────────────────────────────────────────
  {
    id: 'lottie-player',
    label: 'Lottie Player & Studio',
    route: '/tools/lottie-player',
    category: 'Lottie',
    description:
      'Preview, inspect and edit Lottie animations online. Play .json and .lottie files, swap colors, inspect layers and audit warnings. 100% in your browser.',
    shortDesc: 'Preview, inspect & edit Lottie animations',
    keywords: [
      'lottie player',
      'lottie viewer online',
      'lottie previewer',
      'dotlottie player',
      'lottie editor',
      'lottie json editor',
      'lottie color editor',
      'lottie layer inspector',
      'bodymovin preview',
      'edit lottie online',
    ],
    heavy: true,
  },
  {
    id: 'lottie-converter',
    label: 'Lottie to dotLottie Converter',
    route: '/tools/lottie-converter',
    category: 'Lottie',
    description:
      'Convert Bodymovin JSON to compressed dotLottie (.lottie) archives and unpack .lottie packages to clean JSON. 100% offline client-side compression.',
    shortDesc: 'Convert between JSON and .lottie archives',
    keywords: ['lottie converter', 'json to dotlottie', 'lottie to json', 'dotlottie converter', 'compress lottie', 'dotlottie to json'],
    heavy: true,
  },
  {
    id: 'lottie-validator',
    label: 'Lottie Validator',
    route: '/tools/lottie-validator',
    category: 'Lottie',
    description:
      'Validate Lottie animation JSON structure, verify layer parent hierarchies, and detect missing asset references online. 100% client-side validation.',
    shortDesc: 'Validate Lottie structure & asset health',
    keywords: ['lottie validator', 'validate lottie json', 'lottie syntax check', 'bodymovin validator', 'lottie error checker'],
    heavy: false,
  },
  {
    id: 'lottie-optimizer',
    label: 'Lottie Optimizer',
    route: '/tools/lottie-optimizer',
    category: 'Lottie',
    description:
      'Safely compress Lottie animations with configurable coordinate rounding and optional metadata cleanup. Side-by-side preview with zero silent pruning.',
    shortDesc: 'Safely compress & clean Lottie animations',
    keywords: ['lottie optimizer', 'compress lottie json', 'reduce lottie file size', 'clean lottie metadata', 'bodymovin optimizer'],
    heavy: true,
  },
];

/** Lookup a tool by its id */
export function getToolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

/** Get all tools in a category */
export function getToolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

/** All unique categories in display order */
export const TOOL_CATEGORIES: ToolCategory[] = [
  'JSON', 'Lottie', 'QR', 'Color', 'API/Network', 'Encoding', 'Regex', 'Security', 'Social',
];

