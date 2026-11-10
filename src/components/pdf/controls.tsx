'use client';

import React from 'react';

/** Text inputs in the options panel. */
export const inputCls =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50';

/** A labelled option: label on top, control below (fits the narrow side panel). */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-foreground">{label}</div>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Segmented control: one choice from a few short options. */
export function Segmented<T extends string | number>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-w-0 flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** One choice from options that need a line of explanation each. */
export function OptionCards<T extends string | number>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; title: string; detail: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="space-y-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
              active ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'
            }`}
          >
            <span
              className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-primary' : 'border-muted-foreground/50'}`}
              aria-hidden="true"
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{o.title}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{o.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox with a label and optional explanation. */
export function Check({
  checked, onChange, children, detail,
}: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
      <span className="min-w-0">
        {children}
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>}
      </span>
    </label>
  );
}
