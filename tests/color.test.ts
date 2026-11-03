import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  getComplementary,
  generateLighterShades,
  generateDarkerShades,
  contrastRatio,
  formatHex,
  formatRgb,
  formatHsl,
} from '@/lib/color/utils';

describe('Color Converter & Palette Utilities', () => {
  describe('hexToRgb', () => {
    it('parses 6-character hex colors', () => {
      const rgb = hexToRgb('#ff5733');
      expect(rgb).toEqual({ r: 255, g: 87, b: 51, a: 255 });
    });

    it('parses 3-character hex shorthand', () => {
      const rgb = hexToRgb('#f00');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('parses 8-character hex with alpha', () => {
      const rgb = hexToRgb('#ff573380');
      expect(rgb).toEqual({ r: 255, g: 87, b: 51, a: 128 });
    });

    it('returns null on invalid hex strings', () => {
      expect(hexToRgb('not-a-color')).toBeNull();
      expect(hexToRgb('#12')).toBeNull();
      expect(hexToRgb('')).toBeNull();
    });
  });

  describe('rgbToHex & clamping', () => {
    it('converts RGB object to standard 6-character hex', () => {
      expect(rgbToHex({ r: 255, g: 87, b: 51 })).toBe('#ff5733');
      expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    });

    it('clamps values below 0 or above 255', () => {
      expect(rgbToHex({ r: 300, g: -20, b: 128 })).toBe('#ff0080');
    });

    it('includes alpha hex when alpha is not 255', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0, a: 128 })).toBe('#ff000080');
    });
  });

  describe('HSL Conversions', () => {
    it('converts RGB to HSL correctly', () => {
      const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('converts HSL to RGB correctly', () => {
      const rgb = hslToRgb({ h: 0, s: 100, l: 50 });
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('wraps hue angles 360 and 0 identically', () => {
      const rgb1 = hslToRgb({ h: 360, s: 100, l: 50 });
      const rgb2 = hslToRgb({ h: 0, s: 100, l: 50 });
      expect(rgb1.r).toBe(rgb2.r);
      expect(rgb1.g).toBe(rgb2.g);
      expect(rgb1.b).toBe(rgb2.b);
    });

    it('handles zero saturation (grayscale)', () => {
      const rgb = hslToRgb({ h: 0, s: 0, l: 50 });
      expect(rgb.r).toBe(rgb.g);
      expect(rgb.g).toBe(rgb.b);
    });

    it('handles maximum lightness (pure white) and minimum lightness (pure black)', () => {
      const white = hslToRgb({ h: 120, s: 50, l: 100 });
      expect(white.r).toBe(255);
      expect(white.g).toBe(255);
      expect(white.b).toBe(255);

      const black = hslToRgb({ h: 240, s: 80, l: 0 });
      expect(black.r).toBe(0);
      expect(black.g).toBe(0);
      expect(black.b).toBe(0);
    });
  });

  describe('Palette & Complementary Colors', () => {
    it('generates complementary color rotated by 180 degrees', () => {
      // Red complementary is Cyan
      const comp = getComplementary('#ff0000');
      expect(comp.toLowerCase()).toBe('#00ffff');
    });

    it('generates lighter shades with increasing lightness', () => {
      const shades = generateLighterShades('#ff5733', 4);
      expect(shades.length).toBe(4);
    });

    it('generates darker shades with decreasing lightness', () => {
      const shades = generateDarkerShades('#ff5733', 4);
      expect(shades.length).toBe(4);
    });
  });

  describe('contrastRatio & WCAG calculations', () => {
    it('calculates maximum contrast ratio (~21:1) between pure white and pure black', () => {
      const ratio = contrastRatio('#ffffff', '#000000');
      expect(ratio).toBeGreaterThanOrEqual(20.9);
      expect(ratio).toBeLessThanOrEqual(21.1);
    });

    it('calculates 1:1 contrast for identical colors', () => {
      expect(contrastRatio('#336699', '#336699')).toBe(1);
    });

    it('is symmetric regardless of argument order', () => {
      const r1 = contrastRatio('#123456', '#abcdef');
      const r2 = contrastRatio('#abcdef', '#123456');
      expect(r1).toBe(r2);
    });
  });

  describe('Color Formatting', () => {
    it('formats uppercase hex, rgb, and hsl strings', () => {
      expect(formatHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
      expect(formatRgb({ r: 255, g: 0, b: 0 })).toBe('rgb(255, 0, 0)');
      expect(formatRgb({ r: 255, g: 0, b: 0, a: 128 })).toBe('rgba(255, 0, 0, 0.50)');
      expect(formatHsl({ h: 180, s: 50, l: 50 })).toBe('hsl(180, 50%, 50%)');
    });
  });
});

