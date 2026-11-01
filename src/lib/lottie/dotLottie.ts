// src/lib/lottie/dotLottie.ts — 100% Client-Side dotLottie (.lottie) Extraction & Packaging Engine

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { LottieAnimation } from './types';

export interface DotLottieManifestAnimation {
  id: string;
  speed?: number;
  themeColor?: string;
  loop?: boolean;
  direction?: number;
}

export interface DotLottieManifest {
  generator?: string;
  version?: string;
  author?: string;
  animations: DotLottieManifestAnimation[];
}

export interface DotLottieExtractionResult {
  success: boolean;
  animation?: LottieAnimation;
  rawJson?: string;
  manifest?: DotLottieManifest;
  animationId?: string;
  availableAnimationIds?: string[];
  inlinedImageCount: number;
  originalByteSize: number;
  error?: string;
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Checks if a buffer has the ZIP archive magic signature ('PK\x03\x04').
 */
export function isDotLottieBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 4) return false;
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // 'PK'
}

/**
 * Safely extracts a dotLottie (.lottie) file in-memory in the browser.
 * Inlines any bundled PNG/JPG images in `images/` as Base64 data URIs into
 * the animation's assets, making it completely self-contained and offline.
 */
export function extractDotLottie(
  data: ArrayBuffer | Uint8Array,
  targetAnimationId?: string
): DotLottieExtractionResult {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const originalByteSize = bytes.byteLength;

  if (!isDotLottieBuffer(bytes)) {
    return {
      success: false,
      inlinedImageCount: 0,
      originalByteSize,
      error: 'Not a valid .lottie archive (missing ZIP PK magic header).',
    };
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch (err) {
    return {
      success: false,
      inlinedImageCount: 0,
      originalByteSize,
      error: `Failed to decompress .lottie archive: ${(err as Error).message}`,
    };
  }

  // Find and parse manifest.json
  let manifest: DotLottieManifest | undefined;
  const manifestFile = Object.keys(unzipped).find(
    (p) => p.toLowerCase() === 'manifest.json' || p.toLowerCase().endsWith('/manifest.json')
  );
  if (manifestFile && unzipped[manifestFile]) {
    try {
      manifest = JSON.parse(strFromU8(unzipped[manifestFile]));
    } catch {
      // Manifest is optional or non-standard, continue
    }
  }

  // Locate all animation JSON files in archive
  const jsonFiles: Record<string, string> = {};
  for (const [filename] of Object.entries(unzipped)) {
    if (filename.toLowerCase().endsWith('.json') && !filename.toLowerCase().endsWith('manifest.json')) {
      const baseName = filename.split('/').pop()?.replace(/\.json$/i, '') || filename;
      jsonFiles[baseName] = filename;
    }
  }

  const availableAnimationIds = Object.keys(jsonFiles);
  if (availableAnimationIds.length === 0) {
    return {
      success: false,
      inlinedImageCount: 0,
      originalByteSize,
      error: 'The .lottie archive does not contain any animation JSON files in animations/ or root.',
    };
  }

  // Determine which animation to load:
  // 1. Requested targetAnimationId
  // 2. manifest.animations[0].id
  // 3. First discovered JSON file
  let chosenId = targetAnimationId;
  if (!chosenId || !jsonFiles[chosenId]) {
    if (manifest?.animations?.[0]?.id && jsonFiles[manifest.animations[0].id]) {
      chosenId = manifest.animations[0].id;
    } else {
      chosenId = availableAnimationIds[0];
    }
  }

  const chosenPath = jsonFiles[chosenId];
  let animation: LottieAnimation;
  try {
    animation = JSON.parse(strFromU8(unzipped[chosenPath]));
  } catch (err) {
    return {
      success: false,
      inlinedImageCount: 0,
      originalByteSize,
      error: `Failed to parse animation JSON ("${chosenPath}"): ${(err as Error).message}`,
    };
  }

  // Normalize unzipped archive file mapping (handle Windows backslashes and leading slashes)
  const normalizedArchive: Record<string, Uint8Array> = {};
  for (const [rawPath, content] of Object.entries(unzipped)) {
    const clean = rawPath.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
    normalizedArchive[clean] = content;
  }

  function findArchiveFile(candidates: string[]): { file: Uint8Array; filename: string } | null {
    for (const cand of candidates) {
      if (!cand) continue;
      const cleanCand = cand.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
      // 1. Direct match
      if (normalizedArchive[cleanCand]) {
        return { file: normalizedArchive[cleanCand], filename: cleanCand };
      }
      // 2. Ends-with match (e.g. cand is 'icon.png' and archive has 'images/icon.png')
      for (const [archPath, content] of Object.entries(normalizedArchive)) {
        if (archPath.endsWith(`/${cleanCand}`) || archPath.endsWith(cleanCand)) {
          return { file: content, filename: archPath };
        }
      }
    }
    return null;
  }

  // Ensure animation.assets is initialized as an array
  if (!Array.isArray(animation.assets)) {
    animation.assets = [];
  }

  // Inline images and audio from archive into the animation's assets[]
  let inlinedImageCount = 0;
  const matchedArchiveKeys = new Set<string>();

  // 1. Resolve existing assets declared in animation.assets
  animation.assets.forEach((asset) => {
    // If it's a precomposition (has layers), leave untouched
    if (Array.isArray(asset.layers)) return;

    // Already inlined Base64 data URI
    if (asset.p && asset.p.startsWith('data:')) return;

    const candidates: string[] = [];
    if (asset.p) {
      candidates.push(
        (asset.u || '') + asset.p,
        asset.p,
        `images/${asset.p}`,
        `audio/${asset.p}`,
        asset.p.split('/').pop() || asset.p
      );
    }
    if (asset.id) {
      candidates.push(
        asset.id,
        `images/${asset.id}`,
        `audio/${asset.id}`,
        `images/${asset.id}.png`,
        `images/${asset.id}.jpg`,
        `images/${asset.id}.jpeg`,
        `images/${asset.id}.webp`,
        `images/${asset.id}.svg`,
        `audio/${asset.id}.mp3`,
        `audio/${asset.id}.wav`,
        `${asset.id}.png`,
        `${asset.id}.jpg`,
        `${asset.id}.mp3`
      );
    }

    const matched = findArchiveFile(candidates);
    if (matched) {
      matchedArchiveKeys.add(matched.filename);
      const mime = getMimeType(matched.filename || asset.p || asset.id);
      const base64 = uint8ArrayToBase64(matched.file);
      asset.u = '';
      asset.p = `data:${mime};base64,${base64}`;
      asset.e = 1;
      inlinedImageCount++;
    }
  });

  // 2. Discover any bundled raster images or audio files in the ZIP archive (e.g. images/* or audio/*)
  // that were not explicitly listed in animation.assets, and auto-register them
  for (const [archPath, fileBytes] of Object.entries(normalizedArchive)) {
    if (matchedArchiveKeys.has(archPath)) continue;

    const isImage = archPath.startsWith('images/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(archPath);
    const isAudio = archPath.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a)$/i.test(archPath);

    if (isImage || isAudio) {
      const baseName = archPath.split('/').pop() || archPath;
      const baseId = baseName.replace(/\.[^/.]+$/, '');

      // Check if already present by ID or filename
      const alreadyExists = animation.assets.some((a) => a.id === baseId || a.id === baseName);
      if (!alreadyExists) {
        const mime = getMimeType(archPath);
        const base64 = uint8ArrayToBase64(fileBytes);
        animation.assets.push({
          id: baseId,
          w: 0,
          h: 0,
          u: '',
          p: `data:${mime};base64,${base64}`,
          e: 1,
        });
        inlinedImageCount++;
        matchedArchiveKeys.add(archPath);
      }
    }
  }

  const rawJson = JSON.stringify(animation, null, 2);

  return {
    success: true,
    animation,
    rawJson,
    manifest,
    animationId: chosenId,
    availableAnimationIds,
    inlinedImageCount,
    originalByteSize,
  };
}

/**
 * Packages a standard Lottie animation into a standard .lottie ZIP archive.
 */
export function createDotLottie(
  animation: LottieAnimation,
  options?: {
    id?: string;
    name?: string;
    author?: string;
    speed?: number;
    loop?: boolean;
    generator?: string;
  }
): Uint8Array {
  const animId = options?.id || 'animation_1';
  const animJson = JSON.stringify(animation);

  const manifest: DotLottieManifest = {
    generator: options?.generator || 'Bharat Dev Tools (bharatdevtool.com)',
    version: '1.0.0',
    author: options?.author || 'Bharat Dev Tools User',
    animations: [
      {
        id: animId,
        speed: options?.speed ?? 1,
        loop: options?.loop ?? true,
        direction: 1,
      },
    ],
  };

  const zipFiles: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    [`animations/${animId}.json`]: strToU8(animJson),
  };

  return zipSync(zipFiles, { level: 9 });
}

