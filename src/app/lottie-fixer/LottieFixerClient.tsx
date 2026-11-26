'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { zipSync } from 'fflate';
import type { AnimationItem } from 'lottie-web';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import {
  diagnoseLottie,
  repairLottie,
  sha256Hex,
  formatBytes,
  type LottieDiagnosis,
  type RepairResult,
  type FixerIssue,
  type Verdict,
  type ExtraFile,
  type IssueGroup,
  type Platform,
} from '@/lib/lottie/fixer';
import { FLAG_DATA_DESCRIPTOR, type ZipEntryInfo } from '@/lib/lottie/zipInspect';
import { extractDotLottie } from '@/lib/lottie/dotLottie';
import { sanitizeAnimationForPrivacy } from '@/lib/lottie/parser';
import { loadLottie } from '@/lib/lottie/loader';
import { fetchLottieBytes, LottieUrlError } from '@/lib/lottie/fromUrl';
import { setCrossToolData } from '@/lib/crossToolData';
import { useCrossToolData } from '@/hooks/useCrossToolData';
import { downloadBytes } from '@/lib/pdf/shared';
import type { LottieAnimation } from '@/lib/lottie/types';
import {
  UploadCloud,
  Link2,
  Sparkles,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Smartphone,
  Apple,
  Globe,
  ChevronDown,
  ChevronRight,
  Trash2,
  Film,
  ShieldCheck,
  FileArchive,
  FileJson,
  Wrench,
  Table2,
  Loader2,
  ImagePlus,
} from 'lucide-react';

const MAX_BYTES = 25 * 1024 * 1024;
const SAMPLE_URL = '/samples/lottie/figma-android-broken.lottie';
const SAMPLE_NAME = 'figma-android-broken.lottie';
const IMAGE_FILE = /\.(png|jpe?g|webp|gif)$/i;

interface FixerFile {
  id: string;
  name: string;
  bytes: Uint8Array;
}

interface Processed {
  file: FixerFile;
  diagnosis: LottieDiagnosis;
  repair: RepairResult | null;
}

