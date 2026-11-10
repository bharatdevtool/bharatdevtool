'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowLeft, FileLock2, FileArchive, LoaderCircle, Maximize2, X } from 'lucide-react';
import { engine } from './engine-loader';
import { Segmented } from './controls';
import { isEncryptedError } from '@/lib/pdf/shared';

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

type Side = 'after' | 'before';

// ─── Live preview (options panel) ─────────────────────────────────────────────

export interface LivePreviewResult {
  /** One-page PDF showing the result. */
  after: Uint8Array;
  /** The same page before the change, to compare. */
  before?: Uint8Array;
  /** Small line under the preview, e.g. an estimated size. */
  note?: string;
}

/**
 * Renders one page of what the output will look like, refreshed (debounced) when `deps` changes.
 * Click to see it large.
 */
export function LivePreview({ make, deps, caption }: { make: () => Promise<LivePreviewResult | null>; deps: string; caption: string }) {
  const [urls, setUrls] = useState<{ after: string; before?: string; note?: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [side, setSide] = useState<Side>('after');
  const [large, setLarge] = useState(false);
  const makeRef = useRef(make);
  useEffect(() => {
    makeRef.current = make;
  });

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await makeRef.current();
        if (!r) return;
        const after = await firstPageUrl(r.after);
        const before = r.before ? await firstPageUrl(r.before) : undefined;
        if (cancelled) {
          URL.revokeObjectURL(after);
          if (before) URL.revokeObjectURL(before);
          return;
        }
        setFailed(false);
        setUrls((old) => {
          if (old) {
            URL.revokeObjectURL(old.after);
            if (old.before) URL.revokeObjectURL(old.before);
          }
          return { after, before, note: r.note };
        });
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deps]);

  useEffect(
    () => () => {
      setUrls((old) => {
        if (old) {
          URL.revokeObjectURL(old.after);
          if (old.before) URL.revokeObjectURL(old.before);
        }
        return null;
      });
    },
    [],
  );

  const shown = urls ? (side === 'before' && urls.before ? urls.before : urls.after) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">Preview</span>
        {urls?.before && (
          <div className="w-36">
            <Segmented label="Preview before or after" value={side} onChange={setSide} options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => shown && setLarge(true)}
        disabled={!shown}
        className="group relative flex h-72 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/60 p-3"
        aria-label="Show the preview larger"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={`Preview, ${side === 'before' ? 'before' : 'after'} the change`} className="max-h-full max-w-full bg-white shadow-sm" />
        ) : failed ? (
          <span className="px-4 text-xs text-muted-foreground">Preview not available for this page.</span>
        ) : (
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
        {busy && shown && <LoaderCircle className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
        {shown && (
          <span className="absolute bottom-2 right-2 rounded-md bg-card/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      <p className="text-xs text-muted-foreground">
        {caption}
        {urls?.note && <span className="block font-medium text-foreground">{urls.note}</span>}
      </p>
      {large && urls && (
        <Lightbox onClose={() => setLarge(false)}>
          {urls.before && (
            <div className="mx-auto mb-3 w-44">
              <Segmented label="Preview before or after" value={side} onChange={setSide} options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown!} alt="Large preview" className="mx-auto max-w-full bg-white shadow-lg" />
        </Lightbox>
      )}
    </div>
  );
}

async function firstPageUrl(bytes: Uint8Array): Promise<string> {
  const E = await engine();
  const doc = await E.openPdf(bytes);
  try {
    return await E.renderThumbnail(doc, 0, 1100);
  } finally {
    doc.loadingTask.destroy();
  }
}

function Lightbox({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Preview" onClick={onClose}>
      <div className="flex justify-end p-3">
        <button type="button" onClick={onClose} className="rounded-lg bg-card p-2 text-foreground shadow" aria-label="Close preview">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="developer-scrollbar min-h-0 flex-1 overflow-auto px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </div>
  );
}

// ─── Result viewer (centre column after a run) ────────────────────────────────

export interface PreviewFile {
  name: string;
  bytes: Uint8Array;
  type: string;
}

export interface BeforeSource {
  count: number;
  render: (index: number, scale: number) => Promise<HTMLCanvasElement>;
}

/**
 * Every page of the output, rendered lazily as you scroll. With `before`, a toggle shows the
 * original pages in the same place, so you can check the change before downloading.
 */
export function ResultView({
  files, password, before, onBack, backLabel = 'Change options',
}: { files: PreviewFile[]; password?: string; before?: BeforeSource; onBack?: () => void; backLabel?: string }) {
  const [side, setSide] = useState<Side>('after');
  const single = files.length === 1 && files[0].type === 'application/pdf';
  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background py-2">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </button>
          )}
          <h2 className="truncate text-sm font-semibold text-foreground">Preview of the result</h2>
        </div>
        {single && before && (
          <div className="w-44">
            <Segmented label="Show the original or the result" value={side} onChange={setSide} options={[{ value: 'before', label: 'Original' }, { value: 'after', label: 'Result' }]} />
          </div>
        )}
      </div>
      {files.map((f) => (
        <section key={f.name} className="space-y-3">
          {files.length > 1 && (
            <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground">{f.name}</span>
              <span className="shrink-0 tabular-nums">{formatBytes(f.bytes.length)}</span>
            </p>
          )}
          {f.type === 'application/pdf' ? (
            <PdfPages bytes={f.bytes} password={password} before={single && side === 'before' ? before : undefined} />
          ) : f.type.startsWith('image/') ? (
            <ImageFile file={f} />
          ) : (
            <OpaqueFile file={f} />
          )}
        </section>
      ))}
    </div>
  );
}

