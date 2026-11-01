'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import SegmentedTabs, { TabOption } from '@/components/ui/SegmentedTabs';
import CodeEditor from '@/components/ui/CodeEditor';
import OutputPane from '@/components/ui/OutputPane';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { encodeURL, decodeURL, parseURL } from '@/lib/encoding/url';

type Mode = 'encode' | 'decode';

const TABS: TabOption<Mode>[] = [
  { id: 'encode', label: 'Encode (Percent-Encoding)' },
  { id: 'decode', label: 'Decode & Inspect' },
];

export default function UrlEncoderClient() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paneHeight, setPaneHeight] = useState<number>(320);

  const parsed = mode === 'decode' && output ? parseURL(output) : null;

  function run(val: string, m: Mode) {
    setError(null);
    if (!val.trim()) {
      setOutput('');
      return;
    }
    try {
      setOutput(m === 'encode' ? encodeURL(val) : decodeURL(val));
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }

  function handleInput(val: string) {
    setInput(val);
    run(val, mode);
  }

  function handleMode(m: Mode) {
    setMode(m);
    run(input, m);
  }

  return (
    <ToolLayout toolId="url-encoder">
      <div className="space-y-4">
        {/* Top bar with tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
          <SegmentedTabs
            tabs={TABS}
            activeTab={mode}
            onChange={handleMode}
          />

          <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-2 py-1 bg-muted/30">
            <span className="text-[11px]">Height:</span>
            <button
              type="button"
              onClick={() => setPaneHeight(240)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                paneHeight === 240 ? 'bg-primary text-white' : 'hover:text-foreground'
              }`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setPaneHeight(360)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                paneHeight === 360 ? 'bg-primary text-white' : 'hover:text-foreground'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setPaneHeight(520)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                paneHeight === 520 ? 'bg-primary text-white' : 'hover:text-foreground'
              }`}
            >
              Tall
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        <div className="grid gap-4 lg:grid-cols-2 items-stretch h-[calc(100vh-270px)] min-h-[500px]">
          <CodeEditor
            title={mode === 'encode' ? 'Raw URL or Query String' : 'Percent-Encoded URL'}
            value={input}
            onChange={handleInput}
            placeholder={
              mode === 'encode'
                ? 'https://example.com/search?q=developer tools&filter=free'
                : 'https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Ddeveloper%20tools'
            }
            onSample={() => {
              const sample =
                mode === 'encode'
                  ? 'https://bharatdevtools.com/api?query=react & nextjs&lang=en#results'
                  : 'https%3A%2F%2Fbharatdevtools.com%2Fapi%3Fquery%3Dreact%20%26%20nextjs%26lang%3Den%23results';
              setInput(sample);
              run(sample, mode);
            }}
            onClear={() => {
              setInput('');
              setOutput('');
              setError(null);
            }}
          />

          <OutputPane
            title={mode === 'encode' ? 'Encoded Output' : 'Decoded URL'}
            content={output}
            statusBadge={output ? (mode === 'encode' ? 'Encoded' : 'Decoded') : undefined}
            downloadFilename={mode === 'encode' ? 'url-encoded.txt' : 'url-decoded.txt'}
            emptyMessage={mode === 'encode' ? 'Encoded URL string will appear here live.' : 'Decoded URL string will appear here.'}
          />
        </div>

        {/* URL Breakdown Table */}
        {parsed && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Parsed URL Components
              </span>
              <span className="text-xs text-muted-foreground">{Object.keys(parsed.params).length} query params</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {[
                    ['Protocol', parsed.protocol],
                    ['Host / Domain', parsed.host],
                    ['Path', parsed.pathname],
                    ['Query String', parsed.search],
                    ['Fragment / Hash', parsed.hash],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <tr key={k} className="border-b border-border/70 hover:bg-muted/30 transition-colors">
                        <td className="w-36 px-4 py-2.5 font-medium text-muted-foreground">{k}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground break-all">{v}</td>
                      </tr>
                    ))}
                  {Object.entries(parsed.params).map(([k, v]) => (
                    <tr key={k} className="border-b border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-primary pl-8 font-mono">?{k}</td>
                      <td className="px-4 py-2.5 font-mono text-foreground flex items-center justify-between gap-2">
                        <span className="break-all">{v}</span>
                        <CopyButton text={v} size="sm" variant="ghost" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
