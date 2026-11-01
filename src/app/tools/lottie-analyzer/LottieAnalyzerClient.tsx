'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { analyzeLottie } from '@/lib/lottie/analyzer';
import { parseLottieJSON } from '@/lib/lottie/parser';
import { LOTTIE_SAMPLES } from '@/lib/lottie/samples';
import { getCrossToolData, setCrossToolData } from '@/lib/crossToolData';
import type { LottieAnalysisResult } from '@/lib/lottie/types';
import {
  FileText,
  SlidersHorizontal,
  Upload,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Clock,
  Maximize,
  HardDrive,
  AlertTriangle,
  Film,
  ShieldCheck,
  Gauge,
  ExternalLink,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function LottieAnalyzerClient() {
  const router = useRouter();
  const [activeSampleId, setActiveSampleId] = useState<string>(LOTTIE_SAMPLES[0].id);
  const [rawJson, setRawJson] = useState<string>(JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cross-tool data ingestion
  useEffect(() => {
    const incoming = getCrossToolData<{ lottieJson?: string }>('lottie-analyzer');
    if (incoming?.lottieJson) {
      setRawJson(incoming.lottieJson);
      setActiveSampleId('');
      setError(null);
    }
  }, []);

  const handleNavigateToTool = (toolId: string, path: string) => {
    setCrossToolData(toolId, { lottieJson: rawJson });
    router.push(path);
  };

  const analysis: LottieAnalysisResult = useMemo(() => {
    try {
      const parsed = parseLottieJSON(rawJson);
      if (!parsed.success || !parsed.animation) {
        return createEmptyAnalysis(parsed.error || 'Invalid Lottie JSON');
      }
      return analyzeLottie(parsed.animation, rawJson);
    } catch (err) {
      return createEmptyAnalysis((err as Error).message);
    }
  }, [rawJson]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds the 25MB browser limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawJson(content);
      setActiveSampleId('');
      setError(null);
    };
    reader.onerror = () => {
      setError('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleSampleSelect = (id: string) => {
    const s = LOTTIE_SAMPLES.find((item) => item.id === id);
    if (!s) return;
    setActiveSampleId(id);
    setRawJson(JSON.stringify(s.data, null, 2));
    setError(null);
  };

  return (
    <ToolLayout toolId="lottie-analyzer">
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
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" /> Upload JSON
            </button>
            <CopyButton text={rawJson} label="Copy JSON" />
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: File Size */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>File Payload</span>
              <HardDrive className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {formatBytes(analysis.rawJsonBytes)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {analysis.rasterPercentage > 0 ? (
                <span className="text-amber-500 font-medium">
                  {analysis.rasterPercentage}% embedded raster
                </span>
              ) : (
                '100% Vector shapes'
              )}
            </p>
          </div>

          {/* Card 2: Dimensions */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Canvas Bounds</span>
              <Maximize className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {analysis.metadata.width && analysis.metadata.height ? (
                `${analysis.metadata.width} × ${analysis.metadata.height}`
              ) : (
                <span className="text-amber-500 font-medium text-base">[Missing]</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {analysis.metadata.width && analysis.metadata.height
                ? `Aspect Ratio: ${(analysis.metadata.width / analysis.metadata.height).toFixed(2)}:1`
                : 'No explicit w/h declared'}
            </p>
          </div>

          {/* Card 3: Duration & Framerate */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Duration & FPS</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {analysis.metadata.durationSeconds !== null
                ? `${analysis.metadata.durationSeconds}s`
                : 'N/A'}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {analysis.metadata.framerate ? (
                `${analysis.metadata.framerate} FPS • ${analysis.metadata.totalFrames || 0} frames`
              ) : (
                <span className="text-amber-500">[Missing framerate]</span>
              )}
            </p>
          </div>

          {/* Card 4: Total Layers */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Layers</span>
              <Layers className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {analysis.layerStats.total}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {analysis.layerStats.hidden > 0 ? (
                <span className="text-amber-500 font-medium">
                  {analysis.layerStats.hidden} hidden layer(s)
                </span>
              ) : (
                '0 hidden layers'
              )}
            </p>
          </div>
        </div>

        {/* Missing Root Properties Alert */}
        {analysis.metadata.missingProperties.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Missing Root Animation Properties Detected
            </div>
            <p className="text-muted-foreground text-[11px]">
              The following standard Bodymovin properties are absent from the JSON:
              <span className="font-mono font-bold text-foreground ml-1">
                {analysis.metadata.missingProperties.join(', ')}
              </span>
              . No placeholder values have been synthesized.
            </p>
          </div>
        )}

        {/* 2-Column Section: Layer Breakdown & Asset Auditor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Layer Distribution (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" /> Layer Hierarchy Breakdown
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Depth: {analysis.layerStats.maxNestingDepth}
                </span>
              </div>

              {/* Layer Types List */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                  <span className="text-foreground font-medium">Shapes (Vector)</span>
                  <span className="font-mono font-bold text-primary">
                    {analysis.layerStats.shapes}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                  <span className="text-foreground font-medium">Precompositions</span>
                  <span className="font-mono font-bold text-blue-500">
                    {analysis.layerStats.precomps}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                  <span className="text-foreground font-medium">Solids</span>
                  <span className="font-mono font-bold text-foreground">
                    {analysis.layerStats.solids}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                  <span className="text-foreground font-medium">Images (Raster)</span>
                  <span className="font-mono font-bold text-amber-500">
                    {analysis.layerStats.images}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                  <span className="text-foreground font-medium">Text Elements</span>
                  <span className="font-mono font-bold text-foreground">
                    {analysis.layerStats.texts}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                  <span className="text-foreground font-medium">Null / Controllers</span>
                  <span className="font-mono font-bold text-muted-foreground">
                    {analysis.layerStats.nulls}
                  </span>
                </div>
                {analysis.layerStats.hidden > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                    <span className="font-medium">Hidden / Disabled</span>
                    <span className="font-mono font-bold">
                      {analysis.layerStats.hidden}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs">
              <span className="font-semibold text-foreground uppercase tracking-wider block text-[11px]">
                Workflows
              </span>
              <button
                type="button"
                onClick={() => handleNavigateToTool('lottie-player', '/tools/lottie-player')}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-primary" /> Test in Lottie Player
                </span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigateToTool('lottie-validator', '/tools/lottie-validator')}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Run Full Structural Validator
                </span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigateToTool('lottie-optimizer', '/tools/lottie-optimizer')}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-purple-500" /> Compress with Lottie Optimizer
                </span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Column 2: Asset Auditor Feed (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-primary" /> Assets Collection ({analysis.assets.length})
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Asset Weight: {formatBytes(analysis.totalAssetBytes)}
                </span>
              </div>

              {analysis.assets.length === 0 ? (
                <div className="p-8 rounded-xl bg-secondary/30 text-center space-y-1.5">
                  <Sparkles className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">
                    100% Pure Vector Animation
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    This animation contains zero embedded or external raster assets. It scales infinitely without resolution loss.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.assets.map((asset, idx) => (
                    <div
                      key={asset.id || idx}
                      className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {asset.previewUrl ? (
                            // Inline thumbnail
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={asset.previewUrl}
                              alt={asset.id}
                              className="w-10 h-10 rounded-lg object-contain bg-black/40 border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}

                          <div>
                            <div className="font-mono font-semibold text-foreground">
                              {asset.id}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {asset.width && asset.height
                                ? `${asset.width} × ${asset.height} px`
                                : 'Dimensions not specified'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              asset.isEmbedded
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {asset.isEmbedded ? 'Embedded' : 'External'}
                          </span>
                          {asset.byteSize !== undefined && (
                            <div className="text-[11px] font-mono text-muted-foreground mt-1">
                              {formatBytes(asset.byteSize)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warning Card for External Assets */}
                      {asset.warning && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{asset.warning}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

function createEmptyAnalysis(msg: string): LottieAnalysisResult {
  return {
    metadata: {
      version: null,
      framerate: null,
      inPoint: null,
      outPoint: null,
      totalFrames: null,
      durationSeconds: null,
      width: null,
      height: null,
      name: null,
      missingProperties: [msg],
    },
    layerStats: {
      total: 0,
      shapes: 0,
      precomps: 0,
      solids: 0,
      images: 0,
      texts: 0,
      nulls: 0,
      hidden: 0,
      hasExpressions: false,
      maxNestingDepth: 0,
    },
    assets: [],
    totalAssetBytes: 0,
    rawJsonBytes: 0,
    rasterPercentage: 0,
    isClean: false,
  };
}

