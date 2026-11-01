import type { Metadata } from 'next';
import { generateStaticMetadata } from '@/config/seo';
import { SITE } from '@/config/site';

export const metadata: Metadata = generateStaticMetadata({
  title: 'Feedback',
  description: 'Share feedback, report bugs, or suggest new tools for Bharat Dev Tools.',
  path: '/feedback',
});

export default function FeedbackPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 text-center">
      <h1 className="text-3xl font-bold tracking-tight mb-3">Share Feedback</h1>
      <p className="text-muted-foreground mb-8">
        Found a bug? Have a tool idea? We'd love to hear from you.
      </p>
      <a
        href={SITE.feedbackFormUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
      >
        Open Feedback Form ↗
      </a>
      <p className="mt-6 text-xs text-muted-foreground">
        Opens Google Forms in a new tab
      </p>
    </main>
  );
}

