'use client';

import React, { useState, useCallback } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import SegmentedTabs, { TabOption } from '@/components/ui/SegmentedTabs';
import CopyButton from '@/components/ui/CopyButton';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { ExternalLink, Rocket, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseDeepLink, type ParsedDeepLink } from '@/lib/encoding/url';

type TabType = 'parse' | 'encode' | 'decode';

const TABS: TabOption<TabType>[] = [
  { id: 'parse', label: 'Parse & Inspect' },
  { id: 'encode', label: 'Percent Encode' },
  { id: 'decode', label: 'Decode' },
];

const PRESETS = [
  { label: 'Slack', link: 'slack://channel?team=T12345&id=C67890' },
  { label: 'Spotify', link: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT' },
  { label: 'Twitter', link: 'twitter://user?screen_name=bharatdevtools' },
  { label: 'Custom App', link: 'myapp://product/checkout?item=premium&ref=mobile_banner' },
];

export default function DeepLinkClient() {
  const [input, setInput] = useState('myapp://product/checkout?item=premium&ref=mobile_banner');
  const [encoded, setEncoded] = useState('');
  const [decoded, setDecoded] = useState('');
  const [parsed, setParsed] = useState<ParsedDeepLink | null>(null);
  const [error, setError] = useState('');
  const [launchStatus, setLaunchStatus] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('parse');

  const handleProcess = useCallback(() => {
    setError('');
    if (!input.trim()) {
      setError('Please enter a deep link URL.');
      return;
    }

    if (activeTab === 'parse') {
      const res = parseDeepLink(input.trim());
      if (!res) setError('Could not parse deep link. Ensure it follows scheme://path?query format.');
      else setParsed(res);
    } else if (activeTab === 'encode') {
      setEncoded(encodeURIComponent(input.trim()));
    } else if (activeTab === 'decode') {
      try {
        setDecoded(decodeURIComponent(input.trim()));
      } catch {
        setError('Invalid percent-encoded string.');
      }
    }
  }, [input, activeTab]);

  const handleLaunch = () => {
    if (!input.trim()) return;
    try {
      window.location.href = input.trim();
      setLaunchStatus('Deep link command dispatched. If no app opened, verify the application is installed on your OS.');
    } catch (e) {
      setLaunchStatus(`Launch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <ToolLayout toolId="deeplink">
      <div className="space-y-5">
        {/* Presets */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pb-2 border-b border-border">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Common Schemes:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setInput(p.link);
                setError('');
                setLaunchStatus('');
              }}
              className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-xs font-mono transition-colors border border-border/50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Action Header Card */}
        <div className="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SegmentedTabs
              tabs={TABS}
              activeTab={activeTab}
              onChange={(t) => {
                setActiveTab(t);
                setError('');
              }}
            />

            <button
              type="button"
              onClick={handleLaunch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-all shadow-2xs active:scale-95 shrink-0"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Launch in System App</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 font-mono">
              Deep Link URI
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError('');
                  setLaunchStatus('');
                }}
                placeholder="myapp://view/item?id=123"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
              <button
                type="button"
                onClick={handleProcess}
                className="px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shrink-0"
              >
                Inspect
              </button>
            </div>
          </div>

          {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

          {launchStatus && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{launchStatus}</span>
            </div>
          )}
        </div>

        {/* Encode/Decode Output */}
        {activeTab === 'encode' && encoded && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Percent-Encoded URI
              </span>
              <CopyButton text={encoded} />
            </div>
            <pre className="p-3.5 rounded-lg bg-muted/40 border border-border font-mono text-xs text-foreground overflow-x-auto break-all">
              {encoded}
            </pre>
          </div>
        )}

        {activeTab === 'decode' && decoded && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Decoded URI
              </span>
              <CopyButton text={decoded} />
            </div>
            <pre className="p-3.5 rounded-lg bg-muted/40 border border-border font-mono text-xs text-foreground overflow-x-auto break-all">
              {decoded}
            </pre>
          </div>
        )}

        {/* Parsed Structure Table */}
        {activeTab === 'parse' && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              URI Component Decomposition
            </span>

            {(() => {
              const res = parseDeepLink(input);
              if (!res) {
                return (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Enter a valid deep link above to decompose scheme, host, path, and parameters.
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-border/70">
                          <td className="w-36 px-4 py-2.5 font-medium text-muted-foreground">Custom Scheme</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-primary">{res.scheme}://</td>
                        </tr>
                        <tr className="border-b border-border/70">
                          <td className="w-36 px-4 py-2.5 font-medium text-muted-foreground">Host / Authority</td>
                          <td className="px-4 py-2.5 font-mono text-foreground">{res.host || '—'}</td>
                        </tr>
                        <tr className="border-b border-border/70">
                          <td className="w-36 px-4 py-2.5 font-medium text-muted-foreground">Path</td>
                          <td className="px-4 py-2.5 font-mono text-foreground">{res.path || '—'}</td>
                        </tr>
                        <tr>
                          <td className="w-36 px-4 py-2.5 font-medium text-muted-foreground">Fragment / Hash</td>
                          <td className="px-4 py-2.5 font-mono text-foreground">{res.fragment || '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {Object.keys(res.query).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground">Query Parameters:</span>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <tbody>
                            {Object.entries(res.query).map(([k, v]) => (
                              <tr key={k} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                                <td className="w-40 px-4 py-2 font-mono font-semibold text-primary">{k}</td>
                                <td className="px-4 py-2 font-mono text-foreground flex items-center justify-between gap-2">
                                  <span>{v}</span>
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
              );
            })()}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