let nextId = 1;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function LottieFixerClient() {
  const router = useRouter();
  const [files, setFiles] = useState<FixerFile[]>([]);
  const [extraImages, setExtraImages] = useState<ExtraFile[]>([]);
  const [toV1, setToV1] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FixerFile[], source: 'upload' | 'url' | 'sample' | 'handoff') => {
    if (incoming.length === 0) return;
    setFiles((prev) => [...prev, ...incoming]);
    setExpanded(incoming[0].id);
    for (const f of incoming) {
      const d = diagnoseLottie(f.bytes, f.name);
      analytics.track(ANALYTICS_EVENTS.DIAGNOSE_LOTTIE, {
        source,
        format: d.kind,
        android: d.verdict.android,
        fixes: d.autoFixCount,
        issues: d.issues.length,
      });
    }
  }, []);

  // A .lottie handed over from the Lottie Validator
  useCrossToolData<{ fileName: string; base64: string }>('lottie-fixer', ({ fileName, base64 }) => {
    try {
      addFiles([{ id: `f${nextId++}`, name: fileName, bytes: base64ToBytes(base64) }], 'handoff');
    } catch {
      setError('The file from the Validator could not be opened here. Drop it in again.');
    }
  });

  // Diagnose + repair every file; recomputed when options or the image pool change
  const processed: Processed[] = useMemo(
    () =>
      files.map((file) => {
        const diagnosis = diagnoseLottie(file.bytes, file.name, extraImages);
        const repair = diagnosis.fatal ? null : repairLottie(file.bytes, file.name, { toV1, extraFiles: extraImages });
        return { file, diagnosis, repair };
      }),
    [files, extraImages, toV1]
  );

  const canConvert = processed.some((p) => p.diagnosis.canConvertToV1);
  const fixable = processed.filter((p) => p.repair?.ok);

  const handleFileList = async (list: FileList | File[]) => {
    setError(null);
    const all = Array.from(list);
    const tooBig = all.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length > 0) setError(`${tooBig[0].name} is larger than 25 MB, the browser limit for this tool.`);
    const ok = all.filter((f) => f.size <= MAX_BYTES);

    const images = ok.filter((f) => IMAGE_FILE.test(f.name));
    const animations = ok.filter((f) => !IMAGE_FILE.test(f.name));
    if (images.length > 0) {
      const loaded = await Promise.all(images.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
      setExtraImages((prev) => [...prev.filter((p) => !loaded.some((l) => l.name === p.name)), ...loaded]);
    }
    const loaded = await Promise.all(
      animations.map(async (f) => ({ id: `f${nextId++}`, name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))
    );
    addFiles(loaded, 'upload');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUrl = async () => {
    setError(null);
    setLoading(true);
    try {
      const { bytes, fileName } = await fetchLottieBytes(url);
      addFiles([{ id: `f${nextId++}`, name: fileName, bytes }], 'url');
      setUrl('');
    } catch (err) {
      setError(err instanceof LottieUrlError ? err.message : 'Could not load this link.');
    } finally {
      setLoading(false);
    }
  };

  const handleSample = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error();
      addFiles([{ id: `f${nextId++}`, name: SAMPLE_NAME, bytes: new Uint8Array(await res.arrayBuffer()) }], 'sample');
    } catch {
      setError('The sample could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const trackFix = (p: Processed, mode: 'single' | 'normalised' | 'all', count = 1) => {
    analytics.track(ANALYTICS_EVENTS.FIX_LOTTIE, {
      mode,
      format: p.diagnosis.kind,
      android: p.diagnosis.verdict.android,
      fixes: p.diagnosis.autoFixCount,
      files: count,
    });
  };

  const downloadOne = (p: Processed) => {
    if (!p.repair?.ok || !p.repair.bytes) return;
    downloadBytes(p.repair.bytes, p.repair.fileName, 'application/zip');
    trackFix(p, p.diagnosis.autoFixCount > 0 ? 'single' : 'normalised');
  };

  const downloadAll = () => {
    const used = new Set<string>();
    const zippable: Record<string, [Uint8Array, { level: 0 }]> = {};
    for (const p of fixable) {
      let name = p.repair!.fileName;
      for (let n = 2; used.has(name); n++) name = p.repair!.fileName.replace(/\.lottie$/, ` (${n}).lottie`);
      used.add(name);
      zippable[name] = [p.repair!.bytes!, { level: 0 }];
    }
    downloadBytes(zipSync(zippable), 'lottie-fixed.zip', 'application/zip');
    if (fixable[0]) trackFix(fixable[0], 'all', fixable.length);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const openInPlayer = (p: Processed) => {
    const anim = previewAnimationFor(p);
    if (!anim) return;
    setCrossToolData('lottie-player', { lottieJson: JSON.stringify(anim) });
    router.push('/lottie-player');
  };

  return (
    <ToolLayout toolId="lottie-fixer">
      <div className="space-y-6">
        {/* Intro */}
        <div className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 self-start">
            <Smartphone className="w-5 h-5" />
          </div>
          <p className="text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Downloaded a .lottie from Figma and it won&apos;t play on Android?</span>{' '}
            Drop it here. The fixer finds why a Lottie fails on Android, iOS or the web, repairs what can be repaired without
            changing the animation, and tells you what needs a designer. Files stay in your browser.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) void handleFileList(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".lottie,.zip,.json,application/json,application/zip,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && void handleFileList(e.target.files)}
          />
          <UploadCloud className="w-10 h-10 mx-auto text-primary mb-3" />
          <p className="text-sm font-semibold text-foreground">Drop .lottie or Lottie .json files here</p>
          <p className="text-xs text-muted-foreground mt-1">
            Several files at once are fine. For a .json that uses separate images, drop the images too.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <UploadCloud className="w-4 h-4" /> Choose files
            </button>
            <button
              type="button"
              onClick={handleSample}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-primary" /> Try a broken Figma sample
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleUrl();
            }}
            className="mt-4 flex flex-col sm:flex-row items-stretch gap-2 max-w-xl mx-auto"
          >
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Or paste a link to a .lottie / .json file"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Load link
            </button>
          </form>
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {extraImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ImagePlus className="w-4 h-4 text-primary" />
            <span>
              {extraImages.length} image file{extraImages.length === 1 ? '' : 's'} added for bundling into JSON animations.
            </span>
            <button type="button" onClick={() => setExtraImages([])} className="underline hover:text-foreground">
              Clear
            </button>
          </div>
        )}

        {/* Options + bulk actions */}
        {processed.length > 0 && (canConvert || fixable.length > 1) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border text-sm">
            {canConvert ? (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={toV1} onChange={(e) => setToV1(e.target.checked)} className="mt-1 accent-primary" />
                <span>
                  <span className="font-medium text-foreground">Convert dotLottie v2 to the v1 layout</span>
                  <span className="block text-xs text-muted-foreground">
                    For apps on lottie-ios older than 4.5.2. Themes and state machines are removed.
                  </span>
                </span>
              </label>
            ) : (
              <span />
            )}
            {fixable.length > 1 && (
              <button
                type="button"
                onClick={downloadAll}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
              >
                <Download className="w-4 h-4" /> Download all as .zip ({fixable.length})
              </button>
            )}
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {processed.map((p) => (
            <FileCard
              key={p.file.id}
              item={p}
              open={expanded === p.file.id}
              onToggle={() => setExpanded((cur) => (cur === p.file.id ? null : p.file.id))}
              onRemove={() => removeFile(p.file.id)}
              onDownload={() => downloadOne(p)}
              onOpenPlayer={() => openInPlayer(p)}
            />
          ))}
        </div>

        {processed.length === 0 && <WhatItChecks />}
      </div>
    </ToolLayout>
  );
}

