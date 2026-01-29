// color-utils.js - Color conversion and palette generation utilities
// Bharat Dev Tools - Color Picker & Gradient Generator

// ============================================================================
// COLOR CONVERSION FUNCTIONS
// ============================================================================

/**
 * Parse a color string and return RGB values
 * Supports HEX, RGB, RGBA, HSL, HSLA formats
 * @param {string} colorString - Color string in any format
 * @returns {{r: number, g: number, b: number, a: number}|null} - RGB object or null if invalid
 */
function parseColor(colorString) {
  if (!colorString || typeof colorString !== 'string') {
    return null;
  }

  const trimmed = colorString.trim();

  // Try HEX format
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    return hexToRgb(trimmed);
  }

  // Try RGB/RGBA format
  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    return parseRgbString(rgbMatch[1]);
  }

  // Try HSL/HSLA format
  const hslMatch = trimmed.match(/^hsla?\(([^)]+)\)$/i);
  if (hslMatch) {
    return parseHslString(hslMatch[1]);
  }

  return null;
}

/**
 * Convert HEX to RGB
 * @param {string} hex - HEX color string
 * @returns {{r: number, g: number, b: number, a: number}|null} - RGB object
 */
function hexToRgb(hex) {
  if (!hex) return null;

  const cleanHex = hex.replace('#', '');
  let r, g, b, a = 255;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else if (cleanHex.length === 8) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
    a = parseInt(cleanHex.substring(6, 8), 16);
  } else {
    return null;
  }

  return { r, g, b, a };
}

/**
 * Convert RGB to HEX
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {number} a - Alpha (0-255, optional)
 * @returns {string} - HEX color string
 */
function rgbToHex(r, g, b, a = null) {
  const toHex = (n) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  const hex = '#' + toHex(r) + toHex(g) + toHex(b);
  return a !== null && a !== 255 ? hex + toHex(a) : hex;
}

/**
 * Parse RGB string
 * @param {string} rgbString - RGB values string (e.g., "255, 128, 64" or "255, 128, 64, 0.5")
 * @returns {{r: number, g: number, b: number, a: number}|null} - RGB object
 */
function parseRgbString(rgbString) {
  const parts = rgbString.split(',').map(p => p.trim());
  if (parts.length < 3) return null;

  const r = parseInt(parts[0], 10);
  const g = parseInt(parts[1], 10);
  const b = parseInt(parts[2], 10);
  let a = 255;

  if (parts.length === 4) {
    const alpha = parseFloat(parts[3]);
    a = Math.round(alpha * 255);
  }

  if (isNaN(r) || isNaN(g) || isNaN(b) || r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }

  return { r, g, b, a };
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {{h: number, s: number, l: number}} - HSL object
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {{r: number, g: number, b: number}} - RGB object
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Parse HSL string
 * @param {string} hslString - HSL values string (e.g., "180, 50%, 50%" or "180, 50%, 50%, 0.5")
 * @returns {{r: number, g: number, b: number, a: number}|null} - RGB object
 */
function parseHslString(hslString) {
  const parts = hslString.split(',').map(p => p.trim());
  if (parts.length < 3) return null;

  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace('%', ''));
  const l = parseFloat(parts[2].replace('%', ''));
  let a = 255;

  if (parts.length === 4) {
    const alpha = parseFloat(parts[3]);
    a = Math.round(alpha * 255);
  }

  if (isNaN(h) || isNaN(s) || isNaN(l) || h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
    return null;
  }

  const rgb = hslToRgb(h, s, l);
  return { ...rgb, a };
}

/**
 * Format color as HEX
 * @param {{r: number, g: number, b: number, a: number}} rgb - RGB object
 * @returns {string} - HEX color string
 */
function formatAsHex(rgb) {
  return rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a !== 255 ? rgb.a : null);
}

