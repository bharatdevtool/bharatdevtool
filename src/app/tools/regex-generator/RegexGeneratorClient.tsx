'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import { Zap, Sparkles, CheckCircle2, AlertCircle, Code2, Play } from 'lucide-react';

type PatternType =
  | 'email'
  | 'url'
  | 'phone-in'
  | 'phone-us'
  | 'ipv4'
  | 'date-iso'
  | 'uuid'
  | 'hex-color'
  | 'slug'
  | 'custom';

interface GeneratedPattern {
  pattern: string;
  flags: string;
  explanation: string;
}

const PATTERNS: Record<PatternType, GeneratedPattern> = {
  email: {
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    flags: 'i',
    explanation: 'Validates standard email addresses according to RFC 5322 (user@domain.tld).',
  },
  url: {
    pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z]{2,6}\\b([-a-zA-Z0-9@:%_+.~#?&/=]*)',
    flags: 'gi',
    explanation: 'Matches http and https URLs with optional subdomain, port, path, and query parameters.',
  },
  'phone-in': {
    pattern: '^(?:\\+91|0)?[6-9]\\d{9}$',
    flags: '',
    explanation: 'Validates Indian mobile numbers (10 digits starting with 6, 7, 8, or 9, with optional +91 or 0 prefix).',
  },
  'phone-us': {
    pattern: '^(\\+1)?[2-9]\\d{2}[2-9]\\d{6}$',
    flags: '',
    explanation: 'Validates US phone numbers (10 digits, optional +1 country code).',
  },
  ipv4: {
    pattern: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',
    flags: '',
    explanation: 'Validates IPv4 addresses in dotted-decimal notation (0.0.0.0 – 255.255.255.255).',
  },
  'date-iso': {
    pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
    flags: '',
    explanation: 'Validates ISO 8601 calendar dates in YYYY-MM-DD format with month and day bounds.',
  },
  uuid: {
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    flags: 'i',
    explanation: 'Validates RFC 4122 / RFC 9562 UUIDs (v1 through v7).',
  },
  'hex-color': {
    pattern: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$',
    flags: '',
    explanation: 'Matches CSS hex colors (3 or 6 hexadecimal characters, optional # prefix).',
  },
  slug: {
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    flags: '',
    explanation: 'Validates clean URL slugs (lowercase alphanumeric with single hyphen dividers).',
  },
  custom: {
    pattern: '',
    flags: 'g',
    explanation: 'Custom regular expression pattern.',
  },
};

const OPTIONS: { value: PatternType; label: string }[] = [
  { value: 'email', label: 'Email Address' },
  { value: 'url', label: 'URL (http/https)' },
  { value: 'phone-in', label: 'Indian Mobile (+91)' },
  { value: 'phone-us', label: 'US Phone (+1)' },
  { value: 'ipv4', label: 'IPv4 Address' },
  { value: 'date-iso', label: 'ISO Date (YYYY-MM-DD)' },
  { value: 'uuid', label: 'UUID (v1–v7)' },
  { value: 'hex-color', label: 'Hex Color (#HEX)' },
  { value: 'slug', label: 'URL Slug' },
  { value: 'custom', label: 'Custom' },
];

export default function RegexGeneratorClient() {
  const [type, setType] = useState<PatternType>('email');
  const [customPattern, setCustomPattern] = useState('');
  const [sample, setSample] = useState('user@example.com');

  const gen = PATTERNS[type];
  const pattern = type === 'custom' ? customPattern : gen.pattern;
  const flags = gen.flags;

  let matchResult: boolean | null = null;
  if (pattern && sample) {
    try {
      matchResult = new RegExp(pattern, flags).test(sample);
    } catch {
      matchResult = null;
    }
  }

  return (
    <ToolLayout toolId="regex-generator">
      <div className="space-y-6">
        {/* Pattern Selector Grid */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Common Pattern Targets
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {OPTIONS.map((o) => {
              const isActive = type === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setType(o.value)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left border ${
                    isActive
                      ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-border/50'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {type === 'custom' && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-2">
            <label className="block text-xs font-semibold text-foreground">Custom Pattern</label>
            <input
              type="text"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="e.g. \b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Generated Pattern Output Card */}
        {pattern && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Generated Regular Expression
              </span>
              <CopyButton text={pattern} label="Copy Pattern" />
            </div>

            <div className="p-3.5 rounded-lg bg-muted/40 border border-border overflow-x-auto overflow-y-scroll">
              <code className="font-mono text-xs sm:text-sm font-semibold text-primary break-all">
                {`/${pattern}/${flags}`}
              </code>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{gen.explanation}</p>
          </div>
        )}

        {/* Live Test Sample Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Live Pattern Validator
          </span>

          <input
            type="text"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            placeholder="Type or paste sample text here to test against the pattern..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {sample && matchResult !== null && (
            <div className="pt-1">
              {matchResult ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Matches pattern successfully</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Does not match pattern</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
