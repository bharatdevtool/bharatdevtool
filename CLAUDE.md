# CLAUDE.md — Agent & Developer Instructions

> **Project:** Bharat Dev Tools ([bharatdevtools.com](https://bharatdevtools.com))  
> **Repository Nature:** Proprietary commercial developer utility platform (NOT open source).  
> **Core Mission:** "Free developer tools, no sign-up, privacy-first, blazing fast."

---

## 1. Quick Reference & Commands

Always use **`pnpm`** as the package manager (never `npm` or `yarn`):

```bash
# Start local dev server (Turbopack, port 3000)
pnpm dev

# Type check across all TypeScript code
pnpm exec tsc --noEmit --skipLibCheck

# Compile production build (prerenders all 28 static routes)
pnpm build

# Serve compiled production build locally
pnpm start

# Run ESLint
pnpm lint
```

---

## 2. Core Architectural Principles (Non-Negotiable)

### 2.1. 100% Client-Side Privacy
- **Zero Server Relays**: User payloads (JSON, cURL strings, Base64, passwords, regex, QR text) must **NEVER** leave the browser.
- **No Third-Party APIs**: Never use external third-party web generation endpoints (e.g., `api.qrserver.com`). Always use offline client-side libraries (`qrcode`, `jsqr`, Web Crypto API).
- **Zero Server-Side Actions**: All 28 routes are pre-rendered statically (`export const dynamic = 'force-static'`). There are no server-side API handlers or databases.

### 2.2. Strict DRY Architecture
1. **Single Source of Truth (`src/config/tools.ts`)**:
   - Every tool in the application is registered in `TOOLS`.
   - Route paths, labels, categories, descriptions, and search keywords are defined here and only here.
   - Breadcrumbs, related tools, search indexing, and SEO meta tags consume this central registry.
2. **Pure Logic in `src/lib/`**:
   - All business logic (formatting, parsing, diffing, encoding, regex evaluation) lives in pure functions under `src/lib/`.
   - Pure functions must have **zero UI dependencies** (no React hooks, no DOM manipulation).
3. **Reusable UI Components in `src/components/ui/`**:
   - Reuse standard primitives: `CodeEditor`, `OutputPane`, `CommandPalette`, `CopyButton`, `SegmentedTabs`, `ErrorMessage`, `ToolIcon`.
   - Never implement ad-hoc custom textareas or duplicate copy buttons inside tool pages.
4. **Tool Wrapper (`src/components/layout/ToolLayout.tsx`)**:
   - Every tool page must be wrapped with `<ToolLayout toolId="...">`. It automatically renders breadcrumbs, title, category pill, client-side privacy badge, share button, and related tools.

---

## 3. Directory Layout

```
d:\Projects\bharatdevtool\
├── .agents/            # Architecture specifications, design system tokens, ADRs & agent skills
│   ├── arch/           # Technical architecture & design system tokens
│   ├── decisions/      # Architecture Decision Records (ADRs)
│   ├── docs/           # Preserved documentation (SEO, Analytics, Optimization)
│   └── skills/         # Agent skills (frontend-design, ui-ux-pro-max)
├── public/             # Static public assets (fonts, icons, OG images, robots.txt)
├── src/
│   ├── app/            # Next.js App Router (28 static pages)
│   ├── components/     # UI components (ui/ and layout/)
│   ├── config/         # Single source of truth (tools.ts, site.ts, seo.ts)
│   └── lib/            # Pure utility functions (json, curl, regex, utils)
├── CLAUDE.md           # Instructions for AI agents and developers
├── next.config.ts      # Next.js configuration
├── package.json        # Dependencies and scripts
├── pnpm-lock.yaml      # Deterministic package lockfile
├── postcss.config.mjs  # PostCSS Tailwind v4 plugin config
└── tsconfig.json       # TypeScript configuration
```

---

## 4. UI/UX & Design System Standards

- **Aesthetic Direction**: High-performance Developer Studio (Linear, Raycast, Vercel design language).
- **Color Tokens**:
  - Dark Mode: Background Obsidian (`#090E17`), Cards Slate-900 (`#0F172A`), Borders (`#1E293B`).
  - Light Mode: Background Slate-50 (`#F8FAFC`), Cards Pure White (`#FFFFFF`), Borders (`#E2E8F0`).
  - Primary Action: Dev Focus Blue (`#3B82F6` in dark, `#2563EB` in light).
  - Accent / Privacy: Emerald (`#10B981`).
- **Icons**:
  - Use **`lucide-react`** exclusively.
  - **Never use raw unicode emojis** as interface icons (e.g., no 📋, ⚙️, 🚀 in place of SVG vector icons).
- **Dedicated 12px Permanent Scrollbars**:
  - All scrolling panels must use `.developer-scrollbar` with `scrollbar-gutter: stable;` to ensure scrollbar tracks are visible and permanent.
- **Screen-Height Dual-Pane Layout**:
  - Dual-pane tools (e.g. JSON Formatter, Base64, URL Encoder) must use fixed screen height: `h-[calc(100vh-270px)] min-h-[520px]`.
  - Inner flex children must have `min-h-0` and `h-full` to prevent content from expanding the outer container. The outer web page should not scroll while the user navigates inside the tool editors.
- **Paste Behavior**:
  - Text editors must clamp scroll position to **Line 1 (`scrollTop = 0`)** when pasting large payloads to prevent jumping to the middle/end.

---

## 5. Adding a New Tool Workflow

When creating a new developer tool:
1. **Register the tool** in [`src/config/tools.ts`](file:///d:/Projects/bharatdevtool/src/config/tools.ts) with `id`, `label`, `category`, `description`, `route`, and `keywords`.
2. **Add icon mapping** in [`src/components/ui/ToolIcon.tsx`](file:///d:/Projects/bharatdevtool/src/components/ui/ToolIcon.tsx).
3. **Write pure business logic** in [`src/lib/<category>/`](file:///d:/Projects/bharatdevtool/src/lib/).
4. **Create route & client component**:
   - `src/app/tools/<tool-id>/page.tsx` (Server Component with static metadata).
   - `src/app/tools/<tool-id>/<ToolName>Client.tsx` (Client Component using `ToolLayout`, `CodeEditor`, `OutputPane`).
5. **Verify**:
   - Run `pnpm exec tsc --noEmit --skipLibCheck`.
   - Run `pnpm build` to verify static pre-rendering.

---

## 6. Deep Context & Architecture Documentation (`.agents/`)

When working on complex features, refactoring, or design system tokens, refer to [`.agents/`](file:///d:/Projects/bharatdevtool/.agents/):
- **Design System Tokens & Typography**: [`.agents/arch/design-system.md`](file:///d:/Projects/bharatdevtool/.agents/arch/design-system.md)
- **Technical Architecture & Flow**: [`.agents/arch/overview.md`](file:///d:/Projects/bharatdevtool/.agents/arch/overview.md) & [`.agents/arch/data-flow.md`](file:///d:/Projects/bharatdevtool/.agents/arch/data-flow.md)
- **Architectural Decision Records (ADRs)**: [`.agents/decisions/`](file:///d:/Projects/bharatdevtool/.agents/decisions/)
- **Preserved SEO, Analytics & Optimization Guides**: [`.agents/docs/`](file:///d:/Projects/bharatdevtool/.agents/docs/)

