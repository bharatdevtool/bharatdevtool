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
} from 'lucide-react';

type BgType = 'obsidian' | 'light' | 'grid' | 'custom';
type DirectionType = 'forward' | 'reverse' | 'bounce';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

export default function LottiePlayerClient() {
  const router = useRouter();
  const [activeSampleId, setActiveSampleId] = useState<string>(LOTTIE_SAMPLES[0].id);
  const [animationData, setAnimationData] = useState<LottieAnimation>(LOTTIE_SAMPLES[0].data);
  const [rawJson, setRawJson] = useState<string>(JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [metadata, setMetadata] = useState<LottieMetadata | null>(() => {
    return parseLottieJSON(JSON.stringify(LOTTIE_SAMPLES[0].data)).metadata || null;
  });

  const [inputTab, setInputTab] = useState<'samples' | 'paste'>('samples');
  const [error, setError] = useState<string | null>(null);

  // Cross-tool data ingestion
  useEffect(() => {
    const incoming = getCrossToolData<{ lottieJson?: string }>('lottie-player', false);
    if (incoming?.lottieJson) {
      const parsed = parseLottieJSON(incoming.lottieJson);
      if (parsed.success && parsed.animation) {
        setAnimationData(parsed.animation);
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

          {/* Column 2: Metadata Inspector & Related Tools (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Composition Metadata Card */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-primary" /> Composition Info
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  v{metadata?.version || 'N/A'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground text-[10px]">Dimensions</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    {metadata?.width && metadata?.height ? (
                      `${metadata.width} × ${metadata.height} px`
                    ) : (
                      <span className="text-amber-500 font-medium">[Missing]</span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground text-[10px]">Framerate</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    {metadata?.framerate ? (
                      `${metadata.framerate} FPS`
                    ) : (
                      <span className="text-amber-500 font-medium">[Missing]</span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground text-[10px]">Total Frames</div>
                  <div className="font-semibold text-foreground mt-0.5 font-mono">
                    {metadata?.totalFrames !== null ? metadata?.totalFrames : 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground text-[10px]">Duration</div>
                  <div className="font-semibold text-foreground mt-0.5 font-mono">
                    {metadata?.durationSeconds !== null ? `${metadata?.durationSeconds}s` : 'N/A'}
                  </div>
                </div>
              </div>

              {hasAudio && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Volume2 className="w-3.5 h-3.5" /> Audio Track Detected
                  </span>
                  <span className="font-semibold text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20">
                    Synced
                  </span>
                </div>
              )}

              {metadata?.missingProperties && metadata.missingProperties.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] space-y-0.5">
                  <span className="font-medium">Missing Root Properties:</span>
                  <p className="text-[10px] text-muted-foreground">
                    {metadata.missingProperties.join(', ')}
                  </p>
                </div>
              )}

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

            {/* Quick Bridge to Next Lottie Tools */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2.5">
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider block">
                Next Lottie Workflows
              </span>

              <button
                type="button"
                onClick={() => handleNavigateToTool('lottie-analyzer', '/tools/lottie-analyzer')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="font-medium text-foreground">Lottie Analyzer</div>
                    <div className="text-[10px] text-muted-foreground">Audit layers, raster assets & weights</div>
                  </div>
                </div>
                <span className="text-muted-foreground group-hover:text-foreground">→</span>
              </button>

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
