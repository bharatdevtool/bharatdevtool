# Next.js App Structure Reference

## Location on Disk

```
d:\Projects\bharatdevtool\
├── nextjs/          ← Next.js app (nextjs-migration branch)
│   ├── src/
│   ├── public/
│   ├── next.config.ts
│   ├── package.json
│   └── ...
├── .agents/         ← AI context (this dir)
├── graphify-out/    ← Code graph
└── [old HTML files] ← Reference (main branch)
```

## Running the App

```bash
cd d:\Projects\bharatdevtool\nextjs
pnpm dev        # Start dev server at http://localhost:3000
pnpm build      # Production build
pnpm start      # Start production server
```

## Routing — Full Route Table

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Redirects → `/tools/json-formatter` |
| `/tools` | `src/app/tools/page.tsx` | All tools directory |
| `/tools/json-formatter` | `src/app/tools/json-formatter/page.tsx` | JSON Formatter |
| `/tools/json-diff` | `src/app/tools/json-diff/page.tsx` | JSON Diff |
| `/tools/qr-generator` | `src/app/tools/qr-generator/page.tsx` | QR Generator |
| `/tools/qr-decoder` | `src/app/tools/qr-decoder/page.tsx` | QR Decoder |
| `/tools/color-picker` | `src/app/tools/color-picker/page.tsx` | Color Picker |
| `/tools/gradient-generator` | `src/app/tools/gradient-generator/page.tsx` | Gradient Generator |
| `/tools/curl-tester` | `src/app/tools/curl-tester/page.tsx` | cURL Tester |
| `/tools/curl-comparison` | `src/app/tools/curl-comparison/page.tsx` | cURL Comparison |
| `/tools/deeplink` | `src/app/tools/deeplink/page.tsx` | DeepLink Launcher |
| `/tools/base64` | `src/app/tools/base64/page.tsx` | Base64 Encoder/Decoder |
| `/tools/url-encoder` | `src/app/tools/url-encoder/page.tsx` | URL Encoder/Decoder |
| `/tools/regex-tester` | `src/app/tools/regex-tester/page.tsx` | Regex Tester |
| `/tools/regex-generator` | `src/app/tools/regex-generator/page.tsx` | Regex Generator |
| `/tools/regex-library` | `src/app/tools/regex-library/page.tsx` | Regex Library |
| `/tools/word-counter` | `src/app/tools/word-counter/page.tsx` | Word Counter |
| `/tools/text-case-converter` | `src/app/tools/text-case-converter/page.tsx` | Text Case Converter |
| `/tools/password-generator` | `src/app/tools/password-generator/page.tsx` | Password Generator |
| `/tools/uuid-generator` | `src/app/tools/uuid-generator/page.tsx` | UUID Generator |
| `/tools/whatsapp-link` | `src/app/tools/whatsapp-link/page.tsx` | WhatsApp Link Generator |
| `/tools/age-calculator` | `src/app/tools/age-calculator/page.tsx` | Age Calculator |
| `/about` | `src/app/about/page.tsx` | About page |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy Policy |
| `/feedback` | `src/app/feedback/page.tsx` | Feedback |

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.x | Framework |
| react | 19.x | UI |
| tailwindcss | 4.x | Styling |
| typescript | 5.x | Type safety |
| qrcode | 1.5.x | QR generation |
| jsqr | 1.4.x | QR decoding |

## Adding a New Tool — Checklist

1. Add entry to `src/config/tools.ts` (TOOLS array)
2. Create `src/app/tools/<slug>/` directory
3. Create `page.tsx` with `export const metadata = generateToolMetadata('<id>')`
4. Create `<Name>Client.tsx` with `'use client'` + `<ToolLayout toolId="<id>">`
5. Add business logic to `src/lib/<category>/`
6. Add analytics event constant to `ANALYTICS_EVENTS` in `src/config/site.ts`
7. Add redirect from old HTML URL in `next.config.ts` (if applicable)

