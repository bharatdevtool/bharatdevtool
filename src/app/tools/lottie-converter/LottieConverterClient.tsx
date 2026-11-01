'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { parseLottieJSON } from '@/lib/lottie/parser';
import { createDotLottie, extractDotLottie, isDotLottieBuffer, type DotLottieManifest } from '@/lib/lottie/dotLottie';
import { LOTTIE_SAMPLES } from '@/lib/lottie/samples';
import { getCrossToolData, setCrossToolData } from '@/lib/crossToolData';
import type { LottieAnimation } from '@/lib/lottie/types';
import type { AnimationItem } from 'lottie-web';
import {
  Package,
  Download,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FolderArchive,
  HardDrive,
  Percent,
  Film,
  ShieldCheck,
  Gauge,
  Code2,
  FileText,
  Layers,
  ArrowRight,
  Maximize2,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type Mode = 'json-to-lottie' | 'lottie-to-json';

export default function LottieConverterClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('json-to-lottie');

  // Mode 1: JSON -> .lottie states
  const [jsonInput, setJsonInput] = useState<string>(() => JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [animationId, setAnimationId] = useState<string>('animation');
  const [loopSetting, setLoopSetting] = useState<boolean>(true);
  const [speedSetting, setSpeedSetting] = useState<number>(1);
  const [generatedDotLottie, setGeneratedDotLottie] = useState<Uint8Array | null>(null);
  const [compressionRatio, setCompressionRatio] = useState<number>(0);
  const [compressError, setCompressError] = useState<string | null>(null);

  // Mode 2: .lottie -> JSON states
  const [extractedJson, setExtractedJson] = useState<string>('');
  const [extractedManifest, setExtractedManifest] = useState<DotLottieManifest | null>(null);
  const [extractedAnimationId, setExtractedAnimationId] = useState<string>('');
  const [extractedInlinedImages, setExtractedInlinedImages] = useState<number>(0);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [jsonFormat, setJsonFormat] = useState<'pretty' | 'minify'>('pretty');
  const [archiveOriginalBytes, setArchiveOriginalBytes] = useState<number>(0);

  // Canvas Player Preview States
  const [previewAnimation, setPreviewAnimation] = useState<LottieAnimation | null>(LOTTIE_SAMPLES[0].data);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [bgType, setBgType] = useState<'grid' | 'obsidian' | 'light'>('grid');

  const containerRef = useRef<HTMLDivElement>(null);
  const animItemRef = useRef<AnimationItem | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const lottieFileInputRef = useRef<HTMLInputElement>(null);

  // Cross-tool data ingestion
  useEffect(() => {
    const incoming =
      getCrossToolData<{ lottieJson?: string }>('lottie-converter', false) ||
      getCrossToolData<{ lottieJson?: string }>('lottie-player', false);
    if (incoming?.lottieJson) {
      setJsonInput(incoming.lottieJson);
      setMode('json-to-lottie');
    }
  }, []);

  const handleNavigateToTool = (toolId: string, path: string) => {
    const activePayload = mode === 'json-to-lottie' ? jsonInput : extractedJson;
    if (activePayload) {
      setCrossToolData(toolId, { lottieJson: activePayload });
    }
    router.push(path);
  };

  // Preview Canvas Loader
  const loadPreview = useCallback(async (animData: LottieAnimation) => {
    if (!containerRef.current) return;
    if (animItemRef.current) {
      animItemRef.current.destroy();
      animItemRef.current = null;
    }

    try {
      const lottie = (await import('lottie-web')).default;
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: JSON.parse(JSON.stringify(animData)),
      });
      animItemRef.current = anim;
    } catch {
      // Ignore preview errors for malformed intermediate data
    }
  }, []);

  useEffect(() => {
    if (previewAnimation) {
      loadPreview(previewAnimation);
    }
    return () => {
      if (animItemRef.current) {
        animItemRef.current.destroy();
        animItemRef.current = null;
      }
    };
  }, [previewAnimation, loadPreview]);

  // Initial automatic compression calculation for Mode 1
  useEffect(() => {
    if (mode === 'json-to-lottie') {
      try {
        const parsed = JSON.parse(jsonInput);
        const parseCheck = parseLottieJSON(jsonInput);
        if (parseCheck.success && parseCheck.animation) {
          setPreviewAnimation(parseCheck.animation);
          const dotLottieBytes = createDotLottie(parsed, {
            id: animationId || 'animation',
            loop: loopSetting,
            speed: speedSetting,
          });
          setGeneratedDotLottie(dotLottieBytes);
          const rawSize = new Blob([jsonInput]).size;
          const compressedSize = dotLottieBytes.byteLength;
          const ratio = Math.round(((rawSize - compressedSize) / rawSize) * 100);
          setCompressionRatio(ratio);
          setCompressError(null);
        } else {
          setCompressError(parseCheck.error || 'Invalid Lottie JSON payload.');
          setGeneratedDotLottie(null);
        }
      } catch (err) {
        setCompressError((err as Error).message);
        setGeneratedDotLottie(null);
      }
    }
  }, [jsonInput, animationId, loopSetting, speedSetting, mode]);

  // Handle JSON File Upload for Mode 1
  const handleJsonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonInput(text);
      const name = file.name.replace(/\.json$/i, '');
      setAnimationId(name);
      setCompressError(null);
    } catch (err) {
      setCompressError(`Failed to read JSON: ${(err as Error).message}`);
    } finally {
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
    }
  };

  // Handle .lottie Archive Upload for Mode 2
  const handleLottieArchiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      setArchiveOriginalBytes(buffer.byteLength);

      const result = extractDotLottie(buffer);
      if (!result.success || !result.animation) {
        setExtractError(result.error || 'Failed to extract .lottie archive.');
        setExtractedJson('');
        setExtractedManifest(null);
        return;
      }

      const formatted = JSON.stringify(result.animation, null, jsonFormat === 'pretty' ? 2 : undefined);
      setExtractedJson(formatted);
      setExtractedManifest(result.manifest || null);
      setExtractedAnimationId(result.animationId || 'animation');
      setExtractedInlinedImages(result.inlinedImageCount);
      setPreviewAnimation(result.animation);
      setExtractError(null);
    } catch (err) {
      setExtractError(`Archive decompression failed: ${(err as Error).message}`);
    } finally {
      if (lottieFileInputRef.current) lottieFileInputRef.current.value = '';
    }
  };

  // Re-format extracted JSON when toggle changes
  useEffect(() => {
    if (extractedJson) {
      try {
        const parsed = JSON.parse(extractedJson);
        setExtractedJson(JSON.stringify(parsed, null, jsonFormat === 'pretty' ? 2 : undefined));
      } catch {
        // Ignore
      }
    }
  }, [jsonFormat]);

  // Mode 1: Download .lottie
  const handleDownloadLottie = () => {
    if (!generatedDotLottie) return;
    const blob = new Blob([generatedDotLottie as unknown as BlobPart], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${animationId || 'animation'}.lottie`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mode 2: Download .json
  const handleDownloadExtractedJson = () => {
    if (!extractedJson) return;
    const blob = new Blob([extractedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extractedAnimationId || 'extracted'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const originalJsonBytes = useMemo(() => new Blob([jsonInput]).size, [jsonInput]);
  const compressedDotLottieBytes = generatedDotLottie ? generatedDotLottie.byteLength : 0;

  return (
    <ToolLayout toolId="lottie-converter">
      <div className="space-y-6">
        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-between p-1.5 rounded-xl bg-muted border border-border max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setMode('json-to-lottie')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'json-to-lottie'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-primary" /> JSON → .lottie (Compress)
          </button>
          <button
            type="button"
            onClick={() => setMode('lottie-to-json')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'lottie-to-json'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-blue-500" /> .lottie → JSON (Extract)
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={jsonFileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleJsonFileUpload}
          className="hidden"
        />
        <input
          ref={lottieFileInputRef}
          type="file"
          accept=".lottie,application/zip"
          onChange={handleLottieArchiveUpload}
          className="hidden"
        />

        {/* MODE 1: JSON -> .lottie COMPRESSION */}
        {mode === 'json-to-lottie' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Input & Manifest Config (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-primary" /> Source Bodymovin JSON
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => jsonFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium border border-border transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-primary" /> Upload .json
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const s = LOTTIE_SAMPLES[0];
                        setJsonInput(JSON.stringify(s.data, null, 2));
                        setAnimationId(s.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium border border-border transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Sample
                    </button>
                  </div>
                </div>

                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={8}
                  placeholder="Paste Lottie JSON payload here..."
                  className="w-full p-3 font-mono text-xs rounded-lg bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-primary developer-scrollbar"
                />

                {compressError && <ErrorMessage message={compressError} />}

                {/* dotLottie Manifest Configuration */}
                <div className="pt-2 border-t border-border space-y-3">
                  <span className="text-xs font-semibold text-foreground block">
                    dotLottie Archive Metadata:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Animation ID</label>
                      <input
                        type="text"
                        value={animationId}
                        onChange={(e) => setAnimationId(e.target.value)}
                        placeholder="animation"
                        className="w-full p-2 text-xs font-mono rounded-lg bg-secondary/50 border border-border text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Playback Speed</label>
                      <select
                        value={speedSetting}
                        onChange={(e) => setSpeedSetting(parseFloat(e.target.value))}
                        className="w-full p-2 text-xs rounded-lg bg-secondary/50 border border-border text-foreground"
                      >
                        <option value="0.5">0.5x</option>
                        <option value="1">1.0x (Normal)</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2.0x</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Loop Playback</label>
                      <button
                        type="button"
                        onClick={() => setLoopSetting((prev) => !prev)}
                        className={`w-full p-2 text-xs rounded-lg border font-medium transition-colors cursor-pointer ${
                          loopSetting
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-secondary/50 border-border text-muted-foreground'
                        }`}
                      >
                        {loopSetting ? 'Enabled (Loop)' : 'Play Once'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Compression Metrics & Live Preview (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Compression Metric Badge Card */}
              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
                <span className="font-semibold text-xs text-foreground uppercase tracking-wider block">
                  Compression Results
                </span>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-border">
                    <div className="text-[10px] text-muted-foreground">Original JSON</div>
                    <div className="font-bold text-foreground text-xs mt-0.5 font-mono">
                      {formatBytes(originalJsonBytes)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-border">
                    <div className="text-[10px] text-muted-foreground">.lottie Archive</div>
                    <div className="font-bold text-primary text-xs mt-0.5 font-mono">
                      {formatBytes(compressedDotLottieBytes)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <div className="text-[10px] font-medium">Reduction</div>
                    <div className="font-bold text-xs mt-0.5 font-mono">
                      {compressionRatio > 0 ? `-${compressionRatio}%` : '0%'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!generatedDotLottie}
                  onClick={handleDownloadLottie}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download Compressed .lottie
                </button>
              </div>

              {/* Live Canvas Preview */}
              <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-card text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-primary" /> Packaged Preview
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Grid"
                      onClick={() => setBgType('grid')}
                      className={`w-4 h-4 rounded border ${bgType === 'grid' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                    />
                    <button
                      type="button"
                      title="Dark Obsidian"
                      onClick={() => setBgType('obsidian')}
                      className={`w-4 h-4 rounded bg-[#090E17] border ${bgType === 'obsidian' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                    />
                    <button
                      type="button"
                      title="Light"
                      onClick={() => setBgType('light')}
                      className={`w-4 h-4 rounded bg-white border ${bgType === 'light' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                    />
                  </div>
                </div>

                <div
                  className={`relative w-full h-[220px] flex items-center justify-center ${
                    bgType === 'grid'
                      ? 'bg-[#0F172A] bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px]'
                      : bgType === 'light'
                      ? 'bg-white'
                      : 'bg-[#090E17]'
                  }`}
                >
                  <div ref={containerRef} className="w-[180px] h-[180px] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: .lottie -> JSON EXTRACTION */}
        {mode === 'lottie-to-json' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Dropzone & Manifest Stats (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-2xl bg-card border-2 border-dashed border-border hover:border-primary/50 text-center transition-colors space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">Drop .lottie Archive Here</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    100% client-side memory extraction. Zero uploads.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => lottieFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" /> Select .lottie File
                </button>
              </div>

              {extractError && <ErrorMessage message={extractError} />}

              {extractedManifest && (
                <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2.5 text-xs">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
                    dotLottie Manifest Information
                  </span>
                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span>Generator:</span>
                      <strong className="text-foreground">{extractedManifest.generator || 'Bodymovin'}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span>Archive Version:</span>
                      <strong className="text-foreground font-mono">{extractedManifest.version || '1.0.0'}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span>Inlined Images:</span>
                      <strong className="text-foreground font-mono">{extractedInlinedImages}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Original Archive Size:</span>
                      <strong className="text-foreground font-mono">{formatBytes(archiveOriginalBytes)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Extracted JSON Code & Download (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-500" /> Extracted Bodymovin JSON
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-border rounded-lg bg-secondary/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setJsonFormat('pretty')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          jsonFormat === 'pretty'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Pretty
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonFormat('minify')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          jsonFormat === 'minify'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Minify
                      </button>
                    </div>

                    <CopyButton text={extractedJson} label="Copy JSON" />
                  </div>
                </div>

                <textarea
                  value={extractedJson}
                  readOnly
                  rows={12}
                  placeholder="Upload a .lottie archive to extract and decompress JSON code..."
                  className="w-full p-3 font-mono text-xs rounded-lg bg-background border border-border text-foreground developer-scrollbar"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    Size: {formatBytes(new Blob([extractedJson]).size)}
                  </span>
                  <button
                    type="button"
                    disabled={!extractedJson}
                    onClick={handleDownloadExtractedJson}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download .json
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Lottie Suite Workflow Footer */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> Connected Lottie Suite Tools:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleNavigateToTool('lottie-player', '/tools/lottie-player')}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground font-medium transition-colors cursor-pointer"
            >
              Lottie Player & Studio
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToTool('lottie-editor', '/tools/lottie-editor')}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground font-medium transition-colors cursor-pointer"
            >
              Lottie JSON Editor
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToTool('lottie-validator', '/tools/lottie-validator')}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground font-medium transition-colors cursor-pointer"
            >
              Lottie Validator
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToTool('lottie-optimizer', '/tools/lottie-optimizer')}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground font-medium transition-colors cursor-pointer"
            >
              Lottie Optimizer
            </button>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

