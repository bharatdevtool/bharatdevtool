'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Sparkles, ArrowRight } from 'lucide-react';
import { TOOLS, ToolCategory } from '@/config/tools';
import ToolIcon from '@/components/ui/ToolIcon';

const FILTER_CATEGORIES: ('All' | ToolCategory)[] = [
  'All',
  'JSON',
  'Lottie',
  'Encoding',
  'Security',
  'Regex',
  'API/Network',
  'QR',
  'Color',
  'Social',
];

export default function ToolsDirectoryClient() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | ToolCategory>('All');

  const filteredTools = useMemo(() => {
    return TOOLS.filter((tool) => {
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory;
      const matchesSearch =
        !search.trim() ||
        tool.label.toLowerCase().includes(search.toLowerCase()) ||
        tool.shortDesc.toLowerCase().includes(search.toLowerCase()) ||
        tool.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" /> {TOOLS.length} Professional Developer Utilities
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Developer Tools, Refined.
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Zero latency. Zero sign-up. 100% client-side privacy. Your code never leaves your browser.
        </p>

        {/* Live Filter Search Input */}
        <div className="mt-6 relative max-w-lg mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools by name, keyword, or action..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card shadow-xs text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center justify-center flex-wrap gap-1.5 mb-8">
        {FILTER_CATEGORIES.map((cat) => {
          const count = cat === 'All' ? TOOLS.length : TOOLS.filter((t) => t.category === cat).length;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-2xs font-semibold'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
              }`}
            >
              {cat} <span className="opacity-70 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tools Grid */}
      {filteredTools.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No tools found matching &ldquo;{search}&rdquo;. Try another search keyword.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.route}
              className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                    <ToolIcon toolId={tool.id} className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted border border-border/70 text-muted-foreground">
                    {tool.category}
                  </span>
                </div>

                <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {tool.label}
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {tool.shortDesc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
                <span className="group-hover:underline">Open Tool</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

