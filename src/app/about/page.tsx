import type { Metadata } from 'next';
import Link from 'next/link';
import { generateStaticMetadata } from '@/config/seo';
import { SITE } from '@/config/site';
import { TOOLS } from '@/config/tools';
import { ShieldCheck, Zap, HeartHandshake, MapPin, Sparkles, ArrowRight } from 'lucide-react';

export const metadata: Metadata = generateStaticMetadata({
  title: 'About — Privacy-First Developer Tools',
  description: `Learn about Bharat Dev Tools: ${TOOLS.length} free developer utilities that process your data entirely in your browser. No sign-up, nothing uploaded.`,
  path: '/about',
});

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: '100% Client-Side Privacy',
    desc: 'All computations, formatting, cryptography, and parsing run exclusively in your browser memory. Your proprietary code and credentials never touch a server.',
  },
  {
    icon: Zap,
    title: 'Zero Friction',
    desc: 'Instant access with zero login, zero onboarding wizards, and zero paywalls. Tools load fast and work offline after first visit.',
  },
  {
    icon: HeartHandshake,
    title: 'Free & Open Forever',
    desc: 'Built for developers by developers. No artificial limits on string lengths, JSON sizes, or generation counts.',
  },
  {
    icon: MapPin,
    title: 'Engineered for India & Beyond',
    desc: 'Specialized patterns for Indian systems including Aadhaar, PAN, GSTIN, IFSC, Indian mobile formats, and UTC+5:30 time zones.',
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" /> High-Performance Utilities
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          About {SITE.name}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
          {SITE.tagline}. A modern developer toolbox designed to replace bloated, ad-ridden online converters with pure, private, client-side speed.
        </p>
      </div>

      {/* Principles Grid */}
      <div className="grid gap-4 sm:grid-cols-2 mb-12">
        {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-2 hover:border-primary/40 transition-colors"
          >
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary w-fit border border-primary/20">
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Architecture & Open Standards */}
      <div className="p-6 rounded-xl border border-border bg-card shadow-2xs space-y-4 mb-10">
        <h2 className="text-base font-bold text-foreground">Engineered for Performance</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Built on Next.js 16, React 19, and Tailwind CSS v4. Bharat Dev Tools utilizes Web APIs (Crypto API, Canvas, URL API, TextDecoder) to run all data processing locally in the user&apos;s browser thread without external API proxies.
        </p>
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground pt-2 border-t border-border">
          <span>Release v{SITE.version}</span>
          <span>•</span>
          <span>Next.js App Router SSG</span>
          <span>•</span>
          <span>Zero Server Storage</span>
        </div>
      </div>

      {/* Action CTA */}
      <div className="text-center pt-4">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
        >
          <span>Explore All {TOOLS.length} Tools</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </main>
  );
}
