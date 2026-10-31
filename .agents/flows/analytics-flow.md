# Analytics Flow — GA4 Event Tracking

## Architecture

All analytics calls go through `src/lib/analytics.ts` — never call `window.gtag()` directly.

```ts
analytics.track(ANALYTICS_EVENTS.FORMAT_JSON, { success: true });
```

## Environment Guard

Analytics is **disabled on localhost** automatically:
```ts
function isAnalyticsEnabled() {
  return !SITE.analyticsDisabledHosts.includes(window.location.hostname);
}
```

## Event Flow

```
User Action (in any tool component)
  → analytics.track('event_name', { ...props })
  → isAnalyticsEnabled() check
      → localhost? → return (skip)
      → production? → window.gtag('event', 'event_name', props)
  → GA4 collects event
```

## GA4 Setup

GA4 is loaded via `next/script` with `strategy="afterInteractive"` in `app/layout.tsx`:
- Does not block page render
- Loaded after first hydration
- `anonymize_ip: true` always set

## All Event Names

All event name constants live in `src/config/site.ts` → `ANALYTICS_EVENTS`.
This prevents typos and makes it easy to find all tracked events.

## Adding a New Event

1. Add constant to `ANALYTICS_EVENTS` in `src/config/site.ts`
2. Call `analytics.track(ANALYTICS_EVENTS.YOUR_EVENT)` in the component
3. That's it — no other files need updating

