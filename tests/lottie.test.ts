import { describe, it, expect } from 'vitest';
import { parseLottieJSON, sanitizeAnimationForPrivacy } from '@/lib/lottie/parser';
import { validateLottie } from '@/lib/lottie/validator';
import { analyzeLottie } from '@/lib/lottie/analyzer';
import { optimizeLottie } from '@/lib/lottie/optimizer';
import type { LottieAnimation } from '@/lib/lottie/types';

const SAMPLE_VALID_LOTTIE: LottieAnimation = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 120,
  w: 500,
  h: 500,
  nm: 'Sample Spinner',
  layers: [
    {
      ind: 1,
      ty: 4, // Shape
      nm: 'Circle',
      ip: 0,
      op: 120,
      st: 0,
      ks: {
        p: { a: 0, k: [250.123456, 250.789101, 0] },
      },
    },
    {
      ind: 2,
      ty: 3, // Null
      nm: 'Controller',
      parent: 1,
      ip: 0,
      op: 120,
      st: 0,
    },
  ],
};

describe('Lottie Parser', () => {
  it('parses a valid Lottie animation correctly with exact duration', () => {
    const raw = JSON.stringify(SAMPLE_VALID_LOTTIE);
    const result = parseLottieJSON(raw);

    expect(result.success).toBe(true);
    expect(result.metadata?.version).toBe('5.7.4');
    expect(result.metadata?.framerate).toBe(60);
    expect(result.metadata?.inPoint).toBe(0);
    expect(result.metadata?.outPoint).toBe(120);
    expect(result.metadata?.totalFrames).toBe(120);
    expect(result.metadata?.durationSeconds).toBe(2.0);
    expect(result.metadata?.width).toBe(500);
    expect(result.metadata?.height).toBe(500);
    expect(result.metadata?.missingProperties).toEqual([]);
  });

  it('does NOT invent synthetic fallbacks for missing properties and reports them explicitly', () => {
    // Missing w, h, fr
    const partialJson = JSON.stringify({
      v: '5.5.0',
      ip: 0,
      op: 60,
      layers: [],
    });
    const result = parseLottieJSON(partialJson);

    expect(result.success).toBe(true);
    expect(result.metadata?.width).toBeNull();
    expect(result.metadata?.height).toBeNull();
    expect(result.metadata?.framerate).toBeNull();
    expect(result.metadata?.durationSeconds).toBeNull(); // Cannot compute without framerate!
    expect(result.metadata?.missingProperties).toContain('width (w)');
    expect(result.metadata?.missingProperties).toContain('height (h)');
    expect(result.metadata?.missingProperties).toContain('framerate (fr)');
  });

  it('gracefully handles malformed or non-object JSON', () => {
    expect(parseLottieJSON('{bad json').success).toBe(false);
    expect(parseLottieJSON('["array"]').success).toBe(false);
    expect(parseLottieJSON('').success).toBe(false);
  });
});

describe('Lottie Validator', () => {
  it('passes validation for clean animation', () => {
    const res = validateLottie(SAMPLE_VALID_LOTTIE);
    expect(res.valid).toBe(true);
    expect(res.errorCount).toBe(0);
  });

  it('detects missing root properties as critical errors', () => {
    const invalid = { ip: 0, op: 30 };
    const res = validateLottie(invalid);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.id === 'missing-version')).toBe(true);
    expect(res.issues.some((i) => i.id === 'missing-width')).toBe(true);
    expect(res.issues.some((i) => i.id === 'missing-layers')).toBe(true);
  });

  it('detects reversed or zero frame ranges', () => {
    const reversed = { ...SAMPLE_VALID_LOTTIE, ip: 60, op: 30 };
    const res = validateLottie(reversed);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.id === 'invalid-frame-range')).toBe(true);
  });

  it('detects broken parent references', () => {
    const brokenParent: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        {
          ind: 1,
          ty: 4,
          parent: 999, // Does not exist!
          ip: 0,
          op: 60,
        },
      ],
    };
    const res = validateLottie(brokenParent);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.id.startsWith('missing-parent'))).toBe(true);
  });

  it('detects duplicate layer indices', () => {
    const duplicateInd: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        { ind: 1, ty: 4, ip: 0, op: 60 },
        { ind: 1, ty: 4, ip: 0, op: 60 }, // Duplicate!
      ],
    };
    const res = validateLottie(duplicateInd);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.id.startsWith('duplicate-layer-ind'))).toBe(true);
  });

  it('detects broken precomp and image asset references', () => {
    const brokenAssets: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      assets: [],
      layers: [
        { ind: 1, ty: 0, refId: 'comp_missing', ip: 0, op: 60 },
        { ind: 2, ty: 2, refId: 'img_missing', ip: 0, op: 60 },
      ],
    };
    const res = validateLottie(brokenAssets);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.id.startsWith('precomp-broken-refid'))).toBe(true);
    expect(res.issues.some((i) => i.id.startsWith('image-broken-refid'))).toBe(true);
  });

  it('flags externally referenced assets as warnings', () => {
    const externalAssetAnim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      assets: [
        { id: 'image_0', w: 100, h: 100, u: 'images/', p: 'logo.png' },
      ],
      layers: [
        { ind: 1, ty: 2, refId: 'image_0', ip: 0, op: 60 },
      ],
    };
    const res = validateLottie(externalAssetAnim);
    expect(res.valid).toBe(true); // Warning, not critical syntax error
    expect(res.warningCount).toBeGreaterThan(0);
    expect(res.issues.some((i) => i.id.startsWith('asset-external-reference'))).toBe(true);
  });

  it('flags hidden layers as performance warnings', () => {
    const withHidden: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        { ind: 1, ty: 4, hd: true, ip: 0, op: 60 },
      ],
    };
    const res = validateLottie(withHidden);
    expect(res.issues.some((i) => i.id === 'hidden-layers-detected')).toBe(true);
  });
});

