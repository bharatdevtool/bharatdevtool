// src/lib/lottie/fixer.ts — Diagnose and repair .lottie / Lottie JSON files that fail
// on some platforms (mostly Android) while playing fine in the browser.
//
// The repair only touches the container: entries are re-packed byte-for-byte into a
// standard zip (sizes in every local header, no data descriptors), junk is dropped and
// the manifest is rebuilt. The animation JSON is never re-serialised; the only content
// change allowed is removing a UTF-8 byte-order mark. Every repair is re-read and
// compared against the original before it is returned. Pure functions, no DOM.

import { zipSync, type Zippable } from 'fflate';
import {
  inspectZip,
  readEntry,
  looksLikeZip,
  summarizeZip,
  FLAG_DATA_DESCRIPTOR,
  METHOD_STORED,
  type ZipInspection,
} from './zipInspect';
import { scanLottieFeatures, type FeatureFinding } from './features';
import { validateLottie } from './validator';
import type { LottieAnimation, LottieAsset } from './types';

// ── Types ────────────────────────────────────────────────────────

export type Platform = 'android' | 'ios' | 'web';
export type IssueGroup = 'container' | 'animation' | 'mobile';
export type IssueSeverity = 'error' | 'warning' | 'info';
/** auto = fixed by "Fix & download"; option = fixed by an opt-in toggle; manual = needs the designer/developer */
export type FixKind = 'auto' | 'option' | 'manual' | 'none';
export type Verdict = 'ok' | 'warn' | 'fail' | 'unsupported';

export interface FixerIssue {
  id: string;
  group: IssueGroup;
  severity: IssueSeverity;
  title: string;
  message: string;
  platforms: Platform[];
  fix: FixKind;
  advice?: string;
}

export interface ImageInfo {
  path: string;
  name: string;
  bytes: number;
}

export interface LottieStats {
  version: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  frames: number | null;
  durationSeconds: number | null;
  layers: number;
  imageCount: number;
  imageBytes: number;
  largestImages: ImageInfo[];
}

export interface ExtraFile {
  name: string;
  data: Uint8Array;
}

export interface LottieDiagnosis {
  fileName: string;
  kind: 'lottie' | 'json';
  byteSize: number;
  /** The file can't be read or repaired at all */
  fatal?: string;
  zip?: ZipInspection;
  formatVersion?: '1' | '2';
  generator?: string;
  animationPaths: string[];
  primaryAnimationPath?: string;
  animation?: LottieAnimation;
  stats?: LottieStats;
  images: ImageInfo[];
  issues: FixerIssue[];
  features: FeatureFinding[];
  verdict: Record<Platform, Verdict>;
  /** Issues the default repair fixes */
  autoFixCount: number;
  /** v2 → v1 layout conversion is offered */
  canConvertToV1: boolean;
}

export interface RepairOptions {
  /** Rewrite a dotLottie v2 archive (a/, i/) as v1 (animations/, images/) for older players */
  toV1?: boolean;
  /** Image files supplied next to a JSON animation, bundled into images/ when referenced */
  extraFiles?: ExtraFile[];
}

export interface RepairVerification {
  /** No entry in the output has the data-descriptor flag */
  noDescriptors: boolean;
  /** Every local header matches the central directory */
  headersMatch: boolean;
  /** Every entry's bytes equal the original, apart from the intended changes listed */
  contentIdentical: boolean;
  /** The last .json entry Android reads is the main animation */
  androidReadsAnimation: boolean;
  /** Entries whose bytes were intentionally changed (BOM removed, manifest rebuilt) */
  modifiedEntries: string[];
}

export interface RepairResult {
  ok: boolean;
  error?: string;
  bytes?: Uint8Array;
  fileName: string;
  changes: string[];
  before: { bytes: number; entries: number };
  after: { bytes: number; entries: number };
  verification?: RepairVerification;
}

// ── Constants ────────────────────────────────────────────────────

const ALL: Platform[] = ['android', 'ios', 'web'];
const GENERATOR = 'Bharat Dev Tools Lottie Fixer';
/** Fixed timestamp so the same input always produces the same bytes */
const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
const ANDROID_IMAGE_EXT = /\.(png|webp|jpg|jpeg)/; // case-sensitive substring test, as lottie-android does
const STORE_EXT = /\.(png|jpe?g|webp|gif|mp3|wav|ogg|woff2?)$/i;
const ANIMATION_PATH = /^(animations|a)\/[^/]+\.json$/i;
const LARGE_IMAGE = 100 * 1024;
const LARGE_IMAGE_TOTAL = 300 * 1024;
const BOM = [0xef, 0xbb, 0xbf];

// ── Small helpers ────────────────────────────────────────────────

const utf8 = new TextDecoder('utf-8');
const encoder = new TextEncoder();

function hasBom(data: Uint8Array): boolean {
  return data.length >= 3 && data[0] === BOM[0] && data[1] === BOM[1] && data[2] === BOM[2];
}

function stripBom(data: Uint8Array): Uint8Array {
  return hasBom(data) ? data.subarray(3) : data;
}

function parseJson(data: Uint8Array): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(utf8.decode(stripBom(data))) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function normalizePath(name: string): string {
  let p = name.replace(/\\/g, '/');
  while (p.startsWith('./') || p.startsWith('/')) p = p.startsWith('./') ? p.slice(2) : p.slice(1);
  return p;
}

function basename(path: string): string {
  return path.split('/').pop() || path;
}

function idFromAnimationPath(path: string): string {
  return basename(path).replace(/\.json$/i, '');
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isLottieLike(value: unknown): value is LottieAnimation {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as LottieAnimation).layers);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** SHA-256 of the bytes as lowercase hex (Web Crypto, works in browsers and Node 18+). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Archive model shared by diagnose and repair ──────────────────

interface ArchiveFile {
  /** Name as stored in the zip */
  rawName: string;
  /** Normalised path (forward slashes, no leading ./ or /) */
  path: string;
  data: Uint8Array;
}

