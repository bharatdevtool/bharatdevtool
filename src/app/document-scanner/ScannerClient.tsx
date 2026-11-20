'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Download, FileImage, IdCard, ImagePlus, ShieldCheck, Trash2 } from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CornerCrop from '@/components/image/CornerCrop';
import { loadImageCanvas } from '@/lib/image/perspective';
import { scansToPdf, type ScanPageSize } from '@/lib/scan/pdf';
import { setCrossToolData } from '@/lib/crossToolData';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';

type Shape = 'auto' | 'a4' | 'id';

const SHAPES: { id: Shape; label: string; aspect?: number; width?: number }[] = [
  { id: 'auto', label: 'As photographed' },
  { id: 'a4', label: 'A4 page', aspect: 210 / 297, width: 1654 },
  { id: 'id', label: 'ID card', aspect: 85.6 / 54, width: 1011 },
];
const SIZES = [100, 200, 500, 1000];
const sizeLabel = (kb: number) => (kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`);

interface Page {
  id: number;
  canvas: HTMLCanvasElement;
}
let nextId = 1;

async function jpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('encode');
  return new Uint8Array(await blob.arrayBuffer());
}

function save(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ScannerClient() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [shape, setShape] = useState<Shape>('auto');
  const [cropping, setCropping] = useState<{ source: HTMLCanvasElement; rest: File[] } | null>(null);
  const [pageSize, setPageSize] = useState<ScanPageSize>('a4');
  const [fitUnder, setFitUnder] = useState(false);
  const [targetKb, setTargetKb] = useState(200);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const current = SHAPES.find((s) => s.id === shape)!;

  /** Crop the queued photos one after another. */
  const next = async (queue: File[]) => {
    const [file, ...rest] = queue;
    if (!file) {
      setCropping(null);
      return;
    }
    try {
      setCropping({ source: await loadImageCanvas(file, 3000), rest });
    } catch {
      setError('A photo could not be opened. On iPhone, set Camera → Formats → Most Compatible, or use JPG photos.');
      void next(rest);
    }
  };

  const onFiles = (list: FileList | null) => {
    setError(null);
    setNote('');
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    if (cameraRef.current) cameraRef.current.value = '';
    if (photosRef.current) photosRef.current.value = '';
    if (files.length) void next(files);
  };

  const track = (output: string) => analytics.track(ANALYTICS_EVENTS.DOCUMENT_SCAN, { pages: pages.length, output, shape, fit_under: fitUnder });

  const downloadPdf = async () => {
    setError(null);
    setNote('');
    setBusy('Making PDF…');
    try {
      const images = [];
      for (const p of pages) images.push({ bytes: await jpeg(p.canvas), width: p.canvas.width, height: p.canvas.height });
      let bytes = await scansToPdf(images, pageSize);
      const limit = targetKb * 1024;
      if (fitUnder && bytes.length > limit) {
        setBusy(`Fitting under ${sizeLabel(targetKb)}…`);
        const [{ openPdf, makeRasterizer }, { compressToTarget }] = await Promise.all([import('@/lib/pdf/browser'), import('@/lib/pdf/compress')]);
        const doc = await openPdf(bytes);
        try {
          const r = await compressToTarget(limit, makeRasterizer(doc), undefined, bytes);
          bytes = r.bytes;
          setNote(r.bytes.length <= limit ? `Fits under ${sizeLabel(targetKb)} at about ${Math.round(r.scale * 72)} DPI.` : `Could not get under ${sizeLabel(targetKb)}; this is the smallest readable version. Remove pages or choose a larger size.`);
        } finally {
          void doc.loadingTask.destroy();
        }
      }
      save(bytes, 'scan.pdf', 'application/pdf');
      track('pdf');
    } catch {
      setError('The PDF could not be made. Try again with fewer pages.');
    } finally {
      setBusy('');
    }
  };

  const downloadJpg = async () => {
    setError(null);
    setBusy('Saving images…');
    try {
      if (pages.length === 1) {
        save(await jpeg(pages[0].canvas, 0.92), 'scan.jpg', 'image/jpeg');
        track('jpg');
      } else {
        const { makeZip } = await import('@/lib/pdf/browser');
        const files = [];
        for (let i = 0; i < pages.length; i++) files.push({ name: `scan-${i + 1}.jpg`, bytes: await jpeg(pages[i].canvas, 0.92) });
        save(makeZip(files), 'scans.zip', 'application/zip');
        track('zip');
      }
    } catch {
      setError('The images could not be saved. Try again.');
    } finally {
      setBusy('');
    }
  };

  const sendToIdCard = () => {
    const [front, back] = pages;
    setCrossToolData('aadhaar-card-print', { front: front?.canvas.toDataURL('image/jpeg', 0.92), back: back?.canvas.toDataURL('image/jpeg', 0.92) });
    track('id_card');
    router.push('/aadhaar-card-print');
  };

  return (
    <ToolLayout toolId="document-scanner">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          {cropping ? (
            <CornerCrop
              key={cropping.rest.length}
              source={cropping.source}
              aspect={current.aspect}
              outputWidth={current.width}
              title={`Page ${pages.length + 1}`}
              onCancel={() => void next(cropping.rest)}
              onDone={(canvas) => {
                setPages((ps) => [...ps, { id: nextId++, canvas }]);
                void next(cropping.rest);
              }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                  <Camera className="h-4 w-4" /> Take photo
                </button>
                <button type="button" onClick={() => photosRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary">
                  <ImagePlus className="h-4 w-4" /> Add photos
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Lay the page flat in good light. After each photo, drag the corners onto the edges of the paper.</p>
              {pages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {pages.map((p, i) => (
                    <Thumb key={p.id} canvas={p.canvas} index={i} onRemove={() => setPages((ps) => ps.filter((x) => x.id !== p.id))} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 text-xs">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Shape of each scan</h2>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {SHAPES.map((s) => (
                <button key={s.id} type="button" onClick={() => setShape(s.id)} aria-pressed={shape === s.id} className={`rounded-full border px-2.5 py-1 ${shape === s.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">PDF page size</h2>
            <div className="mb-4 flex gap-1.5">
              {(['a4', 'fit'] as ScanPageSize[]).map((s) => (
                <button key={s} type="button" onClick={() => setPageSize(s)} aria-pressed={pageSize === s} className={`rounded-full border px-2.5 py-1 ${pageSize === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}>
                  {s === 'a4' ? 'A4' : 'Size of the scan'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={fitUnder} onChange={(e) => setFitUnder(e.target.checked)} className="accent-primary" /> Fit under a maximum size
            </label>
            {fitUnder && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SIZES.map((kb) => (
                  <button key={kb} type="button" onClick={() => setTargetKb(kb)} aria-pressed={targetKb === kb} className={`rounded-full border px-2.5 py-1 ${targetKb === kb ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}>
                    {sizeLabel(kb)}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={downloadPdf} disabled={!pages.length || !!busy || !!cropping} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <Download className="h-4 w-4" /> {busy || `Download PDF${pages.length ? ` (${pages.length} page${pages.length > 1 ? 's' : ''})` : ''}`}
            </button>
            <button type="button" onClick={downloadJpg} disabled={!pages.length || !!busy || !!cropping} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:border-primary disabled:opacity-50">
              <FileImage className="h-4 w-4" /> {pages.length > 1 ? 'Download JPGs (ZIP)' : 'Download JPG'}
            </button>
            {shape === 'id' && pages.length > 0 && (
              <button type="button" onClick={sendToIdCard} disabled={!!busy || !!cropping} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:border-primary disabled:opacity-50">
                <IdCard className="h-4 w-4" /> Send to ID card print
              </button>
            )}
            {note && <p className="mt-2 text-muted-foreground">{note}</p>}
            {pages.length > 0 && (
              <button type="button" onClick={() => setPages([])} className="mt-3 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
          <p className="flex gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> Your pages never leave this device: straightening and the PDF are done in your browser, and nothing is saved.
          </p>
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
        </aside>
      </div>
    </ToolLayout>
  );
}

function Thumb({ canvas, index, onRemove }: { canvas: HTMLCanvasElement; index: number; onRemove: () => void }) {
  const url = useMemo(() => canvas.toDataURL('image/jpeg', 0.6), [canvas]);
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's scan */}
      <img src={url} alt={`Page ${index + 1}`} className="aspect-[3/4] w-full object-contain" />
      <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 text-[11px] font-medium">{index + 1}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove page ${index + 1}`} className="absolute right-1 top-1 rounded bg-background/90 p-1 shadow">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
