'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  FileArchive, Combine, Scissors, LayoutGrid, FileImage, ImagePlus, Upload, Plus, RotateCw, RotateCcw,
  Trash2, Download, LoaderCircle, Lock, ShieldCheck, X, ArrowRight,
} from 'lucide-react';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PageGrid, { type GridPage } from './PageGrid';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import type { SourceFile, PageRef } from '@/lib/pdf/build';
import { parsePageRanges, formatPageList } from '@/lib/pdf/ranges';
import {
  DEFAULT_IMAGE_OPTIONS, normalizeRotation, isEncryptedError, downloadBytes,
  type ImagePageOptions, type KeepTextLevel,
} from '@/lib/pdf/shared';

/** pdf-lib + pdf.js (~250 KB gz) load on demand, and are prefetched when the browser is idle. */
type Engine = typeof import('@/lib/pdf/engine');
let enginePromise: Promise<Engine> | null = null;
const engine = (): Promise<Engine> => {
  if (!enginePromise) {
    enginePromise = import('@/lib/pdf/engine');
    enginePromise.catch(() => {
      enginePromise = null;
    });
  }
  return enginePromise;
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type PdfTask = 'compress' | 'merge' | 'split' | 'organize' | 'pdf-to-jpg' | 'jpg-to-pdf';

export const TASKS: { id: PdfTask; toolId: string; label: string; icon: React.ReactNode; action: string; hint: string }[] = [
  { id: 'compress', toolId: 'compress-pdf', label: 'Compress', icon: <FileArchive className="h-3.5 w-3.5" />, action: 'Compress PDF', hint: 'Make a PDF smaller, or hit an exact size for a form upload.' },
  { id: 'merge', toolId: 'merge-pdf', label: 'Merge', icon: <Combine className="h-3.5 w-3.5" />, action: 'Merge into one PDF', hint: 'Add PDFs and images, put the pages in order, save one PDF.' },
  { id: 'split', toolId: 'split-pdf', label: 'Split', icon: <Scissors className="h-3.5 w-3.5" />, action: 'Split PDF', hint: 'Pick pages to extract, or split into several files.' },
  { id: 'organize', toolId: 'organize-pdf', label: 'Organize', icon: <LayoutGrid className="h-3.5 w-3.5" />, action: 'Save PDF', hint: 'Drag to reorder, rotate or delete pages, then save.' },
  { id: 'pdf-to-jpg', toolId: 'pdf-to-jpg', label: 'PDF → JPG', icon: <FileImage className="h-3.5 w-3.5" />, action: 'Convert to images', hint: 'Turn PDF pages into JPG or PNG images.' },
  { id: 'jpg-to-pdf', toolId: 'jpg-to-pdf', label: 'JPG → PDF', icon: <ImagePlus className="h-3.5 w-3.5" />, action: 'Create PDF', hint: 'Turn photos and scans into one PDF.' },
];

// ─── Options (remembered between visits) ──────────────────────────────────────

interface Options {
  compressMode: 'keep' | 'target';
  keepLevel: KeepTextLevel;
  targetKb: number;
  splitMode: 'selected' | 'every' | 'ranges';
  imageFormat: 'jpg' | 'png';
  dpi: number;
  image: ImagePageOptions;
}

const DEFAULT_OPTIONS: Options = {
  compressMode: 'keep',
  keepLevel: 'balanced',
  targetKb: 200,
  splitMode: 'selected',
  imageFormat: 'jpg',
  dpi: 150,
  image: DEFAULT_IMAGE_OPTIONS,
};
const OPTIONS_KEY = 'bdt_pdf_options';
const TARGET_PRESETS = [50, 100, 200, 500, 1000];

function loadOptions(): Options {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}');
    return { ...DEFAULT_OPTIONS, ...saved, image: { ...DEFAULT_OPTIONS.image, ...(saved.image || {}) } };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface WorkFile extends SourceFile {
  size: number;
  pageCount: number;
}
interface PageItem extends PageRef {
  key: string;
  thumb?: string;
}
interface LockedFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  wrong: boolean;
}
interface Output {
  name: string;
  bytes: Uint8Array;
  type: string;
  /** A single PDF that can be fed back in as input. */
  reusable: boolean;
}
interface Result {
  outputs: Output[];
  inputBytes: number;
  note?: string;
}

