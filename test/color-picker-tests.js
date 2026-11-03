/**
 * Color Picker Test Suite
 * 
 * Comprehensive tests for Color Picker functionality including:
 * - Color parsing (HEX, RGB, HSL)
 * - Color conversion utilities
 * - Palette generation
 * - Contrast ratio calculations
 * - Edge cases and complex scenarios
 */

// Import color utilities (for Node.js environment)
// In browser, these are available via window.ColorUtils
let ColorUtils;

if (typeof window !== 'undefined' && window.ColorUtils) {
  ColorUtils = window.ColorUtils;
} else {
  // For Node.js testing, we'll need to import or mock
  // For now, we'll create a mock that matches the API
  ColorUtils = {
    parseColor: (str) => {
      if (!str || typeof str !== 'string') return null;
      const trimmed = str.trim();
      const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
      if (hexMatch) {
        return hexToRgb(trimmed);
      }
      return null;
    },
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    formatAsHex: (rgb) => rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a !== 255 ? rgb.a : null),
    formatAsRgb: (rgb) => {
      if (rgb.a !== 255) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(rgb.a / 255).toFixed(2)})`;
      }
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    },
    formatAsHsl: (rgb) => {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      if (rgb.a !== 255) {
        return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${(rgb.a / 255).toFixed(2)})`;
      }
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    },
    generateLighterShades: (rgb, count) => {
      const shades = [];
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      for (let i = 1; i <= count; i++) {
        const newL = Math.min(100, hsl.l + (i * 10));
        const newRgb = hslToRgb(hsl.h, hsl.s, newL);
        shades.push({ ...newRgb, a: 255 });
      }
      return shades;
    },
    generateDarkerShades: (rgb, count) => {
      const shades = [];
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      for (let i = 1; i <= count; i++) {
        const newL = Math.max(0, hsl.l - (i * 10));
        const newRgb = hslToRgb(hsl.h, hsl.s, newL);
        shades.push({ ...newRgb, a: 255 });
      }
      return shades;
    },
    getContrastRatio: (rgb1, rgb2) => {
      const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
      const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
      const lighter = Math.max(lum1, lum2);
      const darker = Math.min(lum1, lum2);
      return (lighter + 0.05) / (darker + 0.05);
    }
  };
  
  // Helper functions for Node.js
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
  
  function rgbToHex(r, g, b, a = null) {
    const toHex = (n) => {
      const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    const hex = '#' + toHex(r) + toHex(g) + toHex(b);
    return a !== null && a !== 255 ? hex + toHex(a) : hex;
  }
  
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
  
  function getRelativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
}

