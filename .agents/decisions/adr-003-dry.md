# ADR-003: DRY Patterns & Shared Component Strategy

**Status:** Accepted  
**Date:** 2026-10-31

## Rules

### 1. One Source of Truth for Tool Metadata
All tool metadata (title, description, route, category, SEO) lives **only** in `src/config/tools.ts`.
- Tool pages import from this file; never define their own titles inline.
- Footer's tool list, tools directory page, and SEO all derive from this single registry.

### 2. Pure Logic in `src/lib/`
All business logic (JSON formatting, regex testing, color conversion, etc.) must:
- Be pure TypeScript functions (no React, no DOM)
- Have no side effects
- Be independently testable
- Live in `src/lib/<category>/`

The same functions used in the tool UI can be used in tests or future API routes.

### 3. One Layout — Root `layout.tsx`
- Header, footer, theme provider, analytics script → defined **once** in `src/app/layout.tsx`
- Every page inherits these automatically
- No per-page imports of header/footer/analytics

### 4. Shared Hooks
- `useTheme()` → the only place theme toggle logic lives
- `useClipboard()` → the only copy-to-clipboard implementation
- `useLocalStorage()` → type-safe localStorage; used by history features

### 5. ToolLayout Wrapper
Every tool page is wrapped in `<ToolLayout>` which provides:
- Consistent padding, max-width, breadcrumb
- Tool title + description heading
- Loading boundary (Suspense)

### 6. No Inline Styles
All styling via Tailwind CSS utility classes. No `style={{}}` props except for dynamic values (e.g., gradient preview colors).

### 7. Config-Driven SEO
```ts
// Every tool page:
export const metadata = generateToolMetadata('json-formatter');
// NOT: manually writing title/description/og tags
```

