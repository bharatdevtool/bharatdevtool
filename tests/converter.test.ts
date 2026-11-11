import { describe, it, expect } from 'vitest';
import {
  createDotLottie,
  extractDotLottie,
  isDotLottieBuffer,
} from '@/lib/lottie/dotLottie';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOTTIE_SAMPLES, parseLottieSample } from '@/lib/lottie/samples';

const readSample = (url: string) => new Uint8Array(readFileSync(join(process.cwd(), 'public', url)));
import type { LottieAnimation } from '@/lib/lottie/types';

describe('Lottie to dotLottie Converter Suite', () => {
  const sampleAnimation: LottieAnimation = {
    v: '5.7.0',
    fr: 60,
    ip: 0,
    op: 120,
    w: 500,
    h: 500,
    nm: 'Test Rocket',
    layers: [
      {
        ind: 1,
        ty: 4,
        nm: 'Body Shape',
        ip: 0,
        op: 120,
        ks: {},
        shapes: [
          {
            ty: 'fl',
            c: { a: 0, k: [1, 0.5, 0, 1] },
          },
        ],
      },
    ],
  };

  it('compresses a Lottie animation into a valid dotLottie ZIP archive', () => {
    const dotLottieBytes = createDotLottie(sampleAnimation, {
      id: 'rocket',
      loop: true,
      speed: 1.5,
      generator: 'Bharat Dev Tools',
    });

    expect(dotLottieBytes).toBeInstanceOf(Uint8Array);
    expect(isDotLottieBuffer(dotLottieBytes)).toBe(true);

    // ZIP header starts with 'PK\x03\x04'
    expect(dotLottieBytes[0]).toBe(0x50);
    expect(dotLottieBytes[1]).toBe(0x4b);
  });

  it('extracts and unpacks a dotLottie archive back to full Bodymovin JSON', () => {
    const dotLottieBytes = createDotLottie(sampleAnimation, {
      id: 'rocket',
      loop: false,
      speed: 1,
    });

    const extraction = extractDotLottie(dotLottieBytes);
    expect(extraction.success).toBe(true);
    expect(extraction.animation).toBeDefined();
    expect(extraction.animation?.v).toBe('5.7.0');
    expect(extraction.animation?.w).toBe(500);
    expect(extraction.animation?.h).toBe(500);
    expect(extraction.animation?.layers).toHaveLength(1);
    expect(extraction.animationId).toBe('rocket');
    expect(extraction.manifest?.animations[0].id).toBe('rocket');
  });

  it('achieves substantial compression reduction over raw JSON on standard animations', () => {
    const realAnimation = parseLottieSample(readSample(LOTTIE_SAMPLES[0].url)).animation;
    const rawJsonString = JSON.stringify(realAnimation, null, 2);
    const rawSize = new Blob([rawJsonString]).size;

    const dotLottieBytes = createDotLottie(realAnimation, { id: 'pulse' });
    const compressedSize = dotLottieBytes.byteLength;

    expect(compressedSize).toBeLessThan(rawSize * 0.7); // At least 30% reduction
  });

  it('returns clean error status for invalid archive data', () => {
    const invalidBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const extraction = extractDotLottie(invalidBytes);
    expect(extraction.success).toBe(false);
    expect(extraction.error).toBeDefined();
  });

  it('ships sample .lottie files that all open and have layers to play', () => {
    expect(LOTTIE_SAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const sample of LOTTIE_SAMPLES) {
      const { animation, rawJson } = parseLottieSample(readSample(sample.url));
      expect(animation.layers?.length, sample.id).toBeGreaterThan(0);
      expect((animation.op ?? 0) - (animation.ip ?? 0), sample.id).toBeGreaterThan(0);
      expect(JSON.parse(rawJson).w, sample.id).toBe(animation.w);
    }
  });

  it('inlines a sample\'s embedded images so it plays offline', () => {
    const { animation } = parseLottieSample(readSample('/samples/lottie/love-dancing.lottie'));
    const images = (animation.assets ?? []).filter((a) => typeof (a as { p?: string }).p === 'string' && (a as { p: string }).p.startsWith('data:image/'));
    expect(images.length).toBeGreaterThan(0);
  });
});
