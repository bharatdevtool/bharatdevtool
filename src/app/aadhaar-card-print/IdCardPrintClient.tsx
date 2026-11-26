'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Download, EyeOff, FileImage, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CornerCrop from '@/components/image/CornerCrop';
import MaskBox from '@/components/image/MaskBox';
import { isEncryptedError } from '@/lib/pdf/shared';
import { useCrossToolData } from '@/hooks/useCrossToolData';
import { loadImageCanvas, type Quad } from '@/lib/image/perspective';
import { detectOnCanvas } from '@/lib/scan/detect';
import { cardSheet, ID_CARD, mmToPx, type CardLayoutMode } from '@/lib/print/sheet';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';

type Side = 'front' | 'back';
type CardType = 'aadhaar' | 'pan' | 'voter' | 'dl' | 'abha' | 'ayushman' | 'other';

const CARD_TYPES: { id: CardType; label: string }[] = [
  { id: 'aadhaar', label: 'Aadhaar' },
  { id: 'pan', label: 'PAN card' },
  { id: 'voter', label: 'Voter ID' },
  { id: 'dl', label: 'Driving licence' },
  { id: 'abha', label: 'ABHA card' },
  { id: 'ayushman', label: 'Ayushman card' },
  { id: 'other', label: 'Other ID card' },
];

interface CardRow {
  type: CardType;
  front?: HTMLCanvasElement;
  back?: HTMLCanvasElement;
}

const OUT_W = mmToPx(ID_CARD.w); // 1011 px = 85.6 mm at 300 DPI
const emptyRows = (): CardRow[] => ['aadhaar', 'pan', 'voter', 'dl'].map((type) => ({ type: type as CardType }));

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not prepare the card image.');
  return new Uint8Array(await blob.arrayBuffer());
}

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

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Render the first two pages of a PDF, stacked, so both card sides can be cropped from it. */
async function pdfToCanvas(bytes: Uint8Array, password?: string): Promise<HTMLCanvasElement> {
  const { openPdf, renderPage } = await import('@/lib/pdf/browser');
  const doc = await openPdf(bytes, password);
  try {
    const pages: HTMLCanvasElement[] = [];
    for (let i = 0; i < Math.min(2, doc.numPages); i++) pages.push(await renderPage(doc, i, 3));
    const out = document.createElement('canvas');
    out.width = Math.max(...pages.map((c) => c.width));
    out.height = pages.reduce((h, c) => h + c.height, 0);
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    let y = 0;
    for (const c of pages) {
      ctx.drawImage(c, 0, y);
      y += c.height;
    }
    return out;
  } finally {
    void doc.loadingTask.destroy();
  }
}