interface Archive {
  inspection: ZipInspection;
  files: ArchiveFile[];
  duplicates: string[];
}

function readArchive(bytes: Uint8Array): { ok: true; archive: Archive } | { ok: false; error: string; inspection?: ZipInspection } {
  const inspection = inspectZip(bytes);
  if (!inspection.ok) return { ok: false, error: inspection.error || 'This archive could not be read.', inspection };
  const unsupported = inspection.entries.find((e) => e.status === 'unsupported');
  if (unsupported) {
    return {
      ok: false,
      inspection,
      error: `"${unsupported.name}": ${unsupported.notes[0] || 'unsupported entry'}. Lottie players can't open this file; re-export it.`,
    };
  }
  const files: ArchiveFile[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const entry of inspection.entries) {
    if (entry.kind !== 'file') continue;
    const read = readEntry(bytes, entry);
    if (!read.ok || !read.data) return { ok: false, inspection, error: read.error || `"${entry.name}" could not be read.` };
    const path = normalizePath(entry.name);
    if (seen.has(path.toLowerCase())) {
      duplicates.push(path);
      continue;
    }
    seen.add(path.toLowerCase());
    files.push({ rawName: entry.name, path, data: read.data });
  }
  return { ok: true, archive: { inspection, files, duplicates } };
}

interface Layout {
  manifestFile?: ArchiveFile;
  manifest?: Record<string, unknown>;
  manifestError?: string;
  animations: ArchiveFile[];
  primary?: ArchiveFile;
  version: '1' | '2';
  images: ArchiveFile[];
  fonts: ArchiveFile[];
}

function readLayout(files: ArchiveFile[]): Layout {
  const manifestFile = files.find((f) => f.path.toLowerCase() === 'manifest.json');
  let manifest: Record<string, unknown> | undefined;
  let manifestError: string | undefined;
  if (manifestFile) {
    const parsed = parseJson(manifestFile.data);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
      manifest = parsed.value as Record<string, unknown>;
    } else {
      manifestError = parsed.ok ? 'manifest.json is not a JSON object' : parsed.error;
    }
  }

  let animations = files.filter((f) => ANIMATION_PATH.test(f.path));
  if (animations.length === 0) {
    // Hand-made archives: any root-level JSON that isn't the manifest
    animations = files.filter((f) => /^[^/]+\.json$/i.test(f.path) && f !== manifestFile);
  }

  const usesV2Folders = files.some((f) => /^(a|i|t|s|u)\//.test(f.path));
  const version: '1' | '2' = String(manifest?.version ?? '').startsWith('2') || usesV2Folders ? '2' : '1';

  // Main animation: v2 "initial", else the manifest's first animation, else the first file
  const byId = new Map(animations.map((f) => [idFromAnimationPath(f.path), f]));
  const initial = (manifest?.initial as { animation?: unknown } | undefined)?.animation;
  const listed = Array.isArray(manifest?.animations) ? (manifest.animations as { id?: unknown }[]) : [];
  const firstListed = listed.map((a) => (typeof a?.id === 'string' ? a.id : '')).find((id) => byId.has(id));
  const primary =
    (typeof initial === 'string' ? byId.get(initial) : undefined) ?? (firstListed ? byId.get(firstListed) : undefined) ?? animations[0];

  return {
    manifestFile,
    manifest,
    manifestError,
    animations,
    primary,
    version,
    images: files.filter((f) => IMAGE_EXT.test(f.path)),
    fonts: files.filter((f) => /\.(ttf|otf)$/i.test(f.path)),
  };
}

/** Entries lottie-android parses as an animation, in zip order (see LottieCompositionFactory). */
function androidJsonEntries(rawNames: string[]): string[] {
  return rawNames.filter(
    (n) => !n.includes('__MACOSX') && n.toLowerCase() !== 'manifest.json' && n.includes('.json')
  );
}

// ── Image checks (shared by .lottie and JSON) ────────────────────

function imageAssets(animation: LottieAnimation): LottieAsset[] {
  return (Array.isArray(animation.assets) ? animation.assets : []).filter(
    (a) => a && typeof a.p === 'string' && !Array.isArray(a.layers) && a.p.length > 0
  );
}

function isDataUri(p: string): boolean {
  return p.startsWith('data:');
}

// ── Diagnose ─────────────────────────────────────────────────────

const EMPTY_VERDICT: Record<Platform, Verdict> = { android: 'ok', ios: 'ok', web: 'ok' };

function finish(d: Omit<LottieDiagnosis, 'verdict' | 'autoFixCount'>): LottieDiagnosis {
  const verdict: Record<Platform, Verdict> = { ...EMPTY_VERDICT };
  if (d.fatal) {
    const unsupported = !!d.zip && (d.zip.zip64 || d.zip.entries.some((e) => e.status === 'unsupported'));
    const v: Verdict = unsupported ? 'unsupported' : 'fail';
    return { ...d, verdict: { android: v, ios: v, web: v }, autoFixCount: 0 };
  }
  for (const p of ALL) {
    const relevant = d.issues.filter((i) => i.platforms.includes(p));
    if (relevant.some((i) => i.severity === 'error')) verdict[p] = 'fail';
    else if (relevant.some((i) => i.severity === 'warning')) verdict[p] = 'warn';
  }
  return { ...d, verdict, autoFixCount: d.issues.filter((i) => i.fix === 'auto').length };
}

/**
 * Inspect a .lottie archive or Lottie JSON and list everything that will stop it
 * playing on Android, iOS or the web. Never throws.
 */
export function diagnoseLottie(bytes: Uint8Array, fileName: string, extraFiles: ExtraFile[] = []): LottieDiagnosis {
  try {
    return looksLikeZip(bytes) ? diagnoseArchive(bytes, fileName) : diagnoseJson(bytes, fileName, extraFiles);
  } catch (err) {
    return finish({
      fileName,
      kind: looksLikeZip(bytes) ? 'lottie' : 'json',
      byteSize: bytes.length,
      fatal: `Unexpected problem reading this file: ${(err as Error).message}`,
      animationPaths: [],
      images: [],
      issues: [],
      features: [],
      canConvertToV1: false,
    });
  }
}

