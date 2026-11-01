# ADR-001: Migrate to Next.js (App Router)

**Status:** Accepted  
**Date:** 2026-10-31  
**Branch:** `nextjs-migration`

## Context

The original Bharat Dev Tools project is built as a collection of standalone HTML files with vanilla JS and CSS. As the tool count grew to 20+, the following problems emerged:

1. **No DRY** — Header, footer, theme, analytics scripts copy-pasted into every `.html` file
2. **No TypeScript** — No type safety; bugs harder to catch
3. **CDN Tailwind** — Cannot tree-shake; ~350KB of unused CSS shipped
4. **SEO maintenance** — Meta tags, OG tags, structured data manually duplicated
5. **No routing** — No clean URL structure; `.html` extensions in URLs
6. **No code splitting** — All JS loaded upfront per page

## Decision

Migrate to **Next.js 15 with App Router**, TypeScript, and Tailwind CSS v4 (installed).

## Rationale

| Need | Why Next.js |
|------|------------|
| SSG for tool pages | `export const dynamic = 'force-static'` — fast, CDN-able |
| SEO at build time | Metadata API — no runtime DOM manipulation |
| DRY layout | Root `layout.tsx` — header/footer/theme once |
| Clean URLs | App Router file-based routing |
| Type safety | TypeScript throughout |
| Tree-shaken CSS | Tailwind CSS v4 installed (not CDN) |
| Code splitting | Automatic per route |
| Redirects from old URLs | `next.config.ts` redirects |

## Consequences

- All tool logic ported from vanilla JS → TypeScript in `src/lib/`
- All pages become Next.js page components
- Old `.html` files remain on `main` branch for reference
- Deployment target: Vercel (zero-config Next.js)

