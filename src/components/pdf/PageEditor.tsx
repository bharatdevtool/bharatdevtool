'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  MousePointer2, Type, PenLine, ImagePlus, Eraser, Highlighter, Square, Minus, SquareDashed, Undo2, Redo2,
  Trash2, Bold, Italic, ScanSearch, CalendarDays, LoaderCircle, TextCursorInput, Link2, Check, X, CircleDot,
  Strikethrough, Underline, Circle, ArrowUpRight, ChevronDown, ZoomIn, ZoomOut, Replace,
} from 'lucide-react';
import type { EditObject, FormFieldInfo } from '@/lib/pdf/overlay';
import type { SensitiveKind, TextRun } from '@/lib/pdf/find';
import SignaturePad, { type SignatureImage } from './SignaturePad';
import { STANDARD_FONTS, WEB_FONTS, fontCss, isStandardFont, systemFamilyOf, type FontKey } from '@/lib/pdf/fonts';
import { canListLocalFonts, listLocalFonts, showWebFont } from './font-loader';

export type UIObject = EditObject & { pageKey: string };
export type EditorMode = 'edit' | 'sign' | 'redact';
type Tool =
  | 'select' | 'edittext' | 'text' | 'date' | 'image' | 'signature' | 'whiteout' | 'highlight' | 'strike' | 'underline'
  | 'box' | 'ellipse' | 'line' | 'arrow' | 'link' | 'check' | 'cross' | 'dot' | 'redact';
type ToolDef = { id: Tool; label: string; icon: React.ReactNode };
type ToolItem = ToolDef | { group: string; items: ToolDef[] };
/** Tools that drag out a box (or a line) on the page. */
const DRAW_TOOLS: Tool[] = ['whiteout', 'highlight', 'strike', 'underline', 'box', 'ellipse', 'redact', 'line', 'arrow', 'link'];
/** Tools that can snap to a line of existing text. */
const RUN_TOOLS: Tool[] = ['edittext', 'link', 'highlight', 'strike', 'underline'];
const MARK_TOOLS: Tool[] = ['check', 'cross', 'dot'];
/** Tools whose colour comes from the ink swatches. */
const INK_TOOLS: Tool[] = ['strike', 'underline', 'box', 'ellipse', 'line', 'arrow', 'check', 'cross', 'dot'];
// Same values as lib/pdf (kept here so the editor doesn't load pdf-lib up front).
const STRIKE_AT = 0.6;
const UNDERLINE_AT = 0.9;
const MARK_STROKES: Record<'check' | 'cross', [number, number][][]> = {
  check: [[[0.14, 0.55], [0.4, 0.8], [0.88, 0.18]]],
  cross: [[[0.18, 0.18], [0.82, 0.82]], [[0.82, 0.18], [0.18, 0.82]]],
};
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
/** Font key: 'sans' | 'serif' | 'mono' | 'web:<id>' | 'sys:<family>' (see lib/pdf/fonts). */
type TextStyle = { size: number; color: string; bold: boolean; italic: boolean; family: FontKey };

export interface FindRequest {
  kinds: SensitiveKind[];
  custom: string;
}
export interface FindSummary {
  total: number;
  byKind: Partial<Record<SensitiveKind, number>>;
  pagesWithoutText: number;
}

interface PageEditorProps {
  mode: EditorMode;
  doc: PDFDocumentProxy | null;
  pageKeys: string[];
  /** Displayed page sizes in points. */
  sizes: { w: number; h: number }[];
  objects: UIObject[];
  onChange: (next: UIObject[], commit: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  formFields: FormFieldInfo[];
  formValues: Record<string, string | boolean>;
  setFormValue: (name: string, value: string | boolean) => void;
  flattenForm: boolean;
  setFlattenForm: (v: boolean) => void;
  onFind: (req: FindRequest) => Promise<FindSummary>;
  renderPage: (doc: PDFDocumentProxy, index: number, scale: number) => Promise<HTMLCanvasElement>;
  /** Text already in the PDF, with positions (for "Edit text" and "Link"). */
  getTextRuns: (doc: PDFDocumentProxy, index: number) => Promise<TextRun[]>;
}

/** First baseline below the top of a text box with line-height 1.2 (same as ASCENT in lib/pdf/draw). */
const TEXT_ASCENT = 0.856;


const COLORS = ['#111827', '#1d4ed8', '#b91c1c', '#047857', '#ffffff'];
const HIGHLIGHTS = ['#ffeb3b', '#a7f3d0', '#fbcfe8', '#bfdbfe'];
let seq = 0;
const newObjId = () => `o${Date.now().toString(36)}${(seq++).toString(36)}`;
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
/** Keep receiving moves outside the element; never let a capture failure abort the gesture. */
const capture = (e: React.PointerEvent) => {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* pointer already released or synthetic */
  }
};
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const ic = 'h-4 w-4';
const FORM_MARKS: ToolItem = {
  group: 'Marks',
  items: [
    { id: 'check', label: 'Tick', icon: <Check className={ic} /> },
    { id: 'cross', label: 'Cross', icon: <X className={ic} /> },
    { id: 'dot', label: 'Dot', icon: <CircleDot className={ic} /> },
  ],
};
const TOOLS: Record<EditorMode, ToolItem[]> = {
  edit: [
    { id: 'select', label: 'Select', icon: <MousePointer2 className={ic} /> },
    { id: 'edittext', label: 'Edit text', icon: <TextCursorInput className={ic} /> },
    { id: 'text', label: 'Add text', icon: <Type className={ic} /> },
    { id: 'link', label: 'Link', icon: <Link2 className={ic} /> },
    { id: 'signature', label: 'Sign', icon: <PenLine className={ic} /> },
    { id: 'image', label: 'Image', icon: <ImagePlus className={ic} /> },
    FORM_MARKS,
    { id: 'whiteout', label: 'White-out', icon: <Eraser className={ic} /> },
    {
      group: 'Markup',
      items: [
        { id: 'highlight', label: 'Highlight', icon: <Highlighter className={ic} /> },
        { id: 'strike', label: 'Strike-through', icon: <Strikethrough className={ic} /> },
        { id: 'underline', label: 'Underline', icon: <Underline className={ic} /> },
      ],
    },
    {
      group: 'Shapes',
      items: [
        { id: 'box', label: 'Box', icon: <Square className={ic} /> },
        { id: 'ellipse', label: 'Ellipse', icon: <Circle className={ic} /> },
        { id: 'line', label: 'Line', icon: <Minus className={ic} /> },
        { id: 'arrow', label: 'Arrow', icon: <ArrowUpRight className={ic} /> },
      ],
    },
  ],
  sign: [
    { id: 'select', label: 'Select', icon: <MousePointer2 className={ic} /> },
    { id: 'signature', label: 'Signature', icon: <PenLine className={ic} /> },
    { id: 'text', label: 'Text', icon: <Type className={ic} /> },
    { id: 'date', label: 'Date', icon: <CalendarDays className={ic} /> },
    FORM_MARKS,
  ],
  redact: [
    { id: 'select', label: 'Select', icon: <MousePointer2 className={ic} /> },
    { id: 'redact', label: 'Redact box', icon: <SquareDashed className={ic} /> },
  ],
};