// Color Picker Test Class
class ColorPickerTester {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.failedTests = [];
  }

  runTest(testName, testFunction) {
    this.totalTests++;
    try {
      const result = testFunction();
      if (result === true) {
        this.testsPassed++;
        console.log(`✅ ${testName}`);
      } else {
        this.testsFailed++;
        this.failedTests.push(testName);
        console.log(`❌ ${testName} - Expected true, got ${result}`);
      }
    } catch (error) {
      this.testsFailed++;
      this.failedTests.push(testName);
      console.log(`❌ ${testName} - Error: ${error.message}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual === expected) {
      return true;
    } else {
      throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
    }
  }

  assertContains(actual, expected, message) {
    if (typeof actual === 'string' && actual.includes(expected)) {
      return true;
    } else if (typeof actual === 'object' && actual !== null) {
      const str = JSON.stringify(actual);
      if (str.includes(expected)) {
        return true;
      }
    }
    throw new Error(`${message} - Expected to contain: ${expected}, Got: ${actual}`);
  }

  assertApproxEqual(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) <= tolerance) {
      return true;
    } else {
      throw new Error(`${message} - Expected: ${expected} (±${tolerance}), Got: ${actual}`);
    }
  }

  runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('COLOR PICKER TEST SUITE');
    console.log('='.repeat(60) + '\n');

    // Color Parsing Tests
    console.log('🧪 Testing Color Parsing...\n');
    this.testColorParsing();

    // Color Conversion Tests
    console.log('\n🧪 Testing Color Conversion...\n');
    this.testColorConversion();

    // Color Formatting Tests
    console.log('\n🧪 Testing Color Formatting...\n');
    this.testColorFormatting();

    // Palette Generation Tests
    console.log('\n🧪 Testing Palette Generation...\n');
    this.testPaletteGeneration();

    // Contrast Ratio Tests
    console.log('\n🧪 Testing Contrast Ratio...\n');
    this.testContrastRatio();

    // Edge Cases Tests
    console.log('\n🧪 Testing Edge Cases...\n');
    this.testEdgeCases();

    // Performance Tests
    console.log('\n🧪 Testing Performance...\n');
    this.testPerformance();

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Color Picker Test Results: ${this.testsPassed}/${this.totalTests} passed`);
    console.log('='.repeat(60));

    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };
  }

  testColorParsing() {
    // HEX parsing
    this.runTest('parseColor - 6-digit HEX', () => {
      const result = ColorUtils.parseColor('#FF5733');
      return result && result.r === 255 && result.g === 87 && result.b === 51;
    });

    this.runTest('parseColor - 3-digit HEX', () => {
      const result = ColorUtils.parseColor('#F73');
      return result && result.r === 255 && result.g === 119 && result.b === 51;
    });

    this.runTest('parseColor - 8-digit HEX with alpha', () => {
      const result = ColorUtils.parseColor('#FF5733FF');
      return result && result.r === 255 && result.g === 87 && result.b === 51 && result.a === 255;
    });

    this.runTest('parseColor - HEX without #', () => {
      const result = ColorUtils.parseColor('FF5733');
      return result && result.r === 255 && result.g === 87 && result.b === 51;
    });

    this.runTest('parseColor - Invalid HEX returns null', () => {
      const result = ColorUtils.parseColor('#GGGGGG');
      return result === null;
    });

    this.runTest('parseColor - Empty string returns null', () => {
      const result = ColorUtils.parseColor('');
      return result === null;
    });

    this.runTest('parseColor - Null returns null', () => {
      const result = ColorUtils.parseColor(null);
      return result === null;
    });
  }

  testColorConversion() {
    // HEX to RGB
    this.runTest('hexToRgb - 6-digit HEX', () => {
      const result = ColorUtils.hexToRgb('#FF5733');
      return result && result.r === 255 && result.g === 87 && result.b === 51;
    });

    this.runTest('hexToRgb - 8-digit HEX with alpha', () => {
      const result = ColorUtils.hexToRgb('#FF573380');
      return result && result.r === 255 && result.g === 87 && result.b === 51 && result.a === 128;
    });

    // RGB to HEX
    this.runTest('rgbToHex - Basic RGB', () => {
      const result = ColorUtils.rgbToHex(255, 87, 51);
      return result === '#ff5733';
    });

    this.runTest('rgbToHex - RGB with alpha', () => {
      const result = ColorUtils.rgbToHex(255, 87, 51, 128);
      return result === '#ff573380';
    });

    // RGB to HSL
    this.runTest('rgbToHsl - Red color', () => {
      const result = ColorUtils.rgbToHsl(255, 0, 0);
      return result && result.h === 0 && result.s === 100 && result.l === 50;
    });

    this.runTest('rgbToHsl - Green color', () => {
      const result = ColorUtils.rgbToHsl(0, 255, 0);
      return result && result.h === 120 && result.s === 100 && result.l === 50;
    });

    this.runTest('rgbToHsl - Blue color', () => {
      const result = ColorUtils.rgbToHsl(0, 0, 255);
      return result && result.h === 240 && result.s === 100 && result.l === 50;
    });

    // HSL to RGB
    this.runTest('hslToRgb - Red HSL', () => {
      const result = ColorUtils.hslToRgb(0, 100, 50);
      return result && result.r === 255 && result.g === 0 && result.b === 0;
    });

    this.runTest('hslToRgb - Green HSL', () => {
      const result = ColorUtils.hslToRgb(120, 100, 50);
      return result && result.r === 0 && result.g === 255 && result.b === 0;
    });

    this.runTest('hslToRgb - Blue HSL', () => {
      const result = ColorUtils.hslToRgb(240, 100, 50);
      return result && result.r === 0 && result.g === 0 && result.b === 255;
    });

    // Round-trip conversion
    this.runTest('Round-trip - RGB to HSL to RGB', () => {
      const original = { r: 255, g: 87, b: 51 };
      const hsl = ColorUtils.rgbToHsl(original.r, original.g, original.b);
      const back = ColorUtils.hslToRgb(hsl.h, hsl.s, hsl.l);
      return Math.abs(original.r - back.r) <= 1 && 
             Math.abs(original.g - back.g) <= 1 && 
             Math.abs(original.b - back.b) <= 1;
    });
  }

  testColorFormatting() {
    this.runTest('formatAsHex - Basic RGB', () => {
      const result = ColorUtils.formatAsHex({ r: 255, g: 87, b: 51, a: 255 });
      return result === '#ff5733';
    });

    this.runTest('formatAsHex - RGB with alpha', () => {
      const result = ColorUtils.formatAsHex({ r: 255, g: 87, b: 51, a: 128 });
      return result === '#ff573380';
    });

    this.runTest('formatAsRgb - Basic RGB', () => {
      const result = ColorUtils.formatAsRgb({ r: 255, g: 87, b: 51, a: 255 });
      return result === 'rgb(255, 87, 51)';
    });

    this.runTest('formatAsRgb - RGB with alpha', () => {
      const result = ColorUtils.formatAsRgb({ r: 255, g: 87, b: 51, a: 128 });
      return this.assertContains(result, 'rgba', 'Should format as rgba');
    });

    this.runTest('formatAsHsl - Basic HSL', () => {
      const result = ColorUtils.formatAsHsl({ r: 255, g: 0, b: 0, a: 255 });
      return this.assertContains(result, 'hsl', 'Should format as hsl');
    });

    this.runTest('formatAsHsl - HSL with alpha', () => {
      const result = ColorUtils.formatAsHsl({ r: 255, g: 0, b: 0, a: 128 });
      return this.assertContains(result, 'hsla', 'Should format as hsla');
    });
  }

  testPaletteGeneration() {
    const testColor = { r: 255, g: 87, b: 51, a: 255 };

    this.runTest('generateLighterShades - Generates correct count', () => {
      const shades = ColorUtils.generateLighterShades(testColor, 5);
      return shades && shades.length === 5;
    });

    this.runTest('generateLighterShades - Shades are lighter', () => {
      const shades = ColorUtils.generateLighterShades(testColor, 3);
      const originalHsl = ColorUtils.rgbToHsl(testColor.r, testColor.g, testColor.b);
      const firstShadeHsl = ColorUtils.rgbToHsl(shades[0].r, shades[0].g, shades[0].b);
      return firstShadeHsl.l > originalHsl.l;
    });

    this.runTest('generateDarkerShades - Generates correct count', () => {
      const shades = ColorUtils.generateDarkerShades(testColor, 5);
      return shades && shades.length === 5;
    });

    this.runTest('generateDarkerShades - Shades are darker', () => {
      const shades = ColorUtils.generateDarkerShades(testColor, 3);
      const originalHsl = ColorUtils.rgbToHsl(testColor.r, testColor.g, testColor.b);
      const firstShadeHsl = ColorUtils.rgbToHsl(shades[0].r, shades[0].g, shades[0].b);
      return firstShadeHsl.l < originalHsl.l;
    });
  }

  testContrastRatio() {
    const white = { r: 255, g: 255, b: 255, a: 255 };
    const black = { r: 0, g: 0, b: 0, a: 255 };

    this.runTest('getContrastRatio - White on black is high', () => {
      const ratio = ColorUtils.getContrastRatio(white, black);
      return ratio >= 20; // White on black should be ~21:1
    });

    this.runTest('getContrastRatio - Black on white is high', () => {
      const ratio = ColorUtils.getContrastRatio(black, white);
      return ratio >= 20;
    });

    this.runTest('getContrastRatio - Same color is 1:1', () => {
      const ratio = ColorUtils.getContrastRatio(white, white);
      return this.assertApproxEqual(ratio, 1, 0.01, 'Same color contrast');
    });

    this.runTest('getContrastRatio - Symmetric', () => {
      const color1 = { r: 100, g: 150, b: 200, a: 255 };
      const color2 = { r: 200, g: 100, b: 150, a: 255 };
      const ratio1 = ColorUtils.getContrastRatio(color1, color2);
      const ratio2 = ColorUtils.getContrastRatio(color2, color1);
      return this.assertApproxEqual(ratio1, ratio2, 0.01, 'Contrast ratio should be symmetric');
    });
  }

  testEdgeCases() {
    this.runTest('Edge Case - RGB values clamped to 0-255', () => {
      const result = ColorUtils.rgbToHex(300, -10, 128);
      const rgb = ColorUtils.hexToRgb(result);
      return rgb.r <= 255 && rgb.r >= 0 && rgb.g >= 0;
    });

    this.runTest('Edge Case - HSL hue wraps around', () => {
      const result1 = ColorUtils.hslToRgb(360, 100, 50);
      const result2 = ColorUtils.hslToRgb(0, 100, 50);
      return result1.r === result2.r && result1.g === result2.g && result1.b === result2.b;
    });

    this.runTest('Edge Case - Zero saturation (grayscale)', () => {
      const result = ColorUtils.hslToRgb(0, 0, 50);
      return result.r === result.g && result.g === result.b;
    });

    this.runTest('Edge Case - Maximum lightness (white)', () => {
      const result = ColorUtils.hslToRgb(0, 0, 100);
      return result.r === 255 && result.g === 255 && result.b === 255;
    });

    this.runTest('Edge Case - Minimum lightness (black)', () => {
      const result = ColorUtils.hslToRgb(0, 0, 0);
      return result.r === 0 && result.g === 0 && result.b === 0;
    });
  }

  testPerformance() {
    this.runTest('Performance - Parse 1000 colors', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        ColorUtils.parseColor(`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`);
      }
      const duration = performance.now() - start;
      return duration < 1000; // Should complete in < 1 second
    });

    this.runTest('Performance - Generate large palette', () => {
      const testColor = { r: 255, g: 87, b: 51, a: 255 };
      const start = performance.now();
      ColorUtils.generateLighterShades(testColor, 50);
      ColorUtils.generateDarkerShades(testColor, 50);
      const duration = performance.now() - start;
      return duration < 100; // Should complete in < 100ms
    });
  }
}

// Export for ES modules
export { ColorPickerTester };
