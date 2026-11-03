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
  /** Icon emoji for quick visual ID */
  icon: string;
  /** Whether this tool needs a heavy client-side lib (lazy load) */
  heavy?: boolean;
}

export const TOOLS: Tool[] = [
  // ── JSON ──────────────────────────────────────────────────
  {
    id: 'json-formatter',
    label: 'JSON Formatter',
    route: '/index.html',
    category: 'JSON',
    icon: '{}',
    description:
      'Format, beautify, minify, validate, escape, unescape, and repair JSON instantly. Free online tool with syntax highlighting and error detection.',
    shortDesc: 'Format, validate & minify JSON',
    keywords: ['json formatter', 'json beautifier', 'json minifier', 'json validator', 'pretty print json', 'json escape'],
    heavy: true,
  },
  {
    id: 'json-diff',
    label: 'JSON Diff',
    route: '/jsondiff/',
    category: 'JSON',
    icon: '⇄',
    description:
      'Compare two JSON structures side-by-side and highlight differences. Free online JSON comparison tool.',
    shortDesc: 'Compare JSON structures side-by-side',
    keywords: ['json diff', 'json compare', 'json comparison', 'json difference'],
    heavy: true,
  },
  // ── QR ────────────────────────────────────────────────────
  {
    id: 'qr-generator',
    label: 'QR Code Generator',
    route: '/qr-generator-free.html',
    category: 'QR',
    icon: '⬛',
    description:
      'Create QR codes online for URLs, text, WiFi, email, and more. Download as PNG or SVG. Free, no sign-up.',
    shortDesc: 'Generate QR codes for any content',
    keywords: ['qr code generator', 'create qr code', 'free qr generator', 'qr code maker'],
    heavy: true,
  },
  {
    id: 'qr-decoder',
    label: 'QR Code Decoder',
    route: '/qr-decoder.html',
    category: 'QR',
    icon: '🔍',
    description:
      'Decode and scan QR codes from images. Extract URLs, text, and data. Free online QR reader, no sign-up.',
    shortDesc: 'Decode QR code images',
    keywords: ['qr code decoder', 'qr scanner', 'qr reader', 'scan qr code', 'decode qr'],
    heavy: true,
  },
  // ── Color ─────────────────────────────────────────────────
  {
    id: 'color-picker',
    label: 'Color Picker',
    route: '/color-picker.html',
    category: 'Color',
    icon: '🎨',
    description:
      'Professional color picker with HEX, RGB, HSL conversion. Generate palettes, check contrast ratios, export CSS variables.',
    shortDesc: 'Pick & convert colors: HEX, RGB, HSL',
    keywords: ['color picker', 'hex color', 'rgb color', 'hsl color', 'color converter', 'color palette generator'],
  },
  {
    id: 'gradient-generator',
    label: 'CSS Gradient Generator',
    route: '/gradient-generator.html',
    category: 'Color',
    icon: '🌈',
    description:
      'Generate beautiful CSS linear, radial, and conic gradients visually. Copy CSS code instantly.',
    shortDesc: 'Generate CSS linear, radial & conic gradients',
    keywords: ['css gradient generator', 'linear gradient', 'radial gradient', 'gradient css', 'background gradient'],
  },
  // ── API/Network ───────────────────────────────────────────
  {
    id: 'curl-tester',
    label: 'cURL Tester',
    route: '/curl-tester.html',
    category: 'API/Network',
    icon: '🌐',
    description:
      'Run and debug API requests with cURL syntax online. Test HTTP endpoints, inspect headers and responses.',
    shortDesc: 'Run & debug cURL API requests',
    keywords: ['curl tester', 'api tester', 'curl online', 'http request tester', 'rest api tester'],
  },
  {
    id: 'curl-comparison',
    label: 'cURL Comparison',
    route: '/curl-comparison.html',
    category: 'API/Network',
    icon: '⇆',
    description:
      'Compare two cURL commands side-by-side. Highlight differences in headers, methods, params, and body.',
    shortDesc: 'Compare two cURL commands',
    keywords: ['curl comparison', 'compare curl commands', 'curl diff', 'api comparison'],
  },
  {
    id: 'deeplink',
    label: 'DeepLink Launcher',
    route: '/deeplink.html',
    category: 'API/Network',
    icon: '🔗',
    description:
      'Launch and test deep links for Android and iOS apps. Encode, decode, and generate QR codes from deep links.',
    shortDesc: 'Test Android & iOS deep links',
    keywords: ['deeplink tester', 'deep link launcher', 'android deep link', 'ios deep link', 'app link tester'],
  },
  // ── Encoding ──────────────────────────────────────────────
  {
    id: 'base64',
    label: 'Base64 Encoder / Decoder',
    route: '/base64.html',
    category: 'Encoding',
    icon: '🔤',
    description:
      'Encode and decode Base64 strings online. Supports text and file input. Free, no sign-up.',
    shortDesc: 'Encode & decode Base64 strings',
    keywords: ['base64 encoder', 'base64 decoder', 'encode base64', 'decode base64', 'base64 online'],
  },
  {
    id: 'url-encoder',
    label: 'URL Encoder / Decoder',
    route: '/url-encoder.html',
    category: 'Encoding',
    icon: '🔗',
    description:
      'Encode and decode URLs with percent encoding. Parse URL components and query parameters.',
    shortDesc: 'URL percent-encode & decode',
    keywords: ['url encoder', 'url decoder', 'percent encoding', 'uri encoder', 'url encode online'],
  },
  // ── Regex ─────────────────────────────────────────────────
  {
    id: 'regex-tester',
    label: 'Regex Tester',
    route: '/regex-tester.html',
    category: 'Regex',
    icon: '.*',
    description:
      'Test and debug regular expressions with live match highlighting. Supports all JS regex flags.',
    shortDesc: 'Test & debug regex with live highlighting',
    keywords: ['regex tester', 'regular expression tester', 'regex online', 'regex debugger', 'regex match'],
  },
  {
    id: 'regex-generator',
    label: 'Regex Generator',
    route: '/regex-generator.html',
    category: 'Regex',
    icon: '⚡',
    description:
      'Generate regular expressions from plain English descriptions. Select pattern types and get ready-to-use regex.',
    shortDesc: 'Generate regex from descriptions',
    keywords: ['regex generator', 'generate regex', 'regular expression generator', 'regex builder'],
  },
  {
    id: 'regex-library',
    label: 'Regex Library',
    route: '/regex-library.html',
    category: 'Regex',
    icon: '📚',
    description:
      'Browse a curated library of common regex patterns for email, phone, URL, date, and more.',
    shortDesc: 'Browse common regex patterns',
    keywords: ['regex library', 'regex patterns', 'common regex', 'regex examples', 'regex cheatsheet'],
  },
  // ── Security ──────────────────────────────────────────────
  {
    id: 'uuid-generator',
    label: 'UUID Generator',
    route: '/uuid-generator.html',
    category: 'Security',
    icon: '🆔',
    description:
      'Generate UUIDs (v1, v4, v7) online. Bulk generation, formatting options, and validation.',
    shortDesc: 'Generate UUID v1, v4, v7',
    keywords: ['uuid generator', 'guid generator', 'uuid v4', 'uuid v7', 'random uuid', 'unique id generator'],
  },
  // ── Social ────────────────────────────────────────────────
  {
    id: 'whatsapp-link',
    label: 'WhatsApp Link Generator',
    route: '/whatsapp-link.html',
    category: 'Social',
    icon: '💬',
    description:
      'Create wa.me click-to-chat WhatsApp links with pre-filled messages. Works for any phone number.',
    shortDesc: 'Create wa.me click-to-chat links',
    keywords: ['whatsapp link generator', 'wa.me link', 'whatsapp click to chat', 'whatsapp api link'],
  },
  // ── Lottie ────────────────────────────────────────────────
  {
    id: 'lottie-player',
    label: 'Lottie Player & Studio',
    route: '/tools/lottie-player',
    category: 'Lottie',
    icon: '🎬',
    description:
      'Preview, inspect layers, extract & swap colors, audit warnings, and edit Bodymovin Lottie JSON with real-time synchronized canvas preview. 100% client-side privacy.',
    shortDesc: 'Preview, inspect & edit Lottie animations',
    keywords: [
      'lottie player',
      'lottie studio',
      'lottie previewer',
      'lottie viewer online',
      'bodymovin preview',
      'lottie color editor',
      'lottie layer inspector',
      'json animation player',
      'dotlottie player',
      'lottie analyzer',
      'lottie editor',
      'lottie json editor',
      'edit lottie online',
      'lottie code editor',
      'lottie playground',
    ],
    heavy: true,
  },
  {
    id: 'lottie-converter',
    label: 'Lottie to dotLottie Converter',
    route: '/tools/lottie-converter',
    category: 'Lottie',
    icon: '📦',
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
    icon: '🛡️',
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
    icon: '⚡',
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

