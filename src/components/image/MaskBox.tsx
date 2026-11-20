'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Drag boxes over numbers to black them out (e.g. the first 8 Aadhaar digits).
 * The boxes are burned into a copy of the image, so the hidden part is gone from the output.
 */
export default function MaskBox({ canvas, onDone, onCancel }: { canvas: HTMLCanvasElement; onDone: (c: HTMLCanvasElement) => void; onCancel: () => void }) {
  const url = useMemo(() => canvas.toDataURL('image/jpeg', 0.85), [canvas]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1),
      y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1),
    };
  };
  const rect = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  const apply = () => {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    ctx.fillStyle = '#000000';
    for (const b of boxes) ctx.fillRect(b.x * out.width, b.y * out.height, b.w * out.width, b.h * out.height);
    onDone(out);
  };

  const shown = draft ? [...boxes, draft] : boxes;
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Hide numbers</h3>
      <p className="mb-3 text-xs text-muted-foreground">Drag a box over anything you want to hide, such as the first 8 digits of your Aadhaar number. It is blacked out on the printout.</p>
      <div
        ref={ref}
        className="relative mx-auto select-none touch-none"
        style={{ maxWidth: 640, aspectRatio: `${canvas.width} / ${canvas.height}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = at(e);
          setDraft(rect(start.current, start.current));
        }}
        onPointerMove={(e) => start.current && setDraft(rect(start.current, at(e)))}
        onPointerUp={() => {
          if (draft && draft.w > 0.01 && draft.h > 0.01) setBoxes((b) => [...b, draft]);
          setDraft(null);
          start.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own card */}
        <img src={url} alt="" draggable={false} className="block h-full w-full rounded-md" />
        {shown.map((b, i) => (
          <div key={i} className="absolute bg-black/90 ring-1 ring-primary" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={!boxes.length} onClick={() => setBoxes((b) => b.slice(0, -1))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary disabled:opacity-50">
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button type="button" disabled={!boxes.length} onClick={apply} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> Hide
        </button>
      </div>
    </div>
  );
}
