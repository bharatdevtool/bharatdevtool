'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Download, Plus, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CornerCrop from '@/components/image/CornerCrop';
import { loadImageCanvas } from '@/lib/image/perspective';
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
  const [cropping, setCropping] = useState<{ row: number; side: Side; source: HTMLCanvasElement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<{ row: number; side: Side } | null>(null);

  const filled = rows.filter((r) => r.front || r.back);

  const pick = (row: number, side: Side) => {
    target.current = { row, side };
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !target.current) return;
    setError(null);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Choose a photo (JPG, PNG or WebP) of the card side.');
      const source = await loadImageCanvas(file, 2400);
      setCropping({ ...target.current, source });
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('Choose') ? err.message : 'This photo could not be opened. On iPhone, set Camera → Formats → Most Compatible, or use a JPG.');
    }
  };

  const setSide = (row: number, side: Side, canvas: HTMLCanvasElement | undefined) =>
    setRows((rs) => rs.map((r, i) => (i === row ? { ...r, [side]: canvas } : r)));

  const download = async () => {
    if (!filled.length) {
      setError('Add at least one card side first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { sheetToPdf } = await import('@/lib/print/output');
      const sheet = cardSheet({ mode, rows: filled.length });
      const images = [];
      for (const slot of sheet.slots) {
        const canvas = filled[slot.row][slot.side];
        if (canvas) images.push({ rect: slot.rect, bytes: await canvasToJpeg(canvas), mime: 'image/jpeg' as const });
      }
      save(await sheetToPdf(sheet, images), 'id-cards-a4.pdf', 'application/pdf');
      analytics.track(ANALYTICS_EVENTS.ID_CARD_PRINT, { cards: filled.length, layout: mode, output: 'pdf' });
    } catch {
      setError('The PDF could not be made. Try again, or use fewer or smaller photos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolLayout toolId="aadhaar-card-print">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          {cropping ? (
            <CornerCrop
              source={cropping.source}
              aspect={ID_CARD.w / ID_CARD.h}
              outputWidth={OUT_W}
              title={`${CARD_TYPES.find((t) => t.id === rows[cropping.row].type)?.label ?? 'Card'}: ${cropping.side}`}
              onCancel={() => setCropping(null)}
              onDone={(canvas) => {
                setSide(cropping.row, cropping.side, canvas);
                setCropping(null);
              }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
              <p className="mb-4 text-xs text-muted-foreground">
                One card per row, front and back side by side. Empty slots are left blank on the printout.
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
                        <Slot key={side} canvas={row[side]} side={side} onPick={() => pick(i, side)} onRemove={() => setSide(i, side, undefined)} fold={mode === 'fold'} />
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
              onClick={download}
              disabled={busy || !filled.length || !!cropping}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {busy ? 'Making PDF…' : 'Download A4 PDF'}
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">Print at 100% (Actual size), not Fit to page. The line at the bottom of the sheet must measure 50 mm.</p>
            <button
              type="button"
              onClick={() => {
                setRows(emptyRows());
                setCropping(null);
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

function Slot({ canvas, side, onPick, onRemove, fold }: { canvas?: HTMLCanvasElement; side: Side; onPick: () => void; onRemove: () => void; fold: boolean }) {
  const url = useMemo(() => (canvas ? canvas.toDataURL('image/jpeg', 0.7) : ''), [canvas]);
  const edge = fold ? (side === 'front' ? 'rounded-l-lg border-r-0' : 'rounded-r-lg border-dashed') : 'rounded-lg';
  return (
    <div className={`relative overflow-hidden border-2 ${canvas ? 'border-solid border-border' : 'border-dotted border-border'} ${edge}`} style={{ aspectRatio: `${ID_CARD.w} / ${ID_CARD.h}` }}>
      {canvas ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own card */}
          <img src={url} alt={`${side} of card`} className="h-full w-full object-cover" />
          <div className="absolute right-1 top-1 flex gap-1">
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
