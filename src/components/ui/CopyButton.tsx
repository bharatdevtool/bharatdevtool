'use client';

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
}

export default function CopyButton({
  text,
  label = 'Copy',
  className = '',
  variant = 'default',
  size = 'md',
}: CopyButtonProps) {
  const { copy, copied } = useClipboard();

  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs gap-1.5' : 'px-3 py-1.5 text-xs gap-1.5';

  const variantClasses = {
    default: copied
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
      : 'bg-muted/80 text-foreground hover:bg-muted border border-border/60 hover:border-border',
    outline: copied
      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
    ghost: copied
      ? 'text-emerald-500 bg-emerald-500/10'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
  }[variant];

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      disabled={!text}
      className={`inline-flex items-center justify-center font-medium rounded-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 select-none ${sizeClasses} ${variantClasses} ${className}`}
      aria-label={copied ? 'Copied to clipboard' : `Copy ${label}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 opacity-70 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
