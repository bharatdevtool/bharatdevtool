// src/lib/lottie/validator.ts — Comprehensive multi-tier Lottie validator engine

import type {
  LottieAnimation,
  LottieLayer,
  LottieAsset,
  ValidationIssue,
  ValidationResult,
} from './types';

export function validateLottie(animation: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!animation || typeof animation !== 'object' || Array.isArray(animation)) {
    issues.push({
      id: 'root-not-object',
      severity: 'error',
      category: 'schema',
      title: 'Invalid Root Structure',
      message: 'The Lottie payload must be a JSON object.',
      suggestion: 'Ensure you are uploading or pasting a standard Bodymovin JSON animation file.',
    });
    return summarizeIssues(issues);
  }

  const anim = animation as LottieAnimation;

  // ── 1. Root Schema Validation ──────────────────────────────────
  if (typeof anim.v !== 'string' || !anim.v.trim()) {
    issues.push({
      id: 'missing-version',
      severity: 'error',
      category: 'schema',
      title: 'Missing Bodymovin Version (v)',
      message: 'The animation root is missing the required "v" version identifier.',
      suggestion: 'Bodymovin version specifies renderer compatibility (e.g., "5.7.4").',
    });
  }

  if (typeof anim.fr !== 'number' || !Number.isFinite(anim.fr) || anim.fr <= 0) {
    issues.push({
      id: 'invalid-framerate',
      severity: 'error',
      category: 'schema',
      title: 'Missing or Invalid Framerate (fr)',
      message: `Framerate must be a positive finite number. Received: ${anim.fr}`,
      suggestion: 'Set a standard framerate such as 30 or 60 FPS.',
    });
  } else if (anim.fr > 60) {
    issues.push({
      id: 'high-framerate',
      severity: 'warning',
      category: 'performance',
      title: 'High Framerate (>60 FPS)',
      message: `Animation specifies ${anim.fr} FPS, which may cause performance issues or battery drain on mobile devices.`,
      suggestion: 'Standardize to 30 or 60 FPS for optimal cross-platform rendering.',
    });
  }

  if (typeof anim.ip !== 'number' || !Number.isFinite(anim.ip)) {
    issues.push({
      id: 'missing-ip',
      severity: 'error',
      category: 'schema',
      title: 'Missing or Invalid In-Point (ip)',
      message: 'Composition in-point frame "ip" must be a valid number.',
    });
  }

  if (typeof anim.op !== 'number' || !Number.isFinite(anim.op)) {
    issues.push({
      id: 'missing-op',
      severity: 'error',
      category: 'schema',
      title: 'Missing or Invalid Out-Point (op)',
      message: 'Composition out-point frame "op" must be a valid number.',
    });
  } else if (typeof anim.ip === 'number' && anim.op <= anim.ip) {
    issues.push({
      id: 'invalid-frame-range',
      severity: 'error',
      category: 'schema',
      title: 'Reversed or Zero Frame Range',
      message: `Out-point (${anim.op}) must be greater than in-point (${anim.ip}).`,
      suggestion: 'Ensure the animation has at least 1 playable frame.',
    });
  }

  if (typeof anim.w !== 'number' || !Number.isFinite(anim.w) || anim.w <= 0) {
    issues.push({
      id: 'missing-width',
      severity: 'error',
      category: 'schema',
      title: 'Missing or Invalid Composition Width (w)',
      message: `Width must be a positive integer. Received: ${anim.w}`,
      suggestion: 'Provide explicit composition dimensions (e.g. 500).',
    });
  }

  if (typeof anim.h !== 'number' || !Number.isFinite(anim.h) || anim.h <= 0) {
    issues.push({
      id: 'missing-height',
      severity: 'error',
      category: 'schema',
      title: 'Missing or Invalid Composition Height (h)',
      message: `Height must be a positive integer. Received: ${anim.h}`,
      suggestion: 'Provide explicit composition dimensions (e.g. 500).',
    });
  }

  if (!Array.isArray(anim.layers)) {
    issues.push({
      id: 'missing-layers',
      severity: 'error',
      category: 'schema',
      title: 'Missing Layers Array',
      message: 'The root animation object must contain a "layers" array.',
      suggestion: 'Every valid Bodymovin composition contains at least one layer.',
    });
    // Can't continue layer checks if layers is not an array
    return summarizeIssues(issues);
  }

  // ── 2. Asset Integrity Checks ──────────────────────────────────
  const assetMap = new Map<string, LottieAsset>();
  if (Array.isArray(anim.assets)) {
    anim.assets.forEach((asset, idx) => {
      if (!asset || typeof asset !== 'object') return;
      if (!asset.id) {
        issues.push({
          id: `asset-missing-id-${idx}`,
          severity: 'error',
          category: 'asset',
          title: `Asset Missing ID (Index ${idx})`,
          message: `Asset at index ${idx} is missing a required "id" attribute.`,
        });
        return;
      }
      assetMap.set(asset.id, asset);

      // Check image asset payloads
      if (asset.p) {
        if (asset.p.startsWith('data:image/')) {
          // Embedded base64 raster
          if (!asset.p.includes(';base64,')) {
            issues.push({
              id: `asset-malformed-base64-${asset.id}`,
              severity: 'error',
              category: 'asset',
              title: `Malformed Data URI in Asset "${asset.id}"`,
              message: 'Data URI does not contain valid Base64 encoding declaration.',
            });
          }
        } else {
          // Externally referenced asset
          issues.push({
            id: `asset-external-reference-${asset.id}`,
            severity: 'warning',
            category: 'asset',
            title: `External Asset Reference: "${asset.id}"`,
            message: `Asset "${asset.id}" references an external file (${asset.u || ''}${asset.p}). It cannot be rendered offline and must be served alongside the animation.`,
            suggestion: 'Consider inlining the image as a Base64 data URI to produce a standalone self-contained animation.',
          });
        }
      }
    });
  }

  // ── 3. Layer Hierarchy & Reference Integrity ────────────────────
  const layers = anim.layers;
  let hiddenLayerCount = 0;
  let hasExpressions = false;

  function inspectLayerTree(layerList: LottieLayer[], context: string) {
    const localIndices = new Set<number>();

    // Pass 1: Register and check unique layer indices within this composition scope
    layerList.forEach((layer) => {
      if (typeof layer.ind === 'number') {
        if (localIndices.has(layer.ind)) {
          issues.push({
            id: `duplicate-layer-ind-${context}-${layer.ind}`,
            severity: 'error',
            category: 'hierarchy',
            title: `Duplicate Layer Index (${layer.ind}) in ${context}`,
            message: `Multiple layers share the index "ind: ${layer.ind}". Layer indices must be unique within a composition.`,
            suggestion: 'Fix layer indices to prevent incorrect parenting and hierarchy lookups.',
          });
        } else {
          localIndices.add(layer.ind);
        }
      }
    });

    // Pass 2: Check parenting, precomps, assets, and properties
    layerList.forEach((layer, idx) => {
      const layerName = layer.nm || `Layer ${layer.ind ?? idx}`;
      const location = `${context} > "${layerName}"`;

      // Check parent references against the layers belonging to THIS composition
      if (typeof layer.parent === 'number') {
        if (!localIndices.has(layer.parent)) {
          issues.push({
            id: `missing-parent-${context}-${layer.ind ?? idx}`,
            severity: 'error',
            category: 'hierarchy',
            title: `Broken Parent Reference in "${layerName}"`,
            message: `Layer references parent index ${layer.parent}, but no layer with "ind: ${layer.parent}" exists in this composition.`,
            location,
            suggestion: 'Reassign or remove the invalid parent property.',
          });
        }
      }

      // Check precomposition asset references (ty === 0)
      if (layer.ty === 0) {
        if (!layer.refId) {
          issues.push({
            id: `precomp-missing-refid-${layer.ind ?? idx}`,
            severity: 'error',
            category: 'hierarchy',
            title: `Precomp Layer Missing "refId"`,
            message: `Precomposition layer "${layerName}" does not specify a "refId".`,
            location,
          });
        } else if (!assetMap.has(layer.refId)) {
          issues.push({
            id: `precomp-broken-refid-${layer.refId}`,
            severity: 'error',
            category: 'hierarchy',
            title: `Broken Precomposition Reference ("${layer.refId}")`,
            message: `Precomposition layer "${layerName}" references asset ID "${layer.refId}", which was not found in "assets[]".`,
            location,
            suggestion: 'Ensure the referenced precomposition exists in the assets collection.',
          });
        }
      }

      // Check image asset references (ty === 2)
      if (layer.ty === 2) {
        if (!layer.refId) {
          issues.push({
            id: `image-missing-refid-${layer.ind ?? idx}`,
            severity: 'error',
            category: 'asset',
            title: `Image Layer Missing "refId"`,
            message: `Image layer "${layerName}" does not specify an asset "refId".`,
            location,
          });
        } else if (!assetMap.has(layer.refId)) {
          issues.push({
            id: `image-broken-refid-${layer.refId}`,
            severity: 'error',
            category: 'asset',
            title: `Broken Image Asset Reference ("${layer.refId}")`,
            message: `Image layer "${layerName}" references asset ID "${layer.refId}", but no such asset exists in "assets[]".`,
            location,
            suggestion: 'Add the missing image asset to the assets list or remove the dangling layer.',
          });
        }
      }

      // Hidden layer check
      if (layer.hd === true) {
        hiddenLayerCount++;
      }

      // Check for expressions (JSON search on layer properties)
      if (!hasExpressions) {
        const str = JSON.stringify(layer);
        if (str.includes('"x"') && /"x"\s*:\s*"[^"]+"/.test(str)) {
          hasExpressions = true;
        }
      }
    });
  }

  inspectLayerTree(layers, 'Root');

  // Check nested precomposition layers inside assets
  assetMap.forEach((asset) => {
    if (Array.isArray(asset.layers)) {
      inspectLayerTree(asset.layers, `Precomp "${asset.id}"`);
    }
  });

  // ── 4. Performance & Best Practice Advisories ───────────────────
  if (hiddenLayerCount > 0) {
    issues.push({
      id: 'hidden-layers-detected',
      severity: 'warning',
      category: 'performance',
      title: `${hiddenLayerCount} Hidden / Disabled Layer(s) Detected`,
      message: `The composition contains ${hiddenLayerCount} hidden layers ("hd: true"). These layers still occupy memory and may slow down rendering on mobile devices.`,
      suggestion: 'Remove unneeded hidden layers in your authoring software or use the Lottie Optimizer.',
    });
  }

  if (hasExpressions) {
    issues.push({
      id: 'expressions-detected',
      severity: 'warning',
      category: 'performance',
      title: 'After Effects Expressions Detected',
      message: 'Animation contains expressions. Expressions often fail on mobile runtimes (iOS/Android) and require Javascript evaluation in web renderers.',
      suggestion: 'Bake keyframes before exporting to guarantee universal cross-platform support.',
    });
  }

  if (layers.length > 150) {
    issues.push({
      id: 'high-layer-count',
      severity: 'info',
      category: 'performance',
      title: `High Layer Count (${layers.length} Layers)`,
      message: `The animation contains ${layers.length} layers. High layer counts can impact battery life and frame rates on mobile devices.`,
      suggestion: 'Consider consolidating shape paths or breaking the animation into smaller sub-components.',
    });
  }

  return summarizeIssues(issues);
}

function summarizeIssues(issues: ValidationIssue[]): ValidationResult {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    valid: errorCount === 0,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    errorCount,
    warningCount,
    infoCount,
    issues,
  };
}

