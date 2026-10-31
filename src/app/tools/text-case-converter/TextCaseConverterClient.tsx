'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CodeEditor from '@/components/ui/CodeEditor';
import CopyButton from '@/components/ui/CopyButton';
import { convertCase, CASE_OPTIONS, CaseType } from '@/lib/text/caseConverter';
import { CaseSensitive, Sparkles } from 'lucide-react';

export default function TextCaseConverterClient() {
  const [input, setInput] = useState('user authentication service token');

  return (
    <ToolLayout toolId="text-case-converter">
      <div className="space-y-6">
        {/* Input Textarea */}
        <CodeEditor
          title="Input Text"
          value={input}
          onChange={setInput}
          placeholder="Enter text or code identifier to convert across all naming conventions..."
          height="h-32 sm:h-36"
          onSample={() => setInput('user authentication service token')}
          onClear={() => setInput('')}
        />

        {/* All Cases Live Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Live Conversion Matrix ({CASE_OPTIONS.length} Conventions)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CASE_OPTIONS.map((opt) => {
              const converted = input ? convertCase(input, opt.value) : opt.example;
              return (
                <div
                  key={opt.value}
                  className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex flex-col justify-between gap-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{opt.label}</span>
                    <CopyButton text={converted} size="sm" variant="ghost" />
                  </div>

                  <code className="font-mono text-xs sm:text-sm font-medium text-foreground break-all select-all py-1">
                    {converted}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
