'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Lock, LoaderCircle, Printer, ShieldAlert, X } from 'lucide-react';
import type { ShareHeader } from '@/lib/pdf/secure';
import { formatExpiry } from '@/lib/pdf/options';

type Engine = typeof import('@/lib/pdf/engine');

const fmt = formatExpiry;

type State =
  | { step: 'checking' }
  | { step: 'password'; header: ShareHeader; wrong: boolean }
  | { step: 'expired'; header: ShareHeader }
  | { step: 'error'; message: string }
  | { step: 'open'; header: ShareHeader; pages: number };

/**
 * Opens a Secure Share file (the cover PDF, or a raw .bdtpdf). Expiry is checked against our server's clock.
 * Pages are drawn on canvases with the sender's watermark; no download, and print only if the sender allowed it.
 * This is soft protection and the page says so.
 */
export default function SecureViewer({ file, engine, onClose }: { file: Uint8Array; engine: () => Promise<Engine>; onClose: () => void }) {
  const [state, setState] = useState<State>({ step: 'checking' });
  const [password, setPassword] = useState('');
  const pagesRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  // Only the latest open() may draw pages (it can run twice, e.g. React dev mode or a password retry).
  const run = useRef(0);

  const open = useCallback(
    async (pw?: string) => {
      const token = ++run.current;
      const E = await engine();
      let header: ShareHeader;
      let share: Uint8Array;
      try {
        share = await E.extractShare(file);
        header = E.readShareHeader(share).header;
      } catch (err) {
        setState({ step: 'error', message: err instanceof Error ? err.message : 'This file could not be opened.' });
        return;
      }
      let now: number;
      try {
        now = await E.trustedNow();
      } catch {
        setState({ step: 'error', message: 'Connect to the internet to open this file: its expiry time is checked against our server clock.' });
        return;
      }
      if (now > header.expiresAt) {
        setState({ step: 'expired', header });
        return;
      }
      try {
        const { pdf } = await E.openShare(share, now, pw);
        const doc = await E.openPdf(pdf);
        setState({ step: 'open', header, pages: doc.numPages });
        // Render after the container is in the DOM.
        requestAnimationFrame(async () => {
          const host = pagesRef.current;
          if (!host || token !== run.current) {
            doc.loadingTask.destroy();
            return;
          }
          host.replaceChildren();
          const width = Math.min(900, host.clientWidth - 16);
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          for (let i = 0; i < doc.numPages; i++) {
            const page = await doc.getPage(i + 1);
            const base = page.getViewport({ scale: 1 });
            const canvas = await E.renderPage(doc, i, (width * dpr) / base.width);
            if (token !== run.current) break;
            E.stampShareWatermark(canvas, E.shareWatermarkText(header, fmt(header.expiresAt)));
            canvas.style.width = `${width}px`;
            canvas.className = 'mx-auto block shadow-md select-none';
            canvas.oncontextmenu = (e) => e.preventDefault();
            canvas.setAttribute('aria-label', `Page ${i + 1}`);
            host.appendChild(canvas);
          }
          doc.loadingTask.destroy();
        });
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'needs-password' || code === 'wrong-password') setState({ step: 'password', header, wrong: code === 'wrong-password' });
        else setState({ step: 'error', message: err instanceof Error ? err.message : 'This file could not be opened.' });
      }
    },
    [engine, file],
  );

  useEffect(() => {
    // Async check on mount; state is set once the file has been read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    open();
  }, [open]);

  const canPrint = state.step === 'open' && !!state.header.allowPrint;

  /** Print the watermarked page images (never the original PDF) from a hidden frame. */
  const print = useCallback(async () => {
    const canvases = Array.from(pagesRef.current?.querySelectorAll('canvas') ?? []);
    if (!canvases.length) return;
    setPrinting(true);
    const urls: string[] = [];
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    try {
      for (const c of canvases) {
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
        if (blob) urls.push(URL.createObjectURL(blob));
      }
      document.body.appendChild(frame);
      const d = frame.contentDocument!;
      d.open();
      d.write('<!doctype html><title>Print</title><style>@page{margin:0}body{margin:0}img{display:block;width:100%;height:auto;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style>');
      for (const u of urls) d.write(`<img src="${u}">`);
      d.close();
      await Promise.all(Array.from(d.images, (img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))));
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
    } finally {
      // print() blocks until the dialog closes in most browsers; clean up a little later for the rest.
      setTimeout(() => {
        frame.remove();
        urls.forEach((u) => URL.revokeObjectURL(u));
      }, 1000);
      setPrinting(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Ctrl/⌘+S is blocked; Ctrl/⌘+P prints the watermarked pages when allowed, else it is blocked too.
      if ((e.metaKey || e.ctrlKey) && ['p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'p' && canPrint) print();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, canPrint, print]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background print:hidden" role="dialog" aria-modal="true" aria-label="Secure shared document">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{'header' in state ? state.header.name : 'Secure shared PDF'}</p>
          {'header' in state && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Viewable until {fmt(state.header.expiresAt)}
              {state.header.recipient ? ` · shared with ${state.header.recipient}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canPrint && (
            <button
              type="button"
              onClick={print}
              disabled={printing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              {printing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print
            </button>
          )}
          <a href="/share-pdf-with-expiry" className="hidden text-xs font-medium text-primary hover:underline sm:inline">Shared with Bharat Dev Tools: share your own →</a>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {state.step === 'checking' && (
          <p className="mt-20 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking the file…</p>
        )}
        {state.step === 'error' && <Notice icon={<ShieldAlert className="h-6 w-6" />} title="Can't open this file" text={state.message} />}
        {state.step === 'expired' && (
          <Notice icon={<Clock className="h-6 w-6" />} title="This shared file has expired" text={`It could be viewed until ${fmt(state.header.expiresAt)}. Ask the sender for a new copy.`} />
        )}
        {state.step === 'password' && (
          <form onSubmit={(e) => { e.preventDefault(); if (password) open(password); }} className="mx-auto mt-16 max-w-sm space-y-3 rounded-2xl border border-border bg-card p-5 text-center">
            <Lock className="mx-auto h-6 w-6 text-primary" />
            <p className="text-sm font-semibold">Enter the password to view</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="off"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" aria-label="Password" />
            {state.wrong && <p className="text-xs text-red-600 dark:text-red-400">That password is not right.</p>}
            <button type="submit" className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open</button>
          </form>
        )}
        {state.step === 'open' && (
          <>
            <div ref={pagesRef} className="mx-auto flex max-w-[920px] flex-col gap-4" />
            <p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted-foreground">
              {state.header.allowPrint ? 'View and print only.' : 'View only.'} This file stops opening after its expiry time. Like any document shown on a screen, it can still be photographed or captured, so share only with people you trust.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Notice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md space-y-2 rounded-2xl border border-border bg-card p-6 text-center">
      <div className="flex justify-center text-amber-500">{icon}</div>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      <a href="/share-pdf-with-expiry" className="inline-block pt-2 text-xs font-medium text-primary hover:underline">Make your own expiring PDF with Bharat Dev Tools →</a>
    </div>
  );
}
