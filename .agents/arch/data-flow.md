# Data Flow — Theme, State & Analytics

## Theme Flow (Dark / Light)

```
1. RootLayout (server) → renders <html data-theme="dark"> by default
2. ThemeProvider (client) → reads localStorage on mount → applies correct theme
3. useTheme() hook → exposes { theme, toggleTheme } to any component
4. Header.tsx → renders ThemeToggle button, calls toggleTheme()
5. CSS → uses `[data-theme="dark"]` selectors + Tailwind `dark:` classes
6. localStorage key: `theme` (values: 'dark' | 'light')
```

**No flash of wrong theme:** `<script>` in `<head>` sets `data-theme` before hydration (injected via `next/script` with `strategy="beforeInteractive"`).

## Tool State Flow

All tools are self-contained client components. State never leaves the browser.

```
User Input → React state (useState) → lib/* pure function → React state → UI
```

Example (JSON Formatter):
```
<textarea> onChange → setInput(value)
  → formatJSON(input) from lib/json/formatter.ts
  → setOutput(result)
  → <pre> displays formatted JSON
```

No server round-trips. No API routes needed for tool logic.

## Analytics Flow

```
User Action (click/paste/etc.)
  → Tool Component calls analytics.track('event_name', { props })
  → lib/analytics.ts checks: window.location.hostname === 'localhost'?
      YES → skip (dev mode)
      NO  → window.gtag('event', 'event_name', { props })
  → GA4 receives event
```

All event names are defined as a typed enum in `src/config/site.ts` to prevent typos.

## SEO / Metadata Flow

```
src/config/tools.ts (master registry)
  → each tool page calls generateToolMetadata(toolId)
  → returns Next.js Metadata object with title, description, OG, canonical
  → Next.js Metadata API renders <head> tags at build time (SSG)
```

No runtime `<head>` manipulation. All SEO is resolved at build time.

