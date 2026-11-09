'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, HelpCircle, Sparkles } from 'lucide-react';
import { getToolById, TOOLS, CATEGORY_SLUGS } from '@/config/tools';
import { getToolFaqs } from '@/config/faqs';
import { generateToolJsonLd } from '@/config/seo';
import { SITE } from '@/config/site';
import ToolIcon from '@/components/ui/ToolIcon';
import CopyButton from '@/components/ui/CopyButton';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

interface ToolLayoutProps {
  toolId: string;
  children: React.ReactNode;
  headingOverride?: string;
}

const subscribeNoop = () => () => {};

export default function ToolLayout({ toolId, children, headingOverride }: ToolLayoutProps) {
  const tool = getToolById(toolId);
  if (!tool) throw new Error(`ToolLayout: unknown toolId "${toolId}"`);

  // Canonical URL on the server and first render; swap in the live URL (with share params) after hydration
  const shareUrl = useSyncExternalStore(
    subscribeNoop,
    () => window.location.href,
    () => `${SITE.url}${tool.route}`,
  );

  const categoryHref = `/tools.html#cat=${CATEGORY_SLUGS[tool.category]}`;
  const categoryTools = TOOLS.filter((t) => t.category === tool.category);

  // Get other tools in the same category
  const relatedTools = TOOLS.filter((t) => t.category === tool.category && t.id !== tool.id).slice(0, 3);
  const faqs = getToolFaqs(tool.id);
  // Escape '<' so content can never close the script tag early
  const jsonLd = JSON.stringify(generateToolJsonLd(tool.id)).replace(/</g, '\\u003c');

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Related-tools bar: same as public/components/footer.js on the static pages */}
      <nav
        aria-label={`${tool.category} tools`}
        className="-mx-4 sm:mx-0 mb-4 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-4 sm:px-0 sm:justify-center text-xs sm:text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span className="font-semibold text-muted-foreground shrink-0">{tool.category}:</span>
        {categoryTools.map((t) =>
          t.id === tool.id ? (
            <span key={t.id} aria-current="page" className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-primary-foreground">
              {t.label}
            </span>
          ) : (
            <a key={t.id} href={t.route} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-foreground hover:border-primary hover:text-primary transition-colors">
              {t.label}
            </a>
          ),
        )}
        <a href={categoryHref} className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-foreground hover:border-primary hover:text-primary transition-colors">
          All {tool.category} →
        </a>
      </nav>

      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/tools" className="hover:text-foreground transition-colors">
          Tools
        </Link>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <a href={categoryHref} className="px-2 py-0.5 rounded-full bg-muted border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          {tool.category}
        </a>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <span className="text-foreground font-semibold truncate">{tool.label}</span>
      </nav>

      {/* Tool Header Card */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0 shadow-2xs">
            <ToolIcon toolId={tool.id} className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {headingOverride ?? tool.label}
              </h1>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl">
              {tool.description}
            </p>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <CopyButton
            text={shareUrl}
            label="Share"
            className="text-xs"
          />
        </div>
      </div>

      {/* Tool workspace content */}
      <div className="w-full">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>

      {/* Frequently asked questions (mirrored in FAQPage JSON-LD) */}
      {faqs.length > 0 && (
        <section className="mt-12 pt-8 border-t border-border" aria-labelledby="tool-faq-heading">
          <h2
            id="tool-faq-heading"
            className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {faqs.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none text-sm font-medium text-foreground hover:text-primary transition-colors [&::-webkit-details-marker]:hidden">
                  <h3 className="text-sm font-medium">{faq.question}</h3>
                  <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Related tools in this category */}
      {relatedTools.length > 0 && (
        <section className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> More {tool.category} Tools
            </h2>
            <a href={categoryHref} className="text-xs text-primary hover:underline">
              View all {tool.category} tools →
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedTools.map((relTool) => (
              <Link
                key={relTool.id}
                href={relTool.route}
                className="group p-3 rounded-lg border border-border bg-card/60 hover:bg-card hover:border-primary/40 transition-all flex items-center gap-3"
              >
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                  <ToolIcon toolId={relTool.id} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    {relTool.label}
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate">{relTool.shortDesc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
