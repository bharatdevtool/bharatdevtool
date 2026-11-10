// errorReporting.ts — thin wrapper over the Sentry Loader Script.
//
// Next.js pages load the same Sentry loader as the static HTML pages (see
// layout.tsx), so the full SDK is fetched only when an error actually occurs.
// Reports carry the error and React component stack only — never tool input.

interface SentryGlobal {
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const sentry = (window as unknown as { Sentry?: SentryGlobal }).Sentry;
  sentry?.captureException(error, context);
}
