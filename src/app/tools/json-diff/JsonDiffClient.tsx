'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CodeEditor from '@/components/ui/CodeEditor';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { diffJSON, diffStats, type DiffNode } from '@/lib/json/differ';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import { GitCompare, PlusCircle, MinusCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

const DIFF_COLORS: Record<string, string> = {
  added: 'bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400',
  removed: 'bg-red-500/10 border-l-2 border-red-500 text-red-600 dark:text-red-400',
  changed: 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-600 dark:text-amber-400',
  unchanged: 'text-muted-foreground hover:text-foreground',
};

function DiffTree({ nodes, depth = 0 }: { nodes: DiffNode[]; depth?: number }) {
  return (
    <ul className="space-y-1 font-mono text-xs">
      {nodes.map((node) => (
        <li key={node.path} style={{ paddingLeft: depth * 16 }}>
          <div className={`rounded-md px-2.5 py-1 transition-colors ${DIFF_COLORS[node.type]}`}>
            <span className="font-semibold text-foreground">{node.key}</span>
            {node.type === 'changed' && !node.children && (
              <span className="ml-2 inline-flex items-center gap-1.5 flex-wrap">
                <span className="line-through opacity-60 text-red-500">{JSON.stringify(node.leftValue)}</span>
                <span className="opacity-40">→</span>
                <span className="text-emerald-500 font-semibold">{JSON.stringify(node.rightValue)}</span>
              </span>
            )}
            {node.type === 'added' && (
              <span className="ml-2 text-emerald-500 font-medium">+{JSON.stringify(node.rightValue)}</span>
            )}
            {node.type === 'removed' && (
              <span className="ml-2 line-through text-red-500">-{JSON.stringify(node.leftValue)}</span>
            )}
            {node.type === 'unchanged' && !node.children && (
              <span className="ml-2 opacity-60">{JSON.stringify(node.leftValue)}</span>
            )}
          </div>
          {node.children && node.children.length > 0 && (
            <DiffTree nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

const SAMPLE_ORIGINAL = `{
  "title": "Developer Hub",
  "version": "1.0.0",
  "settings": {
    "theme": "dark",
    "telemetry": false
  },
  "tools": ["json", "base64", "qr"]
}`;

const SAMPLE_MODIFIED = `{
  "title": "Bharat Dev Tools",
  "version": "2.0.0",
  "settings": {
    "theme": "system",
    "telemetry": false,
    "privacy": "strict"
  },
  "tools": ["json", "base64", "qr", "regex", "curl"]
}`;

export default function JsonDiffClient() {
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [diffResult, setDiffResult] = useState<DiffNode[] | null>(null);
  const [stats, setStats] = useState<{ added: number; removed: number; changed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCompare(leftVal = leftInput, rightVal = rightInput) {
    setError(null);
    setDiffResult(null);
    setStats(null);

    if (!leftVal.trim() || !rightVal.trim()) {
      setError('Please provide JSON in both left (original) and right (modified) panes to compare.');
      return;
    }

    try {
      const leftObj = JSON.parse(leftVal);
      const rightObj = JSON.parse(rightVal);
      const result = diffJSON(leftObj, rightObj);
      setDiffResult(result);
      setStats(diffStats(result));
      analytics.track(ANALYTICS_EVENTS.COMPARE_JSON);
    } catch (err) {
      setError(err instanceof Error ? `JSON Parse Error: ${err.message}` : 'Invalid JSON in one or both inputs.');
    }
  }

  function handleLoadSample() {
    setLeftInput(SAMPLE_ORIGINAL);
    setRightInput(SAMPLE_MODIFIED);
    handleCompare(SAMPLE_ORIGINAL, SAMPLE_MODIFIED);
  }

  return (
    <ToolLayout toolId="json-diff">
      <div className="space-y-4">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Load Sample Diff</span>
            </button>
            {(leftInput || rightInput) && (
              <button
                type="button"
                onClick={() => {
                  setLeftInput('');
                  setRightInput('');
                  setDiffResult(null);
                  setStats(null);
                  setError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleCompare()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-2xs active:scale-95"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare JSON</span>
          </button>
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {/* Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CodeEditor
            title="Left (Original JSON)"
            language="json"
            value={leftInput}
            onChange={(val) => {
              setLeftInput(val);
              if (rightInput) handleCompare(val, rightInput);
            }}
            placeholder='Original JSON structure... e.g. {"name": "Alice"}'
            height="h-64 sm:h-72"
          />

          <CodeEditor
            title="Right (Modified JSON)"
            language="json"
            value={rightInput}
            onChange={(val) => {
              setRightInput(val);
              if (leftInput) handleCompare(leftInput, val);
            }}
            placeholder='Modified JSON structure... e.g. {"name": "Bob"}'
            height="h-64 sm:h-72"
          />
        </div>

        {/* Diff Result Card */}
        {stats && diffResult && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4 animate-in fade-in duration-200">
            {/* Diff Stats Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comparison Analysis
              </span>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <PlusCircle className="w-3 h-3" /> +{stats.added} added
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <MinusCircle className="w-3 h-3" /> -{stats.removed} removed
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <RefreshCw className="w-3 h-3" /> ~{stats.changed} changed
                </span>
              </div>
            </div>

            {/* Tree View */}
            {diffResult.length === 0 ? (
              <div className="py-8 text-center text-sm text-emerald-500 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> The two JSON structures are identical!
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/70 overflow-x-auto max-h-96">
                <DiffTree nodes={diffResult} />
              </div>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
