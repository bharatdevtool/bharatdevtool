// lib/color/utils.ts — Color conversion utilities (ported from assets/js/color-utils.js)

export interface RGB {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): RGB | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  let full = clean;

  if (clean.length === 3) {
    full = clean.split('').map((c) => c + c).join('');
  }

  if (full.length === 6) {
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 255,
    };
  }

  if (full.length === 8) {
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: parseInt(full.slice(6, 8), 16),
    };
  }

  return null;
}

export function rgbToHex({ r, g, b, a }: RGB): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  const hex = '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (a !== undefined && a !== 255 && a >= 0 && a <= 255) {
    return hex + clamp(a).toString(16).padStart(2, '0');
  }
  return hex;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  let normalizedH = h % 360;
  if (normalizedH < 0) normalizedH += 360;

  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((normalizedH / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;

  if (normalizedH < 60) {
    r = c; g = x;
  } else if (normalizedH < 120) {
    r = x; g = c;
  } else if (normalizedH < 180) {
    g = c; b = x;
  } else if (normalizedH < 240) {
    g = x; b = c;
  } else if (normalizedH < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: 255,
  };
}

export function getComplementary(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  const compHsl = { ...hsl, h: (hsl.h + 180) % 360 };
  return rgbToHex(hslToRgb(compHsl));
}

export function generateLighterShades(hex: string, count = 5): string[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  const hsl = rgbToHsl(rgb);
  const shades: string[] = [];
  for (let i = 1; i <= count; i++) {
    const newL = Math.min(100, hsl.l + Math.round(((100 - hsl.l) / (count + 1)) * i));
    shades.push(rgbToHex(hslToRgb({ ...hsl, l: newL })));
  }
  return shades;
}

export function generateDarkerShades(hex: string, count = 5): string[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  const hsl = rgbToHsl(rgb);
  const shades: string[] = [];
  for (let i = 1; i <= count; i++) {
    const newL = Math.max(0, hsl.l - Math.round((hsl.l / (count + 1)) * i));
    shades.push(rgbToHex(hslToRgb({ ...hsl, l: newL })));
  }
  return shades;
}

export function formatHex(rgb: RGB): string {
  return rgbToHex(rgb).toUpperCase();
}

export function formatRgb(rgb: RGB): string {
  if (rgb.a !== undefined && rgb.a !== 255) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(rgb.a / 255).toFixed(2)})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function formatHsl(hsl: HSL, a?: number): string {
  if (a !== undefined && a !== 255) {
    return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${(a / 255).toFixed(2)})`;
  }
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/** WCAG contrast ratio between two hex colors */
export function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;

  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

function relativeLuminance({ r, g, b }: RGB): number {
  const toLinear = (c: number) => {
    const n = c / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
