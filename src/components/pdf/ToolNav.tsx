'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TASKS, TASK_GROUPS, taskInfo, taskRoute, type PdfTask } from './tasks';

/**
 * Real links (crawlable, open in a new tab with Cmd/Ctrl-click). A plain click switches task
 * in place so the open files stay loaded.
 */
function TaskLink({ id, current, onPick, className }: { id: PdfTask; current: PdfTask; onPick: (t: PdfTask) => void; className: string }) {
  const t = taskInfo(id);
  const Icon = t.icon;
  const active = id === current;
  return (
    <a
      href={taskRoute(id)}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onPick(id);
      }}
      className={`${className} ${active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : t.isNew ? 'text-emerald-500' : ''}`} />
      <span className="truncate">{t.label}</span>
    </a>
  );
}

/** Left sidebar on wide screens. */
export function ToolSidebar({ task, onPick }: { task: PdfTask; onPick: (t: PdfTask) => void }) {
  const group = (g: (typeof TASK_GROUPS)[number]) => (
    <div key={g}>
      <p className="mb-1 px-2.5 text-xs text-muted-foreground/80">{g}</p>
      <ul className="space-y-px">
        {TASKS.filter((t) => t.group === g).map((t) => (
          <li key={t.id}>
            <TaskLink id={t.id} current={task} onPick={onPick} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors" />
          </li>
        ))}
      </ul>
    </div>
  );
  // Security is pinned to the bottom so it is always in view; the other groups scroll above it.
  return (
    <nav aria-label="PDF tools" className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col pb-4">
      <p className="mb-3 px-2.5 text-sm font-semibold text-foreground">PDF tools</p>
      {task !== 'secure-share' && <FeaturedTool onPick={onPick} />}
      <div className="developer-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {TASK_GROUPS.filter((g) => g !== 'Security').map(group)}
      </div>
      <div className="mt-2 border-t border-border pt-3">{group('Security')}</div>
    </nav>
  );
}

/** The newest tool, at the top of the sidebar so it is seen without scrolling. */
function FeaturedTool({ onPick }: { onPick: (t: PdfTask) => void }) {
  return (
    <a
      href={taskRoute('secure-share')}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onPick('secure-share');
      }}
      className="mb-4 mt-1 flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 transition-colors hover:bg-emerald-500/10"
    >
      {/* Animated "NEW" badge (6 KB GIF, 2x for sharp screens); a still frame when motion is reduced. */}
      <picture className="mt-0.5 shrink-0">
        <source srcSet="/assets/img/new-badge.png" media="(prefers-reduced-motion: reduce)" />
        <img src="/assets/img/new-badge.gif" alt="New" width={34} height={19} className="h-[19px] w-[34px] rounded-[4px]" decoding="async" />
      </picture>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-sm font-medium text-foreground">Share with expiry</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">Send a PDF that stops opening after a date you pick.</span>
      </span>
    </a>
  );
}

/** "All PDF tools" menu for screens without the sidebar. */
export function ToolMenu({ task, onPick }: { task: PdfTask; onPick: (t: PdfTask) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        All PDF tools <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[min(92vw,560px)] rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {TASK_GROUPS.map((g) => (
              <div key={g}>
                <p className="mb-1 px-2 text-xs text-muted-foreground/80">{g}</p>
                {TASKS.filter((t) => t.group === g).map((t) => (
                  <TaskLink
                    key={t.id}
                    id={t.id}
                    current={task}
                    onPick={(id) => {
                      setOpen(false);
                      onPick(id);
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
