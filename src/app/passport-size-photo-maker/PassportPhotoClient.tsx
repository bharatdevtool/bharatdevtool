'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Download, FileImage, ImageUp, Loader2, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { loadImageCanvas } from '@/lib/image/perspective';
import {
  BACKGROUNDS,
  PASSPORT_PHOTO as SPEC,
  defaultFrame,
  estimateHead,
  frameForHead,
  headFromFace,
  type BackgroundId,
  type Frame,
  type HeadBox,
} from '@/lib/image/passport';
import { PhotoModels, cutoutCanvas, drawFrame, jpegUnder, renderPhoto } from '@/lib/image/passportBrowser';
import { mmToPx, photoSheet } from '@/lib/print/sheet';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import { reportError } from '@/lib/monitoring/errorReporting';

const OUT_W = mmToPx(SPEC.w); // 413 px = 35 mm at 300 DPI
const OUT_H = mmToPx(SPEC.h); // 531 px = 45 mm
const PREVIEW_W = 350;
const PREVIEW_H = Math.round((PREVIEW_W * SPEC.h) / SPEC.w);

const SIZE_LIMITS = [
  { id: 'best', label: 'Best quality', bytes: null },
  { id: '100kb', label: 'Under 100 KB', bytes: 100 * 1024 },
  { id: '50kb', label: 'Under 50 KB', bytes: 50 * 1024 },
  { id: '20kb', label: 'Under 20 KB', bytes: 20 * 1024 },
] as const;

const PAPERS = [
  { id: '4x6', label: '4×6 in photo paper', note: '8 photos, for a photo lab or photo printer' },
  { id: 'a4', label: 'A4 sheet', note: '25 photos with cut lines' },
] as const;
type PaperChoice = (typeof PAPERS)[number]['id'];

interface Photo {
  source: HTMLCanvasElement;
  alpha: Float32Array;
  auto: Frame;
  head: HeadBox | null;
  faceFound: boolean;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0);