// ── Preview helpers ──────────────────────────────────────────────

function previewAnimationFor(p: Processed): LottieAnimation | null {
  if (p.repair?.ok && p.repair.bytes) {
    const res = extractDotLottie(p.repair.bytes);
    if (res.success && res.animation) return sanitizeAnimationForPrivacy(res.animation);
  }
  return p.diagnosis.animation ? sanitizeAnimationForPrivacy(p.diagnosis.animation) : null;
}

function Preview({ item }: { item: Processed }) {
  const ref = useRef<HTMLDivElement>(null);
  const animation = useMemo(() => previewAnimationFor(item), [item]);
  // Keyed to the animation, so a new file starts without the old error
  const [failedFor, setFailedFor] = useState<LottieAnimation | null>(null);
  const failed = failedFor !== null && failedFor === animation;

  useEffect(() => {
    let anim: AnimationItem | null = null;
    let cancelled = false;
    if (!animation || !ref.current) return;
    loadLottie()
      .then((lottie) => {
        if (cancelled || !ref.current) return;
        anim = lottie.loadAnimation({
          container: ref.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: JSON.parse(JSON.stringify(animation)),
        });
      })
      .catch(() => setFailedFor(animation));
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [animation]);

  if (!animation) return null;
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-muted/40">
      <div ref={ref} className="w-full aspect-square max-h-64 mx-auto" aria-label="Animation preview" />
      {failed && <p className="p-2 text-xs text-muted-foreground text-center">Preview could not be shown.</p>}
    </div>
  );
}

// ── File card ────────────────────────────────────────────────────

