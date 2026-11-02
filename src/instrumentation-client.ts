// instrumentation-client.ts — Sentry browser error tracking, initialised before the app hydrates

import * as Sentry from '@sentry/nextjs';
import { SITE } from '@/config/site';

const isDisabledHost = (SITE.analyticsDisabledHosts as readonly string[]).includes(window.location.hostname);

Sentry.init({
  dsn: SITE.sentryDsn,
  enabled: Boolean(SITE.sentryDsn) && !isDisabledHost,
  release: `bharatdevtools@${SITE.version}`,
  // Collect no user info, cookies, headers, bodies or query params (share links can carry tool input)
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0,
  // Tool inputs are private: never attach console output or typed values to error reports
  beforeBreadcrumb: (breadcrumb) =>
    breadcrumb.category === 'console' || breadcrumb.category === 'ui.input' ? null : breadcrumb,
});
