'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ToolLayout from '@/components/layout/ToolLayout';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { optimizeLottie } from '@/lib/lottie/optimizer';
import { parseLottieJSON, sanitizeAnimationForPrivacy } from '@/lib/lottie/parser';
import { LOTTIE_SAMPLES } from '@/lib/lottie/samples';
import { setCrossToolData } from '@/lib/crossToolData';
import { useCrossToolData } from '@/hooks/useCrossToolData';
import { extractLottieFromFile, createDotLottie } from '@/lib/lottie/dotLottie';
import type { LottieAnimation, LottieOptimizationOptions } from '@/lib/lottie/types';
import type { AnimationItem } from 'lottie-web';
import { loadLottie } from '@/lib/lottie/loader';
import {
  Download,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  GitCompare,
  Sliders,
  AlertTriangle,
  Info,
  ShieldCheck,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Runs the optimizer, falling back to the untouched input if it throws on malformed data */
function optimizeOrPassthrough(
  animationData: LottieAnimation,
  rawJson: string,
  opts: Partial<LottieOptimizationOptions>
) {
  try {
    return optimizeLottie(animationData, opts);
  } catch {
    const size = new TextEncoder().encode(rawJson).length;
    return {
      optimizedAnimation: animationData,
      optimizedJson: rawJson,
      originalSize: size,
      optimizedSize: size,
      savedBytes: 0,
      savingsPercentage: 0,
    };
  }
}

export default function LottieOptimizerClient() {
  const router = useRouter();
  const [activeSampleId, setActiveSampleId] = useState<string>(LOTTIE_SAMPLES[0].id);
  const [animationData, setAnimationData] = useState<LottieAnimation>(LOTTIE_SAMPLES[0].data);
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [error, setError] = useState<string | null>(null);

  // Check for incoming cross-tool data on mount
  useCrossToolData<{ lottieJson: string }>('lottie-optimizer', ({ lottieJson }) => {
    const parsed = parseLottieJSON(lottieJson);
    if (parsed.success && parsed.animation) {
      setAnimationData(parsed.animation);
      setRawJson(lottieJson);
      setActiveSampleId('');
    }
  });

  // Optimization Options State
  const [precision, setPrecision] = useState<number | 'off'>(2);
  const [removeNames, setRemoveNames] = useState<boolean>(false);
  const [removeMarkers, setRemoveMarkers] = useState<boolean>(false);
  const [removeHidden, setRemoveHidden] = useState<boolean>(false);
  const [removeMetadata, setRemoveMetadata] = useState<boolean>(false);
  const [minifyWhitespace, setMinifyWhitespace] = useState<boolean>(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Player container refs
  const originalContainerRef = useRef<HTMLDivElement>(null);
  const optimizedContainerRef = useRef<HTMLDivElement>(null);
  const originalAnimRef = useRef<AnimationItem | null>(null);
  const optimizedAnimRef = useRef<AnimationItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate optimization result
  const optimizationResult = useMemo(
    () =>
      optimizeOrPassthrough(animationData, rawJson, {
        roundPrecision: precision === 'off' ? false : precision,
        removeEditorNames: removeNames,
        removeMarkers,
        removeHiddenLayers: removeHidden,
        removeMetadata,
        minifyWhitespace,
      }),
    [animationData, precision, removeNames, removeMarkers, removeHidden, removeMetadata, minifyWhitespace, rawJson]
  );

  const handleCompareInJsonDiff = () => {
    setCrossToolData('json-diff', {
      left: JSON.stringify(animationData, null, 2),
      right: optimizationResult.optimizedJson,
    });
    router.push('/jsondiff/');
  };

  // Load and synchronize side-by-side players
  useEffect(() => {
    let isCancelled = false;

    async function loadPlayers() {
      if (!originalContainerRef.current || !optimizedContainerRef.current) return;

      if (originalAnimRef.current) originalAnimRef.current.destroy();
      if (optimizedAnimRef.current) optimizedAnimRef.current.destroy();

      try {
        const lottie = await loadLottie();
        if (isCancelled) return;

        // Original Player
        originalAnimRef.current = lottie.loadAnimation({
          container: originalContainerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: isPlaying,
          animationData: sanitizeAnimationForPrivacy(animationData),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });

        // Optimized Player
        optimizedAnimRef.current = lottie.loadAnimation({
          container: optimizedContainerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: isPlaying,
          animationData: sanitizeAnimationForPrivacy(optimizationResult.optimizedAnimation),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });

        // Synchronize frames
        originalAnimRef.current.addEventListener('enterFrame', () => {
          if (
            originalAnimRef.current &&
            optimizedAnimRef.current &&
            Math.abs(originalAnimRef.current.currentFrame - optimizedAnimRef.current.currentFrame) > 2
          ) {
            optimizedAnimRef.current.goToAndPlay(originalAnimRef.current.currentFrame, true);
          }
        });
      } catch (err) {
        setError(`Failed to render comparison players: ${(err as Error).message}`);
      }
    }

    loadPlayers();

    return () => {
      isCancelled = true;
      if (originalAnimRef.current) originalAnimRef.current.destroy();
      if (optimizedAnimRef.current) optimizedAnimRef.current.destroy();
    };
  }, [animationData, optimizationResult.optimizedAnimation]);

  // Handle Play/Pause
  const togglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        originalAnimRef.current?.play();
        optimizedAnimRef.current?.play();
      } else {
        originalAnimRef.current?.pause();
        optimizedAnimRef.current?.pause();
      }
      return next;
    });
  };

  const handleRestart = () => {
    originalAnimRef.current?.goToAndPlay(0, true);
    optimizedAnimRef.current?.goToAndPlay(0, true);
    setIsPlaying(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await extractLottieFromFile(file);
    if (!res.success || !res.animation) {
      setError(res.error || 'Failed to parse animation file.');
      return;
    }

    setAnimationData(res.animation);
    setRawJson(res.rawJson || JSON.stringify(res.animation, null, 2));
    setActiveSampleId('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    analytics.track(ANALYTICS_EVENTS.LOAD_LOTTIE, { tool: 'optimizer', format: file.name.toLowerCase().endsWith('.lottie') ? 'lottie' : 'json' });
  };

  const handleSampleSelect = (id: string) => {
    const s = LOTTIE_SAMPLES.find((item) => item.id === id);
    if (!s) return;
    setActiveSampleId(id);
    setAnimationData(s.data);
    setRawJson(JSON.stringify(s.data, null, 2));
    setError(null);
  };

  const handleDownload = () => {
    const blob = new Blob([optimizationResult.optimizedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-${animationData.nm || 'animation'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    analytics.track(ANALYTICS_EVENTS.OPTIMIZE_LOTTIE, {
      format: 'json',
      savings_percent: optimizationResult.savingsPercentage,
    });
  };

  const handleDownloadDotLottie = () => {
    const bytes = createDotLottie(optimizationResult.optimizedAnimation, {
      name: animationData.nm || 'animation',
      id: animationData.nm?.toLowerCase().replace(/\s+/g, '_') || 'animation_1',
    });
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-${animationData.nm || 'animation'}.lottie`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    analytics.track(ANALYTICS_EVENTS.OPTIMIZE_LOTTIE, {
      format: 'lottie',
      savings_percent: optimizationResult.savingsPercentage,
    });
  };

  return (
    <ToolLayout toolId="lottie-optimizer">
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

          {/* Action Buttons */}
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
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Download .json
            </button>
            <button
              type="button"
              onClick={handleDownloadDotLottie}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors shadow-2xs"
              title="Download compressed dotLottie (.lottie) archive"
            >
              <Download className="w-3.5 h-3.5" /> Download .lottie
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Reduction Metrics Banner */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Optimization Summary
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-extrabold text-foreground font-mono">
                {formatBytes(optimizationResult.originalSize)}
              </span>
              <span className="text-muted-foreground text-sm">→</span>
              <span className="text-2xl font-extrabold text-emerald-500 font-mono">
                {formatBytes(optimizationResult.optimizedSize)}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
                -{optimizationResult.savingsPercentage}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Saved {formatBytes(optimizationResult.savedBytes)} using conservative non-destructive transforms.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <CopyButton text={optimizationResult.optimizedJson} label="Copy Optimized JSON" />
            <button
              type="button"
              onClick={handleCompareInJsonDiff}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <GitCompare className="w-3.5 h-3.5 text-primary" /> Compare in JSON Diff
            </button>
          </div>
        </div>

        {/* Studio Grid: Options on Left, Synchronized Visual Players on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Options Panel (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-xl bg-card border border-border space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-primary" /> Conservative Settings
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">Reversible</span>
              </div>

              {/* Setting 1: Precision */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground block">
                  Float Coordinate Precision
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Off', val: 'off' },
                    { label: '3 Dec', val: 3 },
                    { label: '2 Dec', val: 2 },
                    { label: '1 Dec', val: 1 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPrecision(p.val as number | 'off')}
                      className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        precision === p.val
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Rounds non-integer floats (e.g. 14.2857 → 14.29). Never rounds integers.
                </p>
              </div>

              {/* Setting 2: Whitespace */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={minifyWhitespace}
                  onChange={(e) => setMinifyWhitespace(e.target.checked)}
                  className="mt-0.5 rounded accent-primary"
                />
                <div>
                  <span className="font-medium text-foreground block">Minify Whitespace</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Removes indentation and newline spaces for standard production deployment.
                  </span>
                </div>
              </label>

              {/* Setting 3: Remove Editor Names */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={removeNames}
                  onChange={(e) => setRemoveNames(e.target.checked)}
                  className="mt-0.5 rounded accent-primary"
                />
                <div>
                  <span className="font-medium text-foreground block">Strip Layer Names (&quot;nm&quot;)</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Removes designer reference names created in After Effects without altering rendering.
                  </span>
                </div>
              </label>

              {/* Setting 4: Remove Markers */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={removeMarkers}
                  onChange={(e) => setRemoveMarkers(e.target.checked)}
                  className="mt-0.5 rounded accent-primary"
                />
                <div>
                  <span className="font-medium text-foreground block">Strip Timeline Markers</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Removes non-essential timeline annotations and comment tags.
                  </span>
                </div>
              </label>

              {/* Setting 5: Remove Hidden Layers */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={removeHidden}
                  onChange={(e) => setRemoveHidden(e.target.checked)}
                  className="mt-0.5 rounded accent-primary"
                />
                <div>
                  <span className="font-medium text-foreground block">Remove Disabled Layers (&quot;hd&quot;)</span>
                  <span className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                    Only check if your application does not dynamically toggle hidden layers with code.
                  </span>
                </div>
              </label>
            </div>

            {/* Quick Bridge to Other Tools */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs">
              <span className="font-semibold text-foreground uppercase tracking-wider block text-[11px]">
                Workflows
              </span>
              <button
                type="button"
                onClick={() => {
                  setCrossToolData('lottie-player', { lottieJson: optimizationResult.optimizedJson });
                  router.push('/lottie-player');
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-primary" /> Test Optimized in Player
                </span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrossToolData('lottie-validator', { lottieJson: optimizationResult.optimizedJson });
                  router.push('/lottie-validator');
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Validate Optimized JSON
                </span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Synchronized Viewports (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Canvas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-semibold text-foreground">Original File</span>
                  <span className="font-mono text-muted-foreground">
                    {formatBytes(optimizationResult.originalSize)}
                  </span>
                </div>
                <div className="h-[280px] rounded-xl border border-border bg-[#090E17] flex items-center justify-center p-4 overflow-hidden shadow-inner">
                  <div ref={originalContainerRef} className="w-full h-full flex items-center justify-center pointer-events-none" />
                </div>
              </div>

              {/* Optimized Canvas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-semibold text-emerald-500">Optimized Result</span>
                  <span className="font-mono text-emerald-500 font-bold">
                    {formatBytes(optimizationResult.optimizedSize)}
                  </span>
                </div>
                <div className="h-[280px] rounded-xl border border-emerald-500/30 bg-[#090E17] flex items-center justify-center p-4 overflow-hidden shadow-inner">
                  <div ref={optimizedContainerRef} className="w-full h-full flex items-center justify-center pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Synchronized Playback Bar */}
            <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlaying ? 'Pause Players' : 'Play Players'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors"
                  title="Restart Synchronized Players"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Target Device Notice */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Web SVG preview. Mobile runtimes (Android/iOS) should be tested on-device.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

