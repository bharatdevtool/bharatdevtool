'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dancing_Script, Great_Vibes, Caveat } from 'next/font/google';
import { X, Trash2, Upload } from 'lucide-react';
import SegmentedTabs from '@/components/ui/SegmentedTabs';

const dancing = Dancing_Script({ subsets: ['latin'], weight: '600', display: 'swap' });
const vibes = Great_Vibes({ subsets: ['latin'], weight: '400', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: '600', display: 'swap' });
const SCRIPT_FONTS = [
  { id: 'dancing', label: 'Classic', family: dancing.style.fontFamily },
  { id: 'vibes', label: 'Elegant', family: vibes.style.fontFamily },
  { id: 'caveat', label: 'Casual', family: caveat.style.fontFamily },
];
const INKS = ['#111827', '#1d4ed8', '#b91c1c'];
const SAVED_KEY = 'bdt_signatures';
const MAX_SAVED = 3;

export interface SignatureImage {
  bytes: Uint8Array;
  /** width / height */
  aspect: number;
}

function loadSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

/** Crop a canvas to its non-transparent pixels (plus a small margin) and return PNG bytes. */
async function trimToPng(canvas: HTMLCanvasElement): Promise<SignatureImage | null> {
  const ctx = canvas.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const m = 6;
  minX = Math.max(0, minX - m); minY = Math.max(0, minY - m);
  maxX = Math.min(width - 1, maxX + m); maxY = Math.min(height - 1, maxY + m);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), aspect: out.width / out.height };
}

async function dataUrlToSignature(url: string): Promise<SignatureImage> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const aspect = bmp.width / bmp.height;
  bmp.close();
  return { bytes: new Uint8Array(await blob.arrayBuffer()), aspect };
}

function bytesToDataUrl(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
  });
}

export default function SignaturePad({ onDone, onClose }: { onDone: (sig: SignatureImage) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [ink, setInk] = useState(INKS[0]);
  const [typed, setTyped] = useState('');
  const [font, setFont] = useState(SCRIPT_FONTS[0].id);
  const [removeBg, setRemoveBg] = useState(true);
  const [uploaded, setUploaded] = useState<HTMLCanvasElement | null>(null);
  const [remember, setRemember] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => (typeof window === 'undefined' ? [] : loadSaved()));
  const [error, setError] = useState('');
  const drawRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Draw tab ──
  const pos = (e: React.PointerEvent) => {
    const c = drawRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = pos(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = drawRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(drawing.current.x, drawing.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    drawing.current = p;
    setHasInk(true);
  };
  const clearDraw = () => {
    const c = drawRef.current;
    c?.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  // ── Upload tab ──
  const onUpload = async (file: File) => {
    setError('');
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / bmp.width);
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      setUploaded(c);
    } catch {
      setError('This image could not be opened. Use a JPG or PNG photo of your signature.');
    }
  };

  const buildCanvas = (): HTMLCanvasElement | null => {
    if (tab === 'draw') return hasInk ? drawRef.current : null;
    if (tab === 'type') {
      if (!typed.trim()) return null;
      const family = SCRIPT_FONTS.find((f) => f.id === font)!.family;
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d')!;
      ctx.font = `96px ${family}`;
      c.width = Math.ceil(ctx.measureText(typed).width + 40);
      c.height = 150;
      ctx.font = `96px ${family}`;
      ctx.fillStyle = ink;
      ctx.textBaseline = 'middle';
      ctx.fillText(typed, 20, 78);
      return c;
    }
    if (!uploaded) return null;
    const c = document.createElement('canvas');
    c.width = uploaded.width;
    c.height = uploaded.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(uploaded, 0, 0);
    if (removeBg) {
      // Paper → transparent: light pixels fade out, ink keeps its colour.
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i + 3] = lum > 200 ? 0 : lum > 150 ? Math.round(((200 - lum) / 50) * 255) : 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    return c;
  };

  const done = async () => {
    const c = buildCanvas();
    const sig = c ? await trimToPng(c) : null;
    if (!sig) {
      setError(tab === 'draw' ? 'Draw your signature first.' : tab === 'type' ? 'Type your name first.' : 'Choose an image first.');
      return;
    }
    if (remember) {
      try {
        const url = await bytesToDataUrl(sig.bytes);
        const next = [url, ...saved.filter((s) => s !== url)].slice(0, MAX_SAVED);
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch { /* storage full or blocked */ }
    }
    onDone(sig);
  };

  const removeSaved = (url: string) => {
    const next = saved.filter((s) => s !== url);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Add a signature" onClick={onClose}>
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add your signature</h2>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {saved.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Saved on this device</p>
            <div className="flex flex-wrap gap-2">
              {saved.map((url) => (
                <div key={url} className="group relative">
                  <button type="button" onClick={async () => onDone(await dataUrlToSignature(url))} className="h-14 rounded-lg border border-border bg-white px-2 hover:border-primary" aria-label="Use saved signature">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-auto object-contain" />
                  </button>
                  <button type="button" onClick={() => removeSaved(url)} className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-card p-0.5 text-red-500 shadow group-hover:block" aria-label="Forget this signature">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <SegmentedTabs
          tabs={[{ id: 'draw', label: 'Draw' }, { id: 'type', label: 'Type' }, { id: 'upload', label: 'Upload' }]}
          activeTab={tab}
          onChange={(t) => { setTab(t); setError(''); }}
          size="sm"
        />

        {tab !== 'upload' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ink</span>
            {INKS.map((c) => (
              <button key={c} type="button" onClick={() => setInk(c)} aria-label={`Ink colour ${c}`} aria-pressed={ink === c}
                className={`h-6 w-6 rounded-full border-2 ${ink === c ? 'border-primary' : 'border-transparent'}`} style={{ background: c }} />
            ))}
          </div>
        )}

        {tab === 'draw' && (
          <div className="space-y-2">
            <canvas
              ref={drawRef}
              width={1200}
              height={400}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={() => (drawing.current = null)}
              onPointerCancel={() => (drawing.current = null)}
              className="h-40 w-full touch-none rounded-lg border border-dashed border-border bg-white"
              aria-label="Draw your signature here"
            />
            <button type="button" onClick={clearDraw} className="text-xs font-medium text-primary hover:underline">Clear</button>
          </div>
        )}

        {tab === 'type' && (
          <div className="space-y-3">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your name" autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" aria-label="Your name" />
            <div className="grid grid-cols-3 gap-2">
              {SCRIPT_FONTS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFont(f.id)} aria-pressed={font === f.id}
                  className={`truncate rounded-lg border bg-white px-2 py-3 text-2xl text-gray-900 ${font === f.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                  style={{ fontFamily: f.family, color: ink }}>
                  {typed || 'Signature'}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div className="space-y-2">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground hover:border-primary">
              {uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploaded.toDataURL()} alt="Uploaded signature" className="max-h-28 bg-white" />
              ) : (
                <><Upload className="h-5 w-5" /> Photo or scan of your signature on white paper</>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} className="accent-primary" />
              Remove the white paper background
            </label>
          </div>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary" />
            Remember on this device (stored only in this browser)
          </label>
          <button type="button" onClick={done} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Use signature
          </button>
        </div>
      </div>
    </div>
  );
}
