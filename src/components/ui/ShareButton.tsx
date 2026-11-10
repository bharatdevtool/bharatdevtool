'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';

declare global {
  interface Window {
    BDTShare?: { openSheet: (opts?: { url?: string; text?: string; source?: string }) => void };
  }
}

let loading: Promise<void> | null = null;
/** The same share sheet the static HTML tools use (public/assets/js/share.js), loaded on first click. */
export function loadShareSheet(): Promise<void> {
  if (window.BDTShare) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/assets/js/share.js';
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error('share sheet failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Share this tool: native share on phones, otherwise WhatsApp / Telegram / X / LinkedIn / copy. Never shares user data. */
export default function ShareButton({ url, className = '' }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await loadShareSheet();
      window.BDTShare?.openSheet({ url, source: 'tool_header' });
    } catch {
      await navigator.clipboard?.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium text-foreground transition-colors hover:border-primary hover:text-primary ${className}`}
      aria-label="Share this tool"
    >
      <Share2 className="h-3.5 w-3.5" />
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
