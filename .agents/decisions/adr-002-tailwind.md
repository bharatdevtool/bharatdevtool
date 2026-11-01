# ADR-002: Tailwind CSS v4 (Installed, Not CDN)

**Status:** Accepted  
**Date:** 2026-10-31

## Context

The original project used Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`). This has several problems:

1. **No tree-shaking** — ships the full ~350KB Tailwind CSS to every user
2. **No custom config persistence** — config defined inline in every HTML file
3. **Build-time config impossible** — can't use plugins or custom themes at build time
4. **Deprecated approach** — Tailwind recommends against CDN for production

## Decision

Use **Tailwind CSS v4** installed as a dev dependency with `@tailwindcss/turbopack` for Next.js.

## Configuration

Tailwind v4 uses a CSS-first config in `globals.css`:
```css
@import "tailwindcss";

@theme inline {
  --color-background: hsl(var(--background));
  /* ... */
}
```

CSS custom properties (variables) map semantic tokens (`--background`, `--foreground`, etc.) to Tailwind utility classes. Switching themes just changes the CSS variables — all Tailwind classes automatically reflect the new values.

## Dark Mode

Using `class` strategy (`html.dark` class). Set by `useTheme()` hook and the inline pre-hydration script. Tailwind `dark:` utilities work automatically.

