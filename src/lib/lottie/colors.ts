// src/lib/lottie/colors.ts — Extract and manipulate colors in Lottie animations

import type { LottieAnimation } from './types';
import { hexToRgb } from '../color/utils';

export interface LottieColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  occurrences: number;
  layers: string[];
}

/**
 * Converts Lottie's 0-1 float array [r, g, b, a?] into a 6-character hex string (#RRGGBB).
 */
export function lottieColorToHex(colorArray: number[]): string {
  if (!Array.isArray(colorArray) || colorArray.length < 3) {
    return '#000000';
  }
  const r = Math.round(Math.max(0, Math.min(1, colorArray[0])) * 255);
  const g = Math.round(Math.max(0, Math.min(1, colorArray[1])) * 255);
  const b = Math.round(Math.max(0, Math.min(1, colorArray[2])) * 255);

  const toHex = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts a hex string (#RRGGBB) to Lottie's 0-1 float array [r, g, b, 1].
 */
export function hexToLottieColor(hex: string, preserveAlpha = 1): number[] {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return [0, 0, 0, 1];
  }
  const round = (num: number) => Math.round(num * 1000) / 1000;
  return [
    round(rgb.r / 255),
    round(rgb.g / 255),
    round(rgb.b / 255),
    preserveAlpha,
  ];
}

/**
 * Checks if a color array roughly matches another within float rounding tolerance.
 */
function isColorMatch(c1: number[], targetHex: string): boolean {
  if (!Array.isArray(c1) || c1.length < 3) return false;
  return lottieColorToHex(c1).toLowerCase() === targetHex.toLowerCase();
}

/**
 * Traverses all shapes and layers to extract unique colors from an animation.
 */
export function extractLottieColors(animation: LottieAnimation): LottieColorInfo[] {
  if (!animation || typeof animation !== 'object') return [];

  const colorMap = new Map<string, { occurrences: number; layers: Set<string> }>();

  function registerColor(c: number[], layerName: string) {
    if (!Array.isArray(c) || c.length < 3) return;
    const hex = lottieColorToHex(c);
    const existing = colorMap.get(hex);
    if (existing) {
      existing.occurrences++;
      existing.layers.add(layerName);
    } else {
      colorMap.set(hex, {
        occurrences: 1,
        layers: new Set([layerName]),
      });
    }
  }

  function inspectShape(shape: any, layerName: string) {
    if (!shape || typeof shape !== 'object') return;

    // Fill ('fl') or Stroke ('st') color
    if ((shape.ty === 'fl' || shape.ty === 'st') && shape.c) {
      if (Array.isArray(shape.c.k)) {
        if (typeof shape.c.k[0] === 'number') {
          // Static color [r, g, b, 1]
          registerColor(shape.c.k, layerName);
        } else {
          // Animated keyframes
          shape.c.k.forEach((kf: any) => {
            if (Array.isArray(kf.s)) registerColor(kf.s, layerName);
            if (Array.isArray(kf.e)) registerColor(kf.e, layerName);
          });
        }
      }
    }

    // Nested groups ('gr')
    if (shape.ty === 'gr' && Array.isArray(shape.it)) {
      shape.it.forEach((item: any) => inspectShape(item, layerName));
    }
  }

  function inspectLayer(layer: any) {
    if (!layer || typeof layer !== 'object') return;
    const layerName = layer.nm || `Layer ${layer.ind ?? '?'}`;

    // Solid layer color ('sc')
    if (layer.ty === 1 && typeof layer.sc === 'string') {
      const hex = layer.sc.startsWith('#') ? layer.sc.toUpperCase() : `#${layer.sc.toUpperCase()}`;
      const existing = colorMap.get(hex);
      if (existing) {
        existing.occurrences++;
        existing.layers.add(layerName);
      } else {
        colorMap.set(hex, { occurrences: 1, layers: new Set([layerName]) });
      }
    }

    // Shape layers ('ty: 4')
    if (Array.isArray(layer.shapes)) {
      layer.shapes.forEach((s: any) => inspectShape(s, layerName));
    }
  }

  // Root layers
  if (Array.isArray(animation.layers)) {
    animation.layers.forEach(inspectLayer);
  }

  // Precomposition layers
  if (Array.isArray(animation.assets)) {
    animation.assets.forEach((asset) => {
      if (Array.isArray(asset.layers)) {
        asset.layers.forEach(inspectLayer);
      }
    });
  }

  // Sort by occurrence count descending
  return Array.from(colorMap.entries())
    .map(([hex, data]) => {
      const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
      return {
        hex,
        rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
        occurrences: data.occurrences,
        layers: Array.from(data.layers),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Replaces all occurrences of a specific color across all fills, strokes, and solids.
 */
export function replaceLottieColor(
  animation: LottieAnimation,
  targetHex: string,
  newHex: string
): { animation: LottieAnimation; replacedCount: number } {
  if (!animation || typeof animation !== 'object') {
    return { animation, replacedCount: 0 };
  }

  const cloned: LottieAnimation = JSON.parse(JSON.stringify(animation));
  let replacedCount = 0;

  function replaceInShape(shape: any) {
    if (!shape || typeof shape !== 'object') return;

    if ((shape.ty === 'fl' || shape.ty === 'st') && shape.c) {
      if (Array.isArray(shape.c.k)) {
        if (typeof shape.c.k[0] === 'number') {
          if (isColorMatch(shape.c.k, targetHex)) {
            const alpha = shape.c.k[3] ?? 1;
            shape.c.k = hexToLottieColor(newHex, alpha);
            replacedCount++;
          }
        } else {
          // Keyframed
          shape.c.k.forEach((kf: any) => {
            if (Array.isArray(kf.s) && isColorMatch(kf.s, targetHex)) {
              const alpha = kf.s[3] ?? 1;
              kf.s = hexToLottieColor(newHex, alpha);
              replacedCount++;
            }
            if (Array.isArray(kf.e) && isColorMatch(kf.e, targetHex)) {
              const alpha = kf.e[3] ?? 1;
              kf.e = hexToLottieColor(newHex, alpha);
              replacedCount++;
            }
          });
        }
      }
    }

    if (shape.ty === 'gr' && Array.isArray(shape.it)) {
      shape.it.forEach(replaceInShape);
    }
  }

  function replaceInLayer(layer: any) {
    if (!layer || typeof layer !== 'object') return;

    if (layer.ty === 1 && typeof layer.sc === 'string') {
      const currentHex = layer.sc.startsWith('#') ? layer.sc : `#${layer.sc}`;
      if (currentHex.toLowerCase() === targetHex.toLowerCase()) {
        layer.sc = newHex.replace('#', '').toUpperCase();
        replacedCount++;
      }
    }

    if (Array.isArray(layer.shapes)) {
      layer.shapes.forEach(replaceInShape);
    }
  }

  if (Array.isArray(cloned.layers)) {
    cloned.layers.forEach(replaceInLayer);
  }

  if (Array.isArray(cloned.assets)) {
    cloned.assets.forEach((asset) => {
      if (Array.isArray(asset.layers)) {
        asset.layers.forEach(replaceInLayer);
      }
    });
  }

  return { animation: cloned, replacedCount };
}