function PdfPages({ bytes, password, before }: { bytes: Uint8Array; password?: string; before?: BeforeSource }) {
  const [doc, setDoc] = useState<{ pdf: PDFDocumentProxy; sizes: { w: number; h: number }[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    (async () => {
      const E = await engine();
      try {
        try {
          opened = await E.openPdf(bytes);
        } catch (err) {
          if (!password || !isEncryptedError(err)) throw err;
          opened = await E.openPdf(bytes, password);
        }
        const sizes = await E.pageSizes(opened);
        if (cancelled) opened.loadingTask.destroy();
        else setDoc({ pdf: opened, sizes });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      opened?.loadingTask.destroy();
    };
  }, [bytes, password]);

  if (failed) return <p className="rounded-lg bg-muted/60 p-6 text-center text-sm text-muted-foreground">This file can&apos;t be previewed here, but it downloads normally.</p>;
  if (!doc) {
    return (
      <div className="flex h-60 items-center justify-center gap-2 rounded-lg bg-muted/40 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Opening the result…
      </div>
    );
  }
  const useBefore = before && before.count === doc.sizes.length ? before : undefined;
  return (
    <div className="space-y-4 rounded-xl bg-muted/40 p-3 sm:p-5">
      {doc.sizes.map((s, i) => (
        <LazyPage
          key={`${i}-${useBefore ? 'b' : 'a'}`}
          aspect={s.w / s.h}
          label={`Page ${i + 1} of ${doc.sizes.length}`}
          render={async (cssWidth) => {
            const E = await engine();
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            if (useBefore) {
              // Same on-screen width as the result page, whatever the original page size was.
              const probe = await doc.pdf.getPage(i + 1);
              const scale = (cssWidth * dpr) / probe.getViewport({ scale: 1 }).width;
              return useBefore.render(i, scale);
            }
            return E.renderPage(doc.pdf, i, (cssWidth * dpr) / s.w);
          }}
        />
      ))}
    </div>
  );
}

function LazyPage({ aspect, label, render }: { aspect: number; label: string; render: (cssWidth: number) => Promise<HTMLCanvasElement> }) {
  const host = useRef<HTMLDivElement>(null);
  const renderRef = useRef(render);
  useEffect(() => {
    renderRef.current = render;
  });
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const [aspectNow, setAspectNow] = useState(aspect);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let token = 0;
    // Render near the screen, release far away (long results stay light on memory).
    const io = new IntersectionObserver(
      async ([e]) => {
        const mine = ++token;
        const old = el.querySelector('canvas');
        if (!e.isIntersecting) {
          if (old) {
            old.width = old.height = 0;
            old.remove();
            setState('idle');
          }
          return;
        }
        if (old) return;
        try {
          const canvas = await renderRef.current(el.clientWidth);
          if (mine !== token) {
            canvas.width = canvas.height = 0;
            return;
          }
          canvas.className = 'block h-auto w-full';
          canvas.setAttribute('aria-hidden', 'true');
          setAspectNow(canvas.width / canvas.height);
          el.replaceChildren(canvas);
          setState('done');
        } catch {
          setState('failed');
        }
      },
      { rootMargin: '1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure className="mx-auto w-full max-w-[600px]">
      <div
        ref={host}
        role="img"
        aria-label={label}
        className={`w-full bg-white shadow-sm ring-1 ring-black/5 ${state === 'done' ? '' : 'animate-pulse'}`}
        style={{ aspectRatio: String(state === 'done' ? aspectNow : aspect) }}
      />
      <figcaption className="mt-1.5 text-center text-[11px] tabular-nums text-muted-foreground">
        {state === 'failed' ? `${label} could not be shown` : label}
      </figcaption>
    </figure>
  );
}

function ImageFile({ file }: { file: PreviewFile }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.type })), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="rounded-xl bg-muted/40 p-3 sm:p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={file.name} className="mx-auto max-h-[80vh] max-w-full bg-white shadow-sm" />}
    </div>
  );
}

function OpaqueFile({ file }: { file: PreviewFile }) {
  const secure = /\.bdtpdf$/i.test(file.name);
  const Icon = secure ? FileLock2 : FileArchive;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-5">
      <Icon className="h-8 w-8 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {secure ? 'Encrypted file. It can only be opened in the Bharat Dev Tools viewer, so there is no preview here.' : formatBytes(file.bytes.length)}
        </p>
      </div>
    </div>
  );
}