function diagnoseArchive(bytes: Uint8Array, fileName: string): LottieDiagnosis {
  const base = {
    fileName,
    kind: 'lottie' as const,
    byteSize: bytes.length,
    animationPaths: [] as string[],
    images: [] as ImageInfo[],
    issues: [] as FixerIssue[],
    features: [] as FeatureFinding[],
    canConvertToV1: false,
  };
  const read = readArchive(bytes);
  if (!read.ok) return finish({ ...base, zip: read.inspection, fatal: read.error });

  const { inspection, files, duplicates } = read.archive;
  const issues: FixerIssue[] = [];
  const zip = summarizeZip(inspection);
  const layout = readLayout(files);
  const generator = typeof layout.manifest?.generator === 'string' ? layout.manifest.generator : undefined;

  // ── A. Container ──
  if (zip.androidBreaking > 0) {
    issues.push({
      id: 'zip-descriptor-stored',
      group: 'container',
      severity: 'error',
      title: generator === 'Figma' ? 'Figma zip format: Android cannot open this file' : 'Zip format Android cannot open',
      message: `${plural(zip.androidBreaking, 'entry', 'entries')} ${zip.androidBreaking === 1 ? 'is' : 'are'} stored uncompressed with the sizes written after the data (a "data descriptor"). Android's zip reader (java.util.zip.ZipInputStream, used by lottie-android and lottie-react-native) stops with "only DEFLATED entries can have EXT descriptor", so the animation never loads. Browsers and iOS read the zip index at the end of the file instead, which is why it works there.`,
      platforms: ['android'],
      fix: 'auto',
      advice: 'Fix & download re-packs the same files with the sizes in every header. Nothing inside the animation changes.',
    });
  }
  if (zip.androidRisky > 0) {
    issues.push({
      id: 'zip-descriptor-deflate',
      group: 'container',
      severity: 'warning',
      title: 'Non-standard zip headers',
      message: `${plural(zip.androidRisky, 'compressed entry', 'compressed entries')} ${zip.androidRisky === 1 ? 'has' : 'have'} the sizes written after the data instead of in the header. Android can read this, but it is an unusual format that some tools reject.`,
      platforms: ['android'],
      fix: 'auto',
    });
  }
  if (zip.mismatch > 0) {
    issues.push({
      id: 'zip-header-mismatch',
      group: 'container',
      severity: 'error',
      title: 'Zip headers disagree',
      message: `${plural(zip.mismatch, 'entry', 'entries')} ${zip.mismatch === 1 ? 'has' : 'have'} sizes or checksums in the header that don't match the zip index. Android reads the header and gets the wrong data.`,
      platforms: ['android'],
      fix: 'auto',
    });
  }
  if (zip.junk > 0) {
    issues.push({
      id: 'zip-junk',
      group: 'container',
      severity: 'info',
      title: 'Leftover system files',
      message: `${plural(zip.junk, 'file')} like __MACOSX/ or .DS_Store came from zipping on a Mac or Windows. Players ignore them, but they add size.`,
      platforms: [],
      fix: 'auto',
    });
  }
  if (zip.directories > 0) {
    issues.push({
      id: 'zip-directories',
      group: 'container',
      severity: 'info',
      title: 'Folder entries',
      message: `${plural(zip.directories, 'empty folder entry', 'empty folder entries')}. Harmless, and dropped by the fix.`,
      platforms: [],
      fix: 'auto',
    });
  }
  const backslashed = files.filter((f) => f.rawName.includes('\\') || f.rawName !== f.path);
  if (backslashed.length > 0) {
    issues.push({
      id: 'zip-paths',
      group: 'container',
      severity: 'warning',
      title: 'Windows-style paths',
      message: `${plural(backslashed.length, 'file')} ${backslashed.length === 1 ? 'uses' : 'use'} backslashes or a leading "./" in ${backslashed.length === 1 ? 'its' : 'their'} path (for example "${backslashed[0].rawName}"). dotLottie players look for "animations/…" and "images/…" with forward slashes and may not find them.`,
      platforms: ['ios', 'web'],
      fix: 'auto',
    });
  }
  if (duplicates.length > 0) {
    issues.push({
      id: 'zip-duplicates',
      group: 'container',
      severity: 'warning',
      title: 'Duplicate files',
      message: `${plural(duplicates.length, 'file')} appear${duplicates.length === 1 ? 's' : ''} twice (for example "${duplicates[0]}"). Players may pick either copy. The fix keeps the first one.`,
      platforms: ALL,
      fix: 'auto',
    });
  }

  const animationPaths = layout.animations.map((f) => f.path);

  if (layout.animations.length === 0) {
    return finish({
      ...base,
      zip: inspection,
      fatal: 'This archive has no animation JSON inside (expected animations/<name>.json). It is not a valid .lottie file.',
    });
  }

  // Manifest
  if (!layout.manifestFile) {
    issues.push({
      id: 'manifest-missing',
      group: 'container',
      severity: 'warning',
      title: 'manifest.json is missing',
      message: 'dotLottie players (LottieFiles, dotlottie-web, lottie-ios) read manifest.json to find the animation. Android ignores it.',
      platforms: ['ios', 'web'],
      fix: 'auto',
    });
  } else if (layout.manifestError) {
    issues.push({
      id: 'manifest-invalid',
      group: 'container',
      severity: 'error',
      title: 'manifest.json is broken',
      message: `manifest.json is not valid JSON (${layout.manifestError}). dotLottie players can't find the animation.`,
      platforms: ['ios', 'web'],
      fix: 'auto',
    });
  } else {
    if (layout.manifestFile.path !== 'manifest.json') {
      issues.push({
        id: 'manifest-name',
        group: 'container',
        severity: 'warning',
        title: 'Manifest file name has capitals',
        message: `The manifest is named "${layout.manifestFile.path}". Players look for "manifest.json" exactly.`,
        platforms: ['ios', 'web'],
        fix: 'auto',
      });
    }
    if (hasBom(layout.manifestFile.data)) {
      issues.push({
        id: 'manifest-bom',
        group: 'container',
        severity: 'warning',
        title: 'Hidden character at the start of manifest.json',
        message: 'manifest.json starts with a byte-order mark (BOM), which strict JSON readers reject.',
        platforms: ['ios', 'web'],
        fix: 'auto',
      });
    }
    const ids = new Set(layout.animations.map((f) => idFromAnimationPath(f.path)));
    const listed = Array.isArray(layout.manifest?.animations) ? (layout.manifest!.animations as { id?: unknown }[]) : null;
    const listedIds = (listed ?? []).map((a) => (typeof a?.id === 'string' ? a.id : ''));
    const broken = listedIds.filter((id) => !ids.has(id));
    if (!listed || listed.length === 0 || broken.length > 0) {
      issues.push({
        id: 'manifest-mismatch',
        group: 'container',
        severity: 'error',
        title: 'Manifest points to missing animations',
        message: !listed || listed.length === 0
          ? 'manifest.json does not list any animations, so dotLottie players have nothing to play.'
          : `manifest.json lists ${broken.map((id) => `"${id}"`).join(', ')}, but there is no matching file under animations/. dotLottie players show nothing.`,
        platforms: ['ios', 'web'],
        fix: 'auto',
      });
    }
  }

  // Which JSON does Android actually load? It parses every *.json entry and keeps the last.
  const rawNames = inspection.entries.map((e) => e.name);
  const androidJson = androidJsonEntries(rawNames);
  const primaryRaw = layout.primary?.rawName;
  const upperExt = layout.animations.filter((f) => !f.rawName.includes('.json'));
  if (upperExt.length > 0) {
    issues.push({
      id: 'json-ext-case',
      group: 'container',
      severity: androidJson.length === 0 ? 'error' : 'warning',
      title: 'Animation file extension in capitals',
      message: `"${upperExt[0].rawName}" ends in .JSON. lottie-android only looks for a lowercase ".json", so it ${androidJson.length === 0 ? 'finds no animation and fails with "Unable to parse composition"' : 'skips this animation'}.`,
      platforms: ['android'],
      fix: 'auto',
    });
  }
  const androidLast = androidJson[androidJson.length - 1];
  if (androidLast && primaryRaw && androidLast !== primaryRaw) {
    const lastPath = normalizePath(androidLast);
    const lastIsAnimation = ANIMATION_PATH.test(lastPath) || layout.animations.some((f) => f.rawName === androidLast);
    issues.push({
      id: lastIsAnimation ? 'android-wrong-animation' : 'android-json-order',
      group: 'container',
      severity: lastIsAnimation ? 'warning' : 'error',
      title: lastIsAnimation ? 'Android plays a different animation' : 'Android loads a theme or state machine as the animation',
      message: lastIsAnimation
        ? `This file has ${plural(layout.animations.length, 'animation')}. lottie-android reads every .json file in order and keeps the last one ("${lastPath}"), not the main animation from the manifest ("${layout.primary!.path}").`
        : `lottie-android reads every .json file in the archive as an animation and keeps the last one. Here that is "${lastPath}", which is not an animation, so Android fails with "Unable to parse composition".`,
      platforms: ['android'],
      fix: 'auto',
      advice: 'Fix & download puts the main animation last, so Android loads it. Other players use the manifest and are unaffected.',
    });
  }

  if (layout.version === '2') {
    issues.push({
      id: 'format-v2',
      group: 'container',
      severity: 'info',
      title: 'dotLottie v2 format',
      message:
        'This file uses the newer dotLottie v2 layout (a/, i/ folders). lottie-ios added v2 support in 4.5.2, so older iOS apps (and older lottie-react-native) can\'t open it.',
      platforms: ['ios'],
      fix: 'option',
      advice: 'Turn on "Convert to v1 layout" if your app uses an older Lottie version. Themes and state machines are dropped, since v1 has no place for them.',
    });
  }

  // ── B. Animation JSON ──
  const primary = layout.primary!;
  if (hasBom(primary.data)) {
    issues.push(bomIssue(primary.path));
  }
  const parsed = parseJson(primary.data);
  if (!parsed.ok || !isLottieLike(parsed.value)) {
    issues.push({
      id: 'json-invalid',
      group: 'animation',
      severity: 'error',
      title: 'Animation JSON is broken',
      message: parsed.ok
        ? `"${primary.path}" is JSON but not a Lottie animation (it has no "layers").`
        : `"${primary.path}" is not valid JSON: ${parsed.error}`,
      platforms: ALL,
      fix: 'manual',
      advice: 'Re-export the animation. This can\'t be repaired without guessing at the content.',
    });
    return finish({ ...base, zip: inspection, generator, formatVersion: layout.version, animationPaths, primaryAnimationPath: primary.path, issues, canConvertToV1: layout.version === '2' });
  }

  const animation = parsed.value;
  const images: ImageInfo[] = layout.images.map((f) => ({ path: f.path, name: basename(f.path), bytes: f.data.length }));
  issues.push(...validatorIssues(animation));
  issues.push(...archiveImageIssues(animation, layout, images));
  issues.push(...performanceIssues(animation, images));

  const bundledFonts = layout.fonts.map((f) => basename(f.path).split('.')[0]);
  const features = scanLottieFeatures(animation, { bundledFonts });
  issues.push(...featureIssues(features));

  return finish({
    ...base,
    zip: inspection,
    generator,
    formatVersion: layout.version,
    animationPaths,
    primaryAnimationPath: primary.path,
    animation,
    stats: computeStats(animation, images),
    images,
    issues,
    features,
    canConvertToV1: layout.version === '2',
  });
}

