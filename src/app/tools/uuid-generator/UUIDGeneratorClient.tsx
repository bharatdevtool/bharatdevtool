'use client';

import React, { useState, useEffect } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import SegmentedTabs, { TabOption } from '@/components/ui/SegmentedTabs';
import CopyButton from '@/components/ui/CopyButton';
import { generateBulkUUIDs, isValidUUID, detectUUIDVersion, UUIDVersion } from '@/lib/security/uuid';
import { Fingerprint, RefreshCw, CheckCircle2, AlertCircle, Download, Check, Sparkles } from 'lucide-react';

const VERSION_TABS: TabOption<UUIDVersion>[] = [
  { id: 'v4', label: 'v4 (Random / Cryptographic)' },
  { id: 'v7', label: 'v7 (Unix Epoch Time-Ordered)' },
  { id: 'v1', label: 'v1 (Timestamp & MAC)' },
];

export default function UUIDGeneratorClient() {
  const [version, setVersion] = useState<UUIDVersion>('v4');
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [removeHyphens, setRemoveHyphens] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);
  const [validateInput, setValidateInput] = useState('');

  function formatUUID(id: string) {
    let result = id;
    if (removeHyphens) result = result.replace(/-/g, '');
    if (uppercase) result = result.toUpperCase();
    return result;
  }

  function handleGenerate() {
    const raw = generateBulkUUIDs(version, count);
    setUuids(raw.map(formatUUID));
  }

  // Generate on mount
  useEffect(() => {
    handleGenerate();
  }, [version, count, uppercase, removeHyphens]);

  const isValid = validateInput.trim() ? isValidUUID(validateInput.trim()) : null;
  const detectedVersion = isValid ? detectUUIDVersion(validateInput.trim()) : null;

  function handleDownloadBulk() {
    if (uuids.length === 0) return;
    const blob = new Blob([uuids.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `uuids-${version}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ToolLayout toolId="uuid-generator">
      <div className="space-y-6">
        {/* Version Selection */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SegmentedTabs
              tabs={VERSION_TABS}
              activeTab={version}
              onChange={setVersion}
            />

            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-2xs active:scale-95 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Controls: Count & Formatting */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <label className="font-medium text-foreground">Quantity:</label>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.min(50, Math.max(1, +e.target.value)))}
                className="w-16 px-2.5 py-1 rounded-md border border-border bg-background text-foreground text-center font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px]">(up to 50 at once)</span>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={uppercase}
                  onChange={(e) => setUppercase(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                <span>Uppercase</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={removeHyphens}
                  onChange={(e) => setRemoveHyphens(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                <span>Remove hyphens</span>
              </label>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Generated UUIDs ({uuids.length})
            </span>
            <div className="flex items-center gap-2">
              {uuids.length > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadBulk}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-muted text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Download className="w-3 h-3" /> Download .txt
                </button>
              )}
              <CopyButton text={uuids.join('\n')} label="Copy All" />
            </div>
          </div>

          <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
            {uuids.map((id, idx) => (
              <div
                key={`${id}-${idx}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-mono text-muted-foreground w-6">#{idx + 1}</span>
                  <code className="font-mono text-sm font-semibold text-primary select-all truncate">{id}</code>
                </div>
                <CopyButton text={id} size="sm" variant="ghost" />
              </div>
            ))}
          </div>
        </div>

        {/* UUID Validator Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            UUID Validator & Version Inspector
          </span>
          <input
            type="text"
            value={validateInput}
            onChange={(e) => setValidateInput(e.target.value)}
            placeholder="Paste any UUID to validate its syntax and determine its version..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {validateInput.trim() && (
            <div className="pt-1">
              {isValid ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid RFC 4122 / RFC 9562 UUID ({detectedVersion?.toUpperCase() || 'Standard'})</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Invalid UUID format. Expected 32 hexadecimal digits formatted as 8-4-4-4-12.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
