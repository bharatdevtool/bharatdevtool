// src/lib/lottie/features.ts — Finds After Effects features that play in the browser
// but are missing or partial in the native mobile players (lottie-android, lottie-ios).
// Detection only: nothing here changes the animation. Pure functions, no DOM.

import type { LottieAnimation, LottieLayer } from './types';

export type Support = 'yes' | 'partial' | 'no';

export type FeatureId =
  | 'merge-paths'
  | 'expressions'
  | 'effects'
  | 'layer-styles'
  | 'blend-modes'
  | '3d-layers'
  | 'luma-mattes'
  | 'mask-modes'
  | 'text-fonts';

export interface FeatureFinding {
  id: FeatureId;
  title: string;
  count: number;
  platforms: { web: Support; ios: Support; android: Support };
  message: string;
  advice: string;
}

interface FeatureSpec {
  title: string;
  platforms: FeatureFinding['platforms'];
  message: string;
  advice: string;
}

const SPECS: Record<FeatureId, FeatureSpec> = {
  'merge-paths': {
    title: 'Merge paths',
    platforms: { web: 'partial', ios: 'partial', android: 'partial' },
    message: 'Android ignores merge paths unless the app turns them on, so merged shapes draw as separate, overlapping shapes.',
    advice:
      'Android: call enableMergePathsForKitKatAndAbove(true) on LottieAnimationView, or pass enableMergePathsAndroidForKitKatAndAbove to lottie-react-native. Or ask the designer to remove Merge Paths in After Effects.',
  },
  expressions: {
    title: 'Expressions',
    platforms: { web: 'partial', ios: 'no', android: 'no' },
    message: 'After Effects expressions are not run by lottie-android or lottie-ios. Those properties fall back to their keyframed value, so motion can freeze or jump.',
    advice: 'Ask the designer to bake expressions into keyframes (in After Effects: Animation > Keyframe Assistant > Convert Expression to Keyframes) before exporting.',
  },
  effects: {
    title: 'Layer effects',
    platforms: { web: 'partial', ios: 'partial', android: 'partial' },
    message: 'Most After Effects effects are skipped by Lottie players. Only a few (such as Fill, Tint, Drop Shadow and Gaussian Blur) are drawn, and support differs per platform.',
    advice: 'Check the animation on a real device. Replace unsupported effects with shapes, or pre-render that part as an image.',
  },
  'layer-styles': {
    title: 'Layer styles',
    platforms: { web: 'partial', ios: 'no', android: 'no' },
    message: 'Layer styles (drop shadow, stroke, glow from the Layer Styles menu) are not drawn by the native players.',
    advice: 'Recreate the style with shape layers, or remove it before exporting.',
  },
  'blend-modes': {
    title: 'Blend modes',
    platforms: { web: 'yes', ios: 'partial', android: 'partial' },
    message: 'Layers use blend modes other than Normal. Native players support only some of them, and on Android many need Android 10 or newer.',
    advice: 'If colours look wrong on a phone, switch these layers back to Normal and adjust colours or opacity instead.',
  },
  '3d-layers': {
    title: '3D layers',
    platforms: { web: 'partial', ios: 'partial', android: 'no' },
    message: '3D layers and cameras are not supported on Android, and only partly elsewhere. The layer is drawn flat or in the wrong place.',
    advice: 'Turn off the 3D switch on these layers and fake depth with 2D scale and position.',
  },
  'luma-mattes': {
    title: 'Luma mattes',
    platforms: { web: 'yes', ios: 'partial', android: 'partial' },
    message: 'Luma track mattes are slower and render inconsistently on mobile, especially in older player versions.',
    advice: 'Use alpha mattes where possible, keeping each matte layer directly above the layer it masks.',
  },
  'mask-modes': {
    title: 'Unsupported mask modes',
    platforms: { web: 'partial', ios: 'no', android: 'no' },
    message: 'Masks set to Lighten, Darken or Difference are not supported by the native players, so the mask is ignored or drawn as Add.',
    advice: 'Change these masks to Add, Subtract or Intersect.',
  },
  'text-fonts': {
    title: 'Text needs fonts',
    platforms: { web: 'partial', ios: 'partial', android: 'partial' },
    message: 'Text layers use fonts that are not embedded as glyphs. The app must ship the font files, or text falls back to a system font or does not draw.',
    advice:
      'Export with "Glyphs" enabled in the Bodymovin/LottieFiles settings, or ship the fonts (Android: assets/fonts/<Family>.ttf, or put the .ttf inside the .lottie).',
  },
};

