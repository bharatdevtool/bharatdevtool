import type { Metadata } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ROOT_METADATA } from '@/config/seo';
import { SITE } from '@/config/site';
import './globals.css';

const geistSans = localFont({
  src: '../../public/fonts/geist-sans.woff2',
  variable: '--font-geist-sans',
  display: 'swap',
});
const geistMono = localFont({
  src: '../../public/fonts/geist-mono.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = ROOT_METADATA;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent flash of wrong theme — runs before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})();`,
          }}
        />
        {/* Track tool visit for returning user routing */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;var m=31536000;document.cookie='bdt_visited=1;path=/;max-age='+m+';SameSite=Lax';if(p!=='/'&&p.indexOf('privacy.html')===-1&&p.indexOf('feedback.html')===-1&&p.indexOf('about.html')===-1)document.cookie='bdt_last_tool='+encodeURIComponent(p)+';path=/;max-age='+m+';SameSite=Lax';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header />
        {/* Same one-line trust strip as the static pages (public/components/footer.js) */}
        <p className="m-0 px-4 py-1.5 text-center text-xs sm:text-[13px] leading-snug whitespace-nowrap overflow-hidden text-ellipsis text-emerald-700 dark:text-emerald-300">
          <strong>100% free</strong> · No sign-up ·{' '}
          <span className="hidden sm:inline">Your data never leaves your browser</span>
          <span className="sm:hidden">Nothing uploaded</span>
        </p>
        <div className="flex flex-1 flex-col">
          {children}
        </div>
        <Footer />

        {/* Sentry Loader — same loader as the static HTML pages; the full SDK loads
            lazily on the first error. Skipped on local hosts. Privacy options are
            applied through sentryOnLoad: no PII, no console or input breadcrumbs. */}
        <Script id="sentry-loader" strategy="afterInteractive">
          {`
            (function(){
              var disabled = ${JSON.stringify(SITE.analyticsDisabledHosts)};
              if (disabled.indexOf(location.hostname) !== -1) return;
              window.sentryOnLoad = function () {
                Sentry.init({
                  release: 'bharatdevtools@${SITE.version}',
                  sendDefaultPii: false,
                  tracesSampleRate: 0,
                  beforeBreadcrumb: function (b) {
                    return b.category === 'console' || b.category === 'ui.input' ? null : b;
                  }
                });
              };
              var s = document.createElement('script');
              s.src = '${SITE.sentryLoaderUrl}';
              s.crossOrigin = 'anonymous';
              s.async = true;
              document.head.appendChild(s);
            })();
          `}
        </Script>

        {/* GA4 — loaded after page is interactive */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${SITE.ga4MeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${SITE.ga4MeasurementId}', {
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure'
            });
          `}
        </Script>
      </body>
    </html>
  );
}
