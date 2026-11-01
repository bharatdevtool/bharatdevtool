'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Download,
  Sparkles,
  ShieldCheck,
  Gauge,
  Film,
  Package,
  Braces,
  Volume2,
  VolumeX,
  Undo2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Sliders,
  Type,
  Code2,
  Check,
  Copy,
} from 'lucide-react';

type BgType = 'grid' | 'obsidian' | 'light' | 'custom';
type DirectionType = 'forward' | 'reverse' | 'bounce';
type RendererChoice = 'svg' | 'canvas';
type ActiveMenu = 'file' | 'edit' | 'lottie' | 'view' | 'renderer' | null;

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

export default function LottieEditorClient() {
  const router = useRouter();

  // Primary Animation States
  const [activeSampleId, setActiveSampleId] = useState<string>(LOTTIE_SAMPLES[0].id);
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [lastValidAnimation, setLastValidAnimation] = useState<LottieAnimation>(LOTTIE_SAMPLES[0].data);
  const [metadata, setMetadata] = useState<LottieMetadata | null>(() => {
    return parseLottieJSON(JSON.stringify(LOTTIE_SAMPLES[0].data)).metadata || null;
  });

  // Editor States
  const [syntaxError, setSyntaxError] = useState<{ message: string; line?: number; column?: number } | null>(null);
  const [historyOriginal, setHistoryOriginal] = useState<string>(() => JSON.stringify(LOTTIE_SAMPLES[0].data, null, 2));
  const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'base'>('xs');
  const [wrapLines, setWrapLines] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);

  // Playback & Canvas States
  const [renderer, setRenderer] = useState<RendererChoice>('svg');
  const [bgType, setBgType] = useState<BgType>('grid');
  const [customBg, setCustomBg] = useState<string>('#1E293B');
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

  const hasAudio = useMemo(() => hasLottieAudio(lastValidAnimation), [lastValidAnimation]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const animItemRef = useRef<AnimationItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const isBouncingRef = useRef<boolean>(false);
  const currentBounceDirRef = useRef<AnimationDirection>(1);

  // Close open dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Sync line numbers scroll with textarea scroll
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Cross-tool data ingestion
  useEffect(() => {
    const incoming =
      getCrossToolData<{ lottieJson?: string }>('lottie-editor', false) ||
      getCrossToolData<{ lottieJson?: string }>('lottie-player', false);
    if (incoming?.lottieJson) {
      const parsed = parseLottieJSON(incoming.lottieJson);
      if (parsed.success && parsed.animation) {
        setRawJson(incoming.lottieJson);
        setHistoryOriginal(incoming.lottieJson);
        setLastValidAnimation(parsed.animation);
        setMetadata(parsed.metadata || null);
        setSyntaxError(null);
        setActiveSampleId('');
      }
    }
  }, []);

  const handleNavigateToTool = (toolId: string, path: string) => {
    setCrossToolData(toolId, { lottieJson: rawJson });
    router.push(path);
  };

  // Canvas Lottie Loader
  const loadLottieAnimation = useCallback(
    async (data: LottieAnimation) => {
      if (!containerRef.current) return;

      if (animItemRef.current) {
        animItemRef.current.destroy();
        animItemRef.current = null;
      }

      try {
        const lottie = (await import('lottie-web')).default;
        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: renderer,
          loop: isLooping,
          autoplay: isPlaying,
          animationData: JSON.parse(JSON.stringify(data)),
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            clearCanvas: true,
          },
          ...(hasLottieAudio(data)
            ? {
                audioFactory: createBrowserAudioFactory(
                  () => isMutedRef.current,
                  () => 1
                ) as any,
              }
            : {}),
        });

        animItemRef.current = anim;
        anim.setSpeed(speed);

        anim.addEventListener('DOMLoaded', () => {
          const frames = anim.totalFrames || 120;
          setTotalFrames(Math.round(frames));
          setCurrentFrame(Math.round(anim.currentFrame || 0));
        });

        anim.addEventListener('enterFrame', () => {
          setCurrentFrame(Math.round(anim.currentFrame));
        });

        anim.addEventListener('complete', () => {
          if (direction === 'bounce') {
            isBouncingRef.current = true;
            currentBounceDirRef.current = currentBounceDirRef.current === 1 ? -1 : 1;
            anim.setDirection(currentBounceDirRef.current);
            anim.play();
          }
        });
      } catch (err) {
        console.warn('Lottie player render notice:', err);
      }
    },
    [isLooping, isPlaying, speed, direction, renderer]
  );

  // Mount animation on canvas
  useEffect(() => {
    loadLottieAnimation(lastValidAnimation);
    return () => {
      if (animItemRef.current) {
        animItemRef.current.destroy();
        animItemRef.current = null;
      }
    };
  }, [lastValidAnimation, loadLottieAnimation]);

  // Handle Playback State changes
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
    animItemRef.current.setLoop(isLooping);
  }, [isLooping]);

  useEffect(() => {
    if (!animItemRef.current) return;
    animItemRef.current.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (!animItemRef.current) return;
    if (direction === 'forward') {
      currentBounceDirRef.current = 1;
      animItemRef.current.setDirection(1);
    } else if (direction === 'reverse') {
      currentBounceDirRef.current = -1;
      animItemRef.current.setDirection(-1);
    }
  }, [direction]);

  const handleScrub = (frame: number) => {
    if (!animItemRef.current) return;
    setCurrentFrame(frame);
    animItemRef.current.goToAndStop(frame, true);
    setIsPlaying(false);
  };

  const handleStep = (delta: number) => {
    if (!animItemRef.current) return;
    const next = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    handleScrub(next);
  };

  // Debounced AST update on raw JSON changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!rawJson.trim()) {
        setSyntaxError({ message: 'JSON buffer is empty.' });
        return;
      }

      try {
        const parsedObj = JSON.parse(rawJson);
        const parseCheck = parseLottieJSON(rawJson);

        if (!parseCheck.success || !parseCheck.animation) {
          setSyntaxError({
            message: parseCheck.error || 'Invalid Lottie format: Missing animation properties.',
          });
        } else {
          setSyntaxError(null);
          setLastValidAnimation(parseCheck.animation);
          setMetadata(parseCheck.metadata || null);
        }
      } catch (err: unknown) {
        const e = err as Error;
        let line: number | undefined;
        let col: number | undefined;

        // Extract line & column numbers from V8 / SpiderMonkey JSON.parse error message
        const match = e.message.match(/position (\d+)/i);
        if (match && match[1]) {
          const pos = parseInt(match[1], 10);
          const lines = rawJson.slice(0, pos).split('\n');
          line = lines.length;
          col = lines[lines.length - 1].length + 1;
        }

        setSyntaxError({
          message: e.message,
          line,
          column: col,
        });
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [rawJson]);

  // Tab Key indentation support inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextValue = rawJson.substring(0, start) + '  ' + rawJson.substring(end);
      setRawJson(nextValue);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Sample Selection
  const handleSampleSelect = (sampleId: string) => {
    const s = LOTTIE_SAMPLES.find((item) => item.id === sampleId);
    if (!s) return;
    const jsonStr = JSON.stringify(s.data, null, 2);
    setActiveSampleId(s.id);
    setRawJson(jsonStr);
    setHistoryOriginal(jsonStr);
    setActiveMenu(null);
  };

  // File Upload (.json or .lottie)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const extracted = await extractLottieFromFile(file);

      if (!extracted.success || !extracted.animation) {
        setSyntaxError({ message: extracted.error || 'Failed to parse animation file.' });
        return;
      }

      const formatted = JSON.stringify(extracted.animation, null, 2);
      setRawJson(formatted);
      setHistoryOriginal(formatted);
      setActiveSampleId('');
      setSyntaxError(null);
      setActiveMenu(null);
    } catch (err) {
      setSyntaxError({ message: `File read failure: ${(err as Error).message}` });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Editor Actions
  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      setSyntaxError(null);
    } catch {
      // Keep existing error
    }
    setActiveMenu(null);
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed));
      setSyntaxError(null);
    } catch {
      // Keep existing error
    }
    setActiveMenu(null);
  };

  const handleResetToOriginal = () => {
    setRawJson(historyOriginal);
    setActiveMenu(null);
  };

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'animation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  };

  const handleDownloadDotLottie = () => {
    try {
      const anim = JSON.parse(rawJson);
      const dotLottieBytes = createDotLottie(anim, {
        id: metadata?.name || 'animation',
      });
      const blob = new Blob([dotLottieBytes as unknown as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata?.name || 'animation'}.lottie`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export error: ${(err as Error).message}`);
    }
    setActiveMenu(null);
  };

  // Node Navigation Jump
  const handleJumpToNode = (nodeName: string) => {
    if (!textareaRef.current) return;
    const targetQuery = `"${nodeName}":`;
    const index = rawJson.indexOf(targetQuery);
    if (index !== -1) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index + targetQuery.length);

      // Estimate line scroll position
      const linesBefore = rawJson.substring(0, index).split('\n').length;
      const lineHeight = fontSize === 'xs' ? 18 : fontSize === 'sm' ? 20 : 22;
      textareaRef.current.scrollTop = Math.max(0, (linesBefore - 4) * lineHeight);
    }
    setActiveMenu(null);
  };

  // Quick Tweak Transformations
  const handleQuickScale = (factor: number) => {
    try {
      const anim = JSON.parse(rawJson);
      if (typeof anim.w === 'number') anim.w = Math.round(anim.w * factor);
      if (typeof anim.h === 'number') anim.h = Math.round(anim.h * factor);
      setRawJson(JSON.stringify(anim, null, 2));
    } catch (e) {
      // Ignore
    }
    setActiveMenu(null);
  };

  const handleQuickFramerate = (fps: number) => {
    try {
      const anim = JSON.parse(rawJson);
      anim.fr = fps;
      setRawJson(JSON.stringify(anim, null, 2));
    } catch (e) {
      // Ignore
    }
    setActiveMenu(null);
  };

  // Line Count Generator
  const lineCount = useMemo(() => {
    return rawJson.split('\n').length;
  }, [rawJson]);

  // Background styling for preview canvas
  const getCanvasBg = () => {
    switch (bgType) {
      case 'grid':
        return 'bg-[#0F172A] bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:14px_14px]';
      case 'obsidian':
        return 'bg-[#090E17]';
      case 'light':
        return 'bg-white';
      case 'custom':
        return '';
      default:
        return 'bg-[#0F172A] bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:14px_14px]';
    }
  };

  return (
    <ToolLayout toolId="lottie-editor">
      <div className="space-y-4">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.lottie,application/json,application/zip"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Studio Grid (Split 6:6) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ========================================================
              LEFT COLUMN (6 Cols): Live Real-time Canvas Player
             ======================================================== */}
          <div className="lg:col-span-6 space-y-3">
            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden flex flex-col">
              {/* Canvas Header / Status Bar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-primary" /> Live Canvas
                  </span>
                  {syntaxError ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/25">
                      <AlertTriangle className="w-3 h-3" /> Error {syntaxError.line ? `Line ${syntaxError.line}` : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      <CheckCircle2 className="w-3 h-3" /> Live &bull; {renderer.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Canvas Background Selector */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Grid Background"
                    onClick={() => setBgType('grid')}
                    className={`w-5 h-5 rounded border relative overflow-hidden transition-all ${
                      bgType === 'grid' ? 'border-primary ring-1 ring-primary' : 'border-border'
                    }`}
                  >
                    <div className="w-full h-full bg-[#0F172A] bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:4px_4px]" />
                  </button>
                  <button
                    type="button"
                    title="Dark Obsidian"
                    onClick={() => setBgType('obsidian')}
                    className={`w-5 h-5 rounded bg-[#090E17] border transition-all ${
                      bgType === 'obsidian' ? 'border-primary ring-1 ring-primary' : 'border-border'
                    }`}
                  />
                  <button
                    type="button"
                    title="Light"
                    onClick={() => setBgType('light')}
                    className={`w-5 h-5 rounded bg-white border transition-all ${
                      bgType === 'light' ? 'border-primary ring-1 ring-primary' : 'border-border'
                    }`}
                  />
                  <input
                    type="color"
                    title="Custom Color"
                    value={customBg}
                    onChange={(e) => {
                      setCustomBg(e.target.value);
                      setBgType('custom');
                    }}
                    className="w-5 h-5 rounded cursor-pointer border border-border bg-transparent p-0 overflow-hidden"
                  />
                </div>
              </div>

              {/* Canvas Viewport */}
              <div
                className={`relative w-full h-[360px] flex items-center justify-center overflow-hidden transition-colors ${getCanvasBg()}`}
                style={bgType === 'custom' ? { backgroundColor: customBg } : {}}
              >
                <div ref={containerRef} className="w-full h-full max-w-[320px] max-h-[320px] pointer-events-none" />
              </div>

              {/* Playback Scrub & Timeline Controls */}
              <div className="p-3 bg-card border-t border-border space-y-2.5">
                {/* Timeline Scrubber */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-0.5">
                    <span>
                      Frame <strong className="text-foreground">{currentFrame}</strong> / {totalFrames}
                    </span>
                    <span>
                      {((currentFrame / (metadata?.framerate || 60)) || 0).toFixed(2)}s /{' '}
                      {(metadata?.durationSeconds || (totalFrames / (metadata?.framerate || 60))).toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalFrames - 1)}
                    value={currentFrame}
                    onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Playback Buttons & Speeds */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {/* Transport Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsPlaying((prev) => !prev)}
                      className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStep(-1)}
                      className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                      title="Step Backward (1 frame)"
                    >
                      <StepBack className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStep(1)}
                      className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                      title="Step Forward (1 frame)"
                    >
                      <StepForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrub(0)}
                      className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                      title="Reset Timeline to 0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLooping((prev) => !prev)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isLooping
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      }`}
                      title={isLooping ? 'Loop: Enabled' : 'Loop: Disabled'}
                    >
                      {isLooping ? <Repeat className="w-3.5 h-3.5" /> : <Repeat1 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Direction & Speeds */}
                  <div className="flex items-center gap-1.5">
                    {/* Speed options */}
                    <div className="flex items-center border border-border rounded-lg bg-secondary/40 p-0.5">
                      {SPEED_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpeed(s)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            speed === s
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>

                    {/* Direction Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        setDirection((prev) =>
                          prev === 'forward' ? 'reverse' : prev === 'reverse' ? 'bounce' : 'forward'
                        )
                      }
                      className="px-2 py-1 rounded-lg bg-secondary border border-border text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      {direction === 'forward' && 'Forward →'}
                      {direction === 'reverse' && 'Reverse ←'}
                      {direction === 'bounce' && 'Bounce ⇄'}
                    </button>

                    {/* Audio mute toggle */}
                    {hasAudio && (
                      <button
                        type="button"
                        onClick={() => setIsMuted((prev) => !prev)}
                        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          isMuted
                            ? 'bg-destructive/10 border-destructive/30 text-destructive'
                            : 'bg-primary/10 border-primary/30 text-primary'
                        }`}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metadata Pill Card */}
            <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
              <div>
                Size:{' '}
                <strong className="text-foreground">
                  {metadata?.width && metadata?.height ? `${metadata.width}×${metadata.height}` : 'N/A'}
                </strong>
              </div>
              <div>
                FPS: <strong className="text-foreground">{metadata?.framerate || 'N/A'}</strong>
              </div>
              <div>
                Frames: <strong className="text-foreground">{metadata?.totalFrames || totalFrames}</strong>
              </div>
              <div>
                Version: <strong className="text-foreground">{metadata?.version || '5.x'}</strong>
              </div>
            </div>

            {/* Workflow Navigation */}
            <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Workflows:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-player', '/tools/lottie-player')}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
                >
                  Open in Studio
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-validator', '/tools/lottie-validator')}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
                >
                  Validator
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-optimizer', '/tools/lottie-optimizer')}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
                >
                  Optimizer
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-converter', '/tools/lottie-converter')}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
                >
                  Converter
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN (6 Cols): JSON Code Editor
             ======================================================== */}
          <div className="lg:col-span-6 space-y-3">
            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden flex flex-col">
              {/* Menu Bar (File, Edit, Lottie, View, Renderer) */}
              <div ref={menuContainerRef} className="relative flex items-center border-b border-border bg-card px-2 py-1">
                {/* File Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'file' ? null : 'file'))}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeMenu === 'file'
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    File
                  </button>

                  {activeMenu === 'file' && (
                    <div className="absolute left-0 top-full mt-1 w-52 rounded-xl bg-card border border-border shadow-lg p-1.5 z-50 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-primary" /> Open File (.json / .lottie)
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download .json
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadDotLottie}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-primary" /> Export .lottie Archive
                      </button>

                      <div className="border-t border-border my-1" />
                      <div className="text-[10px] text-muted-foreground px-2.5 py-1 font-semibold uppercase tracking-wider">
                        Load Sample Animation:
                      </div>
                      {LOTTIE_SAMPLES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSampleSelect(s.id)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                        >
                          <span>{s.name}</span>
                          {activeSampleId === s.id && <Check className="w-3.5 h-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'edit' ? null : 'edit'))}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeMenu === 'edit'
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Edit
                  </button>

                  {activeMenu === 'edit' && (
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-card border border-border shadow-lg p-1.5 z-50 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={handlePrettify}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Braces className="w-3.5 h-3.5 text-blue-500" /> Prettify / Format (2 Spaces)
                      </button>
                      <button
                        type="button"
                        onClick={handleMinify}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Code2 className="w-3.5 h-3.5 text-purple-500" /> Minify JSON
                      </button>
                      <button
                        type="button"
                        onClick={handleResetToOriginal}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5 text-amber-500" /> Reset to Original
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setRawJson('{\n  "v": "5.7.0",\n  "fr": 60,\n  "ip": 0,\n  "op": 60,\n  "w": 500,\n  "h": 500,\n  "layers": []\n}');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-left cursor-pointer"
                      >
                        Clear to Empty Skeleton
                      </button>
                    </div>
                  )}
                </div>

                {/* Lottie Jump Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'lottie' ? null : 'lottie'))}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeMenu === 'lottie'
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Lottie
                  </button>

                  {activeMenu === 'lottie' && (
                    <div className="absolute left-0 top-full mt-1 w-52 rounded-xl bg-card border border-border shadow-lg p-1.5 z-50 space-y-0.5 text-xs">
                      <div className="text-[10px] text-muted-foreground px-2.5 py-1 font-semibold uppercase tracking-wider">
                        Jump to JSON Block:
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJumpToNode('fr')}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Root Dimensions & FPS</span>
                        <span className="font-mono text-[10px] text-muted-foreground">w, h, fr</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJumpToNode('layers')}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Layers Array</span>
                        <span className="font-mono text-[10px] text-muted-foreground">layers: []</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJumpToNode('assets')}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Assets (Precomps/Images)</span>
                        <span className="font-mono text-[10px] text-muted-foreground">assets: []</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJumpToNode('markers')}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Timeline Markers</span>
                        <span className="font-mono text-[10px] text-muted-foreground">markers: []</span>
                      </button>

                      <div className="border-t border-border my-1" />
                      <div className="text-[10px] text-muted-foreground px-2.5 py-1 font-semibold uppercase tracking-wider">
                        Quick Modifications:
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickScale(2)}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        Double Resolution (2x w & h)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickScale(0.5)}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        Halve Resolution (0.5x w & h)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFramerate(60)}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        Set Framerate to 60 FPS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFramerate(30)}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        Set Framerate to 30 FPS
                      </button>
                    </div>
                  )}
                </div>

                {/* View Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'view' ? null : 'view'))}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeMenu === 'view'
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    View
                  </button>

                  {activeMenu === 'view' && (
                    <div className="absolute left-0 top-full mt-1 w-44 rounded-xl bg-card border border-border shadow-lg p-1.5 z-50 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setWrapLines((prev) => !prev);
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Line Wrap</span>
                        {wrapLines && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <div className="border-t border-border my-1" />
                      <div className="text-[10px] text-muted-foreground px-2.5 py-1 font-semibold uppercase tracking-wider">
                        Font Size:
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFontSize('xs');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Small (12px)</span>
                        {fontSize === 'xs' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFontSize('sm');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Medium (14px)</span>
                        {fontSize === 'sm' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Renderer Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'renderer' ? null : 'renderer'))}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeMenu === 'renderer'
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Renderer: {renderer.toUpperCase()}
                  </button>

                  {activeMenu === 'renderer' && (
                    <div className="absolute left-0 top-full mt-1 w-44 rounded-xl bg-card border border-border shadow-lg p-1.5 z-50 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setRenderer('svg');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>SVG (Bodymovin)</span>
                        {renderer === 'svg' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenderer('canvas');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>HTML5 Canvas</span>
                        {renderer === 'canvas' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right utility buttons */}
                <div className="ml-auto flex items-center gap-1.5">
                  <CopyButton text={rawJson} label="Copy" />
                </div>
              </div>

              {/* Editor Surface with Line Numbers Gutter */}
              <div className="relative flex h-[460px] bg-background">
                {/* Line Numbers Column */}
                <div
                  ref={lineNumbersRef}
                  className="w-12 select-none overflow-hidden py-3 text-right font-mono text-muted-foreground/50 border-r border-border bg-muted/20"
                  style={{
                    fontSize: fontSize === 'xs' ? '12px' : fontSize === 'sm' ? '14px' : '15px',
                    lineHeight: fontSize === 'xs' ? '1.5rem' : fontSize === 'sm' ? '1.6rem' : '1.7rem',
                  }}
                >
                  <div className="pr-2">
                    {Array.from({ length: Math.min(lineCount, 5000) }, (_, i) => (
                      <div
                        key={i + 1}
                        className={syntaxError?.line === i + 1 ? 'text-destructive font-bold' : ''}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interactive Code Textarea */}
                <textarea
                  ref={textareaRef}
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onScroll={handleScroll}
                  spellCheck={false}
                  wrap={wrapLines ? 'soft' : 'off'}
                  placeholder="Paste Bodymovin Lottie JSON here..."
                  className={`w-full h-full p-3 font-mono bg-transparent text-foreground resize-none focus:outline-hidden developer-scrollbar ${
                    wrapLines ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto whitespace-pre'
                  }`}
                  style={{
                    fontSize: fontSize === 'xs' ? '12px' : fontSize === 'sm' ? '14px' : '15px',
                    lineHeight: fontSize === 'xs' ? '1.5rem' : fontSize === 'sm' ? '1.6rem' : '1.7rem',
                  }}
                />
              </div>

              {/* Diagnostic Footer Bar */}
              <div className="px-3.5 py-2 border-t border-border bg-card flex items-center justify-between text-xs">
                {syntaxError ? (
                  <div className="flex items-center gap-1.5 text-destructive truncate">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono text-[11px] truncate">
                      {syntaxError.line ? `Line ${syntaxError.line}:${syntaxError.column || 1} — ` : ''}
                      {syntaxError.message}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px]">Valid Bodymovin AST &bull; Live Synchronization Active</span>
                  </div>
                )}

                <div className="text-[11px] font-mono text-muted-foreground shrink-0 pl-2">
                  {lineCount} lines &bull; {rawJson.length} chars
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

