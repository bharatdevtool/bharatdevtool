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
  | 'JSON & Data'
  | 'Image'
  | 'QR & Links'
  | 'Developer'
  | 'Encode & Security'
  | 'Calculators & Time'
  | 'Design & Animation';

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
  /**
   * Static HTML tool served from public/ (derived from the route). Its title,
   * meta, FAQ and JSON-LD live in the HTML file; the registry entry only feeds
   * navigation and search.
   */
  legacy: boolean;
}

const TOOL_ENTRIES: Omit<Tool, 'legacy'>[] = [
  // ── JSON ──────────────────────────────────────────────────
  {
    id: 'json-formatter',
    label: 'JSON Formatter',
    route: '/index.html',
    category: 'JSON & Data',
    description:
      'Format, beautify, minify, validate, escape and repair JSON instantly. Free online JSON formatter with clear error positions. Runs 100% in your browser.',
    shortDesc: 'Format, validate & minify JSON',
    keywords: ['json formatter', 'json beautifier', 'json minifier', 'json validator', 'pretty print json', 'json escape'],
    heavy: true,
  },
  {
    id: 'json-diff',
    label: 'JSON Diff',
    route: '/jsondiff/',
    category: 'JSON & Data',
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
    route: '/qr-generator-free.html',
    category: 'QR & Links',
    description:
      'Create QR codes for URLs, plain text and WiFi networks with custom colors and error correction. Free QR code generator that works offline in your browser.',
    shortDesc: 'Generate QR codes for any content',
    keywords: ['qr code generator', 'create qr code', 'free qr generator', 'qr code maker'],
    heavy: true,
  },
  {
    id: 'qr-decoder',
    label: 'QR Code Decoder',
    route: '/qr-decoder.html',
    category: 'QR & Links',
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
    route: '/color-picker.html',
    category: 'Design & Animation',
    description:
      'Pick colors and convert between HEX, RGB and HSL, explore complementary and triadic palettes, and check WCAG contrast. Free online color picker.',
    shortDesc: 'Pick & convert colors: HEX, RGB, HSL',
    keywords: ['color picker', 'hex color', 'rgb color', 'hsl color', 'color converter', 'color palette generator'],
  },
  {
    id: 'gradient-generator',
    label: 'CSS Gradient Generator',
    route: '/gradient-generator.html',
    category: 'Design & Animation',
    description:
      'Build linear, radial and conic CSS gradients with multiple color stops and a live preview, then copy the CSS. Free online CSS gradient generator.',
    shortDesc: 'Generate CSS linear, radial & conic gradients',
    keywords: ['css gradient generator', 'linear gradient', 'radial gradient', 'gradient css', 'background gradient'],
  },
  // ── API/Network ───────────────────────────────────────────
  {
    id: 'curl-tester',
    label: 'cURL Tester',
    route: '/curl-tester.html',
    category: 'Developer',
    description:
      'Parse cURL commands into method, URL, headers and body, and convert them to JavaScript fetch or Python requests code. Free and runs in your browser.',
    shortDesc: 'Run & debug cURL API requests',
    keywords: ['curl tester', 'api tester', 'curl online', 'http request tester', 'rest api tester'],
  },
  {
    id: 'curl-comparison',
    label: 'cURL Comparison',
    route: '/curl-comparison.html',
    category: 'Developer',
    description:
      'Compare two cURL commands side by side and spot differences in method, URL, query params, headers and body. Free online cURL diff tool, fully private.',
    shortDesc: 'Compare two cURL commands',
    keywords: ['curl comparison', 'compare curl commands', 'curl diff', 'api comparison'],
  },
  {
    id: 'deeplink',
    label: 'DeepLink Launcher',
    route: '/deeplink.html',
    category: 'QR & Links',
    description:
      'Parse, inspect and launch app deep links and custom URL schemes. Check scheme, host, path and query parameters before testing on device. Free tool.',
    shortDesc: 'Test Android & iOS deep links',
    keywords: ['deeplink tester', 'deep link launcher', 'android deep link', 'ios deep link', 'app link tester'],
  },
  // ── Encoding ──────────────────────────────────────────────
  {
    id: 'base64',
    label: 'Base64 Encoder / Decoder',
    route: '/base64.html',
    category: 'Encode & Security',
    description:
      'Encode text to Base64 and decode Base64 back to text instantly, with full Unicode support. Free online Base64 encoder and decoder, private in your browser.',
    shortDesc: 'Encode & decode Base64 strings',
    keywords: ['base64 encoder', 'base64 decoder', 'encode base64', 'decode base64', 'base64 online'],
  },
  {
    id: 'url-encoder',
    label: 'URL Encoder / Decoder',
    route: '/url-encoder.html',
    category: 'QR & Links',
    description:
      'Percent-encode URLs and query parameters, or decode and inspect encoded URLs instantly. Free online URL encoder and decoder that runs in your browser.',
    shortDesc: 'URL percent-encode & decode',
    keywords: ['url encoder', 'url decoder', 'percent encoding', 'uri encoder', 'url encode online'],
  },
  // ── Regex ─────────────────────────────────────────────────
  {
    id: 'regex-tester',
    label: 'Regex Tester',
    route: '/regex-tester.html',
    category: 'Developer',
    description:
      'Test JavaScript regular expressions live with highlighted matches, capture groups and flags. Free online regex tester with ready-made example patterns.',
    shortDesc: 'Test & debug regex with live highlighting',
    keywords: ['regex tester', 'regular expression tester', 'regex online', 'regex debugger', 'regex match'],
  },
  {
    id: 'regex-generator',
    label: 'Regex Generator',
    route: '/regex-generator.html',
    category: 'Developer',
    description:
      'Generate regex for emails, URLs, phone numbers, dates, UUIDs and more, or build custom patterns, then test them instantly. Free online regex generator.',
    shortDesc: 'Generate regex from descriptions',
    keywords: ['regex generator', 'generate regex', 'regular expression generator', 'regex builder'],
  },
  {
    id: 'regex-library',
    label: 'Regex Library',
    route: '/regex-library.html',
    category: 'Developer',
    description:
      'Browse a curated library of tested regular expressions for emails, URLs, phone numbers and more, with examples. Copy or test any pattern for free.',
    shortDesc: 'Browse common regex patterns',
    keywords: ['regex library', 'regex patterns', 'common regex', 'regex examples', 'regex cheatsheet'],
  },
  // ── Security ──────────────────────────────────────────────
  {
    id: 'uuid-generator',
    label: 'UUID Generator',
    route: '/uuid-generator.html',
    category: 'Encode & Security',
    description:
      'Generate UUID v1, v4 and v7 in bulk with uppercase and no-hyphen options, using secure browser randomness. Free online UUID generator, nothing stored.',
    shortDesc: 'Generate UUID v1, v4, v7',
    keywords: ['uuid generator', 'guid generator', 'uuid v4', 'uuid v7', 'random uuid', 'unique id generator'],
  },
  // ── Social ────────────────────────────────────────────────
  {
    id: 'whatsapp-link',
    label: 'WhatsApp Link Generator',
    route: '/whatsapp-link.html',
    category: 'QR & Links',
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
    category: 'Design & Animation',
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
    category: 'Design & Animation',
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
    category: 'Design & Animation',
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
    category: 'Design & Animation',
    description:
      'Safely compress Lottie animations with configurable coordinate rounding and optional metadata cleanup. Side-by-side preview with zero silent pruning.',
    shortDesc: 'Safely compress & clean Lottie animations',
    keywords: ['lottie optimizer', 'compress lottie json', 'reduce lottie file size', 'clean lottie metadata', 'bodymovin optimizer'],
    heavy: true,
  },
  // ── Static HTML tools added in Phase 2-4 ──────────────────
  {
    id: 'jwt-decoder',
    label: 'JWT Decoder',
    route: '/jwt-decoder.html',
    category: 'Encode & Security',
    description:
      'Free JWT decoder tool. Instantly decode and inspect JSON Web Tokens — view header, payload, and signature. Check expiry, claims, and token validity. No sign-up required. Runs entirely in your browser.',
    shortDesc: 'Free JWT decoder tool',
    keywords: ['jwt decoder', 'json web token decoder', 'decode jwt', 'jwt parser', 'jwt inspector', 'jwt token'],
  },
  {
    id: 'hash-generator',
    label: 'Hash Generator',
    route: '/hash-generator.html',
    category: 'Encode & Security',
    description:
      'Free online hash generator. Generate MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes instantly. Runs entirely in your browser — no data sent to any server. No sign-up required.',
    shortDesc: 'Free online hash generator',
    keywords: ['hash generator', 'md5 generator', 'sha256 generator', 'sha-1 hash', 'sha-512 hash', 'checksum generator'],
  },
  {
    id: 'lorem-ipsum',
    label: 'Lorem Ipsum Generator',
    route: '/lorem-ipsum.html',
    category: 'Developer',
    description:
      'Free Lorem Ipsum generator. Generate paragraphs, sentences, or words of placeholder text instantly. No sign-up required. Customize length and copy with one click.',
    shortDesc: 'Free Lorem Ipsum generator',
    keywords: ['lorem ipsum generator', 'placeholder text', 'dummy text', 'lorem ipsum online', 'generate lorem ipsum', 'filler text generator'],
  },
  {
    id: 'markdown-to-html',
    label: 'Markdown to HTML',
    route: '/markdown-to-html.html',
    category: 'Developer',
    description:
      'Free Markdown to HTML converter. Paste Markdown and instantly get HTML output with live preview. No sign-up required. Runs entirely in your browser — your data stays private.',
    shortDesc: 'Free Markdown to HTML converter',
    keywords: ['markdown to html', 'markdown converter', 'markdown editor', 'markdown preview', 'md to html', 'markdown online'],
  },
  {
    id: 'diff-checker',
    label: 'Diff Checker',
    route: '/diff-checker.html',
    category: 'Developer',
    description:
      'Free online diff checker and text comparison tool. Compare two text files side-by-side, find differences instantly. Supports line-by-line and character-level diff. No sign-up required.',
    shortDesc: 'Free online diff checker and text comparison tool',
    keywords: ['diff checker', 'text compare', 'compare two texts', 'online diff tool', 'text difference', 'find differences'],
  },
  {
    id: 'html-formatter',
    label: 'HTML Formatter & Beautifier',
    route: '/html-formatter.html',
    category: 'Developer',
    description:
      'Free HTML Formatter and Beautifier. Instantly format, indent, and pretty-print messy HTML code online. No sign-up required. Runs entirely in your browser — your code never leaves your device.',
    shortDesc: 'Free HTML Formatter and Beautifier',
    keywords: ['html formatter', 'html beautifier', 'html pretty print', 'html indenter', 'format html online', 'html code formatter'],
  },
  {
    id: 'percentage-calculator',
    label: 'Percentage Calculator',
    route: '/percentage-calculator.html',
    category: 'Calculators & Time',
    description:
      'Free percentage calculator online. Calculate percentages, percentage increase/decrease, percentage difference, and what percent one number is of another. No sign-up required.',
    shortDesc: 'Free percentage calculator online',
    keywords: ['percentage calculator', 'calculate percentage', 'percent calculator', 'percentage increase calculator', 'percentage decrease calculator', 'percentage difference'],
  },
  {
    id: 'bmi-calculator',
    label: 'BMI Calculator',
    route: '/bmi-calculator.html',
    category: 'Calculators & Time',
    description:
      'Free BMI Calculator online. Calculate your Body Mass Index instantly using height and weight. Supports metric (kg/cm) and imperial (lb/in) units. No sign-up required. Instant results.',
    shortDesc: 'Free BMI Calculator online',
    keywords: ['bmi calculator', 'body mass index', 'bmi calculation', 'weight height calculator', 'obesity calculator', 'healthy weight'],
  },
  {
    id: 'gst-calculator',
    label: 'GST Calculator',
    route: '/gst-calculator.html',
    category: 'Calculators & Time',
    description:
      'Free GST Calculator for India. Calculate GST amount, CGST, SGST, IGST instantly. Add or remove GST from any price. Supports all GST slabs: 5%, 12%, 18%, 28%. No sign-up required.',
    shortDesc: 'Free GST Calculator for India',
    keywords: ['gst calculator', 'gst calculator india', 'calculate gst', 'gst amount calculator', 'cgst sgst calculator', 'igst calculator'],
  },
  {
    id: 'emi-calculator',
    label: 'EMI Calculator',
    route: '/emi-calculator.html',
    category: 'Calculators & Time',
    description:
      'Free EMI Calculator online. Calculate monthly EMI for home loan, car loan, personal loan. Get full amortization schedule, total interest, and payment breakdown instantly. No sign-up required.',
    shortDesc: 'Free EMI Calculator online',
    keywords: ['emi calculator', 'loan emi calculator', 'home loan emi', 'car loan emi', 'personal loan emi', 'emi calculation formula'],
  },
  {
    id: 'timestamp-converter',
    label: 'Unix Timestamp Converter',
    route: '/timestamp-converter.html',
    category: 'Calculators & Time',
    description:
      'Free Unix timestamp converter. Convert epoch/Unix timestamps to human-readable dates and back. Supports all timezones including IST. No sign-up required. Runs entirely in your browser.',
    shortDesc: 'Free Unix timestamp converter',
    keywords: ['unix timestamp converter', 'epoch converter', 'timestamp to date', 'date to timestamp', 'epoch time', 'unix time'],
  },
  {
    id: 'timezone-converter',
    label: 'Timezone Converter',
    route: '/timezone-converter.html',
    category: 'Calculators & Time',
    description:
      'Free online timezone converter. Convert time between any two timezones instantly — IST, UTC, EST, PST, GMT and 400+ more. No sign-up required. Works entirely in your browser.',
    shortDesc: 'Free online timezone converter',
    keywords: ['timezone converter', 'time zone converter', 'convert timezone', 'IST to UTC', 'UTC to IST', 'EST to PST'],
  },
  {
    id: 'cron-generator',
    label: 'Cron Expression Generator',
    route: '/cron-generator.html',
    category: 'Developer',
    description:
      'Free online cron expression generator. Build cron schedules visually, validate cron syntax, see next run times, and get human-readable descriptions. No sign-up required.',
    shortDesc: 'Free online cron expression generator',
    keywords: ['cron expression generator', 'cron job builder', 'cron schedule', 'cron syntax', 'cron validator', 'linux cron'],
  },
  {
    id: 'image-converter',
    label: 'PNG ↔ JPG Converter',
    route: '/image-converter.html',
    category: 'Image',
    description:
      'Free PNG to JPG and JPG to PNG converter. Convert images instantly in your browser — no upload, no sign-up required. Supports PNG, JPG, WebP, and more.',
    shortDesc: 'Free PNG to JPG and JPG to PNG converter',
    keywords: ['png to jpg converter', 'jpg to png converter', 'image converter online', 'convert png to jpeg', 'free image converter', 'webp to png'],
  },
  {
    id: 'image-resizer',
    label: 'Image Resizer',
    route: '/image-resizer.html',
    category: 'Image',
    description:
      'Free online image resizer. Resize JPG, PNG, WebP, and GIF images to any custom width and height instantly. No sign-up required. All processing happens in your browser — your images stay private.',
    shortDesc: 'Free online image resizer',
    keywords: ['image resizer', 'resize image online', 'free image resizer', 'resize jpg', 'resize png', 'resize webp'],
  },
  {
    id: 'image-compressor',
    label: 'Image Compressor',
    route: '/image-compressor.html',
    category: 'Image',
    description:
      'Free online image compressor. Compress JPG, PNG, and WebP images instantly in your browser — no upload to server, no sign-up required. Reduce file size while keeping quality.',
    shortDesc: 'Free online image compressor',
    keywords: ['image compressor', 'compress image online', 'compress jpg', 'compress png', 'compress webp', 'reduce image size'],
  },
  {
    id: 'resize-image-to-kb',
    label: 'Resize Image to KB',
    route: '/resize-image-to-kb.html',
    category: 'Image',
    description:
      'Resize photos and signatures to 20 KB, 50 KB or any size for SSC, IBPS, SBI, NEET, JEE and UPSC forms. Batch resize, exact KB, free, nothing uploaded.',
    shortDesc: 'Exam photo & signature to exact KB',
    keywords: ['resize image to 20kb', 'compress image to 50kb', 'resize photo in kb', 'signature resize', 'exam photo resizer', 'ssc photo resize'],
  },
  {
    id: 'image-to-pdf',
    label: 'Image to PDF Converter',
    route: '/image-to-pdf.html',
    category: 'Image',
    description:
      'Free Image to PDF converter. Convert JPG, PNG, WebP images to PDF instantly in your browser. No sign-up required. Supports multiple images, A4/Letter page sizes, portrait and landscape orientation.',
    shortDesc: 'Free Image to PDF converter',
    keywords: ['image to pdf', 'jpg to pdf', 'png to pdf', 'convert image to pdf', 'free image to pdf', 'multiple images to pdf'],
  },
  {
    id: 'favicon-generator',
    label: 'Favicon Generator',
    route: '/favicon-generator.html',
    category: 'Image',
    description:
      'Free favicon generator — create favicons in all sizes (16x16 to 512x512) from any image or text/emoji. Download PNG files or a complete ZIP bundle. No sign-up required. Runs entirely in your browser.',
    shortDesc: 'Free favicon generator — create favicons in all sizes (16x16',
    keywords: ['favicon generator', 'favicon creator', 'create favicon', 'free favicon', 'favicon from image', 'favicon from text'],
  },
  {
    id: 'csv-json-converter',
    label: 'CSV ↔ JSON Converter',
    route: '/csv-json-converter.html',
    category: 'JSON & Data',
    description:
      'Free CSV to JSON converter and JSON to CSV converter. Convert data instantly in your browser — no upload, no sign-up. Supports custom delimiters, header detection, and pretty-print output.',
    shortDesc: 'Free CSV to JSON converter and JSON to CSV converter',
    keywords: ['csv to json converter', 'json to csv converter', 'csv json online', 'convert csv to json free', 'parse csv javascript', 'csv json tool'],
  },
  {
    id: 'yaml-json-converter',
    label: 'YAML ↔ JSON Converter',
    route: '/yaml-json-converter.html',
    category: 'JSON & Data',
    description:
      'Free YAML to JSON and JSON to YAML converter online. Convert, validate, and format YAML and JSON data instantly in your browser. No sign-up required. 100% private — data never leaves your device.',
    shortDesc: 'Free YAML to JSON and JSON to YAML converter online',
    keywords: ['yaml to json', 'json to yaml', 'yaml converter', 'yaml json converter', 'convert yaml', 'parse yaml online'],
  },
  {
    id: 'json-to-typescript',
    label: 'JSON to TypeScript Interface',
    route: '/json-to-typescript.html',
    category: 'JSON & Data',
    description:
      'Free JSON to TypeScript interface generator. Instantly convert JSON objects to TypeScript interfaces and types online. No sign-up required. Supports nested objects, arrays, and optional fields.',
    shortDesc: 'Free JSON to TypeScript interface generator',
    keywords: ['json to typescript', 'json to typescript interface', 'json to ts', 'convert json to typescript', 'typescript interface generator', 'json types'],
  },
];

export const TOOLS: Tool[] = TOOL_ENTRIES.map((t) => ({ ...t, legacy: !t.route.startsWith('/tools/') }));

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
  'JSON & Data', 'Image', 'QR & Links', 'Developer', 'Encode & Security', 'Calculators & Time', 'Design & Animation',
];

/** URL-safe id for each category (used by /tools?cat=… and footer.js). */
export const CATEGORY_SLUGS: Record<ToolCategory, string> = {
  'JSON & Data': 'json',
  'Image': 'image',
  'QR & Links': 'qr-links',
  'Developer': 'developer',
  'Encode & Security': 'security',
  'Calculators & Time': 'calculators',
  'Design & Animation': 'design',
};

