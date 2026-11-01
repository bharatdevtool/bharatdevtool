'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CodeEditor from '@/components/ui/CodeEditor';
import { ArrowLeftRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseCurl, diffHeaders, type DiffStatus } from '@/lib/curl/parser';

const STATUS_COLORS: Record<DiffStatus, string> = {
  left: 'bg-red-500/10 border-l-2 border-red-500 text-red-600 dark:text-red-400',
  right: 'bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400',
  diff: 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-600 dark:text-amber-400',
  same: '',
};

const SAMPLE_1 = `curl -X POST 'https://api.example.com/v1/auth' \\\n  -H 'Content-Type: application/json' \\\n  -H 'User-Agent: Client-v1' \\\n  -d '{"client_id": "app_123"}'`;

const SAMPLE_2 = `curl -X POST 'https://api.example.com/v2/auth' \\\n  -H 'Content-Type: application/json' \\\n  -H 'User-Agent: Client-v2' \\\n  -H 'X-Api-Key: sec_key_999' \\\n  -d '{"client_id": "app_123", "scope": "admin"}'`;

export default function CurlComparisonClient() {
  const [left, setLeft] = useState(SAMPLE_1);
  const [right, setRight] = useState(SAMPLE_2);
  const [paneHeight, setPaneHeight] = useState<number>(240);

  const pLeft = left.trim() ? parseCurl(left) : null;
  const pRight = right.trim() ? parseCurl(right) : null;

  const headerDiffs = pLeft && pRight ? diffHeaders(pLeft.headers, pRight.headers) : [];

  return (
    <ToolLayout toolId="curl-comparison">
      <div className="space-y-6">
        {/* Presets and actions */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setLeft(SAMPLE_1);
              setRight(SAMPLE_2);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Load Sample Comparison</span>
          </button>

          {(left || right) && (
            <button
              type="button"
              onClick={() => {
                setLeft('');
                setRight('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear Both
            </button>
          )}
        </div>

        {/* Inputs Grid with synchronized individual scrollbars */}
        <div className="grid gap-4 lg:grid-cols-2 items-stretch h-[360px] min-h-[300px]">
          <CodeEditor
            title="cURL Command 1 (Base)"
            language="bash"
            value={left}
            onChange={setLeft}
            placeholder="curl -X GET 'https://api.example.com/...'"
          />

          <CodeEditor
            title="cURL Command 2 (Comparison)"
            language="bash"
            value={right}
            onChange={setRight}
            placeholder="curl -X POST 'https://api.example.com/...'"
          />
        </div>

        {/* Comparison Analysis */}
        {pLeft && pRight && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-5 animate-in fade-in duration-200">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              cURL Request Differences
            </span>

            {/* Method, URL, Body */}
            <div className="space-y-2.5">
              {[
                ['HTTP Method', pLeft.method, pRight.method],
                ['Endpoint URL', pLeft.url, pRight.url],
                ['Request Payload', pLeft.body, pRight.body],
              ].map(([label, l, r]) => {
                const isSame = l === r;
                return (
                  <div
                    key={label}
                    className={`rounded-lg border border-border p-3.5 text-xs ${
                      isSame ? 'bg-muted/20' : 'bg-amber-500/10 border-l-4 border-amber-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-muted-foreground uppercase font-mono">{label}</span>
                      <span
                        className={`text-[11px] font-medium ${
                          isSame ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        {isSame ? 'Match' : 'Different'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                      <div className="p-2 rounded bg-background border border-border/50 break-all text-foreground">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">Command 1:</span>
                        {l || <span className="text-muted-foreground italic">—</span>}
                      </div>
                      <div className="p-2 rounded bg-background border border-border/50 break-all text-foreground">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">Command 2:</span>
                        {r || <span className="text-muted-foreground italic">—</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Headers Diff Table */}
            {headerDiffs.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-3 bg-muted/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  <span>Header Name</span>
                  <span>Command 1</span>
                  <span>Command 2</span>
                </div>
                <div className="divide-y divide-border/60 text-xs font-mono">
                  {headerDiffs.map(({ key, left: l, right: r, status }) => (
                    <div
                      key={key}
                      className={`grid grid-cols-3 gap-2 px-4 py-2.5 items-center ${STATUS_COLORS[status]}`}
                    >
                      <span className="font-semibold text-foreground">{key}</span>
                      <span className="break-all text-muted-foreground">{l ?? '—'}</span>
                      <span className="break-all text-muted-foreground">{r ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
