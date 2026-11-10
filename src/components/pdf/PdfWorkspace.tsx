'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  Upload, Plus, RotateCw, RotateCcw, Trash2, Download, LoaderCircle, Lock, ShieldCheck, X, ArrowRight,
  Eye, EyeOff, FileLock2, CircleCheck, Hourglass, ShieldPlus, FilePlus2, Send,
} from 'lucide-react';
import PageEditor, { type UIObject, type FindRequest, type FindSummary } from './PageEditor';
import SecureViewer from './SecureViewer';
import { LivePreview, ResultView, type BeforeSource, type LivePreviewResult } from './PdfPreview';
import { Check, Field, OptionCards, Segmented, inputCls } from './controls';
import { engine } from './engine-loader';
import { fontBytesFor } from './font-loader';
import { isStandardFont } from '@/lib/pdf/fonts';
import { EDITOR_TASKS, taskInfo, type PdfTask } from './tasks';
import { loadShareSheet } from '@/components/ui/ShareButton';
import type { FormFieldInfo } from '@/lib/pdf/overlay';
import { DEFAULT_PAGE_NUMBERS, WATERMARK_PRESETS, fillWatermarkTemplate, type PageNumberOptions, type WatermarkLayout } from '@/lib/pdf/options';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PageGrid, { type GridPage } from './PageGrid';
import { analytics } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring/errorReporting';
import { ANALYTICS_EVENTS, SITE } from '@/config/site';
import type { SourceFile, PageRef } from '@/lib/pdf/build';
import { parsePageRanges, formatPageList } from '@/lib/pdf/ranges';
import { formatExpiry, passwordProblem, passwordStrength, ownerPasswordProblem, ALL_PERMISSIONS, PERMISSION_LABELS, type PdfEncryption, type PdfPermissions } from '@/lib/pdf/options';
import {
  DEFAULT_IMAGE_OPTIONS, normalizeRotation, isEncryptedError, downloadBytes,
  type ImagePageOptions, type KeepTextLevel,
} from '@/lib/pdf/shared';

export type { PdfTask } from './tasks';

/** Tasks whose result has the same pages as the input, so "Original / Result" can be compared. */
const COMPARABLE_TASKS: PdfTask[] = ['compress', 'grayscale', 'watermark', 'page-numbers', 'edit', 'sign', 'redact'];

// ─── Options (remembered between visits) ──────────────────────────────────────

interface Options {
  compressMode: 'keep' | 'target';
  keepLevel: KeepTextLevel;
  targetKb: number;
  splitMode: 'selected' | 'every' | 'ranges';
  imageFormat: 'jpg' | 'png' | 'webp';
  compressSeparately: boolean;
  grayDpi: number;
  watermark: { preset: string; layout: WatermarkLayout; size: number; color: string; opacity: number; bold: boolean; permanent: boolean };
  pageNumbers: PageNumberOptions;
  shareExpiry: '1h' | '1d' | '7d' | '30d' | 'custom';
  dpi: number;
  image: ImagePageOptions;
  /** Protect PDF: what readers may do, and the encryption. */
  permissions: PdfPermissions;
  encryption: PdfEncryption;
  /** Share with expiry: recipient may print; pages carry a watermark. */
  shareAllowPrint: boolean;
  shareWatermark: boolean;
}

const DEFAULT_OPTIONS: Options = {
  compressMode: 'keep',
  keepLevel: 'balanced',
  targetKb: 200,
  splitMode: 'selected',
  imageFormat: 'jpg',
  dpi: 150,
  image: DEFAULT_IMAGE_OPTIONS,
  permissions: { ...ALL_PERMISSIONS, modify: false, comment: false, assemble: false },
  encryption: 'AES-256',
  shareAllowPrint: false,
  shareWatermark: true,
  compressSeparately: false,
  grayDpi: 150,
  watermark: { preset: 'kyc', layout: 'diagonal', size: 36, color: '#dc2626', opacity: 0.25, bold: true, permanent: false },
  pageNumbers: DEFAULT_PAGE_NUMBERS,
  shareExpiry: '1d',
};
const EXPIRY_MS: Record<Exclude<Options['shareExpiry'], 'custom'>, number> = { '1h': 3600e3, '1d': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };
/** Expiry time for the chosen option (NaN for an unset custom date, unless `fallbackNow`). */
function shareExpiresAt(choice: Options['shareExpiry'], custom: string, fallbackNow = false): number {
  const t = choice === 'custom' ? Date.parse(custom) : Date.now() + EXPIRY_MS[choice];
  return Number.isFinite(t) || !fallbackNow ? t : Date.now();
}
/**
 * The recipient page (/open) on the site that made the file: bharatdevtool.com in production,
 * or the local / preview server while testing, so the link on the cover always works there.
 */
const openUrl = () => `${typeof window === 'undefined' ? SITE.url : window.location.origin}/open`;
const todayLabel = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const OPTIONS_KEY = 'bdt_pdf_options';
const TARGET_PRESETS = [50, 100, 200, 500, 1000];

