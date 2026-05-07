# BharatDevTool – Tool Development Roadmap

## How to Use This File
- Update `Status` as work progresses: `not-started` → `in-progress` → `done`
- Ship order: work top-to-bottom within each phase — do NOT skip phases
- Every new tool MUST follow the Page Build Checklist at the bottom (from `.cursorrules` Section 8)
- Update `sitemap.xml` and `tools.html` as part of every tool ship

---

## Existing Tools ✅ (Already Live)

| Tool | Category | File | Status |
|------|----------|------|--------|
| JSON Formatter | json | `index.html` + `jsonformatter/index.html` | ✅ done |
| JSON Diff | json | `jsondiff/index.html` | ✅ done |
| QR Code Generator | qr | `qr-generator-free.html` | ✅ done |
| Simple QR | qr | `simple-qr.html` | ✅ done |
| QR Code Decoder | qr | `qr-decoder.html` | ✅ done |
| Regex Tester | regex | `regex-tester.html` | ✅ done |
| Regex Generator | regex | `regex-generator.html` | ✅ done |
| Regex Library | regex | `regex-library.html` | ✅ done |
| URL Encoder/Decoder | developer | `url-encoder.html` | ✅ done |
| Base64 Encoder/Decoder | developer | `base64.html` | ✅ done |
| cURL Tester | developer | `curl-tester.html` | ✅ done |
| cURL Comparison | developer | `curl-comparison.html` | ✅ done |
| DeepLink Launcher | developer | `deeplink.html` | ✅ done |
| Color Picker | design | `color-picker.html` | ✅ done |
| Gradient Generator | design | `gradient-generator.html` | ✅ done |

---

## Phase 1 – Quick Wins
**Target: Week 1–2** | Low effort (0.5–1 day each) | Very High traffic | Ship first for early SEO gains

| # | Tool | Category | Traffic Potential | Effort | Status | File |
|---|------|----------|-------------------|--------|--------|------|
| 1 | Word / Character Counter | text | Very High | 0.5d | `done` | `word-counter.html` |
| 2 | WhatsApp Link Generator | utility | High (India) | 0.5d | `done` | `whatsapp-link.html` |
| 3 | Age Calculator | calculator | Very High (India) | 1d | `done` | `age-calculator.html` |
| 4 | UUID Generator | developer | High | 0.5d | `done` | `uuid-generator.html` |
| 5 | Password Generator | security | High | 0.5d | `done` | `password-generator.html` |
| 6 | Text Case Converter | text | High | 0.5d | `done` | `text-case-converter.html` |

**Why these first:**
- All are 0.5–1 day builds — fast to ship, fast to get indexed
- Word Counter + Age Calculator have massive India search volume
- WhatsApp Link Generator is India-specific with almost no quality free competitors
- UUID + Password + Text Case are bookmark-worthy dev utilities

---

## Phase 2 – India-Specific High Traffic
**Target: Week 3–4** | Medium effort | Very High India traffic | Strong local SEO advantage

| # | Tool | Category | Traffic Potential | Effort | Status | File |
|---|------|----------|-------------------|--------|--------|------|
| 7 | Percentage Calculator | calculator | High | 1d | `done` | `percentage-calculator.html` |
| 8 | BMI Calculator | calculator | Very High (India) | 0.5d | `in-progress` | `bmi-calculator.html` |
| 9 | GST Calculator | calculator | Very High (India) | 1.5d | `not-started` | `gst-calculator.html` |
| 10 | EMI / Loan Calculator | calculator | High (India) | 1.5d | `not-started` | `emi-calculator.html` |
| 11 | Unix Timestamp Converter | developer | High | 1d | `not-started` | `timestamp-converter.html` |
| 12 | JWT Decoder | developer | High | 1d | `not-started` | `jwt-decoder.html` |

**Why these next:**
- GST / EMI / BMI / Age = top searched calculator terms in India
- Competitors exist but have terrible UX — clean free tools will retain users
- JWT Decoder: privacy-conscious devs prefer local/browser-based tools
- Unix Timestamp: muscle-memory Google search for every developer

---

## Phase 3 – Image & Data Tools
**Target: Week 5–8** | Higher effort | Very High global traffic | Quality matters most here

| # | Tool | Category | Traffic Potential | Effort | Status | File |
|---|------|----------|-------------------|--------|--------|------|
| 13 | PNG ↔ JPG Converter | image | Very High | 1d | `not-started` | `image-converter.html` |
| 14 | Image Resizer | image | High | 1d | `not-started` | `image-resizer.html` |
| 15 | Image Compressor | image | Very High | 2d | `not-started` | `image-compressor.html` |
| 16 | Image to PDF | image | Very High | 2d | `not-started` | `image-to-pdf.html` |
| 17 | Hash Generator (MD5/SHA) | security | High | 1d | `not-started` | `hash-generator.html` |
| 18 | CSV ↔ JSON Converter | developer | High | 1d | `not-started` | `csv-json-converter.html` |
| 19 | YAML ↔ JSON Converter | developer | High | 1.5d | `not-started` | `yaml-json-converter.html` |
| 20 | Diff Checker (Text Compare) | developer | High | 2d | `not-started` | `diff-checker.html` |

