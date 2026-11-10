// src/lib/lottie/parser.ts — Defensive Lottie JSON ingestion and metadata extraction

import type { LottieAnimation, LottieMetadata } from './types';

export interface LottieParseResult {
  success: boolean;
  animation?: LottieAnimation;
  metadata?: LottieMetadata;
  error?: string;
}

/**
 * Safely parse and inspect raw Lottie JSON.
 * Note: Per project guidelines, missing properties are explicitly flagged in
 * `missingProperties` and returned as `null` rather than invented synthetic defaults.
 */
export function parseLottieJSON(jsonString: string): LottieParseResult {
  if (!jsonString || typeof jsonString !== 'string' || !jsonString.trim()) {
    return {
      success: false,
      error: 'Empty animation payload. Please upload or paste a Lottie JSON file.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      error: `Malformed JSON: ${(err as Error).message}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      error: 'Invalid Lottie format: Root must be a JSON object, not an array or primitive.',
    };
  }

  const anim = parsed as LottieAnimation;
  const missingProperties: string[] = [];

  // Version check
  const version = typeof anim.v === 'string' && anim.v.trim() ? anim.v.trim() : null;
  if (!version) missingProperties.push('version (v)');

  // Framerate check
  const framerate = typeof anim.fr === 'number' && Number.isFinite(anim.fr) && anim.fr > 0 ? anim.fr : null;
  if (framerate === null) missingProperties.push('framerate (fr)');

  // In-point & Out-point check
  const inPoint = typeof anim.ip === 'number' && Number.isFinite(anim.ip) ? anim.ip : null;
  if (inPoint === null) missingProperties.push('in-point (ip)');

  const outPoint = typeof anim.op === 'number' && Number.isFinite(anim.op) ? anim.op : null;
  if (outPoint === null) missingProperties.push('out-point (op)');

  // Width & Height check
  const width = typeof anim.w === 'number' && Number.isFinite(anim.w) && anim.w > 0 ? anim.w : null;
  if (width === null) missingProperties.push('width (w)');

  const height = typeof anim.h === 'number' && Number.isFinite(anim.h) && anim.h > 0 ? anim.h : null;
  if (height === null) missingProperties.push('height (h)');

  // Layers array check
  if (!Array.isArray(anim.layers)) {
    missingProperties.push('layers array (layers)');
  }

  // Calculate total frames and duration if boundaries and framerate are valid
  let totalFrames: number | null = null;
  let durationSeconds: number | null = null;

  if (inPoint !== null && outPoint !== null && outPoint >= inPoint) {
    totalFrames = Math.round(outPoint - inPoint);
    if (framerate !== null && framerate > 0) {
      durationSeconds = Math.round((totalFrames / framerate) * 100) / 100;
    }
  }

  const name = typeof anim.nm === 'string' && anim.nm.trim() ? anim.nm.trim() : null;

  const metadata: LottieMetadata = {
    version,
    framerate,
    inPoint,
    outPoint,
    totalFrames,
    durationSeconds,
    width,
    height,
    name,
    missingProperties,
  };

  return {
    success: true,
    animation: anim,
    metadata,
  };
}

/**
 * Sanitizes external image asset references in a Lottie animation to guarantee
 * 100% offline privacy by preventing the SVG renderer from initiating unwanted
 * remote network or tracking requests. Replaces non-data-URI references with a
 * transparent 1x1 data GIF.
 */
export function sanitizeAnimationForPrivacy(animation: LottieAnimation): LottieAnimation {
  if (!Array.isArray(animation.assets)) return animation;
  const clone: LottieAnimation = JSON.parse(JSON.stringify(animation));
  if (Array.isArray(clone.assets)) {
    clone.assets.forEach((asset) => {
      if (asset && asset.p && !asset.p.startsWith('data:image/')) {
        asset.u = '';
        asset.p = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }
    });
  }
  return clone;
}