function diagnoseJson(bytes: Uint8Array, fileName: string, extraFiles: ExtraFile[]): LottieDiagnosis {
  const base = {
    fileName,
    kind: 'json' as const,
    byteSize: bytes.length,
    animationPaths: [] as string[],
    images: [] as ImageInfo[],
    issues: [] as FixerIssue[],
    features: [] as FeatureFinding[],
    canConvertToV1: false,
  };
  const text = utf8.decode(stripBom(bytes));
  if (/^\s*</.test(text)) {
    return finish({ ...base, fatal: 'This is a web page (HTML), not a Lottie file. Download the .json or .lottie file itself.' });
  }
  const parsed = parseJson(bytes);
  if (!parsed.ok) return finish({ ...base, fatal: `This is not valid JSON or a .lottie archive: ${parsed.error}` });
  if (!isLottieLike(parsed.value)) {
    return finish({ ...base, fatal: 'This JSON is not a Lottie animation: it has no "layers" array.' });
  }

  const animation = parsed.value;
  const issues: FixerIssue[] = [];
  if (hasBom(bytes)) issues.push(bomIssue(fileName));

  // External images: the JSON expects image files next to it
  const extraByName = new Map(extraFiles.map((f) => [basename(f.name), f]));
  const external = imageAssets(animation).filter((a) => !isDataUri(a.p!) && a.e !== 1);
  const supplied = external.filter((a) => extraByName.has(basename(a.p!)));
  const missing = external.filter((a) => !extraByName.has(basename(a.p!)));
  if (external.length > 0) {
    issues.push({
      id: 'json-external-images',
      group: 'animation',
      severity: missing.length > 0 ? 'warning' : 'info',
      title: missing.length > 0 ? 'Images are separate files' : 'Images will be bundled',
      message:
        missing.length > 0
          ? `This animation uses ${plural(external.length, 'image')} stored as separate files (for example "${external[0].p}"). Without them the images are blank. ${supplied.length > 0 ? `${supplied.length} of them were added; ` : ''}Missing: ${missing.slice(0, 5).map((a) => `"${a.p}"`).join(', ')}${missing.length > 5 ? '…' : ''}.`
          : `All ${plural(external.length, 'image')} the animation uses were added. Fix & download packs them into the .lottie.`,
      platforms: ALL,
      fix: missing.length > 0 ? 'manual' : 'auto',
      advice: missing.length > 0 ? 'Drop the image files together with the JSON, and the fix bundles them into one .lottie.' : undefined,
    });
  }

  issues.push({
    id: 'json-wrap',
    group: 'container',
    severity: 'info',
    title: 'Can be packed as .lottie',
    message: 'Fix & download wraps this JSON in a .lottie archive that Android, iOS and the web can all open. The animation JSON stays byte-for-byte the same.',
    platforms: [],
    fix: 'auto',
  });

  issues.push(...validatorIssues(animation));
  const images: ImageInfo[] = supplied.map((a) => {
    const f = extraByName.get(basename(a.p!))!;
    return { path: `images/${basename(a.p!)}`, name: basename(a.p!), bytes: f.data.length };
  });
  issues.push(...performanceIssues(animation, images));
  const features = scanLottieFeatures(animation);
  issues.push(...featureIssues(features));

  return finish({
    ...base,
    animationPaths: ['animations/animation.json'],
    primaryAnimationPath: 'animations/animation.json',
    animation,
    stats: computeStats(animation, images),
    images,
    issues,
    features,
  });
}

