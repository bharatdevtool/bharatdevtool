import type { Metadata } from 'next';
import { generateStaticMetadata } from '@/config/seo';
import { SITE } from '@/config/site';

export const metadata: Metadata = generateStaticMetadata({
  title: 'Privacy Policy',
  description: 'Privacy policy for Bharat Dev Tools. We do not collect or store your data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground mb-8">Last updated: October 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-foreground font-semibold text-base mb-2">The Short Version</h2>
          <p className="text-foreground font-medium">
            We don't collect your tool inputs. All processing happens in your browser. Period.
          </p>
        </section>

        <section>
          <h2 className="text-foreground font-semibold text-base mb-2">What We Collect</h2>
          <ul className="space-y-1 list-disc pl-4">
            <li><strong>Analytics (GA4):</strong> Page views, tool usage events (e.g., "format_json clicked"), browser type. This is anonymised and aggregated — we cannot identify individual users.</li>
            <li><strong>No tool data:</strong> The JSON you paste, the regex you test, passwords you generate — none of this is transmitted anywhere.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground font-semibold text-base mb-2">Cookies & Local Storage</h2>
          <p>We use <code>localStorage</code> to save your theme preference (dark/light). No cookies are set by us. Google Analytics may set its own cookies per their policy.</p>
        </section>

        <section>
          <h2 className="text-foreground font-semibold text-base mb-2">Third-Party Services</h2>
          <ul className="space-y-1 list-disc pl-4">
            <li><strong>Google Analytics 4</strong> — usage analytics with <code>anonymize_ip: true</code></li>
            <li><strong>Sentry</strong> — anonymous error tracking (no user data in error reports)</li>
            <li><strong>ImageKit</strong> — logo CDN</li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground font-semibold text-base mb-2">Contact</h2>
          <p>
            Questions? Reach us via the{' '}
            <a href={SITE.feedbackFormUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              feedback form
            </a>.
          </p>
        </section>
      </div>
    </main>
  );
}

