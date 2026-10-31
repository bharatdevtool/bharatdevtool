'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CodeEditor from '@/components/ui/CodeEditor';
import { analyzeText, TextStats } from '@/lib/text/wordCounter';
import { FileText, Clock, Type, AlignLeft, BookOpen, Sparkles, Hash } from 'lucide-react';

const SAMPLE_TEXT = `Bharat Dev Tools is a suite of 20 modern, lightweight, client-side utilities engineered for developers, architects, and technical professionals. Every single tool runs directly in your web browser with zero server roundtrips, ensuring total confidentiality and privacy for your source code, configuration files, credentials, and API requests.

Whether formatting complex JSON structures, debugging cURL requests, testing regular expressions, or generating cryptographic UUIDs, the application provides instantaneous feedback and high precision.`;

export default function WordCounterClient() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const stats = analyzeText(text);

  return (
    <ToolLayout toolId="word-counter">
      <div className="space-y-6">
        {/* Input Textarea */}
        <CodeEditor
          title="Input Document / Content"
          value={text}
          onChange={setText}
          placeholder="Paste or type text here to analyze words, characters, sentences, and reading time..."
          height="h-56 sm:h-64"
          onSample={() => setText(SAMPLE_TEXT)}
          onClear={() => setText('')}
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs text-center flex flex-col justify-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-primary font-mono tabular-nums">
              {stats.words.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Type className="w-3.5 h-3.5" /> Words
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs text-center flex flex-col justify-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono tabular-nums">
              {stats.characters.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Hash className="w-3.5 h-3.5" /> Characters
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs text-center flex flex-col justify-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono tabular-nums">
              {stats.sentences.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <AlignLeft className="w-3.5 h-3.5" /> Sentences
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs text-center flex flex-col justify-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono tabular-nums">
              {stats.paragraphs.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Paragraphs
            </span>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Reading Time (200 wpm)</span>
              <span className="text-sm font-bold text-foreground">
                {stats.readingTimeMin > 0 ? `${stats.readingTimeMin} min ` : ''}
                {stats.readingTimeSec}s
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Characters (No Spaces)</span>
              <span className="text-sm font-bold text-foreground font-mono">
                {stats.charactersNoSpaces.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Average Word Length</span>
              <span className="text-sm font-bold text-foreground font-mono">
                {stats.avgWordLength} characters
              </span>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
