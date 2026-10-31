'use client';

import React, { useState, useEffect } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import QRCode from 'qrcode';
import { MessageSquare, ExternalLink, ShieldCheck, Download, Sparkles } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'US / Canada' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+61', country: 'Australia' },
  { code: '+971', country: 'UAE' },
  { code: '+65', country: 'Singapore' },
  { code: '+49', country: 'Germany' },
];

export default function WhatsAppLinkClient() {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [message, setMessage] = useState('Hi! I would like to get in touch regarding Bharat Dev Tools.');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const fullPhone = (countryCode + phone).replace(/\D/g, '');
  const link = fullPhone ? `https://wa.me/${fullPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}` : '';

  // Generate QR code client-side using local 'qrcode' library (no third-party data tracking!)
  useEffect(() => {
    if (!link) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(link, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [link]);

  return (
    <ToolLayout toolId="whatsapp-link">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Details */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Contact & Message Details
            </span>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Phone Number</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.country})
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder="98765 43210"
                  className="flex-1 px-3.5 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Pre-filled Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! I wanted to inquire about..."
                rows={4}
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>
          </div>

          {/* Generated Link Card */}
          {link && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Direct WhatsApp Chat URL
              </span>
              <pre className="p-3 rounded-lg bg-muted/40 border border-border font-mono text-xs text-foreground break-all select-all">
                {link}
              </pre>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <CopyButton text={link} label="Copy WhatsApp Link" />
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Chat Now</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Preview */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-xl border border-border bg-card shadow-2xs text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-4">
            Scan to Chat
          </span>

          {qrDataUrl ? (
            <div className="space-y-4 flex flex-col items-center">
              <div className="p-3 rounded-2xl bg-white border border-border shadow-md">
                <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-48 h-48 rounded-lg" />
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                Scan with any smartphone camera to open this WhatsApp conversation instantly.
              </p>
            </div>
          ) : (
            <div className="w-52 h-52 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-xs p-4">
              <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
              <span>Enter phone number to generate scan QR</span>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
