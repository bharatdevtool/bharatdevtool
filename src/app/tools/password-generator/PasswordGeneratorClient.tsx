'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import { generatePassword, estimateStrength, PasswordOptions } from '@/lib/security/password';
import { KeyRound, RefreshCw, Shield, ShieldCheck, Check, Sparkles } from 'lucide-react';

const DEFAULT_OPTS: PasswordOptions = {
  length: 18,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

export default function PasswordGeneratorClient() {
  const [opts, setOpts] = useState<PasswordOptions>(DEFAULT_OPTS);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [bulk, setBulk] = useState(1);

  const generate = useCallback(() => {
    setPasswords(Array.from({ length: bulk }, () => generatePassword(opts)));
  }, [opts, bulk]);

  useEffect(() => {
    generate();
  }, [generate]);

  const firstPwd = passwords[0] ?? '';
  const strength = firstPwd ? estimateStrength(firstPwd) : null;

  function set<K extends keyof PasswordOptions>(k: K, v: PasswordOptions[K]) {
    setOpts((prev) => ({ ...prev, [k]: v }));
  }

  const strengthBadge = strength
    ? {
        weak: 'text-red-500 bg-red-500/10 border-red-500/20',
        fair: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        good: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        strong: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      }[strength.score <= 2 ? 'weak' : strength.score <= 4 ? 'fair' : strength.score <= 6 ? 'good' : 'strong']
    : '';

  return (
    <ToolLayout toolId="password-generator">
      <div className="space-y-6">
        {/* Main Generator Display Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Primary Generated Password
            </span>
            {strength && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${strengthBadge}`}>
                <ShieldCheck className="w-3.5 h-3.5" /> {strength.label}
              </span>
            )}
          </div>

          {/* Primary password display */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-background shadow-xs">
            <code className="font-mono text-base sm:text-xl font-bold tracking-wide text-foreground break-all select-all">
              {firstPwd}
            </code>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={generate}
                className="p-2.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground transition-all active:scale-95"
                title="Generate new password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <CopyButton text={firstPwd} label="Copy Password" />
            </div>
          </div>

          {/* Password Strength Progress Bar */}
          {strength && (
            <div className="space-y-1.5 pt-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    strength.score <= 2
                      ? 'bg-red-500 w-1/4'
                      : strength.score <= 4
                      ? 'bg-amber-500 w-2/4'
                      : strength.score <= 6
                      ? 'bg-blue-500 w-3/4'
                      : 'bg-emerald-500 w-full'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Entropy: {firstPwd.length * 4} bits estimated</span>
                <span>{firstPwd.length} characters</span>
              </div>
            </div>
          )}
        </div>

        {/* Options & Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Length & Characters */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Configuration
            </span>

            {/* Length slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <label className="text-foreground">Password Length</label>
                <span className="font-mono text-primary font-bold">{opts.length} characters</span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={opts.length}
                onChange={(e) => set('length', +e.target.value)}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>8 (Minimum)</span>
                <span>32 (Strong)</span>
                <span>64 (Maximum)</span>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              {(
                [
                  ['uppercase', 'Uppercase characters (A–Z)'],
                  ['lowercase', 'Lowercase characters (a–z)'],
                  ['numbers', 'Numeric digits (0–9)'],
                  ['symbols', 'Special symbols (!@#$%^&*...)'],
                  ['excludeAmbiguous', 'Exclude ambiguous characters (0, O, l, I)'],
                ] as [keyof PasswordOptions, string][]
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!opts[key]}
                    onChange={(e) => set(key, e.target.checked as PasswordOptions[typeof key])}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bulk Generation Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Bulk Password List
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Count:</label>
                  <select
                    value={bulk}
                    onChange={(e) => setBulk(+e.target.value)}
                    className="px-2 py-1 rounded-md border border-border bg-background text-xs text-foreground"
                  >
                    <option value={1}>1 (Single)</option>
                    <option value={5}>5 Passwords</option>
                    <option value={10}>10 Passwords</option>
                    <option value={20}>20 Passwords</option>
                  </select>
                </div>
              </div>

              <div className="divide-y divide-border/60 max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/20">
                {passwords.map((pwd, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <code className="font-mono text-foreground truncate max-w-xs">{pwd}</code>
                    <CopyButton text={pwd} size="sm" variant="ghost" />
                  </div>
                ))}
              </div>
            </div>

            {passwords.length > 1 && (
              <div className="pt-2">
                <CopyButton text={passwords.join('\n')} label="Copy All Generated Passwords" className="w-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
