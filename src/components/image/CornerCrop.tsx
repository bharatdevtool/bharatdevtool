'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Check, RotateCw, Undo2, X } from 'lucide-react';
import { defaultQuad, quadSize, rotateCanvas90, warpCanvas, type Quad } from '@/lib/image/perspective';

interface CornerCropProps {
  /** Decoded image (see loadImageCanvas). */
  source: HTMLCanvasElement;
  /** Output width ÷ height, e.g. 85.6 / 54 for an ID card. Leave out to keep the shape of the corners. */
  aspect?: number;
  /** Output width in pixels (1011 = 85.6 mm at 300 DPI). Used with `aspect`. */
  outputWidth?: number;
  /** Starting corners in source pixels (e.g. from auto-detection). */
  initialQuad?: Quad;
  title?: string;
  onDone: (result: HTMLCanvasElement) => void;
  onCancel: () => void;
}

const HANDLE = 22;

/**
 * Drag the four corners onto the edges of the card or page; the area inside is straightened
 * to the locked shape. Pointer events, so it works with mouse and touch.
 */
export default function CornerCrop({ source, aspect, outputWidth, initialQuad, title, onDone, onCancel }: CornerCropProps) {
  const [img, setImg] = useState(source);
  const [quad, setQuad] = useState<Quad>(initialQuad ?? defaultQuad(source.width, source.height));
  const [drag, setDrag] = useState<number | null>(null);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const url = useMemo(() => img.toDataURL('image/jpeg', 0.85), [img]);

  const toImage = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * img.width;
    const y = ((e.clientY - r.top) / r.height) * img.height;
    return { x: Math.min(Math.max(x, 0), img.width), y: Math.min(Math.max(y, 0), img.height) };
  };

  const move = (e: React.PointerEvent) => {
    if (drag === null) return;
    const p = toImage(e);
    setQuad((q) => q.map((c, i) => (i === drag ? p : c)) as Quad);
  };

  const rotate = () => {
    const next = rotateCanvas90(img);
    setImg(next);
    setQuad(defaultQuad(next.width, next.height));
  };

  const apply = () => {
    try {
      const width = outputWidth ?? 1600;
      const size = aspect ? { w: width, h: Math.round(width / aspect) } : quadSize(quad);
      onDone(warpCanvas(img, quad, size.w, size.h));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not straighten this photo. Move the corners and try again.');
    }
  };

  const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / img.width) * 100}%`, top: `${(p.y / img.height) * 100}%` });

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      {title && <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>}
      <p className="mb-3 text-xs text-muted-foreground">Drag the four corners onto the edges. The area inside is straightened and cut to size.</p>
      <div className="flex justify-center">
        <div
          ref={boxRef}
          className="relative select-none touch-none"
          style={{ width: `min(100%, calc(60vh * ${img.width / img.height}))`, aspectRatio: `${img.width} / ${img.height}` }}
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the user's photo */}
          {url && <img src={url} alt="" draggable={false} className="block h-full w-full rounded-md" />}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${img.width} ${img.height}`} preserveAspectRatio="none">
            <polygon
              points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(59,130,246,0.15)"
              stroke="#3B82F6"
              strokeWidth={Math.max(img.width, img.height) / 300}
            />
          </svg>
          {quad.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-label={['Top-left corner', 'Top-right corner', 'Bottom-right corner', 'Bottom-left corner'][i]}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md touch-none"
              style={{ ...pct(p), width: HANDLE, height: HANDLE }}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                setDrag(i);
              }}
            />
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={rotate} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
          <RotateCw className="h-3.5 w-3.5" /> Rotate
        </button>
        <button type="button" onClick={() => setQuad(defaultQuad(img.width, img.height))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
          <Undo2 className="h-3.5 w-3.5" /> Reset
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button type="button" onClick={apply} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <Check className="h-3.5 w-3.5" /> Use this
        </button>
      </div>
    </div>
  );
}