let idCounter = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(idCounter++).toString(36)}`;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^\w\-. ]+/g, '').trim().slice(0, 60) || 'document';

const errorKind = (err: unknown) => (err instanceof Error ? err.name : 'Error');

// ─── Component ────────────────────────────────────────────────────────────────

export default function PdfWorkspace({ task, onTaskChange }: { task: PdfTask; onTaskChange: (t: PdfTask) => void }) {
  const [files, setFiles] = useState<Map<string, WorkFile>>(new Map());
  const [pages, setPages] = useState<PageItem[]>([]);
  const [locked, setLocked] = useState<LockedFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Options UI only renders once files are added (never during prerender), so reading storage here can't cause a hydration mismatch.
  const [options, setOptions] = useState<Options>(() => (typeof window === 'undefined' ? DEFAULT_OPTIONS : loadOptions()));
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const docs = useRef(new Map<string, PDFDocumentProxy>());
  const lastClicked = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const taskInfo = TASKS.find((t) => t.id === task)!;

  const updateOptions = (patch: Partial<Options>) =>
    setOptions((o) => {
      const next = { ...o, ...patch };
      try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });

  // Switch task in place: keep the files, update the address bar to that task's own page.
  const switchTask = (next: PdfTask) => {
    onTaskChange(next);
    setResult(null);
    setError('');
    const route = `/tools/${TASKS.find((t) => t.id === next)!.toolId}`;
    if (window.location.pathname !== route) window.history.replaceState(null, '', route);
  };

  // Prefetch the PDF engine once the page is idle, so it is ready before the first file is dropped.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const start = () => void engine().catch(() => {});
    if (w.requestIdleCallback) w.requestIdleCallback(start);
    else setTimeout(start, 1500);
  }, []);

  // Free pdf.js documents and thumbnails when leaving the page.
  useEffect(() => {
    const openDocs = docs.current;
    return () => {
      openDocs.forEach((d) => d.loadingTask.destroy());
      pagesRef.current.forEach((p) => p.thumb && URL.revokeObjectURL(p.thumb));
    };
  }, []);

  // ─── Adding files ───────────────────────────────────────────────────────────

  const renderThumbs = useCallback(async (fileId: string, doc: PDFDocumentProxy) => {
    const { renderThumbnail } = await engine();
    for (let i = 0; i < doc.numPages; i++) {
      if (!docs.current.has(fileId)) return; // file was removed
      try {
        const url = await renderThumbnail(doc, i);
        setPages((ps) => ps.map((p) => (p.fileId === fileId && p.index === i && !p.thumb ? { ...p, thumb: url } : p)));
      } catch {
        /* a page that fails to render still works for building */
      }
    }
  }, []);

  /** Add an unlocked PDF (bytes + optional password) to the workspace. */
  const addPdf = useCallback(async (id: string, name: string, bytes: Uint8Array, password?: string) => {
    const { loadPdf, openPdf } = await engine();
    const src: SourceFile = { id, name, kind: 'pdf', bytes, password };
    await loadPdf(src); // throws EncryptedPdfError if a password is needed
    const pdfjs = await openPdf(bytes, password);
    docs.current.set(id, pdfjs);
    const wf: WorkFile = { ...src, size: bytes.length, pageCount: pdfjs.numPages };
    setFiles((m) => new Map(m).set(id, wf));
    setPages((ps) => [...ps, ...Array.from({ length: pdfjs.numPages }, (_, i) => ({ key: `${id}:${i}`, fileId: id, index: i, rotation: 0 }))]);
    renderThumbs(id, pdfjs);
  }, [renderThumbs]);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (!incoming.length) return;
    setError('');
    setResult(null);
    const problems: string[] = [];
    let pdfCount = 0;
    let imageCount = 0;
    setBusy('Opening files…');
    for (const f of incoming) {
      const id = newId('f');
      try {
        if (isPdf(f)) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          try {
            await addPdf(id, f.name, bytes);
            pdfCount++;
          } catch (err) {
            if (isEncryptedError(err)) setLocked((l) => [...l, { id, name: f.name, bytes, wrong: false }]);
            else throw err;
          }
        } else if (isImage(f)) {
          const img = await (await engine()).toEmbeddableImage(f);
          const wf: WorkFile = { id, name: f.name, kind: 'image', bytes: img.bytes, mime: img.mime, size: f.size, pageCount: 1 };
          setFiles((m) => new Map(m).set(id, wf));
          setPages((ps) => [...ps, { key: `${id}:0`, fileId: id, index: 0, rotation: 0, thumb: URL.createObjectURL(f) }]);
          imageCount++;
        } else {
          problems.push(`${f.name}: not a PDF or image.`);
        }
      } catch (err) {
        problems.push(err instanceof Error && err.message.includes(f.name) ? err.message : `${f.name}: could not be opened (the file may be damaged).`);
      }
    }
    setBusy(null);
    if (problems.length) setError(problems.join(' '));
    if (pdfCount + imageCount) analytics.track(ANALYTICS_EVENTS.PDF_FILES_ADDED, { task, pdfs: pdfCount, images: imageCount });
  }, [addPdf, task]);

  const unlock = async (lf: LockedFile, password: string) => {
    try {
      await addPdf(lf.id, lf.name, lf.bytes, password);
      setLocked((l) => l.filter((x) => x.id !== lf.id));
    } catch (err) {
      if (isEncryptedError(err)) {
        setLocked((l) => l.map((x) => (x.id === lf.id ? { ...x, wrong: true } : x)));
      } else {
        setError(`${lf.name}: could not be opened.`);
      }
    }
  };

  // Drop anywhere on the page, or paste files (Cmd/Ctrl+V).
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    const paste = (e: ClipboardEvent) => {
      const fs = e.clipboardData?.files;
      if (fs && fs.length) {
        e.preventDefault();
        addFiles(fs);
      }
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [addFiles]);

  // ─── Page editing ───────────────────────────────────────────────────────────

  const dropUnusedFiles = (remaining: PageItem[]) => {
    const used = new Set(remaining.map((p) => p.fileId));
    setFiles((m) => {
      const next = new Map(m);
      for (const id of m.keys()) {
        if (!used.has(id)) {
          next.delete(id);
          docs.current.get(id)?.loadingTask.destroy();
          docs.current.delete(id);
        }
      }
      return next;
    });
  };

  const removePages = (keys: Set<string>) => {
    const remaining = pages.filter((p) => !keys.has(p.key));
    pages.forEach((p) => keys.has(p.key) && p.thumb && URL.revokeObjectURL(p.thumb));
    setPages(remaining);
    setSelected((s) => new Set([...s].filter((k) => !keys.has(k))));
    dropUnusedFiles(remaining);
    setResult(null);
  };

  const rotatePages = (keys: Set<string>, by: number) => {
    setPages((ps) => ps.map((p) => (keys.has(p.key) ? { ...p, rotation: normalizeRotation(p.rotation + by) } : p)));
    setResult(null);
  };

  const movePage = (key: string, toIndex: number) => {
    setPages((ps) => {
      const from = ps.findIndex((p) => p.key === key);
      if (from < 0 || toIndex < 0 || toIndex >= ps.length || from === toIndex) return ps;
      const next = [...ps];
      const [item] = next.splice(from, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setResult(null);
  };

  const selectPage = (key: string, { range }: { range: boolean; toggle: boolean }) => {
    setSelected((s) => {
      const next = new Set(s);
      if (range && lastClicked.current) {
        const a = pages.findIndex((p) => p.key === lastClicked.current);
        const b = pages.findIndex((p) => p.key === key);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(pages[i].key);
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    lastClicked.current = key;
  };

  const clearAll = () => {
    pages.forEach((p) => p.thumb && URL.revokeObjectURL(p.thumb));
    docs.current.forEach((d) => d.loadingTask.destroy());
    docs.current.clear();
    setFiles(new Map());
    setPages([]);
    setLocked([]);
    setSelected(new Set());
    setResult(null);
    setError('');
  };

  // Keyboard: Delete removes, R rotates, Cmd/Ctrl+A selects all pages, Esc clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]') || busy || !pages.length) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
        e.preventDefault();
        removePages(new Set(selected));
      } else if ((e.key === 'r' || e.key === 'R') && selected.size && !e.metaKey && !e.ctrlKey) {
        rotatePages(new Set(selected), e.shiftKey ? -90 : 90);
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelected(new Set(pages.map((p) => p.key)));
      } else if (e.key === 'Escape') {
        setSelected(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ─── Running a task ─────────────────────────────────────────────────────────

  const pdfPages = pages.filter((p) => files.get(p.fileId)?.kind === 'pdf');
  const imagePages = pages.length - pdfPages.length;
  const selectedPages = pages.filter((p) => selected.has(p.key));
  const firstName = baseName(files.values().next().value?.name ?? 'document');
  const inputBytes = useMemo(() => [...files.values()].reduce((n, f) => n + f.size, 0), [files]);

  const build = async (list: PageItem[], onProgress?: (d: number, t: number) => void) =>
    (await engine()).buildPdf(files, list.map(({ fileId, index, rotation }) => ({ fileId, index, rotation })), options.image, onProgress);

  const run = async () => {
    const { makeZip, compressKeepText, KEEP_TEXT_LEVELS, canvasReencoder, openPdf, compressToTarget, makeRasterizer, renderPage, canvasToBytes } =
      await engine();
    setError('');
    setResult(null);
    const outputs: Output[] = [];
    let note: string | undefined;
    const pdf = (name: string, bytes: Uint8Array, reusable = true): Output => ({ name, bytes, type: 'application/pdf', reusable });

    try {
      if (task === 'merge' || task === 'organize' || task === 'jpg-to-pdf') {
        setBusy('Building PDF…');
        const bytes = await build(pages, (d, t) => setBusy(`Building PDF… page ${d} of ${t}`));
        const name = task === 'merge' && files.size > 1 ? 'merged.pdf' : task === 'jpg-to-pdf' ? `${files.size > 1 ? 'images' : firstName}.pdf` : `${firstName}-organized.pdf`;
        outputs.push(pdf(name, bytes));
      } else if (task === 'split') {
        if (options.splitMode === 'selected') {
          if (!selectedPages.length) throw new UserError('Select the pages to extract first (click the thumbnails).');
          setBusy('Extracting pages…');
          const label = formatPageList(selectedPages.map((p) => pages.indexOf(p))).replace(/, /g, '_');
          outputs.push(pdf(`${firstName}-pages-${label}.pdf`, await build(selectedPages)));
        } else {
          const groups = options.splitMode === 'every'
            ? pages.map((_, i) => [i])
            : (() => {
                const r = parsePageRanges(ranges, pages.length);
                if (!r.ok) throw new UserError(r.error);
                return r.groups;
              })();
          const parts: Output[] = [];
          for (let g = 0; g < groups.length; g++) {
            setBusy(`Splitting… file ${g + 1} of ${groups.length}`);
            const label = formatPageList(groups[g]).replace(/, /g, '_');
            parts.push(pdf(`${firstName}-${groups[g].length === 1 ? 'page' : 'pages'}-${label}.pdf`, await build(groups[g].map((i) => pages[i]))));
          }
          if (parts.length === 1) outputs.push(parts[0]);
          else outputs.push({ name: `${firstName}-split.zip`, bytes: makeZip(parts), type: 'application/zip', reusable: false });
          note = parts.length > 1 ? `${parts.length} PDFs in one ZIP.` : undefined;
        }
      } else if (task === 'compress') {
        setBusy('Preparing…');
        const combined = await build(pages);
        if (options.compressMode === 'keep') {
          const { bytes, stats } = await compressKeepText(combined, KEEP_TEXT_LEVELS[options.keepLevel], canvasReencoder, (d, t) => setBusy(`Compressing images… ${d} of ${t}`));
          outputs.push(pdf(`${firstName}-compressed.pdf`, bytes));
          if (!stats.imagesFound) note = 'This PDF has no photos to shrink, so "Keep text" can only save a little. Try "Exact size" for a much smaller file.';
          else if (bytes.length >= inputBytes * 0.95) note = 'The photos in this PDF are already well compressed. Try a stronger level or "Exact size".';
        } else {
          const target = Math.max(10, options.targetKb) * 1024;
          const doc = await openPdf(combined);
          try {
            const r = await compressToTarget(target, makeRasterizer(doc), (step) => setBusy(`Compressing… ${step}`), combined);
            outputs.push(pdf(`${firstName}-${options.targetKb}kb.pdf`, r.bytes));
            note = r.alreadySmallEnough
              ? `Already under ${options.targetKb} KB, so nothing was changed and the text stays selectable.`
              : r.reachedTarget
              ? `Fits under ${options.targetKb} KB at about ${Math.round(r.scale * 72)} DPI.`
              : `Could not get under ${options.targetKb} KB; this is the smallest readable version. Remove pages or choose a larger size.`;
          } finally {
            doc.loadingTask.destroy();
          }
        }
      } else if (task === 'pdf-to-jpg') {
        const list = (selectedPages.length ? selectedPages : pages).filter((p) => files.get(p.fileId)?.kind === 'pdf');
        if (!list.length) throw new UserError('Add a PDF first.');
        const ext = options.imageFormat;
        const images: Output[] = [];
        for (let i = 0; i < list.length; i++) {
          setBusy(`Converting page ${i + 1} of ${list.length}…`);
          const p = list[i];
          const canvas = await renderPage(docs.current.get(p.fileId)!, p.index, options.dpi / 72, p.rotation);
          const bytes = await canvasToBytes(canvas, ext === 'png' ? 'image/png' : 'image/jpeg', 0.9);
          images.push({ name: `${baseName(files.get(p.fileId)!.name)}-page-${p.index + 1}.${ext}`, bytes, type: `image/${ext === 'png' ? 'png' : 'jpeg'}`, reusable: false });
          canvas.width = canvas.height = 0; // free memory early
        }
        if (images.length === 1) outputs.push(images[0]);
        else outputs.push({ name: `${firstName}-images.zip`, bytes: makeZip(images), type: 'application/zip', reusable: false });
        note = images.length > 1 ? `${images.length} images in one ZIP.` : undefined;
      }

      setResult({ outputs, inputBytes, note });
      analytics.track(ANALYTICS_EVENTS.PDF_EXPORT, {
        task,
        pages: pages.length,
        files: files.size,
        outputs: outputs.length,
        mode: task === 'compress' ? options.compressMode : task === 'split' ? options.splitMode : 'default',
      });
    } catch (err) {
      setError(err instanceof UserError ? err.message : 'Something went wrong while creating the file. Try again, or with fewer pages.');
      if (!(err instanceof UserError)) {
        analytics.track(ANALYTICS_EVENTS.PDF_EXPORT_FAILED, { task, error_type: errorKind(err) });
        console.error(err);
      }
    } finally {
      setBusy(null);
    }
  };

  /** Replace the workspace with the result, e.g. merge → then compress. */
  const useResultAsInput = async (out: Output, nextTask?: PdfTask) => {
    clearAll();
    if (nextTask) switchTask(nextTask);
    await addPdf(newId('f'), out.name, out.bytes);
  };

  const canRun = !busy && pages.length > 0 && (task !== 'pdf-to-jpg' || pdfPages.length > 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs tabs={TASKS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))} activeTab={task} onChange={switchTask} />
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Files never leave your device. No limits.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{taskInfo.hint}</p>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={task === 'jpg-to-pdf' ? 'image/*,.pdf' : '.pdf,application/pdf,image/*'}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-[2px]">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-card px-8 py-6 text-lg font-semibold text-primary shadow-xl">Drop to add files</div>
        </div>
      )}

      {locked.map((lf) => (
        <LockedRow key={lf.id} file={lf} onUnlock={(pw) => unlock(lf, pw)} onRemove={() => setLocked((l) => l.filter((x) => x.id !== lf.id))} />
      ))}

      {!pages.length ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-14 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="rounded-full bg-primary/10 p-4 text-primary">
            <Upload className="h-7 w-7" />
          </span>
          <span className="text-base font-semibold text-foreground">
            {task === 'jpg-to-pdf' ? 'Choose images' : 'Choose PDF files'}
          </span>
          <span className="text-sm text-muted-foreground">
            or drop them anywhere on this page, or paste with Ctrl/⌘+V.
            {task !== 'jpg-to-pdf' ? ' Images work too.' : ' PDFs work too.'}
          </span>
        </button>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
            <ToolbarBtn onClick={() => fileInput.current?.click()} icon={<Plus className="h-4 w-4" />}>Add files</ToolbarBtn>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
            <ToolbarBtn onClick={() => setSelected(selected.size === pages.length ? new Set() : new Set(pages.map((p) => p.key)))}>
              {selected.size === pages.length ? 'Select none' : 'Select all'}
            </ToolbarBtn>
            <ToolbarBtn disabled={!selected.size} onClick={() => rotatePages(new Set(selected), -90)} icon={<RotateCcw className="h-4 w-4" />} label="Rotate selected left" />
            <ToolbarBtn disabled={!selected.size} onClick={() => rotatePages(new Set(selected), 90)} icon={<RotateCw className="h-4 w-4" />} label="Rotate selected right" />
            <ToolbarBtn disabled={!selected.size} onClick={() => removePages(new Set(selected))} icon={<Trash2 className="h-4 w-4" />} label="Delete selected" danger />
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {pages.length} page{pages.length === 1 ? '' : 's'}
              {selected.size ? ` · ${selected.size} selected` : ''} · {formatBytes(inputBytes)}
            </span>
            <ToolbarBtn onClick={clearAll} icon={<X className="h-4 w-4" />}>Clear</ToolbarBtn>
          </div>

          <PageGrid
            pages={pages.map<GridPage>((p) => {
              const f = files.get(p.fileId);
              return {
                key: p.key,
                thumb: p.thumb,
                rotation: p.rotation,
                isImage: f?.kind === 'image',
                label: f?.kind === 'image' ? `Image ${f.name}` : `Page ${p.index + 1} of ${f?.name ?? 'PDF'}`,
              };
            })}
            selected={selected}
            onSelect={selectPage}
            onRotate={(k) => rotatePages(new Set([k]), 90)}
            onDelete={(k) => removePages(new Set([k]))}
            onMove={movePage}
          />
        </>
      )}

      {/* Options + action */}
      {pages.length > 0 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <TaskOptions
            task={task}
            options={options}
            update={updateOptions}
            ranges={ranges}
            setRanges={setRanges}
            selectedCount={selected.size}
            fileCount={files.size}
            imagePages={imagePages}
            pdfPages={pdfPages.length}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : taskInfo.icon}
              {taskInfo.action}
            </button>
            {busy && <span className="text-sm text-muted-foreground" aria-live="polite">{busy}</span>}
          </div>
        </div>
      )}

      {busy && !pages.length && <p className="text-sm text-muted-foreground" aria-live="polite">{busy}</p>}
      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {result && (
        <ResultPanel
          result={result}
          task={task}
          onDownload={(o) => downloadBytes(o.bytes, o.name, o.type)}
          onReuse={useResultAsInput}
        />
      )}
    </div>
  );
}

class UserError extends Error {}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function ToolbarBtn({
  children, icon, onClick, disabled, label, danger,
}: { children?: React.ReactNode; icon?: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        danger ? 'text-red-600 hover:bg-red-500/10 dark:text-red-400' : 'text-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Choice<T extends string | number>({ value, current, onPick, children }: { value: T; current: T; onPick: (v: T) => void; children: React.ReactNode }) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/50'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-28 shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function TaskOptions({
  task, options, update, ranges, setRanges, selectedCount, fileCount, imagePages, pdfPages,
}: {
  task: PdfTask; options: Options; update: (p: Partial<Options>) => void; ranges: string; setRanges: (s: string) => void;
  selectedCount: number; fileCount: number; imagePages: number; pdfPages: number;
}) {
  const img = options.image;
  const setImg = (p: Partial<ImagePageOptions>) => update({ image: { ...img, ...p } });
  const showImageOptions = imagePages > 0 && task !== 'pdf-to-jpg';

  return (
    <div className="space-y-3">
      {task === 'compress' && (
        <>
          <Row label="Mode">
            <Choice value="keep" current={options.compressMode} onPick={(v) => update({ compressMode: v })}>Keep text (recommended)</Choice>
            <Choice value="target" current={options.compressMode} onPick={(v) => update({ compressMode: v })}>Exact size (KB)</Choice>
          </Row>
          {options.compressMode === 'keep' ? (
            <Row label="Strength">
              <Choice value="light" current={options.keepLevel} onPick={(v) => update({ keepLevel: v })}>Light</Choice>
              <Choice value="balanced" current={options.keepLevel} onPick={(v) => update({ keepLevel: v })}>Balanced</Choice>
              <Choice value="strong" current={options.keepLevel} onPick={(v) => update({ keepLevel: v })}>Strong</Choice>
            </Row>
          ) : (
            <Row label="Max size">
              {TARGET_PRESETS.map((kb) => (
                <Choice key={kb} value={kb} current={options.targetKb} onPick={(v) => update({ targetKb: v })}>
                  {kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`}
                </Choice>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                or
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={options.targetKb}
                  onChange={(e) => update({ targetKb: Math.max(10, Number(e.target.value) || 0) })}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-foreground"
                  aria-label="Maximum size in KB"
                />
                KB
              </label>
            </Row>
          )}
          <p className="text-xs text-muted-foreground">
            {options.compressMode === 'keep'
              ? 'Shrinks the photos inside the PDF. Text stays sharp, selectable and searchable.'
              : 'Turns pages into images to fit the size you need, for exam and government form uploads. Text can no longer be selected.'}
            {fileCount > 1 ? ' All files are combined into one PDF; add one file at a time to compress them separately.' : ''}
          </p>
        </>
      )}

      {task === 'split' && (
        <>
          <Row label="Split into">
            <Choice value="selected" current={options.splitMode} onPick={(v) => update({ splitMode: v })}>Selected pages → one PDF</Choice>
            <Choice value="every" current={options.splitMode} onPick={(v) => update({ splitMode: v })}>Every page → separate PDFs</Choice>
            <Choice value="ranges" current={options.splitMode} onPick={(v) => update({ splitMode: v })}>Custom ranges</Choice>
          </Row>
          {options.splitMode === 'ranges' && (
            <Row label="Ranges">
              <input
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="1-3, 4-6, 7-"
                className="w-56 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
                aria-label="Page ranges, one PDF per range"
              />
              <span className="text-xs text-muted-foreground">One PDF per range. Page numbers as shown under the thumbnails.</span>
            </Row>
          )}
          {options.splitMode === 'selected' && (
            <p className="text-xs text-muted-foreground">
              {selectedCount ? `${selectedCount} page${selectedCount === 1 ? '' : 's'} selected.` : 'Click thumbnails to select pages. Shift-click selects a range.'}
            </p>
          )}
        </>
      )}

      {task === 'pdf-to-jpg' && (
        <>
          <Row label="Format">
            <Choice value="jpg" current={options.imageFormat} onPick={(v) => update({ imageFormat: v })}>JPG (smaller)</Choice>
            <Choice value="png" current={options.imageFormat} onPick={(v) => update({ imageFormat: v })}>PNG (lossless)</Choice>
          </Row>
          <Row label="Quality">
            <Choice value={72} current={options.dpi} onPick={(v) => update({ dpi: v })}>72 DPI · small</Choice>
            <Choice value={150} current={options.dpi} onPick={(v) => update({ dpi: v })}>150 DPI · screen</Choice>
            <Choice value={300} current={options.dpi} onPick={(v) => update({ dpi: v })}>300 DPI · print</Choice>
          </Row>
          <p className="text-xs text-muted-foreground">
            {selectedCount ? `Converts the ${selectedCount} selected page${selectedCount === 1 ? '' : 's'}.` : `Converts all ${pdfPages} PDF page${pdfPages === 1 ? '' : 's'}. Select pages to convert only some.`}
          </p>
        </>
      )}

      {(task === 'merge' || task === 'organize') && (
        <p className="text-xs text-muted-foreground">
          Drag the handle under a page to move it ({'"'}Move{'"'} arrows on phones), click to select, then rotate or delete. Keys: R rotate, Delete remove, {'⌘/Ctrl'}+A select all.
        </p>
      )}

      {showImageOptions && (
        <>
          <Row label="Page size">
            <Choice value="a4" current={img.pageSize} onPick={(v) => setImg({ pageSize: v })}>A4</Choice>
            <Choice value="letter" current={img.pageSize} onPick={(v) => setImg({ pageSize: v })}>Letter</Choice>
            <Choice value="fit" current={img.pageSize} onPick={(v) => setImg({ pageSize: v })}>Fit to image</Choice>
          </Row>
          {img.pageSize !== 'fit' && (
            <Row label="Orientation">
              <Choice value="auto" current={img.orientation} onPick={(v) => setImg({ orientation: v })}>Auto</Choice>
              <Choice value="portrait" current={img.orientation} onPick={(v) => setImg({ orientation: v })}>Portrait</Choice>
              <Choice value="landscape" current={img.orientation} onPick={(v) => setImg({ orientation: v })}>Landscape</Choice>
            </Row>
          )}
          <Row label="Margin">
            <Choice value={0} current={img.margin} onPick={(v) => setImg({ margin: v })}>None</Choice>
            <Choice value={18} current={img.margin} onPick={(v) => setImg({ margin: v })}>Small</Choice>
            <Choice value={36} current={img.margin} onPick={(v) => setImg({ margin: v })}>Large</Choice>
          </Row>
        </>
      )}
    </div>
  );
}

