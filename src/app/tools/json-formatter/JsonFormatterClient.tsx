'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import SegmentedTabs, { TabOption } from '@/components/ui/SegmentedTabs';
import CodeEditor from '@/components/ui/CodeEditor';
import OutputPane from '@/components/ui/OutputPane';
import ErrorMessage from '@/components/ui/ErrorMessage';
import {
  formatJSON,
  minifyJSON,
  validateJSON,
  escapeJSON,
  unescapeJSON,
  repairJSON,
} from '@/lib/json/formatter';
import { getCrossToolData } from '@/lib/crossToolData';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Maximize2, Minimize2, Monitor } from 'lucide-react';

type ActiveTab = 'format' | 'minify' | 'validate' | 'escape' | 'unescape' | 'repair';

const TABS: TabOption<ActiveTab>[] = [
  { id: 'format', label: 'Format / Prettify' },
  { id: 'minify', label: 'Minify' },
  { id: 'validate', label: 'Validate' },
  { id: 'escape', label: 'Escape String' },
  { id: 'unescape', label: 'Unescape' },
  { id: 'repair', label: 'Auto Repair' },
];

const SAMPLE_JSON = `{
  "name": "Bharat Dev Tools",
  "version": "1.0.0",
  "privacy": "100% Client-Side",
  "features": [
    "JSON Formatter & Validator",
    "cURL Tester",
    "QR Generator & Decoder",
    "Regex Tester",
    "Base64 & URL Encoding"
  ],
  "stats": {
    "totalTools": 20,
    "freeForever": true,
    "telemetry": false
  }
}`;

export default function JsonFormatterClient() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('format');
  const [indent, setIndent] = useState<2 | 4>(2);
  const [statusBadge, setStatusBadge] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Allow ESC to exit fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const processJson = useCallback(
    (tab: ActiveTab, val: string, indentSize: 2 | 4) => {
      setError(null);
      setOutput('');
      setStatusBadge(undefined);

      if (!val.trim()) return;

      try {
        let result = '';
        if (tab === 'format') {
          result = formatJSON(val, indentSize);
          setStatusBadge('Formatted');
          analytics.track(ANALYTICS_EVENTS.FORMAT_JSON);
        } else if (tab === 'minify') {
          result = minifyJSON(val);
          setStatusBadge('Minified');
          analytics.track(ANALYTICS_EVENTS.MINIFY_JSON);
        } else if (tab === 'validate') {
          const v = validateJSON(val);
          if (v.valid) {
            result = '✓ Valid JSON syntax. All brackets, keys, and values are properly formed.';
            setStatusBadge('Valid');
          } else {
            setError(`Invalid JSON: ${v.error}${v.line ? ` (Line ${v.line}, Col ${v.column})` : ''}`);
            result = `Error: ${v.error}${v.line ? `\nLine: ${v.line}\nColumn: ${v.column}` : ''}`;
            setStatusBadge('Invalid');
          }
          analytics.track(ANALYTICS_EVENTS.VALIDATE_JSON);
        } else if (tab === 'escape') {
          result = escapeJSON(val);
          setStatusBadge('Escaped');
          analytics.track(ANALYTICS_EVENTS.ESCAPE_JSON);
        } else if (tab === 'unescape') {
          result = unescapeJSON(val);
          setStatusBadge('Unescaped');
          analytics.track(ANALYTICS_EVENTS.UNESCAPE_JSON);
        } else if (tab === 'repair') {
          result = repairJSON(val);
          setStatusBadge('Repaired');
          analytics.track(ANALYTICS_EVENTS.REPAIR_JSON);
        }
        setOutput(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred during parsing.');
        setStatusBadge('Error');
      }
    },
    []
  );

  // Consume cross-tool payload on mount
  useEffect(() => {
    const incoming = getCrossToolData<{ json?: string; tab?: ActiveTab }>('json-formatter');
    if (incoming?.json) {
      setInput(incoming.json);
      const targetTab = incoming.tab || 'format';
      if (incoming.tab) setActiveTab(incoming.tab);
      processJson(targetTab, incoming.json, indent);
    }
  }, [indent, processJson]);

  function handleTabChange(newTab: ActiveTab) {
    setActiveTab(newTab);
    if (input.trim()) {
      processJson(newTab, input, indent);
    }
  }

  function handleInputChange(newVal: string) {
    setInput(newVal);
    if (newVal.trim()) {
      processJson(activeTab, newVal, indent);
    } else {
      setOutput('');
      setError(null);
      setStatusBadge(undefined);
    }
  }

  function handleLoadSample() {
    setInput(SAMPLE_JSON);
    processJson(activeTab, SAMPLE_JSON, indent);
  }

  function handleClear() {
    setInput('');
    setOutput('');
    setError(null);
    setStatusBadge(undefined);
  }

  return (
    <ToolLayout toolId="json-formatter">
      <div className="space-y-4">
        {/* Top Control Bar: Mode selection + Indentation + Screen/Fullscreen toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
          <SegmentedTabs
            tabs={TABS}
            activeTab={activeTab}
            onChange={handleTabChange}
          />

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Indent switcher */}
            {activeTab === 'format' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2 py-1 bg-muted/30">
                <span>Indent:</span>
                <button
                  type="button"
                  onClick={() => {
                    setIndent(2);
                    if (input) processJson('format', input, 2);
                  }}
                  className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                    indent === 2 ? 'bg-primary text-white' : 'hover:text-foreground'
                  }`}
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIndent(4);
                    if (input) processJson('format', input, 4);
                  }}
                  className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                    indent === 4 ? 'bg-primary text-white' : 'hover:text-foreground'
                  }`}
                >
                  4
                </button>
              </div>
            )}

            {/* Fullscreen / Screen-fit toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors"
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Maximize to Fullscreen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {/* Two-panel Grid Fixed to Screen Height for Independent Scrolling */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch ${
            isFullscreen
              ? 'fixed inset-0 z-50 p-4 bg-background/95 backdrop-blur-md h-screen overflow-hidden'
              : 'h-[calc(100vh-270px)] min-h-[520px]'
          }`}
        >
          <CodeEditor
            title="Input JSON"
            language="json"
            value={input}
            onChange={handleInputChange}
            placeholder='Paste unformatted, escaped, or messy JSON here... e.g. {"key":"value"}'
            onSample={handleLoadSample}
            onClear={handleClear}
          />

          <OutputPane
            title="Formatted Output"
            language="json"
            content={output}
            statusBadge={statusBadge}
            downloadFilename={`formatted-${activeTab}.json`}
            emptyMessage="Formatted or processed JSON will appear here in real-time as you type or paste."
          />
        </div>
      </div>
    </ToolLayout>
  );
}