/**
 * Format color as RGB
 * @param {{r: number, g: number, b: number, a: number}} rgb - RGB object
 * @returns {string} - RGB color string
 */
function formatAsRgb(rgb) {
  if (rgb.a !== 255) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(rgb.a / 255).toFixed(2)})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Format color as HSL
 * @param {{r: number, g: number, b: number, a: number}} rgb - RGB object
 * @returns {string} - HSL color string
 */
function formatAsHsl(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (rgb.a !== 255) {
    return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${(rgb.a / 255).toFixed(2)})`;
  }
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

// ============================================================================
// PALETTE GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate lighter shades of a color
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @param {number} count - Number of shades to generate
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB objects
 */
function generateLighterShades(rgb, count = 5) {
  const shades = [];
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  for (let i = 1; i <= count; i++) {
    const factor = i / (count + 1);
    const newL = Math.min(100, hsl.l + (100 - hsl.l) * factor);
    const newRgb = hslToRgb(hsl.h, hsl.s, newL);
    shades.push({ ...newRgb, a: 255 });
  }

  return shades;
}

/**
 * Generate darker shades of a color
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @param {number} count - Number of shades to generate
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB objects
 */
function generateDarkerShades(rgb, count = 5) {
  const shades = [];
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  for (let i = 1; i <= count; i++) {
    const factor = i / (count + 1);
    const newL = Math.max(0, hsl.l * (1 - factor));
    const newRgb = hslToRgb(hsl.h, hsl.s, newL);
    shades.push({ ...newRgb, a: 255 });
  }

  return shades;
}

/**
 * Generate complementary color
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @returns {{r: number, g: number, b: number, a: number}} - Complementary RGB object
 */
function generateComplementary(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const compH = (hsl.h + 180) % 360;
  const compRgb = hslToRgb(compH, hsl.s, hsl.l);
  return { ...compRgb, a: 255 };
}

/**
 * Generate monochrome palette
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @param {number} count - Number of colors in palette
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB objects
 */
function generateMonochrome(rgb, count = 5) {
  const palette = [];
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  for (let i = 0; i < count; i++) {
    const factor = i / (count - 1);
    const newL = factor * 100;
    const newRgb = hslToRgb(hsl.h, hsl.s, newL);
    palette.push({ ...newRgb, a: 255 });
  }

  return palette;
}

/**
 * Generate split complementary palette
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB objects
 */
function generateSplitComplementary(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const palette = [];

  palette.push({ r: rgb.r, g: rgb.g, b: rgb.b, a: 255 });

  const comp1H = (hsl.h + 150) % 360;
  const comp1Rgb = hslToRgb(comp1H, hsl.s, hsl.l);
  palette.push({ ...comp1Rgb, a: 255 });

  const comp2H = (hsl.h + 210) % 360;
  const comp2Rgb = hslToRgb(comp2H, hsl.s, hsl.l);
  palette.push({ ...comp2Rgb, a: 255 });

  return palette;
}

/**
 * Generate triadic palette
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB objects
 */
function generateTriadic(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const palette = [];

  palette.push({ r: rgb.r, g: rgb.g, b: rgb.b, a: 255 });

  const tri1H = (hsl.h + 120) % 360;
  const tri1Rgb = hslToRgb(tri1H, hsl.s, hsl.l);
  palette.push({ ...tri1Rgb, a: 255 });

  const tri2H = (hsl.h + 240) % 360;
  const tri2Rgb = hslToRgb(tri2H, hsl.s, hsl.l);
  palette.push({ ...tri2Rgb, a: 255 });

  return palette;
}

/**
 * Generate tetradic palette
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB objects
 */
function generateTetradic(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const palette = [];

  palette.push({ r: rgb.r, g: rgb.g, b: rgb.b, a: 255 });

  const tet1H = (hsl.h + 90) % 360;
  const tet1Rgb = hslToRgb(tet1H, hsl.s, hsl.l);
  palette.push({ ...tet1Rgb, a: 255 });

  const tet2H = (hsl.h + 180) % 360;
  const tet2Rgb = hslToRgb(tet2H, hsl.s, hsl.l);
  palette.push({ ...tet2Rgb, a: 255 });

  const tet3H = (hsl.h + 270) % 360;
  const tet3Rgb = hslToRgb(tet3H, hsl.s, hsl.l);
  palette.push({ ...tet3Rgb, a: 255 });

  return palette;
}

/**
 * Generate Tailwind-style shades (50-900)
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @returns {Object<string, {r: number, g: number, b: number, a: number}>} - Object with shade keys
 */
function generateTailwindShades(rgb) {
  const shades = {
    50: null,
    100: null,
    200: null,
    300: null,
    400: null,
    500: { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 },
    600: null,
    700: null,
    800: null,
    900: null
  };

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lightnessMap = {
    50: 95,
    100: 90,
    200: 80,
    300: 70,
    400: 60,
    500: hsl.l,
    600: 40,
    700: 30,
    800: 20,
    900: 10
  };

  Object.keys(lightnessMap).forEach(key => {
    if (key !== '500') {
      const newL = lightnessMap[key];
      const newRgb = hslToRgb(hsl.h, hsl.s, newL);
      shades[key] = { ...newRgb, a: 255 };
    }
  });

  return shades;
}

/**
 * Generate Material Design palette
 * @param {{r: number, g: number, b: number}} rgb - RGB object
 * @returns {Object<string, {r: number, g: number, b: number, a: number}>} - Object with shade keys
 */
function generateMaterialPalette(rgb) {
  const palette = {
    '50': null,
    '100': null,
    '200': null,
    '300': null,
    '400': null,
    '500': { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 },
    '600': null,
    '700': null,
    '800': null,
    '900': null,
    'A100': null,
    'A200': null,
    'A400': null,
    'A700': null
  };

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lightnessMap = {
    '50': 96,
    '100': 93,
    '200': 87,
    '300': 75,
    '400': 65,
    '500': hsl.l,
    '600': 45,
    '700': 35,
    '800': 25,
    '900': 15,
    'A100': 80,
    'A200': 60,
    'A400': 50,
    'A700': 40
  };

  Object.keys(lightnessMap).forEach(key => {
    if (key !== '500') {
      const newL = lightnessMap[key];
      const newRgb = hslToRgb(hsl.h, hsl.s, newL);
      palette[key] = { ...newRgb, a: 255 };
    }
  });

  return palette;
}

// ============================================================================
// CONTRAST & ACCESSIBILITY FUNCTIONS
// ============================================================================

/**
 * Calculate relative luminance
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {number} - Relative luminance (0-1)
 */
function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * @param {{r: number, g: number, b: number}} color1 - First RGB color
 * @param {{r: number, g: number, b: number}} color2 - Second RGB color
 * @returns {number} - Contrast ratio (1-21)
 */
function getContrastRatio(color1, color2) {
  const l1 = getRelativeLuminance(color1.r, color1.g, color1.b);
  const l2 = getRelativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standards
 * @param {number} ratio - Contrast ratio
 * @param {boolean} largeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns {boolean} - True if meets AA standards
 */
function meetsWCAGAA(ratio, largeText = false) {
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standards
 * @param {number} ratio - Contrast ratio
 * @param {boolean} largeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns {boolean} - True if meets AAA standards
 */
function meetsWCAGAAA(ratio, largeText = false) {
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Make utilities available globally
window.ColorUtils = {
  parseColor,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  formatAsHex,
  formatAsRgb,
  formatAsHsl,
  generateLighterShades,
  generateDarkerShades,
  generateComplementary,
  generateMonochrome,
  generateSplitComplementary,
  generateTriadic,
  generateTetradic,
  generateTailwindShades,
  generateMaterialPalette,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA
};

// Also export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ColorUtils;
}

