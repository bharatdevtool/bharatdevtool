'use client';

import React from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';
import type { ToolCategory } from '@/config/tools';

export interface ComparisonFeature {
  name: string;
  bharatDevTools: string;
  competitors: string;
}

export interface ComparisonData {
  title: string;
  subtitle: string;
  features: ComparisonFeature[];
}

const COMPARISONS_BY_CATEGORY: Record<ToolCategory | 'QuickDrop', ComparisonData> = {
  QuickDrop: {
    title: 'QuickDrop vs Traditional File Transfer Services',
    subtitle: 'Direct browser-to-browser encrypted transfers with zero intermediate servers or cloud storage.',
    features: [
      {
        name: 'Transfer Architecture',
        bharatDevTools: 'Direct Peer-to-Peer (WebRTC Encrypted)',
        competitors: 'Uploaded to cloud server, then downloaded',
      },
      {
        name: 'File Size Limit',
        bharatDevTools: 'No Artificial Limit (Streamed in 64KB Chunks)',
        competitors: 'Strictly capped (usually 2 GB on free tiers)',
      },
      {
        name: 'Transfer Speed',
        bharatDevTools: 'Full Local Wi-Fi Speed (Up to Gigabit LAN)',
        competitors: 'Throttled by home broadband upload bandwidth',
      },
      {
        name: 'Cloud Storage Risk',
        bharatDevTools: 'Zero Cloud Storage (0 bytes retained on disk)',
        competitors: 'Stored on remote servers for 7 to 30 days',
      },
      {
        name: 'Connection Security',
        bharatDevTools: 'Explicit Allow / Decline Authorization',
        competitors: 'Public shareable URL accessible by anyone',
      },
      {
        name: 'Account / Registration',
        bharatDevTools: 'No Account Required (Instant 1-Click Access)',
        competitors: 'Requires email registration or mobile app',
      },
    ],
  },
  PDF: {
    title: 'Bharat Dev Tools vs Traditional Online PDF Converters',
    subtitle: 'All PDF processing happens locally inside your browser using WebAssembly. No files ever leave your device.',
    features: [
      {
        name: 'Document Privacy',
        bharatDevTools: '100% In-Browser (WebAssembly & pdf-lib)',
        competitors: 'Uploaded to external cloud servers',
      },
      {
        name: 'Document Size Limit',
        bharatDevTools: 'No Artificial Limit (Limited only by device RAM)',
        competitors: 'Capped at 15 MB – 50 MB on free tier',
      },
      {
        name: 'Daily Usage Quotas',
        bharatDevTools: 'Unlimited Tasks & Pages (No daily restrictions)',
        competitors: 'Capped at 2 to 3 tasks every 24 hours',
      },
      {
        name: 'Output Watermarks',
        bharatDevTools: 'Zero Watermarks (Clean, original output)',
        competitors: 'Adds promotional watermark unless paid',
      },
      {
        name: 'Sensitive Data (PII) Audit',
        bharatDevTools: 'Built-in Client Regex Scanner (Cards, Emails, IDs)',
        competitors: 'Requires paid tier or manual blacking',
      },
      {
        name: 'File Retention Time',
        bharatDevTools: '0 Seconds (Discarded immediately upon tab close)',
        competitors: 'Retained on remote servers for 1–2 hours',
      },
      {
        name: 'Account Requirement',
        bharatDevTools: 'Instant 1-Click Access (No sign-up required)',
        competitors: 'Forces registration or trial subscription',
      },
    ],
  },
  'JSON & Data': {
    title: 'Bharat Dev Tools vs Standard Online JSON Formatters',
    subtitle: 'Confidential API keys, tokens, and database exports are parsed entirely client-side without network requests.',
    features: [
      {
        name: 'Confidential Data Security',
        bharatDevTools: '100% Client-Side (Tokens never sent over network)',
        competitors: 'Sent to remote backend parser APIs',
      },
      {
        name: '64-Bit Integer Precision',
        bharatDevTools: 'Exact BigInt Preservation (Never rounded)',
        competitors: 'IEEE-754 Numeric Precision Loss (Alters IDs)',
      },
      {
        name: 'Syntax Auto-Repair',
        bharatDevTools: 'Fixes Trailing Commas, Unquoted Keys & Single Quotes',
        competitors: 'Throws syntax error with no auto-fix option',
      },
      {
        name: 'Interactive Grid Editor',
        bharatDevTools: 'Spreadsheet Grid View with Filter, Sort & CSV Export',
        competitors: 'Raw code view only (no tabular editing)',
      },
      {
        name: 'Direct Disk Save (Ctrl+S)',
        bharatDevTools: 'Native File System API (Overwrites original file)',
        competitors: 'Only downloads duplicate file copies',
      },
      {
        name: 'JSONPath Queries',
        bharatDevTools: 'Client-Side Real-Time JSONPath Query Engine',
        competitors: 'Not supported or requires command-line tools',
      },
    ],
  },
  Image: {
    title: 'Bharat Dev Tools vs Typical Image Compression Services',
    subtitle: 'Fast, secure image processing directly via HTML5 Canvas and Web Workers without third-party cloud uploads.',
    features: [
      {
        name: 'Processing Pipeline',
        bharatDevTools: '100% In-Browser Canvas API & Web Workers',
        competitors: 'Uploaded to third-party compression servers',
      },
      {
        name: 'Batch Processing',
        bharatDevTools: 'Unlimited Photos (Parallel local compression)',
        competitors: 'Limited to 5 to 20 images on free tier',
      },
      {
        name: 'Quality Adjustment',
        bharatDevTools: 'Granular 1% to 100% Slider with Live Byte Preview',
        competitors: 'Fixed, non-customizable compression presets',
      },
      {
        name: 'Format Support',
        bharatDevTools: 'Instant JPG, PNG & WebP Conversion',
        competitors: 'Often locks WebP or charges for exports',
      },
      {
        name: 'Watermarks / Branding',
        bharatDevTools: '100% Clean Output (Zero watermarks)',
        competitors: 'Applies watermark or forces paid plan',
      },
    ],
  },
  'QR & Links': {
    title: 'Bharat Dev Tools vs Commercial QR Code Generators',
    subtitle: 'Generate permanent static QR codes with zero expiration dates, zero tracking redirects, and no forced logos.',
    features: [
      {
        name: 'QR Code Lifespan',
        bharatDevTools: 'Static QR Codes That Never Expire',
        competitors: 'Deactivated after 14 days to force a subscription',
      },
      {
        name: 'Watermarks & Branding',
        bharatDevTools: 'Zero Forced Watermarks (Custom logo support)',
        competitors: 'Forces company logo in center unless upgraded',
      },
      {
        name: 'Scan Redirect Tracking',
        bharatDevTools: 'Direct Data (Scanners reach destination directly)',
        competitors: 'Redirects through intermediary tracking servers',
      },
      {
        name: 'Print Export Resolution',
        bharatDevTools: 'Print-Ready Vector SVG & 4096px High-Res PNG',
        competitors: 'Low-resolution only (SVG locked behind paywall)',
      },
      {
        name: 'Supported Formats Free',
        bharatDevTools: '11 Types Free (UPI, Wi-Fi, vCard, WhatsApp, etc.)',
        competitors: 'Business types locked behind premium tiers',
      },
    ],
  },
  Developer: {
    title: 'Bharat Dev Tools vs Typical Developer Utilities',
    subtitle: 'Purpose-built developer utilities designed for instant execution, zero latency, and zero telemetry.',
    features: [
      {
        name: 'Security & Telemetry',
        bharatDevTools: 'Zero Analytics on Inputs (Tokens & keys stay local)',
        competitors: 'Inputs often sent to telemetry or analytics servers',
      },
      {
        name: 'Offline Capable',
        bharatDevTools: 'Runs 100% Offline in Browser Cache',
        competitors: 'Fails to function without active internet',
      },
      {
        name: 'Computation Latency',
        bharatDevTools: 'Instant Computation (0ms network roundtrip)',
        competitors: 'Subject to remote server latency and queues',
      },
      {
        name: 'Account & Sign-In',
        bharatDevTools: 'Immediate Access (No sign-in or API keys needed)',
        competitors: 'Requires registration or developer account',
      },
    ],
  },
  'Encode & Security': {
    title: 'Bharat Dev Tools vs Remote Cryptographic Tools',
    subtitle: 'Cryptographic hashing, decoding, and key generation powered strictly by the native W3C Web Crypto API.',
    features: [
      {
        name: 'Secret Key Protection',
        bharatDevTools: 'Web Crypto API (Keys never leave browser memory)',
        competitors: 'Secrets transmitted across network to server',
      },
      {
        name: 'Network Access',
        bharatDevTools: 'Zero Network Requests for Hash/Decode',
        competitors: 'Logged in web server proxy and access logs',
      },
      {
        name: 'Offline Verification',
        bharatDevTools: 'Runs Fully Offline without an Internet Connection',
        competitors: 'Requires continuous internet connection',
      },
      {
        name: 'Output Integrity',
        bharatDevTools: 'RFC-Compliant Standard Implementations',
        competitors: 'Often injects promotional wrapper text',
      },
    ],
  },
  'Calculators & Time': {
    title: 'Bharat Dev Tools vs Commercial Calculator Portals',
    subtitle: 'Fast, responsive financial and time calculators with instant live feedback on every keystroke.',
    features: [
      {
        name: 'Calculation Speed',
        bharatDevTools: 'Real-Time Dynamic Recalculation on Every Keystroke',
        competitors: 'Requires page reloads or submit button clicks',
      },
      {
        name: 'Amortization & Schedules',
        bharatDevTools: 'Complete Month-by-Month Table & CSV Export Free',
        competitors: 'Summary only (full schedule requires lead capture)',
      },
      {
        name: 'Distraction-Free UI',
        bharatDevTools: 'Zero Popups, Zero Ads, Clean Clean Layout',
        competitors: 'Heavy display advertisements and financial offers',
      },
      {
        name: 'Offline Support',
        bharatDevTools: 'Functions Locally without Network Connection',
        competitors: 'Reloads on every adjustment',
      },
    ],
  },
  'Design & Animation': {
    title: 'Bharat Dev Tools vs Cloud Animation Services',
    subtitle: 'Inspect, validate, optimize and play Lottie animations locally with zero intellectual property leakage.',
    features: [
      {
        name: 'Asset Confidentiality',
        bharatDevTools: '100% In-Browser Rendering (Unreleased assets stay safe)',
        competitors: 'Uploaded to third-party cloud hosting servers',
      },
      {
        name: 'Engine Performance',
        bharatDevTools: 'Hardware-Accelerated WebAssembly Canvas/SVG',
        competitors: 'Server-side video transcoding queues',
      },
      {
        name: 'File Size Limits',
        bharatDevTools: 'No Artificial File Size Caps',
        competitors: 'Restricts animation JSON size on free plans',
      },
      {
        name: 'No Sign-Up or Paywall',
        bharatDevTools: 'Instant 1-Click Inspection and Playback',
        competitors: 'Requires paid subscription for basic dev features',
      },
    ],
  },
};