export default function PassportPhotoClient() {
  const [stage, setStage] = useState<'empty' | 'busy' | 'edit'>('empty');
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [background, setBackground] = useState<BackgroundId>('white');
  const [guides, setGuides] = useState(true);
  const [limit, setLimit] = useState<(typeof SIZE_LIMITS)[number]['id']>('best');
  const [paper, setPaper] = useState<PaperChoice>('4x6');
  const [copies, setCopies] = useState(8);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const modelsRef = useRef<PhotoModels | null>(null);
  const dragRef = useRef<{ x: number; y: number; frame: Frame } | null>(null);

  useEffect(() => () => modelsRef.current?.dispose(), []);

  const rgb = BACKGROUNDS[background].rgb;
  // The person on the chosen colour, at full size: redone only when the photo or colour changes.
  const cutout = useMemo(() => (photo ? cutoutCanvas(photo.source, photo.alpha, rgb) : null), [photo, rgb]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (canvas && cutout && frame) drawFrame(canvas, cutout, frame, rgb);
  }, [cutout, frame, rgb]);

  const capacity = useMemo(() => photoSheet({ paper }).capacity, [paper]);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setError('Choose a photo (JPG, PNG or WebP).');
      return;
    }
    setError(null);
    setStage('busy');
    setStep('Opening the photo…');
    try {
      let source: HTMLCanvasElement;
      try {
        source = await loadImageCanvas(file, 2000);
      } catch {
        throw new Error('open');
      }
      if (!modelsRef.current) modelsRef.current = new PhotoModels((loaded, total) => setProgress({ loaded, total }));
      const models = modelsRef.current;
      setStep('Loading the AI model…');
      await models.load();
      setProgress(null);
      setStep('Removing the background…');
      const alpha = await models.matte(source);
      setStep('Finding the face…');
      const face = await models.face(source);
      const head = face ? headFromFace(face, alpha, source.width, source.height) : estimateHead(alpha, source.width, source.height);
      const auto = head ? frameForHead(head) : defaultFrame(source.width, source.height);
      setPhoto({ source, alpha, auto, head, faceFound: !!face });
      setFrame(auto);
      setStage('edit');
    } catch (err) {
      setProgress(null);
      const opening = err instanceof Error && err.message === 'open';
      if (!opening) reportError(err, { tool: 'passport-photo-maker', stage: 'process' });
      setStage(photo ? 'edit' : 'empty');
      setError(
        opening
          ? 'This photo could not be opened. Try a JPG or PNG (on iPhone, a screenshot of the photo works).'
          : 'The background could not be removed in this browser. Check your connection for the first-time download and try again, or use the latest Chrome, Edge, Safari or Firefox.',
      );
    }
  };

  // ── Moving and zooming the photo inside the frame ────────────────────────────
  const zoom = photo && frame ? photo.auto.w / frame.w : 1;
  const setZoom = (z: number) => {
    if (!photo || !frame) return;
    const w = photo.auto.w / z;
    const h = (w * SPEC.h) / SPEC.w;
    setFrame({ x: frame.x + frame.w / 2 - w / 2, y: frame.y + frame.h / 2 - h / 2, w, h });
  };
  const move = (dx: number, dy: number) => frame && setFrame({ ...frame, x: frame.x + dx, y: frame.y + dy });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!frame) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, frame };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const perPx = d.frame.w / e.currentTarget.getBoundingClientRect().width;
    setFrame({ ...d.frame, x: d.frame.x - (e.clientX - d.x) * perPx, y: d.frame.y - (e.clientY - d.y) * perPx });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!frame) return;
    const step = frame.w * 0.01;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(step, 0),
      ArrowRight: () => move(-step, 0),
      ArrowUp: () => move(0, step),
      ArrowDown: () => move(0, -step),
      '+': () => setZoom(Math.min(2.5, zoom * 1.02)),
      '=': () => setZoom(Math.min(2.5, zoom * 1.02)),
      '-': () => setZoom(Math.max(0.5, zoom / 1.02)),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  // Head height in mm at the current zoom, when the face was found.
  const headMm = photo?.head && photo.faceFound && frame ? (photo.head.height * SPEC.h) / frame.h : null;
  const headOk = headMm !== null && headMm >= SPEC.headMin && headMm <= SPEC.headMax;

  // ── Downloads ────────────────────────────────────────────────────────────────
  const finalPhoto = () => renderPhoto(cutout!, frame!, rgb, OUT_W, OUT_H);

  const downloadPhoto = async () => {
    if (!cutout || !frame) return;
    setSaving(true);
    try {
      const chosen = SIZE_LIMITS.find((s) => s.id === limit)!;
      saveBlob(await jpegUnder(finalPhoto(), chosen.bytes), 'passport-photo-35x45mm.jpg');
      analytics.track(ANALYTICS_EVENTS.PASSPORT_PHOTO, { output: 'photo', background, limit });
    } catch (err) {
      reportError(err, { tool: 'passport-photo-maker', stage: 'photo' });
      setError('The photo could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const downloadSheet = async (kind: 'pdf' | 'jpg') => {
    if (!cutout || !frame) return;
    setSaving(true);
    try {
      const sheet = photoSheet({ paper, count: Math.min(copies, capacity) });
      const one = finalPhoto();
      const name = `passport-photos-${paper}.${kind}`;
      if (kind === 'pdf') {
        const { sheetToPdf } = await import('@/lib/print/output');
        const bytes = new Uint8Array(await (await jpegUnder(one, null)).arrayBuffer());
        const pdf = await sheetToPdf(sheet, sheet.slots.map((rect) => ({ rect, bytes, mime: 'image/jpeg' as const })));
        saveBlob(new Blob([pdf as BlobPart], { type: 'application/pdf' }), name);
      } else {
        const { sheetToCanvas } = await import('@/lib/print/output');
        const page = sheetToCanvas(sheet, sheet.slots.map((rect) => ({ rect, source: one })), 300);
        saveBlob(await jpegUnder(page, null), name);
      }
      analytics.track(ANALYTICS_EVENTS.PASSPORT_PHOTO, { output: `sheet_${kind}`, paper, copies: sheet.slots.length, background });
    } catch (err) {
      reportError(err, { tool: 'passport-photo-maker', stage: 'sheet' });
      setError(`The ${kind === 'pdf' ? 'PDF' : 'image'} could not be made. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setFrame(null);
    setStage('empty');
    setError(null);
  };

  const pickers = (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );

  return (
    <ToolLayout toolId="passport-photo-maker">
      {pickers}
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {stage === 'edit' && photo && frame ? (
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
              {!photo.faceFound && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> No face was found automatically. Drag the photo and use the zoom so the top of the hair and the chin sit on the guide lines.
                </p>
              )}
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div
                  role="application"
                  aria-label="Photo position. Drag, or use the arrow keys to move and + or − to zoom."
                  tabIndex={0}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => (dragRef.current = null)}
                  onPointerCancel={() => (dragRef.current = null)}
                  onKeyDown={onKeyDown}
                  onWheel={(e) => setZoom(Math.min(2.5, Math.max(0.5, zoom * (e.deltaY < 0 ? 1.03 : 1 / 1.03))))}
                  className="relative w-full max-w-[350px] shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-md border border-border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                  style={{ aspectRatio: `${SPEC.w} / ${SPEC.h}` }}
                >
                  <canvas ref={previewRef} width={PREVIEW_W * 2} height={PREVIEW_H * 2} className="block h-full w-full" />
                  {guides && (
                    <svg viewBox={`0 0 ${SPEC.w} ${SPEC.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                      <rect x="0" y={SPEC.crown + SPEC.headMin} width={SPEC.w} height={SPEC.headMax - SPEC.headMin} fill="rgba(16,185,129,0.12)" />
                      <line x1="0" x2={SPEC.w} y1={SPEC.crown} y2={SPEC.crown} stroke="#10B981" strokeWidth="0.18" />
                      <line x1="0" x2={SPEC.w} y1={SPEC.crown + SPEC.head} y2={SPEC.crown + SPEC.head} stroke="#10B981" strokeWidth="0.18" strokeDasharray="0.8 0.5" />
                      <ellipse cx={SPEC.w / 2} cy={SPEC.crown + SPEC.head / 2} rx={SPEC.head * 0.34} ry={SPEC.head / 2} fill="none" stroke="#10B981" strokeOpacity="0.7" strokeWidth="0.15" strokeDasharray="0.6 0.6" />
                      <text x="0.6" y={SPEC.crown - 0.6} fontSize="1.5" fill="#059669">Top of hair</text>
                      <text x="0.6" y={SPEC.crown + SPEC.head - 0.6} fontSize="1.5" fill="#059669">Chin</text>
                    </svg>
                  )}
                </div>

                <div className="w-full min-w-0 space-y-4 text-sm">
                  <p className="text-xs text-muted-foreground">
                    Drag the photo so the top of the hair touches the upper line and the chin sits in the green band. Keep the face centred.
                  </p>
                  {headMm !== null && (
                    <p className={`flex items-center gap-2 text-xs font-medium ${headOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {headOk ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
                      Head height {headMm.toFixed(0)} mm {headOk ? '(within 32–36 mm)' : `(should be ${SPEC.headMin}–${SPEC.headMax} mm: ${headMm > SPEC.headMax ? 'zoom out' : 'zoom in'})`}
                    </p>
                  )}
                  <label className="block text-xs font-medium text-foreground">
                    Zoom
                    <input type="range" min={0.5} max={2.5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 block w-full accent-primary" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setFrame(photo.auto)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary">
                      <RotateCcw className="h-3.5 w-3.5" /> Auto-fit again
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium">
                      <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="accent-primary" /> Show guides
                    </label>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-foreground">Background</span>
                    <div className="flex gap-2">
                      {(Object.keys(BACKGROUNDS) as BackgroundId[]).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setBackground(id)}
                          aria-pressed={background === id}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${background === id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                        >
                          <span className="h-4 w-4 rounded border border-border" style={{ background: `rgb(${BACKGROUNDS[id].rgb.join(',')})` }} />
                          {BACKGROUNDS[id].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <RefreshCw className="h-3.5 w-3.5" /> Use a different photo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void onFile(e.dataTransfer.files?.[0]); }}
              className={`flex min-h-[360px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
            >
              {stage === 'busy' ? (
                <div className="w-full max-w-sm space-y-3" role="status" aria-live="polite">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">{step}</p>
                  {progress && (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        First time only: {mb(progress.loaded)} of {mb(progress.total)} MB. Next time it opens instantly.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <ImageUp className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="mb-1 text-base font-semibold text-foreground">Add a photo of yourself</p>
                  <p className="mb-5 max-w-md text-xs text-muted-foreground">
                    Face the camera with your shoulders in view, in good light. The background becomes plain white and your face is sized to 35×45 mm. The first time, an AI model of about 28 MB downloads once.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                      <ImageUp className="h-4 w-4" /> Choose photo
                    </button>
                    <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-primary">
                      <Camera className="h-4 w-4" /> Take a photo
                    </button>
                  </div>
                  <p className="mt-4 text-[11px] text-muted-foreground">or drop a photo here</p>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Single photo (35×45 mm)</h2>
            <label className="mb-2 block text-xs text-muted-foreground">
              File size, for online forms
              <select value={limit} onChange={(e) => setLimit(e.target.value as typeof limit)} className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground">
                {SIZE_LIMITS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={downloadPhoto}
              disabled={stage !== 'edit' || saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download photo (JPG)
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Print sheet</h2>
            {PAPERS.map((p) => (
              <label key={p.id} className="mb-2 flex cursor-pointer gap-2 rounded-lg border border-border p-2.5 text-xs has-[:checked]:border-primary">
                <input
                  type="radio"
                  name="paper"
                  checked={paper === p.id}
                  onChange={() => {
                    setPaper(p.id);
                    setCopies(photoSheet({ paper: p.id }).capacity);
                  }}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block font-medium text-foreground">{p.label}</span>
                  <span className="text-muted-foreground">{p.note}</span>
                </span>
              </label>
            ))}
            <label className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              Copies
              <select value={Math.min(copies, capacity)} onChange={(e) => setCopies(Number(e.target.value))} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
                {Array.from({ length: capacity }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => downloadSheet('pdf')}
              disabled={stage !== 'edit' || saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button
              type="button"
              onClick={() => downloadSheet('jpg')}
              disabled={stage !== 'edit' || saving}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:border-primary disabled:opacity-50"
            >
              <FileImage className="h-4 w-4" /> Download as JPG (300 DPI)
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Print at 100% (Actual size), not Fit to page. Photo labs print the 4×6 JPG as it is.
            </p>
          </div>

          {stage === 'edit' && (
            <button type="button" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
              Start over
            </button>
          )}
        </aside>
      </div>
    </ToolLayout>
  );
}
