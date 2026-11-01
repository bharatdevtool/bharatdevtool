# Architecture Overview — Bharat Dev Tools (Next.js)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App (App Router)                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Root Layout │  │  Tool Pages  │  │  Static Pages    │  │
│  │  (RootLayout)│  │  /tools/[*]  │  │  /about /privacy │  │
│  │              │  │              │  │  /tools (index)  │  │
│  │  - Theme     │  │  - SSG       │  │                  │  │
│  │  - Analytics │  │  - Client UI │  │                  │  │
│  │  - Header    │  │  - Metadata  │  │                  │  │
│  │  - Footer    │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Shared Layer                        │   │
│  │  src/lib/         src/components/   src/config/      │   │
│  │  - formatters     - Header          - tools.ts       │   │
│  │  - validators     - Footer          - seo.ts         │   │
│  │  - encoders       - ThemeProvider   - analytics.ts   │   │
│  │  - analytics      - ToolLayout                       │   │
│  │  - hooks          - UI primitives                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## File/Folder Structure

```
d:\Projects\bharatdevtool\
├── .agents/                    ← AI agent context (this dir)
├── graphify-out/               ← Code graph (auto-generated)
├── src/
│   ├── app/                    ← Next.js App Router
│   │   ├── layout.tsx          ← Root layout (HTML shell, theme, analytics)
│   │   ├── page.tsx            ← Home → redirects to /tools/json-formatter
│   │   ├── about/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── feedback/page.tsx
│   │   ├── tools/
│   │   │   ├── page.tsx        ← Tools directory (/tools)
│   │   │   ├── json-formatter/page.tsx
│   │   │   ├── json-diff/page.tsx
│   │   │   ├── qr-generator/page.tsx
│   │   │   ├── qr-decoder/page.tsx
│   │   │   ├── color-picker/page.tsx
│   │   │   ├── gradient-generator/page.tsx
│   │   │   ├── curl-tester/page.tsx
│   │   │   ├── curl-comparison/page.tsx
│   │   │   ├── deeplink/page.tsx
│   │   │   ├── base64/page.tsx
│   │   │   ├── url-encoder/page.tsx
│   │   │   ├── regex-tester/page.tsx
│   │   │   ├── regex-generator/page.tsx
│   │   │   ├── regex-library/page.tsx
│   │   │   ├── word-counter/page.tsx
│   │   │   ├── text-case-converter/page.tsx
│   │   │   ├── password-generator/page.tsx
│   │   │   ├── uuid-generator/page.tsx
│   │   │   ├── whatsapp-link/page.tsx
│   │   │   └── age-calculator/page.tsx
│   │   └── globals.css         ← Global styles (Tailwind base)
│   │
│   ├── components/             ← Shared React components
│   │   ├── layout/
│   │   │   ├── Header.tsx      ← Site header with nav & theme toggle
│   │   │   ├── Footer.tsx      ← Site footer with all-tools grid
│   │   │   └── ToolLayout.tsx  ← Wrapper for every tool page
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── CopyButton.tsx  ← Reusable copy-to-clipboard
│   │   │   ├── ErrorMessage.tsx
│   │   │   └── Badge.tsx
│   │   └── tools/              ← Heavy tool-specific components (client)
│   │       ├── JsonEditor.tsx  ← CodeMirror 6 wrapper
│   │       └── QRCanvas.tsx    ← QR rendering wrapper
│   │
│   ├── lib/                    ← Pure business logic (no React)
│   │   ├── json/
│   │   │   ├── formatter.ts    ← format, minify, validate, escape JSON
│   │   │   └── differ.ts      ← JSON diff algorithm
│   │   ├── encoding/
│   │   │   ├── base64.ts
│   │   │   └── url.ts
│   │   ├── regex/
│   │   │   ├── engine.ts       ← test, validate regex
│   │   │   ├── generator.ts
│   │   │   └── patterns.ts     ← regex library patterns
│   │   ├── color/
│   │   │   ├── utils.ts        ← HEX/RGB/HSL conversions, palettes
│   │   │   └── gradient.ts
│   │   ├── text/
│   │   │   ├── caseConverter.ts
│   │   │   └── wordCounter.ts
│   │   ├── security/
│   │   │   ├── password.ts
│   │   │   └── uuid.ts
│   │   ├── curl/
│   │   │   ├── parser.ts       ← Parse cURL commands
│   │   │   └── comparator.ts
│   │   └── analytics.ts        ← Typed analytics event helpers
│   │
│   ├── config/
│   │   ├── tools.ts            ← Master tools registry (title, desc, route, category)
│   │   ├── seo.ts              ← SEO metadata factory
│   │   └── site.ts             ← Site-wide constants (GA ID, logo URL, etc.)
│   │
│   └── hooks/
│       ├── useTheme.ts         ← Dark/light theme hook
│       ├── useClipboard.ts     ← Copy to clipboard hook
│       └── useLocalStorage.ts  ← Type-safe localStorage hook
│
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   └── sitemap.xml             ← Auto-generated by Next.js
│
├── .agents/                    ← AI context (this directory)
├── graphify-out/               ← Graphify code graph output
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Routing Strategy

| Old URL | New URL |
|---------|---------|
| `/` (index.html) | `/tools/json-formatter` |
| `/jsonformatter/` | `/tools/json-formatter` |
| `/jsondiff/` | `/tools/json-diff` |
| `/color-picker.html` | `/tools/color-picker` |
| `/curl-tester.html` | `/tools/curl-tester` |
| `/tools.html` | `/tools` |
| `/about.html` | `/about` |
| `/privacy.html` | `/privacy` |
| `/feedback.html` | `/feedback` |
| (all other `.html` pages) | `/tools/<slug>` |

Redirects are configured in `next.config.ts` for SEO preservation.

## Rendering Strategy

| Page Type | Strategy | Reason |
|-----------|----------|--------|
| Tool pages | SSG (Static) | Fast, CDN-cacheable; logic is client-side |
| Tools index | SSG | Static listing |
| About/Privacy | SSG | Static content |
| Home | Redirect | `/` → `/tools/json-formatter` |

All tool **logic** runs entirely client-side (`'use client'`). Only the page shell is server-rendered for SEO.