/**
 * Universal client-side file extractor: seamlessly loads either a standard
 * Bodymovin `.json` file OR a `.lottie` (dotLottie) ZIP archive.
 */
export async function extractLottieFromFile(file: File): Promise<{
  success: boolean;
  animation?: LottieAnimation;
  rawJson?: string;
  isDotLottie: boolean;
  inlinedImageCount: number;
  error?: string;
}> {
  if (file.size > 25 * 1024 * 1024) {
    return {
      success: false,
      isDotLottie: false,
      inlinedImageCount: 0,
      error: 'File size exceeds the 25MB browser limit.',
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({
        success: false,
        isDotLottie: false,
        inlinedImageCount: 0,
        error: 'Failed to read file from disk.',
      });
    };

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const uint8 = new Uint8Array(buffer);

      if (isDotLottieBuffer(uint8) || file.name.toLowerCase().endsWith('.lottie')) {
        const dotResult = extractDotLottie(uint8);
        if (!dotResult.success || !dotResult.animation) {
          resolve({
            success: false,
            isDotLottie: true,
            inlinedImageCount: 0,
            error: dotResult.error || 'Failed to extract .lottie archive.',
          });
          return;
        }
        resolve({
          success: true,
          animation: dotResult.animation,
          rawJson: dotResult.rawJson,
          isDotLottie: true,
          inlinedImageCount: dotResult.inlinedImageCount,
        });
      } else {
        // Standard JSON file
        const text = new TextDecoder('utf-8').decode(uint8);
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            resolve({
              success: false,
              isDotLottie: false,
              inlinedImageCount: 0,
              error: 'Invalid Lottie format: Root must be a JSON object.',
            });
            return;
          }
          resolve({
            success: true,
            animation: parsed as LottieAnimation,
            rawJson: text,
            isDotLottie: false,
            inlinedImageCount: 0,
          });
        } catch (err) {
          resolve({
            success: false,
            isDotLottie: false,
            inlinedImageCount: 0,
            error: `Malformed JSON: ${(err as Error).message}`,
          });
        }
      }
    };

    reader.readAsArrayBuffer(file);
  });
}