function loadOptions(): Options {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}');
    return {
      ...DEFAULT_OPTIONS,
      ...saved,
      image: { ...DEFAULT_OPTIONS.image, ...(saved.image || {}) },
      watermark: { ...DEFAULT_OPTIONS.watermark, ...(saved.watermark || {}) },
      pageNumbers: { ...DEFAULT_OPTIONS.pageNumbers, ...(saved.pageNumbers || {}) },
      permissions: { ...DEFAULT_OPTIONS.permissions, ...(saved.permissions || {}) },
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface WorkFile extends SourceFile {
  size: number;
  pageCount: number;
  /** Had a password or print/copy restrictions when added. */
  encrypted: boolean;
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
  /** The separate files inside a ZIP output, for the preview. */
  previews?: Output[];
}

let idCounter = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(idCounter++).toString(36)}`;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);
const isShareFile = (f: File) => /\.bdtpdf$/i.test(f.name);
/** Safe output name: keeps letters and digits in any script (e.g. Hindi), drops symbols, collapses spaces. */
const baseName = (name: string) =>
  name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{M}\p{N}\-. _]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'document';

const errorKind = (err: unknown) => (err instanceof Error ? err.name : 'Error');

/**
 * For Sentry: a fixed message plus the original code stack, without the original message
 * (PDF library errors can quote file content such as text or font names).
 */
function safeError(label: string, err: unknown): Error {
  const e = new Error(label);
  if (err instanceof Error && err.stack) e.stack = [label, ...err.stack.split('\n').filter((l) => /^\s+at\s/.test(l) || /^[\w$.<>/]*@\S+:\d+:\d+$/.test(l))].join('\n');
  return e;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PdfWorkspace({ task, onTaskChange }: { task: PdfTask; onTaskChange: (t: PdfTask) => void }) {
  const [files, setFiles] = useState<Map<string, WorkFile>>(new Map());
  const [pages, setPages] = useState<PageItem[]>([]);
  const [locked, setLocked] = useState<LockedFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Options UI only renders once files are added (never during prerender), so reading storage here can't cause a hydration mismatch.
  const [options, setOptions] = useState<Options>(() => (typeof window === 'undefined' ? DEFAULT_OPTIONS : loadOptions()));
  const [ranges, setRanges] = useState('');
  // Kept in memory only: never saved, never sent anywhere.
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  // "Add a password" on the download panel (kept in memory only, like the Protect PDF password).
  const [lockDl, setLockDl] = useState({ on: false, pw: '', pw2: '' });
  const [dlBusy, setDlBusy] = useState(false);
  const [dlError, setDlError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  // Watermark text and variables (not persisted: may contain names)
  const [wmText, setWmText] = useState('');
  const [wmName, setWmName] = useState('');
  const [wmUntil, setWmUntil] = useState('');
  const [wmLogo, setWmLogo] = useState<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null>(null);
  // Metadata
  const [meta, setMeta] = useState({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' });
  const [removeMeta, setRemoveMeta] = useState(false);
  // Secure share
  const [shareCustom, setShareCustom] = useState('');
  const [shareRecipient, setShareRecipient] = useState('');
  const [viewing, setViewing] = useState<Uint8Array | null>(null);
  // Editor (edit / sign / redact)
  const [history, setHistory] = useState<{ past: UIObject[][]; present: UIObject[]; future: UIObject[][] }>({ past: [], present: [], future: [] });
  const [working, setWorking] = useState<{ doc: PDFDocumentProxy; bytes: Uint8Array; sizes: { w: number; h: number }[]; keys: string[] } | null>(null);
  const [formFields, setFormFields] = useState<FormFieldInfo[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [flattenForm, setFlattenForm] = useState(false);
  // Edit text: also remove the replaced lines from the file (pages become images).
  const [purgeReplaced, setPurgeReplaced] = useState(false);

  const docs = useRef(new Map<string, PDFDocumentProxy>());
  const lastClicked = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const info = taskInfo(task);

  const updateOptions = (patch: Partial<Options>) =>
    setOptions((o) => {
      const next = { ...o, ...patch };
      try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });

  // Switch task in place (the parent updates the address bar); the files stay open.
  const switchTask = (next: PdfTask) => onTaskChange(next);
  // A different task gives a different file: drop the old result and error.
  const [shownTask, setShownTask] = useState(task);
  if (shownTask !== task) {
    setShownTask(task);
    setResult(null);
    setError('');
  }

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
    const { loadPdf, openPdf, isEncryptedPdf } = await engine();
    const src: SourceFile = { id, name, kind: 'pdf', bytes, password };
    await loadPdf(src); // throws EncryptedPdfError if a password is needed
    const encrypted = password ? true : await isEncryptedPdf(bytes);
    const pdfjs = await openPdf(bytes, password);
    docs.current.set(id, pdfjs);
    const wf: WorkFile = { ...src, size: bytes.length, pageCount: pdfjs.numPages, encrypted };
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
        if (isShareFile(f)) {
          setViewing(new Uint8Array(await f.arrayBuffer()));
        } else if (isPdf(f)) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          // A Share-with-expiry cover PDF: open the document inside it instead of adding the cover page.
          if ((await engine()).isShareCover(bytes)) {
            setViewing(bytes);
            continue;
          }
          try {
            await addPdf(id, f.name, bytes);
            pdfCount++;
          } catch (err) {
            if (isEncryptedError(err)) setLocked((l) => [...l, { id, name: f.name, bytes, wrong: false }]);
            else throw err;
          }
        } else if (isImage(f)) {
          const img = await (await engine()).toEmbeddableImage(f);
          const wf: WorkFile = { id, name: f.name, kind: 'image', bytes: img.bytes, mime: img.mime, size: f.size, pageCount: 1, encrypted: false };
          setFiles((m) => new Map(m).set(id, wf));
          setPages((ps) => [...ps, { key: `${id}:0`, fileId: id, index: 0, rotation: 0, thumb: URL.createObjectURL(f) }]);
          imageCount++;
        } else {
          problems.push(`${f.name}: not a PDF, image or .bdtpdf file.`);
        }
      } catch (err) {
        problems.push(err instanceof Error && err.message.includes(f.name) ? err.message : `${f.name}: could not be opened (the file may be damaged).`);
      }
    }
    setBusy(null);
    if (problems.length) setError(problems.join(' '));
    if (pdfCount + imageCount) analytics.track(ANALYTICS_EVENTS.PDF_FILES_ADDED, { task, pdfs: pdfCount, images: imageCount });
  }, [addPdf, task]);

  /** Insert an empty page (same size as the page it follows) after the selected page, or at the end. */
  const addBlankPage = async () => {
    try {
      const E = await engine();
      const after = [...pages].reverse().find((p) => selected.has(p.key)) ?? pages[pages.length - 1];
      let size: [number, number] = [595.28, 841.89];
      const d = after && docs.current.get(after.fileId);
      if (after && d) {
        const pg = await d.getPage(after.index + 1);
        const vp = pg.getViewport({ scale: 1, rotation: (pg.rotate + after.rotation) % 360 });
        size = [vp.width, vp.height];
      }
      const id = newId('f');
      await addPdf(id, 'Blank page', await E.blankPdf(size[0], size[1]));
      const at = after ? pagesRef.current.findIndex((p) => p.key === after.key) + 1 : 0;
      setPages((ps) => {
        const from = ps.findIndex((p) => p.fileId === id);
        if (from < 0 || at <= 0 || at >= ps.length) return ps;
        const next = [...ps];
        const [item] = next.splice(from, 1);
        next.splice(at, 0, item);
        return next;
      });
      setResult(null);
    } catch {
      setError('Could not add a blank page.');
    }
  };

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
    setHistory((h) => (h.present.some((o) => keys.has(o.pageKey)) ? { past: [...h.past, h.present], present: h.present.filter((o) => !keys.has(o.pageKey)), future: [] } : h));
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
    setHistory({ past: [], present: [], future: [] });
    setFormValues({});
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

  /**
   * The document to work on. When the workspace holds one PDF with its pages untouched, use the
   * original bytes so form fields, bookmarks, links and properties survive; otherwise build it.
   */
  const baseBytes = useCallback(async (): Promise<Uint8Array> => {
    const only = files.size === 1 ? [...files.values()][0] : null;
    const untouched = only && only.kind === 'pdf' && !only.encrypted && pages.length === only.pageCount && pages.every((p, i) => p.index === i && p.rotation === 0);
    if (untouched) return only.bytes;
    return (await engine()).buildPdf(files, pages.map(({ fileId, index, rotation }) => ({ fileId, index, rotation })), options.image);
  }, [files, pages, options.image]);

  // Editor tasks: (re)build the working document when pages change.
  const isEditor = EDITOR_TASKS.includes(task);
  useEffect(() => {
    if (!isEditor || !pages.length) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const E = await engine();
        const bytes = await baseBytes();
        const doc = await E.openPdf(bytes);
        const sizes = await E.pageSizes(doc);
        const fields = task === 'edit' ? await E.readFormFields(bytes).catch(() => []) : [];
        if (cancelled) {
          doc.loadingTask.destroy();
          return;
        }
        setWorking((old) => {
          old?.doc.loadingTask.destroy();
          return { doc, bytes, sizes, keys: pages.map((p) => p.key) };
        });
        setFormFields(fields);
      } catch {
        if (!cancelled) setError('These pages could not be prepared for editing.');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isEditor, pages, baseBytes, task]);

  // Metadata task: show the current properties of the first PDF.
  useEffect(() => {
    if (task !== 'metadata') return;
    const first = [...files.values()].find((f) => f.kind === 'pdf' && !f.encrypted);
    if (!first) return;
    let cancelled = false;
    engine()
      .then((E) => E.readMetadata(first.bytes))
      .then((m) => !cancelled && setMeta({ title: m.title, author: m.author, subject: m.subject, keywords: m.keywords, creator: m.creator, producer: m.producer }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [task, files]);

  const objects = history.present;
  const changeObjects = useCallback((next: UIObject[], commit: boolean) => {
    setHistory((h) => (commit ? { past: [...h.past.slice(-50), h.present], present: next, future: [] } : { ...h, present: next }));
    setResult(null);
  }, []);
  const undo = () => setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  const redo = () => setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));

  const findSensitive = async (req: FindRequest): Promise<FindSummary> => {
    const E = await engine();
    if (!working) return { total: 0, byKind: {}, pagesWithoutText: 0 };
    const added: UIObject[] = [];
    const byKind: FindSummary['byKind'] = {};
    let pagesWithoutText = 0;
    for (let i = 0; i < working.keys.length; i++) {
      const runs = await E.pageTextRuns(working.doc, i);
      if (!runs.length) pagesWithoutText++;
      for (const m of E.findSensitive(runs, { kinds: req.kinds, custom: req.custom })) {
        byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
        for (const b of m.boxes) {
          added.push({ id: newId('r'), type: 'rect', style: 'redact', color: '#000000', pageKey: working.keys[i], page: i, u: b.u, v: b.v, w: b.w, h: b.h });
        }
      }
    }
    if (added.length) changeObjects([...objects, ...added], true);
    return { total: Object.values(byKind).reduce((a, b) => a + (b ?? 0), 0), byKind, pagesWithoutText };
  };

  const watermarkText = () => fillWatermarkTemplate(wmText, { date: todayLabel(), name: wmName || '…', until: wmUntil || '…' });

  const run = async () => {
    const E = await engine();
    const { makeZip, compressKeepText, KEEP_TEXT_LEVELS, canvasReencoder, openPdf, compressToTarget, makeRasterizer, renderPage, canvasToBytes, protectPdf } = E;
    setError('');
    setResult(null);
    const outputs: Output[] = [];
    let note: string | undefined;
    let previews: Output[] | undefined;
    const pdf = (name: string, bytes: Uint8Array, reusable = true): Output => ({ name, bytes, type: 'application/pdf', reusable });

    try {
      if (securable && lockDl.on) {
        const problem = passwordProblem(lockDl.pw, lockDl.pw2);
        if (problem) throw new UserError(`Password for the download: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`);
      }
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
          if (parts.length > 1) previews = parts;
          if (parts.length === 1) outputs.push(parts[0]);
          else outputs.push({ name: `${firstName}-split.zip`, bytes: makeZip(parts), type: 'application/zip', reusable: false });
          note = parts.length > 1 ? `${parts.length} PDFs in one ZIP.` : undefined;
        }
      } else if (task === 'compress' && options.compressSeparately && files.size > 1) {
        // One compressed PDF per input file, in a ZIP.
        const parts: Output[] = [];
        const fileList = [...files.values()];
        for (let fi = 0; fi < fileList.length; fi++) {
          const f = fileList[fi];
          const own = pages.filter((p) => p.fileId === f.id);
          if (!own.length) continue;
          setBusy(`Compressing file ${fi + 1} of ${fileList.length}…`);
          const src = await build(own);
          let bytes: Uint8Array;
          if (options.compressMode === 'keep') {
            bytes = (await compressKeepText(src, KEEP_TEXT_LEVELS[options.keepLevel], canvasReencoder)).bytes;
          } else {
            const doc = await openPdf(src);
            try {
              bytes = (await compressToTarget(Math.max(10, options.targetKb) * 1024, makeRasterizer(doc), undefined, src)).bytes;
            } finally {
              doc.loadingTask.destroy();
            }
          }
          parts.push(pdf(`${baseName(f.name)}-compressed.pdf`, bytes));
        }
        if (parts.length > 1) previews = parts;
        outputs.push(parts.length === 1 ? parts[0] : { name: 'compressed-pdfs.zip', bytes: makeZip(parts), type: 'application/zip', reusable: false });
        note = `${parts.length} files compressed separately.`;
      } else if (task === 'compress') {
        setBusy('Preparing…');
        const combined = await baseBytes();
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
      } else if (task === 'protect') {
        const problem = passwordProblem(password, password2) ?? ownerPasswordProblem(password, ownerPassword);
        if (problem) throw new UserError(problem);
        setBusy('Encrypting…');
        const bytes = await protectPdf(await baseBytes(), {
          openPassword: password,
          ownerPassword: ownerPassword || undefined,
          algorithm: options.encryption,
          permissions: options.permissions,
        });
        // Not reusable: chaining would ask for the password again.
        outputs.push(pdf(`${firstName}-protected.pdf`, bytes, false));
        note = `Encrypted with ${options.encryption}. Keep the password safe: it cannot be recovered.`;
      } else if (task === 'unlock') {
        setBusy('Removing password…');
        outputs.push(pdf(`${firstName}-unlocked.pdf`, await build(pages)));
        const wasLocked = [...files.values()].some((f) => f.encrypted);
        note = wasLocked
          ? 'Saved without a password or print/copy restrictions.'
          : 'This PDF had no password or restrictions, so the copy is the same as the original.';
      } else if (task === 'pdf-to-jpg') {
        const list = (selectedPages.length ? selectedPages : pages).filter((p) => files.get(p.fileId)?.kind === 'pdf');
        if (!list.length) throw new UserError('Add a PDF first.');
        const ext = options.imageFormat;
        const images: Output[] = [];
        for (let i = 0; i < list.length; i++) {
          setBusy(`Converting page ${i + 1} of ${list.length}…`);
          const p = list[i];
          const canvas = await renderPage(docs.current.get(p.fileId)!, p.index, options.dpi / 72, p.rotation);
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const bytes = await canvasToBytes(canvas, mime, 0.9);
          images.push({ name: `${baseName(files.get(p.fileId)!.name)}-page-${p.index + 1}.${ext}`, bytes, type: mime, reusable: false });
          canvas.width = canvas.height = 0; // free memory early
        }
        if (images.length > 1) previews = images;
        if (images.length === 1) outputs.push(images[0]);
        else outputs.push({ name: `${firstName}-images.zip`, bytes: makeZip(images), type: 'application/zip', reusable: false });
        note = images.length > 1 ? `${images.length} images in one ZIP.` : undefined;
      } else if (task === 'edit' || task === 'sign' || task === 'redact') {
        if (!working) throw new UserError('The pages are still loading. Try again in a moment.');
        if (!objects.length && !Object.keys(formValues).length) throw new UserError(task === 'sign' ? 'Add your signature to a page first.' : task === 'redact' ? 'Mark something to redact first.' : 'Add something to the pages first.');
        setBusy('Saving…');
        const indexOf = new Map(working.keys.map((k, i) => [k, i]));
        const placed = objects.filter((o) => indexOf.has(o.pageKey)).map((o) => ({ ...o, page: indexOf.get(o.pageKey)! }));
        // Custom fonts: fetch the files (web fonts) or read them from the computer, embedded as subsets.
        const customKeys = placed.flatMap((o) => (o.type === 'text' && o.text.trim() && !isStandardFont(o.family) ? [o.family!] : []));
        const customFonts = customKeys.length
          ? await fontBytesFor(customKeys, (key) => placed.some((o) => o.type === 'text' && o.family === key && o.bold))
          : undefined;
        let bytes = await E.applyEdits(working.bytes, placed, { formValues, flattenForm, imager: E.canvasTextImager, customFonts });
        const redacted = E.redactedPages(placed);
        const purged = purgeReplaced ? E.replacedTextPages(placed) : [];
        const flatten = [...new Set([...redacted, ...purged])].sort((a, b) => a - b);
        if (flatten.length) {
          setBusy('Removing the text under the boxes…');
          const flat = await E.flattenPages(bytes, flatten, { dpi: 150, quality: 0.9, onProgress: (d, t) => setBusy(`Removing hidden text… page ${d} of ${t}`) });
          bytes = await E.replacePagesWithImages(bytes, flat, { stripMetadata: redacted.length > 0 });
        }
        const suffix = task === 'sign' ? 'signed' : task === 'redact' ? 'redacted' : 'edited';
        outputs.push(pdf(`${firstName}-${suffix}.pdf`, bytes));
        const replacedCount = placed.filter((o) => o.type === 'text' && o.cover).length;
        if (replacedCount && !purgeReplaced) note = `${replacedCount} line${replacedCount === 1 ? '' : 's'} of text changed. The old text is covered; tick "Remove the old text completely" if it must not be findable.`;
        else if (purged.length && !redacted.length) note = `The old text is removed for good (${purged.length} page${purged.length === 1 ? ' was' : 's were'} turned into an image).`;
        if (redacted.length) note = `Text under the black boxes is permanently removed (${redacted.length} page${redacted.length === 1 ? ' was' : 's were'} turned into an image). Hidden document properties were removed too.`;
      } else if (task === 'watermark') {
        const text = watermarkText();
        if (!text && !wmLogo) throw new UserError('Type watermark text or add a logo.');
        setBusy('Adding watermark…');
        const w = options.watermark;
        let bytes = await E.addWatermark(await baseBytes(), { text, layout: w.layout, size: w.size, color: w.color, opacity: w.opacity, bold: w.bold, logo: wmLogo ? { ...wmLogo, widthFraction: 0.35 } : undefined }, E.canvasTextImager);
        if (w.permanent) {
          setBusy('Making it permanent…');
          const doc = await openPdf(bytes);
          const n = doc.numPages;
          doc.loadingTask.destroy();
          const flat = await E.flattenPages(bytes, Array.from({ length: n }, (_, i) => i), { dpi: 150, quality: 0.85, onProgress: (d, t) => setBusy(`Making it permanent… page ${d} of ${t}`) });
          bytes = await E.replacePagesWithImages(bytes, flat);
        }
        outputs.push(pdf(`${firstName}-watermarked.pdf`, bytes));
        note = w.permanent ? 'The watermark is part of the page image, so it cannot be removed with a PDF editor.' : 'Tip: tick "Make it permanent" so the watermark cannot be removed with a PDF editor.';
      } else if (task === 'page-numbers') {
        setBusy('Numbering pages…');
        outputs.push(pdf(`${firstName}-numbered.pdf`, await E.addPageNumbers(await baseBytes(), options.pageNumbers)));
      } else if (task === 'grayscale') {
        setBusy('Converting to black & white…');
        const src = await baseBytes();
        const doc = await openPdf(src);
        const n = doc.numPages;
        doc.loadingTask.destroy();
        const flat = await E.flattenPages(src, Array.from({ length: n }, (_, i) => i), { dpi: options.grayDpi, grayscale: true, quality: 0.85, onProgress: (d, t) => setBusy(`Converting page ${d} of ${t}…`) });
        outputs.push(pdf(`${firstName}-bw.pdf`, await E.replacePagesWithImages(src, flat)));
        note = 'Pages are now black & white images, so text can no longer be selected.';
      } else if (task === 'metadata') {
        setBusy('Saving properties…');
        outputs.push(pdf(`${firstName}.pdf`, await E.writeMetadata(await baseBytes(), meta, { removeAll: removeMeta })));
        note = removeMeta ? 'All document properties and hidden XMP metadata were removed.' : 'Properties saved.';
      } else if (task === 'secure-share') {
        const expiresAt = shareExpiresAt(options.shareExpiry, shareCustom);
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new UserError('Choose an expiry date and time in the future.');
        if (password || password2) {
          const problem = passwordProblem(password, password2);
          if (problem) throw new UserError(problem);
        }
        setBusy('Encrypting…');
        const recipient = shareRecipient.trim() || undefined;
        const share = await E.createShare(await baseBytes(), {
          name: `${firstName}.pdf`, expiresAt, password: password || undefined, recipient,
          allowPrint: options.shareAllowPrint, watermark: options.shareWatermark,
        });
        const until = formatExpiry(expiresAt);
        const bytes = await E.wrapShareInPdf(share, { name: `${firstName}.pdf`, until, recipient, hasPassword: !!password, openUrl: openUrl() });
        outputs.push({ name: `${firstName}-protected-until-${new Date(expiresAt).toISOString().slice(0, 10)}.pdf`, bytes, type: 'application/pdf', reusable: false });
        note = `Send this PDF. Its cover page tells the recipient how to open it at ${openUrl().replace(/^https?:\/\//, '')}, until ${until}${password ? '. Share the password separately (not in the same chat)' : ''}.`;
      }

      setDlError('');
      setResult({ outputs, inputBytes, note, previews });
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
        reportError(safeError(`PDF export failed (${task}, ${errorKind(err)})`, err), { tags: { tool: 'pdf', task } });
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

  const canRun =
    !busy && pages.length > 0 && (task !== 'pdf-to-jpg' || pdfPages.length > 0) && (task !== 'protect' || !!password) && (!isEditor || !!working);

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Live preview of one page in the options panel: the first selected page, else page 1.
  const previewPage =
    pages.find((p) => selected.has(p.key)) ??
    (task === 'jpg-to-pdf' ? pages.find((p) => files.get(p.fileId)?.kind === 'image') : undefined) ??
    pages[0];
  const previewNo = previewPage ? pages.indexOf(previewPage) + 1 : 0;
  const previewCaption = pages.length > 1 ? `Page ${previewNo} of ${pages.length}. Click a page to preview it instead.` : 'Your page with these settings.';

  const livePreview = ((): { make: () => Promise<LivePreviewResult | null>; deps: string } | null => {
    if (!previewPage || result) return null;
    const pageDeps = [previewPage.key, previewPage.rotation, pages.length];
    const one = () => build([previewPage]);
    if (task === 'watermark') {
      const w = options.watermark;
      return {
        deps: JSON.stringify([pageDeps, w.layout, w.size, w.color, w.opacity, w.bold, wmText, wmName, wmUntil, wmLogo?.bytes.length ?? 0]),
        make: async () => {
          const E = await engine();
          const text = watermarkText();
          const page = await one();
          if (!text && !wmLogo) return { after: page };
          return { after: await E.addWatermark(page, { text, layout: w.layout, size: w.size, color: w.color, opacity: w.opacity, bold: w.bold, logo: wmLogo ? { ...wmLogo, widthFraction: 0.35 } : undefined }, E.canvasTextImager) };
        },
      };
    }
    if (task === 'page-numbers') {
      const pn = options.pageNumbers;
      return {
        deps: JSON.stringify([pageDeps, pn]),
        make: async () => {
          const E = await engine();
          const idx = pages.indexOf(previewPage);
          const page = await one();
          if (pn.skipFirst && idx === 0) return { after: page, note: 'The first page is not numbered.' };
          // Number this page exactly as it will be numbered in the full document.
          const n = pn.start + idx - (pn.skipFirst ? 1 : 0);
          const total = pn.start + pages.length - (pn.skipFirst ? 1 : 0) - 1;
          return { after: await E.addPageNumbers(page, { ...pn, start: n, skipFirst: false }, total) };
        },
      };
    }
    if (task === 'grayscale') {
      return {
        deps: JSON.stringify([pageDeps, options.grayDpi]),
        make: async () => {
          const E = await engine();
          const page = await one();
          const flat = await E.flattenPages(page, [0], { dpi: options.grayDpi, grayscale: true, quality: 0.85 });
          const after = await E.replacePagesWithImages(page, flat);
          return { after, before: page, note: `Estimated size: about ${formatBytes(after.length * pages.length)}` };
        },
      };
    }
    if (task === 'compress' && options.compressMode === 'keep') {
      return {
        deps: JSON.stringify([pageDeps, options.keepLevel]),
        make: async () => {
          const E = await engine();
          const page = await one();
          const { bytes, stats } = await E.compressKeepText(page, E.KEEP_TEXT_LEVELS[options.keepLevel], E.canvasReencoder);
          return { after: bytes, before: page, note: stats.imagesFound ? undefined : 'No photos on this page, so it stays the same.' };
        },
      };
    }
    if (task === 'secure-share' && options.shareWatermark) {
      const recipient = shareRecipient.trim();
      return {
        deps: JSON.stringify([pageDeps, recipient, options.shareExpiry, shareCustom]),
        make: async () => {
          const E = await engine();
          const page = await one();
          const text = E.shareWatermarkText({ recipient: recipient || undefined }, formatExpiry(shareExpiresAt(options.shareExpiry, shareCustom, true)));
          const flat = await E.flattenPages(page, [0], { dpi: 110, quality: 0.85, decorate: (c) => E.stampShareWatermark(c, text) });
          return { after: await E.replacePagesWithImages(page, flat), note: 'What the recipient sees. The watermark is drawn into the page, so it is in screenshots too.' };
        },
      };
    }
    if (task === 'jpg-to-pdf' || ((task === 'merge' || task === 'organize') && imagePages > 0)) {
      return {
        deps: JSON.stringify([pageDeps, options.image]),
        make: async () => ({ after: await one() }),
      };
    }
    return null;
  })();

  const previewFirst = task === 'watermark' || task === 'page-numbers';
  // Tasks whose result is one PDF, so a password can be added on download.
  const securable =
    !['protect', 'unlock', 'secure-share', 'pdf-to-jpg'].includes(task) &&
    !(task === 'split' && options.splitMode !== 'selected') &&
    !(task === 'compress' && options.compressSeparately && files.size > 1);

  // "Original / Result" toggle in the result viewer.
  const beforeSource: BeforeSource | undefined =
    result && COMPARABLE_TASKS.includes(task) && imagePages === 0 && result.outputs.length === 1 && result.outputs[0].type === 'application/pdf'
      ? {
          count: pages.length,
          render: async (i, scale) => {
            const p = pages[i];
            return (await engine()).renderPage(docs.current.get(p.fileId)!, p.index, scale, p.rotation);
          },
        }
      : undefined;

  /** Results that can get a password or an expiry before download. */
  const canSecure = !!result && result.outputs.length === 1 && result.outputs[0].type === 'application/pdf' && !['protect', 'unlock', 'secure-share'].includes(task);

  const downloadOutput = async (o: Output) => {
    setDlError('');
    if (!(canSecure && lockDl.on)) {
      downloadBytes(o.bytes, o.name, o.type);
      return;
    }
    const problem = passwordProblem(lockDl.pw, lockDl.pw2);
    if (problem) {
      setDlError(problem);
      return;
    }
    setDlBusy(true);
    try {
      const bytes = await (await engine()).protectPdf(o.bytes, { openPassword: lockDl.pw, permissions: { modify: false, assemble: false } });
      downloadBytes(bytes, o.name.replace(/\.pdf$/i, '-protected.pdf'), o.type);
      analytics.track(ANALYTICS_EVENTS.PDF_EXPORT, { task: 'protect', pages: 0, files: 1, outputs: 1, mode: 'on_download' });
    } catch {
      setDlError('Could not add the password. Try again.');
    } finally {
      setDlBusy(false);
    }
  };

  // Show the result from its top, even if the page was scrolled down to the button.
  const workArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = workArea.current;
    if (result && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [result]);

  const actionButton = (
    <button
      type="button"
      onClick={run}
      disabled={!canRun}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {busy ? 'Working…' : info.action}
    </button>
  );

  const dropLabel =
    task === 'jpg-to-pdf'
      ? 'Select images'
      : task === 'unlock'
      ? 'Select a protected PDF'
      : task === 'secure-share'
      ? 'Select a PDF'
      : ['merge', 'compress', 'pdf-to-jpg'].includes(task)
      ? 'Select PDF files'
      : 'Select a PDF';

  return (
    <div className={pages.length ? 'pb-24 lg:pb-0' : ''}>
      {viewing && <SecureViewer file={viewing} engine={engine} onClose={() => setViewing(null)} />}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={task === 'jpg-to-pdf' ? 'image/*,.heic,.heif,.pdf' : '.pdf,application/pdf,image/*,.heic,.heif,.bdtpdf'}
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

      {locked.length > 0 && (
        <div className="mb-4 space-y-2">
          {locked.map((lf) => (
            <LockedRow key={lf.id} file={lf} onUnlock={(pw) => unlock(lf, pw)} onRemove={() => setLocked((l) => l.filter((x) => x.id !== lf.id))} />
          ))}
        </div>
      )}

      {!pages.length ? (
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.current?.click())}
            className="flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm">
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {busy ? 'Opening…' : dropLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              or drop {task === 'jpg-to-pdf' ? 'images' : 'files'} here, or paste with Ctrl/⌘+V
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Files stay on your device. Nothing is uploaded.
            </span>
          </div>
          <ErrorMessage message={error} onDismiss={() => setError('')} />
          {task === 'secure-share' && <OpenSharedHint onPick={() => fileInput.current?.click()} />}
        </div>
      ) : (
        <div ref={workArea} className="scroll-mt-20 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
          {/* Centre: pages, the editor, or the result */}
          <div className="min-w-0">
            {result ? (
              <ResultView
                files={result.previews ?? result.outputs}
                password={task === 'protect' ? password : undefined}
                before={beforeSource}
                onBack={() => setResult(null)}
                backLabel={isEditor ? 'Back to editing' : 'Change options'}
              />
            ) : (
              <>
                <div className={`mb-3 flex flex-wrap items-center gap-1 border-b border-border bg-background pb-2 ${isEditor ? '' : 'sticky top-14 z-20 pt-2'}`}>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" /> Add files
                  </button>
                  {['merge', 'organize', 'edit', 'sign', 'jpg-to-pdf'].includes(task) && (
                    <ToolbarBtn onClick={addBlankPage} icon={<FilePlus2 className="h-4 w-4" />} label="Add a blank page after the selected page">
                      <span className="hidden sm:inline">Blank page</span>
                    </ToolbarBtn>
                  )}
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <ToolbarBtn onClick={() => setSelected(selected.size === pages.length ? new Set() : new Set(pages.map((p) => p.key)))}>
                    {selected.size === pages.length ? 'Select none' : 'Select all'}
                  </ToolbarBtn>
                  <ToolbarBtn disabled={!selected.size} onClick={() => rotatePages(new Set(selected), -90)} icon={<RotateCcw className="h-4 w-4" />} label="Rotate selected left" />
                  <ToolbarBtn disabled={!selected.size} onClick={() => rotatePages(new Set(selected), 90)} icon={<RotateCw className="h-4 w-4" />} label="Rotate selected right" />
                  <ToolbarBtn disabled={!selected.size} onClick={() => removePages(new Set(selected))} icon={<Trash2 className="h-4 w-4" />} label="Delete selected" danger />
                  <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">
                    {pages.length} page{pages.length === 1 ? '' : 's'}
                    {selected.size ? ` · ${selected.size} selected` : ''} · {formatBytes(inputBytes)}
                  </span>
                  <ToolbarBtn onClick={clearAll} icon={<X className="h-4 w-4" />} label="Remove all files">
                    <span className="hidden sm:inline">Clear</span>
                  </ToolbarBtn>
                </div>

                {isEditor ? (
                  <PageEditor
                    key={task}
                    mode={task as 'edit' | 'sign' | 'redact'}
                    doc={working?.doc ?? null}
                    pageKeys={working?.keys ?? []}
                    sizes={working?.sizes ?? []}
                    objects={objects}
                    onChange={changeObjects}
                    canUndo={history.past.length > 0}
                    canRedo={history.future.length > 0}
                    onUndo={undo}
                    onRedo={redo}
                    formFields={formFields}
                    formValues={formValues}
                    setFormValue={(name, value) => setFormValues((v) => ({ ...v, [name]: value }))}
                    flattenForm={flattenForm}
                    setFlattenForm={setFlattenForm}
                    onFind={findSensitive}
                    renderPage={async (doc, index, scale) => (await engine()).renderPage(doc, index, scale)}
                    getTextRuns={async (doc, index) => (await engine()).pageTextRuns(doc, index)}
                  />
                ) : (
                  <div className="rounded-xl bg-muted/40 p-3 sm:p-4">
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
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: options + action, or the download */}
          <aside className="mt-6 lg:sticky lg:top-20 lg:mt-0">
            {result ? (
              <ResultPanel
                result={result}
                task={task}
                onDownload={downloadOutput}
                onReuse={useResultAsInput}
                canSecure={canSecure}
                lock={lockDl}
                setLock={(p) => {
                  setDlError('');
                  setLockDl((l) => ({ ...l, ...p }));
                }}
                dlBusy={dlBusy}
                dlError={dlError}
                onPreviewShare={(o) => setViewing(o.bytes)}
              />
            ) : (
              <div className="flex flex-col rounded-xl border border-border bg-card lg:max-h-[calc(100vh-6rem)]">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">{info.label}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{info.hint}</p>
                </div>
                <div className="developer-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
                  {/* Many settings: show the effect first so it stays in view while adjusting. */}
                  {livePreview && previewFirst && <LivePreview make={livePreview.make} deps={livePreview.deps} caption={previewCaption} />}
                  <TaskOptions
                    task={task}
                    options={options}
                    update={updateOptions}
                    ranges={ranges}
                    setRanges={setRanges}
                    selectedCount={selected.size}
                    fileCount={files.size}
                    password={password}
                    setPassword={setPassword}
                    password2={password2}
                    setPassword2={setPassword2}
                    ownerPassword={ownerPassword}
                    setOwnerPassword={setOwnerPassword}
                    imagePages={imagePages}
                    pdfPages={pdfPages.length}
                  />
                  {task === 'watermark' && (
                    <WatermarkFields
                      options={options}
                      update={updateOptions}
                      text={wmText}
                      setText={setWmText}
                      name={wmName}
                      setName={setWmName}
                      until={wmUntil}
                      setUntil={setWmUntil}
                      logo={wmLogo}
                      setLogo={setWmLogo}
                    />
                  )}
                  {task === 'page-numbers' && <PageNumberFields value={options.pageNumbers} onChange={(p) => updateOptions({ pageNumbers: { ...options.pageNumbers, ...p } })} />}
                  {task === 'grayscale' && (
                    <Field label="Quality" hint="Pages become black & white images, so text can no longer be selected.">
                      <Segmented
                        label="Quality"
                        value={options.grayDpi}
                        onChange={(v) => updateOptions({ grayDpi: v })}
                        options={[{ value: 110, label: 'Smaller' }, { value: 150, label: 'Standard' }, { value: 220, label: 'Print' }]}
                      />
                    </Field>
                  )}
                  {task === 'edit' && objects.some((o) => o.type === 'text' && o.cover) && (
                    <Check
                      checked={purgeReplaced}
                      onChange={setPurgeReplaced}
                      detail="Your new text covers the old text, but copy or search could still find it. This removes it for good; those pages become images, so their text can't be selected."
                    >
                      Remove the old text completely
                    </Check>
                  )}
                  {task === 'metadata' && <MetadataFields meta={meta} setMeta={setMeta} removeAll={removeMeta} setRemoveAll={setRemoveMeta} />}
                  {task === 'secure-share' && (
                    <ShareFields
                      options={options}
                      update={updateOptions}
                      custom={shareCustom}
                      setCustom={setShareCustom}
                      recipient={shareRecipient}
                      setRecipient={setShareRecipient}
                      password={password}
                      setPassword={setPassword}
                      password2={password2}
                      setPassword2={setPassword2}
                    />
                  )}
                  {securable && (
                    <SecurityBox
                      lock={lockDl}
                      setLock={(p) => {
                        setDlError('');
                        setLockDl((l) => ({ ...l, ...p }));
                      }}
                      onExpiry={() => switchTask('secure-share')}
                    />
                  )}
                  {livePreview && !previewFirst && <LivePreview make={livePreview.make} deps={livePreview.deps} caption={previewCaption} />}
                  {task === 'compress' && options.compressMode === 'target' && (
                    <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                      The quality depends on all pages together, so you&apos;ll see every page before you download.
                    </p>
                  )}
                </div>
                <div className="space-y-2 border-t border-border px-4 py-3">
                  <ErrorMessage message={error} onDismiss={() => setError('')} />
                  <div className="hidden lg:block">{actionButton}</div>
                  <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
                    {busy ?? (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Processed on your device
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Phones and tablets: the main button stays in reach at the bottom of the screen. */}
      {pages.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          {result ? (
            <button
              type="button"
              onClick={() => downloadOutput(result.outputs[0])}
              disabled={dlBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
            >
              {dlBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {canSecure && lockDl.on ? 'Download with password' : `Download ${formatBytes(result.outputs[0].bytes.length)}`}
            </button>
          ) : (
            actionButton
          )}
          {busy && <p className="mt-1.5 text-center text-xs text-muted-foreground">{busy}</p>}
          {result && dlError && <p className="mt-1.5 text-center text-xs text-red-600 dark:text-red-400">{dlError}</p>}
        </div>
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

const sizeLabel = (kb: number) => (kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`);

function TaskOptions({
  task, options, update, ranges, setRanges, selectedCount, fileCount, imagePages, pdfPages,
  password, setPassword, password2, setPassword2, ownerPassword, setOwnerPassword,
}: {
  task: PdfTask; options: Options; update: (p: Partial<Options>) => void; ranges: string; setRanges: (s: string) => void;
  selectedCount: number; fileCount: number; imagePages: number; pdfPages: number;
  password: string; setPassword: (s: string) => void; password2: string; setPassword2: (s: string) => void;
  ownerPassword: string; setOwnerPassword: (s: string) => void;
}) {
  const img = options.image;
  const setImg = (p: Partial<ImagePageOptions>) => update({ image: { ...img, ...p } });
  const showImageOptions = imagePages > 0 && task !== 'pdf-to-jpg';

  return (
    <>
      {task === 'compress' && (
        <>
          <Field label="Compression">
            <OptionCards
              label="Compression"
              value={options.compressMode}
              onChange={(v) => update({ compressMode: v })}
              options={[
                { value: 'keep', title: 'Keep text sharp', detail: 'Shrinks the photos only. Text stays selectable and searchable.' },
                { value: 'target', title: 'Fit an exact size', detail: 'For exam and government forms. Pages become images.' },
              ]}
            />
          </Field>
          {options.compressMode === 'keep' ? (
            <Field label="Strength">
              <Segmented
                label="Strength"
                value={options.keepLevel}
                onChange={(v) => update({ keepLevel: v })}
                options={[{ value: 'light', label: 'Light' }, { value: 'balanced', label: 'Balanced' }, { value: 'strong', label: 'Strong' }]}
              />
            </Field>
          ) : (
            <Field label="Maximum size">
              <Segmented
                label="Maximum size"
                value={TARGET_PRESETS.includes(options.targetKb) ? options.targetKb : -1}
                onChange={(v) => v > 0 && update({ targetKb: v })}
                options={TARGET_PRESETS.map((kb) => ({ value: kb, label: sizeLabel(kb) }))}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Other
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={options.targetKb}
                  onChange={(e) => update({ targetKb: Math.max(10, Number(e.target.value) || 0) })}
                  className={`${inputCls} w-24`}
                  aria-label="Maximum size in KB"
                />
                KB
              </label>
            </Field>
          )}
          {fileCount > 1 && (
            <Check
              checked={options.compressSeparately}
              onChange={(v) => update({ compressSeparately: v })}
              detail={options.compressSeparately ? 'You get a ZIP with one compressed PDF per file.' : 'Otherwise all files are combined into one PDF.'}
            >
              Compress each file separately
            </Check>
          )}
        </>
      )}

      {task === 'split' && (
        <>
          <Field label="Split into">
            <OptionCards
              label="Split into"
              value={options.splitMode}
              onChange={(v) => update({ splitMode: v })}
              options={[
                { value: 'selected', title: 'Selected pages', detail: 'One PDF with the pages you click.' },
                { value: 'every', title: 'Every page', detail: 'One PDF per page, downloaded as a ZIP.' },
                { value: 'ranges', title: 'Custom ranges', detail: 'One PDF per range, e.g. 1-3, 4-6.' },
              ]}
            />
          </Field>
          {options.splitMode === 'ranges' && (
            <Field label="Ranges" hint="Use the page numbers shown under the pages.">
              <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-6, 7-" className={inputCls} aria-label="Page ranges, one PDF per range" />
            </Field>
          )}
          {options.splitMode === 'selected' && (
            <p className="text-xs text-muted-foreground">
              {selectedCount ? `${selectedCount} page${selectedCount === 1 ? '' : 's'} selected.` : 'Click pages to select them. Shift-click selects a range.'}
            </p>
          )}
        </>
      )}

      {task === 'pdf-to-jpg' && (
        <>
          <Field label="Format" hint={options.imageFormat === 'png' ? 'Lossless, larger files.' : options.imageFormat === 'webp' ? 'Smallest files; most apps open it.' : 'Small files that open everywhere.'}>
            <Segmented
              label="Format"
              value={options.imageFormat}
              onChange={(v) => update({ imageFormat: v })}
              options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }]}
            />
          </Field>
          <Field label="Quality" hint={`${options.dpi} DPI`}>
            <Segmented
              label="Quality"
              value={options.dpi}
              onChange={(v) => update({ dpi: v })}
              options={[{ value: 72, label: 'Small' }, { value: 150, label: 'Screen' }, { value: 300, label: 'Print' }]}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {selectedCount ? `Converts the ${selectedCount} selected page${selectedCount === 1 ? '' : 's'}.` : `Converts all ${pdfPages} page${pdfPages === 1 ? '' : 's'}. Select pages to convert only some.`}
          </p>
        </>
      )}

      {task === 'protect' && <ProtectFields password={password} setPassword={setPassword} password2={password2} setPassword2={setPassword2} ownerPassword={ownerPassword} setOwnerPassword={setOwnerPassword} options={options} update={update} />}

      {task === 'unlock' && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Saves a copy without the password and print/copy restrictions. You need to know the password; nothing is cracked or guessed.
        </p>
      )}

      {(task === 'edit' || task === 'sign' || task === 'redact') && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {task === 'redact'
            ? 'Drag over anything to black it out, or use "Find and redact" above the pages. The text under the boxes is removed for good when you save.'
            : 'Pick a tool above the pages, then click or drag on a page. Delete removes the selected item, arrow keys nudge it, ⌘/Ctrl+Z undoes.'}
        </p>
      )}

      {(task === 'merge' || task === 'organize') && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Drag the handle under a page to move it. Click pages to select them, then rotate or delete. Keys: R rotate, Delete remove, ⌘/Ctrl+A select all.
        </p>
      )}

      {showImageOptions && (
        <>
          <Field label="Page size">
            <Segmented label="Page size" value={img.pageSize} onChange={(v) => setImg({ pageSize: v })} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'fit', label: 'Fit image' }]} />
          </Field>
          {img.pageSize !== 'fit' && (
            <Field label="Orientation">
              <Segmented
                label="Orientation"
                value={img.orientation}
                onChange={(v) => setImg({ orientation: v })}
                options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
              />
            </Field>
          )}
          <Field label="Margin">
            <Segmented label="Margin" value={img.margin} onChange={(v) => setImg({ margin: v })} options={[{ value: 0, label: 'None' }, { value: 18, label: 'Small' }, { value: 36, label: 'Large' }]} />
          </Field>
        </>
      )}
    </>
  );
}

function PasswordInput({ value, onChange, label, show, placeholder }: { value: string; onChange: (s: string) => void; label: string; show: boolean; placeholder?: string }) {
  return (
    <input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="new-password"
      placeholder={placeholder}
      className={inputCls}
      aria-label={label}
    />
  );
}

function ProtectFields({
  password, setPassword, password2, setPassword2, ownerPassword, setOwnerPassword, options, update,
}: {
  password: string; setPassword: (s: string) => void; password2: string; setPassword2: (s: string) => void;
  ownerPassword: string; setOwnerPassword: (s: string) => void;
  options: Options; update: (p: Partial<Options>) => void;
}) {
  const [show, setShow] = useState(false);
  const [more, setMore] = useState(false);
  const strength = password ? passwordStrength(password) : null;
  const mismatch = !!password2 && password !== password2;
  const ownerProblem = ownerPasswordProblem(password, ownerPassword);
  const perms = options.permissions;
  const setPerm = (key: keyof PdfPermissions, v: boolean) => {
    const next = { ...perms, [key]: v };
    // High-quality printing only makes sense with printing.
    if (key === 'print' && !v) next.printHighRes = false;
    if (key === 'printHighRes' && v) next.print = true;
    update({ permissions: next });
  };
  return (
    <>
      <Field
        label="Password to open"
        hint={
          strength && (
            <span className={strength === 'weak' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {strength === 'weak' ? 'Weak: use 8+ characters with letters and numbers' : strength === 'ok' ? 'Good' : 'Strong'}
            </span>
          )
        }
      >
        <div className="relative">
          <PasswordInput value={password} onChange={setPassword} label="Password to open the PDF" show={show} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label={show ? 'Hide passwords' : 'Show passwords'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <Field label="Repeat password" hint={mismatch && <span className="text-red-600 dark:text-red-400">Does not match</span>}>
        <PasswordInput value={password2} onChange={setPassword2} label="Repeat the password" show={show} />
      </Field>
      <Field label="People who open it may">
        <div className="space-y-2">
          {PERMISSION_LABELS.map(([key, label]) => (
            <div key={key} className={key === 'printHighRes' ? 'pl-6' : undefined}>
              <Check checked={perms[key]} onChange={(v) => setPerm(key, v)}>
                <span className={key === 'printHighRes' ? 'text-xs' : undefined}>{label}</span>
              </Check>
            </div>
          ))}
        </div>
      </Field>
      <p className="rounded-lg bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
        Most readers (Adobe, Chrome, Edge, Preview) follow these limits, but some apps ignore them. The password to open the file always works.
      </p>
      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="text-xs font-medium text-primary hover:underline">
        {more ? 'Fewer options' : 'More options: admin password, encryption'}
      </button>
      {more && (
        <>
          <Field
            label="Admin password (optional)"
            hint={ownerProblem ? <span className="text-red-600 dark:text-red-400">{ownerProblem}</span> : 'Lets you remove the limits above later. Leave empty and nobody can.'}
          >
            <PasswordInput value={ownerPassword} onChange={setOwnerPassword} label="Admin password to change permissions" show={show} />
          </Field>
          <Field label="Encryption">
            <Segmented
              label="Encryption"
              value={options.encryption}
              onChange={(v) => update({ encryption: v })}
              options={[{ value: 'AES-256', label: 'AES 256-bit (strong)' }, { value: 'AES-128', label: 'AES 128-bit' }]}
            />
          </Field>
          {options.encryption === 'AES-128' && <p className="text-xs text-muted-foreground">Only for very old PDF readers (before 2008). AES-256 works everywhere else.</p>}
        </>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Passwords are never stored or sent. If you forget the password, the file cannot be opened, so keep the original.
      </p>
    </>
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
  result, task, onDownload, onReuse, canSecure, lock, setLock, dlBusy, dlError, onPreviewShare,
}: {
  result: Result; task: PdfTask; onDownload: (o: Output) => void; onReuse: (o: Output, next?: PdfTask) => void;
  canSecure: boolean; lock: { on: boolean; pw: string; pw2: string }; setLock: (p: Partial<{ on: boolean; pw: string; pw2: string }>) => void;
  dlBusy: boolean; dlError: string; onPreviewShare: (o: Output) => void;
}) {
  const next: { task: PdfTask; label: string }[] = [
    ...(task !== 'compress' ? [{ task: 'compress' as PdfTask, label: 'Compress' }] : []),
    { task: 'organize', label: 'Edit pages' },
    { task: 'merge', label: 'Add files' },
  ];
  const locked = canSecure && lock.on;
  return (
    <div className="rounded-xl border border-border bg-card text-sm" role="status">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
        <h2 className="text-sm font-semibold text-foreground">Ready</h2>
      </div>

      <div className="space-y-3 p-3.5">
        {canSecure && <SecurityBox lock={lock} setLock={setLock} onExpiry={() => onReuse(result.outputs[0], 'secure-share')} />}

        {result.outputs.map((o) => {
          const change = result.inputBytes ? Math.round((1 - o.bytes.length / result.inputBytes) * 100) : 0;
          return (
            <div key={o.name} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-foreground" title={o.name}>{o.name}</p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatBytes(o.bytes.length)}
                  {task === 'compress' && result.inputBytes > 0 && change > 0 && (
                    <span className="ml-1 font-semibold text-emerald-600 dark:text-emerald-400">−{change}%</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDownload(o)}
                disabled={dlBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {dlBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : locked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {locked ? 'Download with password' : 'Download'}
              </button>
            </div>
          );
        })}
        {dlError && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{dlError}</p>}
        {task === 'secure-share' && <ShareSendActions output={result.outputs[0]} onPreview={() => onPreviewShare(result.outputs[0])} />}
        {task === 'compress' && result.inputBytes > 0 && (
          <p className="text-xs text-muted-foreground">Was {formatBytes(result.inputBytes)}.</p>
        )}
        {result.note && <p className="text-xs leading-relaxed text-muted-foreground">{result.note}</p>}
      </div>

      {result.outputs.length === 1 && result.outputs[0].reusable && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3.5 py-2.5 text-xs">
          <span className="text-muted-foreground">Then:</span>
          {next.map((n) => (
            <button key={n.task} type="button" onClick={() => onReuse(result.outputs[0], n.task)} className="font-medium text-primary hover:underline">
              {n.label}
            </button>
          ))}
        </div>
      )}
      <SharePrompt />
    </div>
  );
}

/** "Protect before you share": password on download, or switch to Share with expiry. */
function SecurityBox({
  lock, setLock, onExpiry,
}: { lock: { on: boolean; pw: string; pw2: string }; setLock: (p: Partial<{ on: boolean; pw: string; pw2: string }>) => void; onExpiry: () => void }) {
  return (
    <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ShieldPlus className="h-3.5 w-3.5 text-primary" /> Protect before you share
      </p>
      <Check checked={lock.on} onChange={(v) => setLock({ on: v })} detail={lock.on ? 'The downloaded PDF will ask for this password.' : undefined}>
        <span className="text-xs font-medium">Add a password</span>
      </Check>
      {lock.on && (
        <div className="space-y-1.5">
          <PasswordInput value={lock.pw} onChange={(v) => setLock({ pw: v })} label="Password for the downloaded PDF" show={false} placeholder="Password" />
          <PasswordInput value={lock.pw2} onChange={(v) => setLock({ pw2: v })} label="Repeat the password" show={false} placeholder="Repeat password" />
          {lock.pw2 && lock.pw !== lock.pw2 && <p className="text-xs text-red-600 dark:text-red-400">Does not match</p>}
        </div>
      )}
      <button
        type="button"
        onClick={onExpiry}
        className="flex w-full items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 text-left transition-colors hover:bg-emerald-500/10"
      >
        <Hourglass className="animate-hourglass h-4 w-4 shrink-0 text-emerald-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-foreground">Share with expiry</span>
          <span className="block text-[11px] text-muted-foreground">Stops opening after a date you pick</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

function OpenSharedHint({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
      <FileLock2 className="h-5 w-5 text-primary" />
      <span className="min-w-0 flex-1 text-muted-foreground">
        <strong className="font-medium text-foreground">Received a protected PDF?</strong> Open it here (or a .bdtpdf file). It works until the expiry time the sender chose.
      </span>
      <button type="button" onClick={onPick} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
        Open a file
      </button>
    </div>
  );
}

function WatermarkFields({
  options, update, text, setText, name, setName, until, setUntil, logo, setLogo,
}: {
  options: Options; update: (p: Partial<Options>) => void;
  text: string; setText: (s: string) => void; name: string; setName: (s: string) => void; until: string; setUntil: (s: string) => void;
  logo: { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null; setLogo: (l: { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null) => void;
}) {
  const w = options.watermark;
  const setW = (p: Partial<Options['watermark']>) => update({ watermark: { ...w, ...p } });
  // First visit: start from the remembered preset's text.
  useEffect(() => {
    if (!text) setText(WATERMARK_PRESETS.find((p) => p.id === w.preset)?.text ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const usesName = text.includes('{name}') || text.includes('{until}');
  return (
    <>
      <Field label="Text" hint={<>Write <code className="rounded bg-muted px-1">{'{date}'}</code> for today&apos;s date.</>}>
        <select
          value={WATERMARK_PRESETS.some((p) => p.id === w.preset) ? w.preset : 'custom'}
          onChange={(e) => {
            const p = WATERMARK_PRESETS.find((x) => x.id === e.target.value);
            setW({ preset: e.target.value });
            if (p) setText(p.text);
          }}
          className={inputCls}
          aria-label="Watermark preset"
        >
          {WATERMARK_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input value={text} onChange={(e) => { setText(e.target.value); setW({ preset: 'custom' }); }} placeholder="Your watermark text" className={inputCls} aria-label="Watermark text" />
      </Field>
      {usesName && (
        <Field label="Shared with">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or company" className={inputCls} aria-label="Shared with" />
          <input value={until} onChange={(e) => setUntil(e.target.value)} placeholder="Valid till, e.g. 30 Nov 2026" className={inputCls} aria-label="Valid till" />
        </Field>
      )}
      <Field label="Position">
        <Segmented
          label="Position"
          value={w.layout}
          onChange={(v) => setW({ layout: v })}
          options={(['diagonal', 'tiled', 'center', 'top', 'bottom'] as WatermarkLayout[]).map((l) => ({ value: l, label: l === 'center' ? 'Centre' : l[0].toUpperCase() + l.slice(1) }))}
        />
      </Field>
      <Field label="Look">
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-14">Size</span>
            <input type="range" min={12} max={96} value={w.size} onChange={(e) => setW({ size: Number(e.target.value) })} className="flex-1 accent-primary" aria-label="Watermark size" />
          </label>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-14">Opacity</span>
            <input type="range" min={0.05} max={1} step={0.05} value={w.opacity} onChange={(e) => setW({ opacity: Number(e.target.value) })} className="flex-1 accent-primary" aria-label="Watermark opacity" />
          </label>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-14">Colour</span>
            <div className="flex items-center gap-2">
              {['#dc2626', '#1d4ed8', '#111827', '#6b7280'].map((c) => (
                <button key={c} type="button" onClick={() => setW({ color: c })} aria-label={`Colour ${c}`} aria-pressed={w.color === c}
                  className={`h-5 w-5 rounded-full ${w.color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : 'ring-1 ring-border'}`} style={{ background: c }} />
              ))}
            </div>
            <label className="ml-auto inline-flex items-center gap-1.5 text-foreground">
              <input type="checkbox" checked={w.bold} onChange={(e) => setW({ bold: e.target.checked })} className="accent-primary" /> Bold
            </label>
          </div>
        </div>
      </Field>
      <Field label="Logo">
        {logo ? (
          <button type="button" onClick={() => setLogo(null)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">Remove logo</button>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> Add a logo (PNG or JPG)
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setLogo({ bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type === 'image/png' ? 'image/png' : 'image/jpeg' });
            }} />
          </label>
        )}
      </Field>
      <Check
        checked={w.permanent}
        onChange={(v) => setW({ permanent: v })}
        detail="Pages become images, so the watermark can't be removed. Recommended for Aadhaar and PAN copies. Text can no longer be selected."
      >
        Make it permanent
      </Check>
    </>
  );
}

function PageNumberFields({ value, onChange }: { value: PageNumberOptions; onChange: (p: Partial<PageNumberOptions>) => void }) {
  const positions: PageNumberOptions['position'][] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  return (
    <>
      <Field label="Position">
        {/* A small page: the top row of dots is the top of the page. */}
        <div className="flex h-[104px] w-[78px] flex-col justify-between rounded-md border border-border bg-background p-1.5" role="radiogroup" aria-label="Position">
          {[positions.slice(0, 3), positions.slice(3)].map((row, r) => (
            <div key={r} className="flex justify-between">
              {row.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={value.position === p} aria-label={p.replace('-', ' ')} onClick={() => onChange({ position: p })}
                  className={`h-4 w-4 rounded-sm transition-colors ${value.position === p ? 'bg-primary' : 'bg-muted hover:bg-primary/40'}`} />
              ))}
            </div>
          ))}
        </div>
      </Field>
      <Field label="Style">
        <Segmented
          label="Style"
          value={value.format}
          onChange={(v) => onChange({ format: v })}
          options={[{ value: 'n', label: '1' }, { value: 'page-n', label: 'Page 1' }, { value: 'page-n-of-total', label: 'Page 1 of 9' }, { value: 'n-slash-total', label: '1 / 9' }]}
        />
      </Field>
      <Field label="Start at">
        <input type="number" min={0} value={value.start} onChange={(e) => onChange({ start: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} w-24`} aria-label="First page number" />
      </Field>
      <Check checked={value.skipFirst} onChange={(v) => onChange({ skipFirst: v })}>
        Don&apos;t number the first page (cover)
      </Check>
      <Field label="Size">
        <Segmented label="Size" value={value.size} onChange={(v) => onChange({ size: v })} options={[{ value: 9, label: 'Small' }, { value: 11, label: 'Medium' }, { value: 14, label: 'Large' }]} />
      </Field>
    </>
  );
}

function MetadataFields({
  meta, setMeta, removeAll, setRemoveAll,
}: {
  meta: { title: string; author: string; subject: string; keywords: string; creator: string; producer: string };
  setMeta: (m: { title: string; author: string; subject: string; keywords: string; creator: string; producer: string }) => void;
  removeAll: boolean;
  setRemoveAll: (v: boolean) => void;
}) {
  const field = (key: 'title' | 'author' | 'subject' | 'keywords', label: string) => (
    <Field label={label}>
      <input value={meta[key]} disabled={removeAll} onChange={(e) => setMeta({ ...meta, [key]: e.target.value })} className={inputCls} aria-label={label} />
    </Field>
  );
  return (
    <>
      {field('title', 'Title')}
      {field('author', 'Author')}
      {field('subject', 'Subject')}
      {field('keywords', 'Keywords')}
      {(meta.creator || meta.producer) && <p className="text-xs text-muted-foreground">Made with: {[meta.creator, meta.producer].filter(Boolean).join(' · ')}</p>}
      <Check checked={removeAll} onChange={setRemoveAll} detail="Title, author, software, dates and hidden XMP data. Good to do before sharing a file.">
        Remove all properties
      </Check>
    </>
  );
}

function ShareFields({
  options, update, custom, setCustom, recipient, setRecipient, password, setPassword, password2, setPassword2,
}: {
  options: Options; update: (p: Partial<Options>) => void; custom: string; setCustom: (s: string) => void;
  recipient: string; setRecipient: (s: string) => void;
  password: string; setPassword: (s: string) => void; password2: string; setPassword2: (s: string) => void;
}) {
  return (
    <>
      <Field label="Can be opened for">
        <Segmented
          label="Can be opened for"
          value={options.shareExpiry}
          onChange={(v) => update({ shareExpiry: v })}
          options={[{ value: '1h', label: '1 hour' }, { value: '1d', label: '1 day' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'custom', label: 'Until…' }]}
        />
        {options.shareExpiry === 'custom' && <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className={inputCls} aria-label="Expiry date and time" />}
      </Field>
      <Field label="Recipient name" hint={options.shareWatermark ? 'Optional. Shown in the watermark on every page.' : 'Optional. Shown on the cover page.'}>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} autoComplete="off" className={inputCls} aria-label="Recipient name" />
      </Field>
      <Field label="Password" hint="Optional. Share it separately from the file.">
        <PasswordInput value={password} onChange={setPassword} label="Optional password" show={false} />
        {password && <PasswordInput value={password2} onChange={setPassword2} label="Repeat password" show={false} placeholder="Repeat password" />}
      </Field>
      <Field label="The recipient may">
        <div className="space-y-2">
          <Check checked={options.shareAllowPrint} onChange={(v) => update({ shareAllowPrint: v })} detail="Adds a Print button to the viewer. Printed pages keep the watermark.">
            Print it
          </Check>
          <Check checked={options.shareWatermark} onChange={(v) => update({ shareWatermark: v })} detail="Their name and the expiry date across every page, so a leaked photo shows where it came from.">
            Show a watermark
          </Check>
        </div>
      </Field>
      <p className="rounded-lg bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
        <strong className="font-semibold">How strong is this?</strong> The file opens only in our viewer, which refuses to show it after the expiry time (checked against our server&apos;s clock, not the phone&apos;s).
        It can&apos;t stop screenshots, and an expert could bypass it. Add a password for real protection.
      </p>
    </>
  );
}

/** After creating a Share-with-expiry PDF: send it (WhatsApp / share sheet) or check it as the recipient will see it. */
function ShareSendActions({ output, onPreview }: { output: Output; onPreview: () => void }) {
  const [hint, setHint] = useState('');
  const message = `I've sent you a protected PDF. Open it at ${openUrl()} (the steps are also on the PDF's first page).`;
  const send = async () => {
    setHint('');
    const file = new File([output.bytes as BlobPart], output.name, { type: 'application/pdf' });
    // Phones (and some desktops) can hand the file itself to WhatsApp through the share sheet.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message });
        analytics.track(ANALYTICS_EVENTS.PDF_SHARE, { channel: 'share_sheet_file' });
      } catch {
        // Cancelled by the user.
      }
      return;
    }
    // Elsewhere a website can't attach files to WhatsApp: save it, then open WhatsApp with the message.
    downloadBytes(output.bytes, output.name, 'application/pdf');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setHint('The PDF was saved to your downloads. Attach it in the WhatsApp chat (paperclip icon).');
    analytics.track(ANALYTICS_EVENTS.PDF_SHARE, { channel: 'whatsapp_file' });
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={send}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1fb757]"
      >
        <Send className="h-4 w-4" /> Send on WhatsApp
      </button>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground" role="status">{hint}</p>}
      <button type="button" onClick={onPreview} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
        <Eye className="h-4 w-4" /> Preview as the recipient
      </button>
    </div>
  );
}

/** Post-success "share this tool" nudge (once per page per session). Shares the clean tool URL, never the file. */
function SharePrompt() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const key = `bdt_prompt_${window.location.pathname}`;
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
      return true;
    } catch {
      return false;
    }
  });
  if (!show) return null;
  const url = `${window.location.origin}${window.location.pathname}`;
  const text = `${document.title.split('|')[0].replace(/[—–-]\s*Free Online Tool\s*$/i, '').trim()}: free, private, no sign-up. Bharat Dev Tools`;
  return (
    <div className="space-y-2 border-t border-border px-3.5 py-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground">Saved you time? Share this free tool with a friend.</span>
        <button type="button" onClick={() => setShow(false)} className="-mr-1 -mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analytics.track(ANALYTICS_EVENTS.PDF_SHARE, { channel: 'whatsapp' })}
          className="rounded-md bg-[#25D366] px-2.5 py-1 font-semibold text-white"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => loadShareSheet().then(() => window.BDTShare?.openSheet({ url, source: 'pdf_result' })).catch(() => {})}
          className="rounded-md border border-border px-2.5 py-1 font-medium text-foreground hover:bg-muted"
        >
          More…
        </button>
      </div>
    </div>
  );
}
