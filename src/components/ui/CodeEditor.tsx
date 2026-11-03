'use client';

import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Trash2, FileUp, Sparkles, ClipboardPaste, ArrowUp } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  title?: string;
  language?: string;
  placeholder?: string;
  height?: string | number;
  className?: string;
  onHeightChange?: (h: number) => void;
  onSample?: () => void;
  onClear?: () => void;
  actions?: React.ReactNode;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  onChange,
  title = 'Input',
  language,
  placeholder = 'Type or paste content here...',
  height,
  className = '',
  onHeightChange,
  onSample,
  onClear,
  actions,
  readOnly = false,
}: CodeEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Flag to force scroll position to Line 1 on bulk updates (paste, sample, upload)
  const shouldStayAtTopRef = useRef<boolean>(false);

  // Sync resize with parent/peer panels if custom height callback exists
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onHeightChange) return;

    const ro = new ResizeObserver(() => {
      const h = el.clientHeight;
      if (h && Math.abs(h - (typeof height === 'number' ? height : 0)) > 2) {
        onHeightChange(h);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, height]);

  // Quick stats
  const lineCount = value ? value.split('\n').length : 0;
  const byteSize = value ? new Blob([value]).size : 0;

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function scrollToTop() {
    const el = textareaRef.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
      el.setSelectionRange(0, 0, 'none');
    }
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = 0;
        textareaRef.current.scrollLeft = 0;
        textareaRef.current.setSelectionRange(0, 0, 'none');
      }
    });
  }

  // Synchronous DOM enforcement: ensure view is at Line 1 immediately after React commits DOM update
  useLayoutEffect(() => {
    if (shouldStayAtTopRef.current && textareaRef.current) {
      textareaRef.current.scrollTop = 0;
      textareaRef.current.scrollLeft = 0;
      textareaRef.current.setSelectionRange(0, 0, 'none');
    }
  }, [value]);

  // Post-render enforcement: defeat any delayed browser layout reflow or anchor jumping
  useEffect(() => {
    if (shouldStayAtTopRef.current && textareaRef.current) {
      const el = textareaRef.current;
      el.scrollTop = 0;
      el.scrollLeft = 0;
      el.setSelectionRange(0, 0, 'none');

      const frameId = requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
          textareaRef.current.scrollLeft = 0;
          textareaRef.current.setSelectionRange(0, 0, 'none');
        }
      });

      const timer1 = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
          textareaRef.current.scrollLeft = 0;
        }
      }, 50);

      const timer2 = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
          textareaRef.current.scrollLeft = 0;
        }
        shouldStayAtTopRef.current = false;
      }, 150);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [value]);

  // Intercept Ctrl+V / Cmd+V paste so browser NEVER jumps to middle/end of huge payloads
  function handlePasteEvent(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    e.preventDefault();
    shouldStayAtTopRef.current = true;

    const el = textareaRef.current;
    if (!el) {
      onChange(text);
      return;
    }

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = value.substring(0, start);
    const after = value.substring(end);
    const nextVal = (start === 0 && end === value.length) || !value ? text : before + text + after;

    // Immediately update DOM node and clamp scroll before state flush
    el.value = nextVal;
    el.scrollTop = 0;
    el.scrollLeft = 0;
    el.setSelectionRange(0, 0, 'none');

    onChange(nextVal);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        shouldStayAtTopRef.current = true;
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
          textareaRef.current.scrollLeft = 0;
          textareaRef.current.setSelectionRange(0, 0, 'none');
        }
        onChange(text);
      }
    } catch {
      // fallback if clipboard read is blocked
      textareaRef.current?.focus();
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content !== undefined) {
        shouldStayAtTopRef.current = true;
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
          textareaRef.current.scrollLeft = 0;
          textareaRef.current.setSelectionRange(0, 0, 'none');
        }
        onChange(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const heightStyle = typeof height === 'number' ? { height: `${height}px` } : undefined;
  const heightClass = typeof height === 'string' ? height : 'h-full';

  return (
    <div
      ref={containerRef}
      style={heightStyle}
      className={`flex flex-col h-full min-h-0 rounded-xl border border-border bg-card shadow-2xs overflow-hidden ${heightClass} ${className}`}
    >
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/40 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {language && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-primary/10 text-primary border border-primary/20">
              {language}
            </span>
          )}
          {value && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/80 text-[11px] font-mono font-medium shadow-2xs">
              <span>{lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-primary font-semibold">{formatBytes(byteSize)}</span>
            </div>
          )}
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1">
          {actions}

          {/* Quick jump to Line 1 (Top) */}
          {value && (
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Jump to Top (Line 1)"
            >
              <ArrowUp className="w-3 h-3" />
              <span className="hidden sm:inline">Top</span>
            </button>
          )}

          {!readOnly && (
            <>
              {onSample && (
                <button
                  type="button"
                  onClick={() => {
                    shouldStayAtTopRef.current = true;
                    onSample();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Load sample data"
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="hidden sm:inline">Sample</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span className="hidden sm:inline">Paste</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Upload file"
              >
                <FileUp className="w-3 h-3" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />

              {value && onClear && (
                <button
                  type="button"
                  onClick={() => {
                    shouldStayAtTopRef.current = true;
                    onClear();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-red-500/80 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Clear input"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Textarea Area filling full available container height with individual permanent scrollbar */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePasteEvent}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          tabSize: 2,
          overflowY: 'scroll',
          overflowAnchor: 'none',
          scrollbarGutter: 'stable',
        }}
        className="w-full flex-1 h-full min-h-0 p-3.5 bg-background text-foreground placeholder:text-muted-foreground/60 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none resize-none border-none overflow-y-scroll developer-scrollbar"
      />
    </div>
  );
}
