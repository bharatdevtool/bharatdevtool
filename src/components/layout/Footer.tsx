import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart, Sparkles, Terminal, ArrowUpRight } from 'lucide-react';
import { TOOLS } from '@/config/tools';
import { SITE } from '@/config/site';

export default function Footer() {
  const year = new Date().getFullYear();

  // Group tools into logical dev domains
  const categories = [
    {
      title: 'Lottie Tools',
      toolIds: ['lottie-player', 'lottie-validator', 'lottie-optimizer'],
    },
    {
      title: 'JSON & APIs',
      toolIds: ['json-formatter', 'json-diff', 'curl-tester', 'curl-comparison', 'deeplink'],
    },
    {
      title: 'Encoding & Security',
      toolIds: ['base64', 'url-encoder', 'uuid-generator', 'password-generator'],
    },
    {
      title: 'Regex & Text',
      toolIds: ['regex-tester', 'regex-generator', 'regex-library', 'word-counter', 'text-case-converter'],
    },
    {
      title: 'Design & Utilities',
      toolIds: ['qr-generator', 'qr-decoder', 'color-picker', 'gradient-generator', 'whatsapp-link', 'age-calculator'],
    },
  ];

  return (
    <footer className="border-t border-border bg-card/40 mt-auto">
      {/* Main Footer Links */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link href="/tools" className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="p-1 rounded bg-primary/10 text-primary font-mono text-xs">BDT</span>
              {SITE.name}
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {TOOLS.length} free, privacy-first, client-side utilities engineered for modern developers.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] text-emerald-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>100% Client-Side Processing</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">⌘K</kbd> to search
            </div>
          </div>

          {/* Tool category columns */}
          {categories.map((cat) => (
            <div key={cat.title} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                {cat.title}
              </h3>
              <ul className="space-y-1.5 text-xs">
                {cat.toolIds.map((id) => {
                  const tool = TOOLS.find((t) => t.id === id);
                  if (!tool) return null;
                  return (
                    <li key={tool.id}>
                      <Link
                        href={tool.route}
                        className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                      >
                        <span className="truncate">{tool.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span>© {year} {SITE.name}. Free & open for every developer.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/feedback" className="hover:text-foreground transition-colors">
              Feedback
            </Link>
            <a
              href={SITE.feedbackFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
              Suggest Tool <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