function bomIssue(path: string): FixerIssue {
  return {
    id: 'json-bom',
    group: 'animation',
    severity: 'error',
    title: 'Hidden character at the start of the JSON',
    message: `"${path}" starts with a byte-order mark (BOM). Many JSON readers fail on it with "Unexpected token … in JSON at position 0".`,
    platforms: ALL,
    fix: 'auto',
    advice: 'Fix & download removes the 3 invisible bytes. Nothing else in the JSON changes.',
  };
}

const SKIP_VALIDATOR = /^(expressions-detected|hidden-layers-detected|high-layer-count|asset-external-reference)/;

function validatorIssues(animation: LottieAnimation): FixerIssue[] {
  return validateLottie(animation)
    .issues.filter((i) => i.severity !== 'info' && !SKIP_VALIDATOR.test(i.id))
    .map((i) => ({
      id: `validator-${i.id}`,
      group: 'animation' as const,
      severity: i.severity,
      title: i.title,
      message: i.message,
      platforms: ALL,
      fix: 'manual' as const,
      advice: i.suggestion,
    }));
}

function archiveImageIssues(animation: LottieAnimation, layout: Layout, images: ImageInfo[]): FixerIssue[] {
  const issues: FixerIssue[] = [];
  const assets = imageAssets(animation);
  const embedded = assets.filter((a) => isDataUri(a.p!));
  const fileRefs = assets.filter((a) => !isDataUri(a.p!));
  const byName = new Map(images.map((i) => [i.name, i]));
  const byNameLower = new Map(images.map((i) => [i.name.toLowerCase(), i]));

  const missing = fileRefs.filter((a) => !byName.has(basename(a.p!)) && !byNameLower.has(basename(a.p!).toLowerCase()));
  if (missing.length > 0) {
    issues.push({
      id: 'image-missing',
      group: 'animation',
      severity: 'warning',
      title: 'Images missing from the file',
      message: `The animation uses ${plural(missing.length, 'image')} that ${missing.length === 1 ? 'is' : 'are'} not in the archive: ${missing.slice(0, 5).map((a) => `"${a.p}"`).join(', ')}${missing.length > 5 ? '…' : ''}. ${missing.length === 1 ? 'It shows' : 'They show'} blank on every platform.`,
      platforms: ALL,
      fix: 'manual',
      advice: 'Re-export with images included, or add them to the images/ folder.',
    });
  }

  // lottie-android matches asset "p" against the zip entry's file name exactly (case-sensitive).
  const withPath = fileRefs.filter((a) => a.p!.includes('/') && byName.has(basename(a.p!)));
  if (withPath.length > 0) {
    issues.push({
      id: 'image-path-android',
      group: 'animation',
      severity: 'warning',
      title: 'Image names include a folder',
      message: `${plural(withPath.length, 'image asset')} ${withPath.length === 1 ? 'has' : 'have'} a folder in ${withPath.length === 1 ? 'its' : 'their'} name (for example "${withPath[0].p}"). lottie-android matches images by file name only, so ${withPath.length === 1 ? 'it shows' : 'they show'} blank on Android.`,
      platforms: ['android'],
      fix: 'manual',
      advice: 'In the animation JSON, set each asset\'s "p" to just the file name and "u" to the folder.',
    });
  }

  const upper = images.filter((i) => IMAGE_EXT.test(i.name) && !ANDROID_IMAGE_EXT.test(i.name));
  if (upper.length > 0) {
    issues.push({
      id: 'image-ext-case',
      group: 'animation',
      severity: 'warning',
      title: 'Image extensions in capitals',
      message: `${plural(upper.length, 'image')} (for example "${upper[0].name}") ${upper.length === 1 ? 'has' : 'have'} an extension lottie-android doesn't recognise (it only reads lowercase .png, .webp, .jpg, .jpeg). ${upper.length === 1 ? 'It is' : 'They are'} skipped on Android and show blank.`,
      platforms: ['android'],
      fix: 'manual',
      advice: 'Rename the files with a lowercase extension and update "p" in the animation JSON to match, or re-export.',
    });
  }

  if (embedded.length > 0 && layout.images.length > 0) {
    issues.push({
      id: 'image-mixed',
      group: 'animation',
      severity: 'warning',
      title: 'Embedded and separate images mixed',
      message: `${plural(embedded.length, 'image')} ${embedded.length === 1 ? 'is' : 'are'} embedded in the JSON while others are separate files. lottie-android only decodes embedded images when the archive has no image files, so the embedded ones show blank on Android.`,
      platforms: ['android'],
      fix: 'manual',
      advice: 'Re-export with all images either embedded or all as separate files.',
    });
  }

  const referenced = new Set(fileRefs.map((a) => basename(a.p!)));
  const unused = images.filter((i) => !referenced.has(i.name));
  if (unused.length > 0 && fileRefs.length > 0) {
    issues.push({
      id: 'image-unused',
      group: 'animation',
      severity: 'info',
      title: 'Unused images',
      message: `${plural(unused.length, 'image file')} in the archive ${unused.length === 1 ? 'is' : 'are'} not used by the animation (for example "${unused[0].path}"). Android still decodes ${unused.length === 1 ? 'it' : 'them'} into memory.`,
      platforms: [],
      fix: 'none',
    });
  }
  return issues;
}

