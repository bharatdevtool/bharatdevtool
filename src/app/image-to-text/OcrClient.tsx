'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, ImagePlus, ScanText, ShieldCheck, Trash2 } from 'lucide-react';
import type { Worker as OcrWorker } from 'tesseract.js';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { loadImageCanvas } from '@/lib/image/perspective';
import { isEncryptedError } from '@/lib/pdf/shared';
import { useCrossToolData } from '@/hooks/useCrossToolData';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';

interface Item {
  id: number;
  canvas: HTMLCanvasElement;
  text?: string;
  pdf?: Uint8Array;
}
type Source = 'image' | 'pdf' | 'paste' | 'scanner';

let nextId = 1;
const MAX_PDF_PAGES = 20;
/** Self-hosted engine (public/ocr): nothing is fetched from a CDN. */
const OCR_PATHS = { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', gzip: true };

function dataUrlToCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

function save(bytes: Uint8Array | string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function OcrClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [source, setSource] = useState<Source>('image');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<OcrWorker | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => void workerRef.current?.terminate(), []);

  const add = (canvases: HTMLCanvasElement[], from: Source) => {
    setSource(from);
    setItems((its) => [...its, ...canvases.map((canvas) => ({ id: nextId++, canvas }))]);
  };

  const addFiles = async (files: File[], from: Source) => {
    setError(null);
    for (const file of files) {
      try {
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          setBusy('Opening PDF…');
          const { openPdf, renderPage } = await import('@/lib/pdf/browser');
          const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
          try {
            const pages = [];
            for (let i = 0; i < Math.min(doc.numPages, MAX_PDF_PAGES); i++) pages.push(await renderPage(doc, i, 3));
            add(pages, 'pdf');
            if (doc.numPages > MAX_PDF_PAGES) setError(`Only the first ${MAX_PDF_PAGES} pages are read. Split the PDF to read the rest.`);
          } finally {
            void doc.loadingTask.destroy();
          }
        } else if (file.type.startsWith('image/')) {
          add([await loadImageCanvas(file, 3000)], from);
        }
      } catch (err) {
        setError(isEncryptedError(err) ? 'This PDF has a password. Remove it first with Unlock PDF, then add it here.' : 'This file could not be opened. Use a JPG, PNG, WebP or PDF.');
      } finally {
        setBusy('');
      }
    }
  };

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) void addFiles(files, 'paste');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // Pages sent from the Document Scanner.
  useCrossToolData<{ images: string[] }>('image-to-text', async ({ images }) => {
    try {
      add(await Promise.all(images.map(dataUrlToCanvas)), 'scanner');
    } catch {
      setError('The scanned pages could not be opened here. Add them again.');
    }
  });

  const read = async () => {
    setError(null);
    try {
      if (!workerRef.current) {
        setBusy('Loading the text reader (first time only)…');
        const { createWorker } = await import('tesseract.js');
        workerRef.current = await createWorker('eng', 1, OCR_PATHS);
      }
      const worker = workerRef.current;
      const done: Item[] = [];
      for (let i = 0; i < items.length; i++) {
        setBusy(`Reading page ${i + 1} of ${items.length}…`);
        const { data } = await worker.recognize(items[i].canvas, { pdfTitle: 'Scanned text' }, { text: true, pdf: true });
        done.push({ ...items[i], text: data.text.trim(), pdf: data.pdf ? new Uint8Array(data.pdf) : undefined });
      }
      setItems(done);
      analytics.track(ANALYTICS_EVENTS.OCR_TEXT, { pages: done.length, source });
    } catch {
      setError('The text could not be read. Try a clearer photo, or reload the page and try again.');
    } finally {
      setBusy('');
    }
  };

  const allRead = items.length > 0 && items.every((it) => it.text !== undefined);
  const text = allRead ? items.map((it, i) => (items.length > 1 ? `--- Page ${i + 1} ---\n${it.text}` : it.text)).join('\n\n') : '';

  const downloadPdf = async () => {
    setBusy('Making searchable PDF…');
    try {
      const { PDFDocument } = await import('@cantoo/pdf-lib');
      const out = await PDFDocument.create();
      for (const it of items) {
        if (!it.pdf) continue;
        const src = await PDFDocument.load(it.pdf);
        for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
      }
      save(await out.save(), 'searchable.pdf', 'application/pdf');
    } catch {
      setError('The searchable PDF could not be made. Copy the text or download the TXT instead.');
    } finally {
      setBusy('');
    }
  };

  return (
    <ToolLayout toolId="image-to-text">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []), 'image');
          e.target.value = '';
        }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary">
              <ImagePlus className="h-4 w-4" /> Add images or a PDF
            </button>
            <p className="mt-2 text-xs text-muted-foreground">Or paste a screenshot with Ctrl/⌘+V. Printed English text works best; handwriting is read poorly.</p>
            {items.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {items.map((it, i) => (
                  <Thumb key={it.id} canvas={it.canvas} index={i} onRemove={() => setItems((its) => its.filter((x) => x.id !== it.id))} />
                ))}
              </div>
            )}
          </div>
          {allRead && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Text</h2>
                <CopyButton text={text} size="sm" />
              </div>
              <textarea readOnly value={text || 'No text was found.'} className="developer-scrollbar h-72 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs" aria-label="Recognised text" />
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 text-xs">
            <button type="button" onClick={read} disabled={!items.length || !!busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <ScanText className="h-4 w-4" /> {busy || 'Read text'}
            </button>
            {allRead && (
              <>
                <button type="button" onClick={() => save(text, 'text.txt', 'text/plain;charset=utf-8')} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:border-primary">
                  <FileText className="h-4 w-4" /> Download TXT
                </button>
                {items.some((it) => it.pdf) && (
                  <button type="button" onClick={downloadPdf} disabled={!!busy} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:border-primary disabled:opacity-50">
                    <Download className="h-4 w-4" /> Download searchable PDF
                  </button>
                )}
              </>
            )}
            {items.length > 0 && (
              <button type="button" onClick={() => setItems([])} className="mt-3 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
          <p className="flex gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> Text is read inside your browser. Your images never leave this device; the first run downloads the reader (about 7 MB) from this site.
          </p>
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
        </aside>
      </div>
    </ToolLayout>
  );
}

function Thumb({ canvas, index, onRemove }: { canvas: HTMLCanvasElement; index: number; onRemove: () => void }) {
  const url = useMemo(() => canvas.toDataURL('image/jpeg', 0.5), [canvas]);
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's image */}
      <img src={url} alt={`Page ${index + 1}`} className="aspect-[3/4] w-full object-contain" />
      <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 text-[11px] font-medium">{index + 1}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove page ${index + 1}`} className="absolute right-1 top-1 rounded bg-background/90 p-1 shadow">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
