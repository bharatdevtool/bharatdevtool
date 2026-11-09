import { describe, it, expect } from 'vitest';
import {
  isDotLottieBuffer,
  createDotLottie,
  extractDotLottie,
} from '@/lib/lottie/dotLottie';
import type { LottieAnimation } from '@/lib/lottie/types';
import { zipSync, strToU8 } from 'fflate';

const TEST_ANIMATION: LottieAnimation = {
  v: '5.7.0',
  fr: 60,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: 'DotLottie Test',
  layers: [
    {
      ind: 1,
      ty: 4,
      nm: 'Shape',
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
};

describe('dotLottie Engine', () => {
  it('detects ZIP / dotLottie magic header bytes correctly', () => {
    const validZipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(isDotLottieBuffer(validZipHeader)).toBe(true);

    const jsonHeader = new Uint8Array([0x7b, 0x22, 0x76, 0x22]); // '{"v"'
    expect(isDotLottieBuffer(jsonHeader)).toBe(false);

    expect(isDotLottieBuffer(new Uint8Array([]))).toBe(false);
  });

  it('packages an animation into a valid .lottie archive and extracts it back', () => {
    const dotLottieBytes = createDotLottie(TEST_ANIMATION, { id: 'spinner', author: 'BharatDev' });
    expect(isDotLottieBuffer(dotLottieBytes)).toBe(true);
    expect(dotLottieBytes.byteLength).toBeGreaterThan(50);

    const extracted = extractDotLottie(dotLottieBytes);
    expect(extracted.success).toBe(true);
    expect(extracted.animationId).toBe('spinner');
    expect(extracted.manifest?.author).toBe('BharatDev');
    expect(extracted.animation?.v).toBe('5.7.0');
    expect(extracted.animation?.w).toBe(400);
    expect(extracted.animation?.h).toBe(400);
    expect(extracted.animation?.layers?.length).toBe(1);
    expect(extracted.rawJson).toContain('"nm": "DotLottie Test"');
  });

  it('inlines bundled raster images from images/ folder into data URIs', () => {
    const animWithExternalImage: LottieAnimation = {
      ...TEST_ANIMATION,
      assets: [
        {
          id: 'image_0',
          w: 100,
          h: 100,
          u: 'images/',
          p: 'icon.png',
        },
      ],
    };

    // Construct a .lottie archive manually with bundled images/icon.png
    const fakePngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG signature
    const zipData = zipSync({
      'manifest.json': strToU8(JSON.stringify({ animations: [{ id: 'logo' }] })),
      'animations/logo.json': strToU8(JSON.stringify(animWithExternalImage)),
      'images/icon.png': fakePngBytes,
    });

    const result = extractDotLottie(zipData);
    expect(result.success).toBe(true);
    expect(result.inlinedImageCount).toBe(1);
    const asset = result.animation?.assets?.[0];
    expect(asset?.u).toBe('');
    expect(asset?.p?.startsWith('data:image/png;base64,')).toBe(true);
    expect(asset?.e).toBe(1);
  });

  it('gracefully reports errors on corrupt or non-lottie archives', () => {
    const invalidData = new Uint8Array([1, 2, 3, 4, 5]);
    const res = extractDotLottie(invalidData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('missing ZIP PK magic header');

    // Archive without animations
    const emptyZip = zipSync({
      'readme.txt': strToU8('no animations here'),
    });
    const emptyRes = extractDotLottie(emptyZip);
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.error).toContain('does not contain any animation JSON files');
  });

  it('handles Windows backslash paths and matches assets by ID when p is missing', () => {
    const animWithIdOnly: LottieAnimation = {
      ...TEST_ANIMATION,
      assets: [
        {
          id: 'avatar_img',
          w: 200,
          h: 200,
        },
      ],
    };

    const fakePng = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    const zipData = zipSync({
      'animations\\main.json': strToU8(JSON.stringify(animWithIdOnly)),
      'images\\avatar_img.png': fakePng,
    });

    const res = extractDotLottie(zipData);
    expect(res.success).toBe(true);
    expect(res.inlinedImageCount).toBe(1);
    expect(res.animation?.assets?.[0]?.p?.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('auto-discovers and registers unmapped bundled images and audio into animation.assets', () => {
    const pureAnim: LottieAnimation = {
      ...TEST_ANIMATION,
      // No assets declared initially
      assets: [],
    };

    const fakePng = new Uint8Array([137, 80, 78, 71, 10, 20]);
    const fakeMp3 = new Uint8Array([73, 68, 51, 3, 0, 0]); // ID3 signature
    const zipData = zipSync({
      'animations/simple.json': strToU8(JSON.stringify(pureAnim)),
      'images/photo.webp': fakePng,
      'audio/chime.mp3': fakeMp3,
    });

    const res = extractDotLottie(zipData);
    expect(res.success).toBe(true);
    expect(res.inlinedImageCount).toBe(2);
    expect(res.animation?.assets).toHaveLength(2);
    const photo = res.animation?.assets?.find((a) => a.id === 'photo');
    const chime = res.animation?.assets?.find((a) => a.id === 'chime');
    expect(photo?.p?.startsWith('data:image/webp;base64,')).toBe(true);
    expect(chime?.p?.startsWith('data:audio/mpeg;base64,')).toBe(true);
  });

  it('ignores dotLottie v2 theme JSON and picks the animation from a/', () => {
    const zipData = zipSync({
      'manifest.json': strToU8(JSON.stringify({ version: '2', animations: [] })),
      't/dark.json': strToU8(JSON.stringify({ rules: [] })),
      'a/main.json': strToU8(JSON.stringify(TEST_ANIMATION)),
    });

    const result = extractDotLottie(zipData);
    expect(result.success).toBe(true);
    expect(result.availableAnimationIds).toEqual(['main']);
    expect(result.animation?.layers).toEqual(TEST_ANIMATION.layers);
  });

  it('does not resolve an image by a partial file-name match', () => {
    const anim: LottieAnimation = {
      ...TEST_ANIMATION,
      assets: [{ id: 'img_0', w: 1, h: 1, u: 'images/', p: 'icon.png' }],
    };
    const zipData = zipSync({
      'animations/a.json': strToU8(JSON.stringify(anim)),
      'images/bigicon.png': new Uint8Array([137, 80, 78, 71]),
    });

    const result = extractDotLottie(zipData);
    const declared = result.animation?.assets?.find((a) => a.id === 'img_0');
    expect(declared?.p).toBe('icon.png');
  });
});