describe('Lottie Analyzer', () => {
  it('correctly audits embedded raster assets and calculates byte weights', () => {
    // 1x1 transparent PNG base64
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const animWithAsset: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      assets: [
        { id: 'img_1', w: 1, h: 1, p: sampleBase64 },
      ],
    };

    const raw = JSON.stringify(animWithAsset);
    const result = analyzeLottie(animWithAsset, raw);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].isEmbedded).toBe(true);
    expect(result.assets[0].type).toBe('image-embedded');
    expect(result.assets[0].byteSize).toBeGreaterThan(0);
    expect(result.totalAssetBytes).toBeGreaterThan(0);
  });

  it('identifies external assets and creates an explicit warning', () => {
    const animWithExt: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      assets: [
        { id: 'img_ext', w: 200, h: 200, u: 'assets/img/', p: 'banner.png' },
      ],
    };

    const raw = JSON.stringify(animWithExt);
    const result = analyzeLottie(animWithExt, raw);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].isEmbedded).toBe(false);
    expect(result.assets[0].type).toBe('image-external');
    expect(result.assets[0].warning).toBeDefined();
    expect(result.assets[0].warning).toContain('is not embedded in the JSON payload');
  });

  it('accurately enumerates layer types', () => {
    const complexLayers: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        { ind: 1, ty: 4, ip: 0, op: 60 }, // Shape
        { ind: 2, ty: 4, ip: 0, op: 60 }, // Shape
        { ind: 3, ty: 1, ip: 0, op: 60 }, // Solid
        { ind: 4, ty: 3, ip: 0, op: 60 }, // Null
        { ind: 5, ty: 5, ip: 0, op: 60 }, // Text
        { ind: 6, ty: 4, hd: true, ip: 0, op: 60 }, // Hidden shape
      ],
    };

    const raw = JSON.stringify(complexLayers);
    const result = analyzeLottie(complexLayers, raw);

    expect(result.layerStats.total).toBe(6);
    expect(result.layerStats.shapes).toBe(3);
    expect(result.layerStats.solids).toBe(1);
    expect(result.layerStats.nulls).toBe(1);
    expect(result.layerStats.texts).toBe(1);
    expect(result.layerStats.hidden).toBe(1);
  });
});