const HINTS: Partial<Record<Tool, string>> = {
  edittext: 'Click any text in the PDF to change it. Your new text covers the old line.',
  link: 'Click a line of text, or drag over any area, then type a web address, email or page number.',
  text: 'Click on a page to add text.',
  date: "Click on a page to add today's date.",
  whiteout: 'Drag over text to cover it with white. Then use Add text to type the correction on top.',
  highlight: 'Click a line of text, or drag over any area, to highlight it.',
  strike: 'Click a line of text, or drag over it, to strike it through.',
  underline: 'Click a line of text, or drag under it, to underline it.',
  box: 'Drag to draw a box.',
  ellipse: 'Drag to draw an ellipse, e.g. to circle something.',
  line: 'Drag to draw a line.',
  arrow: 'Drag to draw an arrow. It points where you let go.',
  check: 'Click to put a tick. Keep clicking to tick more boxes.',
  cross: 'Click to put a cross. Keep clicking to add more.',
  dot: 'Click to put a dot. Keep clicking to add more.',
  redact: 'Drag over anything to black it out. The text underneath is removed when you save.',
};

const FIND_KINDS: { id: SensitiveKind; label: string }[] = [
  { id: 'aadhaar', label: 'Aadhaar (all 12 digits)' },
  { id: 'aadhaar-mask', label: 'Mask Aadhaar (first 8 digits only)' },
  { id: 'pan', label: 'PAN' },
  { id: 'phone', label: 'Phone numbers' },
  { id: 'email', label: 'Email addresses' },
  { id: 'ifsc', label: 'IFSC codes' },
  { id: 'account', label: 'Account / long numbers' },
];

type Drag =
  | { kind: 'create'; id: string; pageKey: string; rect: DOMRect; u0: number; v0: number }
  | { kind: 'move'; id: string; rect: DOMRect; x0: number; y0: number; orig: UIObject; moved: boolean }
  | { kind: 'resize'; id: string; rect: DOMRect; x0: number; y0: number; orig: UIObject };

