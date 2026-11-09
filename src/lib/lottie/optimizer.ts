// src/lib/lottie/optimizer.ts — Conservative, opt-in Lottie optimization engine

import type {
  LottieAnimation,
  LottieOptimizationOptions,
  LottieOptimizationResult,
  LottieLayer,
} from './types';

export const DEFAULT_OPTIMIZATION_OPTIONS: LottieOptimizationOptions = {
  roundPrecision: 2,
  removeEditorNames: false,
  removeMarkers: false,
  removeHiddenLayers: false,
  removeMetadata: false,
  minifyWhitespace: true,
};

// Bodymovin properties where float precision rounding must NOT occur
// to protect framerates, keyframe timing, and layer hierarchy indices.
const PRESERVED_NUMERIC_KEYS = new Set(['fr', 'ip', 'op', 'st', 't', 'ind', 'parent', 'ty', 'ddd']);

/**
 * Recursively clone and round floating-point numbers in objects and arrays.
 * Only rounds non-integer numbers (e.g. 14.285714 -> 14.29).
 * Preserves integers, booleans, strings, nulls, and critical timing/index properties.
 */
function roundFloats(val: unknown, factor: number, key?: string): unknown {
  if (typeof val === 'number') {
    if (key && PRESERVED_NUMERIC_KEYS.has(key)) {
      return val;
    }
    if (!Number.isFinite(val) || Number.isInteger(val)) {
      return val;
    }
    return Math.round(val * factor) / factor;
  }

  if (Array.isArray(val)) {
    return val.map((item) => roundFloats(item, factor, key));
  }

  if (typeof val === 'object' && val !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = roundFloats(v, factor, k);
    }
    return out;
  }

  return val;
}

/**
 * Optimizes a Lottie animation payload safely based strictly on selected options.
 * The original object is cloned and never mutated directly.
 */
export function optimizeLottie(
  animation: LottieAnimation,
  options: Partial<LottieOptimizationOptions> = {}
): LottieOptimizationResult {
  const opts: LottieOptimizationOptions = {
    ...DEFAULT_OPTIMIZATION_OPTIONS,
    ...options,
  };

  // Deep clone to preserve the original untouched
  let clone: LottieAnimation = JSON.parse(JSON.stringify(animation));

  // 1. Optional Float Precision Truncation
  if (typeof opts.roundPrecision === 'number' && opts.roundPrecision >= 0) {
    const factor = Math.pow(10, opts.roundPrecision);
    clone = roundFloats(clone, factor) as LottieAnimation;
  }

  // 2. Optional Hidden Layer Stripping
  if (opts.removeHiddenLayers) {
    if (Array.isArray(clone.layers)) {
      clone.layers = filterHiddenLayers(clone.layers);
    }
    if (Array.isArray(clone.assets)) {
      clone.assets.forEach((asset) => {
        if (Array.isArray(asset.layers)) {
          asset.layers = filterHiddenLayers(asset.layers);
        }
      });
    }
  }

  // 3. Optional Editor Name Stripping
  if (opts.removeEditorNames) {
    stripPropertyRecursively(clone, 'nm');
  }

  // 4. Optional Markers Stripping
  if (opts.removeMarkers) {
    delete clone.markers;
  }

  // 5. Optional Metadata Stripping
  if (opts.removeMetadata) {
    delete clone.meta;
  }

  // Serialize output
  const originalJson = JSON.stringify(animation);
  const optimizedJson = opts.minifyWhitespace
    ? JSON.stringify(clone)
    : JSON.stringify(clone, null, 2);

  const originalSize = new TextEncoder().encode(originalJson).length;
  const optimizedSize = new TextEncoder().encode(optimizedJson).length;
  const savedBytes = Math.max(0, originalSize - optimizedSize);
  const savingsPercentage =
    originalSize > 0
      ? Math.round(((originalSize - optimizedSize) / originalSize) * 1000) / 10
      : 0;

  return {
    optimizedAnimation: clone,
    optimizedJson,
    originalSize,
    optimizedSize,
    savedBytes,
    savingsPercentage,
  };
}

function filterHiddenLayers(layers: LottieLayer[]): LottieLayer[] {
  // Identify parent layer indices that visible layers depend upon
  const parentIdsInUse = new Set<number>();
  layers.forEach((l) => {
    if (l.hd !== true && typeof l.parent === 'number') {
      parentIdsInUse.add(l.parent);
    }
  });

  return layers.filter((layer) => {
    if (layer.hd !== true) return true;
    // Retain hidden layer if it acts as a transform controller for a visible child layer
    if (typeof layer.ind === 'number' && parentIdsInUse.has(layer.ind)) {
      return true;
    }
    return false;
  });
}

function stripPropertyRecursively(val: unknown, propertyToStrip: string) {
  if (Array.isArray(val)) {
    val.forEach((item) => stripPropertyRecursively(item, propertyToStrip));
  } else if (typeof val === 'object' && val !== null) {
    const record = val as Record<string, unknown>;
    delete record[propertyToStrip];
    for (const v of Object.values(record)) {
      stripPropertyRecursively(v, propertyToStrip);
    }
  }
}