function LockedRow({ file, onUnlock, onRemove }: { file: LockedFile; onUnlock: (pw: string) => void; onRemove: () => void }) {
  const [pw, setPw] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pw) onUnlock(pw);
      }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
    >
      <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold">{file.name}</strong> needs a password to open.
        {file.wrong && <span className="ml-1 text-red-600 dark:text-red-400">That password is not right.</span>}
      </span>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="PDF password"
        autoComplete="off"
        className="w-40 rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground"
        aria-label={`Password for ${file.name}`}
      />
      <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Open</button>
      <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Remove ${file.name}`}>
        <X className="h-4 w-4" />
      </button>
      <span className="basis-full text-xs text-muted-foreground">The password is used only in this tab to open the file. The saved PDF will not need it.</span>
    </form>
  );
}

function ResultPanel({
  result, task, onDownload, onReuse,
}: { result: Result; task: PdfTask; onDownload: (o: Output) => void; onReuse: (o: Output, next?: PdfTask) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4" role="status">
      {result.outputs.map((o) => {
        const change = result.inputBytes ? Math.round((1 - o.bytes.length / result.inputBytes) * 100) : 0;
        return (
          <div key={o.name} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{o.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatBytes(o.bytes.length)}
                {task === 'compress' && result.inputBytes > 0 && (
                  <>
                    {' '}· was {formatBytes(result.inputBytes)} ·{' '}
                    <span className={change > 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}>
                      {change > 0 ? `${change}% smaller` : 'no smaller'}
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDownload(o)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        );
      })}
      {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
      {result.outputs.length === 1 && result.outputs[0].reusable && (
        <div className="flex flex-wrap gap-2 border-t border-emerald-500/20 pt-3 text-xs">
          <span className="text-muted-foreground">Next:</span>
          {task !== 'compress' && (
            <button type="button" onClick={() => onReuse(result.outputs[0], 'compress')} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Compress this result <ArrowRight className="h-3 w-3" />
            </button>
          )}
          <button type="button" onClick={() => onReuse(result.outputs[0], 'organize')} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Edit pages of this result <ArrowRight className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => onReuse(result.outputs[0], 'merge')} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Add more files to it <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