describe('Lottie Optimizer', () => {
  it('conservatively truncates floating-point numbers without altering integers', () => {
    const anim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        {
          ind: 1,
          ty: 4,
          ip: 0,
          op: 120,
          ks: {
            p: { k: [14.2857142857, 100, 0.99999] },
          },
        },
      ],
    };

    const res = optimizeLottie(anim, { roundPrecision: 2 });
    const pos = (res.optimizedAnimation.layers?.[0].ks?.p as { k: number[] }).k;

    expect(pos[0]).toBe(14.29);
    expect(pos[1]).toBe(100); // Integer preserved!
    expect(pos[2]).toBe(1);
    expect(res.savedBytes).toBeGreaterThan(0);
    expect(res.savingsPercentage).toBeGreaterThan(0);
  });

  it('preserves the original input animation without mutation', () => {
    const originalPos = [14.2857142857, 100];
    const anim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        {
          ind: 1,
          ty: 4,
          ip: 0,
          op: 120,
          ks: { p: { k: originalPos } },
        },
      ],
    };

    optimizeLottie(anim, { roundPrecision: 2 });
    // Original must still have full precision
    expect((anim.layers?.[0].ks?.p as { k: number[] }).k[0]).toBe(14.2857142857);
  });

  it('optionally removes editor names (nm) when requested', () => {
    const anim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      nm: 'Root Name',
      layers: [
        { ind: 1, ty: 4, nm: 'Shape Name', ip: 0, op: 120 },
      ],
    };

    const res = optimizeLottie(anim, { removeEditorNames: true });
    expect(res.optimizedAnimation.nm).toBeUndefined();
    expect(res.optimizedAnimation.layers?.[0].nm).toBeUndefined();
  });

  it('optionally strips hidden layers when requested', () => {
    const anim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        { ind: 1, ty: 4, hd: true, ip: 0, op: 120 },
        { ind: 2, ty: 4, hd: false, ip: 0, op: 120 },
      ],
    };

    const res = optimizeLottie(anim, { removeHiddenLayers: true });
    expect(res.optimizedAnimation.layers?.length).toBe(1);
    expect(res.optimizedAnimation.layers?.[0].ind).toBe(2);
  });

  it('retains hidden layers that act as parent controllers for visible layers', () => {
    const anim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        // Layer 1 is hidden, but layer 2 parents to it
        { ind: 1, ty: 3, hd: true, nm: 'Controller', ip: 0, op: 120 },
        { ind: 2, ty: 4, hd: false, parent: 1, nm: 'Visual Child', ip: 0, op: 120 },
        // Layer 3 is hidden with NO dependents
        { ind: 3, ty: 4, hd: true, nm: 'Unused Hidden', ip: 0, op: 120 },
      ],
    };

    const res = optimizeLottie(anim, { removeHiddenLayers: true });
    expect(res.optimizedAnimation.layers?.length).toBe(2);
    expect(res.optimizedAnimation.layers?.some((l) => l.ind === 1)).toBe(true); // Controller preserved!
    expect(res.optimizedAnimation.layers?.some((l) => l.ind === 2)).toBe(true); // Visual child preserved!
    expect(res.optimizedAnimation.layers?.some((l) => l.ind === 3)).toBe(false); // Unused stripped!
  });

  it('never rounds critical framerates (fr), keyframe timestamps (t), or layer indices (ind, parent)', () => {
    const anim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      fr: 29.97003, // NTSC framerate float
      layers: [
        {
          ind: 1,
          parent: 0,
          ty: 4,
          ip: 0,
          op: 120,
          ks: {
            p: {
              a: 1,
              k: [
                { t: 14.5678, s: [10.123456, 20.654321] },
              ],
            },
          },
        },
      ],
    };

    const res = optimizeLottie(anim, { roundPrecision: 2 });
    // Root framerate must be exactly preserved
    expect(res.optimizedAnimation.fr).toBe(29.97003);
    // Keyframe timing t must be exactly preserved
    const kf = (res.optimizedAnimation.layers?.[0].ks?.p as { k: { t: number; s: number[] }[] }).k[0];
    expect(kf.t).toBe(14.5678);
    // Values inside s must be rounded
    expect(kf.s[0]).toBe(10.12);
    expect(kf.s[1]).toBe(20.65);
  });
});

describe('Lottie Precomposition Scoping & Privacy Sanitization', () => {
  it('scopes parent reference validation properly inside nested precompositions without false positives', () => {
    const animWithPrecomp: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      layers: [
        { ind: 1, ty: 0, refId: 'comp_1', ip: 0, op: 120 },
      ],
      assets: [
        {
          id: 'comp_1',
          layers: [
            // Layers inside precomposition have local indices ind: 1 and parent: 1
            { ind: 1, ty: 4, nm: 'Precomp Parent', ip: 0, op: 120 },
            { ind: 2, ty: 4, nm: 'Precomp Child', parent: 1, ip: 0, op: 120 },
          ],
        },
      ],
    };

    const res = validateLottie(animWithPrecomp);
    // Should NOT report broken parent reference because parent: 1 exists inside comp_1
    expect(res.valid).toBe(true);
    expect(res.issues.some((i) => i.id.startsWith('missing-parent'))).toBe(false);
  });

  it('sanitizes external asset URLs to 1x1 offline data URI to prevent network requests', () => {
    const untrustedAnim: LottieAnimation = {
      ...SAMPLE_VALID_LOTTIE,
      assets: [
        { id: 'img_1', u: 'https://tracker.analytics.com/', p: 'pixel.png' },
        { id: 'img_2', p: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
      ],
    };

    const sanitized = sanitizeAnimationForPrivacy(untrustedAnim);
    // Remote external asset URL replaced
    expect(sanitized.assets?.[0].u).toBe('');
    expect(sanitized.assets?.[0].p?.startsWith('data:image/gif')).toBe(true);
    // Inlined base64 asset preserved
    expect(sanitized.assets?.[1].p?.startsWith('data:image/png')).toBe(true);
  });
});

