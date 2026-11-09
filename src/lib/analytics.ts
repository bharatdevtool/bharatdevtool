// ============================================================
// lib/analytics.ts — Typed analytics helpers
// All GA4 tracking goes through here. Never call window.gtag directly.
// ============================================================

import { SITE, ANALYTICS_EVENTS } from '@/config/site';

type EventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
type EventProps = Record<string, string | number | boolean>;

function isAnalyticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return !(SITE.analyticsDisabledHosts as readonly string[]).includes(window.location.hostname);
}

export const analytics = {
  /** Fire a GA4 custom event */
  track(event: EventName, props?: EventProps): void {
    if (!isAnalyticsEnabled()) return;
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', event, props ?? {});
  },

  /** Track a page view manually (Next.js router change) */
  pageview(url: string): void {
    if (!isAnalyticsEnabled()) return;
    if (typeof window.gtag !== 'function') return;
    window.gtag('config', SITE.ga4MeasurementId, { page_path: url });
  },
};

// Augment window type for gtag
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

