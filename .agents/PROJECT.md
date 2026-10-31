# Bharat Dev Tools — Project Overview

## What Is This?

**Bharat Dev Tools** is a free, no-sign-up, developer-focused toolkit website targeting Indian developers. It provides 20 browser-based tools for everyday development tasks — JSON formatting, QR codes, regex testing, color picking, cURL debugging, and more.

## Mission

> "Free developer tools, no sign-up, privacy-first, blazing fast."

## Tools Inventory (v2.2)

| # | Tool | Route | Category |
|---|------|--------|----------|
| 1 | JSON Formatter / Beautifier / Validator | `/` or `/tools/json-formatter` | JSON |
| 2 | JSON Diff / Comparison | `/tools/json-diff` | JSON |
| 3 | QR Code Generator | `/tools/qr-generator` | QR |
| 4 | QR Code Decoder | `/tools/qr-decoder` | QR |
| 5 | Color Picker (HEX/RGB/HSL) | `/tools/color-picker` | Color |
| 6 | CSS Gradient Generator | `/tools/gradient-generator` | Color |
| 7 | cURL Tester | `/tools/curl-tester` | API/Network |
| 8 | cURL Comparison | `/tools/curl-comparison` | API/Network |
| 9 | DeepLink Launcher & Tester | `/tools/deeplink` | API/Network |
| 10 | Base64 Encoder & Decoder | `/tools/base64` | Encoding |
| 11 | URL Encoder & Decoder | `/tools/url-encoder` | Encoding |
| 12 | Regex Tester | `/tools/regex-tester` | Regex |
| 13 | Regex Generator | `/tools/regex-generator` | Regex |
| 14 | Regex Library | `/tools/regex-library` | Regex |
| 15 | Word Counter & Character Counter | `/tools/word-counter` | Text |
| 16 | Text Case Converter | `/tools/text-case-converter` | Text |
| 17 | Password Generator | `/tools/password-generator` | Security |
| 18 | UUID Generator (v1, v4, v7) | `/tools/uuid-generator` | Security |
| 19 | WhatsApp Link Generator | `/tools/whatsapp-link` | Social |
| 20 | Age Calculator | `/tools/age-calculator` | Utility |

## Tech Stack

### Current (main branch — HTML/CSS)
- Vanilla HTML5 + CSS3
- Vanilla JavaScript (ES Modules)
- Tailwind CSS (CDN)
- CodeMirror 5 (JSON editor)
- Google Analytics 4
- Sentry (error tracking)

### Target (nextjs-migration branch)
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (installed, not CDN)
- **UI primitives:** shadcn/ui (optional, for complex UI)
- **State:** React hooks (no Redux needed — tools are mostly stateless)
- **SEO:** Next.js Metadata API (replaces manual `<head>` tags)
- **Analytics:** next/script + GA4
- **Error tracking:** Sentry (Next.js SDK)
- **Code editor:** CodeMirror 6 (React wrapper)
- **Package manager:** pnpm

## Key Design Principles

### DRY (Don't Repeat Yourself)
- All shared logic lives in `src/lib/` (pure functions)
- All shared UI lives in `src/components/`
- SEO metadata generated from a single `src/config/tools.ts` registry
- Theme, analytics, and layout are handled once at the root layout

### Privacy-First
- No user data stored server-side
- All tool processing is client-side only
- Analytics only on production (not localhost)
- `anonymize_ip: true` in GA4

### Performance
- Static generation (SSG) for all tool pages
- No unnecessary client-side JavaScript
- Lazy-load heavy libraries (CodeMirror, QR libs)

## External Services

| Service | Purpose | Key |
|---------|---------|-----|
| Google Analytics 4 | Usage tracking | `G-H00TEVH9KG` |
| Sentry | Error tracking | `377fa2c5032178b56ab058bb0a0fffbb` |
| ImageKit | Logo/image CDN | `https://ik.imagekit.io/bdt/` |
| Google Forms | User feedback | `https://forms.gle/TA7WEhzzQ6csQFGZ7` |

## Version

Current: **v2.2** (2026-05-06)

