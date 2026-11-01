'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { parseLottieJSON, sanitizeAnimationForPrivacy } from '@/lib/lottie/parser';
import { extractLottieFromFile, createDotLottie } from '@/lib/lottie/dotLottie';
import { hasLottieAudio, createBrowserAudioFactory } from '@/lib/lottie/audio';
import { extractLottieColors, replaceLottieColor, type LottieColorInfo } from '@/lib/lottie/colors';
import { analyzeLottie } from '@/lib/lottie/analyzer';
import { LOTTIE_SAMPLES } from '@/lib/lottie/samples';
import { getCrossToolData, setCrossToolData } from '@/lib/crossToolData';
import type { LottieAnimation, LottieMetadata } from '@/lib/lottie/types';
import type { AnimationItem, AnimationDirection } from 'lottie-web';
import {
  Play,
  Pause,
  RotateCcw,
  StepBack,
  StepForward,
  Repeat,
  Repeat1,
  Upload,
  FileCode,
  Download,
  Eye,
  SlidersHorizontal,
  ShieldCheck,
  Gauge,
  Sparkles,
  Maximize2,
  Box,
  Volume2,
  VolumeX,
  Info,
  Layers,
  Palette,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Undo2,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getLayerTypeInfo(ty: number) {
  switch (ty) {
    case 0:
      return { label: 'Precomp', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    case 1:
      return { label: 'Solid', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    case 2:
      return { label: 'Image', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    case 3:
      return { label: 'Null', color: 'bg-muted text-muted-foreground border-border' };
    case 4:
      return { label: 'Shape', color: 'bg-primary/10 text-primary border-primary/20' };
    case 5:
      return { label: 'Text', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case 6:
      return { label: 'Audio', color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' };
    default:
      return { label: `Type ${ty}`, color: 'bg-muted text-muted-foreground border-border' };
  }
}

type BgType = 'obsidian' | 'light' | 'grid' | 'custom';
type DirectionType = 'forward' | 'reverse' | 'bounce';
type InspectorTab = 'info' | 'layers' | 'colors' | 'warnings' | 'assets';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

export default function LottiePlayerClient({
  initialInspectorTab = 'info',
}: {
  initialInspectorTab?: InspectorTab;
} = {}) {
  const router = useRouter();

  const [activeSampleId, setActiveSampleId] = useState<string>(LOTTIE_SAMPLES[0].id);
  const [animationData, setAnimationData] = useState<LottieAnimation>(LOTTIE_SAMPLES[0].data);
  const [rawJson, setRawJson] = useState<string>(JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [metadata, setMetadata] = useState<LottieMetadata | null>(() => {
    return parseLottieJSON(JSON.stringify(LOTTIE_SAMPLES[0].data)).metadata || null;
  });

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(initialInspectorTab);
  const originalAnimationRef = useRef<LottieAnimation>(LOTTIE_SAMPLES[0].data);
  const [isColorModified, setIsColorModified] = useState<boolean>(false);

  useEffect(() => {
    if (initialInspectorTab) {
      setInspectorTab(initialInspectorTab);
    }
  }, [initialInspectorTab]);

  const [inputTab, setInputTab] = useState<'samples' | 'paste'>('samples');
  const [error, setError] = useState<string | null>(null);

  // Cross-tool data ingestion
  useEffect(() => {
    const incoming =
      getCrossToolData<{ lottieJson?: string }>('lottie-player', false) ||
      getCrossToolData<{ lottieJson?: string }>('lottie-analyzer', false);
    if (incoming?.lottieJson) {
      const parsed = parseLottieJSON(incoming.lottieJson);
      if (parsed.success && parsed.animation) {
        setAnimationData(parsed.animation);
        originalAnimationRef.current = parsed.animation;
        setIsColorModified(false);
        setRawJson(incoming.lottieJson);
        setMetadata(parsed.metadata || null);
        setActiveSampleId('');
        setInputTab('paste');
        setError(null);
      }
    }
  }, []);

  const handleNavigateToTool = (toolId: string, path: string) => {
    setCrossToolData(toolId, { lottieJson: rawJson });
    router.push(path);
  };

  // Playback States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [direction, setDirection] = useState<DirectionType>('forward');
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(120);

  // Audio States
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;

  const hasAudio = useMemo(() => hasLottieAudio(animationData), [animationData]);

  // Inspector & Analysis Computations
  const colors = useMemo(() => extractLottieColors(animationData), [animationData]);

  const analysis = useMemo(
    () => analyzeLottie(animationData, rawJson, metadata || undefined),
    [animationData, rawJson, metadata]
  );

  const allLayers = useMemo(() => {
    const list: Array<{
      name: string;
      ind: number;
      ty: number;
      hd: boolean;
      ip: number;
      op: number;
      parent?: number;
      composition: string;
    }> = [];

    if (Array.isArray(animationData.layers)) {
      animationData.layers.forEach((l, idx) => {
        list.push({
          name: l.nm || `Layer ${l.ind ?? idx + 1}`,
          ind: l.ind ?? idx + 1,
          ty: l.ty,
          hd: !!l.hd,
          ip: l.ip ?? 0,
          op: l.op ?? 0,
          parent: l.parent,
          composition: 'Root',
        });
      });
    }

    if (Array.isArray(animationData.assets)) {
      animationData.assets.forEach((asset) => {
        if (Array.isArray(asset.layers)) {
          asset.layers.forEach((l, idx) => {
            list.push({
              name: l.nm || `${asset.id} > Layer ${l.ind ?? idx + 1}`,
              ind: l.ind ?? idx + 1,
              ty: l.ty,
              hd: !!l.hd,
              ip: l.ip ?? 0,
              op: l.op ?? 0,
              parent: l.parent,
              composition: asset.id,
            });
          });
        }
      });
    }

    return list;
  }, [animationData]);

  const warningCount = useMemo(() => {
    let count = 0;
    if (metadata?.missingProperties?.length) count += metadata.missingProperties.length;
    if (analysis.layerStats.hidden > 0) count++;
    if (analysis.layerStats.hasExpressions) count++;
    count += analysis.assets.filter((a) => a.warning).length;
    return count;
  }, [metadata, analysis]);

  const fileSizeBytes = useMemo(() => {
    return typeof Blob !== 'undefined'
      ? new Blob([rawJson]).size
      : typeof Buffer !== 'undefined'
      ? Buffer.byteLength(rawJson, 'utf8')
      : rawJson.length;
  }, [rawJson]);

  const handleColorChange = (targetHex: string, newHex: string) => {
    const { animation: updated } = replaceLottieColor(animationData, targetHex, newHex);
    setAnimationData(updated);
    const newJson = JSON.stringify(updated, null, 2);
    setRawJson(newJson);
    const parsed = parseLottieJSON(newJson);
    setMetadata(parsed.metadata || null);
    setIsColorModified(true);
  };

  const handleResetColors = () => {
    if (!originalAnimationRef.current) return;
    setAnimationData(originalAnimationRef.current);
    const origJson = JSON.stringify(originalAnimationRef.current, null, 2);
    setRawJson(origJson);
    const parsed = parseLottieJSON(origJson);
    setMetadata(parsed.metadata || null);
    setIsColorModified(false);
  };

  // Viewport States
  const [bgType, setBgType] = useState<BgType>('obsidian');
  const [customBg, setCustomBg] = useState<string>('#1E293B');
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const animItemRef = useRef<AnimationItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBouncingRef = useRef<boolean>(false);
  const currentBounceDirRef = useRef<AnimationDirection>(1);

  // Load Lottie Animation on canvas
  const loadLottieAnimation = useCallback(async (data: LottieAnimation) => {
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
        loop: direction === 'bounce' ? false : isLooping,
        autoplay: isPlaying,
        animationData: sanitizeAnimationForPrivacy(data),
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
        },
        audioFactory: createBrowserAudioFactory(
          () => isMutedRef.current,
          () => 1
        ) as any,
      });

      anim.setSpeed(speed);
      anim.setDirection((direction === 'reverse' ? -1 : 1) as AnimationDirection);

      anim.addEventListener('DOMLoaded', () => {
        const total = anim.totalFrames || (data.op ? data.op - (data.ip || 0) : 100);
        setTotalFrames(Math.round(total));
      });

      anim.addEventListener('enterFrame', () => {
        setCurrentFrame(Math.round(anim.currentFrame));
      });

      anim.addEventListener('complete', () => {
        if (direction === 'bounce') {
          currentBounceDirRef.current = (currentBounceDirRef.current === 1 ? -1 : 1) as AnimationDirection;
          anim.setDirection(currentBounceDirRef.current);
          anim.play();
        } else if (!isLooping) {
          setIsPlaying(false);
        }
      });

      animItemRef.current = anim;
      setError(null);
    } catch (err) {
      setError(`Failed to render Lottie animation: ${(err as Error).message}`);
    }
  }, [direction, isLooping, isPlaying, speed]);

  // Initial and data-change mount
  useEffect(() => {
    loadLottieAnimation(animationData);
    return () => {
      if (animItemRef.current) {
        animItemRef.current.destroy();
        animItemRef.current = null;
      }
    };
  }, [animationData, loadLottieAnimation]);

  // Control effects
  useEffect(() => {
    if (!animItemRef.current) return;
    if (isPlaying) {
      animItemRef.current.play();
    } else {
      animItemRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!animItemRef.current) return;
    animItemRef.current.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (!animItemRef.current) return;
    animItemRef.current.loop = direction === 'bounce' ? false : isLooping;
  }, [isLooping, direction]);

  useEffect(() => {
    if (!animItemRef.current) return;
    if (direction === 'reverse') {
      animItemRef.current.setDirection(-1 as AnimationDirection);
    } else {
      currentBounceDirRef.current = 1 as AnimationDirection;
      animItemRef.current.setDirection(1 as AnimationDirection);
    }
  }, [direction]);

  useEffect(() => {
    if (!animItemRef.current) return;
    try {
      if (isMuted) {
        (animItemRef.current as any).mute?.();
      } else {
        (animItemRef.current as any).unmute?.();
      }
    } catch {
      // Audio controller may not be active if animation has no sound
    }
  }, [isMuted]);

  // Handlers
  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    if (!animItemRef.current) return;
    animItemRef.current.goToAndPlay(0, true);
    setIsPlaying(true);
  };

  const handleStep = (delta: number) => {
    if (!animItemRef.current) return;
    setIsPlaying(false);
    const target = Math.max(0, Math.min(totalFrames, currentFrame + delta));
    animItemRef.current.goToAndStop(target, true);
    setCurrentFrame(target);
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    if (!animItemRef.current) return;
    setIsPlaying(false);
    animItemRef.current.goToAndStop(frame, true);
    setCurrentFrame(frame);
  };

  const handleSampleSelect = (sampleId: string) => {
    const s = LOTTIE_SAMPLES.find((item) => item.id === sampleId);
    if (!s) return;
    setActiveSampleId(sampleId);
    setAnimationData(s.data);
    originalAnimationRef.current = s.data;
    setIsColorModified(false);
    const jsonStr = JSON.stringify(s.data, null, 2);
    setRawJson(jsonStr);
    const parsed = parseLottieJSON(jsonStr);
    setMetadata(parsed.metadata || null);
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
    originalAnimationRef.current = res.animation;
    setIsColorModified(false);
    const jsonStr = res.rawJson || JSON.stringify(res.animation, null, 2);
    setRawJson(jsonStr);
    const parsed = parseLottieJSON(jsonStr);
    setMetadata(parsed.metadata || null);
    setActiveSampleId('');
    setIsPlaying(true);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadDotLottie = () => {
    const bytes = createDotLottie(animationData, {
      name: metadata?.name || 'animation',
      id: metadata?.name?.toLowerCase().replace(/\s+/g, '_') || 'animation_1',
    });
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'animation'}.lottie`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePasteChange = (text: string) => {
    setRawJson(text);
    if (!text.trim()) return;

    const parsed = parseLottieJSON(text);
    if (!parsed.success || !parsed.animation) {
      setError(parsed.error || 'Invalid Lottie JSON');
      return;
    }
    setAnimationData(parsed.animation);
    originalAnimationRef.current = parsed.animation;
    setIsColorModified(false);
    setMetadata(parsed.metadata || null);
    setActiveSampleId('');
    setError(null);
  };

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'animation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Background styling
  const getViewportBgClass = () => {
    switch (bgType) {
      case 'obsidian':
        return 'bg-[#090E17]';
      case 'light':
        return 'bg-white';
      case 'grid':
        return 'bg-[#0F172A] bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]';
      case 'custom':
        return '';
      default:
        return 'bg-[#090E17]';
    }
  };

  return (
    <ToolLayout toolId="lottie-player">
      <div className="space-y-6">
        {/* Top Control Bar: Samples & File Loading */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border">
          {/* Preset Samples */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Samples:
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

          {/* Action Tabs & Upload */}
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
              onClick={() => setInputTab((prev) => (prev === 'paste' ? 'samples' : 'paste'))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                inputTab === 'paste'
                  ? 'bg-secondary border-primary/40 text-foreground'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> {inputTab === 'paste' ? 'Hide Code' : 'Edit Code'}
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Collapsible JSON Editor Panel */}
        {inputTab === 'paste' && (
          <div className="p-4 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Raw Bodymovin JSON Code:</span>
              <span>100% Client-Side. Code never leaves your browser.</span>
            </div>
            <textarea
              value={rawJson}
              onChange={(e) => handlePasteChange(e.target.value)}
              rows={8}
              placeholder="Paste Lottie JSON payload here..."
              className="w-full p-3 font-mono text-xs rounded-lg bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-primary developer-scrollbar"
            />
          </div>
        )}

        {/* Main Studio Viewport (2-Column Grid on Desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Animation Player Viewport (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col space-y-3">
            {/* Viewport Canvas Container */}
            <div
              className={`relative h-[380px] sm:h-[460px] w-full rounded-2xl border border-border overflow-hidden flex items-center justify-center transition-colors shadow-inner ${getViewportBgClass()}`}
              style={bgType === 'custom' ? { backgroundColor: customBg } : {}}
            >
              {/* Optional Bounding Box Overlay */}
              <div
                style={{
                  transform: `scale(${zoomScale})`,
                  transition: 'transform 0.15s ease-out',
                }}
                className={`relative flex items-center justify-center w-full h-full max-w-[90%] max-h-[90%] ${
                  showBoundingBox ? 'border-2 border-dashed border-primary/50 rounded-lg' : ''
                }`}
              >
                {showBoundingBox && metadata?.width && metadata?.height && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] text-white font-mono z-10">
                    {metadata.width} × {metadata.height} px
                  </div>
                )}
                {/* SVG Lottie Canvas rendered by lottie-web */}
                <div ref={containerRef} className="w-full h-full flex items-center justify-center pointer-events-none" />
              </div>

              {/* Viewport Top Left: Audio Presence Badge */}
              {hasAudio && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[11px] font-medium z-20">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Audio Synced</span>
                </div>
              )}

              {/* Viewport Top Floating Controls: Background & Zoom */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 p-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 z-20">
                {/* Background Presets */}
                <button
                  type="button"
                  title="Dark Obsidian Background"
                  onClick={() => setBgType('obsidian')}
                  className={`w-6 h-6 rounded-md bg-[#090E17] border ${
                    bgType === 'obsidian' ? 'border-primary ring-1 ring-primary' : 'border-white/20'
                  }`}
                />
                <button
                  type="button"
                  title="Light Background"
                  onClick={() => setBgType('light')}
                  className={`w-6 h-6 rounded-md bg-white border ${
                    bgType === 'light' ? 'border-primary ring-1 ring-primary' : 'border-white/20'
                  }`}
                />
                <button
                  type="button"
                  title="Checkerboard Grid"
                  onClick={() => setBgType('grid')}
                  className={`w-6 h-6 rounded-md bg-[#0F172A] border relative overflow-hidden ${
                    bgType === 'grid' ? 'border-primary ring-1 ring-primary' : 'border-white/20'
                  }`}
                >
                  <div className="w-full h-full bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:6px_6px]" />
                </button>
                <input
                  type="color"
                  title="Custom Color"
                  value={customBg}
                  onChange={(e) => {
                    setCustomBg(e.target.value);
                    setBgType('custom');
                  }}
                  className="w-6 h-6 rounded-md cursor-pointer border border-white/20 bg-transparent p-0 overflow-hidden"
                />

                <div className="w-[1px] h-4 bg-white/20 mx-1" />

                {/* Bounding box toggle */}
                <button
                  type="button"
                  title="Toggle Bounding Box"
                  onClick={() => setShowBoundingBox((prev) => !prev)}
                  className={`p-1 rounded-md text-xs transition-colors ${
                    showBoundingBox ? 'bg-primary text-white' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                </button>

                {/* Zoom toggle */}
                <button
                  type="button"
                  title="Zoom Scale (Fit / 1.5x)"
                  onClick={() => setZoomScale((prev) => (prev === 1 ? 1.4 : 1))}
                  className={`p-1 rounded-md text-xs transition-colors ${
                    zoomScale > 1 ? 'bg-primary text-white' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Playback Controls & Timeline Bar */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              {/* Timeline Scrubber */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={metadata?.inPoint ?? 0}
                  max={metadata?.outPoint ?? totalFrames}
                  value={currentFrame}
                  onChange={handleScrubberChange}
                  className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                  {currentFrame} / {totalFrames} f
                </span>
              </div>

              {/* Playback Button Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Main Media Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRestart}
                    title="Restart"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep(-1)}
                    title="Step Backward (1 Frame)"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors"
                  >
                    <StepBack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    title={isPlaying ? 'Pause' : 'Play'}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep(1)}
                    title="Step Forward (1 Frame)"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors"
                  >
                    <StepForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg border border-border text-xs">
                  <span className="text-muted-foreground px-1.5 text-[11px] font-medium">Speed:</span>
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        speed === s
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* Loop & Direction Toggles */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsLooping((prev) => !prev)}
                    title={isLooping ? 'Looping Enabled' : 'Play Once'}
                    className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                      isLooping
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-secondary border-border text-muted-foreground'
                    }`}
                  >
                    {isLooping ? <Repeat className="w-4 h-4" /> : <Repeat1 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDirection((prev) =>
                        prev === 'forward' ? 'reverse' : prev === 'reverse' ? 'bounce' : 'forward'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {direction === 'forward' && 'Forward →'}
                    {direction === 'reverse' && 'Reverse ←'}
                    {direction === 'bounce' && 'Bounce ⇄'}
                  </button>

                  {/* Audio Mute/Unmute toggle (only visible when audio is detected) */}
                  {hasAudio && (
                    <button
                      type="button"
                      onClick={() => setIsMuted((prev) => !prev)}
                      title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                      className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                        isMuted
                          ? 'bg-destructive/10 border-destructive/30 text-destructive'
                          : 'bg-primary/10 border-primary/30 text-primary'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Flagship Unified Inspector (Info, Layers, Colors, Warnings, Assets) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
              {/* Top Tab Bar matching reference image */}
              <div className="flex items-center gap-0.5 border-b border-border bg-card px-2.5 pt-1.5 overflow-x-auto overflow-y-hidden no-scrollbar">
                {(
                  [
                    { id: 'info' as const, label: 'Info' },
                    { id: 'layers' as const, label: 'Layers', count: allLayers.length },
                    { id: 'colors' as const, label: 'Colors', count: colors.length },
                    {
                      id: 'warnings' as const,
                      label: 'Warnings',
                      count: warningCount > 0 ? warningCount : undefined,
                      alert: warningCount > 0,
                    },
                    {
                      id: 'assets' as const,
                      label: 'Assets',
                      count: analysis.assets.length > 0 ? analysis.assets.length : undefined,
                    },
                  ]
                ).map((tab) => {
                  const isActive = inspectorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setInspectorTab(tab.id)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-xs transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                        isActive
                          ? 'border-foreground text-foreground font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span
                          className={`text-[11px] font-mono ${
                            tab.alert ? 'text-amber-500 font-bold' : 'text-muted-foreground'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Panels */}
              <div className="p-4">
                {/* 1. INFO TAB */}
                {inspectorTab === 'info' && (
                  <div className="space-y-4">
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          NAME
                        </span>
                        <span
                          className="font-semibold text-foreground truncate max-w-[180px] text-right font-mono"
                          title={animationData.nm || 'Animation'}
                        >
                          {animationData.nm ||
                            (activeSampleId
                              ? LOTTIE_SAMPLES.find((s) => s.id === activeSampleId)?.name
                              : null) ||
                            'animation'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          SIZE
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {metadata?.width && metadata?.height ? (
                            `${metadata.width} × ${metadata.height}`
                          ) : (
                            <span className="text-amber-500 font-medium">[Missing]</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          DURATION
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {metadata?.durationSeconds !== null ? `${metadata?.durationSeconds}s` : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          FRAME RATE
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {metadata?.framerate ? `${metadata.framerate} fps` : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          FRAMES
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {metadata?.totalFrames !== null ? metadata?.totalFrames : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          FILE SIZE
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {formatBytes(fileSizeBytes)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          VERSION
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {metadata?.version || 'N/A'}
                        </span>
                      </div>

                      {hasAudio && (
                        <div className="flex items-center justify-between py-1 border-b border-border/40">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            AUDIO
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold font-mono text-[11px]">
                            <Volume2 className="w-3 h-3" /> Synced
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download .json
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadDotLottie}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors"
                        title="Export animation as a compressed dotLottie (.lottie) archive"
                      >
                        <Download className="w-3.5 h-3.5 text-primary" /> Export .lottie
                      </button>
                      <CopyButton text={rawJson} label="Copy JSON" />
                    </div>
                  </div>
                )}

                {/* 2. LAYERS TAB */}
                {inspectorTab === 'layers' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                      <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Total</div>
                        <div className="font-bold text-foreground text-sm mt-0.5">{allLayers.length}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Shapes</div>
                        <div className="font-bold text-primary text-sm mt-0.5">{analysis.layerStats.shapes}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Precomps</div>
                        <div className="font-bold text-blue-500 text-sm mt-0.5">{analysis.layerStats.precomps}</div>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-border/20 developer-scrollbar">
                      {allLayers.map((layer, idx) => {
                        const typeInfo = getLayerTypeInfo(layer.ty);
                        return (
                          <div key={`${layer.composition}-${layer.ind}-${idx}`} className="pt-2 first:pt-0 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-mono text-muted-foreground px-1 py-0.5 rounded bg-secondary">
                                  #{layer.ind}
                                </span>
                                <span className="font-medium text-foreground truncate max-w-[140px]" title={layer.name}>
                                  {layer.name}
                                </span>
                                {layer.composition !== 'Root' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground">
                                    {layer.composition}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {layer.hd && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                                    Hidden
                                  </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeInfo.color}`}>
                                  {typeInfo.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                              <span>
                                Frames: {layer.ip} → {layer.op}
                              </span>
                              {layer.parent !== undefined && <span>Parent: #{layer.parent}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. COLORS TAB */}
                {inspectorTab === 'colors' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Click any color swatch to swap live in the canvas:
                      </p>
                      {isColorModified && (
                        <button
                          type="button"
                          onClick={handleResetColors}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-muted text-foreground text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <Undo2 className="w-3 h-3" /> Reset
                        </button>
                      )}
                    </div>

                    {colors.length === 0 ? (
                      <div className="p-4 rounded-lg bg-secondary/40 border border-border text-center text-xs text-muted-foreground">
                        No vector fill or stroke colors detected in this animation.
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-2 pr-1 developer-scrollbar">
                        {colors.map((c) => (
                          <div
                            key={c.hex}
                            className="p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 border border-border flex items-center justify-between gap-3 transition-colors group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <label
                                className="relative w-7 h-7 rounded-lg shadow-2xs cursor-pointer border border-border/80 shrink-0 overflow-hidden ring-1 ring-border hover:ring-primary transition-all"
                                style={{ backgroundColor: c.hex }}
                                title={`Click to replace ${c.hex}`}
                              >
                                <input
                                  type="color"
                                  value={c.hex}
                                  onChange={(e) => handleColorChange(c.hex, e.target.value)}
                                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                />
                              </label>
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-foreground uppercase">
                                  {c.hex}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {c.occurrences} shape{c.occurrences > 1 ? 's' : ''} &bull; {c.layers.slice(0, 2).join(', ')}
                                  {c.layers.length > 2 ? '...' : ''}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <CopyButton text={c.hex} label="" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. WARNINGS TAB */}
                {inspectorTab === 'warnings' && (
                  <div className="space-y-3">
                    {warningCount === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4 shrink-0" /> All structural checks passed
                        </div>
                        <p className="text-[11px] text-muted-foreground pl-6">
                          No missing root properties, hidden layers, or external asset warnings detected.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {metadata?.missingProperties && metadata.missingProperties.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Missing Root Properties
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              The animation root is missing: {metadata.missingProperties.join(', ')}.
                            </p>
                          </div>
                        )}

                        {analysis.layerStats.hidden > 0 && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {analysis.layerStats.hidden} Hidden Layer
                              {analysis.layerStats.hidden > 1 ? 's' : ''}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Hidden layers add file weight and processing cost without rendering on screen.
                            </p>
                          </div>
                        )}

                        {analysis.layerStats.hasExpressions && (
                          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> JavaScript Expressions Detected
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Expressions may cause lag or fail to run on certain native mobile Lottie runtimes.
                            </p>
                          </div>
                        )}

                        {analysis.assets.some((a) => a.warning) && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Un-embedded External Assets
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              External image assets can fail to load when offline or without CORS configuration.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. ASSETS TAB */}
                {inspectorTab === 'assets' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Asset Collection ({analysis.assets.length})</span>
                      <span className="font-mono">Weight: {formatBytes(analysis.totalAssetBytes)}</span>
                    </div>

                    {analysis.assets.length === 0 ? (
                      <div className="p-4 rounded-xl bg-secondary/40 border border-border text-center text-xs text-muted-foreground">
                        No external or embedded raster assets. This animation is 100% vector based.
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-2 pr-1 developer-scrollbar">
                        {analysis.assets.map((asset) => (
                          <div key={asset.id} className="p-2.5 rounded-lg bg-secondary/40 border border-border space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="p-1 rounded bg-secondary text-primary">
                                  {asset.type.startsWith('image') && <ImageIcon className="w-3.5 h-3.5" />}
                                  {asset.type === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
                                  {asset.type === 'precomp' && <Layers className="w-3.5 h-3.5" />}
                                </span>
                                <span className="font-semibold text-foreground truncate max-w-[140px]" title={asset.id}>
                                  {asset.id}
                                </span>
                              </div>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                {asset.type === 'image-embedded'
                                  ? 'Image (Embedded)'
                                  : asset.type === 'image-external'
                                  ? 'Image (External)'
                                  : asset.type}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                              <span>
                                {asset.width && asset.height
                                  ? `${asset.width} × ${asset.height} px`
                                  : asset.type === 'precomp'
                                  ? 'Vector Sublayers'
                                  : 'N/A'}
                              </span>
                              <span className="font-mono">{formatBytes(asset.byteSize || 0)}</span>
                            </div>

                            {asset.warning && (
                              <div className="text-[10px] text-amber-500 font-medium">⚠️ {asset.warning}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Bridge to Next Lottie Tools */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2.5">
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider block">
                Next Lottie Workflows
              </span>

              <button
                type="button"
                onClick={() => handleNavigateToTool('lottie-validator', '/tools/lottie-validator')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-medium text-foreground">Lottie Validator</div>
                    <div className="text-[10px] text-muted-foreground">Check syntax, parent IDs & asset links</div>
                  </div>
                </div>
                <span className="text-muted-foreground group-hover:text-foreground">→</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigateToTool('lottie-optimizer', '/tools/lottie-optimizer')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="font-medium text-foreground">Lottie Optimizer</div>
                    <div className="text-[10px] text-muted-foreground">Truncate float precision & clean metadata</div>
                  </div>
                </div>
                <span className="text-muted-foreground group-hover:text-foreground">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