export default function PageEditor(props: PageEditorProps) {
  const { mode, doc, pageKeys, sizes, objects, onChange } = props;
  // Signature/Image are actions that open a picker; the active tool stays Select until something is pending.
  const [tool, setTool] = useState<Tool>(mode === 'redact' ? 'redact' : 'select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; aspect: number; isSignature: boolean } | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [textStyle, setTextStyle] = useState<TextStyle>({ size: 12, color: COLORS[0], bold: false, italic: false, family: 'sans' });
  // Existing text per page, loaded when "Edit text" or "Link" is first used.
  const [runs, setRuns] = useState<Record<string, TextRun[]>>({});
  const showRuns = RUN_TOOLS.includes(tool);
  const [hlColor, setHlColor] = useState(HIGHLIGHTS[0]);
  const [inkColor, setInkColor] = useState('#dc2626');
  // 1 = pages fit the column; other values zoom in or out from there.
  const [zoom, setZoom] = useState(1);
  const imageInput = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  // Latest objects, updated synchronously on every change: a fast drag can deliver move + release
  // before React re-renders, and the release must commit the moved position, not the old one.
  const objectsRef = useRef(objects);
  useEffect(() => {
    // During a drag this component owns the latest state; a late effect from an earlier render
    // must not overwrite it. Outside drags (undo, redo, find) the props are the truth.
    if (!drag.current) objectsRef.current = objects;
  }, [objects]);
  const emit = useCallback(
    (next: UIObject[], commit: boolean) => {
      objectsRef.current = next;
      onChange(next, commit);
    },
    [onChange],
  );

  // Pages fill the column width (max 900 px) and follow window resizes.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(900, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadRuns = useCallback(
    async (i: number): Promise<TextRun[]> => {
      if (!doc) return [];
      try {
        return (await props.getTextRuns(doc, i)).filter((r) => r.charX); // horizontal text only
      } catch {
        return []; // a page without readable text just has nothing to click
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc],
  );

  useEffect(() => {
    if (!showRuns || !doc) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < pageKeys.length && !cancelled; i++) {
        const key = pageKeys[i];
        if (runs[key]) continue;
        const list = await loadRuns(i);
        if (!cancelled) setRuns((m) => ({ ...m, [key]: list }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRuns, doc, pageKeys]);

  // Load the free web fonts in use so text shows in them on screen.
  useEffect(() => {
    showWebFont(textStyle.family);
    for (const o of objects) if (o.type === 'text') showWebFont(o.family);
  }, [objects, textStyle.family]);

  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const update = useCallback(
    (id: string, patch: Partial<UIObject>, commit: boolean) =>
      emit(objectsRef.current.map((o) => (o.id === id ? ({ ...o, ...patch } as UIObject) : o)), commit),
    [emit],
  );
  const remove = useCallback(
    (id: string) => {
      emit(objectsRef.current.filter((o) => o.id !== id), true);
      setSelectedId(null);
      setEditingId(null);
    },
    [emit],
  );

  const pickTool = (t: Tool) => {
    setSelectedId(null);
    setEditingId(null);
    if (t === 'signature') {
      setPadOpen(true);
      return;
    }
    if (t === 'image') {
      imageInput.current?.click();
      return;
    }
    setPending(null);
    setTool(t);
  };

  // Keyboard: Delete, Esc, undo/redo, arrow-key nudge.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) props.onRedo();
        else props.onUndo();
        return;
      }
      if (typing) return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        setPending(null);
        setTool('select');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        remove(selectedId);
      } else if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.002;
        const du = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dv = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const patch: Partial<UIObject> = { u: clamp(selected.u + du), v: clamp(selected.v + dv) };
        if (selected.type === 'line') Object.assign(patch, { u2: clamp(selected.u2 + du), v2: clamp(selected.v2 + dv) });
        update(selected.id, patch, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Pointer handling (shared by every page) ──
  const frac = (e: React.PointerEvent | PointerEvent, rect: DOMRect) => ({ u: clamp((e.clientX - rect.left) / rect.width), v: clamp((e.clientY - rect.top) / rect.height) });

  const onPageDown = (e: React.PointerEvent<HTMLDivElement>, pageKey: string, pageIndex: number) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { u, v } = frac(e, rect);
    const size = sizes[pageIndex];
    setEditingId(null);

    if (pending) {
      const w = pending.isSignature ? 0.25 : 0.35;
      const h = (w * size.w) / pending.aspect / size.h;
      const obj: UIObject = { id: newObjId(), type: 'image', pageKey, page: pageIndex, u: clamp(u - w / 2, 0, 1 - w), v: clamp(v - h / 2, 0, 1 - h), w, h, bytes: pending.bytes, mime: pending.mime, isSignature: pending.isSignature };
      emit([...objectsRef.current, obj], true);
      setPending(null);
      setTool('select');
      setSelectedId(obj.id);
      return;
    }
    if (tool === 'text' || tool === 'date') {
      // Without this the browser moves focus to the page on mouse-down, the new box's textarea
      // loses focus at once, and an empty text box is removed as soon as it appears.
      e.preventDefault();
      const obj: UIObject = { id: newObjId(), type: 'text', pageKey, page: pageIndex, u, v: clamp(v - (textStyle.size * 0.6) / size.h), text: tool === 'date' ? today() : '', ...textStyle };
      emit([...objectsRef.current, obj], tool === 'date');
      setSelectedId(obj.id);
      if (tool === 'text') setEditingId(obj.id);
      setTool('select');
      return;
    }
    if (MARK_TOOLS.includes(tool)) {
      // A 14 pt square centred on the click; the tool stays on so several boxes can be ticked.
      e.preventDefault();
      const w = 14 / size.w;
      const h = 14 / size.h;
      const obj: UIObject = { id: newObjId(), type: 'mark', kind: tool as 'check' | 'cross' | 'dot', pageKey, page: pageIndex, u: clamp(u - w / 2, 0, 1 - w), v: clamp(v - h / 2, 0, 1 - h), w, h, color: inkColor === '#dc2626' && tool === 'check' ? '#047857' : inkColor };
      emit([...objectsRef.current, obj], true);
      setSelectedId(obj.id);
      return;
    }
    if (DRAW_TOOLS.includes(tool)) {
      capture(e);
      const id = newObjId();
      const obj: UIObject =
        tool === 'line' || tool === 'arrow'
          ? { id, type: 'line', pageKey, page: pageIndex, u, v, u2: u, v2: v, color: inkColor, width: 1.5, arrow: tool === 'arrow' }
          : tool === 'link'
          ? { id, type: 'link', pageKey, page: pageIndex, u, v, w: 0, h: 0, url: '' }
          : {
              id, type: 'rect', pageKey, page: pageIndex, u, v, w: 0, h: 0, style: tool as Extract<UIObject, { type: 'rect' }>['style'],
              color: tool === 'highlight' ? hlColor : tool === 'whiteout' || tool === 'redact' ? '#000000' : inkColor,
            };
      emit([...objectsRef.current, obj], false);
      drag.current = { kind: 'create', id, pageKey, rect, u0: u, v0: v };
      return;
    }
    setSelectedId(null);
  };

  const onObjDown = (e: React.PointerEvent, o: UIObject) => {
    // Objects can be grabbed unless a drawing tool is active (so a new box can start on top of an old one).
    const drawing = tool === 'text' || tool === 'date' || DRAW_TOOLS.includes(tool) || MARK_TOOLS.includes(tool);
    if (e.button !== 0 || pending || drawing) return;
    e.stopPropagation();
    if (editingId === o.id) return;
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-editor-page]') as HTMLElement;
    capture(e);
    setSelectedId(o.id);
    drag.current = { kind: 'move', id: o.id, rect: pageEl.getBoundingClientRect(), x0: e.clientX, y0: e.clientY, orig: o, moved: false };
  };

  const onHandleDown = (e: React.PointerEvent, o: UIObject) => {
    e.stopPropagation();
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-editor-page]') as HTMLElement;
    capture(e);
    drag.current = { kind: 'resize', id: o.id, rect: pageEl.getBoundingClientRect(), x0: e.clientX, y0: e.clientY, orig: o };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'create') {
      const { u, v } = frac(e, d.rect);
      const o = objectsRef.current.find((x) => x.id === d.id);
      if (!o) return;
      if (o.type === 'line') update(d.id, { u2: u, v2: v }, false);
      else update(d.id, { u: Math.min(d.u0, u), v: Math.min(d.v0, v), w: Math.abs(u - d.u0), h: Math.abs(v - d.v0) }, false);
      return;
    }
    const du = (e.clientX - d.x0) / d.rect.width;
    const dv = (e.clientY - d.y0) / d.rect.height;
    const o = d.orig;
    if (d.kind === 'move') {
      if (Math.abs(du) + Math.abs(dv) > 0.002) d.moved = true;
      if (o.type === 'line') update(o.id, { u: clamp(o.u + du), v: clamp(o.v + dv), u2: clamp(o.u2 + du), v2: clamp(o.v2 + dv) }, false);
      else if (o.type === 'text') update(o.id, { u: clamp(o.u + du), v: clamp(o.v + dv) }, false);
      else update(o.id, { u: clamp(o.u + du, 0, 1 - o.w), v: clamp(o.v + dv, 0, 1 - o.h) }, false);
    } else if (o.type === 'line') {
      update(o.id, { u2: clamp(o.u2 + du), v2: clamp(o.v2 + dv) }, false);
    } else if (o.type === 'image') {
      const w = clamp(o.w + du, 0.02, 1 - o.u);
      update(o.id, { w, h: (o.h * w) / o.w }, false); // keep aspect
    } else if (o.type === 'rect' || o.type === 'link') {
      update(o.id, { w: clamp(o.w + du, 0.005, 1 - o.u), h: clamp(o.h + dv, 0.004, 1 - o.v) }, false);
    } else if (o.type === 'mark') {
      const w = clamp(o.w + du, 0.008, 1 - o.u);
      update(o.id, { w, h: (w * d.rect.width) / d.rect.height }, false); // stays square
    } else if (o.type === 'text') {
      update(o.id, { size: Math.round(clamp(o.size * (1 + du * 4), 6, 96)) }, false);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'create') {
      const o = objectsRef.current.find((x) => x.id === d.id);
      if (o && o.type === 'link' && o.w < 0.01 && o.h < 0.006) {
        // A click on empty space with the Link tool: nothing to link.
        emit(objectsRef.current.filter((x) => x.id !== o.id), false);
        return;
      } else if (o && o.type === 'rect' && o.w < 0.01 && o.h < 0.006) {
        // A click instead of a drag: drop a sensible default size.
        update(o.id, { w: 0.25, h: ['highlight', 'strike', 'underline'].includes(o.style) ? 0.02 : 0.04 }, true);
      } else if (o && o.type === 'line' && Math.hypot(o.u2 - o.u, o.v2 - o.v) < 0.01) {
        update(o.id, { u2: clamp(o.u + 0.3) }, true);
      } else {
        emit(objectsRef.current, true);
      }
      setSelectedId(d.id);
      return;
    }
    if (d.kind === 'move' && !d.moved) return;
    emit(objectsRef.current, true);
  };

  /** Click on a line of existing text with "Edit text" or "Link". */
  const onRunDown = (e: React.PointerEvent, pageKey: string, pageIndex: number, run: TextRun, runIndex: number) => {
    if (e.button !== 0) return;
    e.preventDefault(); // keep focus for the text box that opens
    e.stopPropagation();
    const size = sizes[pageIndex] ?? { w: 595, h: 842 };
    if (tool === 'highlight' || tool === 'strike' || tool === 'underline') {
      const obj: UIObject = {
        id: newObjId(), type: 'rect', pageKey, page: pageIndex, u: run.u, v: run.v, w: run.w, h: run.h,
        style: tool, color: tool === 'highlight' ? hlColor : inkColor,
      };
      emit([...objectsRef.current, obj], true);
      setSelectedId(obj.id);
      return;
    }
    if (tool === 'link') {
      const pad = 1.5;
      const obj: UIObject = {
        id: newObjId(), type: 'link', pageKey, page: pageIndex,
        u: clamp(run.u - pad / size.w), v: clamp(run.v - pad / size.h), w: run.w + (2 * pad) / size.w, h: run.h + (2 * pad) / size.h, url: '',
      };
      emit([...objectsRef.current, obj], true);
      setSelectedId(obj.id);
      return;
    }
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-editor-page]') as HTMLElement | null;
    const obj = makeReplacement(pageKey, pageIndex, run, runIndex, pageEl?.querySelector('canvas') ?? null, run.str);
    emit([...objectsRef.current, obj], true);
    setSelectedId(obj.id);
    setEditingId(obj.id);
  };

  /** A text object that replaces a line of the PDF: same place, size, colour and style, on a cover. */
  const makeReplacement = (pageKey: string, pageIndex: number, run: TextRun, runIndex: number, canvas: HTMLCanvasElement | null, text: string): UIObject => {
    const size = sizes[pageIndex] ?? { w: 595, h: 842 };
    const fontPt = run.fontPt ?? (run.h * size.h) / 1.15;
    const { fg, bg } = canvas ? sampleColors(canvas, run) : { fg: COLORS[0], bg: '#ffffff' };
    // Same baseline as the original: pdf.js gives the top as baseline − font size.
    const baseline = run.v * size.h + fontPt;
    const padX = (fontPt * 0.12) / size.w;
    const padY = (fontPt * 0.12) / size.h;
    return {
      id: newObjId(), type: 'text', pageKey, page: pageIndex,
      u: run.u, v: clamp((baseline - fontPt * TEXT_ASCENT) / size.h),
      text, size: Math.round(fontPt * 10) / 10, color: fg, bold: !!run.bold, italic: !!run.italic, family: run.family ?? 'sans',
      cover: { u: clamp(run.u - padX), v: clamp(run.v - padY), w: run.w + 2 * padX, h: run.h + 2 * padY, color: bg },
      source: `${pageKey}:${runIndex}`,
    };
  };

  /** Find & replace in every line of text (lines already edited are changed in place). */
  const replaceAll = async (find: string, replacement: string, matchCase: boolean): Promise<{ count: number; lines: number }> => {
    if (!doc || !find) return { count: 0, lines: 0 };
    const rx = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
    const all: Record<string, TextRun[]> = { ...runs };
    let next = [...objectsRef.current];
    let count = 0;
    let lines = 0;
    for (let i = 0; i < pageKeys.length; i++) {
      const key = pageKeys[i];
      all[key] ??= await loadRuns(i);
      let canvas: HTMLCanvasElement | null = null;
      for (let ri = 0; ri < all[key].length; ri++) {
        const run = all[key][ri];
        const existing = next.find((o) => o.type === 'text' && o.source === `${key}:${ri}`) as Extract<UIObject, { type: 'text' }> | undefined;
        const text = existing ? existing.text : run.str;
        const found = text.match(rx);
        if (!found) continue;
        count += found.length;
        lines++;
        const changed = text.replace(rx, () => replacement);
        if (existing) {
          next = next.map((o) => (o === existing ? { ...existing, text: changed } : o));
        } else {
          // Render the page once (it may not be on screen) to match the text and background colours.
          canvas ??= await props.renderPage(doc, i, 1.5).catch(() => null);
          next.push(makeReplacement(key, i, run, ri, canvas, changed));
        }
      }
      if (canvas) canvas.width = canvas.height = 0;
    }
    setRuns(all);
    if (lines) emit(next, true);
    return { count, lines };
  };

  const onImageFile = async (file: File) => {
    try {
      const bmp = await createImageBitmap(file);
      const aspect = bmp.width / bmp.height;
      bmp.close();
      const isPng = file.type === 'image/png';
      let bytes = new Uint8Array(await file.arrayBuffer());
      let mime: 'image/png' | 'image/jpeg' = isPng ? 'image/png' : 'image/jpeg';
      if (!isPng && file.type !== 'image/jpeg') {
        // WebP/GIF/AVIF → PNG so pdf-lib can embed it.
        const b2 = await createImageBitmap(file);
        const c = document.createElement('canvas');
        c.width = b2.width;
        c.height = b2.height;
        c.getContext('2d')!.drawImage(b2, 0, 0);
        b2.close();
        const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
        bytes = new Uint8Array(await blob.arrayBuffer());
        mime = 'image/png';
      }
      setPending({ bytes, mime, aspect, isSignature: false });
      setTool('image');
    } catch {
      /* unsupported image: ignore */
    }
  };

  const hint = pending
    ? `Click on a page to place the ${pending.isSignature ? 'signature' : 'image'}.`
    : mode === 'sign' && !objects.some((o) => o.type === 'image' && o.isSignature)
    ? 'Click Signature to draw, type or upload your signature, then click the page to place it.'
    : showRuns && pageKeys.length > 0 && pageKeys.every((k) => runs[k]) && pageKeys.every((k) => runs[k].length === 0)
    ? 'This PDF has no text to select: it is a scan or a picture. Use White-out to cover something, then Add text to type on top.'
    : HINTS[tool];

  return (
    <div className="space-y-3">
      <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onImageFile(e.target.files[0]); e.target.value = ''; }} />
      {padOpen && (
        <SignaturePad
          onClose={() => setPadOpen(false)}
          onDone={(sig: SignatureImage) => {
            setPadOpen(false);
            setPending({ bytes: sig.bytes, mime: 'image/png', aspect: sig.aspect, isSignature: true });
            setTool('signature');
          }}
        />
      )}

      {/* Toolbar (sticks to the top while scrolling pages) */}
      <div className="sticky top-16 z-30 space-y-2 rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-1">
          {TOOLS[mode].map((t) => {
            if ('group' in t) return <ToolGroup key={t.group} group={t} tool={pending ? null : tool} onPick={pickTool} />;
            const active = (tool === t.id && !pending) || (pending && ((t.id === 'signature' && pending.isSignature) || (t.id === 'image' && !pending.isSignature)));
            return (
              <button key={t.id} type="button" onClick={() => pickTool(t.id)} aria-pressed={!!active} title={t.label}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <button type="button" onClick={props.onUndo} disabled={!props.canUndo} className="rounded-lg p-1.5 text-foreground hover:bg-muted disabled:opacity-30" aria-label="Undo" title="Undo (Ctrl/⌘+Z)">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={props.onRedo} disabled={!props.canRedo} className="rounded-lg p-1.5 text-foreground hover:bg-muted disabled:opacity-30" aria-label="Redo" title="Redo (Shift+Ctrl/⌘+Z)">
            <Redo2 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]}
            className="rounded-lg p-1.5 text-foreground hover:bg-muted disabled:opacity-30" aria-label="Zoom out" title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setZoom(1)} className="min-w-11 rounded-lg px-1.5 py-1 text-xs tabular-nums text-foreground hover:bg-muted" title="Fit to width">
            {zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}
          </button>
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]}
            className="rounded-lg p-1.5 text-foreground hover:bg-muted disabled:opacity-30" aria-label="Zoom in" title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          {(tool === 'text' || selected?.type === 'text') && (
            <TextControls
              style={
                selected?.type === 'text'
                  ? { size: selected.size, color: selected.color, bold: selected.bold, italic: !!selected.italic, family: selected.family ?? 'sans' }
                  : textStyle
              }
              onChange={(s) => {
                setTextStyle((cur) => ({ ...cur, ...s }));
                if (selected?.type === 'text') update(selected.id, s, true);
              }}
            />
          )}
          {(tool === 'highlight' || (selected?.type === 'rect' && selected.style === 'highlight')) && (
            <Swatches colors={HIGHLIGHTS} value={selected?.type === 'rect' ? selected.color : hlColor} onPick={(c) => { setHlColor(c); if (selected?.type === 'rect') update(selected.id, { color: c }, true); }} />
          )}
          {(() => {
            const inkSelected =
              selected && (selected.type === 'line' || selected.type === 'mark' || (selected.type === 'rect' && ['box', 'ellipse', 'strike', 'underline'].includes(selected.style)));
            if (!inkSelected && !INK_TOOLS.includes(tool)) return null;
            return (
              <Swatches
                colors={['#111827', '#1d4ed8', '#047857', '#dc2626']}
                value={inkSelected ? (selected as { color: string }).color : inkColor}
                onPick={(c) => {
                  setInkColor(c);
                  if (inkSelected) update(selected.id, { color: c }, true);
                }}
              />
            );
          })()}
          {selected?.type === 'link' && (
            <LinkControls key={selected.id} link={selected} pageCount={pageKeys.length} onChange={(p) => update(selected.id, p, true)} />
          )}
          {selected && (
            <button type="button" onClick={() => remove(selected.id)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400" aria-label="Delete selected item">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
        {hint && <p className="px-1 text-xs text-muted-foreground">{hint}</p>}
      </div>

      {mode === 'redact' && <FindPanel onFind={props.onFind} />}
      {mode !== 'redact' && props.formFields.length > 0 && <FormPanel {...props} />}
      {mode === 'edit' && <ReplacePanel onReplace={replaceAll} />}

      {/* Pages */}
      <div ref={wrap} className="developer-scrollbar overflow-x-auto rounded-xl bg-muted/40 p-3 sm:p-4" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="flex w-max min-w-full flex-col items-center gap-4">
        {!doc && (
          <div className="flex h-60 items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Preparing pages…
          </div>
        )}
        {doc &&
          pageKeys.map((key, i) => (
            <EditorPage
              key={key}
              doc={doc}
              index={i}
              size={sizes[i] ?? { w: 595, h: 842 }}
              width={Math.round((width - 8) * zoom)}
              renderPage={props.renderPage}
              cursor={pending || tool !== 'select' ? 'crosshair' : 'default'}
              onDown={(e) => onPageDown(e, key, i)}
            >
              {showRuns &&
                (runs[key] ?? []).map((r, ri) =>
                  tool === 'edittext' && objects.some((o) => o.type === 'text' && o.source === `${key}:${ri}`) ? null : (
                    <div
                      key={ri}
                      onPointerDown={(e) => onRunDown(e, key, i, r, ri)}
                      title={tool === 'link' ? 'Add a link here' : tool === 'edittext' ? 'Edit this text' : `${tool[0].toUpperCase()}${tool.slice(1)} this line`}
                      className={`absolute rounded-[2px] hover:bg-primary/10 hover:outline hover:outline-1 hover:outline-primary ${tool === 'edittext' || tool === 'link' ? 'outline-1 outline-dashed outline-primary/30' : ''} ${tool === 'edittext' ? 'cursor-text' : 'cursor-pointer'}`}
                      style={{ left: `${r.u * 100}%`, top: `${r.v * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                    />
                  ),
                )}
              {objects
                .filter((o) => o.pageKey === key)
                .map((o) => (
                  <ObjectView
                    key={o.id}
                    o={o}
                    pxPerPt={((width - 8) * zoom) / (sizes[i]?.w ?? 595)}
                    selected={o.id === selectedId}
                    editing={o.id === editingId}
                    onDown={(e) => onObjDown(e, o)}
                    onHandleDown={(e) => onHandleDown(e, o)}
                    onDoubleClick={() => o.type === 'text' && setEditingId(o.id)}
                    onText={(text, commit) => update(o.id, { text }, commit)}
                    onStopEditing={() => {
                      setEditingId(null);
                      const cur = objectsRef.current.find((x) => x.id === o.id);
                      // An emptied replacement keeps its cover: that deletes the original text.
                      if (cur?.type === 'text' && !cur.text.trim() && !cur.cover) remove(o.id);
                      else emit(objectsRef.current, true);
                    }}
                  />
                ))}
            </EditorPage>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── One page: canvas rendered when it scrolls into view, overlay on top ─────

function EditorPage({
  doc, index, size, width, renderPage, cursor, onDown, children,
}: {
  doc: PDFDocumentProxy;
  index: number;
  size: { w: number; h: number };
  width: number;
  renderPage: PageEditorProps['renderPage'];
  cursor: string;
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const height = Math.round((width * size.h) / size.w);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // Render pages near the screen; release pages far away so a 300-page PDF doesn't hold
    // hundreds of full-size page images in memory.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) {
      const old = host.current?.querySelector('[data-canvas-slot] canvas') as HTMLCanvasElement | null;
      if (old) {
        old.width = old.height = 0; // frees the pixels at once
        old.remove();
      }
      return;
    }
    if (width < 50) return;
    let cancelled = false;
    // Sharp on retina screens, but never wider than ~3000 px (zoomed pages would use a lot of memory).
    const px = Math.min(width * Math.min(2, window.devicePixelRatio || 1), Math.max(width, 3000));
    renderPage(doc, index, px / size.w).then((canvas) => {
      if (cancelled || !host.current) return;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.setAttribute('aria-hidden', 'true');
      const slot = host.current.querySelector('[data-canvas-slot]');
      slot?.replaceChildren(canvas);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, doc, index, width, size.w, renderPage]);

  return (
    <div ref={host} data-editor-page className="relative bg-white shadow-md" style={{ width, height }}>
      <div data-canvas-slot className="absolute inset-0" />
      <div className="absolute inset-0 touch-none" style={{ cursor }} onPointerDown={onDown} role="presentation">
        {children}
      </div>
      <span className="pointer-events-none absolute -left-1 top-1 -translate-x-full text-[11px] tabular-nums text-muted-foreground">{index + 1}</span>
    </div>
  );
}

// ─── An object on the page ───────────────────────────────────────────────────

function ObjectView({
  o, pxPerPt, selected, editing, onDown, onHandleDown, onDoubleClick, onText, onStopEditing,
}: {
  o: UIObject;
  pxPerPt: number;
  selected: boolean;
  editing: boolean;
  onDown: (e: React.PointerEvent) => void;
  onHandleDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onText: (t: string, commit: boolean) => void;
  onStopEditing: () => void;
}) {
  const ring = selected ? 'outline outline-2 outline-offset-1 outline-primary' : 'hover:outline hover:outline-1 hover:outline-primary/60';
  const handle = selected && (
    <span onPointerDown={onHandleDown} className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow" aria-hidden="true" />
  );

  if (o.type === 'line') {
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {o.arrow && (
          <defs>
            <marker id={`ah-${o.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" markerUnits="strokeWidth">
              <path d="M1,1 L9,5 L1,9" fill="none" stroke={o.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
        )}
        <line x1={`${o.u * 100}%`} y1={`${o.v * 100}%`} x2={`${o.u2 * 100}%`} y2={`${o.v2 * 100}%`} stroke={o.color} strokeWidth={o.width * pxPerPt}
          markerEnd={o.arrow ? `url(#ah-${o.id})` : undefined} />
        <line x1={`${o.u * 100}%`} y1={`${o.v * 100}%`} x2={`${o.u2 * 100}%`} y2={`${o.v2 * 100}%`} stroke={selected ? 'rgba(59,130,246,.35)' : 'transparent'} strokeWidth={12}
          className="pointer-events-auto cursor-move" onPointerDown={onDown} />
        {selected && <circle cx={`${o.u2 * 100}%`} cy={`${o.v2 * 100}%`} r={6} fill="#3b82f6" stroke="white" strokeWidth={2} className="pointer-events-auto cursor-crosshair" onPointerDown={onHandleDown} />}
      </svg>
    );
  }

  if (o.type === 'text') {
    const fontSize = o.size * pxPerPt;
    const lines = o.text.split('\n');
    const longest = Math.max(4, ...lines.map((l) => l.length));
    const style: React.CSSProperties = {
      left: `${o.u * 100}%`,
      top: `${o.v * 100}%`,
      fontSize,
      lineHeight: 1.2,
      color: o.color,
      fontWeight: o.bold ? 700 : 400,
      fontStyle: o.italic ? 'italic' : undefined,
      fontFamily: fontCss(o.family),
    };
    const cover = o.cover && (
      <div
        className="pointer-events-none absolute"
        style={{ left: `${o.cover.u * 100}%`, top: `${o.cover.v * 100}%`, width: `${o.cover.w * 100}%`, height: `${o.cover.h * 100}%`, background: o.cover.color }}
      />
    );
    if (editing) {
      return (
        <>
        {cover}
        <textarea
          autoFocus
          value={o.text}
          onChange={(e) => onText(e.target.value, false)}
          onBlur={onStopEditing}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget as HTMLTextAreaElement).blur()}
          placeholder="Type here"
          rows={lines.length}
          className="absolute resize-none overflow-hidden whitespace-pre bg-white/70 p-0 outline outline-2 outline-primary"
          style={{ ...style, width: `${longest + 1}ch`, minWidth: 40, background: o.color === '#ffffff' ? 'rgba(0,0,0,.5)' : undefined }}
          aria-label="Text"
        />
        </>
      );
    }
    return (
      <>
        {cover}
        <div onPointerDown={onDown} onDoubleClick={onDoubleClick} className={`absolute cursor-move whitespace-pre ${ring}`} style={style}>
          {o.text || (o.cover ? <span className="text-[10px] text-muted-foreground">(deleted)</span> : ' ')}
          {handle}
        </div>
      </>
    );
  }

  if (o.type === 'mark') {
    return (
      <div onPointerDown={onDown} className={`absolute cursor-move ${ring}`} style={{ left: `${o.u * 100}%`, top: `${o.v * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }}>
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none h-full w-full overflow-visible">
          {o.kind === 'dot' ? (
            <circle cx="0.5" cy="0.5" r="0.25" fill={o.color} />
          ) : (
            MARK_STROKES[o.kind].map((stroke, k) => (
              <polyline key={k} points={stroke.map((p) => p.join(',')).join(' ')} fill="none" stroke={o.color} strokeWidth="0.12" strokeLinecap="round" strokeLinejoin="round" />
            ))
          )}
        </svg>
        {handle}
      </div>
    );
  }

  if (o.type === 'link') {
    const label = o.toPage ? `Page ${o.toPage}` : o.url || 'Add a link';
    return (
      <div
        onPointerDown={onDown}
        className={`absolute cursor-move rounded-[2px] border border-dashed border-blue-600 bg-blue-500/10 ${ring}`}
        style={{ left: `${o.u * 100}%`, top: `${o.v * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }}
      >
        <span className="absolute -top-4 left-0 max-w-[220px] truncate rounded bg-blue-600 px-1 text-[10px] leading-4 text-white">{label}</span>
        {handle}
      </div>
    );
  }

  const box: React.CSSProperties = { left: `${o.u * 100}%`, top: `${o.v * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` };
  if (o.type === 'image') {
    return (
      <div onPointerDown={onDown} className={`absolute cursor-move ${ring}`} style={box}>
        <ImageBytes bytes={o.bytes} mime={o.mime} />
        {handle}
      </div>
    );
  }
  if (o.style === 'strike' || o.style === 'underline') {
    return (
      <div onPointerDown={onDown} className={`absolute cursor-move ${ring}`} style={box}>
        <span className="pointer-events-none absolute inset-x-0" style={{ top: `${(o.style === 'strike' ? STRIKE_AT : UNDERLINE_AT) * 100}%`, height: 'max(1px, 7%)', background: o.color, transform: 'translateY(-50%)' }} />
        {handle}
      </div>
    );
  }
  const fill =
    o.style === 'whiteout' ? { background: '#ffffff', boxShadow: selected ? undefined : 'inset 0 0 0 1px rgba(0,0,0,.08)' }
      : o.style === 'redact' ? { background: '#000000' }
      : o.style === 'highlight' ? { background: o.color, opacity: 0.45, mixBlendMode: 'multiply' as const }
      : o.style === 'ellipse' ? { border: `${Math.max(1, 1.5 * pxPerPt)}px solid ${o.color}`, borderRadius: '50%' }
      : { border: `${Math.max(1, 1.5 * pxPerPt)}px solid ${o.color}` };
  return (
    <div onPointerDown={onDown} className={`absolute cursor-move ${ring}`} style={{ ...box, ...fill }}>
      {handle}
    </div>
  );
}

/**
 * One object URL per placed image, cached by its bytes. Undo/redo and React's double-run effects
 * would otherwise revoke a URL that is still on screen; these few URLs live until the page closes.
 */
const imageUrls = new WeakMap<Uint8Array, string>();
function urlFor(bytes: Uint8Array, mime: string): string {
  let url = imageUrls.get(bytes);
  if (!url) {
    url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    imageUrls.set(bytes, url);
  }
  return url;
}

function ImageBytes({ bytes, mime }: { bytes: Uint8Array; mime: string }) {
  const url = useMemo(() => urlFor(bytes, mime), [bytes, mime]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" />;
}

// ─── Small controls ──────────────────────────────────────────────────────────

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} aria-label={`Colour ${c}`} aria-pressed={value === c}
          className={`h-5 w-5 rounded-full border ${value === c ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`} style={{ background: c }} />
      ))}
    </span>
  );
}

function TextControls({ style, onChange }: { style: TextStyle; onChange: (s: Partial<TextStyle>) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 pl-1">
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Size
        <input type="number" min={6} max={96} value={style.size} onChange={(e) => onChange({ size: clamp(Number(e.target.value) || 12, 6, 96) })}
          className="w-14 rounded-md border border-border bg-background px-1.5 py-1 text-foreground" aria-label="Font size" />
      </label>
      <button type="button" onClick={() => onChange({ bold: !style.bold })} aria-pressed={style.bold} aria-label="Bold"
        className={`rounded-md p-1.5 ${style.bold ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted'}`}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onChange({ italic: !style.italic })} aria-pressed={style.italic} aria-label="Italic"
        disabled={!isStandardFont(style.family)} title={isStandardFont(style.family) ? 'Italic' : 'Italic is available for Helvetica, Times and Courier'}
        className={`rounded-md p-1.5 disabled:opacity-30 ${style.italic ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted'}`}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <FontPicker value={style.family} onChange={(family) => onChange(isStandardFont(family) ? { family } : { family, italic: false })} />
      <Swatches colors={COLORS} value={style.color} onPick={(c) => onChange({ color: c })} />
    </span>
  );
}

function FormPanel(props: PageEditorProps) {
  const { formFields, formValues, setFormValue } = props;
  const value = (f: FormFieldInfo) => (f.name in formValues ? formValues[f.name] : f.value);
  return (
    <details open className="rounded-xl border border-border bg-card p-3">
      <summary className="cursor-pointer text-sm font-semibold">This PDF has {formFields.length} fillable field{formFields.length === 1 ? '' : 's'}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {formFields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1 text-xs">
            <span className="truncate font-medium text-muted-foreground" title={f.name}>{f.name}</span>
            {f.kind === 'checkbox' ? (
              <input type="checkbox" checked={!!value(f)} onChange={(e) => setFormValue(f.name, e.target.checked)} className="h-4 w-4 accent-primary" />
            ) : f.options ? (
              <select value={String(value(f))} onChange={(e) => setFormValue(f.name, e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                <option value="">—</option>
                {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : f.multiline ? (
              <textarea value={String(value(f))} onChange={(e) => setFormValue(f.name, e.target.value)} rows={2} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            ) : (
              <input value={String(value(f))} onChange={(e) => setFormValue(f.name, e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            )}
          </label>
        ))}
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={props.flattenForm} onChange={(e) => props.setFlattenForm(e.target.checked)} className="accent-primary" />
        Lock the answers (flatten the form so fields can no longer be changed)
      </label>
    </details>
  );
}

function FindPanel({ onFind }: { onFind: PageEditorProps['onFind'] }) {
  const [kinds, setKinds] = useState<Set<SensitiveKind>>(new Set(['aadhaar', 'pan', 'phone', 'email']));
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<FindSummary | null>(null);
  const toggle = (k: SensitiveKind) =>
    setKinds((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else {
        n.add(k);
        // Full Aadhaar and masked Aadhaar are alternatives.
        if (k === 'aadhaar') n.delete('aadhaar-mask');
        if (k === 'aadhaar-mask') n.delete('aadhaar');
      }
      return n;
    });
  const run = async () => {
    setBusy(true);
    try {
      setSummary(await onFind({ kinds: [...kinds], custom }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><ScanSearch className="h-4 w-4" /> Find and redact automatically</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {FIND_KINDS.map((k) => (
          <label key={k.id} className="inline-flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={kinds.has(k.id)} onChange={() => toggle(k.id)} className="accent-primary" />
            {k.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Also find this text (a name, address…)"
          className="w-72 max-w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm" aria-label="Custom text to find" />
        <button type="button" onClick={run} disabled={busy || (!kinds.size && !custom.trim())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />} Find and mark
        </button>
      </div>
      {summary && (
        <p className="text-xs text-muted-foreground" role="status">
          {summary.total
            ? `Marked ${summary.total} item${summary.total === 1 ? '' : 's'} (${Object.entries(summary.byKind).map(([k, n]) => `${FIND_KINDS.find((f) => f.id === k)?.label.split(' (')[0] ?? 'your text'} ×${n}`).join(', ')}). Check the black boxes below, remove any you want to keep, then save.`
            : 'Nothing found.'}
          {summary.pagesWithoutText > 0 && ` ${summary.pagesWithoutText} page${summary.pagesWithoutText === 1 ? ' looks' : 's look'} scanned (no text layer): draw boxes there by hand.`}
        </p>
      )}
    </div>
  );
}

/** Link target for the selected link: a web/email address, or a page of this document. */
function LinkControls({ link, pageCount, onChange }: { link: Extract<UIObject, { type: 'link' }>; pageCount: number; onChange: (p: { url?: string; toPage?: number }) => void }) {
  const [mode, setMode] = useState<'web' | 'page'>(link.toPage ? 'page' : 'web');
  const [text, setText] = useState(link.url ?? '');
  const bad = mode === 'web' && text.trim() !== '' && !looksLikeLink(text);
  return (
    <span className="flex flex-wrap items-center gap-1.5 pl-1">
      <select value={mode} onChange={(e) => setMode(e.target.value as 'web' | 'page')} aria-label="Link to"
        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground">
        <option value="web">Web or email</option>
        <option value="page">Page</option>
      </select>
      {mode === 'web' ? (
        <input
          autoFocus={!link.url}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onChange({ url: text.trim(), toPage: undefined })}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          placeholder="example.com or name@mail.com"
          className={`w-56 rounded-md border bg-background px-2 py-1 text-xs text-foreground ${bad ? 'border-red-500' : 'border-border'}`}
          aria-label="Web address or email"
        />
      ) : (
        <input
          type="number"
          min={1}
          max={pageCount}
          defaultValue={link.toPage ?? 1}
          onChange={(e) => onChange({ toPage: Math.min(pageCount, Math.max(1, Number(e.target.value) || 1)), url: undefined })}
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          aria-label="Page number"
        />
      )}
      {bad && <span className="text-xs text-red-600 dark:text-red-400">Not a web address or email</span>}
    </span>
  );
}

/** Same rules as normalizeLinkUrl in lib/pdf/overlay (kept here so the editor doesn't load pdf-lib). */
function looksLikeLink(raw: string): boolean {
  const s = raw.trim();
  return (
    /^(https?:|mailto:|tel:)\S+$/i.test(s) ||
    /^[^@\s/]+@[^@\s/]+\.[a-z]{2,}$/i.test(s) ||
    /^\+?[\d\s-]{8,}$/.test(s) ||
    /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]\S*)?$/i.test(s)
  );
}

/**
 * Text and background colour of a line on the rendered page: the background is the most common
 * colour around the edge of its box, the text colour the pixel least like it.
 */
function sampleColors(canvas: HTMLCanvasElement, r: { u: number; v: number; w: number; h: number }): { fg: string; bg: string } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { fg: '#111827', bg: '#ffffff' };
  const x0 = Math.max(0, Math.floor(r.u * canvas.width) - 2);
  const y0 = Math.max(0, Math.floor(r.v * canvas.height) - 2);
  const x1 = Math.min(canvas.width, Math.ceil((r.u + r.w) * canvas.width) + 2);
  const y1 = Math.min(canvas.height, Math.ceil((r.v + r.h) * canvas.height) + 2);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 2 || h < 2) return { fg: '#111827', bg: '#ffffff' };
  const d = ctx.getImageData(x0, y0, w, h).data;
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  const counts = new Map<string, { n: number; c: number[] }>();
  const add = (c: number[]) => {
    const k = c.map((v) => v >> 3).join(',');
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { n: 1, c });
  };
  for (let x = 0; x < w; x++) {
    add(at(x, 0));
    add(at(x, h - 1));
  }
  for (let y = 0; y < h; y++) {
    add(at(0, y));
    add(at(w - 1, y));
  }
  const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0].c;
  let fg = [17, 24, 39];
  let best = -1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = at(x, y);
      const dist = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
      if (dist > best) {
        best = dist;
        fg = c;
      }
    }
  }
  const hex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  return { fg: best > 60 ? hex(fg) : '#111827', bg: hex(bg) };
}

/** A toolbar button that opens a small menu of related tools (Marks, Markup, Shapes). */
function ToolGroup({ group, tool, onPick }: { group: { group: string; items: ToolDef[] }; tool: Tool | null; onPick: (t: Tool) => void }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(group.items[0]);
  const ref = useRef<HTMLSpanElement>(null);
  const current = group.items.find((t) => t.id === tool);
  const shown = current ?? last;
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={group.group}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${current ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
      >
        {shown.icon}
        <span className="hidden sm:inline">{current ? current.label : group.group}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <span role="menu" className="absolute left-0 top-full z-40 mt-1 min-w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
          {group.items.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setLast(t);
                setOpen(false);
                onPick(t.id);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ${t.id === tool ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Find & replace across all pages (uses the same replacement as "Edit text"). */
function ReplacePanel({ onReplace }: { onReplace: (find: string, replacement: string, matchCase: boolean) => Promise<{ count: number; lines: number }> }) {
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const input = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm sm:w-56';
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Replace className="h-4 w-4 text-muted-foreground" /> Find and replace text
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <form
        className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!find) return;
          setBusy(true);
          setStatus('');
          try {
            const r = await onReplace(find, repl, matchCase);
            setStatus(r.lines ? `Replaced ${r.count} time${r.count === 1 ? '' : 's'} in ${r.lines} line${r.lines === 1 ? '' : 's'}. Undo with ⌘/Ctrl+Z.` : 'Not found. Scanned PDFs have no text to search.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find" className={input} aria-label="Text to find" />
        <input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Replace with" className={input} aria-label="Replace with" />
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="accent-primary" /> Match case
        </label>
        <button type="submit" disabled={!find || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} Replace all
        </button>
        {status && <p className="basis-full text-xs text-muted-foreground" role="status">{status}</p>}
      </form>
    </details>
  );
}

/** Font menu: standard PDF fonts, free web fonts, and (Chrome/Edge desktop) the computer's own fonts. */
function FontPicker({ value, onChange }: { value: FontKey; onChange: (key: FontKey) => void }) {
  const [local, setLocal] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const sys = systemFamilyOf(value);
  const families = local ?? (sys ? [sys] : []);
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={value}
        onChange={async (e) => {
          const v = e.target.value;
          if (v !== '__local') return onChange(v);
          setError('');
          try {
            setLocal(await listLocalFonts());
          } catch {
            setError('Font access was not allowed.');
          }
        }}
        aria-label="Font"
        className="max-w-44 rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        style={{ fontFamily: fontCss(value) }}
      >
        <optgroup label="Standard (smallest file)">
          {STANDARD_FONTS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </optgroup>
        <optgroup label="More fonts">
          {WEB_FONTS.map((f) => (
            <option key={f.id} value={`web:${f.id}`}>{f.label}</option>
          ))}
        </optgroup>
        {families.length > 0 && (
          <optgroup label="On this computer">
            {families.map((f) => (
              <option key={f} value={`sys:${f}`}>{f}</option>
            ))}
          </optgroup>
        )}
        {!local && canListLocalFonts() && <option value="__local">Show my computer&apos;s fonts…</option>}
      </select>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