const VERDICT_STYLE: Record<Verdict, { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
  ok: { cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400', label: 'OK', Icon: CheckCircle2 },
  warn: { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', label: 'Plays, with warnings', Icon: AlertTriangle },
  fail: { cls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400', label: 'Will fail', Icon: XCircle },
  unsupported: { cls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400', label: 'Unsupported', Icon: XCircle },
};

const PLATFORM: Record<Platform, { label: string; Icon: typeof Smartphone }> = {
  android: { label: 'Android', Icon: Smartphone },
  ios: { label: 'iOS', Icon: Apple },
  web: { label: 'Web', Icon: Globe },
};

function VerdictBadge({ platform, verdict }: { platform: Platform; verdict: Verdict }) {
  const s = VERDICT_STYLE[verdict];
  const P = PLATFORM[platform];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${s.cls}`}>
      <P.Icon className="w-3.5 h-3.5" />
      {P.label}: <s.Icon className="w-3.5 h-3.5" /> {s.label}
    </span>
  );
}

const GROUPS: { id: IssueGroup; title: string }[] = [
  { id: 'container', title: 'File container (.lottie zip)' },
  { id: 'animation', title: 'Animation & images' },
  { id: 'mobile', title: 'Mobile feature support' },
];

function FileCard({
  item,
  open,
  onToggle,
  onRemove,
  onDownload,
  onOpenPlayer,
}: {
  item: Processed;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDownload: () => void;
  onOpenPlayer: () => void;
}) {
  const { file, diagnosis: d, repair } = item;
  const [showZip, setShowZip] = useState(false);
  // Keyed to the repair result, so a stale hash is never shown for new output
  const [shaState, setShaState] = useState<{ for: RepairResult; hash: string } | null>(null);
  const sha = shaState && shaState.for === repair ? shaState.hash : null;

  useEffect(() => {
    let cancelled = false;
    if (repair?.ok && repair.bytes) {
      sha256Hex(repair.bytes)
        .then((hash) => {
          if (!cancelled) setShaState({ for: repair, hash });
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [repair]);

  const needsFix = d.autoFixCount > 0;
  const figmaBreak = d.issues.some((i) => i.id === 'zip-descriptor-stored');
  const afterVerdict = useMemo(
    () => (repair?.ok && repair.bytes ? diagnoseLottie(repair.bytes, repair.fileName).verdict : null),
    [repair]
  );
  const FileIcon = d.kind === 'json' ? FileJson : FileArchive;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onToggle} className="flex items-start gap-2.5 text-left min-w-0" aria-expanded={open}>
            {open ? <ChevronDown className="w-4 h-4 mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1 shrink-0" />}
            <FileIcon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold text-foreground break-all">{file.name}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {formatBytes(d.byteSize)}
                {d.kind === 'lottie' && d.formatVersion ? ` · dotLottie v${d.formatVersion}` : d.kind === 'json' ? ' · Lottie JSON' : ''}
                {d.generator ? ` · made by ${d.generator}` : ''}
                {d.zip?.ok ? ` · ${d.zip.entries.length} zip entries` : ''}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
            aria-label={`Remove ${file.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <VerdictBadge platform="android" verdict={d.verdict.android} />
          <VerdictBadge platform="ios" verdict={d.verdict.ios} />
          <VerdictBadge platform="web" verdict={d.verdict.web} />
        </div>

        {d.fatal && <ErrorMessage message={d.fatal} />}

        {figmaBreak && (
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground leading-relaxed">
            <span className="font-semibold">In plain words:</span>{' '}
            {d.generator === 'Figma' ? 'Figma' : 'The tool that made this file'} saved it in a zip format Android can&apos;t read. The
            animation itself is fine. Fix &amp; download re-packs it so Android can open it. Nothing inside changes.
          </div>
        )}

        {/* Fix action */}
        {repair && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {repair.ok ? (
              <button
                type="button"
                onClick={onDownload}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  needsFix
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary border border-border text-foreground hover:bg-muted'
                }`}
              >
                {needsFix ? <Wrench className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                {needsFix ? `Fix & download ${repair.fileName}` : 'Download a normalised copy'}
              </button>
            ) : (
              <ErrorMessage message={repair.error || 'This file could not be repaired.'} className="flex-1" />
            )}
            {!needsFix && repair.ok && d.kind === 'lottie' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" /> No fix needed: the container is already standard.
              </span>
            )}
            {needsFix && afterVerdict && (
              <span className="text-xs text-muted-foreground">
                After fixing: Android {VERDICT_STYLE[afterVerdict.android].label.toLowerCase()}, iOS{' '}
                {VERDICT_STYLE[afterVerdict.ios].label.toLowerCase()}, web {VERDICT_STYLE[afterVerdict.web].label.toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-border p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-5 min-w-0">
            {/* Before / after */}
            {repair?.ok && repair.verification && (
              <div className="rounded-xl border border-border p-3.5 text-xs space-y-2">
                <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Repair check
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label="Size" value={`${formatBytes(repair.before.bytes)} → ${formatBytes(repair.after.bytes)}`} />
                  <Stat label="Entries" value={`${repair.before.entries} → ${repair.after.entries}`} />
                  <Stat label="Data descriptors" value={repair.verification.noDescriptors ? 'None ✓' : 'Present'} />
                  <Stat
                    label="Content"
                    value={repair.verification.contentIdentical ? 'Identical ✓' : 'Changed'}
                  />
                </div>
                {repair.changes.length > 0 && (
                  <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                    {repair.changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
                {repair.verification.modifiedEntries.length > 0 && (
                  <p className="text-muted-foreground">
                    Intentionally changed: {repair.verification.modifiedEntries.map((m) => <code key={m} className="mx-0.5">{m}</code>)}. Every
                    other entry is byte-for-byte the original.
                  </p>
                )}
                {sha && (
                  <p className="text-muted-foreground break-all">
                    SHA-256 of the fixed file: <code className="text-foreground">{sha}</code>
                  </p>
                )}
              </div>
            )}

            {/* Issues */}
            {GROUPS.map((g) => {
              const issues = d.issues.filter((i) => i.group === g.id);
              if (issues.length === 0) return null;
              return (
                <section key={g.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                  {issues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </section>
              );
            })}
            {!d.fatal && d.issues.length === 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No problems found.
              </p>
            )}

            {/* Zip details */}
            {d.zip?.ok && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowZip((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  aria-expanded={showZip}
                >
                  <Table2 className="w-3.5 h-3.5" /> {showZip ? 'Hide' : 'Show'} zip details
                </button>
                {showZip && <ZipTable entries={d.zip.entries} />}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-3">
            <Preview item={item} />
            {d.stats && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Canvas" value={d.stats.width && d.stats.height ? `${d.stats.width}×${d.stats.height}` : '—'} />
                <Stat label="Frame rate" value={d.stats.fps ? `${d.stats.fps} fps` : '—'} />
                <Stat label="Duration" value={d.stats.durationSeconds !== null ? `${d.stats.durationSeconds} s` : '—'} />
                <Stat label="Lottie version" value={d.stats.version ?? '—'} />
                <Stat label="Layers" value={String(d.stats.layers)} />
                <Stat label="Images" value={d.stats.imageCount ? `${d.stats.imageCount} · ${formatBytes(d.stats.imageBytes)}` : '0'} />
              </div>
            )}
            {d.stats && d.stats.largestImages.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Largest images:{' '}
                {d.stats.largestImages.map((i) => `${i.name} (${formatBytes(i.bytes)})`).join(', ')}
              </div>
            )}
            {d.animation && (
              <button
                type="button"
                onClick={onOpenPlayer}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors border border-border"
              >
                <Film className="w-3.5 h-3.5 text-primary" /> Open in Lottie Player
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border min-w-0">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="block font-semibold text-foreground truncate">{value}</span>
    </div>
  );
}

const SEVERITY: Record<FixerIssue['severity'], { cls: string; label: string }> = {
  error: { cls: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400', label: 'Error' },
  warning: { cls: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', label: 'Warning' },
  info: { cls: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400', label: 'Info' },
};

const FIX_LABEL: Record<FixerIssue['fix'], string | null> = {
  auto: 'Fixed by Fix & download',
  option: 'Optional fix above',
  manual: 'Needs a change in the source',
  none: null,
};

function IssueRow({ issue }: { issue: FixerIssue }) {
  const s = SEVERITY[issue.severity];
  const fix = FIX_LABEL[issue.fix];
  return (
    <div className="p-3.5 rounded-xl border border-border bg-background/40 space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded-md border font-bold uppercase text-[10px] ${s.cls}`}>{s.label}</span>
        <span className="font-semibold text-foreground text-sm">{issue.title}</span>
        {issue.platforms.length > 0 && issue.platforms.length < 3 && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {issue.platforms.map((p) => PLATFORM[p].label).join(' · ')}
          </span>
        )}
        {fix && (
          <span
            className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-medium ${
              issue.fix === 'auto' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {fix}
          </span>
        )}
      </div>
      <p className="text-muted-foreground leading-relaxed">{issue.message}</p>
      {issue.advice && (
        <p className="flex items-start gap-1.5 text-foreground/90">
          <Info className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <span>{issue.advice}</span>
        </p>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ZipEntryInfo['status'], string> = {
  ok: 'OK',
  'android-breaking': 'Breaks Android',
  'android-risky': 'Non-standard',
  mismatch: 'Header mismatch',
  unsupported: 'Unsupported',
};

function ZipTable({ entries }: { entries: ZipEntryInfo[] }) {
  return (
    <div className="mt-2 overflow-x-auto developer-scrollbar rounded-xl border border-border">
      <table className="w-full text-[11px] font-mono">
        <thead className="bg-secondary/60 text-muted-foreground">
          <tr>
            {['Entry', 'Method', 'Flag', 'Local size', 'Real size', 'CRC', 'Status'].map((h) => (
              <th key={h} className="text-left font-semibold px-2.5 py-2 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const flag = e.local?.flag ?? e.central.flag;
            const descriptor = (flag & FLAG_DATA_DESCRIPTOR) !== 0;
            const crcOk = !e.local || e.local.crc === e.central.crc || (descriptor && e.local.crc === 0);
            const bad = e.status === 'android-breaking' || e.status === 'mismatch' || e.status === 'unsupported';
            return (
              <tr key={e.name + e.localOffset} className="border-t border-border">
                <td className="px-2.5 py-1.5 break-all text-foreground">
                  {e.name}
                  {e.kind !== 'file' && <span className="ml-1 text-muted-foreground">({e.kind === 'junk' ? 'junk' : 'folder'})</span>}
                </td>
                <td className="px-2.5 py-1.5">{e.central.method === 0 ? 'STORED' : e.central.method === 8 ? 'DEFLATE' : e.central.method}</td>
                <td className={`px-2.5 py-1.5 ${descriptor ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                  0x{flag.toString(16).padStart(4, '0')}
                  {descriptor && <span className="font-normal"> (bit 3)</span>}
                </td>
                <td className="px-2.5 py-1.5">{e.local ? e.local.compressedSize : '—'}</td>
                <td className="px-2.5 py-1.5">{e.central.compressedSize}</td>
                <td className="px-2.5 py-1.5">{crcOk ? (descriptor ? 'after data' : 'match') : 'mismatch'}</td>
                <td className={`px-2.5 py-1.5 whitespace-nowrap ${bad ? 'text-red-600 dark:text-red-400 font-semibold' : e.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {STATUS_LABEL[e.status]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────

const CHECKS: { title: string; body: string }[] = [
  {
    title: 'Figma .lottie fails on Android',
    body: 'Repairs the zip format that makes lottie-android and lottie-react-native fail with "Unable to parse composition".',
  },
  {
    title: 'Themes, extra animations, .JSON names',
    body: 'Android loads the last .json in the archive. The fixer puts the main animation last so Android plays the right one.',
  },
  {
    title: 'Broken or missing manifest, BOM, junk',
    body: 'Rebuilds manifest.json, removes the invisible byte-order mark, __MACOSX and .DS_Store, and fixes Windows paths.',
  },
  {
    title: 'Missing and heavy images',
    body: 'Finds images the animation needs but the file lacks, names Android can\'t match, and images large enough to stutter.',
  },
  {
    title: 'Features mobile players skip',
    body: 'Lists merge paths, expressions, effects, layer styles, 3D layers, blend and mask modes, with what to change.',
  },
  {
    title: 'JSON with separate images',
    body: 'Packs a Lottie .json and its image files into one .lottie that every platform can open.',
  },
];

function WhatItChecks() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {CHECKS.map((c) => (
        <div key={c.title} className="p-4 rounded-xl bg-card border border-border">
          <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