const UNSUPPORTED_MASK_MODES = new Set(['l', 'd', 'f']);

export interface FeatureScanOptions {
  /** Font family names shipped inside the .lottie (file name without extension) */
  bundledFonts?: string[];
}

/** Walk the animation and report features with limited mobile support. */
export function scanLottieFeatures(animation: LottieAnimation, options: FeatureScanOptions = {}): FeatureFinding[] {
  const counts: Record<FeatureId, number> = {
    'merge-paths': 0,
    expressions: 0,
    effects: 0,
    'layer-styles': 0,
    'blend-modes': 0,
    '3d-layers': 0,
    'luma-mattes': 0,
    'mask-modes': 0,
    'text-fonts': 0,
  };

  const layerLists: LottieLayer[][] = [];
  if (Array.isArray(animation.layers)) layerLists.push(animation.layers);
  for (const asset of Array.isArray(animation.assets) ? animation.assets : []) {
    if (asset && Array.isArray(asset.layers)) layerLists.push(asset.layers);
  }

  let textLayers = 0;
  for (const layers of layerLists) {
    for (const layer of layers) {
      if (!layer || typeof layer !== 'object') continue;
      if (layer.ty === 5) textLayers++;
      if (layer.ddd === 1) counts['3d-layers']++;
      if (layer.ty === 13) counts['3d-layers']++; // camera
      if (typeof layer.bm === 'number' && layer.bm !== 0) counts['blend-modes']++;
      if (layer.tt === 3 || layer.tt === 4) counts['luma-mattes']++;
      if (Array.isArray(layer.ef) && layer.ef.length > 0) counts.effects++;
      if (Array.isArray(layer.sy) && layer.sy.length > 0) counts['layer-styles']++;
      if (Array.isArray(layer.masksProperties)) {
        for (const mask of layer.masksProperties as { mode?: unknown }[]) {
          if (mask && typeof mask.mode === 'string' && UNSUPPORTED_MASK_MODES.has(mask.mode)) counts['mask-modes']++;
        }
      }
      if (Array.isArray(layer.shapes)) counts['merge-paths'] += countMergePaths(layer.shapes);
    }
  }

  counts.expressions = countExpressions(animation);

  if (textLayers > 0) {
    const hasGlyphs = Array.isArray(animation.chars) && animation.chars.length > 0;
    if (!hasGlyphs) {
      const bundled = new Set(options.bundledFonts ?? []);
      const fonts = animation.fonts as { list?: { fFamily?: string }[] } | undefined;
      const families = (fonts?.list ?? []).map((f) => f?.fFamily).filter((f): f is string => !!f);
      const missing = families.length === 0 ? textLayers : families.filter((f) => !bundled.has(f)).length;
      if (missing > 0) counts['text-fonts'] = textLayers;
    }
  }

  return (Object.keys(counts) as FeatureId[])
    .filter((id) => counts[id] > 0)
    .map((id) => ({ id, count: counts[id], ...SPECS[id] }));
}

function countMergePaths(shapes: unknown[]): number {
  let n = 0;
  const stack: unknown[] = [...shapes];
  while (stack.length) {
    const shape = stack.pop() as { ty?: unknown; it?: unknown } | null;
    if (!shape || typeof shape !== 'object') continue;
    if (shape.ty === 'mm') n++;
    if (shape.ty === 'gr' && Array.isArray(shape.it)) stack.push(...shape.it);
  }
  return n;
}

/** Animated/static properties carry an expression as a string `x` next to their value `k`. */
function countExpressions(root: unknown): number {
  let n = 0;
  const stack: unknown[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (const item of node) if (item && typeof item === 'object') stack.push(item);
      continue;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.x === 'string' && obj.x.trim() && 'k' in obj) n++;
    for (const key in obj) {
      const value = obj[key];
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return n;
}
