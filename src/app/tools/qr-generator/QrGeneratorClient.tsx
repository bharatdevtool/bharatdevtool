'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import ErrorMessage from '@/components/ui/ErrorMessage';
import SegmentedTabs, { TabOption } from '@/components/ui/SegmentedTabs';
import CopyButton from '@/components/ui/CopyButton';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import QRCode from 'qrcode';
import { QrCode, Download, Sparkles, Sliders, Palette, RefreshCw } from 'lucide-react';

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';
type ContentType = 'url' | 'text' | 'wifi';

const CONTENT_TABS: TabOption<ContentType>[] = [
  { id: 'url', label: 'URL / Link' },
  { id: 'text', label: 'Plain Text' },
  { id: 'wifi', label: 'WiFi Network' },
];

export default function QrGeneratorClient() {
  const [contentType, setContentType] = useState<ContentType>('url');
  const [urlInput, setUrlInput] = useState('https://bharatdevtools.com');
  const [textInput, setTextInput] = useState('Hello from Bharat Dev Tools!');
  const [wifiSsid, setWifiSsid] = useState('MyHomeWiFi');
  const [wifiPassword, setWifiPassword] = useState('password123');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [size, setSize] = useState(280);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>('M');
  const [darkColor, setDarkColor] = useState('#000000');
  const [lightColor, setLightColor] = useState('#ffffff');
  const [error, setError] = useState<string | null>(null);

  const getEncodedPayload = useCallback(() => {
    if (contentType === 'url') return urlInput.trim();
    if (contentType === 'text') return textInput.trim();
    if (contentType === 'wifi') {
      return `WIFI:T:${wifiEncryption};S:${wifiSsid};P:${wifiPassword};;`;
    }
    return '';
  }, [contentType, urlInput, textInput, wifiSsid, wifiPassword, wifiEncryption]);

  const generate = useCallback(async () => {
    setError(null);
    const payload = getEncodedPayload();
    if (!payload) {
      setQrDataUrl('');
      return;
    }
    try {
      const url = await QRCode.toDataURL(payload, {
        width: size,
        errorCorrectionLevel: errorLevel,
        color: { dark: darkColor, light: lightColor },
        margin: 2,
      });
      setQrDataUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code.');
    }
  }, [getEncodedPayload, size, errorLevel, darkColor, lightColor]);

  useEffect(() => {
    generate();
  }, [generate]);

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode-${Date.now()}.png`;
    a.click();
    analytics.track(ANALYTICS_EVENTS.DOWNLOAD_QR);
  }

  return (
    <ToolLayout toolId="qr-generator">
      <div className="space-y-4">
        {/* Content Type Tabs */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card shadow-2xs">
          <SegmentedTabs
            tabs={CONTENT_TABS}
            activeTab={contentType}
            onChange={setContentType}
          />
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Input & Customization Controls */}
          <div className="lg:col-span-7 space-y-4">
            {/* Input Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Payload Content
              </span>

              {contentType === 'url' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Target Website URL</label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {contentType === 'text' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Plain Text or Note</label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={4}
                    placeholder="Enter any text message..."
                    className="w-full p-3.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  />
                </div>
              )}

              {contentType === 'wifi' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Network Name (SSID)</label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="WiFi Network Name"
                      className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">WiFi Password</label>
                    <input
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customization Options Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" /> Appearance & Redundancy
              </span>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Error Correction</label>
                  <select
                    value={errorLevel}
                    onChange={(e) => setErrorLevel(e.target.value as ErrorLevel)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="L">L – Low (7% recoverable)</option>
                    <option value="M">M – Medium (15% recoverable)</option>
                    <option value="Q">Q – Quartile (25% recoverable)</option>
                    <option value="H">H – High (30% recoverable)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Pixel Size ({size}px)</label>
                  <input
                    type="range"
                    min={180}
                    max={512}
                    step={20}
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full accent-primary mt-2"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Pattern (Dark)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={darkColor}
                      onChange={(e) => setDarkColor(e.target.value)}
                      className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={darkColor}
                      onChange={(e) => setDarkColor(e.target.value)}
                      className="w-24 px-2 py-1 rounded border border-border bg-background text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Background (Light)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lightColor}
                      onChange={(e) => setLightColor(e.target.value)}
                      className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={lightColor}
                      onChange={(e) => setLightColor(e.target.value)}
                      className="w-24 px-2 py-1 rounded border border-border bg-background text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Preview & Download Card */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-xl border border-border bg-card shadow-2xs text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-4">
              Real-Time QR Preview
            </span>

            {qrDataUrl ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="p-3 rounded-2xl bg-white border border-border shadow-md">
                  <img
                    src={qrDataUrl}
                    alt="Generated QR Code"
                    className="rounded-lg object-contain max-w-[260px] max-h-[260px]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs active:scale-95"
                  >
                    <Download className="w-4 h-4" /> Download PNG
                  </button>
                  <CopyButton text={getEncodedPayload()} label="Copy Data" />
                </div>
                <p className="text-[11px] text-muted-foreground">High resolution • Scannable with any iOS/Android camera</p>
              </div>
            ) : (
              <div className="w-64 h-64 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-xs p-4">
                <QrCode className="w-10 h-10 mb-2 opacity-30" />
                <span>Enter payload to generate preview</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
