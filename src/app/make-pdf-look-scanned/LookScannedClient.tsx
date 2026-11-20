'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Download, FilePlus, ShieldCheck, Trash2 } from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { loadImageCanvas } from '@/lib/image/perspective';
import { DEFAULT_LOOK, renderScanned, type ScanColour, type ScanLook } from '@/lib/scan/lookScanned';
import { scansToPdf, SCAN_DPI } from '@/lib/scan/pdf';
import { isEncryptedError } from '@/lib/pdf/shared';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';

type Source =
  | { kind: 'pdf'; bytes: Uint8Array; pages: number; first: HTMLCanvasElement; name: string }
  | { kind: 'images'; canvases: HTMLCanvasElement[]; name: string };

const SIZES = [100, 200, 500, 1000];
const sizeLabel = (kb: number) => (kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`);
/** PDF pages are drawn at the scan resolution, so the output keeps the original page size. */
const PDF_SCALE = SCAN_DPI / 72;
const MAX_PAGES = 100;
const COLOURS: { id: ScanColour; label: string }[] = [
  { id: 'gray', label: 'Grey' },
  { id: 'bw', label: 'Black & white' },
  { id: 'colour', label: 'Colour' },
];
const SLIDERS: { key: 'tilt' | 'noise' | 'blur' | 'brightness' | 'contrast'; label: string; min: number; max: number; step: number }[] = [
  { key: 'tilt', label: 'Tilt', min: 0, max: 2, step: 0.1 },
  { key: 'noise', label: 'Grain', min: 0, max: 1, step: 0.05 },
  { key: 'blur', label: 'Softness', min: 0, max: 1, step: 0.05 },
  { key: 'brightness', label: 'Brightness', min: -40, max: 40, step: 5 },
  { key: 'contrast', label: 'Contrast', min: -40, max: 40, step: 5 },
];

function shrink(c: HTMLCanvasElement, maxW = 900): HTMLCanvasElement {
  const k = Math.min(1, maxW / c.width);
  if (k === 1) return c;
  const out = document.createElement('canvas');
  out.width = Math.round(c.width * k);
  out.height = Math.round(c.height * k);
  out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

async function jpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  if (!blob) throw new Error('encode');
  return new Uint8Array(await blob.arrayBuffer());
}

export default function LookScannedClient() {
  const [source, setSource] = useState<Source | null>(null);
  const [look, setLook] = useState<ScanLook>(DEFAULT_LOOK);
  const [fitUnder, setFitUnder] = useState(false);
  const [targetKb, setTargetKb] = useState(200);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pageCount = source ? (source.kind === 'pdf' ? source.pages : source.canvases.length) : 0;
  const small = useMemo(() => (source ? shrink(source.kind === 'pdf' ? source.first : source.canvases[0]) : null), [source]);
  const preview = useMemo(() => (small ? renderScanned(small, look, 0).toDataURL('image/jpeg', 0.8) : ''), [small, look]);

  const open = async (files: File[]) => {
    setError(null);
    setNote('');
    if (!files.length) return;
    setBusy('Opening…');
    try {
      const pdf = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      const base = (pdf ?? files[0]).name.replace(/\.[^.]+$/, '') || 'document';
      if (pdf) {
        const bytes = new Uint8Array(await pdf.arrayBuffer());
        const { openPdf, renderPage } = await import('@/lib/pdf/browser');
        const doc = await openPdf(bytes);
        try {
          if (doc.numPages > MAX_PAGES) throw new Error('long');
          setSource({ kind: 'pdf', bytes, pages: doc.numPages, first: await renderPage(doc, 0, PDF_SCALE), name: base });
        } finally {
          void doc.loadingTask.destroy();
        }
      } else {
        const canvases = [];
        for (const f of files.filter((x) => x.type.startsWith('image/'))) canvases.push(await loadImageCanvas(f, 2400));
        if (!canvases.length) throw new Error('none');
        setSource({ kind: 'images', canvases, name: base });
      }
    } catch (err) {
      setError(
        isEncryptedError(err)
          ? 'This PDF has a password. Remove it first with Unlock PDF, then add it here.'
          : err instanceof Error && err.message === 'long'
            ? `This PDF has more than ${MAX_PAGES} pages. Split it first.`
            : 'This file could not be opened. Use a PDF, JPG or PNG.',
      );
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    if (!source) return;
    setError(null);
    setNote('');
    try {
      const pages = [];
      const { openPdf, renderPage, makeRasterizer } = await import('@/lib/pdf/browser');
      const doc = source.kind === 'pdf' ? await openPdf(source.bytes) : null;
      try {
        for (let i = 0; i < pageCount; i++) {
          setBusy(`Scanning page ${i + 1} of ${pageCount}…`);
          const page = doc ? await renderPage(doc, i, PDF_SCALE) : (source as Extract<Source, { kind: 'images' }>).canvases[i];
          const scanned = renderScanned(page, look, i);
          pages.push({ bytes: await jpeg(scanned), width: scanned.width, height: scanned.height });
        }
      } finally {
        if (doc) void doc.loadingTask.destroy();
      }
      let bytes = await scansToPdf(pages, source.kind === 'pdf' ? 'fit' : 'a4');
      const limit = targetKb * 1024;
      if (fitUnder && bytes.length > limit) {
        setBusy(`Fitting under ${sizeLabel(targetKb)}…`);
        const { compressToTarget } = await import('@/lib/pdf/compress');
        const out = await openPdf(bytes);
        try {
          const r = await compressToTarget(limit, makeRasterizer(out), undefined, bytes);
          bytes = r.bytes;
          setNote(r.bytes.length <= limit ? `Fits under ${sizeLabel(targetKb)}.` : `Could not get under ${sizeLabel(targetKb)}; this is the smallest readable version.`);
        } finally {
          void out.loadingTask.destroy();
        }
      }
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${source.name}-scanned.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      analytics.track(ANALYTICS_EVENTS.LOOK_SCANNED, { pages: pageCount, source: source.kind, colour: look.colour, fit_under: fitUnder });
    } catch {
      setError('The scanned PDF could not be made. Try again with fewer pages.');
    } finally {
      setBusy('');
    }
  };

  const chip = (on: boolean) => `rounded-full border px-2.5 py-1 ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`;

  return (
    <ToolLayout toolId="make-pdf-look-scanned">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void open(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          {source ? (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Preview of page 1 of {pageCount}. Every page gets its own small tilt. The text in the result can no longer be selected, like a real scan.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's page */}
              {preview && <img src={preview} alt="Scanned look preview" className="mx-auto max-h-[70vh] w-auto rounded border border-border shadow-sm" />}
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-16 text-sm text-muted-foreground hover:border-primary hover:text-primary">
              <FilePlus className="h-6 w-6" /> {busy || 'Choose a PDF, or JPG/PNG pages'}
            </button>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 text-xs">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Scan look</h2>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {COLOURS.map((c) => (
                <button key={c.id} type="button" onClick={() => setLook((l) => ({ ...l, colour: c.id }))} aria-pressed={look.colour === c.id} className={chip(look.colour === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            {SLIDERS.map((s) => (
              <label key={s.key} className="mb-2 block text-muted-foreground">
                {s.label}
                <input type="range" min={s.min} max={s.max} step={s.step} value={look[s.key]} onChange={(e) => setLook((l) => ({ ...l, [s.key]: Number(e.target.value) }))} className="w-full accent-primary" />
              </label>
            ))}
            <label className="mt-2 flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={fitUnder} onChange={(e) => setFitUnder(e.target.checked)} className="accent-primary" /> Fit under a maximum size
            </label>
            {fitUnder && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SIZES.map((kb) => (
                  <button key={kb} type="button" onClick={() => setTargetKb(kb)} aria-pressed={targetKb === kb} className={chip(targetKb === kb)}>
                    {sizeLabel(kb)}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={download} disabled={!source || !!busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <Download className="h-4 w-4" /> {busy || 'Download scanned PDF'}
            </button>
            {note && <p className="mt-2 text-muted-foreground">{note}</p>}
            {source && (
              <button type="button" onClick={() => setSource(null)} className="mt-3 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Start again
              </button>
            )}
          </div>
          <p className="flex gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> Your file never leaves this device: the scanned look is drawn in your browser and nothing is saved.
          </p>
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
        </aside>
      </div>
    </ToolLayout>
  );
}
