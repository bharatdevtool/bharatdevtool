import { describe, it, expect } from 'vitest';
import {
  lottieColorToHex,
  hexToLottieColor,
  extractLottieColors,
  replaceLottieColor,
} from '@/lib/lottie/colors';
import type { LottieAnimation } from '@/lib/lottie/types';

describe('Lottie Color Engine', () => {
  it('converts Lottie float array to hex and back accurately', () => {
    // Pure Orange: rgb(255, 128, 0)
    const orangeLottie = [1, 0.502, 0, 1];
    const hex = lottieColorToHex(orangeLottie);
    expect(hex).toBe('#FF8000');

    const backToLottie = hexToLottieColor('#FF8000');
    expect(backToLottie[0]).toBeCloseTo(1, 2);
    expect(backToLottie[1]).toBeCloseTo(0.502, 2);
    expect(backToLottie[2]).toBeCloseTo(0, 2);
    expect(backToLottie[3]).toBe(1);
  });

  it('extracts unique colors from shape fills, strokes, and solid layers', () => {
    const anim: LottieAnimation = {
      v: '5.7.0',
      fr: 60,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      layers: [
        {
          ind: 1,
          ty: 1, // Solid
          nm: 'Background Solid',
          sc: '#1E293B',
          ip: 0,
          op: 60,
          ks: {},
        },
        {
          ind: 2,
          ty: 4, // Shape
          nm: 'Circle Shape',
          ip: 0,
          op: 60,
          ks: {},
          shapes: [
            {
              ty: 'fl',
              c: { a: 0, k: [1, 0, 0, 1] }, // Red
            },
            {
              ty: 'st',
              c: { a: 0, k: [0, 0, 1, 1] }, // Blue
            },
          ],
        },
      ],
    };

    const colors = extractLottieColors(anim);
    expect(colors).toHaveLength(3);
    const hexes = colors.map((c) => c.hex);
    expect(hexes).toContain('#1E293B');
    expect(hexes).toContain('#FF0000');
    expect(hexes).toContain('#0000FF');
  });

  it('replaces a targeted color across all shapes cleanly', () => {
    const anim: LottieAnimation = {
      v: '5.7.0',
      fr: 60,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      layers: [
        {
          ind: 1,
          ty: 4,
          nm: 'Red Square',
          ip: 0,
          op: 60,
          ks: {},
          shapes: [
            {
              ty: 'fl',
              c: { a: 0, k: [1, 0, 0, 1] }, // Red
            },
          ],
        },
      ],
    };

    const { animation: updated, replacedCount } = replaceLottieColor(anim, '#FF0000', '#00FF00');
    expect(replacedCount).toBe(1);
    const colors = extractLottieColors(updated);
    expect(colors[0].hex).toBe('#00FF00');
  });

  it('extracts and replaces colors inside precompositions (assets)', () => {
    const anim: LottieAnimation = {
      v: '5.7.0',
      fr: 60,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      assets: [
        {
          id: 'precomp_1',
          layers: [
            {
              ind: 1,
              ty: 4,
              nm: 'Precomp Inner Shape',
              ip: 0,
              op: 60,
              ks: {},
              shapes: [
                {
                  ty: 'fl',
                  c: { a: 0, k: [0.8, 0.2, 0.5, 1] },
                },
              ],
            },
          ],
        },
      ],
      layers: [
        {
          ind: 1,
          ty: 0, // Precomp reference
          refId: 'precomp_1',
          nm: 'Precomp Layer',
          ip: 0,
          op: 60,
          ks: {},
        },
      ],
    };

    const colors = extractLottieColors(anim);
    expect(colors.length).toBeGreaterThan(0);
    const originalHex = colors[0].hex;

    const { animation: updated, replacedCount } = replaceLottieColor(anim, originalHex, '#123456');
    expect(replacedCount).toBe(1);
    const updatedColors = extractLottieColors(updated);
    expect(updatedColors[0].hex).toBe('#123456');
  });

  it('preserves alpha channel when replacing a color', () => {
    const anim: LottieAnimation = {
      v: '5.7.0',
      fr: 60,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      layers: [
        {
          ind: 1,
          ty: 4,
          nm: 'Semi-transparent fill',
          ip: 0,
          op: 60,
          ks: {},
          shapes: [
            {
              ty: 'fl',
              c: { a: 0, k: [1, 0, 0, 0.5] }, // 50% opacity
            },
          ],
        },
      ],
    };

    const { animation: updated } = replaceLottieColor(anim, '#FF0000', '#0000FF');
    const shape = (updated.layers?.[0].shapes?.[0] as { c: { k: number[] } });
    expect(shape.c.k[0]).toBe(0);
    expect(shape.c.k[1]).toBe(0);
    expect(shape.c.k[2]).toBe(1);
    expect(shape.c.k[3]).toBe(0.5); // alpha preserved
  });

  it('keeps the # prefix when replacing a solid layer color', () => {
    const anim: LottieAnimation = {
      v: '5.7.0',
      fr: 30,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      layers: [{ ind: 1, ty: 1, nm: 'Solid', sc: '#1e293b', ip: 0, op: 60, ks: {} }],
    };

    const { animation: updated, replacedCount } = replaceLottieColor(anim, '#1E293B', '#ff0000');
    expect(replacedCount).toBe(1);
    expect(updated.layers?.[0].sc).toBe('#FF0000');
  });
});