interface ComparisonTableProps {
  toolId: string;
  category: ToolCategory;
}

export default function ComparisonTable({ toolId, category }: ComparisonTableProps) {
  // Use tool-specific comparison if applicable (e.g. QuickDrop), otherwise fallback to category
  const comparisonKey = toolId === 'quickdrop' ? 'QuickDrop' : category;
  const data = COMPARISONS_BY_CATEGORY[comparisonKey] || COMPARISONS_BY_CATEGORY['Developer'];

  return (
    <section className="mt-12 pt-8 border-t border-border" aria-labelledby="comparison-table-heading">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Feature &amp; Privacy Comparison</span>
        </div>
        <h2 id="comparison-table-heading" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          {data.title}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
          {data.subtitle}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold text-foreground w-1/3">
                Feature / Capability
              </th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-bold text-primary bg-primary/5 dark:bg-primary/10 w-1/3 border-x border-border/80">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Bharat Dev Tools</span>
                </div>
              </th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-medium text-muted-foreground w-1/3">
                Typical Online Services
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {data.features.map((item, index) => (
              <tr key={index} className="hover:bg-muted/30 transition-colors">
                <td className="py-3.5 px-4 sm:px-6 font-medium text-foreground">
                  {item.name}
                </td>
                <td className="py-3.5 px-4 sm:px-6 bg-primary/5 dark:bg-primary/10 border-x border-border/80 font-medium text-foreground">
                  <div className="flex items-start gap-2">
                    <span className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <Check className="w-4 h-4" />
                      <span className="sr-only">Included:</span>
                    </span>
                    <span className="leading-snug">{item.bharatDevTools}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 sm:px-6 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="p-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                      <X className="w-4 h-4" />
                      <span className="sr-only">Not Included:</span>
                    </span>
                    <span className="leading-snug">{item.competitors}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
