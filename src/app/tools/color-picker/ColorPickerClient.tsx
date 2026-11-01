'use client';

import React, { useState, useCallback } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import { Palette, CheckCircle2, ShieldAlert, Sparkles, Copy } from 'lucide-react';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const hp = s / 100,
    lp = l / 100;
  const c = (1 - Math.abs(2 * lp - 1)) * hp;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lp - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toH = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

// Relative luminance for WCAG contrast
function getLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrast(rgb: { r: number; g: number; b: number }, against: 'white' | 'black') {
  const lum1 = getLuminance(rgb.r, rgb.g, rgb.b);
  const lum2 = against === 'white' ? 1 : 0;
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const PALETTE_PRESETS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0f172a'];

export default function ColorPickerClient() {
  const [hex, setHex] = useState('#3b82f6');

  const rgb = hexToRgb(hex) || { r: 59, g: 130, b: 246 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const compHex = hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
  const triadic1 = hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l);
  const triadic2 = hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l);

  const whiteContrast = getContrast(rgb, 'white');
  const blackContrast = getContrast(rgb, 'black');

  const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const cssToken = `--color-primary: ${hex.toUpperCase()};\n--color-primary-rgb: ${rgb.r}, ${rgb.g}, ${rgb.b};\n--color-primary-hsl: ${hsl.h} ${hsl.s}% ${hsl.l}%;`;

  return (
    <ToolLayout toolId="color-picker">
      <div className="space-y-6">
        {/* Presets Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pb-2 border-b border-border">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Popular Palettes:
          </span>
          {PALETTE_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setHex(color)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-xs font-mono transition-colors border border-border/50"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{color}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Picker & Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Color Canvas
              </span>

              {/* Large interactive preview swatch */}
              <div
                className="h-32 sm:h-40 w-full rounded-xl border border-border/60 shadow-inner flex items-end p-4 transition-colors"
                style={{ backgroundColor: hex }}
              >
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white font-mono text-sm font-bold tracking-wide">
                  {hex.toUpperCase()}
                </div>
              </div>

              {/* Native Picker + Hex Text Input */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-border cursor-pointer bg-transparent p-1"
                />
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">HEX Code</label>
                  <input
                    type="text"
                    value={hex}
                    maxLength={7}
                    onChange={(e) => {
                      const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setHex(v);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Accessibility Contrast Checker */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                WCAG 2.1 Contrast Ratios
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* On White */}
                <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span>Against White</span>
                    <span className="font-mono font-bold">{whiteContrast.toFixed(2)}:1</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {whiteContrast >= 4.5 ? (
                      <span className="text-emerald-500 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passes AA
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Fails AA
                      </span>
                    )}
                  </div>
                </div>

                {/* On Black */}
                <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span>Against Black</span>
                    <span className="font-mono font-bold">{blackContrast.toFixed(2)}:1</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {blackContrast >= 4.5 ? (
                      <span className="text-emerald-500 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passes AA
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Fails AA
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Conversions & Color Harmonies */}
          <div className="lg:col-span-6 space-y-4">
            {/* Formats Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Color Values
              </span>

              <div className="space-y-2">
                {[
                  { label: 'HEX', val: hex.toUpperCase() },
                  { label: 'RGB', val: rgbStr },
                  { label: 'HSL', val: hslStr },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border bg-muted/30"
                  >
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground block">{label}</span>
                      <code className="font-mono text-xs sm:text-sm font-semibold text-foreground">{val}</code>
                    </div>
                    <CopyButton text={val} size="sm" variant="ghost" />
                  </div>
                ))}
              </div>
            </div>

            {/* Harmonies Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Harmonies & Palette
              </span>

              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                {[
                  { label: 'Complement', color: compHex },
                  { label: 'Triadic 1', color: triadic1 },
                  { label: 'Triadic 2', color: triadic2 },
                ].map(({ label, color }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setHex(color)}
                    className="p-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 transition-colors flex flex-col items-center gap-2 group"
                  >
                    <div
                      className="w-full h-8 rounded-md border border-border/50 group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{label}</span>
                      <span className="font-mono text-[11px] font-semibold text-foreground uppercase">{color}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* CSS Variables Export */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  CSS Variables Export
                </span>
                <CopyButton text={cssToken} label="Copy CSS" size="sm" />
              </div>
              <pre className="p-3 rounded-lg bg-muted/40 border border-border/60 font-mono text-xs text-foreground overflow-x-auto">
                {cssToken}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
