# Theme Flow — Dark / Light Mode

## How It Works

### 1. Prevent Flash (before hydration)
An inline `<script>` in `<head>` (in `app/layout.tsx`) runs **synchronously** before the browser paints:
```js
(function(){
  var t = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if (t === 'dark') document.documentElement.classList.add('dark');
})();
```
This sets the theme before React hydrates — no flash of white.

### 2. CSS Variables
`globals.css` defines `--background`, `--foreground`, etc. for both `:root` (light) and `[data-theme="dark"]`.

### 3. Tailwind Integration
`dark:` utility classes work because `html.dark` is set. CSS variables work via `@theme inline` mapping.

### 4. React State (`useTheme` hook)
`src/hooks/useTheme.ts` — on mount, reads `localStorage` and syncs React state. `toggleTheme()` updates both the DOM attribute and React state atomically.

### 5. Header Toggle
`Header.tsx` uses `useTheme()` → renders sun/moon icon → calls `toggleTheme()` on click → also fires analytics event.

## Data Flow
```
Page Load
  → inline script sets html[data-theme] + html.dark from localStorage
  → CSS variables apply immediately (no flash)
  → React hydrates
  → useTheme() reads localStorage → sets state (matches what's already applied)
  → Header renders with correct icon

User clicks toggle
  → toggleTheme() called
  → html[data-theme] + html.dark updated
  → localStorage updated
  → React state updated → Header re-renders with new icon
  → analytics.track('theme_toggle')
```

