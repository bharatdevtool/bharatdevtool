'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, ShieldCheck, Share2, Sparkles } from 'lucide-react';
import { getToolById, TOOLS } from '@/config/tools';
import ToolIcon from '@/components/ui/ToolIcon';
import CopyButton from '@/components/ui/CopyButton';

interface ToolLayoutProps {
  toolId: string;
  children: React.ReactNode;
  headingOverride?: string;
}

export default function ToolLayout({ toolId, children, headingOverride }: ToolLayoutProps) {
  const tool = getToolById(toolId);
  if (!tool) throw new Error(`ToolLayout: unknown toolId "${toolId}"`);

  // Get other tools in the same category
  const relatedTools = TOOLS.filter((t) => t.category === tool.category && t.id !== tool.id).slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/tools" className="hover:text-foreground transition-colors">
          Tools
        </Link>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-[11px] font-medium text-muted-foreground">
          {tool.category}
        </span>
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" /> Client-Side Only
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl">
              {tool.description}
            </p>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <CopyButton
            text={typeof window !== 'undefined' ? window.location.href : `https://bharatdevtools.com${tool.route}`}
            label="Share"
            className="text-xs"
          />
        </div>
      </div>

      {/* Tool workspace content */}
      <div className="w-full">{children}</div>

      {/* Related tools in this category */}
      {relatedTools.length > 0 && (
        <section className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> More {tool.category} Tools
            </h2>
            <Link href="/tools" className="text-xs text-primary hover:underline">
              View all 20 tools →
            </Link>
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