**Notes:**
- Image Compressor: use Canvas API + WebP conversion — match TinyPNG quality for free
- Image tools all use Canvas API (no backend needed)
- Hash Generator: clearly state "runs in browser only" — security-sensitive users prefer this
- CSV/YAML converters: data people + devs = loyal repeat users

---

## Phase 4 – Extended Utility Tools
**Target: Week 9–12** | Mix of effort levels | Completes the catalog

| # | Tool | Category | Traffic Potential | Effort | Status | File |
|---|------|----------|-------------------|--------|--------|------|
| 21 | Cron Expression Generator | developer | High | 1d | `not-started` | `cron-generator.html` |
| 22 | Lorem Ipsum Generator | text | High | 0.5d | `not-started` | `lorem-ipsum.html` |
| 23 | Timezone Converter | utility | High | 1d | `not-started` | `timezone-converter.html` |
| 24 | Markdown to HTML | text | High | 1d | `not-started` | `markdown-to-html.html` |
| 25 | JSON → TypeScript Interface | developer | Medium-High | 1.5d | `not-started` | `json-to-typescript.html` |
| 26 | HTML Formatter/Beautifier | developer | High | 1d | `not-started` | `html-formatter.html` |
| 27 | Favicon Generator | design | High | 1d | `not-started` | `favicon-generator.html` |
| 28 | Reading Time Estimator | text | Medium | 0.5d | `not-started` | `reading-time.html` |

---

## Infrastructure & Quality Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| tools.html – Category filter + search | High | `done` | Enables navigation as catalog grows |
| tools.html – Cross-link related tools on each page | High | `not-started` | Add "Related tools" section on every tool page |
| Each new tool – Add to tools.html catalog | Ongoing | — | Required per `.cursorrules` §8.4 |
| Each new tool – Update sitemap.xml | Ongoing | — | Required per `.cursorrules` §8.1 |
| Each new tool – Add to analytics.js PAGE_NAMES | Ongoing | — | Required per `.cursorrules` §8.1 |
| Google Search Console – submit sitemap | High | `not-started` | Do after 5+ tools are live |
| Ads setup (Google AdSense) | Medium | `not-started` | Apply after consistent traffic |

---

## Per-Tool Build Checklist
Copy this checklist comment into each new tool's HTML file as you build it.

```
TOOL BUILD CHECKLIST (delete when all done):
[ ] HTML file at correct path
[ ] Header + Footer components included
[ ] Analytics script (defer)
[ ] Sentry script included
[ ] Theme script included (early — prevents flash)
[ ] Page added to PAGE_NAMES in analytics.js
[ ] Title includes "Free" keyword
[ ] Meta description with "Free" keyword + benefits
[ ] FAQ section with SEO keywords + FAQPage JSON-LD schema
[ ] WebApplication + BreadcrumbList structured data
[ ] Open Graph + Twitter Card tags
[ ] Canonical URL set
[ ] Mobile responsive (test on 375px width)
[ ] Accessibility: ARIA labels, keyboard navigation
[ ] No console.log — use analytics/Sentry
[ ] Error tracking with analytics for all failure paths
[ ] UI freeze detection for heavy operations
[ ] Tool card added to tools.html (feature card + ItemList schema entry)
[ ] data-category + data-tags added to tools.html card
[ ] sitemap.xml updated
[ ] Test file created in /test/
[ ] Test registered in run-all-tests.js
```

---

## Category Reference
Use these exact values in `data-category` on tools.html cards:

| Slug | Display Label | Current Tools |
|------|---------------|---------------|
| `json` | JSON | JSON Formatter, JSON Diff |
| `qr` | QR Codes | QR Generator, QR Decoder, Simple QR |
| `developer` | Developer | DeepLink, URL Encoder, Base64, cURL Tester, cURL Comparison, UUID, Timestamp, JWT, CSV/JSON, YAML/JSON, Diff, Cron, HTML Formatter, JSON→TS |
| `regex` | Regex | Regex Tester, Generator, Library |
| `design` | Design | Color Picker, Gradient Generator, Favicon |
| `calculator` | Calculator | Age, Percentage, BMI, GST, EMI |
| `text` | Text | Word Counter, Text Case Converter, Lorem Ipsum, Markdown→HTML, Reading Time |
| `image` | Image | Image Compressor, PNG↔JPG, Image Resizer, Image to PDF |
| `security` | Security | Password Generator, Hash Generator, JWT Decoder |
| `utility` | Utility | WhatsApp Link, Timezone Converter |
