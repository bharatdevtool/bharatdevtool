'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ToolLayout from '@/components/layout/ToolLayout';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CopyButton from '@/components/ui/CopyButton';
import { parseLottieJSON, sanitizeAnimationForPrivacy } from '@/lib/lottie/parser';
import { extractLottieFromFile, createDotLottie } from '@/lib/lottie/dotLottie';
import { hasLottieAudio, createBrowserAudioFactory } from '@/lib/lottie/audio';
import { extractLottieColors, replaceLottieColor } from '@/lib/lottie/colors';
import { analyzeLottie } from '@/lib/lottie/analyzer';
import { LOTTIE_SAMPLES } from '@/lib/lottie/samples';
import { setCrossToolData } from '@/lib/crossToolData';
import { useCrossToolData } from '@/hooks/useCrossToolData';
import type { LottieAnimation, LottieMetadata } from '@/lib/lottie/types';
import type { AnimationItem, AnimationDirection, AnimationConfig } from 'lottie-web';
import { loadLottie } from '@/lib/lottie/loader';
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
  ShieldCheck,
  Gauge,
  Sparkles,
  Maximize2,
  Box,
  Volume2,
  VolumeX,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Undo2,
  Code2,
  Braces,
  Check,
  Package,
  GitCompare,
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
type ActiveMenu = 'file' | 'edit' | 'lottie' | 'view' | 'renderer' | null;
type RendererChoice = 'svg' | 'canvas';
// lottie-web's typings omit the audio controller and declare audio player methods without arguments
type LottieAudioFactory = NonNullable<AnimationConfig['audioFactory']>;
type AudioAnimationItem = AnimationItem & { mute?: () => void; unmute?: () => void };

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

  // Editor states & refs
  const [syntaxError, setSyntaxError] = useState<{ message: string; line?: number; column?: number } | null>(null);
  const [editorFontSize, setEditorFontSize] = useState<'xs' | 'sm'>('xs');
  const [wrapLines, setWrapLines] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [rendererChoice, setRendererChoice] = useState<RendererChoice>('svg');

  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

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

  // Sync line numbers scroll with editor textarea
  const handleEditorScroll = () => {
    if (editorTextareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorTextareaRef.current.scrollTop;
    }
  };

  // Tab Key indentation support inside textarea
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  // Debounced AST validation when rawJson changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!rawJson.trim()) {
        setSyntaxError({ message: 'JSON buffer is empty.' });
        return;
      }
      try {
        JSON.parse(rawJson); // throws with a character position used to locate the error line
        const parseCheck = parseLottieJSON(rawJson);
        if (!parseCheck.success || !parseCheck.animation) {
          setSyntaxError({ message: parseCheck.error || 'Invalid Lottie format.' });
        } else {
          setSyntaxError(null);
          setAnimationData(parseCheck.animation);
          setMetadata(parseCheck.metadata || null);
        }
      } catch (err: unknown) {
        const e = err as Error;
        let line: number | undefined;
        let col: number | undefined;
        const match = e.message.match(/position (\d+)/i);
        if (match && match[1]) {
          const pos = parseInt(match[1], 10);
          const lines = rawJson.slice(0, pos).split('\n');
          line = lines.length;
          col = lines[lines.length - 1].length + 1;
        }
        setSyntaxError({ message: e.message, line, column: col });
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [rawJson]);

  const lineCount = useMemo(() => rawJson.split('\n').length, [rawJson]);

  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      setSyntaxError(null);
    } catch {}
    setActiveMenu(null);
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed));
      setSyntaxError(null);
    } catch {}
    setActiveMenu(null);
  };

  const handleJumpToNode = (nodeName: string) => {
    if (!editorTextareaRef.current) return;
    const targetQuery = `"${nodeName}":`;
    const index = rawJson.indexOf(targetQuery);
    if (index !== -1) {
      editorTextareaRef.current.focus();
      editorTextareaRef.current.setSelectionRange(index, index + targetQuery.length);
      const linesBefore = rawJson.substring(0, index).split('\n').length;
      const lineHeight = editorFontSize === 'xs' ? 18 : 20;
      editorTextareaRef.current.scrollTop = Math.max(0, (linesBefore - 4) * lineHeight);
    }
    setActiveMenu(null);
  };

  const handleQuickScale = (factor: number) => {
    try {
      const anim = JSON.parse(rawJson);
      if (typeof anim.w === 'number') anim.w = Math.round(anim.w * factor);
      if (typeof anim.h === 'number') anim.h = Math.round(anim.h * factor);
      setRawJson(JSON.stringify(anim, null, 2));
    } catch {}
    setActiveMenu(null);
  };

  const handleQuickFramerate = (fps: number) => {
    try {
      const anim = JSON.parse(rawJson);
      anim.fr = fps;
      setRawJson(JSON.stringify(anim, null, 2));
    } catch {}
    setActiveMenu(null);
  };

  const handleResetToOriginal = () => {
    if (!originalAnimationRef.current) return;
    const origJson = JSON.stringify(originalAnimationRef.current, null, 2);
    setRawJson(origJson);
    setAnimationData(originalAnimationRef.current);
    const parsed = parseLottieJSON(origJson);
    setMetadata(parsed.metadata || null);
    setSyntaxError(null);
    setIsColorModified(false);
    setActiveMenu(null);
  };

  const [error, setError] = useState<string | null>(null);

  // Cross-tool data ingestion
  useCrossToolData<{ lottieJson: string }>('lottie-player', ({ lottieJson }) => {
    const parsed = parseLottieJSON(lottieJson);
    if (parsed.success && parsed.animation) {
      setAnimationData(parsed.animation);
      originalAnimationRef.current = parsed.animation;
      setIsColorModified(false);
      setRawJson(JSON.stringify(parsed.animation, null, 2));
      setMetadata(parsed.metadata || null);
      setActiveSampleId('');
      setError(null);
    }
  });

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

  // Latest playback settings, read by the animation instance without reloading it
  const playbackRef = useRef({ isPlaying, isLooping, speed, direction, isMuted });
  useEffect(() => {
    playbackRef.current = { isPlaying, isLooping, speed, direction, isMuted };
  });

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
    analytics.track(ANALYTICS_EVENTS.REPLACE_LOTTIE_COLOR);
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
  const currentBounceDirRef = useRef<AnimationDirection>(1);

  // Mount the animation; playback settings are applied by the control effects below,
  // so toggling play/speed/direction never reloads it or resets the frame
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let anim: AnimationItem | null = null;

    loadLottie(rendererChoice)
      .then((lottie) => {
        if (cancelled) return;
        const playback = playbackRef.current;
        anim = lottie.loadAnimation({
          container,
          renderer: rendererChoice,
          loop: playback.direction === 'bounce' ? false : playback.isLooping,
          autoplay: playback.isPlaying,
          animationData: sanitizeAnimationForPrivacy(animationData),
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
          },
          audioFactory: createBrowserAudioFactory(
            () => playbackRef.current.isMuted,
            () => 1
          ) as unknown as LottieAudioFactory,
        });
        const item = anim;

        item.setSpeed(playback.speed);
        item.setDirection((playback.direction === 'reverse' ? -1 : 1) as AnimationDirection);

        item.addEventListener('DOMLoaded', () => {
          const total = item.totalFrames || (animationData.op ? animationData.op - (animationData.ip || 0) : 100);
          setTotalFrames(Math.round(total));
        });

        item.addEventListener('enterFrame', () => {
          setCurrentFrame(Math.round(item.currentFrame));
        });

        item.addEventListener('complete', () => {
          if (playbackRef.current.direction === 'bounce') {
            currentBounceDirRef.current = (currentBounceDirRef.current === 1 ? -1 : 1) as AnimationDirection;
            item.setDirection(currentBounceDirRef.current);
            item.play();
          } else if (!playbackRef.current.isLooping) {
            setIsPlaying(false);
          }
        });

        animItemRef.current = item;
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(`Failed to render Lottie animation: ${err.message}`);
      });

    return () => {
      cancelled = true;
      anim?.destroy();
      if (animItemRef.current === anim) animItemRef.current = null;
    };
  }, [animationData, rendererChoice]);

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
        (animItemRef.current as AudioAnimationItem).mute?.();
      } else {
        (animItemRef.current as AudioAnimationItem).unmute?.();
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
    const jsonStr = JSON.stringify(res.animation, null, 2);
    setRawJson(jsonStr);
    const parsed = parseLottieJSON(jsonStr);
    setMetadata(parsed.metadata || null);
    setActiveSampleId('');
    setIsPlaying(true);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    analytics.track(ANALYTICS_EVENTS.LOAD_LOTTIE, { tool: 'player', format: file.name.toLowerCase().endsWith('.lottie') ? 'lottie' : 'json' });
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
    analytics.track(ANALYTICS_EVENTS.DOWNLOAD_LOTTIE, { tool: 'player', format: 'lottie' });
  };

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'animation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    analytics.track(ANALYTICS_EVENTS.DOWNLOAD_LOTTIE, { tool: 'player', format: 'json' });
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Upload File (.json / .lottie)
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Main Studio Viewport (2-Column Split Playground on Desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Animation Player Viewport (6 Cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-3">
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

            {/* Unified Inspector Card */}
            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden flex flex-col">
              {/* Top Tab Bar */}
              <div className="flex items-center gap-0.5 border-b border-border bg-card px-2.5 pt-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors whitespace-nowrap cursor-pointer border-b-2 font-medium ${
                        isActive
                          ? 'border-primary text-primary font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span
                          className={`text-[11px] font-mono px-1 rounded ${
                            tab.alert
                              ? 'bg-amber-500/10 text-amber-500 font-bold'
                              : 'bg-secondary text-muted-foreground'
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
              <div className="p-4 flex-1">
                {/* 1. INFO TAB */}
                {inspectorTab === 'info' && (
                  <div className="space-y-4">
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          NAME
                        </span>
                        <span
                          className="font-semibold text-foreground truncate max-w-[200px] text-right font-mono"
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download .json
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadDotLottie}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer"
                        title="Export animation as a compressed dotLottie (.lottie) archive"
                      >
                        <Package className="w-3.5 h-3.5 text-primary" /> Export .lottie
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

                    <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/20 developer-scrollbar">
                      {allLayers.map((layer, idx) => {
                        const typeInfo = getLayerTypeInfo(layer.ty);
                        return (
                          <button
                            key={`${layer.composition}-${layer.ind}-${idx}`}
                            type="button"
                            onClick={() => handleJumpToNode(layer.name)}
                            className="w-full pt-1.5 first:pt-0 space-y-1 text-left rounded-lg p-1.5 hover:bg-secondary/60 transition-colors cursor-pointer group"
                            title="Click to jump to layer in code editor"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-mono text-muted-foreground px-1 py-0.5 rounded bg-secondary">
                                  #{layer.ind}
                                </span>
                                <span className="font-medium text-foreground truncate max-w-[140px] group-hover:text-primary transition-colors" title={layer.name}>
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
                          </button>
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
                        Click swatch to swap color live across animation:
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
                      <div className="max-h-80 overflow-y-auto space-y-2 pr-1 developer-scrollbar">
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
                      <div className="max-h-80 overflow-y-auto space-y-2 pr-1 developer-scrollbar">
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
                              <div className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> {asset.warning}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Flagship Unified Studio (Editor with Header Menus for File, Edit, Lottie, View, Renderer) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl bg-card border border-border shadow-xs flex flex-col">
              {/* Unified Header Menu Bar */}
              <div
                ref={menuContainerRef}
                className="relative z-30 flex flex-wrap items-center gap-y-1 border-b border-border bg-card px-2 py-1 rounded-t-2xl"
              >
                {/* 1. File Menu */}
                <div className="relative shrink-0">
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
                    <div className="absolute left-0 top-full mt-1 w-52 rounded-xl bg-card border border-border shadow-xl p-1.5 z-50 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-primary" /> Open File (.json / .lottie)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownload();
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download .json
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadDotLottie();
                          setActiveMenu(null);
                        }}
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
                          onClick={() => {
                            handleSampleSelect(s.id);
                            setActiveMenu(null);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                        >
                          <span>{s.name}</span>
                          {activeSampleId === s.id && <Check className="w-3.5 h-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Edit Menu */}
                <div className="relative shrink-0">
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
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-card border border-border shadow-xl p-1.5 z-50 space-y-0.5 text-xs">
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

                {/* 3. Lottie Menu */}
                <div className="relative shrink-0">
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
                    <div className="absolute left-0 top-full mt-1 w-52 rounded-xl bg-card border border-border shadow-xl p-1.5 z-50 space-y-0.5 text-xs">
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

                {/* 4. View Menu */}

                <div className="relative shrink-0">
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
                    <div className="absolute left-0 top-full mt-1 w-44 rounded-xl bg-card border border-border shadow-xl p-1.5 z-50 space-y-0.5 text-xs">
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
                          setEditorFontSize('xs');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Small (12px)</span>
                        {editorFontSize === 'xs' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditorFontSize('sm');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>Medium (14px)</span>
                        {editorFontSize === 'sm' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 5. Renderer Menu */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'renderer' ? null : 'renderer'))}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeMenu === 'renderer'
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Renderer: {rendererChoice.toUpperCase()}
                  </button>

                  {activeMenu === 'renderer' && (
                    <div className="absolute left-0 top-full mt-1 w-44 rounded-xl bg-card border border-border shadow-xl p-1.5 z-50 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setRendererChoice('svg');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>SVG (Bodymovin)</span>
                        {rendererChoice === 'svg' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRendererChoice('canvas');
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                      >
                        <span>HTML5 Canvas</span>
                        {rendererChoice === 'canvas' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 6. Copy Button on Far Right */}
                <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0">
                  <CopyButton text={rawJson} label="Copy" />
                </div>
              </div>

              {/* Editor Surface with Line Numbers Gutter */}
              <div className="relative z-10 flex h-[460px] bg-background">
                {/* Line Numbers Column */}
                <div
                  ref={lineNumbersRef}
                  className="w-12 select-none overflow-hidden py-3 text-right font-mono text-muted-foreground/50 border-r border-border bg-muted/20"
                  style={{
                    fontSize: editorFontSize === 'xs' ? '12px' : '14px',
                    lineHeight: editorFontSize === 'xs' ? '1.5rem' : '1.6rem',
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
                  ref={editorTextareaRef}
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  onKeyDown={handleEditorKeyDown}
                  onScroll={handleEditorScroll}
                  spellCheck={false}
                  wrap={wrapLines ? 'soft' : 'off'}
                  placeholder="Paste Bodymovin Lottie JSON here..."
                  className={`w-full h-full p-3 font-mono bg-transparent text-foreground resize-none focus:outline-hidden developer-scrollbar ${
                    wrapLines ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto whitespace-pre'
                  }`}
                  style={{
                    fontSize: editorFontSize === 'xs' ? '12px' : '14px',
                    lineHeight: editorFontSize === 'xs' ? '1.5rem' : '1.6rem',
                  }}
                />
              </div>

              {/* Diagnostic Footer Bar */}
              <div className="px-3.5 py-2 border-t border-border bg-card flex items-center justify-between text-xs rounded-b-2xl">
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

            {/* Quick Bridge to Next Lottie Tools (2x2 Grid) */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2.5">
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider block">
                Next Lottie Workflows
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-converter', '/tools/lottie-converter')}
                  className="flex flex-col p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground group-hover:text-foreground">→</span>
                  </div>
                  <div className="font-medium text-foreground">dotLottie Converter</div>
                  <div className="text-[10px] text-muted-foreground">JSON &harr; .lottie archives</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-validator', '/tools/lottie-validator')}
                  className="flex flex-col p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-muted-foreground group-hover:text-foreground">→</span>
                  </div>
                  <div className="font-medium text-foreground">Lottie Validator</div>
                  <div className="text-[10px] text-muted-foreground">AST & asset link checks</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateToTool('lottie-optimizer', '/tools/lottie-optimizer')}
                  className="flex flex-col p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Gauge className="w-4 h-4 text-purple-500" />
                    <span className="text-muted-foreground group-hover:text-foreground">→</span>
                  </div>
                  <div className="font-medium text-foreground">Lottie Optimizer</div>
                  <div className="text-[10px] text-muted-foreground">Precision & size cleanup</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateToTool('json-diff', '/jsondiff/')}
                  className="flex flex-col p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <GitCompare className="w-4 h-4 text-blue-500" />
                    <span className="text-muted-foreground group-hover:text-foreground">→</span>
                  </div>
                  <div className="font-medium text-foreground">JSON Diff & Compare</div>
                  <div className="text-[10px] text-muted-foreground">Compare Lottie variations</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