function save(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function IdCardPrintClient() {
  const [rows, setRows] = useState<CardRow[]>(emptyRows);
  const [mode, setMode] = useState<CardLayoutMode>('fold');
  const [cropping, setCropping] = useState<{ row: number; side: Side; source: HTMLCanvasElement; fromPdf?: boolean; quad?: Quad } | null>(null);
  const [masking, setMasking] = useState<{ row: number; side: Side } | null>(null);
  const [pdfAsk, setPdfAsk] = useState<{ bytes: Uint8Array; row: number; side: Side; wrong: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<{ row: number; side: Side } | null>(null);

  const filled = rows.filter((r) => r.front || r.back);

  // A card scanned with the Document Scanner (front, back) goes into the first empty row.
  useCrossToolData<{ front?: string; back?: string }>('aadhaar-card-print', async ({ front, back }) => {
    try {
      const [f, b] = await Promise.all([front ? dataUrlToCanvas(front) : undefined, back ? dataUrlToCanvas(back) : undefined]);
      setRows((rs) => {
        const i = Math.max(0, rs.findIndex((r) => !r.front && !r.back));
        return rs.map((r, j) => (j === i ? { ...r, front: f ?? r.front, back: b ?? r.back } : r));
      });
    } catch {
      setError('The scanned card could not be opened here. Add the photos again.');
    }
  });

  const pick = (row: number, side: Side) => {
    target.current = { row, side };
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !target.current) return;
    setError(null);
    if (isPdf(file)) {
      await openPdfFor(new Uint8Array(await file.arrayBuffer()), target.current);
      return;
    }
    try {
      if (!file.type.startsWith('image/')) throw new Error('Choose a photo (JPG, PNG or WebP) or the PDF of the card.');
      const source = await loadImageCanvas(file, 2400);
      setCropping({ ...target.current, source, quad: detectOnCanvas(source) });
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('Choose') ? err.message : 'This photo could not be opened. On iPhone, set Camera → Formats → Most Compatible, or use a JPG.');
    }
  };

  const openPdfFor = async (bytes: Uint8Array, at: { row: number; side: Side }, pw?: string) => {
    setError(null);
    setBusy(true);
    try {
      const source = await pdfToCanvas(bytes, pw);
      setPdfAsk(null);
      setPassword('');
      setCropping({ ...at, source, fromPdf: true });
    } catch (err) {
      if (isEncryptedError(err)) setPdfAsk({ bytes, ...at, wrong: !!pw });
      else setError('This PDF could not be opened. Try downloading it again, or use photos of the card.');
    } finally {
      setBusy(false);
    }
  };

  const setSide = (row: number, side: Side, canvas: HTMLCanvasElement | undefined) =>
    setRows((rs) => rs.map((r, i) => (i === row ? { ...r, [side]: canvas } : r)));

  const download = async (output: 'pdf' | 'jpg') => {
    if (!filled.length) {
      setError('Add at least one card side first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { sheetToPdf, sheetToCanvas } = await import('@/lib/print/output');
      const sheet = cardSheet({ mode, rows: filled.length });
      const placed = sheet.slots.flatMap((slot) => {
        const canvas = filled[slot.row][slot.side];
        return canvas ? [{ rect: slot.rect, canvas }] : [];
      });
      if (output === 'pdf') {
        const images = [];
        for (const p of placed) images.push({ rect: p.rect, bytes: await canvasToJpeg(p.canvas), mime: 'image/jpeg' as const });
        save(await sheetToPdf(sheet, images), 'id-cards-a4.pdf', 'application/pdf');
      } else {
        const page = sheetToCanvas(sheet, placed.map((p) => ({ rect: p.rect, source: p.canvas })), 300);
        save(await canvasToJpeg(page), 'id-cards-a4.jpg', 'image/jpeg');
      }
      analytics.track(ANALYTICS_EVENTS.ID_CARD_PRINT, { cards: filled.length, layout: mode, output });
    } catch {
      setError(`The ${output === 'pdf' ? 'PDF' : 'image'} could not be made. Try again, or use fewer or smaller photos.`);
    } finally {
      setBusy(false);
    }
  };

  const otherSide = (side: Side): Side => (side === 'front' ? 'back' : 'front');

  return (
    <ToolLayout toolId="aadhaar-card-print">
      <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          {pdfAsk ? (
            <form
              className="rounded-xl border border-border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (password) void openPdfFor(pdfAsk.bytes, pdfAsk, password);
              }}
            >
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <KeyRound className="h-4 w-4" /> This PDF has a password
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                For e-Aadhaar it is the first 4 letters of your name in CAPITALS followed by your birth year, for example RAHU1990. The password stays on this device.
              </p>
              <input
                type="password"
                autoFocus
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="PDF password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {pdfAsk.wrong && <p className="mt-2 text-xs text-red-500">That password did not work. Check the capital letters and the year.</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => { setPdfAsk(null); setPassword(''); }} className="rounded-lg border border-border px-3 py-1.5 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={!password || busy} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  {busy ? 'Opening…' : 'Open PDF'}
                </button>
              </div>
            </form>
          ) : masking && rows[masking.row][masking.side] ? (
            <MaskBox
              canvas={rows[masking.row][masking.side]!}
              onCancel={() => setMasking(null)}
              onDone={(canvas) => {
                setSide(masking.row, masking.side, canvas);
                setMasking(null);
              }}
            />
          ) : cropping ? (
            <CornerCrop
              key={`${cropping.row}-${cropping.side}`}
              source={cropping.source}
              initialQuad={cropping.quad}
              aspect={ID_CARD.w / ID_CARD.h}
              outputWidth={OUT_W}
              title={`${CARD_TYPES.find((t) => t.id === rows[cropping.row].type)?.label ?? 'Card'}: ${cropping.side}`}
              onCancel={() => setCropping(null)}
              onDone={(canvas) => {
                setSide(cropping.row, cropping.side, canvas);
                // A card PDF (e.g. e-Aadhaar) holds both sides: go straight on to the other one.
                const other = otherSide(cropping.side);
                setCropping(cropping.fromPdf && !rows[cropping.row][other] ? { ...cropping, side: other } : null);
              }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
              <p className="mb-4 text-xs text-muted-foreground">
                One card per row, front and back side by side. Add a photo of each side, or the card&apos;s PDF (such as e-Aadhaar) and crop both sides from it. Empty slots are left blank on the printout.
              </p>
              <div className="space-y-4">
                {rows.map((row, i) => (
                  <div key={i}>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
                      Card {i + 1}
                      <select
                        value={row.type}
                        onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, type: e.target.value as CardType } : r)))}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        {CARD_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={`grid grid-cols-2 ${mode === 'fold' ? 'gap-0' : 'gap-3'}`}>
                      {(['front', 'back'] as Side[]).map((side) => (
                        <Slot key={side} canvas={row[side]} side={side} onPick={() => pick(i, side)} onMask={() => setMasking({ row: i, side })} onRemove={() => setSide(i, side, undefined)} fold={mode === 'fold'} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Layout</h2>
            {(
              [
                ['fold', 'Fold & laminate', 'Front and back touch at a dashed line: cut out the pair, fold it, laminate.'],
                ['cut', 'Cut separately', 'A gap between front and back, with cut lines around each side.'],
              ] as [CardLayoutMode, string, string][]
            ).map(([id, title, detail]) => (
              <label key={id} className="mb-2 flex cursor-pointer gap-2 rounded-lg border border-border p-2.5 text-xs has-[:checked]:border-primary">
                <input type="radio" name="layout" checked={mode === id} onChange={() => setMode(id)} className="mt-0.5 accent-primary" />
                <span>
                  <span className="block font-medium text-foreground">{title}</span>
                  <span className="text-muted-foreground">{detail}</span>
                </span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => download('pdf')}
              disabled={busy || !filled.length || !!cropping || !!masking}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {busy ? 'Working…' : 'Download A4 PDF'}
            </button>
            <button
              type="button"
              onClick={() => download('jpg')}
              disabled={busy || !filled.length || !!cropping || !!masking}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:border-primary disabled:opacity-50"
            >
              <FileImage className="h-4 w-4" /> Download as JPG (300 DPI)
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">Print at 100% (Actual size), not Fit to page. The line at the bottom of the sheet must measure 50 mm.</p>
            <button
              type="button"
              onClick={() => {
                setRows(emptyRows());
                setCropping(null);
                setMasking(null);
                setPdfAsk(null);
                setPassword('');
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <p className="mb-2 flex gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> Your cards never leave this device: cropping and the PDF are made in your browser, and nothing is saved.
            </p>
            <p className="flex gap-2">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" /> Never print bank, ATM or credit cards: a printed card number and CVV can be misused.
            </p>
          </div>
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
        </aside>
      </div>
    </ToolLayout>
  );
}

function Slot({ canvas, side, onPick, onMask, onRemove, fold }: { canvas?: HTMLCanvasElement; side: Side; onPick: () => void; onMask: () => void; onRemove: () => void; fold: boolean }) {
  const url = useMemo(() => (canvas ? canvas.toDataURL('image/jpeg', 0.7) : ''), [canvas]);
  const edge = fold ? (side === 'front' ? 'rounded-l-lg border-r-0' : 'rounded-r-lg border-dashed') : 'rounded-lg';
  return (
    <div className={`relative overflow-hidden border-2 ${canvas ? 'border-solid border-border' : 'border-dotted border-border'} ${edge}`} style={{ aspectRatio: `${ID_CARD.w} / ${ID_CARD.h}` }}>
      {canvas ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own card */}
          <img src={url} alt={`${side} of card`} className="h-full w-full object-cover" />
          <div className="absolute right-1 top-1 flex gap-1">
            <button type="button" onClick={onMask} aria-label={`Hide numbers on ${side}`} title="Hide numbers" className="rounded bg-background/90 p-1 text-foreground shadow">
              <EyeOff className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onPick} aria-label={`Replace ${side}`} className="rounded bg-background/90 p-1 text-foreground shadow">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onRemove} aria-label={`Remove ${side}`} className="rounded bg-background/90 p-1 text-foreground shadow">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onPick} className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-primary">
          <Plus className="h-5 w-5" /> Add {side}
        </button>
      )}
    </div>
  );
}
