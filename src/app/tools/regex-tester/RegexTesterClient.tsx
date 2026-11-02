'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { testRegex, validateRegexPattern } from '@/lib/regex/engine';
import { Sparkles, CheckCircle2, AlertCircle, Hash, Search } from 'lucide-react';

const ALL_FLAGS: { flag: string; title: string; desc: string }[] = [
  { flag: 'g', title: 'Global', desc: 'Find all matches rather than stopping at the first' },
  { flag: 'i', title: 'Ignore Case', desc: 'Case-insensitive matching' },
  { flag: 'm', title: 'Multiline', desc: '^ and $ match start and end of each line' },
  { flag: 's', title: 'DotAll', desc: '. matches newline characters as well' },
];

const PRESETS = [
  { label: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', test: 'Contact support@bharatdevtool.com or admin@example.org for info.' },
  { label: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', test: 'Servers live at 192.168.1.1 and 10.0.0.254.' },
  { label: 'URL', pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*', test: 'Visit https://bharatdevtool.com or http://localhost:3000.' },
  { label: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', test: 'Colors used: #3b82f6 for primary, #10b981 for success, and #0f172a.' },
];

export default function RegexTesterClient() {
  const [pattern, setPattern] = useState('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');
  const [flags, setFlags] = useState<string[]>(['g']);
  const [testStr, setTestStr] = useState('Contact team@bharatdevtool.com or user.name+tag@gmail.com for help.');

  const flagStr = flags.join('');
  const validation = pattern ? validateRegexPattern(pattern, flagStr) : { valid: true };
  const result = pattern && testStr && validation.valid ? testRegex(pattern, flagStr, testStr) : null;

  function toggleFlag(f: string) {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function loadPreset(p: typeof PRESETS[0]) {
    setPattern(p.pattern);
    setTestStr(p.test);
    if (!flags.includes('g')) setFlags(['g']);
  }

  return (
    <ToolLayout toolId="regex-tester">
      <div className="space-y-5">
        {/* Presets Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pb-2 border-b border-border">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Presets:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => loadPreset(p)}
              className="px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted hover:text-foreground text-xs font-medium transition-colors border border-border/50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Pattern & Flags Box */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Pattern input */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 font-mono">
                Regular Expression
              </label>
              <div className="flex items-center rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs sm:text-sm focus-within:ring-2 focus-within:ring-primary shadow-xs">
                <span className="text-primary font-bold mr-1.5">/</span>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="Type regular expression here... e.g. [a-z0-9]+"
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                  spellCheck={false}
                />
                <span className="text-primary font-bold ml-1.5">/{flagStr}</span>
              </div>
            </div>

            {/* Flags */}
            <div className="shrink-0">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 font-mono">
                Flags
              </label>
              <div className="flex items-center gap-1">
                {ALL_FLAGS.map(({ flag, title, desc }) => {
                  const isActive = flags.includes(flag);
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => toggleFlag(flag)}
                      title={`${title}: ${desc}`}
                      className={`px-3 py-2 rounded-lg font-mono text-xs font-semibold transition-all shadow-2xs ${
                        isActive
                          ? 'bg-primary text-white'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
                      }`}
                    >
                      {flag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {!validation.valid && (
            <ErrorMessage message={`Invalid regular expression: ${validation.error}`} />
          )}
        </div>

        {/* Test String Input */}
        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
            <label className="text-xs font-semibold text-foreground">Test String</label>
            {testStr && (
              <button
                type="button"
                onClick={() => setTestStr('')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            value={testStr}
            onChange={(e) => setTestStr(e.target.value)}
            placeholder="Enter text to match against the regular expression..."
            className="w-full h-36 p-3.5 bg-background text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm leading-relaxed focus:outline-none resize-y border-none"
            spellCheck={false}
          />
        </div>

        {/* Results Panel */}
        {result && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Live Match Highlighting
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    result.matchCount > 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  <Hash className="w-3 h-3" /> {result.matchCount}{' '}
                  {result.matchCount === 1 ? 'match found' : 'matches found'}
                </span>
              </div>
            </div>

            {/* Highlighting View */}
            <div className="p-4 rounded-lg bg-muted/40 border border-border text-foreground font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-all min-h-20 max-h-60 overflow-y-auto">
              {result.matchCount === 0 ? (
                <span className="text-muted-foreground">No matches found in the test string.</span>
              ) : (
                (() => {
                  let last = 0;
                  const parts: React.ReactNode[] = [];
                  result.matches.forEach((m, i) => {
                    if (m.index > last) parts.push(testStr.slice(last, m.index));
                    parts.push(
                      <mark
                        key={i}
                        className="rounded px-1 py-0.5 bg-amber-400/30 text-amber-900 dark:text-amber-200 border-b-2 border-amber-500 font-semibold"
                      >
                        {m.value}
                      </mark>
                    );
                    last = m.end;
                  });
                  if (last < testStr.length) parts.push(testStr.slice(last));
                  return parts;
                })()
              )}
            </div>

            {/* Matches Table */}
            {result.matchCount > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-muted-foreground">Match Breakdown:</span>
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {result.matches.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px] text-muted-foreground">
                          #{i + 1}
                        </span>
                        <code className="font-mono font-semibold text-primary truncate">{m.value}</code>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground font-mono text-[11px]">
                          [{m.index}–{m.end}]
                        </span>
                        <CopyButton text={m.value} size="sm" variant="ghost" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
