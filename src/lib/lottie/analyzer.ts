// src/lib/lottie/analyzer.ts — Deep Lottie asset auditing and layer hierarchy analysis

import type {
  LottieAnimation,
  LottieAssetInfo,
  LottieLayerStats,
  LottieAnalysisResult,
  LottieLayer,
  LottieMetadata,
} from './types';
import { parseLottieJSON } from './parser';

export function analyzeLottie(
  animation: LottieAnimation,
  rawJsonString: string,
  providedMetadata?: LottieMetadata
): LottieAnalysisResult {
  const rawJsonBytes =
    typeof Blob !== 'undefined'
      ? new Blob([rawJsonString]).size
      : typeof Buffer !== 'undefined'
      ? Buffer.byteLength(rawJsonString, 'utf8')
      : rawJsonString.length;

  const metadata =
    providedMetadata ||
    parseLottieJSON(rawJsonString).metadata || {
      version: null,
      framerate: null,
      inPoint: null,
      outPoint: null,
      totalFrames: null,
      durationSeconds: null,
      width: null,
      height: null,
      name: null,
      missingProperties: ['Failed to read metadata'],
    };

  // ── Asset Auditing ──────────────────────────────────────────────
  const assetInfos: LottieAssetInfo[] = [];
  let totalAssetBytes = 0;

  if (Array.isArray(animation.assets)) {
    animation.assets.forEach((asset) => {
      if (!asset || typeof asset !== 'object') return;

      if (Array.isArray(asset.layers)) {
        // Precomposition asset
        assetInfos.push({
          id: asset.id,
          type: 'precomp',
          isEmbedded: true,
          warning: undefined,
        });
        return;
      }

      if (asset.p) {
        // Audio asset check (data:audio/ or audio file extensions)
        const isAudio =
          asset.p.startsWith('data:audio/') ||
          /\.(mp3|wav|ogg|aac|m4a)$/i.test(asset.p);

        if (isAudio) {
          const isEmbedded = asset.p.startsWith('data:audio/');
          let byteSize: number | undefined;
          if (isEmbedded) {
            const base64Content = asset.p.split(',')[1] || '';
            const padding = (base64Content.match(/=+$/) || [''])[0].length;
            byteSize = Math.max(0, Math.floor((base64Content.length * 3) / 4) - padding);
            totalAssetBytes += byteSize;
          }
          const fullPath = (asset.u || '') + asset.p;
          assetInfos.push({
            id: asset.id,
            type: 'audio',
            path: fullPath,
            isEmbedded,
            byteSize,
            warning: isEmbedded
              ? undefined
              : `External audio reference: file "${fullPath}" is not embedded in the JSON payload and must be hosted alongside the animation.`,
          });
          return;
        }

        // Image asset
        const isEmbedded = asset.p.startsWith('data:');
        if (isEmbedded) {
          // Estimate decoded byte size from Base64
          const base64Content = asset.p.split(',')[1] || '';
          const padding = (base64Content.match(/=+$/) || [''])[0].length;
          const byteSize = Math.max(0, Math.floor((base64Content.length * 3) / 4) - padding);
          totalAssetBytes += byteSize;

          assetInfos.push({
            id: asset.id,
            type: 'image-embedded',
            width: asset.w,
            height: asset.h,
            isEmbedded: true,
            byteSize,
            previewUrl: asset.p.startsWith('data:image/') || asset.p.startsWith('data:application/octet-stream') ? asset.p : undefined,
          });
        } else {
          // External reference
          const fullPath = (asset.u || '') + asset.p;
          assetInfos.push({
            id: asset.id,
            type: 'image-external',
            width: asset.w,
            height: asset.h,
            path: fullPath,
            isEmbedded: false,
            warning: `External asset reference: file "${fullPath}" is not embedded in the JSON payload and must be hosted alongside the animation.`,
          });
        }
        return;
      }

      assetInfos.push({
        id: asset.id || 'unknown',
        type: 'unknown',
        isEmbedded: false,
      });
    });
  }

  // ── Layer Hierarchy & Stats ─────────────────────────────────────
  let total = 0;
  let shapes = 0;
  let precomps = 0;
  let solids = 0;
  let images = 0;
  let texts = 0;
  let nulls = 0;
  let audios = 0;
  let hidden = 0;
  const hasExpressions =
    rawJsonString.includes('"x"') &&
    (/"x"\s*:\s*"[^"]+"/.test(rawJsonString) || /"x"\s*:\s*\[/.test(rawJsonString));
  let maxNestingDepth = 1;

  function countLayers(layers: LottieLayer[], currentDepth: number) {
    if (currentDepth > maxNestingDepth) {
      maxNestingDepth = currentDepth;
    }

    layers.forEach((layer) => {
      total++;
      if (layer.hd === true) hidden++;

      switch (layer.ty) {
        case 0:
          precomps++;
          break;
        case 1:
          solids++;
          break;
        case 2:
          images++;
          break;
        case 3:
          nulls++;
          break;
        case 4:
          shapes++;
          break;
        case 5:
          texts++;
          break;
        case 6:
          audios++;
          break;
        default:
          break;
      }
    });
  }

  if (Array.isArray(animation.layers)) {
    countLayers(animation.layers, 1);
  }

  // Also count layers inside precomposition assets
  if (Array.isArray(animation.assets)) {
    animation.assets.forEach((asset) => {
      if (Array.isArray(asset.layers)) {
        countLayers(asset.layers, 2);
      }
    });
  }

  const layerStats: LottieLayerStats = {
    total,
    shapes,
    precomps,
    solids,
    images,
    texts,
    nulls,
    audios,
    hidden,
    hasExpressions,
    maxNestingDepth,
  };

  const rasterPercentage =
    rawJsonBytes > 0
      ? Math.min(100, Math.round((totalAssetBytes / rawJsonBytes) * 1000) / 10)
      : 0;

  const hasAudio = audios > 0 || assetInfos.some((a) => a.type === 'audio');

  const isClean =
    metadata.missingProperties.length === 0 &&
    hidden === 0 &&
    !hasExpressions &&
    assetInfos.every((a) => !a.warning);

  return {
    metadata,
    layerStats,
    assets: assetInfos,
    totalAssetBytes,
    rawJsonBytes,
    rasterPercentage,
    hasAudio,
    isClean,
  };
}

