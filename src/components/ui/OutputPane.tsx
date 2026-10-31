'use client';

import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Download, Sparkles, CheckCircle2, ArrowUp } from 'lucide-react';
import CopyButton from '@/components/ui/CopyButton';

interface OutputPaneProps {
  content: string;
  title?: string;
  language?: string;
  emptyMessage?: string;
  statusBadge?: string;
  height?: string | number;
  className?: string;
  onHeightChange?: (h: number) => void;
  downloadFilename?: string;
  actions?: React.ReactNode;
}

export default function OutputPane({
  content,
  title = 'Output',
  language,
  emptyMessage = 'Output will appear here once you run or enter input...',
  statusBadge,
  height,
  className = '',
  onHeightChange,
  downloadFilename,
  actions,
}: OutputPaneProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const lineCount = content ? content.split('\n').length : 0;
  const byteSize = content ? new Blob([content]).size : 0;

  function scrollToTop() {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      contentRef.current.scrollLeft = 0;
    }
    requestAnimationFrame(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
        contentRef.current.scrollLeft = 0;
      }
    });
  }

  function handleDownload() {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFilename || 'output.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  // Synchronously clamp scroll position to top when content changes
  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      contentRef.current.scrollLeft = 0;
    }
  }, [content]);

  // Ensure scroll is at top across animation frame and delayed paint
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      contentRef.current.scrollLeft = 0;
    }

    const frameId = requestAnimationFrame(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
        contentRef.current.scrollLeft = 0;
      }
    });

    const timer1 = setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
        contentRef.current.scrollLeft = 0;
      }
    }, 50);

    const timer2 = setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
        contentRef.current.scrollLeft = 0;
      }
    }, 150);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [content]);

  // Observe manual resize if right pane is resized
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

  const heightStyle = typeof height === 'number' ? { height: `${height}px` } : undefined;
  const heightClass = typeof height === 'string' ? height : 'h-full';

  return (
    <div
      ref={containerRef}
      style={heightStyle}
      className={`flex flex-col h-full min-h-0 rounded-xl border border-border bg-card shadow-2xs overflow-hidden ${heightClass} ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/40 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {language && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-primary/10 text-primary border border-primary/20">
              {language}
            </span>
          )}
          {statusBadge && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> {statusBadge}
            </span>
          )}
          {content && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/80 text-[11px] font-mono font-medium shadow-2xs">
              <span>{lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-primary font-semibold">{formatBytes(byteSize)}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {actions}
          {content && (
            <>
              {/* Quick Jump to Line 1 (Top) */}
              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Jump to Top (Line 1)"
              >
                <ArrowUp className="w-3 h-3" />
                <span className="hidden sm:inline">Top</span>
              </button>

              {downloadFilename && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  title="Download output file"
                >
                  <Download className="w-3 h-3 text-muted-foreground" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              )}
              <CopyButton text={content} />
            </>
          )}
        </div>
      </div>

      {/* Output Content filling full available container height with dedicated individual scrollbar */}
      <div
        ref={contentRef}
        style={{
          overflowY: 'scroll',
          overflowAnchor: 'none',
          scrollbarGutter: 'stable',
        }}
        className="w-full flex-1 h-full min-h-0 p-3.5 bg-muted/20 text-foreground overflow-y-scroll overflow-x-auto font-mono text-xs sm:text-sm leading-relaxed developer-scrollbar"
      >
        {content ? (
          <pre className="whitespace-pre-wrap break-all font-mono selection:bg-primary/20">
            {content}
          </pre>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground/60 select-none min-h-[200px]">
            <Sparkles className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs font-sans max-w-xs">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