function performanceIssues(animation: LottieAnimation, images: ImageInfo[]): FixerIssue[] {
  const issues: FixerIssue[] = [];
  const embeddedBytes = imageAssets(animation)
    .filter((a) => isDataUri(a.p!))
    .reduce((sum, a) => sum + Math.round((a.p!.length - a.p!.indexOf(',') - 1) * 0.75), 0);
  const embeddedCount = imageAssets(animation).filter((a) => isDataUri(a.p!)).length;
  const count = images.length + embeddedCount;
  const total = images.reduce((s, i) => s + i.bytes, 0) + embeddedBytes;
  const large = images.filter((i) => i.bytes > LARGE_IMAGE);

  if (count > 0 && (large.length > 0 || total > LARGE_IMAGE_TOTAL)) {
    issues.push({
      id: 'perf-images',
      group: 'animation',
      severity: 'warning',
      title: 'Heavy images',
      message: `${plural(count, 'image')}, ${formatBytes(total)} in total${large.length > 0 ? `; ${plural(large.length, 'image')} over 100 KB (largest "${large.sort((a, b) => b.bytes - a.bytes)[0].name}", ${formatBytes(large[0].bytes)})` : ''}. Lottie draws images on the CPU, so this may stutter on low-end Android phones.`,
      platforms: ['android'],
      fix: 'manual',
      advice: 'Compress the PNGs (or use WebP), shrink them to the size they are shown at, or rebuild bitmap parts as shapes.',
    });
  } else if (count > 0) {
    issues.push({
      id: 'perf-image-count',
      group: 'animation',
      severity: 'info',
      title: `${plural(count, 'image')} in the animation`,
      message: 'lottie-android logs a warning for animations that use images: Lottie is designed mainly for vector shapes. Small images like these are usually fine.',
      platforms: [],
      fix: 'none',
    });
  }

  const w = typeof animation.w === 'number' ? animation.w : 0;
  const h = typeof animation.h === 'number' ? animation.h : 0;
  if (w > 0 && h / w >= 1.75) {
    issues.push({
      id: 'perf-tall-canvas',
      group: 'animation',
      severity: 'info',
      title: 'Tall portrait canvas',
      message: `The canvas is ${w}×${h}, a full phone screen. With resizeMode="cover" (or ScaleType CENTER_CROP) it is cropped at the top and bottom on tablets and foldables.`,
      platforms: [],
      fix: 'none',
      advice: 'Use resizeMode="contain", or ask for a version sized to the area it is shown in.',
    });
  }
  return issues;
}

function featureIssues(features: FeatureFinding[]): FixerIssue[] {
  return features.map((f) => ({
    id: `feature-${f.id}`,
    group: 'mobile' as const,
    severity: 'warning' as const,
    title: `${f.title} (${f.count})`,
    message: f.message,
    platforms: ALL.filter((p) => f.platforms[p] !== 'yes'),
    fix: 'manual' as const,
    advice: f.advice,
  }));
}

