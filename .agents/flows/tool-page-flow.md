# Tool Page Flow — How a Tool Page Works End-to-End

## Lifecycle of a Tool Page (e.g., JSON Formatter)

### 1. Build Time (SSG)

```
next build
  → src/app/tools/json-formatter/page.tsx
  → export const metadata = generateToolMetadata('json-formatter')
      → reads src/config/tools.ts registry
      → returns { title, description, openGraph, canonical, ... }
  → Next.js renders HTML shell with full <head> SEO tags
  → Outputs static HTML + JS chunks
```

### 2. Browser Load

```
User visits /tools/json-formatter
  → Static HTML served (fast, CDN-cached)
  → Root layout hydrates: ThemeProvider, Header, Footer
  → Tool page component hydrates
  → 'use client' components mount
```

### 3. User Interaction

```
User pastes JSON into editor
  → React state: setInput(value)
  → (auto-format or button click)
  → lib/json/formatter.ts:formatJSON(input)  ← pure function, no side effects
  → setOutput(result) or setError(err)
  → UI re-renders with output or error message
  → analytics.track('format_json', { success: true })
```

## Tool Page Template

Every tool page follows this pattern:

```tsx
// src/app/tools/[tool-name]/page.tsx

import { generateToolMetadata } from '@/config/seo';
import { Metadata } from 'next';
import ToolNameClient from './ToolNameClient';  // 'use client' component

export const metadata: Metadata = generateToolMetadata('tool-id');

export default function ToolPage() {
  return <ToolNameClient />;
}
```

And the client component:

```tsx
// src/app/tools/[tool-name]/ToolNameClient.tsx
'use client';

import { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import { pureFunction } from '@/lib/category/module';
import { analytics } from '@/lib/analytics';

export default function ToolNameClient() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  function handleAction() {
    const result = pureFunction(input);
    setOutput(result);
    analytics.track('event_name');
  }

  return (
    <ToolLayout toolId="tool-id">
      {/* Tool UI here */}
    </ToolLayout>
  );
}
```

## Key Constraints

- **No server actions for tool logic** — all processing is client-side
- **No API routes needed** — privacy-first; nothing leaves the browser
- **Lazy-load heavy deps** — CodeMirror, QR libraries via `dynamic()` with `{ ssr: false }`
- **Error boundaries** — each tool wrapped in React ErrorBoundary

