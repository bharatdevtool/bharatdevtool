'use client';

import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, RotateCw, Trash2, Check, FileImage } from 'lucide-react';

export interface GridPage {
  key: string;
  label: string;
  /** Thumbnail object URL (undefined while rendering). */
  thumb?: string;
  /** Extra clockwise rotation chosen by the user. */
  rotation: number;
  isImage: boolean;
}

interface PageGridProps {
  pages: GridPage[];
  selected: ReadonlySet<string>;
  onSelect: (key: string, opts: { range: boolean; toggle: boolean }) => void;
  onRotate: (key: string) => void;
  onDelete: (key: string) => void;
  /** Move `key` so it ends up at position `toIndex`. */
  onMove: (key: string, toIndex: number) => void;
}

const DRAG_THRESHOLD = 6;

export default function PageGrid({ pages, selected, onSelect, onRotate, onDelete, onMove }: PageGridProps) {
  const drag = useRef<{ key: string; x: number; y: number; active: boolean } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // Pointer-based drag so it works the same with a mouse, pen or finger.
  const onHandleDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { key, x: e.clientX, y: e.clientY, active: false };
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_THRESHOLD) {
      d.active = true;
      setDragKey(d.key);
    }
    if (!d.active) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-page-key]') as HTMLElement | null;
    setOverKey(el?.dataset.pageKey ?? null);
  };
  const onHandleUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.active && overKey && overKey !== d.key) {
      onMove(d.key, pages.findIndex((p) => p.key === overKey));
    }
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3 gap-y-4 sm:gap-x-4"
      aria-label="Pages. Click to select, Shift-click to select a range, drag the handle to reorder."
    >
      {pages.map((page, i) => {
        const isSelected = selected.has(page.key);
        const isDragging = dragKey === page.key;
        const isOver = overKey === page.key && dragKey !== page.key;
        const sideways = page.rotation % 180 !== 0;
        return (
          <li
            key={page.key}
            data-page-key={page.key}
            className={`group relative flex flex-col select-none transition-all ${isDragging ? 'scale-95 opacity-40' : ''}`}
          >
            <button
              type="button"
              onClick={(e) => onSelect(page.key, { range: e.shiftKey, toggle: true })}
              aria-pressed={isSelected}
              aria-label={`${page.label}${isSelected ? ', selected' : ''}`}
              className={`relative flex h-40 items-center justify-center overflow-hidden rounded-lg p-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                isOver ? 'bg-emerald-500/10 ring-2 ring-emerald-500' : isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-card'
              }`}
            >
              {page.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.thumb}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full bg-white object-contain shadow-sm ring-1 ring-black/5 transition-transform duration-200"
                  style={{ transform: `rotate(${page.rotation}deg)${sideways ? ' scale(0.72)' : ''}` }}
                />
              ) : (
                <span className="h-24 w-16 animate-pulse rounded bg-muted" aria-hidden="true" />
              )}
              <span
                className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[11px] ${
                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card/90 text-transparent opacity-0 group-hover:opacity-100 group-hover:text-muted-foreground'
                }`}
                aria-hidden="true"
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              {page.isImage && (
                <span className="absolute right-2 top-2 rounded bg-card/90 p-0.5 text-muted-foreground" title="Image page" aria-hidden="true">
                  <FileImage className="h-3.5 w-3.5" />
                </span>
              )}
            </button>

            <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
              <span
                onPointerDown={(e) => onHandleDown(e, page.key)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                className="flex cursor-grab touch-none items-center rounded p-1 text-muted-foreground transition-opacity hover:bg-muted active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <IconBtn label={`Move ${page.label} left`} disabled={i === 0} onClick={() => onMove(page.key, i - 1)} className="sm:hidden">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label={`Move ${page.label} right`} disabled={i === pages.length - 1} onClick={() => onMove(page.key, i + 1)} className="sm:hidden">
                  <ArrowRight className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label={`Rotate ${page.label}`} onClick={() => onRotate(page.key)}>
                  <RotateCw className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label={`Remove ${page.label}`} onClick={() => onDelete(page.key)} danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  disabled,
  danger,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded p-1 text-muted-foreground transition-colors disabled:opacity-30 ${
        danger ? 'hover:bg-red-500/10 hover:text-red-500' : 'hover:bg-muted hover:text-foreground'
      } ${className}`}
    >
      {children}
    </button>
  );
}