function computeStats(animation: LottieAnimation, images: ImageInfo[]): LottieStats {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fps = num(animation.fr);
  const ip = num(animation.ip);
  const op = num(animation.op);
  const frames = ip !== null && op !== null ? op - ip : null;
  const embedded = imageAssets(animation).filter((a) => isDataUri(a.p!));
  return {
    version: typeof animation.v === 'string' ? animation.v : null,
    width: num(animation.w),
    height: num(animation.h),
    fps,
    frames,
    durationSeconds: fps && frames !== null ? Math.round((frames / fps) * 100) / 100 : null,
    layers: Array.isArray(animation.layers) ? animation.layers.length : 0,
    imageCount: images.length + embedded.length,
    imageBytes: images.reduce((s, i) => s + i.bytes, 0),
    largestImages: [...images].sort((a, b) => b.bytes - a.bytes).slice(0, 3),
  };
}

// ── Repair ───────────────────────────────────────────────────────

interface OutFile {
  path: string;
  data: Uint8Array;
  /** Source bytes this entry must equal, unless `modified` */
  original: Uint8Array;
  modified: boolean;
}

/**
 * Re-pack a .lottie (or wrap a JSON) into a standard zip every Lottie player can read,
 * then verify the result. Never throws.
 */
export function repairLottie(bytes: Uint8Array, fileName: string, options: RepairOptions = {}): RepairResult {
  const outName = fileName.replace(/\.(json|zip|lottie)$/i, '') + '.lottie';
  const fail = (error: string, entries = 0): RepairResult => ({
    ok: false,
    error,
    fileName: outName,
    changes: [],
    before: { bytes: bytes.length, entries },
    after: { bytes: 0, entries: 0 },
  });

  try {
    const changes: string[] = [];
    let outFiles: OutFile[];
    let primaryPath: string;
    let beforeEntries: number;

    if (looksLikeZip(bytes)) {
      const read = readArchive(bytes);
      if (!read.ok) return fail(read.error);
      const { inspection, files, duplicates } = read.archive;
      beforeEntries = inspection.entries.length;
      const zip = summarizeZip(inspection);
      if (zip.androidBreaking + zip.androidRisky + zip.mismatch > 0) {
        changes.push('Re-packed every entry with real sizes and checksums in its header (no data descriptors)');
      }
      if (zip.junk > 0) changes.push(`Removed ${plural(zip.junk, 'system file')} (__MACOSX, .DS_Store)`);
      if (zip.directories > 0) changes.push(`Removed ${plural(zip.directories, 'folder entry', 'folder entries')}`);
      if (files.some((f) => f.rawName !== f.path)) changes.push('Changed backslash paths to forward slashes');
      if (duplicates.length > 0) changes.push(`Removed ${plural(duplicates.length, 'duplicate file')}`);

      const layout = readLayout(files);
      if (!layout.primary) return fail('This archive has no animation JSON inside, so there is nothing to repair.', beforeEntries);
      const parsedPrimary = parseJson(layout.primary.data);
      if (!parsedPrimary.ok || !isLottieLike(parsedPrimary.value)) {
        return fail('The animation JSON inside is broken. Re-export the animation; it cannot be repaired safely.', beforeEntries);
      }

      const toV1 = !!options.toV1 && layout.version === '2';
      const v1Path = (p: string) =>
        p.replace(/^a\//, 'animations/').replace(/^i\//, 'images/').replace(/^u\//, 'audio/');

      outFiles = [];
      for (const f of files) {
        if (f === layout.manifestFile) continue;
        if (toV1 && /^(t|s)\//.test(f.path)) continue;
        let path = toV1 ? v1Path(f.path) : f.path;
        const isAnimation = layout.animations.includes(f);
        if (isAnimation && !path.endsWith('.json')) path = path.replace(/\.json$/i, '.json');
        let data = f.data;
        let modified = false;
        if (/\.json$/i.test(path) && hasBom(data)) {
          data = stripBom(data);
          modified = true;
        }
        outFiles.push({ path, data, original: f.data, modified });
      }
      if (toV1) {
        const dropped = files.filter((f) => /^(t|s)\//.test(f.path)).length;
        changes.push(`Converted to the dotLottie v1 layout (animations/, images/)${dropped > 0 ? `; removed ${plural(dropped, 'theme/state machine file')} v1 can't hold` : ''}`);
      }
      if (layout.animations.some((f) => !f.rawName.includes('.json'))) changes.push('Lower-cased the .JSON extension of the animation file');
      if (outFiles.some((f) => f.modified)) changes.push('Removed the byte-order mark (BOM) from the start of the JSON');

      primaryPath = toV1 ? v1Path(layout.primary.path) : layout.primary.path;
      if (!primaryPath.endsWith('.json')) primaryPath = primaryPath.replace(/\.json$/i, '.json');

      // Manifest: keep the original bytes when they are already right
      const animationIds = layout.animations.map((f) => idFromAnimationPath(f.path));
      const rebuilt = buildManifest(layout, animationIds, toV1);
      if (rebuilt.unchanged && layout.manifestFile && layout.manifestFile.path === 'manifest.json' && !hasBom(layout.manifestFile.data)) {
        outFiles.unshift({ path: 'manifest.json', data: layout.manifestFile.data, original: layout.manifestFile.data, modified: false });
      } else {
        outFiles.unshift({ path: 'manifest.json', data: rebuilt.data, original: layout.manifestFile?.data ?? rebuilt.data, modified: true });
        changes.push(layout.manifestFile ? 'Rebuilt manifest.json so it matches the animations inside' : 'Added the missing manifest.json');
      }
    } else {
      // Lottie JSON: wrap it, bundling any supplied images it references
      const diagnosis = diagnoseJson(bytes, fileName, options.extraFiles ?? []);
      if (diagnosis.fatal || !diagnosis.animation) return fail(diagnosis.fatal || 'This file is not a Lottie animation.');
      beforeEntries = 1;
      const json = stripBom(bytes);
      primaryPath = 'animations/animation.json';
      const manifest = encoder.encode(
        JSON.stringify({ version: '1.0', generator: GENERATOR, animations: [{ id: 'animation' }] })
      );
      outFiles = [
        { path: 'manifest.json', data: manifest, original: manifest, modified: true },
        { path: primaryPath, data: json, original: bytes, modified: json !== bytes },
      ];
      changes.push('Packed the JSON into a .lottie archive (manifest.json + animations/animation.json)');
      if (json !== bytes) changes.push('Removed the byte-order mark (BOM) from the start of the JSON');
      const extraByName = new Map((options.extraFiles ?? []).map((f) => [basename(f.name), f]));
      const added = new Set<string>();
      for (const asset of imageAssets(diagnosis.animation)) {
        const name = basename(asset.p!);
        const file = extraByName.get(name);
        if (!file || isDataUri(asset.p!) || added.has(name)) continue;
        added.add(name);
        outFiles.push({ path: `images/${name}`, data: file.data, original: file.data, modified: false });
      }
      if (added.size > 0) changes.push(`Bundled ${plural(added.size, 'image')} into images/`);
    }

    // Order: manifest, other JSON, the main animation (last JSON, which lottie-android keeps), then the rest
    const isJson = (f: OutFile) => /\.json$/i.test(f.path);
    const manifestOut = outFiles.filter((f) => f.path === 'manifest.json');
    const otherJson = outFiles.filter((f) => isJson(f) && f.path !== 'manifest.json' && f.path !== primaryPath);
    const primaryOut = outFiles.filter((f) => f.path === primaryPath);
    const rest = outFiles.filter((f) => !isJson(f));
    const ordered = [...manifestOut, ...otherJson, ...primaryOut, ...rest];

    const zippable: Zippable = {};
    for (const f of ordered) {
      zippable[f.path] = [f.data, { level: STORE_EXT.test(f.path) ? 0 : 9, mtime: FIXED_MTIME }];
    }
    const out = zipSync(zippable);

    const verification = verifyRepair(out, ordered, primaryPath);
    if (!verification.ok) return fail(`Self-check failed after repacking (${verification.reason}). Nothing was changed.`, beforeEntries);

    return {
      ok: true,
      bytes: out,
      fileName: outName,
      changes,
      before: { bytes: bytes.length, entries: beforeEntries },
      after: { bytes: out.length, entries: ordered.length },
      verification: verification.result,
    };
  } catch (err) {
    return fail(`Unexpected problem while repairing: ${(err as Error).message}`);
  }
}

function buildManifest(layout: Layout, animationIds: string[], toV1: boolean): { data: Uint8Array; unchanged: boolean } {
  const existing = layout.manifest;
  const listed = Array.isArray(existing?.animations) ? (existing!.animations as Record<string, unknown>[]) : [];
  const kept = listed.filter((a) => a && typeof a.id === 'string' && animationIds.includes(a.id as string));
  const missing = animationIds.filter((id) => !kept.some((a) => a.id === id));
  const valid = !!existing && kept.length === listed.length && listed.length > 0;

  if (valid && !toV1) {
    // Listed animations all exist. Files not in the manifest are ignored by players, so leave it alone.
    return { data: layout.manifestFile!.data, unchanged: true };
  }

  const animations = [...kept, ...missing.map((id) => ({ id }))];
  let manifest: Record<string, unknown>;
  if (toV1) {
    manifest = {
      version: '1.0',
      generator: typeof existing?.generator === 'string' ? existing.generator : GENERATOR,
      animations: animations.map((a) => ({ id: a.id })),
    };
  } else {
    manifest = { ...(existing ?? {}), animations };
    if (!existing) {
      manifest = { version: layout.version === '2' ? '2' : '1.0', generator: GENERATOR, animations };
    }
    const initial = manifest.initial as { animation?: unknown } | undefined;
    if (initial && typeof initial.animation === 'string' && !animationIds.includes(initial.animation)) {
      manifest.initial = { ...initial, animation: animationIds[0] };
    }
  }
  return { data: encoder.encode(JSON.stringify(manifest)), unchanged: false };
}

function verifyRepair(
  out: Uint8Array,
  expected: OutFile[],
  primaryPath: string
): { ok: true; result: RepairVerification } | { ok: false; reason: string } {
  const inspection = inspectZip(out);
  if (!inspection.ok) return { ok: false, reason: inspection.error || 'output is not a readable zip' };

  const noDescriptors = inspection.entries.every((e) => !((e.local?.flag ?? 0) & FLAG_DATA_DESCRIPTOR));
  const headersMatch = inspection.entries.every((e) => e.status === 'ok');
  const storedSafe = inspection.entries.every(
    (e) => !(e.local && e.local.method === METHOD_STORED && e.local.flag & FLAG_DATA_DESCRIPTOR)
  );
  if (!noDescriptors || !storedSafe) return { ok: false, reason: 'data descriptors are still present' };
  if (!headersMatch) return { ok: false, reason: 'local headers do not match the zip index' };
  if (inspection.entries.length !== expected.length) return { ok: false, reason: 'entry count changed' };

  let contentIdentical = true;
  for (let i = 0; i < expected.length; i++) {
    const entry = inspection.entries[i];
    const want = expected[i];
    if (entry.name !== want.path) return { ok: false, reason: `entry order changed at "${want.path}"` };
    const read = readEntry(out, entry);
    if (!read.ok || !read.data || !bytesEqual(read.data, want.data)) return { ok: false, reason: `"${want.path}" did not round-trip` };
    if (!want.modified && !bytesEqual(want.data, want.original)) contentIdentical = false;
  }

  const androidJson = androidJsonEntries(inspection.entries.map((e) => e.name));
  const androidReadsAnimation = androidJson[androidJson.length - 1] === primaryPath;

  return {
    ok: true,
    result: {
      noDescriptors,
      headersMatch,
      contentIdentical,
      androidReadsAnimation,
      modifiedEntries: expected.filter((f) => f.modified).map((f) => f.path),
    },
  };
}
