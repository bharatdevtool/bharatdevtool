'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CodeEditor from '@/components/ui/CodeEditor';
import OutputPane from '@/components/ui/OutputPane';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { Terminal, Sparkles, Send, Globe, Code2 } from 'lucide-react';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  raw: string;
}

function parseCurl(cmd: string): ParsedCurl | null {
  if (!cmd.includes('curl')) return null;
  const method =
    (cmd.match(/-X\s+(['"]?)(\w+)\1/) || cmd.match(/--request\s+(['"]?)(\w+)\1/))?.[2]?.toUpperCase() ??
    (cmd.includes('-d ') || cmd.includes('--data') ? 'POST' : 'GET');
  const urlMatch = cmd.match(/curl\s+(?:[^\s]*?\s+)*['"]?(https?:\/\/[^\s'"\\]+)['"]?/);
  const url = urlMatch?.[1] ?? '';
  const headers: Record<string, string> = {};
  const headerRe = /-H\s+['"]([^'"]+)['"]/g;
  let hm;
  while ((hm = headerRe.exec(cmd)) !== null) {
    const [k, ...rest] = hm[1].split(': ');
    headers[k] = rest.join(': ');
  }
  const bodyMatch = cmd.match(/(?:-d|--data(?:-raw)?)\s+['"]([^'"]*)['"]/);
  const body = bodyMatch?.[1] ?? '';
  return { method, url, headers, body, raw: cmd };
}

function toFetch(p: ParsedCurl): string {
  const opts: Record<string, unknown> = { method: p.method };
  if (Object.keys(p.headers).length) opts.headers = p.headers;
  if (p.body) {
    try {
      opts.body = JSON.parse(p.body);
    } catch {
      opts.body = p.body;
    }
  }
  const optsStr = Object.keys(opts).length > 1 || p.method !== 'GET' ? `, ${JSON.stringify(opts, null, 2)}` : '';
  return `// JavaScript fetch() equivalent\nconst response = await fetch('${p.url}'${optsStr});\nconst data = await response.json();\nconsole.log(data);`;
}

function toPython(p: ParsedCurl): string {
  const headersStr = Object.keys(p.headers).length ? `\nheaders = ${JSON.stringify(p.headers, null, 4)}` : '';
  const dataStr = p.body ? `\ndata = ${p.body}` : '';
  const args = [
    `'${p.url}'`,
    Object.keys(p.headers).length ? 'headers=headers' : null,
    p.body ? (p.body.trim().startsWith('{') ? 'json=data' : 'data=data') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return `# Python requests equivalent\nimport requests${headersStr}${dataStr}\n\nresponse = requests.${p.method.toLowerCase()}(${args})\nprint(response.json())`;
}

const PRESETS = [
  {
    label: 'POST JSON',
    cmd: `curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer my_secret_token' \\\n  -d '{"name": "Aarav Sharma", "email": "aarav@example.com", "role": "developer"}'`,
  },
  {
    label: 'GET with Headers',
    cmd: `curl 'https://api.github.com/repos/facebook/react' \\\n  -H 'Accept: application/vnd.github.v3+json' \\\n  -H 'User-Agent: BharatDevTools'`,
  },
];

export default function CurlTesterClient() {
  const [input, setInput] = useState(PRESETS[0].cmd);
  const [error, setError] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'fetch' | 'python'>('fetch');

  let parsed: ParsedCurl | null = null;
  if (input.trim()) {
    parsed = parseCurl(input);
    if (!parsed) {
      if (!error) setError('Could not parse cURL command. Make sure it starts with `curl` and contains an http/https URL.');
    } else if (error) {
      setError(null);
    }
  }

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    PATCH: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  };

  const snippet = parsed ? (codeTab === 'fetch' ? toFetch(parsed) : toPython(parsed)) : '';

  return (
    <ToolLayout toolId="curl-tester">
      <div className="space-y-4">
        {/* Preset quick actions */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pb-2 border-b border-border">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Samples:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setInput(p.cmd);
                setError(null);
              }}
              className="px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted hover:text-foreground text-xs font-medium transition-colors border border-border/50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input cURL */}
        <CodeEditor
          title="cURL Command"
          language="bash"
          value={input}
          onChange={(val) => {
            setError(null);
            setInput(val);
          }}
          placeholder="Paste cURL command here... e.g. curl -X GET https://api.example.com"
          height="h-44 sm:h-52"
          onClear={() => {
            setInput('');
            setError(null);
          }}
        />

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {/* Parsed Inspection */}
        {parsed && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Request Breakdown Card */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Parsed HTTP Request
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${
                    methodColors[parsed.method] || 'bg-muted text-foreground border-border'
                  }`}
                >
                  {parsed.method}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <span className="font-semibold text-muted-foreground w-20 shrink-0">Endpoint</span>
                  <span className="font-mono text-foreground break-all">{parsed.url || '—'}</span>
                </div>

                {Object.keys(parsed.headers).length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
                    <span className="font-semibold text-muted-foreground block mb-1">
                      Headers ({Object.keys(parsed.headers).length})
                    </span>
                    {Object.entries(parsed.headers).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 font-mono py-0.5 border-b border-border/30 last:border-0">
                        <span className="text-primary font-medium">{k}</span>
                        <span className="text-muted-foreground truncate max-w-md">{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {parsed.body && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
                    <span className="font-semibold text-muted-foreground block mb-1">Request Payload</span>
                    <pre className="p-2.5 rounded bg-background border border-border/50 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all text-foreground">
                      {parsed.body}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Code Snippet */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SegmentedTabs
                  tabs={[
                    { id: 'fetch', label: 'JavaScript (fetch)' },
                    { id: 'python', label: 'Python (requests)' },
                  ]}
                  activeTab={codeTab}
                  onChange={setCodeTab}
                  size="sm"
                />
              </div>

              <OutputPane
                title={codeTab === 'fetch' ? 'JavaScript fetch() Code' : 'Python requests Code'}
                language={codeTab === 'fetch' ? 'javascript' : 'python'}
                content={snippet}
                height="h-56"
                downloadFilename={codeTab === 'fetch' ? 'request.js' : 'request.py'}
              />
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
