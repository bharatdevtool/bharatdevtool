'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { validateLottie } from '@/lib/lottie/validator';
import { LOTTIE_SAMPLES } from '@/lib/lottie/samples';
import { setCrossToolData, getCrossToolData } from '@/lib/crossToolData';
import { extractLottieFromFile } from '@/lib/lottie/dotLottie';
import type { ValidationSeverity, ValidationResult, ValidationIssue } from '@/lib/lottie/types';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Upload,
  FileCode,
  Sparkles,
  Film,
  SlidersHorizontal,
  Braces,
  Filter,
} from 'lucide-react';

type FilterSeverity = 'all' | 'error' | 'warning' | 'info';

export default function LottieValidatorClient() {
  const router = useRouter();
  const [activeSampleId, setActiveSampleId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const incoming = getCrossToolData<{ lottieJson?: string }>('lottie-validator', false);
      if (incoming?.lottieJson) return '';
    }
    return LOTTIE_SAMPLES[0].id;
  });
  const [rawJson, setRawJson] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const incoming = getCrossToolData<{ lottieJson?: string }>('lottie-validator', false);
      if (incoming?.lottieJson) return incoming.lottieJson;
    }
    return JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2);
  });
  const [filter, setFilter] = useState<FilterSeverity>('all');
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read incoming cross-tool data on mount
  useEffect(() => {
    const incoming = getCrossToolData<{ lottieJson?: string }>('lottie-validator', false);
    if (incoming?.lottieJson) {
      setRawJson(incoming.lottieJson);
      setActiveSampleId('');
    }
  }, []);

  const handleNavigateToPlayer = () => {
    setCrossToolData('lottie-player', { lottieJson: rawJson });
    router.push('/tools/lottie-player');
  };

  const handleNavigateToAnalyzer = () => {
    setCrossToolData('lottie-analyzer', { lottieJson: rawJson });
    router.push('/tools/lottie-analyzer');
  };

  const handleNavigateToFormatter = () => {
    setCrossToolData('json-formatter', { json: rawJson, tab: 'repair' });
    router.push('/tools/json-formatter');
  };

  // Compute validation result reactively
  const { validationResult, jsonError } = useMemo(() => {
    if (!rawJson.trim()) {
      return {
        jsonError: null,
        validationResult: {
          valid: false,
          hasErrors: true,
          hasWarnings: false,
          errorCount: 1,
          warningCount: 0,
          infoCount: 0,
          issues: [
            {
              id: 'empty',
              severity: 'error',
              category: 'schema',
              title: 'Empty JSON Payload',
              message: 'Please paste or upload a Lottie JSON file to begin validation.',
            } as ValidationIssue,
          ],
        },
      };
    }

    try {
      const parsed = JSON.parse(rawJson);
      return {
        jsonError: null,
        validationResult: validateLottie(parsed),
      };
    } catch (err) {
      const msg = (err as Error).message;
      return {
        jsonError: msg,
        validationResult: {
          valid: false,
          hasErrors: true,
          hasWarnings: false,
          errorCount: 1,
          warningCount: 0,
          infoCount: 0,
          issues: [
            {
              id: 'syntax-error',
              severity: 'error',
              category: 'schema',
              title: 'JSON Syntax Error',
              message: `Could not parse JSON: ${msg}`,
              suggestion: 'Use the Bharat Dev Tools JSON Formatter & Repair tool to fix syntax errors.',
            } as ValidationIssue,
          ],
        },
      };
    }
  }, [rawJson]);

  const filteredIssues = useMemo(() => {
    if (filter === 'all') return validationResult.issues;
    return validationResult.issues.filter((i) => i.severity === filter);
  }, [filter, validationResult.issues]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await extractLottieFromFile(file);
    if (!res.success || !res.rawJson) {
      setFileError(res.error || 'Failed to parse animation file.');
      return;
    }

    setRawJson(res.rawJson);
    setActiveSampleId('');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSampleSelect = (id: string) => {
    const s = LOTTIE_SAMPLES.find((item) => item.id === id);
    if (!s) return;
    setActiveSampleId(id);
    setRawJson(JSON.stringify(s.data, null, 2));
    setFileError(null);
  };

  return (
    <ToolLayout toolId="lottie-validator">
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border">
          {/* Sample Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Test Samples:
            </span>
            {LOTTIE_SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSampleSelect(s.id)}
                className={`px-2.5 py-1 rounded-lg border transition-colors ${
                  activeSampleId === s.id
                    ? 'bg-primary/10 border-primary text-primary font-medium'
                    : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Upload Button */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.lottie,application/json,application/zip"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" /> Upload File (.json / .lottie)
            </button>
            <CopyButton text={rawJson} label="Copy JSON" />
          </div>
        </div>

        {(jsonError || fileError) && (
          <ErrorMessage message={fileError || `JSON Parse Error: ${jsonError}`} />
        )}

        {/* Status Summary Banner */}
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
            validationResult.valid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
              : 'bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-100'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                validationResult.valid
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/20 text-red-600 dark:text-red-400'
              }`}
            >
              {validationResult.valid ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <AlertCircle className="w-7 h-7" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {validationResult.valid
                  ? 'Valid Lottie Animation'
                  : `${validationResult.errorCount} Critical Structural Issue(s) Found`}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {validationResult.valid
                  ? 'The animation meets core Bodymovin schema specifications with no critical hierarchy or reference errors.'
                  : 'Critical errors may cause lottie-web or native mobile renderers to fail or crash.'}
              </p>
            </div>
          </div>

          {/* Issue Counter Chips */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <div className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-card border border-border text-center">
              <span className="text-[10px] text-muted-foreground block uppercase font-medium">Errors</span>
              <span className={`text-base font-bold ${validationResult.errorCount > 0 ? 'text-red-500' : 'text-foreground'}`}>
                {validationResult.errorCount}
              </span>
            </div>
            <div className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-card border border-border text-center">
              <span className="text-[10px] text-muted-foreground block uppercase font-medium">Warnings</span>
              <span className={`text-base font-bold ${validationResult.warningCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
                {validationResult.warningCount}
              </span>
            </div>
            <div className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-card border border-border text-center">
              <span className="text-[10px] text-muted-foreground block uppercase font-medium">Advisories</span>
              <span className="text-base font-bold text-foreground">
                {validationResult.infoCount}
              </span>
            </div>
          </div>
        </div>

        {/* Main Grid: Code Editor on Left, Detailed Issue Report on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Raw JSON Code Input (5 Cols) */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-primary" /> Animation JSON
              </span>
              <span className="text-[11px]">100% In-Browser</span>
            </div>
            <textarea
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                setActiveSampleId('');
              }}
              rows={22}
              placeholder="Paste Lottie JSON payload here..."
              className="w-full p-3 font-mono text-xs rounded-xl bg-card border border-border focus:outline-hidden focus:ring-1 focus:ring-primary developer-scrollbar"
            />
          </div>

          {/* Right Column: Filterable Issues Feed (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-card border border-border text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({validationResult.issues.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('error')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'error'
                      ? 'bg-red-500 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Errors ({validationResult.errorCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('warning')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'warning'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Warnings ({validationResult.warningCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('info')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'info'
                      ? 'bg-blue-500 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Advisories ({validationResult.infoCount})
                </button>
              </div>

              <span className="text-[11px] text-muted-foreground hidden sm:inline flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filtered
              </span>
            </div>

            {/* Issues List Feed */}
            <div className="space-y-3">
              {filteredIssues.length === 0 ? (
                <div className="p-8 rounded-xl bg-card border border-border text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">
                    No issues found in this category!
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    The animation passed all structural, parent hierarchy, and asset checks cleanly.
                  </p>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {issue.severity === 'error' && (
                          <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold uppercase text-[10px]">
                            Error
                          </span>
                        )}
                        {issue.severity === 'warning' && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold uppercase text-[10px]">
                            Warning
                          </span>
                        )}
                        {issue.severity === 'info' && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold uppercase text-[10px]">
                            Advisory
                          </span>
                        )}
                        <span className="font-semibold text-foreground text-sm">
                          {issue.title}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground text-[10px] font-mono shrink-0">
                        {issue.category}
                      </span>
                    </div>

                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {issue.message}
                    </p>

                    {issue.location && (
                      <div className="text-[11px] font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                        Location: <span className="text-foreground">{issue.location}</span>
                      </div>
                    )}

                    {issue.suggestion && (
                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-primary/5 border border-primary/10 text-primary text-[11px]">
                        <span className="font-bold shrink-0">Suggestion:</span>
                        <span>{issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Quick Action Workflows */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleNavigateToPlayer}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors border border-border"
              >
                <Film className="w-3.5 h-3.5 text-primary" /> Preview in Player
              </button>
              <button
                type="button"
                onClick={handleNavigateToAnalyzer}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors border border-border"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" /> Inspect in Analyzer
              </button>
              <button
                type="button"
                onClick={handleNavigateToFormatter}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors border border-border"
              >
                <Braces className="w-3.5 h-3.5 text-emerald-500" /> Fix in Formatter
              </button>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

