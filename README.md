# 🇮🇳 Bharat Dev Tools

> **Privacy-first, blazing-fast browser-based developer utility platform.**  
> Proprietary developer suite for [bharatdevtools.com](https://bharatdevtools.com). Zero sign-up, 100% client-side execution, with zero telemetry of user code or input data.

---

## ⚡ Core Platform Capabilities

- 🔒 **100% Client-Side Privacy**: JSON parsing, QR generation, regex matching, encoding, and cryptographic hashing run entirely in local browser Web APIs / JavaScript. User payloads and code never touch a server.
- ⚡ **Next.js 16 App Router (Turbopack)**: 28 pre-rendered static routes (SSG) for instantaneous sub-second page delivery with zero server load.
- 🎨 **Developer Studio UX**: High-contrast dedicated 12px permanent scrollbars, viewport screen-height editor layouts, and instant keyboard navigation (`⌘K` / `Ctrl+K` Command Palette).
- 🧩 **Strict DRY Architecture**: A single central registry ([`src/config/tools.ts`](file:///d:/Projects/bharatdevtool/src/config/tools.ts)) drives routing, metadata, breadcrumbs, search indexing, and category relationships.

---

## 🛠️ Complete Tools Inventory (20 Tools)

| Category | Tool | Route | Key Capabilities |
|---|---|---|---|
| **JSON & Data** | **JSON Formatter & Validator** | [`/tools/json-formatter`](file:///d:/Projects/bharatdevtool/src/app/tools/json-formatter/page.tsx) | Pretty-print (2/4 indent), minify, escape, unescape, and auto-repair broken JSON. |
| **JSON & Data** | **JSON Diff** | [`/tools/json-diff`](file:///d:/Projects/bharatdevtool/src/app/tools/json-diff/page.tsx) | Semantic side-by-side comparison with structural difference chips. |
| **JSON & Data** | **Base64 Encoder / Decoder** | [`/tools/base64`](file:///d:/Projects/bharatdevtool/src/app/tools/base64/page.tsx) | Live bidirectional Base64 string & payload translation. |
| **JSON & Data** | **URL Encoder / Decoder** | [`/tools/url-encoder`](file:///d:/Projects/bharatdevtool/src/app/tools/url-encoder/page.tsx) | Percent-encoding and structured query parameter decomposition table. |
| **JSON & Data** | **UUID Generator** | [`/tools/uuid-generator`](file:///d:/Projects/bharatdevtool/src/app/tools/uuid-generator/page.tsx) | Cryptographic UUID v4 (random), v7 (time-ordered), and v1 batch generation & validation. |
| **API & Network** | **cURL Command Tester** | [`/tools/curl-tester`](file:///d:/Projects/bharatdevtool/src/app/tools/curl-tester/page.tsx) | Parse cURL syntax into HTTP method, headers, params, and Fetch / Python code snippets. |
| **API & Network** | **cURL Comparison** | [`/tools/curl-comparison`](file:///d:/Projects/bharatdevtool/src/app/tools/curl-comparison/page.tsx) | Side-by-side diffing of methods, endpoints, authorization headers, and request bodies. |
| **API & Network** | **DeepLink Launcher** | [`/tools/deeplink`](file:///d:/Projects/bharatdevtool/src/app/tools/deeplink/page.tsx) | Test mobile & desktop URI schemes (`app://`, `intent://`) with URL parameter analysis. |
| **API & Network** | **WhatsApp Link Generator** | [`/tools/whatsapp-link`](file:///d:/Projects/bharatdevtool/src/app/tools/whatsapp-link/page.tsx) | Create direct chat click-to-chat links and offline QR codes with pre-filled messages. |
| **Regex & Text** | **Regex Tester** | [`/tools/regex-tester`](file:///d:/Projects/bharatdevtool/src/app/tools/regex-tester/page.tsx) | Live real-time RegEx engine with visual flag chips and match group highlights. |
| **Regex & Text** | **Regex Generator** | [`/tools/regex-generator`](file:///d:/Projects/bharatdevtool/src/app/tools/regex-generator/page.tsx) | Build patterns from common templates with interactive variable configuration. |
| **Regex & Text** | **Regex Pattern Library** | [`/tools/regex-library`](file:///d:/Projects/bharatdevtool/src/app/tools/regex-library/page.tsx) | Curated directory of production-tested regex patterns (email, phone, dates, passwords, etc.). |
| **Design & Color** | **Color Picker & Converter** | [`/tools/color-picker`](file:///d:/Projects/bharatdevtool/src/app/tools/color-picker/page.tsx) | HEX, RGB, HSL conversions, harmonic palettes, and WCAG 2.1 accessibility contrast ratios. |
| **Design & Color** | **CSS Gradient Studio** | [`/tools/gradient-generator`](file:///d:/Projects/bharatdevtool/src/app/tools/gradient-generator/page.tsx) | Linear & radial gradient designer with multi-stop color controls and CSS/Tailwind export. |
| **Security & Utilities** | **QR Code Generator** | [`/tools/qr-generator`](file:///d:/Projects/bharatdevtool/src/app/tools/qr-generator/page.tsx) | 100% offline Canvas-based QR generation for URLs, text, and WiFi networks with PNG/SVG export. |
| **Security & Utilities** | **QR Code Decoder** | [`/tools/qr-decoder`](file:///d:/Projects/bharatdevtool/src/app/tools/qr-decoder/page.tsx) | Drag-and-drop image QR scanner powered entirely in-browser by `jsqr`. |

---

## 🏗️ Technical Architecture & Project Structure

```
d:\Projects\bharatdevtool\
├── .agents/                    # Agent guidelines, architecture specs, ADRs & design system
│   ├── arch/                   # Technical architecture & design tokens documentation
│   ├── decisions/              # Architectural Decision Records (ADRs)
│   ├── docs/                   # Archived guides (SEO, Analytics, Optimization)
│   └── skills/                 # Agent intelligence skills (frontend-design, ui-ux-pro-max)
├── public/                     # Static assets (Geist woff2 fonts, OG preview, icons, robots)
├── src/
│   ├── app/                    # Next.js App Router (28 prerendered static routes)
│   │   ├── layout.tsx          # Root shell (Font loading, dark theme initialization, header/footer)
│   │   ├── globals.css         # Tailwind v4 tokens, theme definitions & 12px custom scrollbars
│   │   ├── page.tsx            # Root redirect to primary tool
│   │   ├── about/              # About & architectural principles page
│   │   ├── feedback/           # User feedback route
│   │   ├── privacy/            # Privacy statement (Zero telemetry guarantees)
│   │   └── tools/              # All 20 interactive tool directories
│   ├── components/             # Reusable UI component library
│   │   ├── layout/             # Header, Footer, ToolLayout (breadcrumbs, category badges)
│   │   └── ui/                 # CodeEditor, OutputPane, CommandPalette, CopyButton, SegmentedTabs
│   ├── config/                 # Single Source of Truth
│   │   ├── tools.ts            # Central registry of all 20 tools (routes, metadata, categories)
│   │   ├── site.ts             # Site constants & analytics events
│   │   └── seo.ts              # Canonical OpenGraph & JSON-LD schema definitions
│   └── lib/                    # Pure, deterministic client-side utility functions
│       ├── analytics.ts        # Client-side GA4 wrapper (disabled on localhost)
│       ├── json/               # Formatter, validator, minifier & repair logic
│       ├── curl/               # cURL command parser & HTTP code generator
│       ├── regex/              # RegEx execution engine & library catalog
│       └── utils.ts            # Tailwind class merging (cn) & byte formatters
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies & package scripts
├── pnpm-lock.yaml              # Deterministic package lockfile
├── postcss.config.mjs          # PostCSS configuration for @tailwindcss/postcss
└── tsconfig.json               # TypeScript strict configuration
```

---

## 💻 Developer Commands

All operational tasks are run using [`pnpm`](https://pnpm.io/):

```bash
# Start local development server with Turbopack (http://localhost:3000)
pnpm dev

# Type check across the entire TypeScript codebase
pnpm exec tsc --noEmit --skipLibCheck

# Production build (Compiles & prerenders all 28 static routes)
pnpm build

# Serve compiled production build locally
pnpm start

# Lint with ESLint
pnpm lint
```

---

## 🎨 Design System & UX Standards

- **Color Tokens**: Dark Obsidian (`#090E17`) background with Slate 900 (`#0F172A`) elevated cards, Dev Focus Blue (`#3B82F6`) primary actions, and Emerald (`#10B981`) privacy badges.
- **Scrollbars**: Dedicated 12px permanent developer scrollbars with `scrollbar-gutter: stable;` across dark and light modes, preventing content jump.
- **Dual-Pane Screen Fit**: Code editors and output panes are fixed to screen height (`calc(100vh - 270px) min-h-[520px]`), allowing smooth independent scrolling without scrolling the main page.
- **Typography**: Local self-hosted [Geist Sans](https://vercel.com/font/sans) and [Geist Mono](https://vercel.com/font/mono) fonts for crisp, legible code rendering.

---

## 🔒 Privacy Architecture

Bharat Dev Tools is built on a strict privacy-first foundation:
1. **Zero Server Relays**: Payloads entered into JSON tools, cURL builders, Base64 decoders, or QR generators never leave the client's machine.
2. **Offline-Capable Libraries**: Uses client-side `qrcode` and `jsqr` instead of external third-party generation APIs.
3. **Transparent Analytics**: Only high-level anonymous page views and tool usage events are recorded in production via Google Analytics 4 (`anonymize_ip: true`). Analytics are completely disabled on `localhost`.
