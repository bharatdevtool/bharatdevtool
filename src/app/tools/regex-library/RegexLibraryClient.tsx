'use client';

import React, { useState, useMemo } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import { REGEX_PATTERNS, searchPatterns, RegexPattern } from '@/lib/regex/patterns';
import { Search, BookOpen, Sparkles, Check } from 'lucide-react';

const CATEGORIES = ['All', ...Array.from(new Set(REGEX_PATTERNS.map((p) => p.category)))];

export default function RegexLibraryClient() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    let base = query ? searchPatterns(query) : REGEX_PATTERNS;
    if (category !== 'All') base = base.filter((p) => p.category === category);
    return base;
  }, [query, category]);

  return (
    <ToolLayout toolId="regex-library">
      <div className="space-y-6">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search regex patterns by name, description, or keyword (e.g. email, phone, Aadhaar, URL)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {CATEGORIES.map((cat) => {
            const count = cat === 'All' ? REGEX_PATTERNS.length : REGEX_PATTERNS.filter((p) => p.category === cat).length;
            const isActive = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-border/50'
                }`}
              >
                {cat} <span className="opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Pattern Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <PatternCard key={p.id} pattern={p} />
          ))}
        </div>
      </div>
    </ToolLayout>
  );
}

function PatternCard({ pattern: p }: { pattern: RegexPattern }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3 flex flex-col justify-between hover:border-primary/40 transition-colors">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
            <h3 className="font-semibold text-sm text-foreground">{p.name}</h3>
            <span className="text-[11px] font-medium text-muted-foreground">{p.category}</span>
          </div>
          <CopyButton text={p.pattern} label="Copy" size="sm" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{p.description}</p>
      </div>

      <div className="p-2.5 rounded-lg bg-muted/40 border border-border overflow-x-auto overflow-y-scroll max-h-24">
        <code className="font-mono text-xs text-primary font-semibold break-all">{p.pattern}</code>
      </div>

      {p.example && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/40">
          <span className="font-semibold text-foreground">Example:</span>
          <code className="font-mono text-foreground/80">{p.example}</code>
        </div>
      )}
    </div>
  );
}
