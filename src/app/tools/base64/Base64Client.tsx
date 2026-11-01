'use client';

import React, { useState, useCallback } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import SegmentedTabs, { TabOption } from '@/components/ui/SegmentedTabs';
import CodeEditor from '@/components/ui/CodeEditor';
import OutputPane from '@/components/ui/OutputPane';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { encodeBase64, decodeBase64, isValidBase64 } from '@/lib/encoding/base64';

type Mode = 'encode' | 'decode';

const TABS: TabOption<Mode>[] = [
  { id: 'encode', label: 'Encode to Base64' },
  { id: 'decode', label: 'Decode from Base64' },
];

export default function Base64Client() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [paneHeight, setPaneHeight] = useState<number>(360);

  const process = useCallback((text: string, m: Mode) => {
    setError('');
    if (!text.trim()) {
      setOutput('');
      return;
    }
    try {
      if (m === 'encode') {
        setOutput(encodeBase64(text));
      } else {
        if (!isValidBase64(text.trim())) throw new Error('Invalid Base64 string. Check for invalid characters or incorrect padding.');
        setOutput(decodeBase64(text.trim()));
      }
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, []);

  const handleInputChange = (val: string) => {
    setInput(val);
    process(val, mode);
  };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setOutput('');
    setError('');
    process(input, m);
  };

  return (
    <ToolLayout toolId="base64">
      <div className="space-y-4">
        {/* Top bar with tabs and height controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
          <SegmentedTabs
            tabs={TABS}
            activeTab={mode}
            onChange={handleModeChange}
          />

          <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-2 py-1 bg-muted/30">
            <span className="text-[11px]">Height:</span>
            <button
              type="button"
              onClick={() => setPaneHeight(280)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                paneHeight === 280 ? 'bg-primary text-white' : 'hover:text-foreground'
              }`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setPaneHeight(400)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                paneHeight === 400 ? 'bg-primary text-white' : 'hover:text-foreground'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setPaneHeight(580)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                paneHeight === 580 ? 'bg-primary text-white' : 'hover:text-foreground'
              }`}
            >
              Tall
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch h-[calc(100vh-270px)] min-h-[500px]">
          <CodeEditor
            title={mode === 'encode' ? 'Plain Text Input' : 'Base64 Input'}
            value={input}
            onChange={handleInputChange}
            placeholder={mode === 'encode' ? 'Enter plain text or JSON to encode to Base64...' : 'Enter valid Base64 string to decode...'}
            onSample={() => {
              const sample = mode === 'encode' ? 'Hello from Bharat Dev Tools! 🚀' : 'SGVsbG8gZnJvbSBCaGFyYXQgRGV2IFRvb2xzISA=';
              setInput(sample);
              process(sample, mode);
            }}
            onClear={() => {
              setInput('');
              setOutput('');
              setError('');
            }}
          />

          <OutputPane
            title={mode === 'encode' ? 'Base64 Encoded Output' : 'Decoded Plain Text'}
            content={output}
            statusBadge={output ? (mode === 'encode' ? 'Encoded' : 'Decoded') : undefined}
            downloadFilename={mode === 'encode' ? 'encoded.b64' : 'decoded.txt'}
            emptyMessage={mode === 'encode' ? 'Base64 string will appear here live as you type or paste.' : 'Decoded plain text will appear here.'}
          />
        </div>
      </div>
    </ToolLayout>
  );
}
