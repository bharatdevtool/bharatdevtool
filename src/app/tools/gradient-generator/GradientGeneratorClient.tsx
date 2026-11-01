'use client';
// app/tools/gradient-generator/GradientGeneratorClient.tsx

import { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';

type GradientType = 'linear' | 'radial' | 'conic';

interface ColorStop {
  color: string;
  position: number;
}

function buildCSS(type: GradientType, angle: number, stops: ColorStop[]): string {
  const stopsStr = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
  if (type === 'linear') return `linear-gradient(${angle}deg, ${stopsStr})`;
  if (type === 'radial') return `radial-gradient(circle, ${stopsStr})`;
  return `conic-gradient(from ${angle}deg, ${stopsStr})`;
}

const DEFAULTS: ColorStop[] = [
  { color: '#3b82f6', position: 0 },
  { color: '#8b5cf6', position: 100 },
];

export default function GradientGeneratorClient() {
  const [type, setType]     = useState<GradientType>('linear');
  const [angle, setAngle]   = useState(135);
  const [stops, setStops]   = useState<ColorStop[]>(DEFAULTS);

  const gradient = buildCSS(type, angle, stops);
  const cssRule  = `background: ${gradient};`;

  const updateStop = (i: number, patch: Partial<ColorStop>) => {
    setStops((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const addStop = () => {
    setStops((prev) => [...prev, { color: '#ec4899', position: Math.round((prev[prev.length - 1].position + 100) / 2) }]);
  };

  const removeStop = (i: number) => {
    if (stops.length <= 2) return;
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <ToolLayout toolId="gradient-generator">
      <div className="space-y-6">
        {/* Live preview */}
        <div
          className="h-36 w-full rounded-xl border border-border"
          style={{ background: gradient }}
          aria-label="Gradient preview"
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Controls */}
          <div className="space-y-5 rounded-lg border border-border bg-card p-5">
            {/* Type */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Type</p>
              <div className="flex gap-2">
                {(['linear', 'radial', 'conic'] as GradientType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize
                      ${type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Angle (linear & conic) */}
            {(type === 'linear' || type === 'conic') && (
              <div>
                <label className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
                  <span>{type === 'linear' ? 'Direction' : 'Start angle'}</span>
                  <span>{angle}°</span>
                </label>
                <input
                  type="range" min={0} max={360} value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}

            {/* Color stops */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Color Stops</p>
              <div className="space-y-2">
                {stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color" value={s.color}
                      onChange={(e) => updateStop(i, { color: e.target.value })}
                      className="h-8 w-8 cursor-pointer rounded border border-border"
                    />
                    <input
                      type="range" min={0} max={100} value={s.position}
                      onChange={(e) => updateStop(i, { position: Number(e.target.value) })}
                      className="flex-1 accent-primary"
                    />
                    <span className="w-9 text-right font-mono text-xs text-muted-foreground">{s.position}%</span>
                    <button
                      onClick={() => removeStop(i)}
                      disabled={stops.length <= 2}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-sm px-1"
                      aria-label="Remove stop"
                    >✕</button>
                  </div>
                ))}
              </div>
              <button
                onClick={addStop}
                className="mt-2 text-xs text-primary hover:underline"
              >+ Add stop</button>
            </div>
          </div>

          {/* CSS Output */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Generated CSS</p>
              <CopyButton text={cssRule} label="Copy CSS" />
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 text-sm font-mono text-foreground whitespace-pre-wrap break-all">
              {`.element {\n  ${cssRule}\n}`}
            </pre>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
